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
  assert.deepEqual(read.result.structuredContent.records.map(row=>row.id),[saved.person.id])
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
  const ownerId=(await data('/auth/session')).operator.id
  const shared=async held=>{
    const document={schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'authority-autonomous',class:'*',do:'autonomous'},...(held==='blocked-access'?[{id:'authority-blocked',class:'access',do:'blocked'}]:held?[{id:'authority-held',class:'standard',do:'approval',approver:['person:'+ownerId],wait:'PT1H'}]:[])],spend:{none:true}}
    const r=await fetch(origin+'/agents/api/policy',{method:'PUT',headers:{cookie,origin,'content-type':contentType},body:JSON.stringify({document})})
    assert.equal(r.status,200)
  }
  const mcp=async(token,name,args)=>{
    const r=await fetch(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+token,origin,'MCP-Protocol-Version':'2025-11-25','content-type':contentType},body:JSON.stringify(agentMessage(callMethod,{name,arguments:args}))})
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
      const refused=await mcp(issued.token,name,args)
      assert.equal(refused.status,transition==='credential-restrict'?403:401,'the next call uses current native authority after '+transition)
      if(transition==='credential-restrict')assert.equal(refused.body.error.data.code,'insufficient_scope')
      assert.equal(refused.body.result,undefined,'neither cached outcomes nor current private records are disclosed')
      assert.ok(!JSON.stringify(refused.body).includes(savedId))
    }
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
    console.log('PROBE BASE-AGENT-005 3 '+transition+': admitted read and preparation -> approved suspended execution refused, current calls fenced, saved result withheld, business state unchanged and both audits attributed')
  }
  await shared(false)
}
