import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { industryFixture, ordinaryFacts } from './industry-fixture.mjs'
import { claimsFixture } from './claims-fixture.mjs'
import { archiveAuthority } from './archive-authority.mjs'
import { archiveYearFixture } from './archive-year-fixture.mjs'

/** Real native business records; only the retained agency request is a source-edge fixture. */
export async function archiveFixture(context) {
  const payroll = industryFixture(context)
  const company = await payroll.company('Synthetic archive payroll employer', ['Synthetic archive payroll worker'])
  const person = company.people[0]
  await payroll.classify(company, person, ordinaryFacts)
  const check = await payroll.preview(company, person)
  await payroll.approve(company, person, 'industry-check', check.id)
  const checkBefore = await payroll.data(payroll.path(company, person))
  assert.ok(checkBefore.checks.some(row => row.id === check.id), 'a persisted calculated check exists before archiving')
  const year = await archiveYearFixture(payroll, company)
  const second = await payroll.company('Synthetic second annual employer', ['Synthetic second annual worker'])
  await payroll.classify(second, second.people[0], ordinaryFacts)
  const secondYear = await archiveYearFixture(payroll, second)

  const capture = JSON.parse(await readFile(new URL('./fixtures/sides/willow-native-capture.json', import.meta.url)))
  capture.originals = Object.fromEntries(Object.entries(capture.originals).map(([key, value]) =>
    [key, { filename: value.filename, bytes: Buffer.from(value.base64, 'base64') }]))
  capture.manifest = JSON.parse(capture.originals.manifest.bytes)
  capture.recordsText = capture.originals.records.bytes.toString()
  capture.audit = JSON.parse(capture.originals.audit.bytes)
  const claims = await claimsFixture(context, { willow: capture })
  const claim = await claims.data(claims.claims + '/import', claims.validRequest(), 201)
  const door = claims.claims + '/' + claim.id
  await claims.data(door + '/evidence', claims.evidence(claim.version))
  let retained = await claims.data(door)
  await claims.data(door + '/prepare', claims.prepare(retained.version))
  retained = await claims.data(door)
  assert.equal(retained.data.status, 'ready-for-review', 'the original Willow and payroll evidence support a retained response')
  const notice = await payroll.data(company.base + '/notices', {
    reference: 'synthetic-envelope-archive-notice', locationId: company.location.id,
    body: 'Synthetic retained agency notice. Payroll officer must investigate the assessed period.',
  }, 201)
  const authority = await archiveAuthority(context, company, notice)
  const unused = await payroll.data(company.base + '/people', { name: 'Synthetic unused archive worker', locationId: company.location.id }, 201)
  return { companies: [company.id, second.id, claims.company.id], years: [year, secondYear], checkId: check.id,
    claimId: claim.id, noticeId: notice.id, unusedId: unused.id, retainedPersonId: person.id, authority, privateValue: '900-69-0001' }
}
