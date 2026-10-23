import { classifyIndustryWorker, validDate, validateEvidence } from './classification'
import { federalIncomeTax, roundRatio, safeNumber, validCents, validateW4, withholdingSource } from './federal-withholding'
import type { FederalSource, IndustryPayInput, IndustryPayResult, TaxYear } from './types'

function rate(cents: number, basisPoints: number): number {
  return roundRatio(BigInt(cents) * BigInt(basisPoints),10000n)
}
function sum(...values: number[]): number {
  return safeNumber(values.reduce((total,value) => total + BigInt(value),0n))
}

/** One worker, one actual regular pay period, one EIN; cents are rounded half up. */
export function calculateIndustryPay(input: IndustryPayInput): IndustryPayResult {
  if (!input || !validDate(input.payDate) || !['2025','2026'].includes(input.payDate.slice(0,4)) ||
      ![input.cashGrossCents,input.housingAllowanceCents,input.shareholderHealthInsuranceCents].every(validCents) ||
      input.housingAllowanceCents > input.cashGrossCents || ![1,2,4,12,24,26,52,260].includes(input.periodsPerYear) ||
      !input.yearToDate || ![input.yearToDate.socialSecurityWagesCents,input.yearToDate.medicareWagesCents,input.yearToDate.futaWagesCents].every(validCents))
    throw new Error('invalid_industry_pay_input')
  validateW4(input.w4)
  if (input.facts?.taxResidency === 'nonresident' && input.w4.filingStatus !== 'single')
    throw new Error('nonresident_w4_requires_single_status')
  const taxYear = Number(input.payDate.slice(0,4)) as TaxYear
  const classification = classifyIndustryWorker(input.facts,input.payDate)
  if (input.housingAllowanceCents && !input.facts.claims.some(claim => claim.kind === 'minister_housing'))
    throw new Error('housing_allowance_requires_reviewed_minister_designation')
  if (input.shareholderHealthInsuranceCents && !classification.healthBenefitTreatment)
    throw new Error('shareholder_health_benefit_requires_reviewed_qualifying_plan')
  for (const claim of input.facts.claims) {
    if ((claim.kind === 'farm_small_wages' || claim.kind === 'farm_hand_harvest') && claim.annualWorkerCashWagesCents < input.cashGrossCents)
      throw new Error('farm_annual_cash_wages_less_than_current_payment')
    if (claim.kind === 'nonprofit_small_wages' &&
        (claim.annualWorkerWagesCents < input.cashGrossCents || claim.quarterWorkerWagesCents < input.cashGrossCents))
      throw new Error('nonprofit_aggregate_wages_less_than_current_payment')
  }
  if (input.housingAllowanceCents && !validCents(input.yearToDate.housingExcludedCents))
    throw new Error('housing_year_to_date_exclusion_required')
  const excludedHousing = Math.min(input.housingAllowanceCents,
    Math.max(0,classification.housingExcludedCents - (input.yearToDate.housingExcludedCents ?? 0)))
  classification.housingExcludedCents = excludedHousing
  const healthIncome = classification.shareholderHealth ? input.shareholderHealthInsuranceCents : 0
  const groupTermLife = classification.groupTermLifeWagesCents
  const box1 = sum(input.cashGrossCents - excludedHousing,healthIncome,groupTermLife)
  // Group-term life is reportable income but is not subject to mandatory FIT withholding.
  const incomeTaxWagesCents = classification.subject.incomeTax ? sum(input.cashGrossCents - excludedHousing,healthIncome) : 0
  const ssCap = taxYear === 2026 ? 18450000 : 17610000
  const ficaCompensation = sum(input.cashGrossCents,groupTermLife)
  const socialSecurityWagesCents = classification.subject.socialSecurity ? Math.min(ficaCompensation,Math.max(0,ssCap - input.yearToDate.socialSecurityWagesCents)) : 0
  const medicareWagesCents = classification.subject.medicare ? ficaCompensation : 0
  const additionalMedicareWagesCents = Math.min(medicareWagesCents,Math.max(0,sum(input.yearToDate.medicareWagesCents,medicareWagesCents) - 20000000))
  const futaWagesCents = classification.subject.futa ? Math.min(input.cashGrossCents,Math.max(0,700000 - input.yearToDate.futaWagesCents)) : 0
  let credit = 0
  if (input.futaCredit !== undefined) {
    validateEvidence(input.futaCredit,input.payDate)
    if (input.futaCredit.basis !== 'timely_state_tax_same_wages' || !Number.isInteger(input.futaCredit.creditBasisPoints) ||
        input.futaCredit.creditBasisPoints < 0 || input.futaCredit.creditBasisPoints > 540)
      throw new Error('invalid_documented_futa_credit')
    credit = input.futaCredit.creditBasisPoints
  }
  const withholding = classification.subject.incomeTax ? federalIncomeTax({
    taxYear,taxableWagesCents:incomeTaxWagesCents,periodsPerYear:input.periodsPerYear,
    w4:input.w4,nonresidentAdjustment:classification.nonresidentAdjustment,
  }) : {incomeTaxCents:0,adjustedAnnualWagesCents:0,nonresidentAdjustmentCents:0,sourceId:withholdingSource(taxYear).id}
  const employeeTaxes = {
    incomeTaxCents:withholding.incomeTaxCents,socialSecurityCents:rate(socialSecurityWagesCents,620),
    medicareCents:rate(medicareWagesCents,145),additionalMedicareCents:rate(additionalMedicareWagesCents,90),
  }
  const employerTaxes = {
    socialSecurityCents:rate(socialSecurityWagesCents,620),medicareCents:rate(medicareWagesCents,145),
    futaCents:rate(futaWagesCents,600 - credit),
  }
  const totalEmployeeTaxCents = sum(...Object.values(employeeTaxes))
  const totalEmployerTaxCents = sum(...Object.values(employerTaxes))
  if (totalEmployeeTaxCents > input.cashGrossCents) throw new Error('industry_cash_insufficient_for_regular_wage_withholding')
  const payrollSource: FederalSource = {
    id:`irs-p15-${taxYear}`,title:`IRS Publication 15 (${taxYear})`,
    url:taxYear === 2025 ? 'https://www.irs.gov/pub/irs-prior/p15--2025.pdf' : 'https://www.irs.gov/pub/irs-pdf/p15.pdf',
    section:'Sections 9 and 14: Social Security wage base, Medicare, Additional Medicare and FUTA',
  }
  const limitations = [
    'Federal regular cash-wage calculation only. State and local taxes, deductions, tips, other fringe benefits, supplemental flat-rate wages and payment authorization are separate.',
    'Form assignment is the federal wage bucket, not filing or agency acceptance. IRS-assigned Form 944 employers require their separate return election.',
    'FUTA credit uses only supplied reviewed evidence. Annual final state credit reductions and Form 940 reconciliation remain separate; no current-year final reduction is invented.',
  ]
  if (!input.futaCredit && futaWagesCents) limitations.push('No reviewed state unemployment credit supplied: FUTA computed at the gross 6% rate, not an assumed 0.6%.')
  if (input.facts.claims.some(claim => claim.kind.startsWith('farm_')))
    limitations.push('A later farm annual threshold crossing requires review of earlier payments and any catch-up withholding or amendments; this check does not silently rewrite prior checks.')
  if (input.facts.claims.some(claim => claim.kind === 'h2a'))
    limitations.push('H-2A evidence records a furnished TIN; missing-TIN backup withholding and Form 945 require a separate documented calculation and are refused by this classification.')
  return {
    payDate:input.payDate,taxYear,cashGrossCents:input.cashGrossCents,noncashBenefitCents:sum(input.shareholderHealthInsuranceCents,groupTermLife),
    netCashCents:input.cashGrossCents - totalEmployeeTaxCents,totalEmployeeTaxCents,totalEmployerTaxCents,
    wages:{incomeTaxWagesCents,w2Box1WagesCents:box1,socialSecurityWagesCents,medicareWagesCents,additionalMedicareWagesCents,futaWagesCents},
    employeeTaxes,employerTaxes,withholding:{adjustedAnnualWagesCents:withholding.adjustedAnnualWagesCents,
      nonresidentAdjustmentCents:withholding.nonresidentAdjustmentCents,sourceId:withholding.sourceId},
    classification,formAssignment:classification.formAssignment,
    sources:[...classification.sources,withholdingSource(taxYear),payrollSource],limitations,
  }
}

