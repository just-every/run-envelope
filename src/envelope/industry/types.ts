export type TaxYear = 2025 | 2026
export type FederalTax = 'incomeTax' | 'socialSecurity' | 'medicare' | 'futa'
export type FilingStatus = 'single' | 'married_joint' | 'head_household'
export type PayPeriods = 1 | 2 | 4 | 12 | 24 | 26 | 52 | 260

/** Review identity and document identity must come from the native reviewed record. */
export type ReviewedEvidence = {
  documentId: string
  reviewedBy: string
  reviewedAt: string
  effectiveFrom: string
  effectiveThrough: string
}

export type IndustryClaim = ReviewedEvidence & (
  | { kind: 'nonprofit_501c3'; determination: '501c3' }
  | { kind: 'h2a'; immigrationStatus: 'H-2A'; services: 'authorized_agricultural_labor'; tinStatus: 'provided' }
  | { kind: 'minister'; credential: 'ordained' | 'commissioned' | 'licensed'; services: 'exercise_of_ministry' }
  | { kind: 'minister_housing'; designatedBeforePayment: string; designatedCents: number;
      actualHousingExpensesCents: number; fairRentalValueIncludingUtilitiesCents: number;
      reasonableCompensationCents: number; annualReconciliation: 'current_year_allocations' }
  | { kind: 'church_8274'; election: 'filed_8274'; churchOpposesInsurance: 'religious_principle';
      filedOn: string; firstEmploymentReturnDue: string }
  /** Ownership includes direct and attributed stock or voting power on any day in the tax year. */
  | { kind: 's_corp_health'; ownershipPercent: number; benefit: 'employer_paid_accident_health';
      planCoverage: 'employees_generally' | 'class_of_employees' }
  | { kind: 'employee_health'; benefit: 'employer_paid_accident_health';
      planCoverage: 'employees_generally' | 'class_of_employees' }
  | { kind: 'group_term_life'; ownershipPercent: number; benefit: 'employer_paid_group_term_life';
      /** Current-payment actual invoiced cost before employee after-tax contributions. */
      employerPremiumCents: number; employeeAfterTaxContributionCents: number }
  | { kind: 'nonprofit_small_wages'; incomeTaxExemption: '501a' | '521' | '501c3';
      organization: 'operating_nonprofit'; annualWorkerWagesCents: number; quarterWorkerWagesCents: number;
      quarter: 1 | 2 | 3 | 4 }
  | { kind: 'nonresident_fjmq'; immigrationStatus: 'F-1' | 'J-1' | 'M-1' | 'Q-1';
      services: 'authorized_status_purpose' }
  | { kind: 'school_student'; enrollment: 'at_least_half_time'; relationship: 'education_predominates';
      employerIsEnrolledSchool: true; scheduledWeeklyHours: number; professionalEmployee: false;
      socialSecurityCoverage: 'no_section_218_coverage';
      attendance: 'class_session' | 'short_break'; breakFrom?: string; breakThrough?: string;
      qualifiedBeforeBreak?: true; eligibleFollowingTerm?: true }
  | { kind: 'family_employment'; relationship: 'child' | 'spouse' | 'parent';
      allPartnersAreParents?: boolean }
  | { kind: 'farm_small_wages'; annualWorkerCashWagesCents: number; annualEmployerFarmWagesCents: number }
  | { kind: 'farm_hand_harvest'; annualWorkerCashWagesCents: number;
      work: 'hand_harvest'; pay: 'regional_customary_piece_rate'; commute: 'daily_from_permanent_home';
      priorYearAgriculturalWeeks: number }
  | { kind: 'farm_futa_threshold'; highestQuarterCashWagesCents: number; weeksWithTenWorkers: number;
      /** Maximum quarterly cash and maximum qualifying weeks in either tested year, including H-2A. */
      testedYears: [number, number] }
  | { kind: 'business_futa_threshold'; highestQuarterWagesCents: number; weeksWithAnyEmployee: number;
      testedYears: [number, number] }
  | { kind: 'india_student'; nationality: 'India'; role: 'student' | 'business_apprentice' }
  | { kind: 'voluntary_withholding'; agreement: 'employer_employee'; method: 'w4' }
)

