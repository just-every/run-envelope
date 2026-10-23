import type { FederalSource, FederalTax, IndustryClassification, IndustryFacts, ReviewedEvidence } from './types'
import { validCents } from './federal-withholding'

export const classificationSources: FederalSource[] = [
  { id:'irs-p15',title:'IRS Publication 15',url:'https://www.irs.gov/publications/p15',section:'Sections 2, 3, 5, 9, 14 and 15: employees; family; agriculture; employment tax exceptions' },
  { id:'irs-nonprofit',title:'IRS exempt organization employment tax exceptions',url:'https://www.irs.gov/charities-non-profits/charitable-organizations/employment-tax-exceptions-and-exclusions-for-exempt-organizations',section:'501(c)(3) FUTA; ministerial services; elected church FICA exclusion' },
  { id:'irs-clergy',title:'IRS Publication 517',url:'https://www.irs.gov/publications/p517',section:'Ministerial services, SECA coverage, housing and voluntary withholding' },
  { id:'irs-housing',title:'IRS minister compensation and housing allowance',url:'https://www.irs.gov/faqs/interest-dividends-other-types-of-income/ministers-compensation-housing-allowance/ministers-compensation-housing-allowance',section:'Advance designation; least of designation, actual expenses and fair rental value' },
  { id:'irs-scorp-health',title:'IRS S corporation compensation and medical insurance',url:'https://www.irs.gov/businesses/small-businesses-self-employed/s-corporation-compensation-and-medical-insurance-issues',section:'Greater than 2 percent shareholder health insurance: FIT inclusion; conditional FICA and FUTA exclusion' },
  { id:'irs-nra',title:'IRS Publication 519',url:'https://www.irs.gov/publications/p519',section:'Students and exchange visitors; authorized services; tax residency' },
  { id:'irs-student',title:'IRS student exception to FICA',url:'https://www.irs.gov/charities-non-profits/student-exception-to-fica-tax',section:'Enrolled school employment and education predominant; Revenue Procedure 2005-11 safe harbor' },
  { id:'irs-family',title:'IRS family employees',url:'https://www.irs.gov/businesses/small-businesses-self-employed/family-employees',section:'Child under 18 FICA; child under 21 FUTA; sole proprietor spouse and parent FUTA; corporation comparison' },
  { id:'irs-p15a',title:'IRS Publication 15-A',url:'https://www.irs.gov/publications/p15a',section:'Section 3: nonprofit $100 annual FICA and $50 quarterly FUTA exceptions; section 4: ministers' },
  { id:'irs-p15b',title:'IRS Publication 15-B',url:'https://www.irs.gov/publications/p15b',section:'Accident and health benefits; group-term life insurance; shareholder distinction' },
  { id:'irs-student-safe-harbor',title:'IRS Revenue Procedure 2005-11',url:'https://www.irs.gov/irb/2005-02_IRB#RP-2005-11',section:'Student services, professional employees and school breaks of five weeks or less' },
]

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value
}

export function validateEvidence(evidence: ReviewedEvidence, payDate: string, requireReview = true): void {
  if (!evidence || typeof evidence.documentId !== 'string' || !evidence.documentId.trim() ||
      (requireReview && (typeof evidence.reviewedBy !== 'string' || !evidence.reviewedBy.trim() ||
      typeof evidence.reviewedAt !== 'string' || !Number.isFinite(Date.parse(evidence.reviewedAt)))) ||
      !validDate(evidence.effectiveFrom) || !validDate(evidence.effectiveThrough) ||
      evidence.effectiveFrom > evidence.effectiveThrough)
    throw new Error('industry_evidence_review_required')
  if (payDate < evidence.effectiveFrom || payDate > evidence.effectiveThrough)
    throw new Error('industry_evidence_not_effective_on_pay_date')
}

function ageOn(birthDate: string | undefined, payDate: string): number {
  if (!validDate(birthDate) || birthDate > payDate) throw new Error('family_birth_date_required')
  return Number(payDate.slice(0,4)) - Number(birthDate.slice(0,4)) -
    (payDate.slice(5) < birthDate.slice(5) ? 1 : 0)
}

