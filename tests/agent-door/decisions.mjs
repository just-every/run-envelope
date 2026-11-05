import assert from 'node:assert/strict'

export function decisionMeta(answer, disposition, revision) {
  assert.equal(answer.httpStatus, 200)
  const decision = answer.result?._meta?.['com.runeditrun/decision']
  assert.ok(decision?.id, 'the actual MCP decision has a handle')
  assert.equal(decision.disposition, disposition)
  assert.equal(decision.revision, revision)
  assert.deepEqual(decision.classes, [{class:'standard', rule:'bonus-standard', do:disposition, facts:{measure:1}}], 'classification comes from the native bonus tool')
  return decision
}

export function preparedBonus(answer) {
  assert.equal(answer.result?.isError, false, JSON.stringify(answer.result?._meta?.['com.runeditrun/error']))
  const result = answer.result.structuredContent
  assert.ok(result.id)
  assert.equal(result.version, 1)
  assert.equal(result.status, 'uncalculated-earnings-run')
  assert.equal(result.approval, 'requires-separate-human-proof')
  assert.equal(result.dispatch, 'unavailable')
  return result
}

export function pendingBonus(answer, instant) {
  assert.equal(answer.result?.resultType, 'input_required')
  assert.equal(answer.result.structuredContent, undefined, 'waiting returns no prepared run')
  const approval = answer.result._meta['com.runeditrun/approval']
  assert.ok(approval.id)
  assert.equal(Date.parse(approval.expires_at), Date.parse(instant) + 3600000)
  assert.ok(answer.result.requestState)
  assert.deepEqual(answer.result.inputRequests, {approval:{method:'elicitation/create', params:{mode:'url', url:approval.url, message:'A named person must approve this action.'}}})
  assert.equal(new URL(approval.url).pathname, '/agents/approvals/' + approval.id)
  return approval
}

export function refusedDecision(answer, code) {
  assert.equal(answer.result?.isError, true)
  assert.equal(answer.result._meta?.['com.runeditrun/error']?.code, code)
  assert.equal(answer.result.structuredContent, undefined, 'a refusal discloses no saved preparation')
}
