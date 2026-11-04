import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../../src/modules/operator-auth/crypto.mjs'
import {client,negativeSessions,state,login,cookieOf,reviewerMail} from './native.mjs'
import {sensitiveFixtures} from './fixtures.mjs'

const error=answer=>answer.result?._meta?.['com.runeditrun/error']?.code??answer.error?.data?.code??answer.error?.message
const decision=answer=>answer.result?._meta?.['com.runeditrun/decision']
const value=answer=>answer.result?.structuredContent
export function readClient({request,origin},credential,path='/mcp') {
  return async(name,args,requestState)=>{
    const response=await request(origin+path,{method:'POST',headers:{authorization:'Bearer '+credential.token,'content-type':['application','json'].join('/'),'MCP-Protocol-Version':'2026-07-28','MCP-Method':['tools','call'].join('/'),'MCP-Name':'envelope.'+name},body:JSON.stringify({jsonrpc:'2.0',id:74,method:['tools','call'].join('/'),params:{name:'envelope.'+name,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'},arguments:args,...(requestState?{requestState}:{})}})})
    return response.json()
  }
}
function facts(answer,count,kind='compensation',cls='sensitive') {
  assert.equal(error(answer),undefined)
  assert.deepEqual(decision(answer).classes.map(({class:className,facts})=>({class:className,facts})),[{class:cls,facts:{measure:count,...(cls==='sensitive'?{kind}:{})}}])
}
const prepared=(person,key)=>({personId:person.id,minutes:480,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9742',requestKey:key,idempotency_key:key})

/** Populated public-door sanity journey for classifications and viewer limits. */
export default async function sensitiveReads(context) {
  const {request,origin,cookie,database}=context,data=client(context),db=await database('DB')
  const setup=await sensitiveFixtures(context),{company,base,people,location,credential,issue}=setup
  const call=readClient(context,credential),args={companyId:company.id}
  const rest=async(path,token=credential.token)=>request(origin+'/api/envelope/v1/companies/'+company.id+path,{headers:{authorization:'Bearer '+token}})
  for(const name of ['reports.proposals','reports.bonuses']) {const empty=await call(name,args);facts(empty,0);assert.deepEqual(value(empty)[name==='reports.proposals'?'proposals':'bonuses'],[])}
  const drafts=[],bonuses=[]
  for(const [index,person] of people.entries()) {
    const input=prepared(person,crypto.randomUUID())
    const draft=await call('draft.prepare',{...args,...input});assert.ok(value(draft)?.id);drafts.push(value(draft))
    const bonus=await call('bonus.prepare',{...args,...input,minutes:undefined,amountCents:12000+index,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()});assert.ok(value(bonus)?.id);bonuses.push(value(bonus))
  }
  for(const path of ['/mcp','/api/envelope/mcp']) {
    const read=readClient(context,credential,path)
    const masked=await read('records.list',{...args,limit:2});facts(masked,2,'', 'standard')
    assert.deepEqual(value(masked).records.map(row=>Object.keys(row).sort()),Array(2).fill(['id','locationId','name','version']))
    const hourly=await read('draft.read',{...args,draftId:drafts[0].id});facts(hourly,1);assert.equal(value(hourly).hourlyCents,2700);assert.equal(value(hourly).minutes,480)
    assert.deepEqual(Object.keys(value(hourly)).sort(),['approval','dispatch','hourlyCents','id','minutes','payDate','periodEnd','periodStart','personId','personName','personVersion','rateId','sourceRef','stale','status'].sort())
    const bonus=await read('bonus.read',{...args,runId:bonuses[0].id});facts(bonus,1);assert.equal(value(bonus).preview.grossCashCents,12000);assert.equal(value(bonus).preview.paymentReady,false)
    assert.deepEqual(Object.keys(value(bonus)).sort(),['approval','dispatch','id','preview','sourcesCurrent','status','version'])
    for(const [name,key,expected] of [['reports.proposals','proposals',drafts],['reports.bonuses','bonuses',bonuses]]) {
      let after,seen=[]
      do {const page=await read(name,{...args,limit:2,...(after?{after}:{})});const rows=value(page)[key];facts(page,seen.length?1:2);seen.push(...rows.map(row=>row.id));after=value(page).next}while(after)
      assert.deepEqual(seen.sort(),expected.map(row=>row.id).sort())
      const complete=await read(name,args)
      assert.deepEqual(Object.keys(value(complete)).sort(),['filing','kind','limit','next','payment','payroll',key].sort())
      const fields=name==='reports.proposals'?['id','personId','personVersion','rateId','minutes','periodStart','periodEnd','payDate','stale']:['id','version','personId','amountCents','periodStart','periodEnd','payDate','sourcesCurrent','status']
      for(const row of value(complete)[key])assert.deepEqual(Object.keys(row).sort(),fields.sort())
      assert.ok(!JSON.stringify(value(complete)).includes('synthetic-envelope-9748'))
      const empty=await read(name,{...args,after:'zzzz'});facts(empty,0)
    }
    const foreign=await read('draft.read',{companyId:state.get(origin).company.id,draftId:drafts[0].id});assert.ok(error(foreign));assert.equal(value(foreign),undefined)
  }
  for(const [path,count,cls] of [['/records?limit=2',2,'standard'],['/drafts/'+drafts[0].id,1,'sensitive'],['/bonus-runs/'+bonuses[0].id,1,'sensitive'],['/reports/proposals?limit=2',2,'sensitive'],['/reports/bonus-runs?limit=2',2,'sensitive'],['/reports/proposals?after=zzzz',0,'sensitive'],['/reports/bonus-runs?after=zzzz',0,'sensitive']]) {
    const response=await rest(path);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
    assert.deepEqual(JSON.parse(response.headers.get('x-envelope-classification')),[{class:cls,facts:{measure:count,...(cls==='sensitive'?{kind:'compensation'}:{})}}])
    const body=await response.json();assert.ok(body.id||body.records||body.proposals||body.bonuses)
    const head=await request(origin+'/api/envelope/v1/companies/'+company.id+path,{method:'HEAD',headers:{authorization:'Bearer '+credential.token}})
    assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('x-envelope-classification'),response.headers.get('x-envelope-classification'))
  }
  // Restricted grants cannot retrieve preparations made by another credential,
  // even when the worker's identity is otherwise visible at that location.
  const limited=await issue({locations:[location.id]}),limitedCall=readClient(context,limited)
  const masked=await limitedCall('records.list',args);facts(masked,2,'','standard');assert.ok(value(masked).records.every(row=>row.locationId===location.id))
  assert.ok(error(await limitedCall('draft.read',{...args,draftId:drafts[2].id})))
  assert.ok(error(await limitedCall('bonus.read',{...args,runId:bonuses[0].id})))
  const own=await limitedCall('draft.prepare',{...args,...prepared(people[0],crypto.randomUUID())});assert.ok(value(own)?.id)
  facts(await limitedCall('reports.proposals',args),1)

  // The same viewer sees identity in the UI and the tool; policy grants no fields.
  const viewer=negativeSessions.get(origin+':excluded'),viewerData=client({...context,cookie:viewer.cookie})
  const grant=await data(base+'/grants',{operatorId:viewer.operator.id,version:0,role:'viewer',actions:['records:read'],fields:[],locations:[location.id]})
  const viewerCredential=await viewerData(base+'/agents',{name:'Synthetic identity assistant',hours:1,actions:['records:read'],fields:[],locations:[location.id]},201)
  const viewerCall=readClient(context,viewerCredential)
  facts(await viewerCall('records.list',args),2,'','standard')
  for(const [name,extra] of [['draft.read',{draftId:drafts[0].id}],['bonus.read',{runId:bonuses[0].id}],['reports.proposals',{}],['reports.bonuses',{}]]) {
    assert.ok(error(await viewerCall(name,{...args,...extra})));assert.equal(value(await viewerCall(name,{...args,...extra})),undefined)
  }
  const ownerDetails=await data(base+'/people/'+people[0].id),viewerDetails=await viewerData(base+'/people/'+people[0].id)
  assert.equal(ownerDetails.rates[0].hourlyCents,2700);assert.equal(viewerDetails.rates,undefined)
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox']})
  const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(proof,{recursive:true})
  try {
    for(const [label,who,visible] of [['compensation',cookie,true],['identity',viewer.cookie,false]]) {
      const page=await browser.newPage({viewport:{width:1440,height:1000}})
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());assert.equal(url.origin,origin,'no outbound browser request')
        const response=await request(url.href,{headers:{cookie:who}})
        await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})
      })
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});await page.goto(origin+'/app/envelope/companies/'+company.id+'/people/'+people[0].id)
        if(width===1440)assert.equal(await page.getByText('$27.00 per hour',{exact:false}).count()>0,visible)
        await page.screenshot({path:join(proof,'sensitive-'+label+'-'+width+'.png'),fullPage:true})
      }
      await page.close()
    }
  } finally {await browser.close()}
  let policy=(await data(base+'/agents')).classPolicy
  for(const sensitive of ['blocked','approval']) {
    policy=await data(base+'/agents/class-policy',{version:policy.version,...(await import('./native.mjs')).answers,sensitive})
    for(const path of ['/mcp','/api/envelope/mcp'])for(const [name,extra] of [['draft.read',{draftId:drafts[0].id}],['bonus.read',{runId:bonuses[0].id}],['reports.proposals',{}],['reports.bonuses',{}]]) {
      const response=await readClient(context,credential,path)(name,{...args,...extra});assert.equal(error(response),sensitive==='blocked'?'policy_blocked':'policy_approval_required');assert.equal(value(response),undefined)
    }
    for(const path of ['/drafts/'+drafts[0].id,'/bonus-runs/'+bonuses[0].id,'/reports/proposals','/reports/bonus-runs']) {
      const response=await rest(path);assert.equal(response.status,403);const body=await response.json();assert.equal(body.error,sensitive==='blocked'?'policy_blocked':'policy_approval_required');assert.equal(body.proposals,undefined);assert.equal(body.preview,undefined)
      assert.equal(response.headers.get('x-envelope-classification'),null,'refusal carries no completed selection')
    }
    facts(await call('records.list',args),3,'','standard')
    for(const [name,extra] of [['draft.read',{draftId:drafts[0].id}],['bonus.read',{runId:bonuses[0].id}],['reports.proposals',{}],['reports.bonuses',{}]]) {
      const refused=await viewerCall(name,{...args,...extra});assert.ok(error(refused));assert.equal(value(refused),undefined)
    }
  }
  await data(base+'/agents/class-policy',{version:policy.version,...(await import('./native.mjs')).answers})
  const staffGrant=await data(base+'/grants',{operatorId:viewer.operator.id,version:grant.version,role:'preparer',actions:['records:read','rates:propose'],fields:['compensation'],locations:[location.id]})
  const staffCookie=cookieOf(await login({request,origin,email:viewer.operator.email,mail:reviewerMail.get(origin+':excluded')}))
  const staffData=client({...context,cookie:staffCookie})
  const sponsored=await staffData(base+'/agents',{name:'Synthetic scoped staff assistant',hours:1,actions:['records:read','drafts:prepare','drafts:read'],fields:['compensation'],locations:[location.id]},201)
  const staffCall=readClient(context,sponsored)
  const staffDraft=await staffCall('draft.prepare',{...args,...prepared(people[0],crypto.randomUUID())});assert.ok(value(staffDraft)?.id)
  facts(await staffCall('draft.read',{...args,draftId:value(staffDraft).id}),1)
  facts(await staffCall('reports.proposals',args),1)
  await data(base+'/grants',{operatorId:viewer.operator.id,version:staffGrant.version,revoke:true})
  assert.ok(error(await viewerCall('records.list',args)),'revoked sponsor authority stops the bearer')
  for(const [name,extra] of [['draft.read',{draftId:value(staffDraft).id}],['reports.proposals',{}]]) {
    const refused=await staffCall(name,{...args,...extra});assert.ok(error(refused));assert.equal(value(refused),undefined)
  }

  // Removing compensation keeps masked identity reads, but refuses every retained
  // read and report even though the class policy is autonomous again.
  const reduced=await call('credentials.restrict',{fields:[],idempotency_key:crypto.randomUUID()});assert.equal(error(reduced),undefined)
  facts(await call('records.list',args),3,'','standard')
  for(const [name,extra] of [['draft.read',{draftId:drafts[0].id}],['bonus.read',{runId:bonuses[0].id}],['reports.proposals',{}],['reports.bonuses',{}]])assert.ok(error(await call(name,{...args,...extra})))
  const limitedRows=(await data(base+'/agents')).grants
  await data(base+'/agents/'+limited.id+'/revoke',{version:limitedRows.find(row=>row.id===limited.id).version})
  assert.ok(error(await limitedCall('draft.read',{...args,draftId:value(own).id})))
  assert.ok(error(await limitedCall('reports.proposals',args)))
  const heldCredential=await issue(),heldCall=readClient(context,heldCredential)
  const grants=(await data(base+'/agents')).grants,version=grants.find(row=>row.id===credential.id).version
  await data(base+'/agents/'+credential.id+'/revoke',{version})
  assert.ok(error(await call('records.list',args)))
  const privacy=await data(base+'/people/'+people[0].id+'/privacy')
  const held=await data(base+'/people/'+people[0].id+'/privacy/request',{consent:true,fingerprint:privacy.fingerprint})
  assert.ok(held)
  assert.ok(error(await heldCall('reports.proposals',args)),'held worker custody cannot be bypassed')
  const outbound=await db.prepare("SELECT COUNT(*) AS n FROM env_notice_dispatches WHERE company_id=?").bind(company.id).first();assert.equal(outbound.n,0)
  console.log('PROBE SURFACE-004 acceptance-1: MCP, alias and REST -> exact masked and sensitive pages, counts 0, 1, 2 and 3; no compensation in viewer output')
  console.log('PROBE SURFACE-004 acceptance-2: scoped viewer, foreign company, location, reduced field, revoked sponsor and credential, held worker -> refused without content; UI parity at 1440 and 390')
}

