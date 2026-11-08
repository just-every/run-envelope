import assert from 'node:assert/strict'
import {client,state} from './native.mjs'

const contentType=['application','json'].join('/'),callMethod=['tools','call'].join('/')
const error=answer=>answer.result?._meta?.['com.runeditrun/error']?.code??answer.body?.error?.data?.code
const preparation=saved=>({companyId:saved.company.id,personId:saved.person.id,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',minutes:480,sourceRef:'synthetic-envelope-authority',requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()})

/** Exercise real credential reduction alongside each shared-policy journey. */
export async function beforeRestriction(context) {
  if(context.step.id!=='credentials-restrict')return
  const saved=state.get(context.origin),data=client(context)
  const grant=(await data(saved.base+'/agents')).grants.find(row=>row.id===saved.restriction.id)
  assert.equal(grant.version,1)
  assert.ok(JSON.parse(grant.actions).includes('drafts:prepare'),'the disposable credential really starts with preparation power')
  const read=await context.tool('envelope.records.list',{companyId:saved.company.id},{client:'restriction'})
  assert.equal(error(read),undefined)
  assert.ok(read.result.structuredContent.records.some(row=>row.id===saved.person.id),'read scope reaches populated native records')
  const prepared=await context.tool('envelope.draft.prepare',preparation(saved),{client:'restriction'})
  assert.equal(error(prepared),undefined,'preparation succeeds before its scope is removed')
  const db=await context.database('DB')
  assert.equal((await db.prepare('SELECT minutes FROM env_run_drafts WHERE id=? AND credential_id=?').bind(prepared.result.structuredContent.id,saved.restriction.id).first()).minutes,480,'the admitted preparation actually persisted its requested hours')
}
export async function afterRestriction(context) {
  if(context.step.id!=='credentials-restrict')return
  const saved=state.get(context.origin),data=client(context),db=await context.database('DB')
  const reduced=context.result
  assert.equal(reduced.id,saved.restriction.id)
  assert.equal(reduced.version,2)
  assert.equal(reduced.direction,'narrow')
  assert.deepEqual(reduced.actions,['records:read'])
  assert.deepEqual(reduced.fields,[])
  assert.deepEqual(reduced.locations,[saved.location.id])
  const retained=(await data(saved.base+'/agents')).grants.find(row=>row.id===reduced.id)
  for(const key of ['actions','fields','locations'])assert.deepEqual(JSON.parse(retained[key]),reduced[key],'native owner sees the exact reduced '+key)
  assert.equal(retained.version,reduced.version)
  const before=await db.prepare('SELECT COUNT(*) AS n FROM env_run_drafts').first()
  const read=await context.tool('envelope.records.list',{companyId:saved.company.id},{client:'restriction'})
  assert.equal(error(read),undefined)
  const permitted=(await db.prepare('SELECT id FROM env_people WHERE company_id=? AND location_id=? ORDER BY id').bind(saved.company.id,saved.location.id).all()).results.map(row=>row.id)
  assert.ok(permitted.includes(saved.person.id),'the retained location still contains the original worker')
  assert.ok(!permitted.includes(saved.outside.id),'the outside worker remains outside the retained location')
  assert.deepEqual(read.result.structuredContent.records.map(row=>row.id).sort(),permitted,'the reduced credential returns exactly the native workers in its retained location')
  const refused=await context.tool('envelope.draft.prepare',preparation(saved),{client:'restriction'})
  assert.equal(error(refused),'insufficient_scope','approval policy cannot restore the removed native preparation scope')
  assert.equal(refused.result?.structuredContent,undefined)
  assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM env_run_drafts').first(),before)
  for(const args of [
    {actions:['records:read','drafts:prepare']},
    {fields:['compensation']},
    {locations:['*']},
  ]) {
    const denied=await context.tool('envelope.credentials.restrict',{...args,idempotency_key:crypto.randomUUID()},{client:'restriction'})
    assert.equal(error(denied),'self_escalation','a policy decision supplies no widening authority')
    assert.equal(denied.result?.structuredContent,undefined)
  }
  assert.deepEqual((await data(saved.base+'/agents')).grants.find(row=>row.id===reduced.id),retained,'widening attempts retain every native grant field and its revision')
  console.log('PROBE BASE-AGENT-005 2/4 '+context.phase+': native scope removal retained populated reads; removed preparation and widening refused; owner grant revision 2 unchanged')
}

/** Current native authority must fence approval execution and saved outcomes. */
export async function authorityRevocationJourney({origin,cookie,settings,sql,data,base,company,location,person,now,agentMessage}) {
  const {randomBytes}=await import('node:crypto')
  const {hashToken}=await import('../../src/modules/operator-auth/crypto.mjs')
  await authorityAdministrationJourney({origin,cookie,settings,sql,data,base,company,location,person,now,agentMessage})
  const ownerId=(await data('/auth/session')).operator.id
  const shared=async held=>{
    const document={schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'authority-autonomous',class:'*',do:'autonomous'},...(held==='blocked-access'?[{id:'authority-blocked',class:'access',do:'blocked'}]:held?[{id:'authority-held',class:'standard',do:'approval',approver:['person:'+ownerId],wait:'PT1H'}]:[])],spend:{none:true}}
    const r=await fetch(origin+'/agents/api/policy',{method:'PUT',headers:{cookie,origin,'content-type':contentType},body:JSON.stringify({document})})
    assert.equal(r.status,200)
  }
  const mcp=async(token,name,args,path='/mcp')=>{
    const r=await fetch(origin+path,{method:'POST',headers:{authorization:'Bearer '+token,origin,'MCP-Protocol-Version':'2025-11-25','content-type':contentType},body:JSON.stringify(agentMessage(callMethod,{name,arguments:args}))})
    return {status:r.status,body:await r.json()}
  }
  const business=()=>sql(`SELECT id,company_id,credential_id,person_id,person_version,minutes,fingerprint FROM env_run_drafts ORDER BY id`)
  for(const transition of ['company-downgrade','company-revoke','sponsor-downgrade','sponsor-suspend','credential-revoke','credential-restrict']) {
    await shared(false)
    const staffId='synthetic-envelope-'+crypto.randomUUID(),sessionToken=randomBytes(32).toString('base64url')
    const tokenHash=await hashToken(settings.SESSION_SECRET,'link',sessionToken)
    await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${staffId}','${staffId}'||char(64)||'example.test','Synthetic authority sponsor','admin','active',1,${now});
      INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES('${crypto.randomUUID()}','${tokenHash}','magic','${staffId}',1,'/app',${now},${now+600000})`)
    const confirmation=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{origin,'content-type':contentType},body:JSON.stringify({token:sessionToken})})
    assert.equal(confirmation.status,303)
    const staffCookie=confirmation.headers.get('set-cookie').split(';')[0]
    const grant={operatorId:staffId,role:'payroll-admin',actions:['records:read','rates:propose'],fields:['compensation'],locations:[location.id]}
    await data(base+'/grants',{...grant,version:0})
    const issued=await data(base+'/agents',{name:'Synthetic authority assistant',hours:1,actions:['records:read','drafts:prepare','drafts:read'],fields:['compensation'],locations:[location.id]},201,staffCookie)
    const read=await mcp(issued.token,'records.list',{companyId:company.id})
    assert.equal(read.status,200)
    assert.deepEqual(read.body.result.structuredContent.records.map(row=>row.id),[person.id])
    const savedArgs={companyId:company.id,personId:person.id,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-authority',minutes:480,requestKey:crypto.randomUUID()}
    const completed=await mcp(issued.token,'draft.prepare',savedArgs)
    assert.equal(completed.body.result?.isError,false)
    const savedId=completed.body.result.structuredContent.id
    assert.ok(savedId)
    assert.equal((await mcp(issued.token,'draft.prepare',savedArgs)).body.result.structuredContent.id,savedId,'the result exists and is replayable before authority changes')
    if(transition==='credential-restrict') {
      await shared('blocked-access')
      const beforeWiden=(await data(base+'/agents')).grants.find(row=>row.id===issued.id)
      const widening=await mcp(issued.token,'credentials.restrict',{actions:['pay:release']})
      assert.equal(widening.body.result?._meta?.['com.runeditrun/error']?.code,'self_escalation','blocked shared access policy supplies no self-escalation authority')
      assert.deepEqual((await data(base+'/agents')).grants.find(row=>row.id===issued.id),beforeWiden)
    }
    await shared(true)
    const heldArgs={...savedArgs,requestKey:crypto.randomUUID()}
    const pending=await mcp(issued.token,'draft.prepare',heldArgs)
    const handle=pending.body.result?._meta?.['com.runeditrun/approval']??pending.body.result?._meta?.['com.runeditrun/error']?.approval
    assert.ok(handle?.id,'a genuine native preparation is waiting for shared policy approval')
    const approvalPath='/agents/api/approvals/'+handle.id
    const {approval}=await data(approvalPath)
    assert.equal(approval.state,'pending')
    const before=await business()
    const approving=fetch(origin+approvalPath+'/approve',{method:'POST',headers:{cookie,origin,'content-type':contentType,'x-synthetic-policy-batch':'hold'},body:JSON.stringify({revision:approval.revision,summary_sha256:approval.summary_sha256})})
    let execution
    try {
      let waiting=false
      for(let attempt=0;attempt<100;attempt++) {
        const observed=await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'observe'}})
        if(observed.headers.get('x-synthetic-policy-state')==='waiting'){waiting=true;break}
        await new Promise(resolve=>setTimeout(resolve,25))
      }
      assert.ok(waiting,'the human-approved execution is admitted and suspended before its native write')
      assert.ok((await data(base+'/agents')).activity.calls.some(row=>row.credentialId===issued.id&&row.decision==='pending'))
      if(transition==='company-downgrade')await data(base+'/grants',{...grant,version:1,role:'viewer',actions:['records:read'],fields:[]})
      if(transition==='company-revoke')await data(base+'/grants',{...grant,version:1,revoke:true})
      if(transition==='sponsor-downgrade')await data('/auth/operator/role',{operatorId:staffId,role:'member'})
      if(transition==='sponsor-suspend')await data('/auth/operator/status',{operatorId:staffId,status:'inactive'})
      if(transition==='credential-revoke')await data(base+'/agents/'+issued.id+'/revoke',{version:1})
      if(transition==='credential-restrict') {
        const narrowed=await mcp(issued.token,'credentials.restrict',{actions:['records:read'],fields:[],locations:[location.id]})
        assert.deepEqual(narrowed.body.result.structuredContent.actions,['records:read'])
        assert.equal(narrowed.body.result.structuredContent.version,2)
      }
      await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}})
      const response=await approving;assert.equal(response.status,200)
      execution=await response.json()
      assert.equal(execution.approval.state,'refused','human policy approval supplies no missing native authority: '+transition)
      assert.equal(execution.approval.code,'draft_input_or_authority_changed')
    } finally {
      await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}})
      await approving.catch(()=>{})
    }
    assert.deepEqual(await business(),before,'revocation during approved execution cannot prepare another run')
    if(transition==='credential-restrict') {
      await shared(false)
      const retainedRead=await mcp(issued.token,'records.list',{companyId:company.id})
      assert.deepEqual(retainedRead.body.result.structuredContent.records.map(row=>row.id),[person.id])
    }
    const calls=[...(transition==='credential-restrict'?[]:[['records.list',{companyId:company.id}]]),['draft.prepare',savedArgs],['draft.read',{companyId:company.id,draftId:savedId}]]
    for(const [name,args] of calls) {
      for(const path of ['/mcp','/api/envelope/mcp']) {
      const refused=await mcp(issued.token,name,args,path)
      assert.equal(refused.status,transition==='credential-restrict'?403:401,'the next call uses current native authority after '+transition)
      if(transition==='credential-restrict')assert.equal(refused.body.error.data.code,'insufficient_scope')
      assert.equal(refused.body.result,undefined,'neither cached outcomes nor current private records are disclosed')
      assert.ok(!JSON.stringify(refused.body).includes(savedId))
      }
      const route='/api/envelope/v1/companies/'+company.id+(name==='records.list'?'/records':name==='draft.read'?'/drafts/'+savedId:'/drafts')
      const {companyId,...body}=args
      const response=await fetch(origin+route,{method:name==='draft.prepare'?'POST':'GET',headers:{authorization:'Bearer '+issued.token,origin,'content-type':contentType},...(name==='draft.prepare'?{body:JSON.stringify(body)}:{})})
      assert.equal(response.status,403,'the existing REST door also uses current authority after '+transition)
      const denied=await response.json()
      assert.equal(denied.id,undefined)
      assert.ok(!JSON.stringify(denied).includes(savedId))
    }
    const {spawn}=await import('node:child_process')
    const cli=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['scripts/envelope-cli.mjs','status',company.id,savedId],{env:{...process.env,ENVELOPE_ORIGIN:origin,ENVELOPE_TOKEN:issued.token},stdio:['ignore','pipe','pipe']})
      let stdout='',stderr='';child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}))
    })
    assert.notEqual(cli.code,0,'the CLI cannot return a saved outcome after '+transition)
    assert.ok(!cli.stdout.includes(savedId)&&!cli.stdout.includes('hourlyCents'))
    assert.ok(!cli.stderr.includes(issued.token))
    assert.deepEqual(await business(),before)
    const activity=(await data(base+'/agents')).activity
    const native=activity.calls.filter(row=>row.credentialId===issued.id)
    assert.ok(native.some(row=>row.decision==='executed'&&row.sponsorId===staffId))
    assert.ok(native.some(row=>row.decision==='authority_revoked'&&row.sponsorId===staffId&&row.operationId),'the suspended execution retains current-authority refusal attribution')
    const audited=await data('/agents/api/audit?agent='+issued.id)
    assert.ok(audited.rows.some(row=>row.outcome==='refused'&&row.code===execution.approval.code&&row.sponsor.id===staffId&&row.approval?.id===handle.id),'shared audit retains the refused exact approval and sponsor')
    const retained=(await data(base+'/agents')).grants.find(row=>row.id===issued.id)
    if(transition==='credential-revoke'){assert.equal(retained.version,2);assert.ok(retained.revokedAt)}
    else if(transition==='credential-restrict'){assert.equal(retained.version,2);assert.deepEqual(JSON.parse(retained.actions),['records:read']);assert.deepEqual(JSON.parse(retained.fields),[])}
    else assert.equal(retained.version,1,'changing the sponsor never rewrites the retained agent grant')
    console.log('PROBE BASE-AGENT-005 3 '+transition+': admitted read and preparation -> approved suspended execution refused, both MCP routes, REST and CLI fenced, saved result withheld, business state unchanged and both audits attributed')
  }
  await shared(false)
}

/** Actual human administration routes refuse an agent's self-promotion. */
async function authorityAdministrationJourney({origin,cookie,settings,sql,data,base,company,location,person,now,agentMessage}) {
  const {randomBytes}=await import('node:crypto')
  const {hashToken}=await import('../../src/modules/operator-auth/crypto.mjs')
  const staffId='synthetic-envelope-'+crypto.randomUUID(),login=randomBytes(32).toString('base64url')
  const hash=await hashToken(settings.SESSION_SECRET,'link',login)
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${staffId}','${staffId}'||char(64)||'example.test','Synthetic administration sponsor','admin','active',1,${now});
    INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES('${crypto.randomUUID()}','${hash}','magic','${staffId}',1,'/app',${now},${now+600000})`)
  const confirmed=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{origin,'content-type':contentType},body:JSON.stringify({token:login})})
  assert.equal(confirmed.status,303)
  const staffCookie=confirmed.headers.get('set-cookie').split(';')[0]
  const grant={operatorId:staffId,role:'payroll-admin',actions:['records:read','rates:propose'],fields:['compensation'],locations:[location.id]}
  await data(base+'/grants',{...grant,version:0})
  const issued=await data(base+'/agents',{name:'Synthetic administration agent',hours:1,actions:['records:read','drafts:prepare'],fields:['compensation'],locations:[location.id]},201,staffCookie)
  const ownerId=(await data('/auth/session')).operator.id
  const shared=async disposition=>{
    const document={schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'authority-baseline',class:'*',do:'autonomous'},{id:'authority-access',class:'access',do:disposition,...(disposition==='approval'?{approver:['person:'+ownerId],wait:'PT1H'}:{})}],spend:{none:true}}
    const response=await fetch(origin+'/agents/api/policy',{method:'PUT',headers:{cookie,origin,'content-type':contentType},body:JSON.stringify({document})})
    assert.equal(response.status,200)
  }
  const nativeAnswers={standard:'autonomous',money:'autonomous',commitment:'autonomous',external:'autonomous',sensitive:'autonomous',destructive:'autonomous',accounts:'autonomous',access:'autonomous',security:'autonomous',gated:'autonomous'}
  const retained=async()=>({
    sponsor:await sql(`SELECT id,role,status,version FROM oa_operators WHERE id='${staffId}'`),
    grants:await sql(`SELECT * FROM env_grants WHERE company_id='${company.id}' ORDER BY operator_id`),
    credentials:await sql(`SELECT * FROM env_agent_grants WHERE company_id='${company.id}' ORDER BY id`),
    native:await sql(`SELECT * FROM env_agent_class_policy WHERE company_id='${company.id}'`),
    sponsorship:await sql(`SELECT * FROM env_agent_policy WHERE company_id='${company.id}'`),
    shared:await data('/agents/api/state'),
    drafts:await sql('SELECT * FROM env_run_drafts ORDER BY id'),
  })
  for(const disposition of ['autonomous','approval','blocked']) {
    await shared(disposition)
    const version=(await data(base+'/agents')).classPolicy.version
    await data(base+'/agents/class-policy',{version,...nativeAnswers,access:disposition})
    const before=await retained()
    const attempts=[
      ['/auth/operator/role',{operatorId:staffId,role:'owner'},'sponsor.role'],
      [base+'/grants',{...grant,version:1,role:'owner'},'sponsor.grant'],
      [base+'/grants',{...grant,version:1,actions:[...grant.actions,'pay:release']},'sponsor.grant'],
      [base+'/agents/class-policy',{version:version+1,...nativeAnswers},'company.policy'],
      [base+'/agents/policy',{version:0,ownerOnly:false},'company.policy'],
      [base+'/agents/pause',{version:version+1,paused:true},'agents.pause'],
      [base.replace('/api/','/app/')+'/agents/pause',{version:version+1,paused:false},'agents.pause'],
      ['/agents/api/policy',{document:{rules:[]}},'company.policy','PUT'],
      ['/agents/api/pause',{paused:true},'agents.pause'],
    ]
    for(const [path,input,tool,method='POST'] of attempts) {
      const response=await fetch(origin+path,{method,redirect:'manual',headers:{authorization:'Bearer '+issued.token,origin,'content-type':contentType},body:JSON.stringify(input)})
      assert.equal(response.status,403,path)
      assert.deepEqual(await response.json(),{error:'self_escalation'},path+' is refused before '+disposition+' policy')
      assert.equal(response.headers.get('cache-control'),'no-store')
      assert.deepEqual(await retained(),before,'self-administration changes no business, authority or policy state')
      const activity=(await data(base+'/agents')).activity.calls.filter(row=>row.credentialId===issued.id&&row.tool===tool)
      assert.ok(activity.some(row=>row.sponsorId===staffId&&row.decision==='self_escalation'&&row.facts.direction==='widen'&&row.facts.peopleCount===1),'the refused administration attempt retains computed authority facts')
    }
    // Even an attached owner cookie cannot authorize a bearer to change Pause.
    const mixed=await fetch(origin+base+'/agents/pause',{method:'POST',headers:{cookie,authorization:'Bearer '+issued.token,origin,'content-type':contentType},body:JSON.stringify({version:version+1,paused:true})})
    assert.equal((await mixed.json()).error,'self_escalation')
    assert.deepEqual(await retained(),before)
    const read=await fetch(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+issued.token,origin,'MCP-Protocol-Version':'2025-11-25','content-type':contentType},body:JSON.stringify(agentMessage(callMethod,{name:'records.list',arguments:{companyId:company.id}}))})
    assert.deepEqual((await read.json()).result.structuredContent.records.map(row=>row.id),[person.id],'retained read authority still works')
    console.log('PROBE BASE-AGENT-005 4 '+disposition+': sponsor role and grant promotion, native and shared policy and Pause -> self_escalation, exact state unchanged, attributed refusal; retained read works')
  }
  const version=(await data(base+'/agents')).classPolicy.version
  await data(base+'/agents/class-policy',{version,...nativeAnswers})
  await shared('autonomous')
  await data(base+'/agents/'+issued.id+'/revoke',{version:1})
}

