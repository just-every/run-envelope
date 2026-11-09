import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { ordinaryW4 } from './industry-fixture.mjs'
import { privateValue } from './privacy-recorder.mjs'

const quarter = { from: '2026-01-01', through: '2026-03-31' }
const month = { from: '2026-01-01', through: '2026-01-31' }
const ruleEdition = 'WAC-296-17-31021-effective-2021-01-01'
const native = ({ origin, cookie, worker }) => (path, body, who = cookie, extra = {}) =>
  (worker ? worker.fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { cookie: who, origin, 'content-type': ['application', 'json'].join('/'), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    : fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual', headers: { cookie: who, origin, 'content-type': ['application', 'json'].join('/'), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))
const reader = call => async (path, body, status = 200) => {
  const r = await call(path, body)
  assert.equal(r.status, status, path + ' ' + await r.clone().text())
  assert.equal(r.headers.get('cache-control'), 'no-store')
  return r.json()
}
const approve = async (data, path) => {
  const review = await data(path + '/review')
  await data(path + '/approve', { version: review.version, reviewToken: review.reviewToken })
  return review
}
// These synthetic employer notices model the official L&I rate notice's total
// hourly rate and maximum employee rate. They are not invented state base rates.
const notice = (companyId, employerEin, second = false, extra = {}) => ({
  id: second ? 'synthetic-envelope-wa-class-two' : 'synthetic-envelope-wa-class-one',
  version: 0, companyId, employerEin, riskClass: second ? '4904-00' : '4902-00',
  from: '2026-01-01', through: '2026-12-31', totalRate: second ? '2.25' : '1.50', employeeRate: second ? '0.40' : '0.30',
  sourceEdition: '2026 employer assigned hourly rate notice',
  reference: second ? 'synthetic-envelope-wa-notice-two' : 'synthetic-envelope-wa-notice-one',
  documentText: second ? 'Synthetic employer assigned notice: class 4904-00, total 2.25 dollars per hour, employee maximum 0.40 dollars per hour, calendar 2026.'
    : 'Synthetic employer assigned notice: class 4902-00, total 1.50 dollars per hour, employee maximum 0.30 dollars per hour, calendar 2026.',
  sourceUrl: 'https://www.lni.wa.gov/insurance/rates-risk-classes/rates-for-workers-compensation/', ...extra,
})
const allocation = (second = false, extra = {}) => ({
  riskClass: second ? '4904-00' : '4902-00',
  noticeId: second ? 'synthetic-envelope-wa-class-two' : 'synthetic-envelope-wa-class-one', noticeVersion: 1, ...extra,
})
const hours = (extra = {}) => ({ version: 0, ...quarter, remuneration: 'hourly', method: 'actual',
  reference: 'synthetic-envelope-wa-hour-register', allocations: [allocation(false, { hours: '120' }), allocation(true, { hours: '40' })], ...extra })
const salary = (extra = {}) => hours({ remuneration: 'salary', method: 'wa-160-month', allocations: [allocation()], ...extra })
const selection = people => people.map(p => ({ personId: p.id, version: 1 }))
const capture = (people, extra = {}) => ({ version: 0, ...quarter, workers: selection(people), electionVersion: 1, ...extra })
const election = (people, extra = {}) => ({ version: 0, ...quarter, method: 'wa-160-month', workers: selection(people),
  completeSalariedRoster: true, sourceEdition: ruleEdition, ...extra })
const evidenceId = (person, p = quarter) => person.id + '-' + p.from + '-' + p.through
const assertions = result => {
  assert.equal(result.status, 'preparation-only'); assert.equal(result.unsigned, true); assert.equal(result.unfiled, true)
  assert.equal(result.collectedPremiumCents, null); assert.equal(result.payrollApproval, null)
  assert.equal(result.accountAuthority, false); assert.equal(result.coverageEstablished, false)
  assert.equal(result.paymentReady, false); assert.equal(result.payment, 'unavailable'); assert.equal(result.filing, 'unavailable')
}

/** Public native setup, exact review, worksheet, preview, correction and unsafe-path sanity journey. */
export async function waLiJourney(context) {
  const { cookie, sql, settings, restart, outboundCount } = context, call = native(context), data = reader(call)
  const outboundBefore = outboundCount()
  const company = await data('/api/envelope/companies', { name: 'Synthetic Washington employer', ein: '00-0009501' }, 201)
  const base = '/api/envelope/companies/' + company.id, wa = base + '/wa-li', door = wa + '/preparations'
  const notices = wa + '/notices', elections = wa + '/elections'
  const location = await data(base + '/locations', { name: 'Washington workplace', state: 'WA' }, 201)
  const makePerson = name => data(base + '/people', { name, locationId: location.id }, 201)
  const hourly = await makePerson('Synthetic two-class hourly worker'), salaried = await makePerson('Synthetic salaried worker')
  const personHours = p => wa + '/hours/' + p.id
  const reviewHours = p => approve(data, personHours(p) + '/' + evidenceId(p))
  const reviewElection = () => approve(data, elections + '/' + quarter.from + '-' + quarter.through)
  const reviewPreparation = (prepared, status = 200) => data(door + '/' + prepared.id + '/review?version=' + prepared.version, undefined, status)
  const business = () => Promise.all([
    'SELECT * FROM env_run_approvals ORDER BY company_id,run_id,version',
    "SELECT * FROM env_workspace_versions WHERE kind NOT LIKE 'wa-li-%' ORDER BY company_id,kind,object_id,version",
    'SELECT * FROM env_notice_dispatches ORDER BY company_id,reply_id,version',
    'SELECT * FROM env_lifecycle_events ORDER BY id',
  ].map(sql))
  const businessBefore = await business()
  const snapshot = () => Promise.all([
    'SELECT * FROM env_workspace_versions ORDER BY company_id,kind,object_id,version',
    'SELECT * FROM env_workspace_decisions ORDER BY company_id,kind,object_id,version,decision',
    'SELECT * FROM env_workspace_reviews ORDER BY token_hash',
  ].map(sql))
  const refused = async (path, body, status = 409, who = cookie, extra = {}) => {
    const before = await snapshot(), r = await call(path, body, who, extra)
    assert.equal(r.status, status, path + ' ' + await r.clone().text())
    assert.deepEqual(await snapshot(), before, 'refused operation retains no evidence, review, decision or preparation')
    assert.deepEqual(await business(), businessBefore, 'refusal cannot change payroll or payment authority')
    return r.json()
  }
  const firstNotice = notice(company.id, '00-0009501'), secondNotice = notice(company.id, '00-0009501', true)
  privateValue(firstNotice.documentText); privateValue(firstNotice.reference)
  await refused(notices, { ...firstNotice, companyId: 'synthetic-envelope-foreign' })
  await refused(notices, { ...firstNotice, employerEin: '00-0009502' })
  await refused(notices, { ...firstNotice, employeeRate: '1.51' }, 400)
  await refused(notices, { ...firstNotice, sourceUrl: 'https://example.org/notice' })
  await refused(personHours(hourly), hours(), 404)
  await data(notices, firstNotice, 201)
  await refused(personHours(hourly), hours(), 409)
  const noticeReview = await approve(data, notices + '/' + firstNotice.id)
  assert.equal(noticeReview.data.companyId, company.id)
  assert.equal(noticeReview.data.employerEin, '00-0009501')
  assert.equal(noticeReview.data.documentText, firstNotice.documentText)
  assert.equal(noticeReview.data.totalRate, '1.50'); assert.equal(noticeReview.data.employeeRate, '0.30')
  assert.equal(noticeReview.data.riskClass, '4902-00')
  assert.equal(noticeReview.data.from, '2026-01-01'); assert.equal(noticeReview.data.through, '2026-12-31')
  assert.equal(noticeReview.data.documentDigest.length, 64)
  await data(notices, secondNotice, 201); await approve(data, notices + '/' + secondNotice.id)
  for (const allocations of [
    [allocation(false, { riskClass: '4905-00', hours: '160' })],
    [allocation(false, { noticeVersion: 2, hours: '160' })],
    [allocation(false, { hours: '80' }), allocation(false, { hours: '80' })],
  ]) await refused(personHours(hourly), hours({ allocations }))
  await refused(personHours(hourly), hours({ from: '2025-12-01' }))
  await refused(personHours(hourly), hours({ method: 'wa-160-month', allocations: [allocation()] }))
  await refused(personHours(salaried), salary({ from: '2026-01-02' }))
  await data(personHours(hourly), hours(), 201)
  await refused(personHours(hourly) + '/' + evidenceId(hourly) + '/approve', { version: 1, reviewToken: 'synthetic-envelope-not-reviewed' })
  await data(personHours(salaried), salary(), 201)
  await refused(door, capture([hourly, salaried]))
  await reviewHours(hourly); await reviewHours(salaried)
  await refused(door, capture([hourly, salaried]), 404)
  await data(elections, election([salaried]), 201)
  await refused(door, capture([hourly, salaried]))
  const elected = await reviewElection()
  assert.equal(elected.data.rule.edition, ruleEdition); assert.ok(elected.data.rule.retainedExcerpt.includes('same method'))
  await refused(door, capture([hourly, salaried], { workers: selection([hourly, hourly, salaried]) }))
  await refused(door, capture([hourly, salaried], { workers: selection([hourly]) }))
  const input = capture([hourly, salaried]), prepared = await data(door, input, 201), result = prepared.result
  assertions(result)
  const hourlyRows = result.rows.filter(r => r.personId === hourly.id)
  // Independent notice arithmetic: 120 x 1.50 + 40 x 2.25 = 270;
  // employee 120 x .30 + 40 x .40 = 52; employer 218.
  assert.deepEqual(hourlyRows.map(r => [r.hours, r.totalPremiumCents, r.proposedEmployeeCents, r.employerRemainderCents]),
    [['120', 18000, 3600, 14400], ['40', 9000, 1600, 7400]])
  const salaryRow = result.rows.find(r => r.personId === salaried.id)
  // WAC's full three months: 160 + 160 + 160 = 480; 720 total, 144 employee, 576 employer.
  assert.deepEqual([salaryRow.hours, salaryRow.totalPremiumCents, salaryRow.proposedEmployeeCents, salaryRow.employerRemainderCents], ['480', 72000, 14400, 57600])
  assert.deepEqual([result.totalPremiumCents, result.proposedEmployeeCents, result.employerRemainderCents], [99000, 19600, 79400])
  assert.deepEqual(result.worksheet.map(r => [r.riskClass, r.hours, r.totalPremiumCents, r.proposedEmployeeCents, r.employerRemainderCents]),
    [['4902-00', '600', 90000, 18000, 72000], ['4904-00', '40', 9000, 1600, 7400]])
  assert.deepEqual((await reviewPreparation(prepared)).result, result)
  assert.deepEqual((await data(door))[0].data.result, result, 'reporting door exposes the retained unsigned worksheet')
  const previewInput = { edition: '2026-01', payDate: '2026-03-31', ...quarter, frequency: 'monthly', workState: 'WA', residentState: 'WA', locality: 'none',
    remuneration: { kind: 'salary', exempt: true, cashCents: 100000 }, w4: ordinaryW4, stateElection: {},
    yearToDate: { socialSecurityWagesCents: 0, medicareWagesCents: 0, futaWagesCents: 0, suiWagesCents: 0 },
    tips: { heldCents: 0, paycheckCents: 0, furnishedCents: 0 }, deductions: [] }
  const previewDoor = base + '/calculation-preview', ordinary = await data(previewDoor, previewInput)
  const preview = await data(previewDoor, { ...previewInput, waLi: { id: prepared.id, version: 1 } })
  assert.deepEqual(preview.waLi, result); assert.deepEqual(preview.deductions, ordinary.deductions)
  assert.deepEqual(preview.federal, ordinary.federal); assert.deepEqual(preview.federalEmployerTaxes, ordinary.federalEmployerTaxes)
  assert.equal(preview.paymentReady, false); assert.equal(preview.netCashCents, null)
  assert.ok(preview.holds.some(h => h.code === 'wa-li-preparation-only'))
  await refused(previewDoor, { ...previewInput, from: '2026-02-01', waLi: { id: prepared.id, version: 1 } }, 400)
  for (const action of ['approve', 'pay', 'file', 'activate']) await refused(door + '/' + prepared.id + '/' + action, { version: 1 })
  const beforeReplay = await snapshot()
  await restart()
  const replay = await data(door, input, 201)
  assert.equal(replay.replayed, true); assert.deepEqual(replay.result, result)
  assert.deepEqual(await snapshot(), beforeReplay, 'lost-response replay after restart creates no second preparation')
  console.log('PROBE ENV-095 1: actual notice setup, exact review, private calculation preview and worksheet -> hourly two-class 270.00 total, 52.00 employee, 218.00 employer; salaried quarter 480 hours, 720.00 total, 144.00 employee, 576.00 employer; unsigned and unfiled')

  // Another salaried worker outside the earlier selection cannot evade the
  // employer-wide rule; a new retained actual-hours method invalidates the election.
  const otherSalary = await makePerson('Synthetic second salaried worker')
  await data(personHours(otherSalary), salary({ method: 'actual', allocations: [allocation(false, { hours: '450' })] }), 201)
  await reviewHours(otherSalary)
  await refused(door, input)
  await refused(elections, election([salaried, otherSalary], { version: 1 }))
  await refused(elections, election([salaried], { version: 1 }))
  await data(personHours(otherSalary), salary({ version: 1 }), 201); await reviewHours(otherSalary)
  const workers = [hourly, salaried, otherSalary]
  const selectedWorkers = selection(workers).map(w => ({ ...w, version: w.personId === otherSalary.id ? 2 : 1 }))
  const electedWorkers = selectedWorkers.filter(w => w.personId !== hourly.id)
  await data(elections, election([], { version: 1, workers: electedWorkers }), 201); await reviewElection()
  const consistent = { ...input, version: 1, workers: selectedWorkers, electionVersion: 2 }
  const expanded = await data(door, consistent, 201)
  assert.deepEqual(expanded.result.rows.filter(r => r.remuneration === 'salary').map(r => r.hours), ['480', '480'])
  assert.equal(expanded.result.totalPremiumCents, 171000)
  await refused(door, input)
  console.log('PROBE ENV-095 2 calculation and mixed-method refusal: new actual-hours salaried worker -> old preparation and mixed election refused; corrected 160 method plus fresh complete-roster review -> both salaries 480 hours')

  // An exact notice correction makes every dependent capture stale. Re-reviewing
  // the corrected notice alone cannot relabel old hours or proposals.
  await data(notices, { ...firstNotice, version: 1, totalRate: '1.60', employeeRate: '0.35',
    documentText: 'Synthetic corrected employer notice: class 4902-00 total 1.60 employee maximum 0.35 for calendar 2026.' }, 201)
  await refused(door, consistent); await refused(door + '/' + expanded.id + '/review?version=2', undefined)
  await refused(notices + '/' + firstNotice.id + '/approve', { version: 1, reviewToken: noticeReview.reviewToken })
  await approve(data, notices + '/' + firstNotice.id)
  await refused(door, consistent)
  const correctedHours = hours({ version: 1, allocations: [allocation(false, { hours: '100', noticeVersion: 2 }), allocation(true, { hours: '40' })] })
  await data(personHours(hourly), correctedHours, 201); await reviewHours(hourly)
  await data(personHours(salaried), salary({ version: 1, allocations: [allocation(false, { noticeVersion: 2 })] }), 201); await reviewHours(salaried)
  await data(personHours(otherSalary), salary({ version: 2, allocations: [allocation(false, { noticeVersion: 2 })] }), 201); await reviewHours(otherSalary)
  const correctedWorkers = selection(workers).map(w => ({ ...w, version: w.personId === otherSalary.id ? 3 : 2 }))
  await data(elections, election([], { version: 2, workers: correctedWorkers.filter(w => w.personId !== hourly.id) }), 201); await reviewElection()
  const correctedInput = { ...input, version: 2, workers: correctedWorkers, electionVersion: 3 }
  const corrected = await data(door, correctedInput, 201)
  // 1060 hours x 1.60 + 40 x 2.25 = 1786; .35 x 1060 + .40 x 40 = 387; employer 1399.
  assert.deepEqual([corrected.result.totalPremiumCents, corrected.result.proposedEmployeeCents, corrected.result.employerRemainderCents], [178600, 38700, 139900])
  const history = await data(door)
  assert.deepEqual(history.map(h => h.current), [true, false, false])
  assert.equal(history[2].data.result.totalPremiumCents, 99000)
  assert.equal(history[2].data.result.rows.find(r => r.riskClass === '4902-00').totalRate, '1.50')
  assert.equal(history[0].data.result.rows.find(r => r.riskClass === '4902-00').noticeVersion, 2)
  await restart()
  assert.deepEqual((await data(door, correctedInput, 201)).result, corrected.result)

  // Full-month and fractional-hour calculations are independent notice goldens.
  const monthly = await data(personHours(salaried), salary({ ...month, version: 0, allocations: [allocation(false, { noticeVersion: 2 })] }), 201)
  assert.equal(monthly.version, 1)
  await approve(data, personHours(salaried) + '/' + evidenceId(salaried, month))
  await data(elections, election([salaried], { ...month, workers: [{ personId: salaried.id, version: 1 }] }), 201)
  await approve(data, elections + '/' + month.from + '-' + month.through)
  const monthlyPrepared = await data(door, { version: 0, ...month, workers: [{ personId: salaried.id, version: 1 }], electionVersion: 1 }, 201)
  assert.deepEqual(monthlyPrepared.result.rows.map(r => [r.hours, r.totalPremiumCents, r.proposedEmployeeCents, r.employerRemainderCents]), [['160', 25600, 5600, 20000]])

  await data(personHours(salaried), salary({ ...month, version: 1, method: 'actual', allocations: [allocation(false, { hours: '170', noticeVersion: 2 })] }), 201)
  await approve(data, personHours(salaried) + '/' + evidenceId(salaried, month))
  const overlap = await refused(elections, election([], { ...month, version: 1, method: 'actual', workers: [{ personId: salaried.id, version: 2 }] }))
  assert.equal(overlap.error, 'wa_li_mixed_salaried_methods', 'an all-actual monthly selection cannot conceal an overlapping assumed-hours quarterly election')
  await refused(door + '/' + monthlyPrepared.id + '/review?version=1', undefined)

  const foreign = await data('/api/envelope/companies', { name: 'Synthetic other Washington company', ein: '00-0009502' }, 201)
  await refused('/api/envelope/companies/' + foreign.id + '/wa-li/notices/' + firstNotice.id + '/review', undefined, 404)
  await refused('/api/envelope/companies/' + foreign.id + '/wa-li/hours/' + hourly.id, undefined, 404)
  await refused('/api/envelope/companies/' + foreign.id + '/wa-li/preparations', correctedInput, 404)
  await refused(door, undefined, 401, '')
  await refused(door, correctedInput, 403, cookie, { authorization: 'Bearer synthetic-envelope-wa-agent' })
  const owner = (await sql("SELECT id,operator_id,operator_version FROM oa_sessions WHERE revoked_at IS NULL AND operator_id IN (SELECT id FROM oa_operators WHERE role='owner') ORDER BY created_at LIMIT 1"))[0]
  const token = randomBytes(32).toString('base64url'), tokenHash = await hashToken(settings.SESSION_SECRET, 'session', token), now = Date.now()
  const member = 'synthetic-envelope-wa-member'
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${tokenHash}','${member}',1,'native',${now},${now + 3600000})`)
  await data(base + '/grants', { operatorId: member, version: 0, role: 'payroll-admin', locations: ['*'], fields: ['compensation', 'tax'], actions: ['records:read', 'rates:propose', 'rates:approve'] })
  await refused(door, undefined, 403, cookie.split('=')[0] + '=' + token)
  const ownerToken = randomBytes(32).toString('base64url'), ownerHash = await hashToken(settings.SESSION_SECRET, 'session', ownerToken)
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-wa-revoked','${ownerHash}','${owner.operator_id}',${owner.operator_version},'native',${now},${now + 3600000})`)
  const ownerCookie = cookie.split('=')[0] + '=' + ownerToken
  assert.equal((await call(notices, undefined, ownerCookie)).status, 200)
  await sql("UPDATE oa_sessions SET revoked_at=1 WHERE id='synthetic-envelope-wa-revoked'")
  for (const [path, body] of [[notices, undefined], [elections, undefined], [door, correctedInput], [base + '/calculation-preview', previewInput]]) await refused(path, body, 401, ownerCookie)

  // Held and erased sources cannot be recaptured or replayed, including shared derivatives.
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('synthetic-envelope-wa-proof','synthetic-envelope-wa-proof-hash','${owner.id}','${owner.operator_id}',${owner.operator_version},'credentials:mint','/app',${now},${now + 600000},${now})`)
  const privacy = base + '/people/' + hourly.id + '/privacy', inventory = await data(privacy)
  assert.ok(inventory.retained.some(r => r.key.kind === 'wa-li-hours'))
  assert.ok(inventory.retained.some(r => r.key.kind === 'wa-li-preparation'))
  assert.ok(!inventory.retained.some(r => r.key.kind === 'wa-li-notice'))
  await data(privacy + '/request', { fingerprint: inventory.fingerprint, consent: true })
  for (const [path, body] of [[notices, undefined], [elections, undefined], [door, undefined], [door, correctedInput], [personHours(hourly), correctedHours]]) await refused(path, body)
  const held = await data(privacy)
  const release = { fingerprint: held.fingerprint, records: held.retained.map(r => r.id), consent: true,
    legalBasis: 'Synthetic reviewed eligible local release.', custodian: 'Native owner', earliestReleaseAt: '2000-01-01T00:00:00.000Z' }
  await data(privacy + '/retain', release); await data(privacy + '/release', release)
  await data(base + '/people/' + hourly.id + '/erase', { version: held.version, ...release })
  await refused(personHours(hourly), correctedHours, 404); await refused(door, correctedInput, 404)
  assert.equal((await data(door)).some(h => h.id === prepared.id), false)
  assert.equal((await data(notices)).length, 3, 'employer notices survive one worker erasure')
  const ciphers = await sql("SELECT cipher FROM env_workspace_versions WHERE kind='wa-li-notice'")
  assert.ok(ciphers.length && ciphers.every(r => !r.cipher.includes(firstNotice.documentText)))
  assert.deepEqual(await business(), businessBefore, 'allowed preparation, correction, refusal and erasure leave payroll and payments unchanged')
  assert.equal(outboundCount(), outboundBefore)
  console.log('WA-LI passed: independently notice and WAC-derived amounts, exact notice and company binding, complete salaried election, source correction, immutable history, lost-response replay and restart, scoped refusals, privacy holds and erasure, no collected premiums or payment authority')
}

/** Actual archive custody and restored-authority refusal reuse the native archive journey. */
export async function waLiArchiveFixture(context, companyId) {
  const data = reader(native(context)), base = '/api/envelope/companies/' + companyId, wa = base + '/wa-li'
  const location = await data(base + '/locations', { name: 'Synthetic archived WA workplace', state: 'WA' }, 201)
  const worker = await data(base + '/people', { name: 'Synthetic archived WA worker', locationId: location.id }, 201)
  // Read the known synthetic fixture EIN through the test's own fixture contract.
  const input = notice(companyId, '00-0003101')
  await data(wa + '/notices', input, 201); await approve(data, wa + '/notices/' + input.id)
  await data(wa + '/hours/' + worker.id, hours({ allocations: [allocation(false, { hours: '10.5' })] }), 201)
  await approve(data, wa + '/hours/' + worker.id + '/' + evidenceId(worker))
  const request = capture([worker], { electionVersion: 0 }), prepared = await data(wa + '/preparations', request, 201)
  assert.deepEqual([prepared.result.totalPremiumCents, prepared.result.proposedEmployeeCents, prepared.result.employerRemainderCents], [1575, 315, 1260])
  return { companyId, door: wa + '/preparations', capture: request, result: prepared.result }
}
