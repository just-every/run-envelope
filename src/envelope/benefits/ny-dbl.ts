import type { Actor } from '../access'
import type { Input } from '../records'
import { date, integer, PayrollError, text } from '../security'
import { WorkspaceStore, objectId, revision, choice, digest, type Revision } from '../workspace/store'
import { collectionPins, reviewInputFence } from '../workspace/review-inputs'

/** Statutory preparation only. Supplied evidence is never authenticated coverage. */
export const nyDblRule = {
  edition: 'WCL-209-2026-10', reviewedOn: '2026-10-28',
  sources: ['https://www.nysenate.gov/legislation/laws/WKC/209',
    'https://www.wcb.ny.gov/content/main/DisabilityBenefits/employer-disability-benefits.jsp',
    'https://www.wcb.ny.gov/content/main/DisabilityBenefits/employee-disability-benefits.jsp'],
  rateBasisPoints: 50, weeklyCapCents: 60,
} as const
interface Source { origin: string; reference: string; version: string }
interface Plan {
  program: 'NY-DBL'; type: 'statutory'; effectiveFrom: string; effectiveThrough: string
  recipient: { kind: 'carrier' | 'nysif'; name: string; reference: string }; source: Source
  employeeContributions: boolean; ruleEdition: string
}
interface Week {
  from: string; wagesCents: number; priorCollectedCents: number
  concurrent: null | { requestReference: string; verifiedEarningsReference: string; otherWagesCents: number }
}
interface Evidence {
  planId: string; planVersion: number; source: Source; premiumReference: string
  attributablePremiumCents: number; priorPremiumOffsetCents: number; weeks: Week[]
}
interface Check { reference: string; weekFrom: string; wagesCents: number }
interface Proposal {
  fingerprint: string; evidenceId: string; evidenceVersion: number; checks: Check[]
  result: ReturnType<typeof nyDblCalculation>
}
const fail = (code: string, status = 400): never => { throw new PayrollError(code, status) }
const cents = (v: unknown) => { if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > 100000000) fail('invalid_dbl_amount'); return Number(v) }
const source = (v: unknown): Source => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('dbl_source_required')
  const s = v as Input
  return { origin: choice(s.origin, ['carrier', 'willow', 'migration']), reference: text(s.reference, 500), version: text(s.version, 120) }
}
const keys = (input: Input, allowed: string[]) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) fail('unsupported_dbl_input')
}
const weekEnd = (from: string) => new Date(Date.parse(from) + 6 * 86400000).toISOString().slice(0, 10)

/** All amounts are cents. Floor fractional cents so a ceiling is never exceeded. */
export function nyDblCalculation(plan: Plan, evidence: Evidence, checks: Check[], reserved: { weeks: Record<string, { wages: number; amount: number }>; total: number }) {
  let premiumRemaining = Math.max(0, evidence.attributablePremiumCents - evidence.priorPremiumOffsetCents - reserved.total)
  const rows = evidence.weeks.filter(w => checks.some(c => c.weekFrom === w.from)).map(w => {
    const wagesCents = checks.filter(c => c.weekFrom === w.from).reduce((n, c) => n + c.wagesCents, 0)
    const used = reserved.weeks[w.from] ?? { wages: 0, amount: 0 }
    if (used.wages + wagesCents > w.wagesCents) fail('dbl_weekly_wages_exceeded', 409)
    const wageCeiling = Math.min(60, Math.floor(w.wagesCents / 200))
    const proportionalCeiling = w.concurrent ? Math.min(wageCeiling, Math.floor(60 * w.wagesCents / (w.wagesCents + w.concurrent.otherWagesCents))) : wageCeiling
    // Accumulate this employer's checks before rounding the half-percent ceiling.
    const earnedCeiling = Math.min(proportionalCeiling, Math.floor((used.wages + wagesCents) / 200))
    const weeklyRemaining = Math.max(0, earnedCeiling - w.priorCollectedCents - used.amount)
    const proposedCents = plan.employeeContributions ? Math.min(weeklyRemaining, premiumRemaining) : 0
    premiumRemaining -= proposedCents
    return { weekFrom: w.from, wagesCents, priorCollectedCents: w.priorCollectedCents, reservedCents: used.amount,
      weeklyCeilingCents: proportionalCeiling, proposedCents, concurrentAdjustment: !!w.concurrent }
  })
  return { program: 'NY-DBL' as const, rule: nyDblRule, rows, proposedCents: rows.reduce((n, r) => n + r.proposedCents, 0),
    remainingAttributablePremiumCents: premiumRemaining, recipient: plan.recipient,
    collectedCents: null, coverageEstablished: false, remittance: 'unavailable', paymentReady: false,
    limitations: ['Reviewed supplied evidence only; no authenticated plan coverage, collected funds, employer funding or insurer receipt.',
      'NY PFL is separate and is not calculated or remitted by this proposal.', 'Complete payroll tax and deduction authority remains held.'] }
}

