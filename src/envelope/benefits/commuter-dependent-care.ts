import type { Actor } from '../access'
import { fence } from '../access'
import type { Input } from '../records'
import { date, integer, PayrollError, text } from '../security'
import { WorkspaceStore, choice, revision, type Revision } from '../workspace/store'

const categories = ['transit', 'parking', 'dependent-care'] as const
type Category = typeof categories[number]
const filingStatuses = ['single', 'married-joint', 'married-separate', 'head-household', 'qualifying-survivor'] as const
interface Election {
  category: Category; taxYear: number; electedOn: string; effectiveFrom: string; effectiveThrough: string
  electedCents: number; evidenceReference: string
  dependentCare: null | {filingStatus: string; employeeEarnedIncomeCents: number; spouseEarnedIncomeCents: number | null; otherExcludedCents: number}
}
interface Accumulator {
  category: Category; taxYear: number; through: string; evidenceReference: string
  entries: {sourceId: string; date: string; benefitCents: number; excludedCents: number; deductionCents: number}[]
}
export interface BenefitSelection {
  personId: string; sourceId: string
  requests: {category: Category; amountCents: number; electionVersion: number; accumulatorVersion: number}[]
}
const cents = (value: unknown) => value === 0 ? 0 : integer(value)
const year = (value: unknown) => {
  if (value !== 2025 && value !== 2026) throw new PayrollError('benefit_tax_year_unavailable')
  return value
}
const category = (value: unknown) => choice(value, categories) as Category
const idFor = (person: string, kind: Category, taxYear: number) => `${kind}-${person}-${taxYear}`
const sameYear = (value: unknown, taxYear: number) => {
  const result = date(value)
  if (!result.startsWith(taxYear + '-')) throw new PayrollError('benefit_date_outside_tax_year')
  return result
}
const source = (taxYear: number) => ({
  title: `IRS Publication 15-B (${taxYear})`,
  url: `https://www.irs.gov/pub/irs-prior/p15b--${taxYear}.pdf`,
  sections: ['Dependent Care Assistance: exclusion from wages and Form W-2', 'Qualified Transportation Benefits: exclusion from wages'],
})
const current = (row: Revision<unknown>) => {
  if (!row.sourcesCurrent || !row.approvedBy || row.withdrawnBy) throw new PayrollError('reviewed_current_benefit_source_required', 409)
}

