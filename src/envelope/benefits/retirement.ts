import { date, PayrollError, text } from '../security'
import { roundRatio, validCents } from '../industry/federal-withholding'

export interface RetirementElection {
  taxYear: 2025 | 2026
  effectiveFrom: string
  effectiveThrough: string
  birthDate: string
  eligible: true
  catchUpAllowed: boolean
  rothAllowed: boolean
  priorYearSponsorFicaWagesCents: number
  traditionalCents: number
  rothCents: number
  match: { rateBasisPoints: number; compensationBasisPoints: number; includesCatchUp: boolean }
  prior: {
    through: string; traditionalCents: number; rothCents: number; otherPlanDeferralsCents: number
    catchUpCents: number; planAnnualAdditionsCents: number; planCompensationCents: number; sourceRef: string
  }
  evidence: { planRef: string; electionRef: string; eligibilityRef: string }
}
export const retirementSources = (year: 2025 | 2026) => [
  { title: year === 2025 ? 'IRS Notice 2024-80' : 'IRS Notice 2025-67',
    url: year === 2025 ? 'https://www.irs.gov/pub/irs-drop/n-24-80.pdf' : 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
    effectiveFrom: `${year}-01-01`, section: 'Sections 402(g), 414(v), 415(c) and 401(a)(17)' },
  { title: 'IRS Publication 560', url: 'https://www.irs.gov/publications/p560',
    section: 'Elective deferrals, designated Roth contributions, catch-up contributions and contribution limits' },
  { title: 'IRS retirement catch-up contributions', url: 'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-catch-up-contributions',
    section: 'Age at calendar year end and Roth catch-up beginning in 2026' },
]
const limits = {
  2025: { elective: 2350000, catchUp: 750000, enhanced: 1125000, additions: 7000000, compensation: 35000000 },
  2026: { elective: 2450000, catchUp: 800000, enhanced: 1125000, additions: 7200000, compensation: 36000000 },
} as const
const fail = (code: string): never => { throw new PayrollError(code) }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('retirement_evidence_required')
  return value as Record<string, unknown>
}
const keys = (v: Record<string, unknown>, names: string[]) => {
  if (Object.keys(v).some(k => !names.includes(k)) || names.some(k => !Object.hasOwn(v,k))) fail('complete_retirement_election_required')
}
const cents = (v: unknown): number => {
  if (!validCents(v) || v > 100000000) fail('invalid_retirement_amount')
  return v as number
}
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail('retirement_plan_terms_required')

/** Supported plan terms are an explicit per-pay-period flat election and a single match tier. */
export function retirementElection(value: unknown): RetirementElection {
  const v = object(value)
  keys(v,['taxYear','effectiveFrom','effectiveThrough','birthDate','eligible','catchUpAllowed','rothAllowed','priorYearSponsorFicaWagesCents','traditionalCents','rothCents','match','prior','evidence'])
  if (v.taxYear !== 2025 && v.taxYear !== 2026) fail('retirement_tax_year_unavailable')
  const taxYear = v.taxYear as 2025 | 2026, effectiveFrom = date(v.effectiveFrom), effectiveThrough = date(v.effectiveThrough), birthDate = date(v.birthDate)
  if (effectiveFrom > effectiveThrough || !effectiveFrom.startsWith(taxYear+'-') || !effectiveThrough.startsWith(taxYear+'-') || birthDate > effectiveFrom) fail('invalid_retirement_effective_period')
  if (v.eligible !== true) fail('reviewed_retirement_eligibility_required')
  const m = object(v.match), p = object(v.prior), e = object(v.evidence)
  keys(m,['rateBasisPoints','compensationBasisPoints','includesCatchUp'])
  keys(p,['through','traditionalCents','rothCents','otherPlanDeferralsCents','catchUpCents','planAnnualAdditionsCents','planCompensationCents','sourceRef'])
  keys(e,['planRef','electionRef','eligibilityRef'])
  const through = date(p.through)
  if (through < `${taxYear-1}-12-31` || through > `${taxYear}-12-31`) fail('retirement_prior_period_invalid')
  const rateBasisPoints = cents(m.rateBasisPoints), compensationBasisPoints = cents(m.compensationBasisPoints)
  if (rateBasisPoints > 10000 || compensationBasisPoints > 10000) fail('unsupported_retirement_match')
  return { taxYear,effectiveFrom,effectiveThrough,birthDate,eligible:true,
    catchUpAllowed:bool(v.catchUpAllowed),rothAllowed:bool(v.rothAllowed),
    priorYearSponsorFicaWagesCents:cents(v.priorYearSponsorFicaWagesCents),traditionalCents:cents(v.traditionalCents),rothCents:cents(v.rothCents),
    match:{rateBasisPoints,compensationBasisPoints,includesCatchUp:bool(m.includesCatchUp)},
    prior:{through,traditionalCents:cents(p.traditionalCents),rothCents:cents(p.rothCents),otherPlanDeferralsCents:cents(p.otherPlanDeferralsCents),catchUpCents:cents(p.catchUpCents),planAnnualAdditionsCents:cents(p.planAnnualAdditionsCents),planCompensationCents:cents(p.planCompensationCents),sourceRef:text(p.sourceRef,1000)},
    evidence:{planRef:text(e.planRef,1000),electionRef:text(e.electionRef,1000),eligibilityRef:text(e.eligibilityRef,1000)} }
}

