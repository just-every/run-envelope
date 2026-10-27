import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function automationJourney({origin,cookie,sql,advanceClock,restart,settings}) {
  const call=(path,body,who=cookie)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{...(who?{cookie:who}:{}),origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data=async(path,body,status=200)=>{const r=await call(path,body);assert.equal(r.status,status,await r.clone().text());return r.json()}
  await advanceClock('2026-11-10T12:00:00Z')
  const company=await data('/api/envelope/companies',{name:'Synthetic automation company',ein:'00-0000460'},201),base='/api/envelope/companies/'+company.id,door=base+'/automation',pay=base+'/pay-settings'
  const location=await data(base+'/locations',{name:'Synthetic Seattle',state:'WA'},201)
  const person=await data(base+'/people',{name:'Synthetic hourly worker',locationId:location.id},201)
  const group='synthetic-envelope-460'
  await data(pay+'/group',{id:group,version:0,name:'Weekly crew',people:[person.id]},201)
  const review=await data(pay+'/review/group/'+group)
  await data(pay+'/group/'+group+'/approve',{version:review.version,reviewToken:review.reviewToken})
  const screen=door.replace('/api/','/app/'),browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox']})
  const context=await browser.newContext();await context.addCookies([{name:cookie.split('=')[0],value:cookie.split('=')[1],url:origin}]);const page=await context.newPage()
  const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(proof,{recursive:true})
  const capture=async (label,path=screen)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(origin+path);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);for(const control of await page.locator('button,a').all())assert.ok((await control.innerText()).trim(),'all controls have visible words');await page.screenshot({path:join(proof,'automation-'+label+'-'+width+'.png'),fullPage:true})}}
  try {
    await capture('company',base.replace('/api/','/app/'))
    await capture('empty')
    const policy={id:'synthetic-envelope-461',version:0,name:'Weekly missing hours',groupId:group,periodStart:'2026-11-02',periodEnd:'2026-11-08',payDate:'2026-11-13',prepareAt:'2026-11-10T12:00:00Z',cutoff:'2026-11-12T17:00:00Z',approver:'Synthetic absent approver',backup:'Synthetic backup',duty:'Synthetic duty'}
    // Enter the real settings form and use its keyboard submit door.
    await page.goto(origin+screen)
    for(const [name,value] of Object.entries(policy).filter(([name])=>name!=='version'))await page.locator('[name="'+name+'"]').fill(String(value))
    await page.getByRole('button',{name:'Save weekly preparation',exact:true}).focus();const saved=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===screen);await page.keyboard.press('Enter');const savedResponse=await saved;assert.equal(savedResponse.status(),303);await page.waitForLoadState('networkidle')
    assert.equal((await data(door)).policies.length,1)
    const noOffset=await call(door,{...policy,id:'synthetic-envelope-462',cutoff:'2026-11-12T17:00'})
    assert.equal(noOffset.status,400)
    assert.equal((await data(door)).policies.length,1,'invalid cutoff creates no schedule')
    await advanceClock('2026-11-10T20:59:00Z')
    let result=await data(door+'/process',{})
    assert.deepEqual(result.tasks.map(t=>t.stage).sort(),['approval','hours'])
    assert.equal(result.dispatchAuthority,false);assert.equal(result.delivery,'unavailable');assert.equal(result.serviceCoverage,'unverified')
    await capture('waiting')
    await advanceClock('2026-11-10T21:00:00Z')
    result=await data(door+'/process',{})
    assert.deepEqual(result.tasks.map(t=>t.stage).sort(),['approval','backup','hours'])
    assert.equal(result.tasks.find(t=>t.stage==='backup').recipient,'Synthetic backup')
    assert.equal(result.tasks.find(t=>t.stage==='backup').due_at,Date.parse('2026-11-10T21:00:00Z'),'Veterans Day is excluded from eight support hours')
    await restart();await advanceClock('2026-11-10T21:00:00Z')
    const concurrent=await Promise.all([data(door+'/process',{}),data(door+'/process',{})])
    assert.ok(concurrent.every(r=>r.tasks.length===3),'restart and concurrent passes retain one task per stage')
    const runs=(await data(pay)).runs
    assert.equal(runs.length,1,'one immutable draft after repeated passes')
    assert.equal(runs[0].data.paymentReady,false)
    assert.equal((await sql('SELECT COUNT(*) AS count FROM env_run_approvals'))[0].count,0)
    assert.equal((await call(pay+'/earnings-run/'+runs[0].id+'/release',{version:runs[0].version})).status,409)
    await advanceClock('2026-11-12T12:59:00Z');assert.equal((await data(door+'/process',{})).tasks.length,3)
    await advanceClock('2026-11-12T13:00:00Z');result=await data(door+'/process',{})
    assert.equal(result.tasks.length,4)
    assert.equal(result.tasks.find(t=>t.stage==='service').due_at,Date.parse('2026-11-12T13:00:00Z'))
    assert.equal(result.tasks.find(t=>t.stage==='service').recipient,'Synthetic duty')
    assert.ok(result.tasks.every(t=>t.delivery==='unavailable'&&t.disposed_at===null),'task existence never implies delivery or completion')
    await capture('escalated')
    await data(door+'/disposition',{policyId:policy.id,occurrence:policy.periodStart,stage:'hours',reason:'Synthetic person confirmed no hours are owed for this period'})
    result=await data(door+'/process',{})
    assert.equal(result.tasks.filter(t=>t.disposed_at).length,1,'only the justified hours task stops')
    assert.ok(result.tasks.find(t=>t.stage==='hours').disposed_by)
    assert.equal(result.tasks.find(t=>t.stage==='hours').reason,'Synthetic person confirmed no hours are owed for this period')
    const dispositionAudit=(await data(base+'/audit')).filter(e=>e.action==='automation.disposition')
    assert.equal(dispositionAudit.length,1)
    await data(door+'/disposition',{policyId:policy.id,occurrence:policy.periodStart,stage:'hours',reason:'Synthetic replay'},409)
    assert.deepEqual((await data(base+'/audit')).filter(e=>e.action==='automation.disposition'),dispositionAudit,'replay cannot add an attribution or replace the justification')
    assert.equal(result.tasks.find(t=>t.stage==='approval').disposed_at,null,'disposition is not approval')
    await capture('disposition')
    // Detection inside four hours immediately creates both escalation stages.
    await data(door,{...policy,id:'synthetic-envelope-463',name:'Detected late',prepareAt:'2026-11-12T13:00:00Z'})
    result=await data(door+'/process',{});assert.deepEqual(result.tasks.filter(t=>t.policy_id==='synthetic-envelope-463').map(t=>t.stage).sort(),['approval','backup','hours','service'])
    // A real November DST weekend moves the preceding Friday to EDT, not EST.
    await data(door,{...policy,id:'synthetic-envelope-464',name:'DST recovery',prepareAt:'2026-10-30T12:00:00Z',cutoff:'2026-11-02T17:00:00Z'})
    result=await data(door+'/process',{})
    const dst=result.tasks.filter(t=>t.policy_id==='synthetic-envelope-464'&&t.occurrence==='2026-11-02')
    assert.equal(dst.find(t=>t.stage==='backup').due_at,Date.parse('2026-10-30T20:00:00Z'))
    assert.equal(dst.find(t=>t.stage==='service').due_at,Date.parse('2026-11-02T13:00:00Z'))
    const anonymous=await call(door,undefined,'');assert.equal(anonymous.status,401)
    const member='synthetic-envelope-465',token=randomBytes(32).toString('base64url'),now=Date.parse('2026-11-12T13:00:00Z')
    const hashed=await hashToken(settings.SESSION_SECRET,'session',token)
    await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','synthetic-envelope-465@example.com','Synthetic preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now+3600000})`)
    await data(base+'/grants',{operatorId:member,version:0,role:'payroll-admin',locations:['*'],fields:['compensation'],actions:['records:read','records:write','rates:propose']})
    let memberCookie=cookie.split('=')[0]+'='+token
    const before=(await data(door)).tasks
    for(const [path,body] of [[door,undefined],[door,{...policy,id:'synthetic-envelope-466'}],[door+'/process',{}],[door+'/disposition',{policyId:policy.id,occurrence:policy.periodStart,stage:'approval',reason:'Synthetic refusal'}]])assert.equal((await call(path,body,memberCookie)).status,403,'non-owner has no automation authority')
    assert.deepEqual((await data(door)).tasks,before)
    assert.equal((await sql('SELECT COUNT(*) AS count FROM env_run_approvals'))[0].count,0,'escalation never grants approval')
    // Delegation is explicit and separate from payroll approval and configuration.
    const delegated=async(path,body,who=memberCookie,status=200)=>{const r=await call(path,body,who);assert.equal(r.status,status,await r.clone().text());return r.json()}
    const preparerActions=['records:read','rates:propose','automation:inspect','automation:prepare']
    let grantVersion=1
    const grant=async(locations,fields,actions)=>{
      const oldCookie=memberCookie
      await data(base+'/grants',{operatorId:member,version:grantVersion++,role:'preparer',locations,fields,actions})
      assert.equal((await call(door,undefined,oldCookie)).status,401,'grant changes revoke the previous native session')
      const fresh=randomBytes(32).toString('base64url'),freshHash=await hashToken(settings.SESSION_SECRET,'session',fresh)
      await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}-${grantVersion}','${freshHash}','${member}',1,'native',${now},${now+3600000})`)
      memberCookie=cookie.split('=')[0]+'='+fresh
    }
    await grant([location.id],['compensation'],preparerActions)
    for(const [path,body] of [[door,undefined],[door+'/process',{}]])await delegated(path,body,memberCookie,403)
    await grant(['*'],[],preparerActions)
    for(const [path,body] of [[door,undefined],[door+'/process',{}]])await delegated(path,body,memberCookie,403)
    await grant(['*'],['compensation'],['records:read','rates:propose','automation:inspect'])
    await delegated(door+'/process',{},memberCookie,403)
    await grant(['*'],['compensation'],preparerActions)
    const delegatedPolicy={...policy,id:'synthetic-envelope-468',name:'Delegated preparation',prepareAt:'2026-11-12T13:00:00Z'}
    await data(door,delegatedPolicy)
    const configured=(await data(door)).policies.find(p=>p.id===delegatedPolicy.id)
    assert.ok(configured.createdBy);assert.notEqual(configured.createdBy,member)
    await delegated(door,{...policy,id:'synthetic-envelope-469'},memberCookie,403)
    const prepared=await delegated(door+'/process',{})
    assert.deepEqual(prepared.tasks.filter(t=>t.policy_id===delegatedPolicy.id).map(t=>t.stage).sort(),['approval','backup','hours','service'])
    assert.equal(prepared.dispatchAuthority,false)
    const draft=(await data(pay)).runs.find(r=>r.id==='auto-'+delegatedPolicy.id+'-'+policy.periodStart)
    assert.equal(draft.createdBy,member);assert.equal(draft.data.paymentReady,false)
    assert.equal(draft.approvedBy,null)
    const disposition={policyId:delegatedPolicy.id,occurrence:policy.periodStart,stage:'hours',reason:'Synthetic reviewer confirmed this identified hours obligation needs no further reminder'}
    await delegated(door+'/disposition',disposition,memberCookie,403)
    const reviewer='synthetic-envelope-470',reviewerToken=randomBytes(32).toString('base64url')
    const reviewerHash=await hashToken(settings.SESSION_SECRET,'session',reviewerToken)
    await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${reviewer}','synthetic-envelope-470@example.com','Synthetic disposition reviewer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${reviewer}','${reviewerHash}','${reviewer}',1,'native',${now},${now+3600000})`)
    const reviewerCookie=cookie.split('=')[0]+'='+reviewerToken
    await data(base+'/grants',{operatorId:reviewer,version:0,role:'preparer',locations:['*'],fields:['compensation'],actions:['records:read','automation:inspect','automation:dispose']})
    assert.ok((await delegated(door,undefined,reviewerCookie)).tasks.some(t=>t.policy_id===delegatedPolicy.id))
    await delegated(door+'/process',{},reviewerCookie,403)
    await delegated(door+'/disposition',disposition,reviewerCookie)
    const disposed=(await delegated(door)).tasks.filter(t=>t.policy_id===delegatedPolicy.id)
    assert.equal(disposed.filter(t=>t.disposed_at!==null).length,1)
    assert.equal(disposed.find(t=>t.stage==='hours').disposed_by,reviewer)
    assert.equal(disposed.find(t=>t.stage==='hours').disposed_at,now)
    assert.equal(disposed.find(t=>t.stage==='hours').reason,disposition.reason)
    assert.equal(disposed.find(t=>t.stage==='approval').disposed_at,null)
    await delegated(door+'/disposition',{...disposition,reason:'Synthetic replay'},reviewerCookie,409)
    const attributed=await data(base+'/audit')
    for(const [action,actorId,targetId] of [['workspace.automation-policy.recorded',configured.createdBy,delegatedPolicy.id],['automation.processed',member,draft.id],['automation.inspected',reviewer,company.id],['automation.disposition',reviewer,delegatedPolicy.id]])assert.ok(attributed.some(e=>e.action===action&&e.actorId===actorId&&e.targetId===targetId&&e.occurredAt===now&&e.version>0),action+' retains actor, time, target and version')
    const foreign=await data('/api/envelope/companies',{name:'Synthetic foreign automation',ein:'00-0000471'},201)
    await delegated('/api/envelope/companies/'+foreign.id+'/automation',undefined,memberCookie,403)
    await delegated('/api/envelope/companies/'+foreign.id+'/automation/process',{},memberCookie,403)
    await delegated(pay+'/earnings-run/'+draft.id+'/release',{version:draft.version},memberCookie,403)
    // The same existing screen exposes only each person's explicit actions.
    const browserIdentity=async who=>context.addCookies([{name:who.split('=')[0],value:who.split('=')[1],url:origin}])
    await browserIdentity(memberCookie);await capture('preparer')
    await page.setViewportSize({width:1440,height:1000})
    assert.equal(await page.getByRole('button',{name:'Process due work',exact:true}).count(),1)
    assert.equal(await page.getByRole('button',{name:'Record disposition',exact:true}).count(),0)
    assert.equal(await page.getByRole('button',{name:'Save weekly preparation',exact:true}).count(),0)
    await browserIdentity(reviewerCookie);await capture('reviewer')
    await page.setViewportSize({width:1440,height:1000})
    assert.equal(await page.getByRole('button',{name:'Process due work',exact:true}).count(),0)
    assert.ok(await page.getByRole('button',{name:'Record disposition',exact:true}).count()>0)
    assert.equal(await page.getByRole('button',{name:'Save weekly preparation',exact:true}).count(),0)
    await browserIdentity(cookie)
    await data(base+'/grants',{operatorId:member,version:grantVersion,revoke:true})
    await data(base+'/grants',{operatorId:reviewer,version:1,revoke:true})
    const retained=(await data(door)).tasks
    const rowCounts=await sql("SELECT (SELECT COUNT(*) FROM env_workspace_versions) AS versions,(SELECT COUNT(*) FROM env_automation_tasks) AS tasks,(SELECT COUNT(*) FROM env_run_approvals) AS approvals")
    for(const who of [memberCookie,reviewerCookie])for(const [path,body] of [[door,undefined],[door+'/process',{}],[door+'/disposition',{...disposition,stage:'approval'}]])await delegated(path,body,who,401)
    assert.deepEqual((await data(door)).tasks,retained,'old sessions cannot read or change tasks after grant revocation')
    assert.deepEqual(await sql("SELECT (SELECT COUNT(*) FROM env_workspace_versions) AS versions,(SELECT COUNT(*) FROM env_automation_tasks) AS tasks,(SELECT COUNT(*) FROM env_run_approvals) AS approvals"),rowCounts)
    assert.equal(rowCounts[0].approvals,0)
    await capture('delegated-disposition')

    await page.goto(origin+screen);await page.locator('[name="id"]').fill('synthetic-envelope-467')
    for(const [name,value] of Object.entries(policy).filter(([name])=>!['id','version'].includes(name)))await page.locator('[name="'+name+'"]').fill(String(value))
    await page.locator('[name="cutoff"]').fill('invalid deadline')
    const failed=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===screen)
    await page.getByRole('button',{name:'Save weekly preparation',exact:true}).click();assert.equal((await failed).status(),400);await page.waitForLoadState('networkidle')
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(proof,'automation-refused-'+width+'.png'),fullPage:true})}

    const audit=await data(base+'/audit');assert.ok(JSON.stringify(audit).includes('automation.disposition'))
    console.log('AUTOMATION: settings, native recurring drafts, deduplicated durable tasks, holiday and DST escalation, absent delivery and no dispatch authority passed')
  } finally {await browser.close()}
}