/** Pending approvals bind an exact selection, including equal-count changes. */
export async function sensitiveApprovalStep(context) {
  if(context.phase!=='held'||context.step.id!=='reports-proposals')return
  const setup=await sensitiveFixtures(context),data=client(context),{credential,people,base}=setup
  const call=readClient(context,credential),args={companyId:setup.company.id,limit:1}
  const draft=await call('draft.prepare',{companyId:setup.company.id,...prepared(people[0],crypto.randomUUID())});assert.ok(value(draft)?.id)
  const change=async cents=>{
    const person=await data(base+'/people/'+people[0].id)
    const rate=await data(base+'/people/'+people[0].id+'/rates',{version:person.version,hourlyCents:cents,effectiveDate:'2026-01-01'},201)
    const review=await data(base+'/rates/'+rate.id)
    await data(base+'/rates/'+rate.id+'/approve',{reviewToken:review.reviewToken,version:review.version})
  }
  const approve=async pending=>{
    const id=pending.result._meta['com.runeditrun/approval'].id
    const {approval}=await data('/agents/api/approvals/'+id)
    return (await data('/agents/api/approvals/'+id+'/approve',{revision:approval.revision,summary_sha256:approval.summary_sha256})).approval
  }
  const pending=await call('reports.proposals',args)
  assert.equal(pending.result.resultType,'input_required',JSON.stringify(pending));assert.equal(value(pending),undefined)
  const {approval:display}=await data('/agents/api/approvals/'+pending.result._meta['com.runeditrun/approval'].id)
  assert.deepEqual(display.classes,[{class:'sensitive',facts:{measure:1,kind:'compensation'}}])
  assert.equal(display.summary.nativeTarget.kind,'compensation-selection')
  // Change the selected worker version without changing page cardinality.
  await change(2800)
  assert.equal((await approve(pending)).code,'approval_evidence_changed')
  const fresh=await call('reports.proposals',args);assert.equal(fresh.result.resultType,'input_required')
  assert.equal((await approve(fresh)).state,'executed')
  const result=await call('reports.proposals',args,fresh.result.requestState)
  facts(result,1);assert.equal(value(result).proposals.length,1)
  const added=await call('draft.prepare',{companyId:setup.company.id,...prepared(people[1],crypto.randomUUID())});assert.ok(value(added)?.id)
  // The page's next cursor changes even if its first item remains the same.
  const replay=await call('reports.proposals',args,fresh.result.requestState)
  assert.equal(error(replay),'read_selection_changed');assert.equal(value(replay),undefined)
  console.log('PROBE SURFACE-004 selection: pending and approved one-record report, changed worker at equal count -> approval_evidence_changed and read_selection_changed without contents')
}