/** Classifies direct employment by this EIN. A label alone never grants an exclusion. */
export function classifyIndustryWorker(facts: IndustryFacts, payDate: string, options: { requireReview?: boolean } = {}): IndustryClassification {
  if (!validDate(payDate) || !['2025','2026'].includes(payDate.slice(0,4))) throw new Error('unsupported_industry_tax_year')
  if (!facts || !['business','farm','nonprofit','church','school'].includes(facts.employerKind) ||
      !['sole_proprietor','partnership','corporation','s_corporation','nonprofit'].includes(facts.entityType) ||
      !['employee','corporate_officer','sole_proprietor','partner','distribution'].includes(facts.workerRole) ||
      !['agricultural','nonagricultural'].includes(facts.workKind) || typeof facts.seasonal !== 'boolean' ||
      !['resident','nonresident'].includes(facts.taxResidency) || !Array.isArray(facts.claims))
    throw new Error('invalid_industry_classification')
  if (['sole_proprietor','partner','distribution'].includes(facts.workerRole))
    throw new Error('owner_draw_partner_payment_or_distribution_is_not_employee_payroll')
  if (facts.workerRole === 'corporate_officer' && !['corporation','s_corporation','nonprofit'].includes(facts.entityType))
    throw new Error('corporate_officer_requires_corporate_employer')
  if (facts.workKind === 'agricultural' && facts.employerKind !== 'farm')
    throw new Error('agricultural_wages_require_farm_classification')
  if (facts.birthDate !== undefined && (!validDate(facts.birthDate) || facts.birthDate > payDate))
    throw new Error('invalid_industry_birth_date')

  const result: IndustryClassification = {
    formAssignment: facts.workKind === 'agricultural' ? '943' : '941',
    subject: { incomeTax:true,socialSecurity:true,medicare:true,futa:true }, exclusions:[],reasons:[],
    housingExcludedCents:0,shareholderHealth:false,healthBenefitTreatment:null,groupTermLifeWagesCents:0,
    nonresidentAdjustment:facts.taxResidency === 'nonresident',
    voluntaryWithholding:false,selfEmploymentNotice:null,sources:[],
  }
  const usedSources = new Set(['irs-p15'])
  const kinds = new Set<string>()
  for (const claim of facts.claims) {
    validateEvidence(claim,payDate,options.requireReview !== false)
    if (['farm_small_wages','farm_hand_harvest','farm_futa_threshold'].includes(claim.kind) &&
        (claim.effectiveFrom.slice(0,4) !== payDate.slice(0,4) || claim.effectiveThrough.slice(0,4) !== payDate.slice(0,4)))
      throw new Error('farm_annual_threshold_evidence_must_be_tax_year_specific')
    if (kinds.has(claim.kind)) throw new Error('duplicate_industry_claim')
    kinds.add(claim.kind)
  }
  const exclude = (taxes: FederalTax[], reason: string, sourceId: string, documentId: string) => {
    usedSources.add(sourceId)
    for (const tax of taxes) {
      result.subject[tax] = false
      result.exclusions.push({tax,reason,sourceId,documentId})
    }
  }
  const requireFarm = () => {
    if (facts.employerKind !== 'farm' || facts.workKind !== 'agricultural')
      throw new Error('agricultural_exclusion_cannot_cover_office_wages')
  }
  for (const claim of facts.claims) {
    switch (claim.kind) {
      case 'nonprofit_501c3':
        if (claim.determination !== '501c3' || facts.entityType !== 'nonprofit' ||
            !['nonprofit','church','school'].includes(facts.employerKind)) throw new Error('501c3_employer_basis_required')
        exclude(['futa'],'Direct wages of a documented section 501(c)(3) employer.','irs-nonprofit',claim.documentId)
        break
      case 'h2a':
        requireFarm()
        if (claim.immigrationStatus !== 'H-2A' || claim.services !== 'authorized_agricultural_labor' || claim.tinStatus !== 'provided')
          throw new Error('authorized_h2a_agricultural_services_required')
        exclude(['incomeTax','socialSecurity','medicare','futa'],'Authorized H-2A agricultural wages; FIT withholding requires a separate voluntary agreement.','irs-p15',claim.documentId)
        break
      case 'minister':
        if (facts.employerKind !== 'church' || claim.services !== 'exercise_of_ministry' ||
            !['ordained','commissioned','licensed'].includes(claim.credential)) throw new Error('documented_ministerial_services_required')
        exclude(['incomeTax','socialSecurity','medicare','futa'],'Qualified ministerial services; FIT is voluntary and FICA is replaced by separate SECA treatment.','irs-clergy',claim.documentId)
        result.selfEmploymentNotice = 'Ministerial income, including housing, may be subject to individual SECA; no SECA exemption or payment is calculated here.'
        break
      case 'minister_housing': {
        if (!kinds.has('minister') || !validDate(claim.designatedBeforePayment) || claim.designatedBeforePayment >= payDate ||
            claim.annualReconciliation !== 'current_year_allocations' ||
            ![claim.designatedCents,claim.actualHousingExpensesCents,claim.fairRentalValueIncludingUtilitiesCents,claim.reasonableCompensationCents].every(validCents))
          throw new Error('advance_minister_housing_designation_and_limits_required')
        result.housingExcludedCents = Math.min(claim.designatedCents,claim.actualHousingExpensesCents,claim.fairRentalValueIncludingUtilitiesCents,claim.reasonableCompensationCents)
        usedSources.add('irs-housing')
        result.reasons.push('Housing limits are reviewed current-year totals for designation, expenses, fair rental value and reasonable compensation; prior excluded housing must be subtracted and annual excess reconciled.')
        break
      }
      case 'church_8274':
        if (facts.employerKind !== 'church' || claim.election !== 'filed_8274' || claim.churchOpposesInsurance !== 'religious_principle' ||
            !validDate(claim.filedOn) || !validDate(claim.firstEmploymentReturnDue) ||
            claim.filedOn >= claim.firstEmploymentReturnDue)
          throw new Error('effective_church_8274_election_required')
        exclude(['socialSecurity','medicare'],'Documented effective Form 8274 church election.','irs-nonprofit',claim.documentId)
        result.selfEmploymentNotice = 'Church employees under the Form 8274 election may owe individual SECA; it is not calculated or declared exempt.'
        break
      case 's_corp_health':
        if (facts.entityType !== 's_corporation' || typeof claim.ownershipPercent !== 'number' ||
            !Number.isFinite(claim.ownershipPercent) || claim.ownershipPercent < 0 || claim.ownershipPercent > 100 ||
            claim.benefit !== 'employer_paid_accident_health' || !['employees_generally','class_of_employees'].includes(claim.planCoverage))
          throw new Error('s_corp_health_plan_and_ownership_basis_required')
        result.shareholderHealth = claim.ownershipPercent > 2
        result.healthBenefitTreatment = result.shareholderHealth ? 'greater_than_two_percent_fit' : 'ordinary_excluded'
        usedSources.add('irs-scorp-health')
        result.reasons.push(result.shareholderHealth ? 'Employer paid shareholder health premiums enter FIT wages; a qualifying employee plan excludes only the premiums from FICA and FUTA, leaving cash salary subject.' : 'Ownership of exactly 2 percent or less retains the ordinary qualifying health exclusion; cash salary remains subject.')
        break
      case 'employee_health':
        if (facts.entityType === 's_corporation' || claim.benefit !== 'employer_paid_accident_health' ||
            !['employees_generally','class_of_employees'].includes(claim.planCoverage) || kinds.has('s_corp_health'))
          throw new Error('ordinary_employee_health_plan_basis_required')
        result.healthBenefitTreatment = 'ordinary_excluded'
        usedSources.add('irs-p15b')
        result.reasons.push('Ordinary qualifying employer paid health premiums are excluded from all four federal wage bases; cash salary remains subject.')
        break
      case 'group_term_life':
        if (facts.entityType !== 's_corporation' || typeof claim.ownershipPercent !== 'number' ||
            !Number.isFinite(claim.ownershipPercent) || claim.ownershipPercent <= 2 || claim.ownershipPercent > 100 ||
            claim.benefit !== 'employer_paid_group_term_life' ||
            ![claim.employerPremiumCents,claim.employeeAfterTaxContributionCents].every(validCents))
          throw new Error('greater_than_two_percent_group_term_life_cost_required')
        result.groupTermLifeWagesCents = Math.max(0,claim.employerPremiumCents - claim.employeeAfterTaxContributionCents)
        usedSources.add('irs-p15b')
        result.reasons.push('Greater than 2 percent shareholder group-term life cost enters W-2 boxes 1, 3 and 5; mandatory FIT withholding and FUTA exclude that cost.')
        break
      case 'nonprofit_small_wages': {
        const quarter = Math.floor((Number(payDate.slice(5,7)) - 1) / 3) + 1
        if (facts.entityType !== 'nonprofit' || !['nonprofit','church','school'].includes(facts.employerKind) ||
            !['501a','521','501c3'].includes(claim.incomeTaxExemption) || claim.organization !== 'operating_nonprofit' ||
            ![claim.annualWorkerWagesCents,claim.quarterWorkerWagesCents].every(validCents) ||
            claim.quarterWorkerWagesCents > claim.annualWorkerWagesCents || claim.quarter !== quarter ||
            claim.effectiveFrom.slice(0,4) !== payDate.slice(0,4) || claim.effectiveThrough.slice(0,4) !== payDate.slice(0,4))
          throw new Error('nonprofit_small_wage_period_and_status_basis_required')
        if (claim.annualWorkerWagesCents < 10000)
          exclude(['socialSecurity','medicare'],'Income-tax-exempt operating nonprofit paid this employee less than $100 for the calendar year.','irs-p15a',claim.documentId)
        if (claim.incomeTaxExemption === '501c3' || claim.quarterWorkerWagesCents < 5000)
          exclude(['futa'],claim.incomeTaxExemption === '501c3' ? 'Section 501(c)(3) direct employment.' : 'Other qualifying income-tax-exempt nonprofit paid this employee less than $50 this quarter.','irs-p15a',claim.documentId)
        result.reasons.push('Nonprofit wage thresholds do not exempt FIT; reaching $100 annually or $50 quarterly requires review of the full affected wage base.')
        break
      }
      case 'nonresident_fjmq':
        if (facts.taxResidency !== 'nonresident' || !['F-1','J-1','M-1','Q-1'].includes(claim.immigrationStatus) ||
            claim.services !== 'authorized_status_purpose') throw new Error('nonresident_authorized_fjmq_basis_required')
        exclude(['socialSecurity','medicare','futa'],'Nonresident F, J, M or Q services authorized for the purpose of admission; FIT remains separate.','irs-nra',claim.documentId)
        break
      case 'school_student':
        if (facts.employerKind !== 'school' || claim.employerIsEnrolledSchool !== true || claim.enrollment !== 'at_least_half_time' ||
            claim.relationship !== 'education_predominates' || claim.professionalEmployee !== false ||
            claim.socialSecurityCoverage !== 'no_section_218_coverage' ||
            typeof claim.scheduledWeeklyHours !== 'number' || !Number.isFinite(claim.scheduledWeeklyHours) ||
            claim.scheduledWeeklyHours < 0 || claim.scheduledWeeklyHours >= 40)
          throw new Error('qualifying_school_student_relationship_required')
        if (!['class_session','short_break'].includes(claim.attendance)) throw new Error('student_attendance_period_required')
        if (claim.attendance === 'short_break') {
          if (!validDate(claim.breakFrom) || !validDate(claim.breakThrough) || claim.breakFrom > claim.breakThrough ||
              payDate < claim.breakFrom || payDate > claim.breakThrough ||
              (Date.parse(claim.breakThrough) - Date.parse(claim.breakFrom)) / 86400000 + 1 > 35 ||
              claim.qualifiedBeforeBreak !== true || claim.eligibleFollowingTerm !== true)
            throw new Error('student_break_exceeds_five_week_safe_harbor_or_enrollment_unproved')
          usedSources.add('irs-student-safe-harbor')
        }
        exclude(['socialSecurity','medicare','futa'],'Student employed by the school attended, under the documented student relationship and safe harbor.','irs-student',claim.documentId)
        break
      case 'family_employment': {
        if (!['child','spouse','parent'].includes(claim.relationship)) throw new Error('invalid_family_relationship')
        const child = claim.relationship === 'child'
        const eligible = facts.entityType === 'sole_proprietor' ||
          (facts.entityType === 'partnership' && child && claim.allPartnersAreParents === true)
        if (!eligible) {
          result.reasons.push('Family relationship does not exempt wages paid by this corporation or nonqualifying partnership.')
          break
        }
        usedSources.add('irs-family')
        const age = child ? ageOn(facts.birthDate,payDate) : null
        if (child && age! < 18) exclude(['socialSecurity','medicare'],'Child under 18 working in the parent sole proprietorship or all-parent partnership.','irs-family',claim.documentId)
        if (!child || age! < 21) exclude(['futa'],child ? 'Eligible child under 21.' : 'Sole proprietor employs their spouse or parent.','irs-family',claim.documentId)
        result.reasons.push('Family trade or business wages remain subject to FIT; age is measured on the payment date.')
        break
      }
      case 'farm_small_wages':
        requireFarm()
        if (!validCents(claim.annualWorkerCashWagesCents) || !validCents(claim.annualEmployerFarmWagesCents) ||
            claim.annualWorkerCashWagesCents >= 15000 || claim.annualEmployerFarmWagesCents >= 250000 ||
            claim.annualWorkerCashWagesCents > claim.annualEmployerFarmWagesCents)
          throw new Error('farm_150_and_2500_threshold_exclusion_not_met')
        exclude(['incomeTax','socialSecurity','medicare'],'Farm cash wages below both the worker $150 and employer $2,500 annual tests.','irs-p15',claim.documentId)
        break
      case 'farm_hand_harvest':
        requireFarm()
        if (!validCents(claim.annualWorkerCashWagesCents) || claim.annualWorkerCashWagesCents >= 15000 ||
            claim.work !== 'hand_harvest' || claim.pay !== 'regional_customary_piece_rate' || claim.commute !== 'daily_from_permanent_home' ||
            !Number.isInteger(claim.priorYearAgriculturalWeeks) || claim.priorYearAgriculturalWeeks < 0 || claim.priorYearAgriculturalWeeks >= 13)
          throw new Error('seasonal_hand_harvest_conditions_not_met')
        exclude(['incomeTax','socialSecurity','medicare'],'Qualifying seasonal hand-harvest worker below the $150 individual annual cash threshold.','irs-p15',claim.documentId)
        break
      case 'farm_futa_threshold': {
        requireFarm()
        const year = Number(payDate.slice(0,4))
        if (!validCents(claim.highestQuarterCashWagesCents) || claim.highestQuarterCashWagesCents >= 2000000 ||
            !Number.isInteger(claim.weeksWithTenWorkers) || claim.weeksWithTenWorkers < 0 || claim.weeksWithTenWorkers >= 20 ||
            !Array.isArray(claim.testedYears) || claim.testedYears.length !== 2 || claim.testedYears[0] !== year - 1 || claim.testedYears[1] !== year)
          throw new Error('farm_futa_current_and_prior_year_thresholds_not_met')
        exclude(['futa'],'Both current and prior year farm FUTA employer tests are below $20,000 quarterly cash and ten workers in twenty weeks; H-2A wages and workers count in these tests.','irs-p15',claim.documentId)
        break
      }
      case 'business_futa_threshold': {
        const year = Number(payDate.slice(0,4))
        if (facts.workKind === 'agricultural' || !validCents(claim.highestQuarterWagesCents) || claim.highestQuarterWagesCents >= 150000 ||
            !Number.isInteger(claim.weeksWithAnyEmployee) || claim.weeksWithAnyEmployee < 0 || claim.weeksWithAnyEmployee >= 20 ||
            !Array.isArray(claim.testedYears) || claim.testedYears.length !== 2 || claim.testedYears[0] !== year - 1 || claim.testedYears[1] !== year ||
            claim.effectiveFrom.slice(0,4) !== payDate.slice(0,4) || claim.effectiveThrough.slice(0,4) !== payDate.slice(0,4))
          throw new Error('ordinary_business_futa_employer_thresholds_not_met')
        exclude(['futa'],'Both current and prior year ordinary employer tests are below $1,500 quarterly wages and an employee in twenty weeks.','irs-p15',claim.documentId)
        break
      }
      case 'india_student':
        if (facts.taxResidency !== 'nonresident' || claim.nationality !== 'India' || !['student','business_apprentice'].includes(claim.role))
          throw new Error('india_student_adjustment_exception_basis_required')
        result.nonresidentAdjustment = false
        result.reasons.push('Documented Indian student or business apprentice: no Pub 15-T NRA wage addition; no treaty wage exemption is inferred.')
        break
      case 'voluntary_withholding':
        if ((!kinds.has('h2a') && !kinds.has('minister')) || claim.agreement !== 'employer_employee' || claim.method !== 'w4')
          throw new Error('valid_voluntary_withholding_agreement_required')
        result.voluntaryWithholding = true
        break
      default: throw new Error('unsupported_industry_exemption_claim')
    }
  }
  if (kinds.has('h2a') && (kinds.has('minister') || kinds.has('nonresident_fjmq') || kinds.has('school_student')))
    throw new Error('contradictory_special_worker_classifications')
  const ownershipClaims = facts.claims.filter(claim => claim.kind === 's_corp_health' || claim.kind === 'group_term_life')
  if (ownershipClaims.some(claim => claim.ownershipPercent > 2) && ownershipClaims.some(claim => claim.ownershipPercent <= 2))
    throw new Error('contradictory_shareholder_tax_year_ownership')
  if (facts.seasonal) result.reasons.push('Seasonal status alone changes no federal wage tax treatment.')
  if (facts.employerKind === 'farm') result.reasons.push(result.formAssignment === '943' ? 'Agricultural wages assigned to Form 943.' : 'Farm office and other nonagricultural wages assigned to Form 941.')
  if (result.voluntaryWithholding) result.subject.incomeTax = true
  result.sources = classificationSources.filter(source => usedSources.has(source.id)).map(source => {
    const publication = ({'irs-p15':'p15','irs-p15a':'p15a','irs-p15b':'p15b'} as Record<string,string>)[source.id]
    return publication && payDate.startsWith('2025-') ? {
      ...source,title:source.title + ' (2025)',url:`https://www.irs.gov/pub/irs-prior/${publication}--2025.pdf`,
    } : source
  })
  return result
}
