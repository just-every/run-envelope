import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function archiveErasure(context, fixture) {
  const { worker, origin, cookie } = context
  const company = '/api/envelope/companies/' + fixture.companies[0]
  const call = (path, body, headers = {}) => worker.fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { cookie, origin, 'content-type': ['application', 'json'].join('/'), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const audit = async () => (await (await call(company + '/audit')).json()).filter(event => event.action === 'privacy.worker.erased')
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
  const privacyDoor = company + '/people/' + fixture.privacyPersonId + '/privacy'
  const getPrivacy = async () => {
    const response = await call(privacyDoor)
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  const held = await getPrivacy()
  assert.equal(held.status, 'held')
  assert.deepEqual(held.retained.filter(r => r.table === 'env_private_records').map(r => r.key.kind).sort(), ['bank','ssn','tax'])
  assert.ok(held.retained.some(r => r.table === 'env_workspace_versions' && r.key.object_id === fixture.privacyWorkId))
  assert.ok(held.retained.some(r => r.table === 'env_workspace_people'))
  for (const record of held.retained) {
    assert.ok(record.fields.length)
    assert.match(record.legalBasis, /Unclassified statutory retention/)
    assert.equal(record.earliestReleaseAt, null)
    assert.equal(record.released, false)
  }
  assert.match(held.boundary, /Downloaded copies and already-filed agency records are outside local recall/)
  assert.equal((await call(privacyDoor, undefined, {authorization:'Bearer ' + fixture.authority.agentToken})).status, 403)
  assert.equal((await call('/api/envelope/companies/' + fixture.companies[1] + '/people/' + fixture.privacyPersonId + '/privacy')).status, 404)
  const selection = {fingerprint: held.fingerprint, records: held.retained.map(r => r.id), consent: true,
    legalBasis: 'Synthetic reviewed statutory retention release; no active legal hold remains.', custodian: 'Native payroll owner'}
  assert.equal((await call(privacyDoor + '/release', selection)).status, 409, 'an unclassified statutory hold cannot be released')
  assert.equal((await call(privacyDoor + '/retain', {...selection, earliestReleaseAt:'2000-01-01'})).status, 400, 'release gates require explicit UTC instants')
  const classify = await call(privacyDoor + '/retain', {...selection, earliestReleaseAt:'2000-01-01T00:00:00.000Z'})
  assert.equal(classify.status, 200, await classify.clone().text())
  assert.equal((await getPrivacy()).status, 'held', 'elapsed time never releases a statutory hold')
  assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1, consent:true, fingerprint:held.fingerprint})).status, 409)
  const released = await call(privacyDoor + '/release', selection)
  assert.equal(released.status, 200, await released.clone().text())
  assert.equal((await released.json()).status, 'eligible')
  const changed = await call(company + '/people/' + fixture.privacyPersonId + '/private', {kind:'tax',version:1,value:'synthetic-envelope-5402'})
  assert.equal(changed.status,201)
  assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1,consent:true,fingerprint:held.fingerprint})).status,409, 'changed retained contents invalidate the old erasure review')
  const revised = await getPrivacy()
  assert.equal(revised.status,'held','a release never transfers to changed private contents')
  selection.fingerprint = revised.fingerprint
  assert.equal((await call(privacyDoor + '/retain', {...selection,earliestReleaseAt:'2000-01-01T00:00:00.000Z'})).status,200)
  assert.equal((await call(privacyDoor + '/release',selection)).status,200)
  held.fingerprint = revised.fingerprint

  assert.equal((await call(privacyDoor + '/release', selection)).status, 409, 'a human release cannot replay')

  const retainedDoor = company + '/people/' + fixture.retainedPersonId + '/privacy'
  const statutory = await (await call(retainedDoor)).json()
  assert.ok(statutory.retained.some(r => r.table === 'env_workspace_decisions'), 'payroll decisions and source pins are in the transitive held set')
  const future = {fingerprint:statutory.fingerprint, records:[statutory.retained[0].id], consent:true,
    legalBasis:'Synthetic active statutory payroll hold', custodian:'Native payroll owner', earliestReleaseAt:'9999-12-31T00:00:00.000Z'}
  assert.equal((await call(retainedDoor + '/retain', future)).status, 200)
  assert.equal((await call(retainedDoor + '/release', future)).status, 409, 'release before the UTC gate refuses')
  assert.equal((await call(retainedDoor + '/retain', {...future, earliestReleaseAt:'2000-01-01T00:00:00.000Z'})).status, 200)
  const futureState = await (await call(retainedDoor)).json()
  assert.equal(futureState.retained.find(r => r.id === future.records[0]).earliestReleaseAt, future.earliestReleaseAt, 'reclassification never shortens an established gate')
  assert.equal((await call(retainedDoor + '/release', future)).status, 409)

  const browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  try {
    const session = await browser.newContext({ignoreHTTPSErrors:true})
    const separator = cookie.indexOf('=')
    await session.addCookies([{name:cookie.slice(0,separator), value:cookie.slice(separator+1), url:origin, secure:true}])
    const page = await session.newPage(), proof = process.env.ENVELOPE_PROOF_DIR ?? './test-results/envelope'
    await mkdir(proof,{recursive:true})
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      await page.goto(origin + (company + '/people/' + fixture.privacyPersonId).replace('/api/','/app/'))
      assert.ok((await page.locator('main').innerText()).includes('Synthetic local custody worker'))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      for (const control of await page.locator('button,a,summary').all()) if (await control.isVisible())
        assert.ok((await control.innerText()).trim(), 'all controls on the existing worker screen have visible words')
      await page.keyboard.press('Tab')
      assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY')
      await page.screenshot({path:join(proof,'privacy-before-'+width+'.png'),fullPage:true})
    }
    const started = Date.now()
    const cascade = await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1,consent:true,fingerprint:held.fingerprint})
    assert.equal(cascade.status, 200, await cascade.clone().text())
    assert.ok((await cascade.json()).recordsDeleted >= 6)
    assert.ok(Date.now()-started < 300000, 'the committed synchronous cascade finishes inside five minutes')
    assert.equal((await call(company + '/people/' + fixture.privacyPersonId)).status,404)
    for (const kind of ['ssn','bank','tax']) assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/private/' + kind)).status,404)
    assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/allocations')).status,404)
    const auditEvents = await (await call(company + '/audit')).json()
    assert.ok(!auditEvents.some(e => e.targetId === fixture.privacyPersonId || e.targetId === fixture.privacyWorkId), 'retained action targets are anonymized across the erased graph')
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      const response = await page.goto(origin + (company + '/people/' + fixture.privacyPersonId).replace('/api/','/app/'))
      assert.equal(response.status(),404)
      assert.ok(!(await page.locator('main').innerText()).includes('Synthetic local custody worker'))
      await page.screenshot({path:join(proof,'privacy-after-'+width+'.png'),fullPage:true})
    }
    await session.close()
  } finally {await browser.close()}
  assert.equal((await call(company + '/people/' + fixture.retainedPersonId)).status,200,'unreleased payroll remains intact')
  assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/allocations/work', {id:fixture.privacyWorkId,version:0,day:'2026-10-19'})).status,404,'a stale worker source cannot resurrect its erased identity')
  const currentCompany = await (await call(company)).json()
  const replacement = await call(company + '/people', {name:'Synthetic later worker', locationId:currentCompany.people[0].locationId})
  assert.equal(replacement.status,201)
  const replacementId = (await replacement.json()).id
  const staleSource = await call(company + '/people/' + replacementId + '/allocations/work', {
    id:fixture.privacyWorkId,version:0,day:'2026-10-19',state:'TX',locality:'Austin',minutes:480,earnedCents:100000,
    officeState:'TX',nyReason:'not-applicable',sourceRef:'Synthetic stale source replay'
  })
  assert.equal(staleSource.status,409,'the erased source cannot be assigned to a replacement identity')
  assert.deepEqual(await staleSource.json(),{error:'erased_source'})
  const erased = await call(door, { version: 1, consent: true })
  assert.equal(erased.status, 200, await erased.clone().text())
  const receipt = await erased.json()
  assert.equal(receipt.erased, true)
  assert.ok(receipt.id && !receipt.id.includes(fixture.unusedId))
  assert.equal((await call(company + '/people/' + fixture.unusedId)).status, 404, 'the native record read cannot resurrect erased identity')
  const events = await audit()
  assert.equal(events.length, initial.length + 2)
  assert.ok(events.some(event => event.targetId === receipt.id), 'the permanent erasure action uses an anonymous target')
  assert.equal((await call(door, { version: 1, consent: true })).status, 409)
  assert.deepEqual(await audit(), events, 'replayed erasure has no repeated effect or audit')
}
