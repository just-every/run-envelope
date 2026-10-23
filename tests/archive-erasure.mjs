import assert from 'node:assert/strict'

export async function archiveErasure(context, fixture) {
  const { worker, origin, cookie } = context
  const company = '/api/envelope/companies/' + fixture.companies[0]
  const call = (path, body, headers = {}) => worker.fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { cookie, origin, 'content-type': ['application', 'json'].join('/'), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const audit = async () => (await (await call(company + '/audit')).json()).filter(event => event.action === 'privacy.unused-worker.erased')
  const initial = await audit()
  const door = company + '/people/' + fixture.unusedId + '/erase'
  assert.equal((await call(door, { version: 1 })).status, 400, 'unused-worker erasure requires explicit owner consent')
  assert.equal((await call(door, { version: 1, consent: true }, { authorization: 'Bearer ' + fixture.authority.agentToken })).status, 403,
    'a working scoped bearer cannot authorize erasure alongside an owner cookie')
  const retained = await call(company + '/people/' + fixture.retainedPersonId + '/erase', { version: 1, consent: true })
  assert.equal(retained.status, 409)
  assert.deepEqual(await retained.json(), { error: 'erasure_retention_review_required' })
  assert.equal((await call(company + '/people/' + fixture.retainedPersonId)).status, 200, 'payroll-dependent records remain held for retention review')
  assert.equal((await call(door, { version: 2, consent: true })).status, 409, 'an obsolete worker version cannot erase current data')
  assert.deepEqual(await audit(), initial, 'refused privacy requests publish no erasure audit event')
  const erased = await call(door, { version: 1, consent: true })
  assert.equal(erased.status, 200, await erased.clone().text())
  const receipt = await erased.json()
  assert.equal(receipt.erased, true)
  assert.ok(receipt.id && !receipt.id.includes(fixture.unusedId))
  assert.equal((await call(company + '/people/' + fixture.unusedId)).status, 404, 'the native record read cannot resurrect erased identity')
  const events = await audit()
  assert.equal(events.length, initial.length + 1)
  assert.equal(events[0].targetId, receipt.id, 'the permanent erasure action uses an anonymous target')
  assert.equal((await call(door, { version: 1, consent: true })).status, 409)
  assert.deepEqual(await audit(), events, 'replayed erasure has no repeated effect or audit')
}
