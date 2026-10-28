import type { Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, date, text } from '../security'
import { ownerOnly } from '../income-verification/requests'
import { WorkspaceStore, objectId, revision } from '../workspace/store'

const sources = {
  tdi: 'https://labor.hawaii.gov/dcd/home/about-tdi/',
  phc: 'https://labor.hawaii.gov/dcd/home/about-phc/',
  year2026: 'https://labor.hawaii.gov/dcd/files/2025/12/2026-Maximum-Weekly-Wage-Base.pdf',
  waiver: 'https://labor.hawaii.gov/dcd/forms/',
} as const
const fail = (code: string): never => { throw new PayrollError(code, 409) }
const cents = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 100000000) throw new PayrollError('invalid_hi_amount')
  return Number(value)
}
const fraction = (amount: number, basisPoints: number) => Number(BigInt(amount) * BigInt(basisPoints) / 10000n)
const dayAfter = (day: string, days: number) => new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10)
const fields = (value: object, names: string[]) => {
  if (Object.keys(value).some(key => !names.includes(key))) throw new PayrollError('unsupported_hi_input')
}
interface Premium {
  period: string; premiumCents: number; dependentPremiumCents: number
  grossBeforeCents: number; employeeBeforeCents: number; dependentEmployeeBeforeCents: number
  evidence: string; accumulatorEvidence: string
}
interface Plan {
  program: 'tdi' | 'phc'; effectiveFrom: string; effectiveThrough: string; ruleYear: 2026
  source: { kind: string; reference: string; evidence: string }
  approvalEvidence: string; eligibility: 'eligible' | 'unresolved' | 'waived'; eligibilityEvidence: string
  employeeBasisPoints: number; planType: 'tdi' | '7a' | '7b'; dependentEmployerBasisPoints: number
  waiver: null | { form: 'HC-5'; year: number; from: string; through: string; evidence: string }
  premiums: Premium[]; correctionReason: string
}
interface Period {
  from: string; through: string; payDate: string; weekFrom: string; grossCents: number
  requestedEmployeeCents?: number; requestedDependentCents?: number
}
export interface HiPreviewRequest {
  id: string; version: number; personId: string; planId: string; planVersion: number
  wageEvidence: string; periods: Period[]
}

