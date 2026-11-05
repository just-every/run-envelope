import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { privateValue } from './privacy-recorder.mjs'

const sourceInput = { version: 0, taxYear: 2025, state: 'CA', determination: 'final',
  sourceEdition: 'CA-2025-final-2025-11-10', reference: 'synthetic-envelope-futa-final-1' }
const wageInput = (reference, amount = 2000000, extra = {}) => ({ version: 0, taxYear: 2025, state: 'CA',
  workerReference: reference, completeYear: true, allWagesSubjectToSui: true,
  items: [{ reference: reference + '-wages', paidOn: '2025-12-19', wagesCents: amount }], ...extra })
const preparationInput = (people, extra = {}) => ({ version: 0, taxYear: 2025, state: 'CA', sourceVersion: 1,
  workers: people.map(p => ({ personId: p.id, version: 1 })), ...extra })
const native = ({ origin, cookie, worker }) => (path, body, who = cookie, extra = {}) => {
  const init = { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { cookie: who, origin, 'content-type': ['application', 'json'].join('/'), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) }
  return worker ? worker.fetch(origin + path, init) : fetch(origin + path, init)
}
const reader = call => async (path, body, status = 200) => {
  const response = await call(path, body)
  assert.equal(response.status, status, path + ' ' + await response.clone().text())
  assert.equal(response.headers.get('cache-control'), 'no-store')
  return response.json()
}
const approve = async (data, door) => {
  const review = await data(door + '/review')
  await data(door + '/approve', { version: review.version, reviewToken: review.reviewToken })
  return review
}