/** Persisted read approval and a read suspended after the policy decision. */
export async function sensitiveRestartAndRaces(context) {
  const {origin,cookie,restart}=context,data=client(context)
  const setup=await sensitiveFixtures(context),{base,people,company,credential}=setup
  const call=readClient(context,credential),args={companyId:company.id}
  const prepare=async person=>{
    const result=await call('draft.prepare',{...args,...prepared(person,crypto.randomUUID())})
    assert.equal(error(result),undefined);return value(result)
  }
  const first=await prepare(people[0]);assert.ok(first.id)
  const document=sensitive=>({schema:['rer-agent-policy','1'].join('/'),catalogue:['rer-agent-classes','1'].join('/'),rules:[{id:'all',class:'*',do:'autonomous'},{id:'sensitive',class:'sensitive',do:sensitive,...(sensitive==='approval'?{approver:['sponsor'],wait:'PT1H'}:{})}],spend:{none:true}})
  const policy=async sensitive=>{
    const response=await fetch(origin+'/agents/api/policy',{method:'PUT',headers:{cookie,origin,'content-type':['application','json'].join('/')},body:JSON.stringify({document:document(sensitive)})})
    assert.equal(response.status,200)
  }
  const approve=async pending=>{
    const id=pending.result._meta['com.runeditrun/approval'].id
    const {approval}=await data('/agents/api/approvals/'+id)
    return (await data('/agents/api/approvals/'+id+'/approve',{revision:approval.revision,summary_sha256:approval.summary_sha256})).approval
  }
  // A real process restart retains pending evidence and the exact returned data.
  await policy('approval')
  const pending=await call('draft.read',{...args,draftId:first.id});assert.equal(pending.result.resultType,'input_required')
  await restart()
  assert.equal((await approve(pending)).state,'executed')
  const approved=await call('draft.read',{...args,draftId:first.id},pending.result.requestState)
  facts(approved,1);assert.equal(value(approved).hourlyCents,2700)
  const changed=await call('reports.proposals',args);assert.equal(changed.result.resultType,'input_required')
  await policy('autonomous')
  await prepare(people[1])
  // Policy revisions also fence old approvals; use a fresh approval to isolate
  // the changed-selection check across the next real process restart.
  await policy('approval')
  const stale=await call('reports.proposals',args);assert.equal(stale.result.resultType,'input_required')
  const person=await data(base+'/people/'+people[0].id)
  const rate=await data(base+'/people/'+people[0].id+'/rates',{version:person.version,hourlyCents:3100,effectiveDate:'2026-01-01'},201)
  const review=await data(base+'/rates/'+rate.id)
  await data(base+'/rates/'+rate.id+'/approve',{reviewToken:review.reviewToken,version:review.version})
  await restart()
  assert.equal((await approve(stale)).code,'approval_evidence_changed')
  await policy('autonomous')
  const suspended=context.request(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+credential.token,'content-type':['application','json'].join('/'),'MCP-Protocol-Version':'2025-11-25','x-synthetic-policy-batch':'read-hold'},body:JSON.stringify({jsonrpc:'2.0',id:75,method:['tools','call'].join('/'),params:{name:'envelope.reports.proposals',arguments:args}})})
  let waiting=false
  for(let attempt=0;attempt<100;attempt++) {
    const response=await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'observe'}})
    if(response.headers.get('x-synthetic-policy-state')==='waiting'){waiting=true;break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  try {assert.ok(waiting,'read reached its execution batch after classification');await prepare(people[2])}
  finally {await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}})}
  const refused=await (await suspended).json();assert.equal(error(refused),'read_selection_changed');assert.equal(value(refused),undefined)
  facts(await call('reports.proposals',args),3)
  // A revoked native reviewer session cannot execute a retained approval.
  await policy('approval')
  const withheld=await call('draft.read',{...args,draftId:first.id});assert.equal(withheld.result.resultType,'input_required')
  const id=withheld.result._meta['com.runeditrun/approval'].id
  const {approval}=await data('/agents/api/approvals/'+id)
  const session=await data('/auth/session'),token=randomBytes(32).toString('base64url')
  const now=Date.parse('2026-10-28T12:00:00Z'),hash=await hashToken(context.settings.SESSION_SECRET,'link',token)
  await context.sql(`INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at)
    VALUES('${crypto.randomUUID()}','${hash}','magic','${session.operator.id}',${session.operator.version},'/app',${now},${now+600000})`)
  const signed=await context.request(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{origin,'content-type':['application','json'].join('/')},body:JSON.stringify({token})})
  assert.equal(signed.status,303)
  const reviewerCookie=signed.headers.get('set-cookie').split(';')[0]
  const signedOut=await context.request(origin+'/auth/signout',{method:'POST',redirect:'manual',headers:{origin,cookie:reviewerCookie,'content-type':['application','json'].join('/')},body:'{}'})
  assert.equal(signedOut.status,204)
  const bogus=await context.request(origin+'/agents/api/approvals/'+id+'/approve',{method:'POST',headers:{origin,cookie:reviewerCookie,'content-type':['application','json'].join('/')},body:JSON.stringify({revision:approval.revision,summary_sha256:approval.summary_sha256})})
  assert.equal(bogus.status,401)
  assert.equal((await data('/agents/api/approvals/'+id)).approval.state,'pending')
  await policy('autonomous')
  console.log('PROBE SURFACE-004 restart and race: retained exact approval survives restart; changed selection after restart and suspended classified read refuse; revoked native reviewer session cannot execute')
}

