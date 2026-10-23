import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {unstable_startWorker} from 'wrangler'
import {chromium} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {hashToken} from '../../../src/modules/operator-auth/crypto.mjs'
import {localCookieName} from '../../../src/modules/operator-auth/http.mjs'
const execute=promisify(execFile)

export async function restoredJourney({target,settings,formerToken}) {
  const origin=settings.AUTH_ORIGIN,sql=async command=>JSON.parse((await execute(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'d1','execute','foundation','--local','--persist-to',join(target,'.wrangler/state'),'--config',join(target,'wrangler.jsonc'),'--json','--command',command],{env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'},maxBuffer:4*1024*1024})).stdout).flatMap(r=>r.results),
    owner=(await sql("SELECT id,version FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1"))[0],
    token=randomBytes(32).toString('base64url'),session='synthetic-envelope-580',hash=await hashToken(settings.SESSION_SECRET,'session',token),cookie=localCookieName('operator_session_local',origin)+'='+token
  assert.equal((await sql('SELECT COUNT(*) AS n FROM env_grants'))[0].n,0)
  assert.equal((await sql('SELECT COUNT(*) AS n FROM env_agent_credentials'))[0].n,0)
  assert.equal((await sql('SELECT COUNT(*) AS n FROM env_external_providers'))[0].n,0)
  // A fresh native fixture identity is admitted locally, never a transplanted session.
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('${session}','${hash}','${owner.id}',${owner.version},'native',${Date.now()},${Date.now()+3600000}); INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES('${session}','${hash}','${session}','${owner.id}',${owner.version},'credentials:mint','/app',${Date.now()},${Date.now()+600000},${Date.now()})`)
  const network=[],edge={records:new Map(),mode:'normal'},worker=await unstable_startWorker({config:resolve('dist/server/wrangler.json'),bindings:Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,{type:'plain_text',value}])),dev:{server:{hostname:'127.0.0.1',port:Number(new URL(origin).port)},inspector:false,remote:false,watch:false,persist:join(target,'.wrangler/state'),logLevel:'error',outboundService:async request=>{
    network.push({url:request.url,method:request.method})
    assert.equal(request.method,'GET','restore lookup must never POST or resend')
    assert.equal(request.headers.get('authorization'),'Bearer synthetic-envelope-582')
    const emailId=new URL(request.url).pathname.split('/').at(-1),original=edge.records.get(emailId)
    assert.equal(request.url,'https://api.resend.com/emails/'+emailId)
    assert.ok(original,'only a recorded accepted original ID can be queried')
    if(edge.mode==='redirect') return new Response(null,{status:302,headers:{location:'https://ungranted.example/collect'}})
    return Response.json({object:'email',id:emailId,from:original.sender,to:[edge.mode==='mismatch'?'foreign@example.com':original.to],subject:original.subject,text:original.body,created_at:'2026-10-23T00:00:00Z',last_event:'delivered'})
  }}})
  let browser
  try {
    await worker.ready
    const call=(path,body)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    const setup=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'displayName=Restored+owner&confirm=yes'})
    assert.equal(setup.status,303,await setup.clone().text())
    const list=await call('/api/envelope/restored')
    assert.equal(list.status,200,await list.clone().text())
    const companies=await list.json()
    assert.ok(companies.length>=2)
    assert.deepEqual(await (await call('/api/envelope/companies')).json(),[],'archive authority is not silently adopted')
    browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
    const context=await browser.newContext(),page=await context.newPage(),at=cookie.indexOf('='),proof=process.env.ENVELOPE_PROOF_DIR??'test-results/envelope'
    await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin}]);await mkdir(proof,{recursive:true})
    const capture=async(path,label)=>{for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});assert.equal((await page.goto(origin+path)).status(),200);await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],label+' WCAG '+width);await page.keyboard.press('Tab');await page.screenshot({path:join(proof,label+'-'+width+'.png'),fullPage:true})}}
    await capture('/app/envelope/restored','archive-fresh-read-custody')
    const company=companies.find(c=>c.name==='Brightside Colorado Studio')
    assert.ok(company)
    assert.equal((await call('/api/envelope/restored/'+company.id+'/adopt',{confirm:false})).status,400)
    await page.locator('form[action="/app/envelope/restored/'+company.id+'/adopt"] input[name="confirm"]').check()
    await page.locator('form[action="/app/envelope/restored/'+company.id+'/adopt"] button').click()
    await page.waitForURL(origin+'/app/envelope/companies/'+company.id)
    const current=await (await call('/api/envelope/companies/'+company.id)).json()
    assert.equal(current.company.restored,1)
    const adoption=(await sql("SELECT actor_id,target_id FROM env_audit WHERE action='archive.custody.adopted' AND company_id='"+company.id+"'"))
    assert.deepEqual(adoption,[{actor_id:owner.id,target_id:company.id}],'explicit historical read adoption records the current owner and exact company')
    await capture('/app/envelope/companies/'+company.id,'archive-history-paused')
    const historicalPayroll=await (await call('/api/envelope/companies/'+company.id+'/pay-settings')).json()
    assert.ok(historicalPayroll.approvals.some(a=>a.approvals.length>0),'historical approver attribution survives')
    assert.ok(historicalPayroll.approvals.every(a=>a.current===0),'imported approvals are never represented as current authority')
    assert.equal((await call('/api/envelope/companies/'+company.id+'/locations',{name:'Must remain paused'})).status,409)
    assert.equal((await call('/api/envelope/companies/'+company.id+'/providers',{id:'openai',version:0,enabled:true,secret:'synthetic-envelope-581',consent:true})).status,409)
    assert.equal((await fetch(origin+'/api/envelope/mcp',{method:'POST',headers:{origin,authorization:'Bearer '+formerToken,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:53,method:'tools/list'})})).status,401,'a source credential cannot execute after restore')
    const notices=await (await call('/api/envelope/companies/'+company.id+'/notices')).json()
    assert.ok(notices.length)
    const restoredNotice=notices.find(n=>n.reference==='Synthetic CP161 balance-due notice')
    assert.ok(restoredNotice)
    const notice=await (await call('/api/envelope/companies/'+company.id+'/notices/'+restoredNotice.id)).json()
    assert.ok(notice.files.length>=3)
    assert.ok(notice.replies.some(r=>r.dispatchState==='unknown'))
    assert.ok(notice.replies.some(r=>r.dispatchState==='accepted' && r.providerReceipt))
    const download=await call('/api/envelope/companies/'+company.id+'/notices/'+restoredNotice.id+'/files/'+notice.files[0].id+'/'+notice.files[0].version)
    assert.equal(download.status,200)
    assert.ok((await download.arrayBuffer()).byteLength>0,'fresh custody can recover encrypted original bytes')
    assert.deepEqual(network,[],'historical adoption and reads never resume external work')
    const restore='/api/envelope/companies/'+company.id+'/restore',restoreUi='/app/envelope/companies/'+company.id+'/restore',originalEffects=await (await call(restore)).json(),accepted=originalEffects.effects.find(e=>e.state==='accepted'),unknown=originalEffects.effects.find(e=>e.state==='unknown')
    assert.ok(accepted && unknown)
    assert.equal((await call(restore+'/reconcile',{dispatchId:accepted.id})).status,409,'lookup requires fresh separate consent')
    await capture(restoreUi,'archive-original-ids-unconnected')
    await page.getByLabel('Restore lookup connection state',{exact:true}).selectOption('true')
    await page.getByLabel('Fresh Resend API credential (empty to retain)',{exact:true}).fill('synthetic-envelope-582')
    const payload=notice.replies.find(r=>r.providerReceipt===accepted.providerReceipt).data
    edge.records.set(accepted.providerReceipt,payload)
    await page.getByLabel('Verified sender for any future separately approved correspondence',{exact:true}).fill(payload.sender)
    await page.getByLabel('I authorize the declared Resend correspondence purpose; all sending remains paused.',{exact:true}).check()
    await page.getByLabel('I separately authorize lookup of recorded original notice email IDs.',{exact:true}).check()
    await page.getByRole('button',{name:'Save fresh restore lookup consent',exact:true}).click()
    await page.waitForURL(origin+restoreUi)
    await capture(restoreUi,'archive-original-ids-fresh-consent')
    assert.equal((await call(restore+'/reconcile',{dispatchId:unknown.id})).status,409,'unknown original ID cannot be fabricated or resent')
    assert.equal(network.length,0)
    edge.mode='mismatch'
    assert.equal((await call(restore+'/reconcile',{dispatchId:accepted.id})).status,409,'foreign recipient record cannot reconcile this original')
    edge.mode='redirect'
    assert.equal((await call(restore+'/reconcile',{dispatchId:accepted.id})).status,409,'redirect cannot forward a lookup credential')
    edge.mode='normal'
    await page.locator('form:has(input[name="dispatchId"][value="'+accepted.id+'"]) button').click()
    await page.waitForURL(origin+restoreUi)
    const reconciled=await (await call(restore)).json()
    assert.ok(reconciled.effects.find(e=>e.id===accepted.id).checkedAt)
    assert.equal(reconciled.effects.find(e=>e.id===unknown.id).checkedAt,null)
    assert.equal(network.length,3)
    assert.ok(network.every(r=>r.method==='GET' && r.url==='https://api.resend.com/emails/'+accepted.providerReceipt))
    assert.equal((await call('/api/envelope/companies/'+company.id+'/locations',{name:'Still cannot resume'})).status,409)
    assert.equal((await sql('SELECT COUNT(*) AS n FROM env_restore_receipts'))[0].n,1)
    await capture(restoreUi,'archive-original-id-verified-unknown-held')
    await call(restore+'/providers',{id:'resend',version:1,enabled:false})
    const disabled=await (await call(restore)).json()
    assert.equal(disabled.effects.find(e=>e.id===accepted.id).checkedAt,null,'a changed connection cannot inherit a prior local reconciliation')
    assert.equal((await call(restore+'/reconcile',{dispatchId:accepted.id})).status,409)
    assert.equal(network.length,3)
    await capture(restoreUi,'archive-connection-withdrawn')
    console.log('RESTORED-CUSTODY passed: fresh original-owner native consent adopts read-only history, no transferred grants/keys, private bytes recovered, unknown/accepted original IDs retained, old credential and all mutations refused, no automatic effects; separately consented original-ID GET lookup, mismatch/redirect refusal and durable unknown hold; 1440/390 WCAG proof')
    await context.close()
  } finally {await browser?.close();await worker.dispose()}
}
