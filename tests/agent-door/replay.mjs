import assert from 'node:assert/strict'

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