export class NyDbl {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, person?: string) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) fail('native_dbl_owner_required',403)
    await this.store.authority(actor, 'records:read', person, true)
  }
  async plans(actor: Actor) { await this.scope(actor); return this.store.list<Plan>(actor, 'ny-dbl-plan', undefined, true) }
  async savePlan(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['id','version','program','type','effectiveFrom','effectiveThrough','recipient','source','employeeContributions','ruleEdition'])
    if (input.program !== 'NY-DBL' || input.type !== 'statutory') fail('dbl_enhanced_or_self_insured_plan_unsupported', 409)
    if (input.ruleEdition !== nyDblRule.edition || typeof input.employeeContributions !== 'boolean') fail('dbl_reviewed_rule_required')
    const effectiveFrom = date(input.effectiveFrom), effectiveThrough = date(input.effectiveThrough)
    if (effectiveFrom > effectiveThrough) fail('invalid_dbl_period')
    const recipient = input.recipient as Input
    if (!recipient || typeof recipient !== 'object') fail('dbl_insurer_required')
    keys(recipient, ['kind','name','reference'])
    const data: Plan = { program:'NY-DBL', type:'statutory', effectiveFrom, effectiveThrough,
      recipient: {kind: choice(recipient.kind, ['carrier','nysif']) as Plan['recipient']['kind'], name:text(recipient.name), reference:text(recipient.reference,500)},
      source: source(input.source), employeeContributions: input.employeeContributions as boolean, ruleEdition: nyDblRule.edition }
    return this.store.append(actor, 'ny-dbl-plan', objectId(input.id), revision(input.version), data, undefined, true)
  }
  async saveEvidence(actor: Actor, person: string, input: Input) {
    await this.scope(actor, person)
    keys(input, ['version','planId','planVersion','source','premiumReference','attributablePremiumCents','priorPremiumOffsetCents','weeks'])
    const plan = await this.store.find<Plan>(actor,'ny-dbl-plan',objectId(input.planId),undefined,true)
    this.reviewed(plan, integer(input.planVersion))
    if (!Array.isArray(input.weeks) || !input.weeks.length || input.weeks.length > 54) fail('dbl_weekly_evidence_required')
    const weeks = (input.weeks as Input[]).map(w => {
      keys(w, ['from','wagesCents','priorCollectedCents','concurrent'])
      const from = date(w.from)
      if (from < plan.data.effectiveFrom || weekEnd(from) > plan.data.effectiveThrough) fail('dbl_week_outside_plan')
      const c = w.concurrent as Input | null
      if (c) keys(c, ['requestReference','verifiedEarningsReference','otherWagesCents'])
      const concurrent = c ? {requestReference:text(c.requestReference,500),verifiedEarningsReference:text(c.verifiedEarningsReference,500),otherWagesCents:cents(c.otherWagesCents)} : null
      const wagesCents = cents(w.wagesCents)
      if (concurrent && (!concurrent.otherWagesCents || wagesCents + concurrent.otherWagesCents <= 12000)) fail('dbl_concurrent_earnings_required')
      return {from,wagesCents,priorCollectedCents:cents(w.priorCollectedCents),concurrent}
    }).sort((a,b) => a.from.localeCompare(b.from))
    if (weeks.some((w,i) => i > 0 && w.from <= weekEnd(weeks[i-1].from))) fail('dbl_overlapping_weeks')
    if (cents(input.priorPremiumOffsetCents) < weeks.reduce((n,w)=>n+w.priorCollectedCents,0)) fail('dbl_prior_premium_offset_incomplete')
    const data: Evidence = { planId:plan.id,planVersion:plan.version,source:source(input.source),premiumReference:text(input.premiumReference,500),
      attributablePremiumCents:cents(input.attributablePremiumCents),priorPremiumOffsetCents:cents(input.priorPremiumOffsetCents),weeks }
    // One current opening source per worker: a second ID cannot reset the cap.
    return this.store.append(actor,'ny-dbl-evidence',person,revision(input.version),data,person,true,
      {objects:[{kind:'ny-dbl-plan',id:plan.id,version:plan.version,approved:true}],noPrivacyHold:person})
  }
  reviewed(row: Revision<unknown>, version: number) {
    if (row.version !== version || !row.sourcesCurrent || !row.approvedBy || row.withdrawnBy) fail('dbl_evidence_not_current_reviewed',409)
  }
  async inputs(actor: Actor, person: string, version: number) {
    const evidence = await this.store.find<Evidence>(actor,'ny-dbl-evidence',person,person,true)
    this.reviewed(evidence,version)
    const plan = await this.store.find<Plan>(actor,'ny-dbl-plan',evidence.data.planId,undefined,true)
    this.reviewed(plan,evidence.data.planVersion)
    return {evidence,plan}
  }
  async history(actor: Actor, person: string) {
    await this.scope(actor,person)
    return {evidence:await this.store.list<Evidence>(actor,'ny-dbl-evidence',person,true),proposals:await this.store.list<Proposal>(actor,'ny-dbl-proposal',person,true)}
  }
  async prepare(actor: Actor, person: string, input: Input) {
    await this.scope(actor,person)
    keys(input, ['id','version','evidenceVersion','checks'])
    const {evidence,plan} = await this.inputs(actor,person,integer(input.evidenceVersion))
    if (!Array.isArray(input.checks) || !input.checks.length || input.checks.length > 108) fail('dbl_checks_required')
    const checks = (input.checks as Input[]).map(c => {
      keys(c, ['reference','weekFrom','wagesCents'])
      const weekFrom = date(c.weekFrom)
      if (!evidence.data.weeks.some(w => w.from === weekFrom)) fail('dbl_weekly_evidence_required')
      return {reference:objectId(c.reference),weekFrom,wagesCents:cents(c.wagesCents)}
    }).sort((a,b) => a.weekFrom.localeCompare(b.weekFrom) || a.reference.localeCompare(b.reference))
    if (new Set(checks.map(c=>c.reference)).size !== checks.length) fail('dbl_duplicate_check',409)
    const id = objectId(input.id), fingerprint = await digest(JSON.stringify({evidenceVersion:evidence.version,checks}))
    const pins = await collectionPins(this.store,actor,[{kind:'ny-dbl-proposal',personId:person,exceptId:id}])
    const history = await this.store.list<Proposal>(actor,'ny-dbl-proposal',person,true,false)
    const latest = history.filter((r,i) => history.findIndex(other=>other.id===r.id)===i)
    const prior = latest.find(r=>r.id===id)
    if (prior?.data.fingerprint === fingerprint && prior.sourcesCurrent) return {id,kind:'ny-dbl-proposal',version:prior.version,replayed:true,result:prior.data.result}
    const reserved = {weeks:{} as Record<string,{wages:number;amount:number}>,total:0}
    for (const row of latest.filter(r=>r.id!==id)) {
      if (row.data.checks.some(c=>checks.some(n=>n.reference===c.reference))) fail('dbl_check_already_prepared',409)
      reserved.total += row.data.result.proposedCents
      for (const w of row.data.result.rows) {
        const used = reserved.weeks[w.weekFrom] ??= {wages:0,amount:0}
        used.wages += w.wagesCents; used.amount += w.proposedCents
      }
    }
    const result = nyDblCalculation(plan.data,evidence.data,checks,reserved)
    const saved = await this.store.append(actor,'ny-dbl-proposal',id,revision(input.version),
      {fingerprint,evidenceId:evidence.id,evidenceVersion:evidence.version,checks,result},person,true,
      {objects:[{kind:'ny-dbl-plan',id:plan.id,version:plan.version,approved:true},{kind:'ny-dbl-evidence',id:evidence.id,version:evidence.version,approved:true}],
        condition:reviewInputFence(actor.company,pins),noPrivacyHold:person})
    return {...saved,result}
  }
  async calculation(actor: Actor, person: string, id: string, version: number) {
    await this.scope(actor,person)
    const row = await this.store.find<Proposal>(actor,'ny-dbl-proposal',id,person,true)
    if (row.version !== version || !row.sourcesCurrent) fail('dbl_proposal_stale',409)
    await this.inputs(actor,person,row.data.evidenceVersion)
    await this.store.list(actor,'ny-dbl-proposal',person,true,true,id)
    return row.data.result
  }
}