/** Never increment an accumulator from a proposal: only evidenced actual prior contributions count. */
export function retirementContribution(e: RetirementElection, grossCents: number, payDate: string, from: string, through: string) {
  const rule = limits[e.taxYear], p = e.prior
  if (!rule || !validCents(grossCents)) fail('invalid_retirement_calculation')
  if (!payDate.startsWith(e.taxYear+'-') || from < e.effectiveFrom || through > e.effectiveThrough || payDate < e.effectiveFrom || payDate > e.effectiveThrough) fail('retirement_election_outside_effective_period')
  if (p.through >= from) fail('retirement_prior_must_precede_period')
  const age = e.taxYear - Number(e.birthDate.slice(0,4))
  const catchUpLimit = e.catchUpAllowed && age >= 50 ? (age >= 60 && age <= 63 ? rule.enhanced : rule.catchUp) : 0
  const priorTotal = p.traditionalCents + p.rothCents + p.otherPlanDeferralsCents
  if (p.catchUpCents > catchUpLimit || p.catchUpCents > priorTotal || priorTotal-p.catchUpCents > rule.elective
    || p.planAnnualAdditionsCents < Math.max(0,p.traditionalCents+p.rothCents-p.catchUpCents)
    || p.planAnnualAdditionsCents > Math.min(rule.additions,p.planCompensationCents)) fail('retirement_prior_requires_correction')
  if (e.rothCents && !e.rothAllowed) fail('retirement_roth_not_in_plan')
  const rothCatchUpRequired = e.taxYear >= 2026 && e.priorYearSponsorFicaWagesCents > 15000000
  const regularRemaining = Math.max(0,rule.elective-(priorTotal-p.catchUpCents))
  const additionsRemaining = Math.max(0,Math.min(rule.additions,p.planCompensationCents+grossCents)-p.planAnnualAdditionsCents)
  const regularRoom = Math.min(regularRemaining,additionsRemaining,grossCents)
  // Traditional first is the declared allocation order. Never convert an elected traditional amount to Roth.
  let regularTraditional = Math.min(e.traditionalCents,regularRoom)
  let regularRoth = Math.min(e.rothCents,regularRoom-regularTraditional)
  let catchRoom = Math.min(Math.max(0,catchUpLimit-p.catchUpCents),grossCents-regularTraditional-regularRoth)
  let catchTraditional = rothCatchUpRequired ? 0 : Math.min(e.traditionalCents-regularTraditional,catchRoom)
  catchRoom -= catchTraditional
  let catchRoth = e.rothAllowed ? Math.min(e.rothCents-regularRoth,catchRoom) : 0
  const matchCompensationCents = Math.min(grossCents,Math.max(0,rule.compensation-p.planCompensationCents))
  const matchCap = Math.floor(matchCompensationCents*e.match.compensationBasisPoints/10000)
  const matchFor = (regular: number) => roundRatio(BigInt(Math.min(matchCap,e.match.includesCatchUp
    ? regularTraditional+regularRoth+catchTraditional+catchRoth : regular))*BigInt(e.match.rateBasisPoints),10000n)
  // Section 415(c) includes the match but excludes catch-up. Reclassify only
  // permitted elected deferrals, keeping employee amounts and tax character.
  // When catch-up is not matched, recompute the tier as regular deferrals fall.
  const regular = regularTraditional+regularRoth
  let low = 0, high = Math.min(Math.max(0,catchUpLimit-p.catchUpCents-catchTraditional-catchRoth),
    regularRoth+(rothCatchUpRequired ? 0 : regularTraditional))
  while (low < high) {
    const shift = Math.floor((low+high)/2)
    if (regular-shift+matchFor(regular-shift) <= additionsRemaining) high = shift
    else low = shift+1
  }
  // Preserve the declared traditional-first regular allocation.
  const rothShift = Math.min(regularRoth,low), traditionalShift = low-rothShift
  regularRoth -= rothShift; catchRoth += rothShift
  regularTraditional -= traditionalShift; catchTraditional += traditionalShift
  const traditionalCents = regularTraditional+catchTraditional, rothCents = regularRoth+catchRoth
  const employeeCents = traditionalCents+rothCents, catchUpCents = catchTraditional+catchRoth
  const requestedMatch = matchFor(employeeCents-catchUpCents)
  const employerMatchCents = Math.min(requestedMatch,Math.max(0,additionsRemaining-regularTraditional-regularRoth))
  const unallocatedCents = e.traditionalCents+e.rothCents-employeeCents
  return { taxYear:e.taxYear,ageAtYearEnd:age,limits:{electiveCents:rule.elective,catchUpCents:catchUpLimit,annualAdditionsCents:rule.additions,compensationCents:rule.compensation},
    rothCatchUpRequired,traditionalCents,rothCents,employeeCents,catchUpCents,employerMatchCents,matchCompensationCents,
    unallocatedCents,unallocatedMatchCents:requestedMatch-employerMatchCents,
    proposedFederalIncomeTaxWagesCents:grossCents-traditionalCents,proposedFicaWagesCents:grossCents,
    priorCombinedDeferralsCents:priorTotal,proposedCombinedDeferralsCents:priorTotal+employeeCents,
    proposedPlanAnnualAdditionsCents:p.planAnnualAdditionsCents+employeeCents-catchUpCents+employerMatchCents,
    allocationOrder:'Traditional then Roth within the regular limit; permitted elected catch-up also accounts for employer match within annual additions. No automatic Roth conversion.',
    sources:retirementSources(e.taxYear),status:'held-proposal',collected:false,providerAccepted:false,
    holds:[...(unallocatedCents ? ['Election exceeds available compensation or combined limits, or requires a reviewed Roth catch-up election.'] : []),
      'Preparation only. Complete plan eligibility, nondiscrimination and payroll deduction review, contribution remittance and provider acceptance remain required.'] }
}
