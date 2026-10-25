import assert from 'node:assert/strict'

// Create live source authority through the native doors. The archive journey
// supplies the TLS Worker and captures only its declared mail network edge.
export async function archiveAuthority(context, company, notice) {
  const { origin, cookie, worker, edge } = context
  assert.equal(typeof worker?.fetch, 'function', 'the actual native Worker transport is required')
  assert.ok(Array.isArray(edge?.mails), 'the declared mail edge must retain native proof messages')
  assert.ok(company.id && company.base && company.location?.id && notice.id)
  const mime = ['application', 'json'].join('/')
  const call = (path, body) => worker.fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { cookie, origin, host: new URL(origin).host, 'content-type': mime },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = async (path, body, expected = 200) => {
    const response = await call(path, body)
    assert.equal(response.status, expected, 'native authority fixture request must succeed: ' + path)
    return response.json()
  }

  const before = edge.mails.length
  await data('/auth/step-up', { action: 'credentials:mint',
    returnTo: '/app/envelope/companies/' + company.id + '/agents' }, 202)
  const sent = edge.mails.slice(before).at(-1)
  assert.ok(sent, 'the native proof route must send its actual email')
  const match = String(sent.text).match(/https?:[^\s"<>]+/)
  assert.ok(match, 'the native proof email must contain its confirmation link')
  const link = new URL(match[0].replaceAll('&amp;', '&'))
  assert.equal(link.origin, origin, 'the proof link must belong to this installation')
  const token = link.searchParams.get('token')
  assert.ok(token, 'the native proof message must carry its real confirmation token')
  const confirmed = await call('/auth/confirm', { token })
  assert.equal(confirmed.status, 303, 'the current native session must complete its own proof')

  // One controlled Resend account, with separately consented company storage.
  const providerSecret = context.settings.MAIL_API_KEY
  const providers = await data(company.base + '/providers')
  assert.ok(Array.isArray(providers), 'the provider door must return declared providers')
  const resend = providers.find(provider => provider.id === 'resend')
  assert.ok(resend, 'the native provider catalogue must declare Resend')
  await data(company.base + '/providers', {
    id: 'resend', version: resend.version, enabled: true, consent: true,
    secret: providerSecret, sender: 'payroll@example.com',
  }, 201)
  const agent = await data(company.base + '/agents', {
    name: 'Archive restoration authority proof', hours: 24,
    actions: ['records:read', 'dispatch:execute'], fields: ['tax'],
    locations: [company.location.id], providers: ['resend'], models: [],
  }, 201)
  assert.ok(agent.id && agent.token, 'native issuance must return an actual agent credential')
  const active = await worker.fetch(origin + '/api/envelope/mcp', { method: 'POST',
    headers: { authorization: 'Bearer ' + agent.token, origin, 'content-type': mime },
    body: JSON.stringify({ jsonrpc: '2.0', id: 53, method: ['tools', 'call'].join('/'),
      params: { name: 'records.list', arguments: { companyId: company.id } } }) })
  assert.equal(active.status, 200, 'the sponsored bearer works before the archive is made')
  const activeRecords = JSON.parse((await active.json()).result.content[0].text).records
  assert.ok(activeRecords.some(row => row.id === company.people[0].id), 'the live bearer reads its native scoped worker')

  const reply = await data(company.base + '/notices/' + notice.id + '/replies', {
    version: 0, to: 'agency@example.com', subject: 'Reviewed payroll notice response',
    body: 'The employer reviewed this notice and retained the supporting payroll records. This reply awaits dispatch.',
  }, 201)
  const review = await data(company.base + '/notice-replies/' + reply.id + '/review')
  assert.ok(review.reviewToken, 'the current human must obtain the exact native reply review')
  assert.equal(review.version, reply.version)
  assert.equal(review.digest, reply.digest)
  await data(company.base + '/notice-replies/' + reply.id + '/approve', {
    version: review.version, digest: review.digest, reviewToken: review.reviewToken, minutes: 60,
  })

  const effects = []
  for (const expected of ['accepted', 'unknown']) {
    const item = await data(company.base + '/notices/' + notice.id + '/replies', {
      version: 0, to: 'agency@example.com', subject: 'Archive retained notice ' + expected,
      body: 'The employer reviewed this redacted notice response. No payroll or bank instruction is included.',
    }, 201)
    const exact = await data(company.base + '/notice-replies/' + item.id + '/review')
    await data(company.base + '/notice-replies/' + item.id + '/approve', {
      version: exact.version, digest: exact.digest, reviewToken: exact.reviewToken, minutes: 60,
    })
    const execute = () => worker.fetch(origin + '/api/envelope/mcp', { method: 'POST',
      headers: { authorization: 'Bearer ' + agent.token, origin, 'content-type': mime },
      body: JSON.stringify({ jsonrpc: '2.0', id: 530, method: ['tools', 'call'].join('/'),
        params: { name: 'reply.dispatch', arguments: { companyId: company.id, replyId: item.id,
          version: item.version, digest: item.digest } } }) })
    const dispatched = await execute()
    assert.equal(dispatched.status, 200, await dispatched.clone().text())
    const result = JSON.parse((await dispatched.json()).result.content[0].text)
    assert.equal(result.state, expected)
    assert.equal(result.delivered, 'unconfirmed')
    const edgeEffect = edge.noticeEffects.at(-1)
    assert.ok(edgeEffect.idempotencyKey, 'the actual native dispatch retains its original provider idempotency key')
    assert.equal(result.providerReceipt, expected === 'accepted' ? edgeEffect.id : null,
      'an unavailable provider response never fabricates an acknowledgement')
    const count = edge.noticeEffects.length
    const replay = await execute()
    assert.equal(replay.status, 200)
    assert.equal(JSON.parse((await replay.json()).result.content[0].text).replayed, true)
    assert.equal(edge.noticeEffects.length, count, 'replaying accepted or unknown notice work sends no duplicate')
    effects.push({ replyId: item.id, state: expected, providerReceipt: result.providerReceipt,
      executionId: edgeEffect.idempotencyKey.slice('envelope-notice-'.length) })
  }

  return { effects, agentToken: agent.token, agentId: agent.id, replyId: reply.id,
    replyVersion: reply.version, replyDigest: reply.digest, providerSecret }
}