/** Private native evidence and proposals. Review is never authentication of a plan or insurance coverage. */
export class HiPlanShares {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, personId: string) {
    ownerOnly(actor)
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) throw new PayrollError('native_owner_required',403)
    return this.store.authority(actor, 'records:read', personId, true)
  }
  async list(actor: Actor, personId: string) {
    await this.scope(actor, personId)
    return { plans: await this.store.list<Plan>(actor, 'hi-benefit-plan', personId, true),
      previews: await this.store.list(actor, 'hi-benefit-preview', personId, true), sources,
      coverageVerified: false, collection: 'unavailable', remittance: 'unavailable' }
  }
  async save(actor: Actor, personId: string, input: Input) {
    await this.scope(actor, personId)
    fields(input, ['id','version','program','effectiveFrom','effectiveThrough','ruleYear','source','approvalEvidence','eligibility','eligibilityEvidence','employeeBasisPoints','planType','dependentEmployerBasisPoints','waiver','premiums','correctionReason'])
    const id = objectId(input.id), version = revision(input.version)
    const program = input.program
    if (program !== 'tdi' && program !== 'phc') throw new PayrollError('hi_program_required')
    const effectiveFrom = date(input.effectiveFrom), effectiveThrough = date(input.effectiveThrough)
    if (input.ruleYear !== 2026 || !effectiveFrom.startsWith('2026-') || !effectiveThrough.startsWith('2026-') || effectiveFrom > effectiveThrough) fail('hi_rule_year_unavailable')
    const source = input.source as Plan['source']
    if (!source || !['insurer','benefits-administrator','willow'].includes(source.kind)) throw new PayrollError('hi_source_evidence_required')
    fields(source, ['kind','reference','evidence'])
    const eligibility = input.eligibility as Plan['eligibility']
    if (!['eligible','unresolved','waived'].includes(eligibility)) throw new PayrollError('hi_eligibility_required')
    const employeeBasisPoints = cents(input.employeeBasisPoints), dependentEmployerBasisPoints = cents(input.dependentEmployerBasisPoints)
    if (employeeBasisPoints > 5000 || dependentEmployerBasisPoints > 10000) fail('hi_unlawful_cost_share')
    const planType = input.planType as Plan['planType']
    if (program === 'tdi' ? planType !== 'tdi' || dependentEmployerBasisPoints !== 10000 : !['7a','7b'].includes(planType) || planType === '7b' && dependentEmployerBasisPoints < 5000) fail('hi_plan_allocation_required')
    let waiver: Plan['waiver'] = null
    if (input.waiver !== null && input.waiver !== undefined) {
      const w = input.waiver as NonNullable<Plan['waiver']>
      fields(w, ['form','year','from','through','evidence'])
      if (program !== 'phc' || w.form !== 'HC-5' || w.year !== 2026) fail('hi_hc5_year_required')
      const from = date(w.from), through = date(w.through)
      if (!from.startsWith('2026-') || !through.startsWith('2026-') || from > through) fail('hi_hc5_year_required')
      waiver = { form:'HC-5', year:2026, from, through, evidence:text(w.evidence, 4000) }
    }
    if (eligibility === 'waived' && !waiver || waiver && eligibility !== 'waived') fail('hi_hc5_evidence_required')
    if (!Array.isArray(input.premiums) || !input.premiums.length || input.premiums.length > 54) throw new PayrollError('hi_premium_evidence_required')
    const premiums: Premium[] = input.premiums.map((value: Premium) => {
      fields(value, ['period','premiumCents','dependentPremiumCents','grossBeforeCents','employeeBeforeCents','dependentEmployeeBeforeCents','evidence','accumulatorEvidence'])
      const period = text(value.period, 10)
      if (program === 'tdi') {
        date(period)
        if (period < effectiveFrom || dayAfter(period, 6) > effectiveThrough) fail('hi_premium_period_outside_plan')
      } else if (!/^2026-(0[1-9]|1[0-2])$/.test(period) || period < effectiveFrom.slice(0,7) || period > effectiveThrough.slice(0,7)) fail('hi_premium_period_outside_plan')
      const p = { period, premiumCents:cents(value.premiumCents), dependentPremiumCents:cents(value.dependentPremiumCents),
        grossBeforeCents:cents(value.grossBeforeCents), employeeBeforeCents:cents(value.employeeBeforeCents),
        dependentEmployeeBeforeCents:cents(value.dependentEmployeeBeforeCents), evidence:text(value.evidence,4000), accumulatorEvidence:text(value.accumulatorEvidence,4000) }
      if (program === 'tdi' && (p.dependentPremiumCents || p.dependentEmployeeBeforeCents)) fail('hi_tdi_dependent_premium_unsupported')
      return p
    })
    if (new Set(premiums.map(p => p.period)).size !== premiums.length) fail('hi_duplicate_premium_period')
    if (program === 'tdi' && [...premiums].sort((a,b) => a.period.localeCompare(b.period)).some((p,i,all) => i && dayAfter(all[i-1].period,6) >= p.period)) fail('hi_overlapping_premium_weeks')
    const correctionReason = version ? text(input.correctionReason, 1000) : ''
    if (version) {
      const previous = await this.store.find<Plan>(actor,'hi-benefit-plan',id,personId,true)
      if (previous.version !== version || previous.data.program !== program) fail('hi_plan_version_changed')
    }
    const payload: Plan = { program, effectiveFrom, effectiveThrough, ruleYear:2026,
      source:{kind:source.kind, reference:text(source.reference,240), evidence:text(source.evidence,4000)},
      approvalEvidence:text(input.approvalEvidence,4000), eligibility, eligibilityEvidence:text(input.eligibilityEvidence,4000),
      employeeBasisPoints, planType, dependentEmployerBasisPoints, waiver, premiums, correctionReason }
    return this.store.append(actor,'hi-benefit-plan',id,version,payload,personId,true)
  }
  async review(actor: Actor, personId: string, id: string) {
    await this.scope(actor,personId)
    return this.store.review(actor,'hi-benefit-plan',id,personId)
  }
  async approve(actor: Actor, personId: string, id: string, input: Input) {
    await this.scope(actor,personId)
    return this.store.decide(actor,'hi-benefit-plan',id,input,personId)
  }
  async preview(actor: Actor, request: HiPreviewRequest, calculation?: { from:string; through:string; payDate:string; grossCents:number; workState:string }) {
    fields(request, ['id','version','personId','planId','planVersion','wageEvidence','periods'])
    const personId = objectId(request.personId)
    await this.scope(actor,personId)
    const plan = await this.store.find<Plan>(actor,'hi-benefit-plan',objectId(request.planId),personId,true)
    if (plan.version !== request.planVersion || !plan.approvedBy || plan.withdrawnBy || !plan.sourcesCurrent) fail('hi_exact_review_required')
    const p = plan.data
    if (p.eligibility === 'unresolved') fail('hi_eligibility_evidence_required')
    const wageEvidence = text(request.wageEvidence,4000)
    if (!Array.isArray(request.periods) || !request.periods.length || request.periods.length > 54) throw new PayrollError('hi_wage_periods_required')
    const periods = request.periods.map(value => {
      fields(value, ['from','through','payDate','weekFrom','grossCents','requestedEmployeeCents','requestedDependentCents'])
      const from = date(value.from), through = date(value.through), payDate = date(value.payDate)
      const weekFrom = p.program === 'tdi' ? date(value.weekFrom) : ''
      if (from > through || payDate < through || from < p.effectiveFrom || payDate > p.effectiveThrough || !payDate.startsWith('2026-')) fail('hi_wages_outside_plan')
      if (p.program === 'tdi' && (from < weekFrom || through > dayAfter(weekFrom,6))) fail('hi_week_allocation_required')
      return { from, through, payDate, weekFrom, grossCents:cents(value.grossCents),
        ...(value.requestedEmployeeCents === undefined ? {} : {requestedEmployeeCents:cents(value.requestedEmployeeCents)}),
        ...(value.requestedDependentCents === undefined ? {} : {requestedDependentCents:cents(value.requestedDependentCents)}) }
    })
    if (periods.some((v,i) => i && v.from <= periods[i-1].through)) fail('hi_overlapping_wage_periods')
    if (calculation && (calculation.workState !== 'HI' || periods[0].from !== calculation.from || periods.at(-1)!.through !== calculation.through || periods.some(v => v.payDate !== calculation.payDate) || periods.reduce((n,v) => n + v.grossCents,0) !== calculation.grossCents)) fail('hi_calculation_wages_mismatch')
    const balances = new Map<string, { gross:number; employee:number; dependent:number }>()
    const results = periods.map(period => {
      const window = p.program === 'tdi' ? period.weekFrom : period.payDate.slice(0,7)
      const premium = p.premiums.find(v => v.period === window)
      if (!premium) fail('hi_premium_evidence_missing')
      if (p.waiver && (period.from < p.waiver.from || period.payDate > p.waiver.through)) fail('hi_hc5_expired_or_inapplicable')
      const prior = balances.get(window) ?? { gross:premium!.grossBeforeCents, employee:premium!.employeeBeforeCents, dependent:premium!.dependentEmployeeBeforeCents }
      const gross = prior.gross + period.grossCents
      const lawfulCumulative = p.waiver ? 0 : Math.min(fraction(premium!.premiumCents,p.employeeBasisPoints),
        fraction(gross,p.program === 'tdi' ? 50 : 150), p.program === 'tdi' ? 750 : Number.MAX_SAFE_INTEGER)
      const dependentCumulative = p.waiver ? 0 : fraction(premium!.dependentPremiumCents,10000-p.dependentEmployerBasisPoints)
      if (prior.employee > lawfulCumulative || prior.dependent > dependentCumulative) fail('hi_prior_collection_needs_correction')
      const available = lawfulCumulative - prior.employee, dependentAvailable = dependentCumulative - prior.dependent
      const proposedEmployeeCents = period.requestedEmployeeCents ?? available
      const proposedDependentCents = period.requestedDependentCents ?? dependentAvailable
      if (proposedEmployeeCents > available || proposedDependentCents > dependentAvailable) fail('hi_requested_share_above_cap')
      const current = { gross, employee:prior.employee+proposedEmployeeCents, dependent:prior.dependent+proposedDependentCents }
      balances.set(window,current)
      return { ...period, period:window, proposedEmployeeCents, proposedDependentCents,
        cumulativeGrossCents:gross, cumulativeEmployeeCents:current.employee, cumulativeDependentEmployeeCents:current.dependent,
        lawfulCumulativeEmployeeCeilingCents:lawfulCumulative,
        employerRemainingPremiumCents:p.waiver ? null : premium!.premiumCents-current.employee,
        employerRemainingDependentPremiumCents:p.waiver ? null : premium!.dependentPremiumCents-current.dependent,
        premiumEvidence:premium!.evidence, accumulatorEvidence:premium!.accumulatorEvidence,
        coverageStatus:p.waiver ? 'waiver-evidence-only' : 'plan-evidence-only' }
    })
    const result = { status:'held', coverageVerified:false, collectedCents:0, paymentReady:false, remittance:'unavailable',
      program:p.program, planType:p.planType, planId:plan.id, planVersion:plan.version, reviewedBy:plan.approvedBy,
      ruleYear:p.ruleYear, sources, wageEvidence, periods:results,
      proposedEmployeeCents:results.reduce((n,v) => n+v.proposedEmployeeCents,0),
      proposedDependentCents:results.reduce((n,v) => n+v.proposedDependentCents,0),
      holds:['Actual plan authenticity and eligibility require authorized evidence; native review does not establish insurance coverage.',
        'Paid deductions, corrected stubs, insurer remittance and complete effective-rule history remain unavailable.'] }
    const saved = await this.store.append(actor,'hi-benefit-preview',objectId(request.id),revision(request.version),result,personId,true,
      { objects:[{kind:'hi-benefit-plan',id:plan.id,version:plan.version,approved:true}] })
    return { ...saved, ...result }
  }
}