/** A reviewable amendment impact, never an automatic refund, collection or filing. */
export function compareIndustryPay(before: IndustryPayResult, after: IndustryPayResult) {
  if (before.payDate !== after.payDate || before.taxYear !== after.taxYear)
    throw new Error('industry_amendment_requires_same_payment_date')
  const differences = <T extends Record<string,number>>(oldValues: T,newValues: T): T =>
    Object.fromEntries(Object.keys(oldValues).map(key => [key,newValues[key] - oldValues[key]])) as T
  const wages = differences(before.wages,after.wages)
  const employeeTaxes = differences(before.employeeTaxes,after.employeeTaxes)
  const employerTaxes = differences(before.employerTaxes,after.employerTaxes)
  const changed = before.formAssignment !== after.formAssignment ||
    [...Object.values(wages),...Object.values(employeeTaxes),...Object.values(employerTaxes)].some(amount => amount !== 0)
  return {
    changed,originalForm:before.formAssignment,correctedForm:after.formAssignment,wages,employeeTaxes,employerTaxes,
    netCashDifferenceCents:after.netCashCents - before.netCashCents,
    reviewRequired:changed,
    consequences:changed ? [
      'Review the original filed period, actual tax collections, employee consent and repayment rules before preparing Form 941-X or 943-X and any W-2c.',
      ...(before.formAssignment !== after.formAssignment ? ['Agricultural wage reassignment affects both original and corrected form buckets; reconcile both returns.'] : []),
      'Prior-year FIT withholding generally cannot be refunded by payroll absent an administrative error; this comparison does not authorize a tax correction.',
    ] : [],
  }
}