/** Reviewed preparation only. Imported totals are evidence, never a collection ledger. */
export class CommuterDependentCare {
  constructor(public store: WorkspaceStore) {}
  async authority(actor: Actor, personId: string) {
    const {records} = this.store
    if (actor.session.kind !== 'native' || actor.grant.role !== 'owner' || actor.session.operator.role !== 'owner'
      || actor.session.operator.email.trim().toLowerCase() !== records.env.OWNER_EMAIL.trim().toLowerCase())
      throw new PayrollError('native_benefit_owner_required', 403)
    await records.person(actor, personId)
    return fence(actor)
  }
  async list(actor: Actor, personId: string) {
    await this.authority(actor, personId)
    return {
      elections: await this.store.list<Election>(actor, 'pretax-election', personId, true),
      accumulators: await this.store.list<Accumulator>(actor, 'pretax-accumulator', personId, true),
    }
  }
  async saveElection(actor: Actor, personId: string, input: Input) {
    await this.authority(actor, personId)
    const taxYear = year(input.taxYear), kind = category(input.category)
    const effectiveFrom = sameYear(input.effectiveFrom, taxYear), effectiveThrough = sameYear(input.effectiveThrough, taxYear), electedOn = date(input.electedOn)
    if (electedOn > effectiveFrom || effectiveFrom > effectiveThrough) throw new PayrollError('prospective_benefit_election_required')
    let dependentCare: Election['dependentCare'] = null
    if (kind === 'dependent-care') {
      const facts = input.dependentCare as Input
      if (!facts || typeof facts !== 'object') throw new PayrollError('dependent_care_facts_required')
      const filingStatus = choice(facts.filingStatus, filingStatuses), married = filingStatus.startsWith('married-')
      dependentCare = {filingStatus, employeeEarnedIncomeCents: cents(facts.employeeEarnedIncomeCents),
        spouseEarnedIncomeCents: married ? cents(facts.spouseEarnedIncomeCents) : null, otherExcludedCents: cents(facts.otherExcludedCents)}
    } else if (input.dependentCare != null) throw new PayrollError('dependent_care_facts_on_commuter_election')
    const data: Election = {category: kind, taxYear, effectiveFrom, effectiveThrough, electedOn,
      electedCents: cents(input.electedCents), evidenceReference: text(input.evidenceReference, 1000), dependentCare}
    return this.store.append(actor, 'pretax-election', idFor(personId, kind, taxYear), revision(input.version), data, personId, true, {noPrivacyHold: personId})
  }
  async saveAccumulator(actor: Actor, personId: string, input: Input) {
    await this.authority(actor, personId)
    const taxYear = year(input.taxYear), kind = category(input.category), through = sameYear(input.through, taxYear)
    if (!Array.isArray(input.entries) || input.entries.length > 200) throw new PayrollError('dated_benefit_accumulator_required')
    const entries = input.entries.map((row: Input) => {
      const day = sameYear(row.date, taxYear), benefitCents = cents(row.benefitCents), excludedCents = cents(row.excludedCents), deductionCents = cents(row.deductionCents)
      if (day > through || excludedCents > benefitCents || deductionCents > benefitCents) throw new PayrollError('invalid_benefit_accumulator')
      return {sourceId: text(row.sourceId, 160), date: day, benefitCents, excludedCents, deductionCents}
    }).sort((a, b) => a.date.localeCompare(b.date) || a.sourceId.localeCompare(b.sourceId))
    if (new Set(entries.map(row => row.sourceId)).size !== entries.length) throw new PayrollError('duplicate_benefit_source', 409)
    if (entries.reduce((sum, row) => sum + row.benefitCents, 0) > 100_000_000) throw new PayrollError('invalid_benefit_accumulator')
    const data: Accumulator = {category: kind, taxYear, through, entries, evidenceReference: text(input.evidenceReference, 1000)}
    return this.store.append(actor, 'pretax-accumulator', idFor(personId, kind, taxYear), revision(input.version), data, personId, true, {noPrivacyHold: personId})
  }
  async review(actor: Actor, personId: string, kind: 'pretax-election' | 'pretax-accumulator', id: string) {
    await this.authority(actor, personId)
    return this.store.review(actor, kind, id, personId)
  }
  async decide(actor: Actor, personId: string, kind: 'pretax-election' | 'pretax-accumulator', id: string, input: Input) {
    await this.authority(actor, personId)
    return this.store.decide(actor, kind, id, input, personId, input.withdraw === true)
  }
  async prepare(actor: Actor, payDate: string, selection: BenefitSelection) {
    if (!selection || typeof selection !== 'object') throw new PayrollError('benefit_selection_required')
    await this.authority(actor, text(selection.personId, 80))
    date(payDate)
    const taxYear = year(Number(payDate.slice(0, 4)))
    const sourceId = text(selection.sourceId, 160)
    if (!Array.isArray(selection.requests) || !selection.requests.length || selection.requests.length > 3)
      throw new PayrollError('benefit_requests_required')
    const seen = new Set<Category>(), rows = []
    for (const request of selection.requests) {
      const kind = category(request.category)
      if (seen.has(kind)) throw new PayrollError('duplicate_benefit_category')
      seen.add(kind)
      const id = idFor(selection.personId, kind, taxYear)
      const election = await this.store.find<Election>(actor, 'pretax-election', id, selection.personId, true)
      const accumulator = await this.store.find<Accumulator>(actor, 'pretax-accumulator', id, selection.personId, true)
      current(election); current(accumulator)
      if (election.version !== integer(request.electionVersion) || accumulator.version !== integer(request.accumulatorVersion))
        throw new PayrollError('benefit_source_version_changed', 409)
      if (payDate < election.data.effectiveFrom || payDate > election.data.effectiveThrough || accumulator.data.through > payDate)
        throw new PayrollError('benefit_period_or_accumulator_stale', 409)
      if (accumulator.data.entries.some(row => row.sourceId === sourceId)) throw new PayrollError('benefit_source_already_accumulated', 409)
      const prior = accumulator.data.entries.filter(row => kind === 'dependent-care' || row.date.slice(0, 7) === payDate.slice(0, 7))
      const priorExcludedCents = prior.reduce((sum, row) => sum + row.excludedCents, 0)
      const priorDeductionCents = prior.reduce((sum, row) => sum + row.deductionCents, 0)
      const amountCents = cents(request.amountCents)
      if (priorDeductionCents + amountCents > election.data.electedCents) throw new PayrollError('benefit_election_amount_exceeded', 409)
      const facts = election.data.dependentCare
      const statutoryLimitCents = kind !== 'dependent-care' ? (taxYear === 2026 ? 34000 : 32500)
        : (taxYear === 2026 ? 750000 : 500000) / (facts!.filingStatus === 'married-separate' ? 2 : 1)
      const effectiveLimitCents = facts ? Math.min(statutoryLimitCents, facts.employeeEarnedIncomeCents, facts.spouseEarnedIncomeCents ?? statutoryLimitCents) : statutoryLimitCents
      const otherExcludedCents = facts?.otherExcludedCents ?? 0
      const remainingExclusionCents = Math.max(0, effectiveLimitCents - priorExcludedCents - otherExcludedCents)
      const excludedCents = Math.min(amountCents, remainingExclusionCents)
      rows.push({category: kind, period: kind === 'dependent-care' ? String(taxYear) : payDate.slice(0, 7),
        election: {id, version: election.version, reviewedBy: election.approvedBy},
        accumulator: {id, version: accumulator.version, through: accumulator.data.through, reviewedBy: accumulator.approvedBy},
        statutoryLimitCents, effectiveLimitCents, priorExcludedCents, otherExcludedCents, priorDeductionCents,
        proposedDeductionCents: amountCents, proposedPretaxDeductionCents: excludedCents,
        proposedAfterTaxDeductionCents: amountCents - excludedCents, taxableExcessCents: amountCents - excludedCents,
        remainingExclusionCents: remainingExclusionCents - excludedCents,
        priorExcessRequiringCorrectionCents: Math.max(0, priorExcludedCents + otherExcludedCents - effectiveLimitCents),
        proposedW2Box10Cents: facts ? prior.reduce((sum, row) => sum + row.benefitCents, 0) + amountCents : null,
        source: source(taxYear)})
    }
    // Re-read every pin before exposing private data; corrections cannot silently
    // fall back to a different reviewed election or an empty accumulator.
    for (const row of rows) for (const [kind, pin] of [['pretax-election', row.election], ['pretax-accumulator', row.accumulator]] as const) {
      const latest = await this.store.find(actor, kind, pin.id, selection.personId, true)
      current(latest)
      if (latest.version !== pin.version) throw new PayrollError('benefit_source_version_changed', 409)
    }
    await this.store.records.company(await this.store.records.actor(actor.company))
    return {personId: selection.personId, sourceId, taxYear, rows,
      proposedDeductionCents: rows.reduce((sum, row) => sum + row.proposedDeductionCents, 0),
      federalWageReductionCents: rows.reduce((sum, row) => sum + row.proposedPretaxDeductionCents, 0),
      collected: false, reimbursed: false, remitted: false,
      limitations: ['Reviewed salary-reduction proposal only; preview never advances imported accumulators.',
        'Eligibility, substantiation, nondiscrimination, spouse special rules and actual administrator evidence remain unverified.',
        'State tax treatment, commuter ordinances, HRA reimbursement and complete year-end reporting remain unproved.']}
  }
}
export type PreparedBenefits = Awaited<ReturnType<CommuterDependentCare['prepare']>>
