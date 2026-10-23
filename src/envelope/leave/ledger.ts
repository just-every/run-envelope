import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, integer, PayrollError } from '../security'
import { WorkspaceStore, revision, choice, type Revision } from '../workspace/store'
import type { WorkDay } from '../workspace/allocations'

export const zero = (v: unknown) => v === 0 || v === '0' ? 0 : integer(v)
export interface LeavePolicy {
  hireDate: string
  capMinutes: number
  carryoverMinutes: number
  tiers: { years: number; earnedMinutes: number; workedMinutes: number }[]
  evidence: string
}
export interface LeaveEntry {
  sourceId: string
  sourceVersion: number
  owner: 'willow' | 'payroll'
  operation: 'accrual' | 'use' | 'adjustment' | 'transfer' | 'carryover'
  day: string
  deltaMinutes: number
  balanceMinutes: number
  minutes: number
  rateCents: number
  amountCents: number
  code: string
  evidence: string
  corrects: number | null
}
export interface LeaveAccount {
  personId: string
  owner: 'willow' | 'payroll'
  effectiveDate: string
  balanceMinutes: number
  policy: LeavePolicy
  entries: LeaveEntry[]
}
export const latest = <T>(rows: Revision<T>[]) => rows.filter((r, i, a) => a.findIndex((v) => v.id === r.id) === i)
export function approved(row: Revision<unknown>) {
  if (!row.approvedBy || row.withdrawnBy || !row.sourcesCurrent)
    throw new PayrollError('current_human_review_required', 409)
}
/** One reviewed, encrypted ledger per worker. Proposals never mutate the adopted balance. */
export class LeaveLedger {
  constructor(public store: WorkspaceStore) {}
  async read(actor: Actor, personId: string) {
    return this.store.list<LeaveAccount>(actor, 'leave-account', personId, true)
  }
  async open(actor: Actor, personId: string, input: Input) {
    await this.store.authority(actor, 'rates:propose', personId, true)
    if ((await this.read(actor, personId)).length) throw new PayrollError('leave_account_exists', 409)
    let raw = input.tiers
    if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch { throw new PayrollError('invalid_leave_tiers') } }
    if (!Array.isArray(raw) || !raw.length || raw.length > 20) throw new PayrollError('invalid_leave_tiers')
    const tiers = raw.map((v: Input) => ({ years: zero(v?.years), earnedMinutes: integer(v?.earnedMinutes), workedMinutes: integer(v?.workedMinutes) }))
    tiers.sort((a, b) => a.years - b.years)
    if (tiers[0].years !== 0 || new Set(tiers.map((t) => t.years)).size !== tiers.length) throw new PayrollError('invalid_leave_tiers')
    const policy: LeavePolicy = { hireDate: date(input.hireDate), capMinutes: integer(input.capMinutes), carryoverMinutes: zero(input.carryoverMinutes), tiers, evidence: text(input.policyEvidence, 500) }
    const balanceMinutes = zero(input.openingMinutes), effectiveDate = date(input.effectiveDate)
    if (balanceMinutes > policy.capMinutes || policy.carryoverMinutes > policy.capMinutes || effectiveDate < policy.hireDate) throw new PayrollError('invalid_leave_balance')
    const data: LeaveAccount = { personId, owner: choice(input.owner, ['willow', 'payroll']) as LeaveAccount['owner'], effectiveDate, balanceMinutes, policy, entries: [] }
    return this.store.append(actor, 'leave-account', 'leave-' + personId, 0, data, personId, true)
  }
  async record(actor: Actor, personId: string, input: Input) {
    const row = (await this.read(actor, personId))[0]
    if (!row) throw new PayrollError('leave_account_required', 409)
    const sourceId = text(input.sourceId, 120), sourceVersion = integer(input.sourceVersion)
    const same = row.data.entries.find((e) => e.sourceId === sourceId && e.sourceVersion === sourceVersion)
    // A replay cannot adopt a different payload or create a revision, even while review is pending.
    if (same) throw new PayrollError('leave_source_already_recorded', 409)
    if (!row.approvedBy || row.withdrawnBy) throw new PayrollError('current_human_review_required', 409)
    if (revision(input.version) !== row.version) throw new PayrollError('leave_version_changed', 409)
    if (row.data.entries.length >= 200) throw new PayrollError('leave_ledger_capacity_reached', 409)
    const day = date(input.day), operation = choice(input.operation, ['accrual', 'use', 'adjustment', 'transfer', 'carryover']) as LeaveEntry['operation']
    if (day < row.data.effectiveDate) throw new PayrollError('leave_before_opening')
    const prior = row.data.entries.filter((e) => e.sourceId === sourceId).at(-1)
    if (sourceVersion !== (prior?.sourceVersion ?? 0) + 1 || (prior && prior.operation !== operation)) throw new PayrollError('leave_source_version_conflict', 409)
    if (prior && prior.owner !== row.data.owner) throw new PayrollError('leave_prior_owner_reconciliation_required', 409)
    if (!prior && row.data.entries.some((e) => e.day > day)) throw new PayrollError('leave_out_of_order_reconciliation_required', 409)
    const evidence = text(input.evidence, 500), owner = row.data.owner
    let minutes = zero(input.minutes ?? 0), delta = 0, rateCents = 0, amountCents = 0
    let nextOwner = owner
    const deps: {kind: 'work'; id: string; version: number}[] = []
    if (operation === 'transfer') {
      if (prior) throw new PayrollError('leave_transfer_replay', 409)
      nextOwner = choice(input.owner, ['willow', 'payroll']) as LeaveAccount['owner']
      if (nextOwner === owner || zero(input.reconciledMinutes) !== row.data.balanceMinutes) throw new PayrollError('leave_transfer_not_reconciled', 409)
      delta = 0
    } else if (operation === 'carryover') {
      if (owner !== 'payroll' || day.slice(5) !== '01-01' || row.data.entries.some((e) => e.operation === 'carryover' && e.day === day)) throw new PayrollError('invalid_leave_carryover', 409)
      delta = Math.min(row.data.balanceMinutes, row.data.policy.carryoverMinutes) - row.data.balanceMinutes
    } else if (operation === 'accrual') {
      if (owner !== 'payroll') throw new PayrollError('willow_owns_leave_balance', 409)
      const work = (await this.store.list<WorkDay>(actor, 'work', personId, true, false)).find((w) => w.id === sourceId)
      if (!work || work.version !== sourceVersion || work.data.day !== day || !work.sourcesCurrent) throw new PayrollError('leave_work_source_changed', 409)
      const p = row.data.policy, anniversary = Number(day.slice(0, 4)) - Number(p.hireDate.slice(0, 4)) - (day.slice(5) < p.hireDate.slice(5) ? 1 : 0)
      const tier = p.tiers.filter((t) => t.years <= anniversary).at(-1)
      if (!tier) throw new PayrollError('leave_before_hire')
      minutes = Math.floor(work.data.minutes * tier.earnedMinutes / tier.workedMinutes)
      // Reconcile a corrected source by its difference; never accrue the original twice.
      const credited = row.data.entries.filter((e) => e.sourceId === sourceId).reduce((s, e) => s + e.deltaMinutes, 0)
      if (prior && (prior.minutes > credited || row.data.entries.some((e) => e.operation === 'carryover' && e.day > day))) throw new PayrollError('leave_capped_or_closed_year_reconciliation_required', 409)
      delta = Math.min(minutes, p.capMinutes - row.data.balanceMinutes + credited) - credited
      deps.push({kind: 'work', id: work.id, version: work.version})
    } else if (operation === 'use') {
      if (!minutes || choice(input.owner, ['willow', 'payroll']) !== owner) throw new PayrollError('leave_balance_owner_changed', 409)
      choice(input.code, ['pto', 'holiday', 'sick', 'unpaid', 'termination'])
      rateCents = input.code === 'unpaid' ? 0 : integer(input.rateCents)
      amountCents = Number((BigInt(minutes) * BigInt(rateCents) + 30n) / 60n)
      delta = -(minutes - (prior?.minutes ?? 0))
    } else {
      // A sourced reconciliation is explicit, reviewed and signed; never an automatic balance plug.
      const direction = choice(input.direction, ['credit', 'debit'])
      if (!minutes || prior) throw new PayrollError('invalid_leave_adjustment')
      delta = minutes * (direction === 'credit' ? 1 : -1)
    }
    const balanceMinutes = row.data.balanceMinutes + delta
    if (balanceMinutes < 0 || balanceMinutes > row.data.policy.capMinutes) throw new PayrollError('leave_balance_out_of_range', 409)
    const entry: LeaveEntry = { sourceId, sourceVersion, owner, operation, day, deltaMinutes: delta, balanceMinutes, minutes, rateCents, amountCents, code: operation === 'use' ? String(input.code) : '', evidence, corrects: prior?.sourceVersion ?? null }
    const workRows = await this.store.list<WorkDay>(actor, 'work', personId, true, false)
    for (const e of row.data.entries.filter((e, i, a) => e.operation === 'accrual' && !a.slice(i + 1).some((n) => n.sourceId === e.sourceId))) {
      if (e.sourceId === sourceId && operation === 'accrual') continue
      const w = workRows.find((w) => w.id === e.sourceId)
      if (!w || w.version !== e.sourceVersion || !w.sourcesCurrent) throw new PayrollError('leave_work_reconciliation_required', 409)
      deps.push({kind:'work', id:w.id, version:w.version})
    }
    return this.store.append(actor, 'leave-account', row.id, row.version, { ...row.data, owner: nextOwner, balanceMinutes, entries: [...row.data.entries, entry] }, personId, true, {
      objects: deps,
    })
  }
  async preview(actor: Actor, personId: string, from: string, through: string) {
    const row = (await this.read(actor, personId))[0]
    if (!row) return { row: undefined, minutes: 0, amountCents: 0, lines: [] as LeaveEntry[] }
    approved(row)
    const uses = row.data.entries.filter((e) => e.operation === 'use')
    const lines = uses.filter((e) => !uses.some((n) => n.sourceId === e.sourceId && n.sourceVersion > e.sourceVersion)).filter((e) => e.day >= from && e.day <= through)
    return { row, minutes: lines.reduce((s, e) => s + e.minutes, 0), amountCents: lines.reduce((s, e) => s + e.amountCents, 0), lines }
  }
}