/** Independent IRS Schedule A examples, with dangerous paths exercised both ways. */
export async function futaCreditJourney(context) {
  const { cookie, sql, settings, restart, outboundCount } = context, call = native(context), data = reader(call)
  const outboundBefore = outboundCount()
  const company = await data('/api/envelope/companies', { name: 'Synthetic FUTA employer', ein: '00-0008901' }, 201)
  const base = '/api/envelope/companies/' + company.id, sources = base + '/futa-credit-sources', door = base + '/futa-preparations/2025'
  const location = await data(base + '/locations', { name: 'California workplace', state: 'CA' }, 201)
  const person = async name => data(base + '/people', { name, locationId: location.id }, 201)
  const wages = p => base + '/people/' + p.id + '/futa-wages/2025'
  const business = () => Promise.all([
    "SELECT * FROM env_run_approvals ORDER BY company_id,run_id,version",
    "SELECT * FROM env_notice_dispatches ORDER BY company_id,reply_id,version",
    "SELECT * FROM env_workspace_versions WHERE kind NOT LIKE 'futa-%' ORDER BY company_id,kind,object_id,version",
    "SELECT * FROM env_lifecycle_events ORDER BY id",
  ].map(sql))
  const untouchedBusiness = await business()
  const snapshot = () => Promise.all([
    'SELECT * FROM env_workspace_versions ORDER BY company_id,kind,object_id,version',
    'SELECT * FROM env_workspace_decisions ORDER BY company_id,kind,object_id,version,decision',
    'SELECT * FROM env_workspace_reviews ORDER BY token_hash',
    'SELECT * FROM env_audit ORDER BY id',
  ].map(sql))
  const refused = async (path, body, status = 409, who = cookie, extra = {}, auditActions = []) => {
    const before = await snapshot(), response = await call(path, body, who, extra)
    assert.equal(response.status, status, path + ' ' + await response.clone().text())
    const after = await snapshot()
    assert.deepEqual(after.slice(0, 3), before.slice(0, 3), 'refused FUTA request changes no evidence, review or preparation')
    const newAudit = after[3].filter(row => !before[3].some(prior => prior.id === row.id))
    assert.deepEqual(newAudit.map(row => row.action), auditActions, 'only the existing retained-access audit may accompany a held-data refusal')
    assert.ok(before[3].every(row => after[3].some(prior => JSON.stringify(prior) === JSON.stringify(row))), 'refusal preserves every existing audit row')
    assert.deepEqual(await business(), untouchedBusiness, 'unsafe preparation cannot create payroll or external effects')
    return response
  }
  await refused(door, preparationInput([]), 400)
  for (const change of [
    { taxYear: 2026 }, { state: 'NY' }, { determination: 'provisional' },
    { sourceEdition: 'CA-2024-final' }, { sourceEdition: '' },
  ]) await refused(sources, { ...sourceInput, ...change })
  await refused(sources, { ...sourceInput, rate: 0 }, 400)
  await data(sources, sourceInput, 201)
  const people = []
  for (let n = 0; n < 3; n++) people.push(await person('Synthetic annual FUTA worker ' + n))
  const capture = preparationInput(people)
  await refused(door, capture)
  const sourceReview = await approve(data, sources)
  assert.equal(sourceReview.data.edition.determination, 'final')
  assert.equal(sourceReview.data.edition.taxYear, 2025)
  assert.equal(sourceReview.data.edition.state, 'CA')
  assert.ok(sourceReview.data.edition.sources.some(s => s.authority === 'IRS' && s.retainedExcerpt.includes('line 11')))
  assert.ok(sourceReview.data.edition.sources.some(s => s.authority === 'DOL' && s.retainedExcerpt.includes('waiver')))
  assert.equal(sourceReview.data.edition.appliedBcrBasisPoints, 0, 'approved BCR waiver never becomes an extra charge')
  privateValue(sourceInput.reference)
  for (const [n, p] of people.entries()) {
    const input = wageInput('synthetic-envelope-futa-worker-' + n)
    if (!n) input.items = [
      { reference: 'synthetic-envelope-futa-first-half', paidOn: '2025-06-20', wagesCents: 1000000 },
      { reference: 'synthetic-envelope-futa-second-half', paidOn: '2025-12-19', wagesCents: 1000000 },
    ]
    await data(wages(p), input, 201)
    if (!n) {
      await refused(wages(p) + '/approve', { version: 1, reviewToken: 'synthetic-envelope-not-reviewed' })
    }
  }
  await refused(door, capture)
  for (const p of people) await approve(data, wages(p))
  await refused(door, { ...capture, workers: [...capture.workers, capture.workers[0]] })
  const duplicate = await person('Synthetic duplicate source claimant')
  await refused(wages(duplicate), wageInput('synthetic-envelope-futa-worker-0'))
  await refused(wages(duplicate), wageInput('synthetic-envelope-distinct-worker', 2000000, {
    items: [{ reference: 'synthetic-envelope-futa-first-half', paidOn: '2025-06-20', wagesCents: 1000000 }],
  }))
  for (const change of [
    { completeYear: false }, { allWagesSubjectToSui: false }, { taxYear: 2026 }, { state: 'VI' },
    { items: [{ reference: 'synthetic-envelope-wrong-year', paidOn: '2024-12-20', wagesCents: 2000000 }] },
    { items: Array(2).fill({ reference: 'synthetic-envelope-duplicate-source', paidOn: '2025-12-19', wagesCents: 2000000 }) },
  ]) await refused(wages(duplicate), wageInput('synthetic-envelope-refused-wage', 2000000, change))
  const prepared = await data(door, capture, 201), result = prepared.result
  // IRS 2025 Schedule A page 2: 3 x $20,000 less 3 x $13,000 = $21,000; x .012 = $252.
  assert.equal(result.taxableWagesCents, 2100000)
  assert.equal(result.additionalEmployerLiabilityCents, 25200)
  assert.deepEqual(result.rows.map(r => r.taxableWagesCents), [700000, 700000, 700000])
  assert.equal(result.grossFutaBeforeCreditsCents, 126000, 'gross 6 percent remains separately identified before any credit')
  assert.deepEqual(result.scheduleA, { state: 'CA', reductionRate: '0.012', taxableWagesCents: 2100000, creditReductionCents: 25200 })
  assert.deepEqual(result.form940, { line11Cents: 25200 })
  assert.equal(result.quarter, 4)
  assert.equal(result.coverage, 'selected-reviewed-wages')
  assert.equal(result.employeeWithholdingCents, 0)
  assert.equal(result.paidLiabilityCents, null)
  assert.equal(result.payrollApproval, null)
  assert.equal(result.unsigned, true); assert.equal(result.unfiled, true)
  assert.equal(result.paymentReady, false); assert.equal(result.filing, 'unavailable'); assert.equal(result.payment, 'unavailable')
  const exact = await data(door + '/review')
  assert.deepEqual(exact.data.result, result)
  assert.equal(exact.approvedBy, null, 'review of prepared reporting data is not payroll or payable approval')
  const beforeReplay = await snapshot()
  await restart()
  const replay = await data(door, capture, 201)
  assert.equal(replay.replayed, true); assert.equal(replay.version, 1); assert.deepEqual(replay.result, result)
  assert.deepEqual(await snapshot(), beforeReplay, 'lost-response replay after restart has exactly one preparation')
  for (const action of ['approve', 'file', 'pay', 'deposit']) await refused(door + '/' + action, { version: 1, reviewToken: exact.reviewToken })
  await refused(door, { ...capture, workers: capture.workers.slice(0, 2) })
  await refused(door, { ...capture, state: 'NY' })
  await refused(base + '/futa-preparations/2026', { ...capture, taxYear: 2026 })
  await refused(door, { ...capture, sourceVersion: 2 })
  await refused(door, { ...capture, id: 'synthetic-envelope-second-annual-base' }, 400)
  assert.deepEqual(await business(), untouchedBusiness)
  console.log('PROBE ENV-089 1: reviewed CA 2025 source and three annual 20000 dollar wages -> 21000 taxable, 252 additional employer Q4 liability on Schedule A and Form 940 line 11; unsigned and unfiled')

  // The second acceptance example is independent, with another EIN and ten annual bases.
  const second = await data('/api/envelope/companies', { name: 'Synthetic ten-worker FUTA employer', ein: '00-0008902' }, 201)
  const secondBase = '/api/envelope/companies/' + second.id, secondDoor = secondBase + '/futa-preparations/2025'
  await data(secondBase + '/futa-credit-sources', sourceInput, 201); await approve(data, secondBase + '/futa-credit-sources')
  const secondLocation = await data(secondBase + '/locations', { name: 'California workplace', state: 'CA' }, 201)
  const ten = []
  for (let n = 0; n < 10; n++) {
    const p = await data(secondBase + '/people', { name: 'Synthetic 7000 dollar worker ' + n, locationId: secondLocation.id }, 201)
    const w = secondBase + '/people/' + p.id + '/futa-wages/2025'
    await data(w, wageInput('synthetic-envelope-ten-worker-' + n, 700000), 201); await approve(data, w); ten.push(p)
  }
  const tenCapture = preparationInput(ten), tenPrepared = await data(secondDoor, tenCapture, 201)
  assert.equal(tenPrepared.result.taxableWagesCents, 7000000)
  assert.equal(tenPrepared.result.additionalEmployerLiabilityCents, 84000)
  assert.equal(tenPrepared.result.form940.line11Cents, 84000)
  assert.equal(tenPrepared.result.employeeWithholdingCents, 0)
  assert.equal(tenPrepared.result.quarter, 4)
  assert.equal(tenPrepared.result.paymentReady, false); assert.equal(tenPrepared.result.paidLiabilityCents, null)
  await restart()
  assert.equal((await data(secondDoor, tenCapture, 201)).replayed, true)
  // Duplicating the employer record cannot invent another annual base for one EIN.
  await data('/api/envelope/companies', { name: 'Synthetic duplicate EIN record', ein: '00-0008902' }, 201)
  const duplicateEin = await call(secondDoor, tenCapture)
  assert.equal(duplicateEin.status, 409); assert.equal((await duplicateEin.json()).error, 'futa_duplicate_ein_company')
  console.log('PROBE ENV-089 2 calculation: reviewed ten 7000 dollar annual bases -> 70000 taxable and 840 additional Q4 employer liability; deposit and payment unavailable')

  // An expanded selected wage set replaces the earlier preparation without adding liabilities.
  const rounded = await data('/api/envelope/companies', { name: 'Synthetic fractional FUTA employer', ein: '00-0008904' }, 201)
  const roundedBase = '/api/envelope/companies/' + rounded.id, roundedDoor = roundedBase + '/futa-preparations/2025'
  const roundedLocation = await data(roundedBase + '/locations', { name: 'California workplace', state: 'CA' }, 201)
  await data(roundedBase + '/futa-credit-sources', sourceInput, 201); await approve(data, roundedBase + '/futa-credit-sources')
  const small = []
  for (let n = 0; n < 2; n++) {
    const p = await data(roundedBase + '/people', { name: 'Synthetic fractional wage worker ' + n, locationId: roundedLocation.id }, 201)
    const w = roundedBase + '/people/' + p.id + '/futa-wages/2025'
    await data(w, wageInput('synthetic-envelope-futa-fractional-' + n, 4167), 201); await approve(data, w); small.push(p)
  }
  const originalSelection = preparationInput(small.slice(0, 1))
  assert.equal((await data(roundedDoor, originalSelection, 201)).result.additionalEmployerLiabilityCents, 50)
  const expanded = await data(roundedDoor, preparationInput(small, { version: 1 }), 201)
  assert.equal(expanded.version, 2); assert.equal(expanded.result.taxableWagesCents, 8334)
  assert.equal(expanded.result.additionalEmployerLiabilityCents, 100, 'Schedule A rounds the aggregate 1.00008 dollars to one dollar')
  const selections = await data(roundedDoor)
  assert.deepEqual(selections.map(row => [row.version, row.current]), [[2, true], [1, false]])
  assert.equal(selections[1].data.result.additionalEmployerLiabilityCents, 50, 'retained historical amounts are not relabeled')
  await refused(roundedDoor, originalSelection)

  // Corrected source editions invalidate pending preparation rather than relabeling history.
  await data(sources, { ...sourceInput, version: 1, reference: 'synthetic-envelope-futa-corrected-source' }, 201)
  await refused(door + '/review', undefined)
  await refused(door, capture)
  await refused(sources + '/approve', { version: 1, reviewToken: sourceReview.reviewToken })
  await approve(data, sources)
  await refused(door, capture)
  const current = await data(door, { ...capture, version: 1, sourceVersion: 2 }, 201)
  assert.equal(current.version, 2); assert.equal(current.result.additionalEmployerLiabilityCents, 25200)
  let history = await data(door)
  assert.deepEqual(history.map(r => [r.version, r.current]), [[2, true], [1, false]])
  assert.equal(history[1].data.result.sourceVersion, 1)
  assert.equal(history[1].data.result.sourceReference, sourceInput.reference)
  const correctedWages = wageInput('synthetic-envelope-futa-worker-0', 500000, { version: 1 })
  await data(wages(people[0]), correctedWages, 201)
  await refused(door, { ...capture, version: 2, sourceVersion: 2 })
  await refused(door + '/review', undefined)
  await approve(data, wages(people[0]))
  const correctedCapture = { ...capture, version: 2, sourceVersion: 2,
    workers: capture.workers.map((w, i) => ({ ...w, version: i ? 1 : 2 })) }
  const corrected = await data(door, correctedCapture, 201)
  assert.equal(corrected.result.taxableWagesCents, 1900000)
  assert.equal(corrected.result.additionalEmployerLiabilityCents, 22800)
  history = await data(door)
  assert.deepEqual(history.map(r => r.data.result.additionalEmployerLiabilityCents), [22800, 25200, 25200])
  assert.equal(history[0].data.result.rows.find(r => r.personId === people[0].id).evidenceVersion, 2)
  assert.equal(history.filter(r => r.current).length, 1)
  await restart()
  assert.equal((await data(door, correctedCapture, 201)).replayed, true)

  const foreign = await data('/api/envelope/companies', { name: 'Synthetic foreign FUTA employer', ein: '00-0008903' }, 201)
  const foreignBase = '/api/envelope/companies/' + foreign.id
  await refused(foreignBase + '/people/' + people[0].id + '/futa-wages/2025', undefined, 404)
  const foreignLocation = await data(foreignBase + '/locations', { name: 'Other workplace', state: 'CA' }, 201)
  const foreignWorker = await data(foreignBase + '/people', { name: 'Synthetic foreign worker', locationId: foreignLocation.id }, 201)
  await refused(door, { ...correctedCapture, workers: [{ personId: foreignWorker.id, version: 1 }] }, 404)
  await refused(foreignBase + '/futa-preparations/2025', capture, 404)
  const member = 'synthetic-envelope-futa-member', token = randomBytes(32).toString('base64url')
  const tokenHash = await hashToken(settings.SESSION_SECRET, 'session', token), now = Date.now()
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic FUTA preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${tokenHash}','${member}',1,'native',${now},${now + 3600000})`)
  await data(base + '/grants', { operatorId: member, version: 0, role: 'payroll-admin', locations: ['*'], fields: ['compensation', 'tax'], actions: ['records:read', 'records:write', 'rates:propose', 'rates:approve'] })
  const memberCookie = cookie.split('=')[0] + '=' + token
  for (const [path, body] of [[sources, undefined], [door, undefined], [door, correctedCapture], [wages(people[0]), correctedWages]]) await refused(path, body, 403, memberCookie)
  await refused(door, undefined, 401, '')
  await refused(door, correctedCapture, 403, cookie, { authorization: 'Bearer synthetic-envelope-futa-agent' })
  const ownerSession = (await sql("SELECT id,operator_id,operator_version FROM oa_sessions WHERE revoked_at IS NULL AND operator_id IN (SELECT id FROM oa_operators WHERE role='owner') ORDER BY created_at LIMIT 1"))[0]
  const ownerToken = randomBytes(32).toString('base64url'), ownerHash = await hashToken(settings.SESSION_SECRET, 'session', ownerToken)
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-futa-revoked-owner','${ownerHash}','${ownerSession.operator_id}',${ownerSession.operator_version},'native',${now},${now + 3600000})`)
  const ownerCookie = cookie.split('=')[0] + '=' + ownerToken
  assert.equal((await call(sources, undefined, ownerCookie)).status, 200)
  await sql("UPDATE oa_sessions SET revoked_at=1 WHERE id='synthetic-envelope-futa-revoked-owner'")
  for (const [path, body] of [[sources, undefined], [door, undefined], [door, correctedCapture], [door + '/review', undefined]]) await refused(path, body, 401, ownerCookie)

  // Native custody holds block even this owner's annual preparation and its replay.
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('synthetic-envelope-futa-proof','synthetic-envelope-futa-proof-hash','${ownerSession.id}','${ownerSession.operator_id}',${ownerSession.operator_version},'credentials:mint','/app',${now},${now + 600000},${now})`)
  const privacy = base + '/people/' + people[0].id + '/privacy', inventory = await data(privacy)
  assert.ok(inventory.retained.some(r => r.key.kind === 'futa-wages'))
  assert.ok(inventory.retained.some(r => r.key.kind === 'futa-preparation'))
  assert.ok(!inventory.retained.some(r => r.key.kind === 'futa-source'), 'one worker custody graph does not consume the employer source edition')
  await data(privacy + '/request', { fingerprint: inventory.fingerprint, consent: true })
  for (const [path, body] of [[sources, undefined], [door, undefined], [door + '/review', undefined], [door, correctedCapture], [wages(people[0]), correctedWages], [sources, { ...sourceInput, version: 2 }]]) await refused(path, body, 409, cookie, {}, ['privacy.retained-access'])
  const held = await data(privacy)
  const release = { fingerprint: held.fingerprint, records: held.retained.map(r => r.id), consent: true,
    legalBasis: 'Synthetic reviewed eligible local release.', custodian: 'Native owner', earliestReleaseAt: '2000-01-01T00:00:00.000Z' }
  await data(privacy + '/retain', release); await data(privacy + '/release', release)
  await data(base + '/people/' + people[0].id + '/erase', { version: held.version, ...release })
  await refused(wages(people[0]), undefined, 404)
  await refused(wages(people[0]), correctedWages, 404)
  assert.deepEqual(await data(door), [], 'erasure removes every shared derivative containing the worker')
  assert.equal((await data(sources)).length, 2, 'unrelated employer source editions survive worker erasure')
  const replacement = await person('Synthetic replacement claim worker')
  await refused(wages(replacement), wageInput('synthetic-envelope-futa-worker-0'), 409)
  await refused(door, correctedCapture, 404)
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM env_workspace_versions WHERE company_id='${company.id}' AND kind='futa-preparation'`))[0].n, 0)
  const ciphers = await sql("SELECT cipher FROM env_workspace_versions WHERE kind='futa-source'")
  assert.ok(ciphers.length && ciphers.every(row => !row.cipher.includes(sourceInput.reference)))
  assert.deepEqual(await business(), untouchedBusiness, 'preparation, corrections, refusal and erasure never change payroll approvals, deductions, payments, filings or deliveries')
  assert.equal(outboundCount(), outboundBefore, 'every allowed and refused FUTA operation sends no outbound request')
  console.log('FUTA-CREDIT passed: independent IRS goldens, annual base once per worker and EIN, reviewed exact sources, immutable corrections, lost-response replay and restart, held-source and current-authority refusals, erasure fences and no money or filing effects')
}

/** The existing real CLI archive journey retains the same native preparation graph. */
export async function futaArchiveFixture(context, companyId, personId) {
  const data = reader(native(context)), base = '/api/envelope/companies/' + companyId
  const sources = base + '/futa-credit-sources', wages = base + '/people/' + personId + '/futa-wages/2025', door = base + '/futa-preparations/2025'
  await data(sources, sourceInput, 201); await approve(data, sources)
  await data(wages, wageInput('synthetic-envelope-futa-archive-worker'), 201); await approve(data, wages)
  const capture = preparationInput([{ id: personId }]), result = await data(door, capture, 201)
  assert.equal(result.result.additionalEmployerLiabilityCents, 8400)
  await data(door + '/review')
  return { door, capture, companyId, personId, result: result.result }
}
