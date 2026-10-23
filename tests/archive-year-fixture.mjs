import assert from 'node:assert/strict'
import { ordinaryFacts, ordinaryW4 } from './industry-fixture.mjs'

/** A full prepared year with reviewed federal calculations, never wage settlement. */
export async function archiveYearFixture(payroll, company) {
  assert.equal(company.year, 2026)
  const person = company.people[0], groupId = company.run.preview.groupId
  assert.ok(groupId, 'the existing reviewed earnings run identifies its payroll group')
  const periods = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    return { month, periodStart: `2026-${month}-01`,
      periodEnd: new Date(Date.UTC(2026, index + 1, 0)).toISOString().slice(0, 10) }
  })
  // Freeze all work inputs before any run captures the complete source collection.
  for (const [index, period] of periods.entries()) {
    await payroll.data(company.base + '/people/' + person.id + '/allocations/work', {
      id: 'synthetic-envelope-' + (860101 + index), version: 0,
      day: `2026-${period.month}-05`, state: 'TX', locality: 'Austin',
      minutes: 480, earnedCents: 100000, officeState: 'TX', nyReason: 'not-applicable',
      sourceRef: 'synthetic-envelope-' + (860401 + index),
    }, 201)
  }
  const monthlyChecks = [], runs = []
  let priorGrossCents = 0
  for (const [index, period] of periods.entries()) {
    const run = await payroll.data(company.base + '/pay-settings/earnings-run', {
      id: 'synthetic-envelope-' + (860201 + index), version: 0, groupId,
      periodStart: period.periodStart, periodEnd: period.periodEnd,
      payDate: period.periodEnd, frequency: 'monthly',
    }, 201)
    const expectedGrossCents = period.month === '10' ? 200000 : 100000
    assert.equal(run.preview.people.find(row => row.id === person.id).earningsCents, expectedGrossCents,
      'each monthly run calculates the sourced hours, including the existing October work')
    const yearToDate = { socialSecurityWagesCents: priorGrossCents,
      medicareWagesCents: priorGrossCents, futaWagesCents: priorGrossCents }
    const check = await payroll.preview({ ...company, run }, person, {
      id: 'synthetic-envelope-' + (860301 + index), yearToDate,
      yearToDateEvidence: `Prepared 2026 monthly register through ${index ? periods[index - 1].periodEnd : 'opening balance'}; prior gross ${priorGrossCents} cents. No wage settlement is asserted.`,
    })
    assert.deepEqual(check.data.input.yearToDate, yearToDate)
    assert.equal(check.data.result.cashGrossCents, expectedGrossCents)
    assert.equal(check.data.corrects, '')
    await payroll.approve(company, person, 'industry-check', check.id)
    monthlyChecks.push(check); runs.push(run)
    priorGrossCents += check.data.result.cashGrossCents
  }
  const before = await payroll.data(payroll.path(company, person))
  for (const check of monthlyChecks) {
    const retained = before.checks.find(row => row.id === check.id)
    assert.ok(retained.approvedBy, 'each retained monthly calculation has exact human approval')
    assert.ok(retained.sourcesCurrent, 'all monthly calculations retain the same frozen work collection')
  }
  const original = before.checks.find(row => row.id === monthlyChecks[9].id)
  const returns = company.base + '/industry-returns'
  const formInput = check => ({ id: 'synthetic-envelope-860601', version: 0, form: '941', taxYear: 2026, quarter: 4,
    checks: [{ personId: person.id, id: check.id, version: check.version }],
    address: { street: '100 Main Street', city: 'Austin', state: 'TX', postalCode: '78701' },
    employeeCount: 0, depositsCents: 0, basis: 'Prepared October monthly register; no collection or filing is asserted.' })
  const approveReturn = async id => {
    const review = await payroll.data(returns + '/' + id + '/review')
    await payroll.data(returns + '/' + id + '/decision', { version: review.version, reviewToken: review.reviewToken })
  }
  const originalReturn = await payroll.data(returns, formInput(original), 201)
  await approveReturn(originalReturn.id)
  await payroll.classify(company, person, ordinaryFacts, {
    version: 1, w4: { ...ordinaryW4, step4cExtraWithholdingCents: 2500 },
  })
  const correction = await payroll.preview({ ...company, run: runs[9] }, person, {
    id: 'synthetic-envelope-860501', corrects: original.id,
    correctionReason: 'Reviewed corrected W-4 adds 2500 cents of withholding to this prepared October calculation; no payment or filing is asserted.',
    yearToDate: original.data.input.yearToDate,
    yearToDateEvidence: original.data.yearToDateEvidence,
  })
  await payroll.approve(company, person, 'industry-check', correction.id)
  const after = await payroll.data(payroll.path(company, person))
  const retainedOriginal = after.checks.find(row => row.id === original.id)
  const retainedCorrection = after.checks.find(row => row.id === correction.id)
  assert.deepEqual(retainedOriginal.data, original.data, 'the correction never rewrites the approved original')
  assert.ok(retainedOriginal.approvedBy && retainedCorrection.approvedBy)
  assert.equal(retainedCorrection.data.corrects, original.id)
  assert.equal(retainedCorrection.data.classificationVersion, original.data.classificationVersion + 1)
  assert.equal(retainedCorrection.data.result.employeeTaxes.incomeTaxCents - original.data.result.employeeTaxes.incomeTaxCents, 2500)
  assert.equal(retainedCorrection.data.amendment.netCashDifferenceCents, -2500)
  assert.equal(retainedCorrection.data.amendment.changed, true)
  const correctedReturn = await payroll.data(returns, { ...formInput(retainedCorrection), id: 'synthetic-envelope-860602',
    corrects: originalReturn.id, discoveredOn: '2026-11-02', reason: 'Reviewed corrected W-4 in prepared October register.',
    process: 'adjustment', w2FiledOrWillFile: true, certifications: [] }, 201)
  await approveReturn(correctedReturn.id)
  const returnHistory = await payroll.data(returns)
  assert.equal(returnHistory.find(row => row.id === correctedReturn.id).data.corrects, originalReturn.id)
  assert.ok(returnHistory.find(row => row.id === originalReturn.id).approvedBy, 'original return review remains retained')
  return { monthlyChecks, originalReturnId: originalReturn.id, correctedReturnId: correctedReturn.id, correctionId: correction.id, originalId: original.id, correction: retainedCorrection }
}