/** Existing native private and custody doors retain human-only authority. */
export async function sensitiveNativeCustody(context) {
  const {origin,cookie,sql,settings,restart}=context
  const call=(path,body,who=cookie,method)=>context.request(origin+path,{method:method??(body===undefined?'GET':'POST'),redirect:'manual',headers:{origin,cookie:who,'content-type':['application','json'].join('/')},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data=async(path,body,status=200,who)=>{const response=await call(path,body,who);assert.equal(response.status,status,path+' '+await response.clone().text());return response.json()}
  const suspendedPrivate=async(path,change,who=cookie)=>{
    const pending=context.request(origin+path,{headers:{cookie:who,'x-synthetic-policy-batch':'private-read-hold'}})
    let waiting=false
    for(let attempt=0;attempt<200&&!waiting;attempt++) {
      const state=await context.request(origin+'/health',{headers:{'x-synthetic-policy-batch':'observe'}})
      waiting=state.headers.get('x-synthetic-policy-state')==='waiting'
      if(!waiting)await new Promise(resolve=>setTimeout(resolve,20))
    }
    try {assert.ok(waiting,'private selection reached its delivery boundary');await change()}
    finally {await context.request(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}})}
    const refused=await pending
    assert.equal(refused.status,409,'changed private selection must not deliver retained plaintext')
    assert.equal(refused.headers.get('x-envelope-classification'),null)
    assert.ok(!(await refused.text()).includes('synthetic-envelope-9751'))
  }
  const company=await data('/api/envelope/companies',{name:'Synthetic classified custody employer',ein:'00-0009750'},201)
  const base='/api/envelope/companies/'+company.id
  const location=await data(base+'/locations',{name:'Private workplace',state:'PA'},201)
  const other=await data(base+'/locations',{name:'Other private workplace',state:'PA'},201)
  const person=await data(base+'/people',{name:'Synthetic private worker',locationId:location.id},201)
  const outside=await data(base+'/people',{name:'Synthetic outside worker',locationId:other.id},201)
  const classification=(classes,measure,kind)=>classes.map(cls=>({class:cls,facts:{measure,kind}}))
  const audit=()=>data(base+'/audit')
  const classified=async action=>(await audit()).filter(row=>row.action===action)
  const snapshot=()=>sql(`SELECT audit_id,classification FROM env_native_action_facts ORDER BY audit_id`)
  const assertPrivate=async(kind,who=cookie)=>{
    const response=await call(base+'/people/'+person.id+'/private/'+kind,undefined,who)
    assert.equal(response.status,200)
    assert.equal(response.headers.get('cache-control'),'no-store')
    assert.match(response.headers.get('content-disposition'),/^attachment/)
    const expected=classification(['sensitive'],1,kind==='tax'?'tax-document':kind==='bank'?'bank-number':'ssn')
    assert.deepEqual(JSON.parse(response.headers.get('x-envelope-classification')),expected)
    assert.equal(await response.text(),'synthetic-envelope-9751-'+kind)
    assert.deepEqual((await classified('private.'+kind+'.read'))[0].classification,expected)
  }
  for(const kind of ['ssn','bank','tax']) {
    await data(base+'/people/'+person.id+'/private',{kind,version:0,value:'synthetic-envelope-9751-'+kind},201)
    await assertPrivate(kind)
  }
  // Human scopes stay separate from the current record-reading agent grants.
  const signIn=async id=>{
    const operator=(await sql(`SELECT version FROM oa_operators WHERE id='${id}'`))[0]
    const token=randomBytes(32).toString('base64url'),hash=await hashToken(settings.SESSION_SECRET,'link',token),now=Date.parse('2026-10-28T12:00:00Z')
    await sql(`INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES('${crypto.randomUUID()}','${hash}','magic','${id}',${operator.version},'/app',${now},${now+600000})`)
    const response=await call('/auth/confirm',{token},'')
    assert.equal(response.status,303)
    return response.headers.get('set-cookie').split(';')[0]
  }
  let staffId,staffCookie,grant
  for(const role of ['payroll-admin','preparer','accountant','viewer']) {
    const id='synthetic-envelope-9752-'+role
    await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${id}','${id}'||char(64)||'example.test','Synthetic private reader','member','active',1,1)`)
    await data(base+'/grants',{operatorId:id,version:0,role,locations:[location.id],fields:['ssn','bank','tax'],actions:['records:read','private:read']})
    const who=await signIn(id)
    for(const kind of ['ssn','bank','tax'])await assertPrivate(kind,who)
    for(const target of [outside.id,'synthetic-envelope-missing']) {
      const response=await call(base+'/people/'+target+'/private/ssn',undefined,who)
      assert.equal(response.status,404)
      assert.ok(!(await response.text()).includes('synthetic-envelope-9751'))
      assert.equal(response.headers.get('x-envelope-classification'),null)
    }
    if(role==='viewer') {staffId=id;staffCookie=who;grant=1}
  }
  // Revoking the native session after its encrypted selection cancels delivery,
  // even though the company grant and selected private record remain current.
  await suspendedPrivate(base+'/people/'+person.id+'/private/bank',async()=>{
    assert.equal((await call('/auth/signout',{},staffCookie)).status,204)
  },staffCookie)
  staffCookie=await signIn(staffId)
  const sessionHash=await hashToken(settings.SESSION_SECRET,'session',staffCookie.split('=')[1])
  const [{expires_at:expiresAt}]=await sql(`SELECT expires_at FROM oa_sessions WHERE token_hash='${sessionHash}'`)
  try {
    await suspendedPrivate(base+'/people/'+person.id+'/private/bank',()=>context.request(origin+'/health',{
      headers:{'x-synthetic-clock':new Date(expiresAt+1).toISOString()},
    }),staffCookie)
  } finally {
    await context.request(origin+'/health',{headers:{'x-synthetic-clock':'2026-10-28T12:00:00Z'}})
    assert.equal((await call('/auth/signout',{},staffCookie)).status,204)
  }
  staffCookie=await signIn(staffId)
  await suspendedPrivate(base+'/people/'+person.id+'/private/tax',()=>data(base+'/grants',{operatorId:staffId,version:grant,role:'viewer',locations:[location.id],fields:[],actions:['records:read']}),staffCookie);grant++
  const oldCookie=staffCookie;staffCookie=await signIn(staffId)
  const beforeRefusal=await snapshot()
  for(const who of [oldCookie,staffCookie,''])for(const kind of ['ssn','bank','tax']) {
    const response=await call(base+'/people/'+person.id+'/private/'+kind,undefined,who)
    assert.equal(response.status,who===staffCookie?403:401)
    assert.equal(response.headers.get('x-envelope-classification'),null)
    assert.ok(!(await response.text()).includes('synthetic-envelope-9751'))
  }
  assert.deepEqual(await snapshot(),beforeRefusal,'refused reads create no completed classification')
  for(const [who,classes,count,kind] of [[cookie,['sensitive'],0,'compensation'],[staffCookie,['standard'],1,'masked-worker']]) {
    const response=await call(base+'/people/'+person.id,undefined,who)
    assert.equal(response.status,200)
    assert.deepEqual(JSON.parse(response.headers.get('x-envelope-classification')),classification(classes,count,kind))
  }
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox']})
  const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(proof,{recursive:true})
  try {
    for(const [label,who,visible] of [['private-authorized',cookie,true],['private-identity',staffCookie,false]]) {
      const page=await browser.newPage({viewport:{width:1440,height:1000}})
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());assert.equal(url.origin,origin,'no outbound browser request')
        const response=await context.request(url.href,{headers:{cookie:who}})
        await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})
      })
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});await page.goto(origin+'/app/envelope/companies/'+company.id+'/people/'+person.id)
        if(width===1440)for(const kind of ['ssn','bank','tax'])assert.equal(await page.getByRole('link',{name:'Read '+kind+' record',exact:true}).count()>0,visible)
        assert.ok(!(await page.locator('main').innerText()).includes('synthetic-envelope-9751'),'values stay masked on screen')
        await page.screenshot({path:join(proof,label+'-'+width+'.png'),fullPage:true})
      }
      await page.close()
    }
  } finally {await browser.close()}

  const foreign=await data('/api/envelope/companies',{name:'Synthetic foreign private employer',ein:'00-0009753'},201)
  await data('/api/envelope/companies/'+foreign.id+'/people/'+person.id+'/private/ssn',undefined,404)
  const exported=await call(base+'/export')
  assert.equal(exported.status,200)
  assert.deepEqual(JSON.parse(exported.headers.get('x-envelope-classification')),classification(['standard'],2,'masked-worker'))
  assert.deepEqual((await classified('records.exported'))[0].classification,classification(['standard'],2,'masked-worker'))
  const csv=await exported.text();assert.equal(csv.split('\r\n').filter(Boolean).length,3);assert.ok(csv.includes(person.id)&&csv.includes(outside.id));assert.ok(!csv.includes('synthetic-envelope-9751'))
  const empty=await call('/api/envelope/companies/'+foreign.id+'/export')
  assert.deepEqual(JSON.parse(empty.headers.get('x-envelope-classification')),classification(['standard'],0,'masked-worker'));assert.equal((await empty.text()).split('\r\n').filter(Boolean).length,1)

  const privacy=base+'/people/'+person.id+'/privacy'
  let inventory=await data(privacy)
  assert.deepEqual(inventory.retained.map(row=>row.table),Array(3).fill('env_private_records'))
  assert.deepEqual(inventory.retained.map(row=>row.key.kind).sort(),['bank','ssn','tax'])
  const nativeInput={consent:true,fingerprint:inventory.fingerprint}
  // The existing agent cannot acquire a human's custody or private powers from
  // autonomous policy, a supplied approval claim or possession of a person ID.
  const policy=await data(base+'/agents/class-policy',{version:0,...(await import('./native.mjs')).answers})
  const credential=await data(base+'/agents',{name:'Synthetic identity custodian',hours:1,actions:['records:read'],fields:[],locations:['*']},201)
  for(const path of ['/mcp','/api/envelope/mcp'])for(const name of ['records.private','records.export','privacy.request','privacy.release','privacy.erase']) {
    const refused=await readClient(context,credential,path)(name,{companyId:company.id,personId:person.id,kind:'ssn',approved:true})
    assert.ok(error(refused));assert.equal(value(refused),undefined)
  }
  for(const path of ['/people/'+person.id+'/private/ssn','/people/'+person.id+'/privacy/request','/people/'+person.id+'/erase','/export']) {
    const response=await context.request(origin+'/api/envelope/v1/companies/'+company.id+path,{headers:{authorization:'Bearer '+credential.token}})
    assert.equal(response.status,403);assert.ok(!(await response.text()).includes('synthetic-envelope-9751'))
  }
  await data(base+'/agents/class-policy',{version:policy.version,...(await import('./native.mjs')).answers,sensitive:'blocked',destructive:'blocked'})
  // Native owner intent still needs the exact inventory and fresh step-up;
  // agent class answers supply neither of these native human permissions.
  await data(privacy+'/request',nativeInput,403,staffCookie)
  const requested=await data(privacy+'/request',nativeInput)
  assert.equal(requested.status,'held')
  assert.deepEqual(requested.classification,classification(['destructive','sensitive'],4,'worker-records'))
  assert.deepEqual((await classified('privacy.erasure.requested'))[0].classification,classification(['destructive','sensitive'],4,'worker-records'))
  const requestFacts=await classified('privacy.erasure.requested')
  await data(privacy+'/request',nativeInput)
  assert.deepEqual(await classified('privacy.erasure.requested'),requestFacts,'replayed request creates no new classification')
  await data(base+'/people/'+person.id+'/erase',{consent:true,version:requested.version,fingerprint:requested.fingerprint,records:requested.retained.map(row=>row.id)},409)
  const selected={...nativeInput,records:inventory.retained.map(row=>row.id),legalBasis:'Synthetic reviewed retention release',custodian:'Synthetic native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
  // Invalid source selections and ineligible holds fail before a completed event.
  await data(privacy+'/release',selected,409)
  assert.deepEqual(await classified('privacy.holds.released'),[])
  await data(privacy+'/retain',selected)
  await suspendedPrivate(base+'/people/'+person.id+'/private/ssn',()=>data(base+'/people/'+person.id+'/private',{kind:'ssn',version:1,value:'synthetic-envelope-9751-corrected'},201))
  const beforeStale=await snapshot()
  await data(privacy+'/release',selected,409)
  assert.deepEqual(await snapshot(),beforeStale)
  inventory=await data(privacy)
  const current={...selected,fingerprint:inventory.fingerprint,records:inventory.retained.map(row=>row.id)}
  await data(privacy+'/retain',current)
  const released=await data(privacy+'/release',{...current,records:current.records.slice(0,2)})
  assert.deepEqual(released.classification,classification(['destructive','sensitive'],2,'retention-holds'))
  assert.deepEqual((await classified('privacy.holds.released'))[0].classification,classification(['destructive','sensitive'],2,'retention-holds'))
  const final=await data(privacy)
  const last=final.retained.filter(row=>!row.released)
  assert.equal(last.length,1)
  await data(privacy+'/release',{...current,records:last.map(row=>row.id)})
  assert.deepEqual((await classified('privacy.holds.released'))[0].classification,classification(['destructive','sensitive'],1,'retention-holds'))
  const releasedFacts=await classified('privacy.holds.released')
  await data(privacy+'/release',{...current,records:last.map(row=>row.id)},409)
  assert.deepEqual(await classified('privacy.holds.released'),releasedFacts)
  await restart()
  assert.deepEqual(await classified('privacy.holds.released'),releasedFacts,'restart retains exact selected counts')
  const ready=await data(privacy)
  let erased
  await suspendedPrivate(base+'/people/'+person.id+'/private/ssn',async()=>{
    erased=await data(base+'/people/'+person.id+'/erase',{consent:true,version:ready.version,fingerprint:ready.fingerprint,records:ready.retained.map(row=>row.id)})
  })
  assert.equal(erased.recordsDeleted,4)
  assert.deepEqual(erased.classification,classification(['destructive','sensitive'],4,'worker-records'))
  const erasedAudit=(await classified('privacy.worker.erased'))[0]
  assert.equal(erasedAudit.targetId,erased.id)
  assert.deepEqual(erasedAudit.classification,classification(['destructive','sensitive'],4,'worker-records'))
  assert.ok(!JSON.stringify(await audit()).includes(person.id),'classification retains no erased subject identifier')
  await data(base+'/people/'+person.id,undefined,404)
  await data(base+'/people/'+person.id+'/private/ssn',undefined,404)
  assert.deepEqual((await sql(`SELECT count(*) AS n FROM env_private_records WHERE company_id='${company.id}'`))[0],{n:0})
  assert.equal((await sql(`SELECT count(*) AS n FROM env_notice_dispatches WHERE company_id='${company.id}'`))[0].n,0)
  console.log('PROBE SURFACE-004 native-private: SSN, bank and tax native downloads -> sensitive, count 1 and exact kind; scoped human roles allowed, identity-only, signed-out, old-session and foreign-worker reads refused; masked exports count 2 and 0')
  console.log('PROBE SURFACE-004 native-custody: exact owner request -> destructive and sensitive count 4; invalid and stale hold release -> refused; eligible selected releases -> counts 2 and 1; restart and exact erasure -> count 4, anonymous audit, no retained values; agent custody doors remain unavailable')
  console.log('PROBE SURFACE-004 private-delivery: correction, erasure, session revocation, session expiry and grant revocation after ciphertext selection -> refused before plaintext delivery, no successful response classification')
}
