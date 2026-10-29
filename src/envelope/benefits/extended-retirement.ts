import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, type Revision } from '../workspace/store'

const fail = (code: string): never => { throw new PayrollError(code) }
const shape = (raw: unknown, keys: readonly string[]): Input => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !keys.includes(k))) fail('unsupported_retirement_input')
  return raw as Input
}
const cents = (raw: unknown) => {
  if (!Number.isSafeInteger(raw) || Number(raw) < 0 || Number(raw) > 100_000_000) fail('explicit_retirement_accumulators_required')
  return Number(raw)
}
const flag = (raw: unknown) => {
  if (typeof raw !== 'boolean') fail('explicit_retirement_eligibility_required')
  return raw as boolean
}
const choose = <T extends string>(raw: unknown, values: readonly T[]): T => {
  if (!values.includes(raw as T)) fail('unsupported_retirement_arrangement')
  return raw as T
}
export const retirementRules = {
  2025: { electiveCents: 2_350_000, additionsCents: 7_000_000, compensationCents: 35_000_000, ageCents: 750_000, superAgeCents: 1_125_000,
    notice: 'https://www.irs.gov/pub/irs-drop/n-24-80.pdf', rothCatchUpWageThresholdCents: null },
  2026: { electiveCents: 2_450_000, additionsCents: 7_200_000, compensationCents: 36_000_000, ageCents: 800_000, superAgeCents: 1_125_000,
    notice: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf', rothCatchUpWageThresholdCents: 15_000_000 },
} as const
const sources = (year: 2025 | 2026) => ({ year, notice: retirementRules[year].notice,
  serviceAndAdditions: 'https://www.irs.gov/publications/p571',
  deferredCompensation: 'https://www.irs.gov/retirement-plans/irc-457b-deferred-compensation-plans',
  sep: 'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-seps',
  reporting: `https://www.irs.gov/pub/irs-prior/iw2w3--${year}.pdf`,
  rules: retirementRules[year], reviewedOn: '2026-10-28' })

type Arrangement = '403b' | 'governmental-457b' | 'nongovernmental-457b' | 'sep'
interface Service {
  enabled: boolean; qualifyingEmployer: string; yearsOfService: number
  lifetimeUsedBeforeYearCents: number; employerDeferralsBeforeYearCents: number
}
interface Opening {
  electiveCents?: number; planElectiveCents?: number; serviceCents?: number; ageCents?: number; annualAdditionsCents?: number
  contributionsCents?: number; specialCents?: number; employerCents?: number
}
export interface ExtendedRetirementSetup {
  arrangement: Arrangement; year: 2025 | 2026; effectiveFrom: string; effectiveThrough: string
  eligible: true; workerKind: 'employee'; employerType: string; compensationCents: number
  ageAtYearEnd: number; priorYearFicaWagesCents: number; allowsRoth: boolean; allowsAgeCatchUp: boolean
  planReference: string; electionReference: string; eligibilityReference: string; accumulatorReference: string; aggregationReference: string
  opening: Opening; service?: Service
  catchUpMode?: 'none' | 'age' | 'special'; special?: { enabled: boolean; normalRetirementAge: number; unusedDeferralsCents: number }
  sources: ReturnType<typeof sources>
}
const references = ['planReference', 'electionReference', 'eligibilityReference', 'accumulatorReference', 'aggregationReference'] as const
const setupKeys = ['id','version','arrangement','year','effectiveFrom','effectiveThrough','eligible','workerKind','employerType','compensationCents','ageAtYearEnd','priorYearFicaWagesCents','allowsRoth','allowsAgeCatchUp','opening',...references]

function setupInput(raw: Input): ExtendedRetirementSetup {
  const arrangement = choose(raw.arrangement, ['403b','governmental-457b','nongovernmental-457b','sep'] as const)
  shape(raw, [...setupKeys, ...(arrangement === '403b' ? ['service'] : arrangement === 'sep' ? [] : ['catchUpMode','special'])])
  if (raw.year !== 2025 && raw.year !== 2026) fail('retirement_year_unavailable')
  const year = raw.year as 2025 | 2026, effectiveFrom = date(raw.effectiveFrom), effectiveThrough = date(raw.effectiveThrough)
  if (effectiveFrom > effectiveThrough || !effectiveFrom.startsWith(year+'-') || !effectiveThrough.startsWith(year+'-')) fail('invalid_retirement_effective_period')
  if (raw.eligible !== true || raw.workerKind !== 'employee') fail('reviewed_employee_plan_eligibility_required')
  const ageAtYearEnd = cents(raw.ageAtYearEnd)
  if (ageAtYearEnd > 100) fail('invalid_retirement_age')
  const employerType = choose(raw.employerType, arrangement === '403b' ? ['public-school','501c3','church'] : arrangement === 'governmental-457b' ? ['government'] : arrangement === 'nongovernmental-457b' ? ['tax-exempt'] : ['business','501c3','church','government'])
  const openingKeys = arrangement === '403b' ? ['electiveCents','planElectiveCents','serviceCents','ageCents','annualAdditionsCents'] : arrangement === 'sep' ? ['employerCents','annualAdditionsCents'] : ['contributionsCents','ageCents','specialCents']
  const openingRaw = shape(raw.opening, openingKeys), opening = Object.fromEntries(openingKeys.map(k => [k, cents(openingRaw[k])])) as Opening
  const data: ExtendedRetirementSetup = { arrangement, year, effectiveFrom, effectiveThrough, eligible: true, workerKind: 'employee', employerType,
    compensationCents: cents(raw.compensationCents), ageAtYearEnd, priorYearFicaWagesCents: cents(raw.priorYearFicaWagesCents),
    allowsRoth: flag(raw.allowsRoth), allowsAgeCatchUp: flag(raw.allowsAgeCatchUp), opening,
    ...Object.fromEntries(references.map(k => [k, text(raw[k], 1000)])) as Record<typeof references[number], string>, sources: sources(year) }
  if ((arrangement === 'sep' || arrangement === 'nongovernmental-457b') && (data.allowsRoth || data.allowsAgeCatchUp)) fail('catch_up_or_roth_not_available_for_arrangement')
  if (arrangement === '403b') {
    const s = shape(raw.service, ['enabled','qualifyingEmployer','yearsOfService','lifetimeUsedBeforeYearCents','employerDeferralsBeforeYearCents'])
    const years = s.yearsOfService
    if (typeof years !== 'number' || !Number.isFinite(years) || years < 0 || years > 100) fail('verified_service_years_required')
    data.service = { enabled: flag(s.enabled), qualifyingEmployer: choose(s.qualifyingEmployer, ['none','school','hospital','home-health','health-welfare','church']), yearsOfService: years as number,
      lifetimeUsedBeforeYearCents: cents(s.lifetimeUsedBeforeYearCents), employerDeferralsBeforeYearCents: cents(s.employerDeferralsBeforeYearCents) }
    if (data.service.enabled && (data.service.qualifyingEmployer === 'none' || data.service.yearsOfService < 15)) fail('qualifying_fifteen_year_service_required')
  } else if (arrangement !== 'sep') {
    const s = shape(raw.special, ['enabled','normalRetirementAge','unusedDeferralsCents'])
    data.catchUpMode = choose(raw.catchUpMode, ['none','age','special'] as const)
    data.special = { enabled: flag(s.enabled), normalRetirementAge: cents(s.normalRetirementAge), unusedDeferralsCents: cents(s.unusedDeferralsCents) }
    if (data.special.normalRetirementAge < 50 || data.special.normalRetirementAge > 100) fail('plan_normal_retirement_age_required')
    if (data.catchUpMode === 'age' && (arrangement !== 'governmental-457b' || !data.allowsAgeCatchUp || ageAtYearEnd < 50 || opening.specialCents)) fail('age_and_special_457_catch_up_excluded')
    if (data.catchUpMode === 'special' && (!data.special.enabled || ageAtYearEnd >= data.special.normalRetirementAge || ageAtYearEnd < data.special.normalRetirementAge - 3 || opening.ageCents)) fail('special_457_catch_up_ineligible')
  }
  // Validate opening registers and eligibility even before a human reviews them.
  extendedRetirementCalculation(data, { payDate: effectiveFrom, traditionalCents: 0, rothCents: 0, employerCents: 0 })
  return data
}

export interface ExtendedRetirementRequest { payDate: string; traditionalCents: number; rothCents: number; employerCents: number }
export function extendedRetirementCalculation(setup: ExtendedRetirementSetup, raw: unknown) {
  const r = shape(raw, ['payDate','traditionalCents','rothCents','employerCents'])
  const payDate = date(r.payDate), traditionalCents = cents(r.traditionalCents), rothCents = cents(r.rothCents), employerCents = cents(r.employerCents)
  if (payDate < setup.effectiveFrom || payDate > setup.effectiveThrough) fail('retirement_evidence_outside_effective_period')
  if (rothCents && !setup.allowsRoth) fail('roth_not_available_for_arrangement')
  const rules = retirementRules[setup.year], prior = setup.opening, elective = traditionalCents + rothCents
  const rothRequired = rules.rothCatchUpWageThresholdCents !== null && setup.priorYearFicaWagesCents > rules.rothCatchUpWageThresholdCents
  const ageLimit = setup.allowsAgeCatchUp && setup.ageAtYearEnd >= 50 && (!rothRequired || setup.allowsRoth)
    ? setup.ageAtYearEnd >= 60 && setup.ageAtYearEnd <= 63 ? rules.superAgeCents : rules.ageCents : 0
  let ordinaryCents = 0, serviceCents = 0, ageCents = 0, specialCents = 0, annualLimitCents = 0
  const box12: {code: 'E' | 'BB' | 'G' | 'EE'; amountCents: number}[] = []
  if (setup.arrangement === '403b') {
    const s = setup.service!, serviceLimit = s.enabled ? Math.max(0, Math.min(300_000, 1_500_000 - s.lifetimeUsedBeforeYearCents, Math.floor(500_000 * s.yearsOfService) - s.employerDeferralsBeforeYearCents)) : 0
    if (prior.serviceCents! > serviceLimit || prior.serviceCents !== Math.max(0, prior.electiveCents! - rules.electiveCents) || prior.ageCents! > ageLimit || prior.electiveCents! > rules.electiveCents + serviceLimit) fail('inconsistent_403b_opening_register')
    annualLimitCents = Math.min(rules.additionsCents, setup.compensationCents)
    if (prior.ageCents && prior.electiveCents !== rules.electiveCents + serviceLimit && prior.annualAdditionsCents !== annualLimitCents) fail('service_before_age_catch_up_required')
    ordinaryCents = Math.min(elective, Math.max(0, rules.electiveCents - prior.electiveCents!))
    serviceCents = Math.min(elective - ordinaryCents, serviceLimit - prior.serviceCents!)
    ageCents = elective - ordinaryCents - serviceCents
    if (ageCents + prior.ageCents! > ageLimit) fail('combined_403b_elective_limit_exceeded')
    if (prior.planElectiveCents! > prior.electiveCents! || prior.annualAdditionsCents! < prior.planElectiveCents! || prior.annualAdditionsCents! + employerCents > annualLimitCents) fail('combined_annual_additions_limit_exceeded')
    // Section 414(v) excludes eligible employee catch-up from section 415(c)
    // even when employer additions fill that ceiling before elective limits.
    // Keep ordinary and then service deferrals within both non-age limits;
    // employer contributions can never be reclassified as employee catch-up.
    const additionsCatchUp = Math.max(0, prior.annualAdditionsCents! + ordinaryCents + serviceCents + employerCents - annualLimitCents)
    if (prior.ageCents! + ageCents + additionsCatchUp > ageLimit) fail('combined_annual_additions_limit_exceeded')
    const serviceReclassified = Math.min(serviceCents, additionsCatchUp)
    serviceCents -= serviceReclassified
    ordinaryCents -= additionsCatchUp - serviceReclassified
    ageCents += additionsCatchUp
    if (rothRequired && ageCents > rothCents) fail('age_catch_up_must_be_roth')
    if (prior.planElectiveCents! + prior.ageCents! + elective > setup.compensationCents) fail('elective_deferrals_exceed_compensation')
    if (traditionalCents) box12.push({code:'E', amountCents:traditionalCents})
    if (rothCents) box12.push({code:'BB', amountCents:rothCents})
  } else if (setup.arrangement === 'sep') {
    if (elective) fail('sep_employer_contribution_is_not_elective')
    const sepLimit = Math.min(rules.additionsCents, Math.floor(Math.min(setup.compensationCents, rules.compensationCents) / 4))
    annualLimitCents = Math.min(rules.additionsCents, setup.compensationCents)
    if (prior.annualAdditionsCents! < prior.employerCents! || prior.employerCents! + employerCents > sepLimit || prior.annualAdditionsCents! + employerCents > annualLimitCents) fail('sep_combined_employer_limit_exceeded')
  } else {
    const mode = setup.catchUpMode!, specialLimit = setup.special!.enabled ? Math.min(rules.electiveCents, setup.special!.unusedDeferralsCents) : 0
    if (prior.ageCents! > (mode === 'age' ? ageLimit : 0) || prior.specialCents! > (mode === 'special' ? specialLimit : 0) || (prior.ageCents! && prior.specialCents!)) fail('age_and_special_457_catch_up_excluded')
    const extra = mode === 'special' ? specialLimit : mode === 'age' ? ageLimit : 0
    annualLimitCents = Math.min(setup.compensationCents, rules.electiveCents + extra)
    // This register includes all employer and employee contributions across applicable 457 plans.
    const before = prior.contributionsCents!, total = elective + employerCents
    if (before < prior.ageCents! + prior.specialCents! || before + total > annualLimitCents) fail('combined_457_contribution_limit_exceeded')
    const extraBefore = Math.max(0, before - rules.electiveCents)
    if (extraBefore !== prior.ageCents! + prior.specialCents!) fail('inconsistent_457_opening_register')
    ordinaryCents = Math.min(total, Math.max(0, rules.electiveCents - before))
    if (mode === 'special') specialCents = total - ordinaryCents
    if (mode === 'age') ageCents = total - ordinaryCents
    if (rothRequired && ageCents > rothCents) fail('age_catch_up_must_be_roth')
    if (traditionalCents + employerCents) box12.push({code:'G', amountCents:traditionalCents + employerCents})
    if (rothCents) box12.push({code:'EE', amountCents:rothCents})
  }
  return { arrangement: setup.arrangement, year: setup.year, payDate, status:'held-proposal' as const, paymentReady:false as const,
    employeeElectiveCents:elective, traditionalCents, rothCents, employerContributionCents:employerCents,
    allocation:{ordinaryCents,serviceCents,ageCents,specialCents}, annualLimitCents,
    reporting:{status:'prepared-only',box12,sepTreatment:setup.arrangement === 'sep' ? 'Employer SEP contribution; no employee elective deduction and no ordinary Box 12 code.' : null},
    sources:setup.sources,
    holds:['Actual plan eligibility and source authenticity require independent custody proof.','No employee deduction, accepted contribution, paid payroll or delivered year-end form is established.'],
    providerAcceptance:'unavailable', collectedCents:0, employeeDeductionCents:0 }
}
export type ExtendedRetirementProposal = ReturnType<typeof extendedRetirementCalculation>
interface RetainedProposal {
  request: unknown; setupId: string; setupVersion: number; result: ExtendedRetirementProposal
}
const kinds = ['extended-retirement','extended-retirement-preview'] as const
export class ExtendedRetirement {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, personId: string) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner' || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) throw new PayrollError('retirement_native_owner_required',403)
    return this.store.authority(actor,'records:read',personId,true)
  }
  private privacyFence(actor: Actor, personId: string) {
    return {sql:"NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND person_id=? AND status='held')",args:[actor.company,personId]}
  }
  private approvalAuthority(actor: Actor) {
    // Bind to the decision's actual session, not another unused review token.
    // Archived or legacy approval history does not create current authority.
    return {sql:`FROM env_workspace_decisions d JOIN env_workspace_decision_authority a
      ON a.company_id=d.company_id AND a.kind=d.kind AND a.object_id=d.object_id AND a.version=d.version AND a.decision=d.decision
      JOIN oa_sessions s ON s.id=a.session_id
      JOIN oa_operators o ON o.id=d.actor_id JOIN env_grants g ON g.company_id=d.company_id AND g.operator_id=d.actor_id
      WHERE d.company_id=? AND d.kind='extended-retirement' AND d.decision='approved'
      AND s.operator_id=o.id AND s.operator_version=o.version AND s.kind='native'
      AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active' AND o.role='owner'
      AND lower(trim(o.email))=? AND g.version=a.grant_version AND g.revoked_at IS NULL AND g.role='owner'`,
      args:[actor.company,this.store.records.env.OWNER_EMAIL.trim().toLowerCase()]}
  }
  private preparationFence(actor: Actor, personId: string, setup: Revision<ExtendedRetirementSetup>) {
    const approval=this.approvalAuthority(actor),privacy=this.privacyFence(actor,personId)
    return {sql:`${privacy.sql} AND EXISTS(SELECT 1 ${approval.sql} AND d.object_id=? AND d.version=?)`,
      args:[...privacy.args,...approval.args,setup.id,setup.version]}
  }
  async list(actor: Actor, personId: string) {
    await this.scope(actor,personId)
    const setups = await this.store.list<ExtendedRetirementSetup>(actor,kinds[0],personId,true)
    const proposals = await this.store.list<RetainedProposal>(actor,kinds[1],personId,true)
    const authority=this.approvalAuthority(actor),privacy=this.privacyFence(actor,personId)
    const approvals=await this.store.records.statement(`SELECT d.object_id AS id,d.version ${authority.sql} AND ${privacy.sql}`,[...authority.args,...privacy.args]).all<{id:string;version:number}>()
    const active=new Set(approvals.results.map(row=>JSON.stringify([row.id,row.version])))
    return {setups,proposals:proposals.map((row,i)=>{
      const preparationCurrent=Boolean(row.sourcesCurrent && active.has(JSON.stringify([row.data.setupId,row.data.setupVersion]))
        && proposals.findIndex(other=>other.id===row.id)===i)
      return {...row,preparationCurrent,sourceStatus:preparationCurrent?'current':'changed-repreview-required'}
    })}
  }
  async save(actor: Actor, personId: string, raw: Input) {
    await this.scope(actor,personId)
    const data = setupInput(raw)
    return this.store.append(actor,kinds[0],objectId(raw.id),revision(raw.version),data,personId,true,{noPrivacyHold:personId})
  }
  async review(actor: Actor, personId: string, id: string) {
    await this.scope(actor,personId)
    return this.store.review<ExtendedRetirementSetup>(actor,kinds[0],id,personId,this.privacyFence(actor,personId))
  }
  async decide(actor: Actor, personId: string, id: string, raw: Input) {
    await this.scope(actor,personId)
    return this.store.decide(actor,kinds[0],id,raw,personId,raw.withdraw === true,raw.withdraw === true ? undefined : this.privacyFence(actor,personId),true)
  }
  async preview(actor: Actor, personId: string, raw: Input, persist = true) {
    shape(raw,persist ? ['id','version','setupId','setupVersion','request'] : ['setupId','setupVersion','request'])
    await this.scope(actor,personId)
    const setup = await this.store.find<ExtendedRetirementSetup>(actor,kinds[0],objectId(raw.setupId),personId,true)
    if (setup.version !== revision(raw.setupVersion) || !setup.approvedBy || setup.withdrawnBy || !setup.sourcesCurrent) throw new PayrollError('current_reviewed_retirement_evidence_required',409)
    const authority=this.preparationFence(actor,personId,setup)
    const currentAuthority=()=>this.store.records.statement('SELECT 1 WHERE '+authority.sql,authority.args).first()
    if (!await currentAuthority()) throw new PayrollError('retirement_review_authority_inactive',409)
    const result = extendedRetirementCalculation(setup.data,raw.request)
    if (!persist) {
      // Repeat live authority and exact source checks before returning private values.
      await this.scope(await this.store.records.actor(actor.company),personId)
      const current = await this.store.find(actor,kinds[0],setup.id,personId,true)
      if (current.version !== setup.version || current.withdrawnBy || !current.sourcesCurrent) throw new PayrollError('retirement_evidence_changed',409)
      if (!await currentAuthority()) throw new PayrollError('retirement_review_authority_inactive',409)
      return {result,source:{id:setup.id,version:setup.version}}
    }
    const data = {request:raw.request,setupId:setup.id,setupVersion:setup.version,result}
    const saved = await this.store.append(actor,kinds[1],objectId(raw.id),revision(raw.version),data,personId,true,{noPrivacyHold:personId,condition:authority,objects:[{kind:kinds[0],id:setup.id,version:setup.version,approved:true}]})
    return {...saved,...data}
  }
}