export type IndustryFacts = {
  employerKind: 'business' | 'farm' | 'nonprofit' | 'church' | 'school'
  entityType: 'sole_proprietor' | 'partnership' | 'corporation' | 's_corporation' | 'nonprofit'
  workerRole: 'employee' | 'corporate_officer' | 'sole_proprietor' | 'partner' | 'distribution'
  workKind: 'agricultural' | 'nonagricultural'
  birthDate?: string
  seasonal: boolean
  taxResidency: 'resident' | 'nonresident'
  claims: IndustryClaim[]
}

export type ModernW4 = {
  version: '2020_or_later'
  filingStatus: FilingStatus
  step2Checked: boolean
  step3AnnualCreditsCents: number
  step4aOtherIncomeCents: number
  step4bDeductionsCents: number
  step4cExtraWithholdingCents: number
}
export type LegacyW4 = {
  version: '2019_or_earlier'
  filingStatus: 'single' | 'married_joint'
  allowances: number
  extraWithholdingCents: number
  firstPaidBefore2020: true
}
export type FederalW4 = ModernW4 | LegacyW4

export type FederalSource = { id: string; title: string; url: string; section: string }
export type TaxExclusion = { tax: FederalTax; reason: string; sourceId: string; documentId: string }
export type IndustryClassification = {
  formAssignment: '941' | '943'
  subject: Record<FederalTax, boolean>
  exclusions: TaxExclusion[]
  reasons: string[]
  housingExcludedCents: number
  shareholderHealth: boolean
  healthBenefitTreatment: 'ordinary_excluded' | 'greater_than_two_percent_fit' | null
  groupTermLifeWagesCents: number
  nonresidentAdjustment: boolean
  voluntaryWithholding: boolean
  selfEmploymentNotice: string | null
  sources: FederalSource[]
}

export type IndustryPayInput = {
  payDate: string
  cashGrossCents: number
  /** A subset of cash gross, never an additional cash payment. */
  housingAllowanceCents: number
  /** Employer paid health premium. A reviewed ordinary plan excludes it; a greater than 2 percent shareholder plan adds FIT wages only. */
  shareholderHealthInsuranceCents: number
  periodsPerYear: PayPeriods
  facts: IndustryFacts
  w4: FederalW4
  yearToDate: { socialSecurityWagesCents: number; medicareWagesCents: number; futaWagesCents: number;
    /** Required when housing is paid; prevents reusing an annual housing exclusion. */
    housingExcludedCents?: number }
  /** No default state unemployment credit. Requires separately reviewed payment evidence. */
  futaCredit?: ReviewedEvidence & { creditBasisPoints: number; basis: 'timely_state_tax_same_wages' }
}

export type IndustryPayResult = {
  payDate: string
  taxYear: TaxYear
  cashGrossCents: number
  noncashBenefitCents: number
  netCashCents: number
  totalEmployeeTaxCents: number
  totalEmployerTaxCents: number
  wages: { incomeTaxWagesCents: number; w2Box1WagesCents: number; socialSecurityWagesCents: number;
    medicareWagesCents: number; additionalMedicareWagesCents: number; futaWagesCents: number }
  employeeTaxes: { incomeTaxCents: number; socialSecurityCents: number; medicareCents: number; additionalMedicareCents: number }
  employerTaxes: { socialSecurityCents: number; medicareCents: number; futaCents: number }
  withholding: { adjustedAnnualWagesCents: number; nonresidentAdjustmentCents: number; sourceId: string }
  classification: IndustryClassification
  formAssignment: '941' | '943'
  sources: FederalSource[]
  limitations: string[]
}