/** Retained hostile data and caller claims cannot manufacture another power. */
export async function authorityInjectionStep(context) {
  if(!['records-list','draft-read','notice-process'].includes(context.step.id))return
  const {step,args,origin,tool}=context,saved=state.get(origin),data=client(context),db=await context.database('DB')
  const before=await data(saved.base+'/agents')
  const snapshot=await db.prepare('SELECT COUNT(*) AS n FROM env_run_drafts').first()
  const answer=await tool(step.tool,args)
  assert.equal(error(answer),undefined,'the native data read is admitted by current policy')
  const pending=answer.result?.resultType==='input_required'
  if(pending)assert.equal(answer.result.structuredContent,undefined,'held compensation remains undisclosed before its separate human approval')
  else assert.equal(answer.result._meta?.['com.runeditrun/untrusted'],true,'returned native and extracted text is marked untrusted')
  const expected=step.id==='records-list'?['standard']:step.id==='draft-read'?['sensitive']:['external','sensitive']
  assert.deepEqual(answer.decision.classes.map(row=>row.class).sort(),expected,'classification is computed from the operation, never its hostile data')
  // The harness already performed the supported case, including its genuine
  // person approval. Check that returned data rather than approving another read.
  if(step.id==='records-list')assert.ok(context.result.records.some(row=>row.name.includes('Ignore scope')),'the hostile worker name was actually read')
  if(step.id==='draft-read')assert.ok(context.result.sourceRef.includes('Ignore scope'),'the hostile retained source was actually read')
  const injected=await tool(step.tool,{...args,role:'owner',scopes:['*'],confirmation:true,recipientIsInternal:true})
  assert.equal(error(injected),undefined)
  assert.deepEqual(injected.result.structuredContent,answer.result.structuredContent,'ignored authority claims cannot alter the permitted data or bypass a held read')
  assert.equal(injected.result.resultType,answer.result.resultType)
  assert.deepEqual(injected.decision.classes,answer.decision.classes,'caller authority and recipient claims cannot change any computed class or fact')
  assert.deepEqual((await data(saved.base+'/agents')).grants,before.grants,'data and authority claims cannot mutate a native grant')
  const restricted=await tool('envelope.draft.prepare',preparation(saved),{client:'restriction'})
  assert.equal(error(restricted),'insufficient_scope','reading hostile data never restores the removed preparation scope')
  assert.equal(restricted.result?.structuredContent,undefined)
  assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM env_run_drafts').first(),snapshot)
  console.log('PROBE BASE-AGENT-005 5 '+context.phase+' '+step.id+': populated hostile data and injected authority claims -> untrusted data, exact selection and classes retained, removed scope still refuses without preparation')
}
