import assert from 'node:assert/strict'
import {state} from './native.mjs'

export const replayError = answer => answer.result?._meta?.['com.runeditrun/error'] ?? answer.error?.data?._meta?.['com.runeditrun/error'] ?? answer.error?.data ?? {}
export function prepared(answer) {
  assert.equal(answer.result?.isError,false,JSON.stringify(replayError(answer)))
  assert.ok(answer.result?.structuredContent?.id,'the call returns a retained preparation')
  assert.equal(answer.result.structuredContent.status,'uncalculated-proposal')
  assert.equal(answer.result.structuredContent.approval,'not-approved')
  assert.equal(answer.result.structuredContent.dispatch,'unavailable')
  return answer.result.structuredContent
}
export function refused(answer,code) {
  assert.equal(replayError(answer).code,code,JSON.stringify(answer))
  assert.equal(answer.result?.structuredContent,undefined,'a refusal cannot disclose the saved outcome')
}

const changes={
  'envelope.credentials.restrict':args=>({...args,actions:args.actions.slice(1)}),
  'envelope.credentials.rotate':args=>({...args,publicKey:{...args.publicKey,n:(args.publicKey.n[0]==='A'?'B':'A')+args.publicKey.n.slice(1)}}),
  'envelope.bonus.prepare':args=>({...args,amountCents:args.amountCents+1}),
  'envelope.notices.process':args=>({...args,noticeId:crypto.randomUUID()}),
  'envelope.notices.reply':args=>({...args,digest:'synthetic-envelope-changed'}),
  'envelope.runs.review_link':args=>({...args,runId:crypto.randomUUID()}),
}

/** Reuse the same conformance journey for every other installed mutating family. */
export async function replayMutation({phase,step,args,result,tool,database,origin}) {
  if(!changes[step.tool]||!['autonomous','held'].includes(phase))return
  const saved=state.get(origin),db=await database('DB'),grant=step.client==='restriction'?saved.restriction.id:saved.grantId
  const writes=async()=>(await db.prepare("SELECT action,target_id,door_agent_id,sponsor_id FROM env_agent_access WHERE credential_id=? AND action NOT IN ('records:read','drafts:read','bonus:read','reports:read') ORDER BY id").bind(grant).all()).results
  const witness=async()=>(await tool('envelope.workspace.snapshot',{})).result.structuredContent
  const before=await witness(),audit=await writes(),options=step.client?{client:step.client}:{}
  assert.deepEqual((await tool(step.tool,args,options)).result?.structuredContent,result,step.tool+' returns its first outcome under '+phase)
  assert.deepEqual(await witness(),before,step.tool+' replay cannot repeat its native effect')
  assert.deepEqual(await writes(),audit,step.tool+' replay cannot repeat native write attribution')
  refused(await tool(step.tool,changes[step.tool](args),options),'idempotency_conflict')
  assert.deepEqual(await witness(),before,step.tool+' changed arguments cannot cause an effect')
  assert.deepEqual(await writes(),audit)
  const row=await db.prepare('SELECT g.version,p.version AS policyVersion FROM env_agent_grants g JOIN env_agent_class_policy p ON p.company_id=g.company_id WHERE g.id=?').bind(grant).first()
  let targetRevision
  if(step.tool.startsWith('envelope.credentials.'))targetRevision=row.version
  else if(step.tool==='envelope.bonus.prepare')targetRevision=(await db.prepare('SELECT version FROM env_people WHERE company_id=? AND id=?').bind(args.companyId,args.personId).first()).version
  else if(step.tool==='envelope.notices.process')targetRevision=(await db.prepare('SELECT digest FROM env_notices WHERE company_id=? AND id=?').bind(args.companyId,args.noticeId).first()).digest
  else if(step.tool==='envelope.notices.reply')targetRevision=(await db.prepare('SELECT MAX(version) AS version FROM env_notice_replies WHERE company_id=? AND id=?').bind(args.companyId,args.replyId).first()).version
  else targetRevision=(await db.prepare("SELECT MAX(version) AS version FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=?").bind(args.companyId,args.runId).first()).version
  const conflict=await tool(step.tool,{...args,idempotency_key:crypto.randomUUID(),expected_revision:'[-1,-1,-1]'},options)
  refused(conflict,'revision_conflict')
  assert.equal(replayError(conflict).current_revision,JSON.stringify([targetRevision,row.version,row.policyVersion]),step.tool+' names its independently retained current revision')
  assert.deepEqual(await witness(),before,step.tool+' stale revision cannot cause a native effect')
  assert.deepEqual(await writes(),audit)
}

/** The native leg of both conformance policies witnesses a real hourly write. */
export async function replayStep({phase,step,args,result,tool,database}) {
  if(step.id!=='draft'||!['autonomous','held'].includes(phase))return
  const db=await database('DB')
  const native=await db.prepare('SELECT * FROM env_run_drafts WHERE id=? AND company_id=?').bind(result.id,args.companyId).first()
  assert.ok(native,'the journey completed an actual persisted preparation')
  assert.equal(native.minutes,480)
  const effects=async()=>({
    drafts:(await db.prepare('SELECT id,person_id,person_version,rate_id,minutes,fingerprint FROM env_run_drafts WHERE company_id=? AND credential_id=? ORDER BY id').bind(args.companyId,native.credential_id).all()).results,
    writes:(await db.prepare("SELECT target_id,door_agent_id,sponsor_id FROM env_agent_access WHERE company_id=? AND credential_id=? AND action='drafts:prepare' ORDER BY id").bind(args.companyId,native.credential_id).all()).results,
  })
  const before=await effects(),invoke=input=>tool(step.tool,input,step.client?{client:step.client}:{})
  assert.equal(before.drafts.filter(row=>row.id===result.id).length,1)
  assert.equal(before.writes.filter(row=>row.target_id===result.id).length,1,'one attributed native effect')
  const retry=await invoke(args)
  assert.deepEqual(prepared(retry),result,'a new JSON-RPC id returns the original result under '+phase)
  assert.deepEqual(await effects(),before,'retry cannot prepare or audit a second native write')
  refused(await invoke({...args,minutes:args.minutes+1}),'idempotency_conflict')
  assert.deepEqual(await effects(),before,'changed arguments cannot create another preparation')
  const conflict=await invoke({...args,idempotency_key:crypto.randomUUID(),requestKey:crypto.randomUUID(),expected_revision:'[-1,-1,-1]'})
  refused(conflict,'revision_conflict')
  const person=await db.prepare('SELECT version FROM env_people WHERE company_id=? AND id=?').bind(args.companyId,args.personId).first()
  const grant=await db.prepare('SELECT version FROM env_agent_grants WHERE id=?').bind(native.credential_id).first()
  const policy=await db.prepare('SELECT version FROM env_agent_class_policy WHERE company_id=?').bind(args.companyId).first()
  assert.equal(replayError(conflict).current_revision,JSON.stringify([person.version,grant.version,policy.version]))
  assert.deepEqual(await effects(),before,'stale revision has no preparation effect')
}
