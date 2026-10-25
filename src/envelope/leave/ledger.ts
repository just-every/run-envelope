import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, integer, PayrollError } from '../security'
import {
  WorkspaceStore,
  revision,
  choice,
  type Revision,
  type Sources,
} from '../workspace/store'
import type { WorkDay } from '../workspace/allocations'
import { collectionPins } from '../workspace/review-inputs'

export const zero = (v: unknown) => (v === 0 || v === '0' ? 0 : integer(v))
export interface LeavePolicy {
  hireDate: string
  capMinutes: number
  carryoverMinutes: number
  tiers: { years: number; earnedMinutes: number; workedMinutes: number }[]
  evidence: string
  statutory?: { profile: 'ca-sick-accrual-2024'; dayMinutes: number; source: string }
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
  accrualCapped?: boolean
  workedMinutes?: number
  handoff?: { kind: 'hris-event'; id: string; version: number; approved: true }
}
export const leaveBucket = (value: unknown) => choice(value ?? 'combined', ['combined', 'sick', 'pto', 'holiday'])
export const leaveId = (personId: string, bucket: string) => 'leave-' + personId + (bucket === 'combined' ? '' : '-' + bucket)
export interface LeaveAccount {
  bucket?: string
  personId: string
  owner: 'willow' | 'payroll'
  effectiveDate: string
  balanceMinutes: number
  policy: LeavePolicy
  entries: LeaveEntry[]
}
export const latest = <T>(rows: Revision<T>[]) =>
  rows.filter((r, i, a) => a.findIndex((v) => v.id === r.id) === i)
export function approved(row: Revision<unknown>) {
  if (!row.approvedBy || row.withdrawnBy || !row.sourcesCurrent)
    throw new PayrollError('current_human_review_required', 409)
}
/** Each leave bank has its own reviewed, encrypted ledger and balance owner. */
export class LeaveLedger {
  constructor(public store: WorkspaceStore) {}
  async read(actor: Actor, personId: string, audited = true) {
    return this.store.list<LeaveAccount>(
      actor,
      'leave-account',
      personId,
      true,
      audited,
    )
  }
  async open(actor: Actor, personId: string, input: Input) {
    await this.store.authority(actor, 'rates:propose', personId, true)
    const bucket = leaveBucket(input.bucket), existing = latest(await this.read(actor, personId, false))
    if (existing.some(r => (r.data.bucket ?? 'combined') === bucket))
      throw new PayrollError('leave_account_exists', 409)
    if (existing.some(r => bucket === 'combined' || (r.data.bucket ?? 'combined') === 'combined'))
      throw new PayrollError('leave_combined_bank_reconciliation_required', 409)
    let raw = input.tiers
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        throw new PayrollError('invalid_leave_tiers')
      }
    }
    if (!Array.isArray(raw) || !raw.length || raw.length > 20)
      throw new PayrollError('invalid_leave_tiers')
    const tiers = raw.map((v: Input) => ({
      years: zero(v?.years),
      earnedMinutes: integer(v?.earnedMinutes),
      workedMinutes: integer(v?.workedMinutes),
    }))
    tiers.sort((a, b) => a.years - b.years)
    if (
      tiers[0].years !== 0 ||
      new Set(tiers.map((t) => t.years)).size !== tiers.length
    )
      throw new PayrollError('invalid_leave_tiers')
    const policy: LeavePolicy = {
      hireDate: date(input.hireDate),
      capMinutes: integer(input.capMinutes),
      carryoverMinutes: zero(input.carryoverMinutes),
      tiers,
      evidence: text(input.policyEvidence, 500),
    }
    if (input.statutoryProfile && input.statutoryProfile !== 'reviewed-custom') {
      if (input.statutoryProfile !== 'ca-sick-accrual-2024')
        throw new PayrollError('unsupported_leave_statutory_profile', 409)
      const person = await this.store.records.person(actor, personId)
      const location = (await this.store.records.locations(actor)).find(l => l.id === person.locationId)
      const dayMinutes = integer(input.dayMinutes)
      // This bounded method is the California one-hour-per-30-hours accrual path.
      // Longer normal days retain the greater ten-day balance floor.
      if (bucket !== 'sick' || location?.state !== 'CA' || dayMinutes > 1440 || date(input.effectiveDate) < '2024-01-01'
        || policy.capMinutes < Math.max(4800, dayMinutes * 10)
        || policy.carryoverMinutes !== policy.capMinutes
        || tiers.some(t => t.earnedMinutes * 30 !== t.workedMinutes))
        throw new PayrollError('ca_sick_accrual_policy_requires_correction', 409)
      policy.statutory = { profile: 'ca-sick-accrual-2024', dayMinutes,
        source: 'https://www.dir.ca.gov/dlse/paid_sick_leave.htm' }
    }
    const balanceMinutes = zero(input.openingMinutes),
      effectiveDate = date(input.effectiveDate)
    if (
      balanceMinutes > policy.capMinutes ||
      policy.carryoverMinutes > policy.capMinutes ||
      effectiveDate < policy.hireDate
    )
      throw new PayrollError('invalid_leave_balance')
    const data: LeaveAccount = {
      bucket,
      personId,
      owner: choice(input.owner, [
        'willow',
        'payroll',
      ]) as LeaveAccount['owner'],
      effectiveDate,
      balanceMinutes,
      policy,
      entries: [],
    }
    return this.store.append(
      actor,
      'leave-account',
      leaveId(personId, bucket),
      0,
      data,
      personId,
      true,
    )
  }
  async record(
    actor: Actor,
    personId: string,
    input: Input,
    handoff?: LeaveEntry['handoff'],
  ) {
    await this.store.authority(actor, 'rates:propose', personId, true)
    const bucket = leaveBucket(input.bucket)
    const reviewSets = await collectionPins(this.store, actor, [{ kind: 'leave-account', personId, exceptId: leaveId(personId, bucket) }])
    const accounts = await this.read(actor, personId, false)
    const history = accounts.filter(r => (r.data.bucket ?? 'combined') === bucket),
      row = history[0]
    if (!row) throw new PayrollError('leave_account_required', 409)
    const sourceId = text(input.sourceId, 120),
      sourceVersion = integer(input.sourceVersion)
    if (input.operation === 'use' && latest(accounts).some(r => r.id !== row.id && r.data.entries.some(e => e.operation === 'use' && e.sourceId === sourceId)))
      throw new PayrollError('leave_source_bank_reconciliation_required', 409)
    const same = row.data.entries.find(
      (e) => e.sourceId === sourceId && e.sourceVersion === sourceVersion,
    )
    // A replay cannot adopt a different payload or create a revision, even while review is pending.
    if (same) throw new PayrollError('leave_source_already_recorded', 409)
    const revising =
      input.revisePending === true || input.revisePending === 'true'
    if (
      row.withdrawnBy ||
      (!row.approvedBy &&
        !(revising && history.some((r) => r.approvedBy && !r.withdrawnBy)))
    )
      throw new PayrollError('current_human_review_required', 409)
    if (revision(input.version) !== row.version)
      throw new PayrollError('leave_version_changed', 409)
    if (row.data.entries.length >= 200)
      throw new PayrollError('leave_ledger_capacity_reached', 409)
    const day = date(input.day),
      operation = choice(input.operation, [
        'accrual',
        'use',
        'adjustment',
        'transfer',
        'carryover',
      ]) as LeaveEntry['operation']
    if (day < row.data.effectiveDate)
      throw new PayrollError('leave_before_opening')
    const prior = row.data.entries.filter((e) => e.sourceId === sourceId).at(-1)
    if (
      sourceVersion !== (prior?.sourceVersion ?? 0) + 1 ||
      (prior && prior.operation !== operation)
    )
      throw new PayrollError('leave_source_version_conflict', 409)
    if (prior && prior.owner !== row.data.owner)
      throw new PayrollError('leave_prior_owner_reconciliation_required', 409)
    if (!prior && row.data.entries.some((e) => e.day > day))
      throw new PayrollError('leave_out_of_order_reconciliation_required', 409)
    const evidence = text(input.evidence, 500),
      owner = row.data.owner
    let minutes = zero(input.minutes ?? 0),
      delta = 0,
      rateCents = 0,
      amountCents = 0
    let accrualCapped: boolean | undefined
    let workedMinutes: number | undefined
    let nextOwner = owner
    const deps: NonNullable<Sources['objects']> = []
    if (prior?.handoff && !handoff)
      throw new PayrollError('hris_leave_source_required', 409)
    if (operation === 'transfer') {
      if (prior) throw new PayrollError('leave_transfer_replay', 409)
      nextOwner = choice(input.owner, [
        'willow',
        'payroll',
      ]) as LeaveAccount['owner']
      if (
        nextOwner === owner ||
        zero(input.reconciledMinutes) !== row.data.balanceMinutes
      )
        throw new PayrollError('leave_transfer_not_reconciled', 409)
      delta = 0
    } else if (operation === 'carryover') {
      if (
        owner !== 'payroll' ||
        day.slice(5) !== '01-01' ||
        row.data.entries.some(
          (e) => e.operation === 'carryover' && e.day === day,
        )
      )
        throw new PayrollError('invalid_leave_carryover', 409)
      delta =
        Math.min(row.data.balanceMinutes, row.data.policy.carryoverMinutes) -
        row.data.balanceMinutes
    } else if (operation === 'accrual') {
      if (owner !== 'payroll')
        throw new PayrollError('willow_owns_leave_balance', 409)
      const work = (
        await this.store.list<WorkDay>(actor, 'work', personId, true, false)
      ).find((w) => w.id === sourceId)
      if (
        !work ||
        work.version !== sourceVersion ||
        work.data.day !== day ||
        !work.sourcesCurrent
      )
        throw new PayrollError('leave_work_source_changed', 409)
      const p = row.data.policy,
        anniversary =
          Number(day.slice(0, 4)) -
          Number(p.hireDate.slice(0, 4)) -
          (day.slice(5) < p.hireDate.slice(5) ? 1 : 0)
      const tier = p.tiers.filter((t) => t.years <= anniversary).at(-1)
      if (!tier) throw new PayrollError('leave_before_hire')
      minutes = Math.floor(
        (work.data.minutes * tier.earnedMinutes) / tier.workedMinutes,
      )
      // Reconcile a corrected source by its difference; never accrue the original twice.
      const credited = row.data.entries
        .filter((e) => e.sourceId === sourceId)
        .reduce((s, e) => s + e.deltaMinutes, 0)
      if (
        prior &&
        (prior.minutes > credited ||
          row.data.entries.some(
            (e) => e.operation === 'carryover' && e.day > day,
          ))
      )
        throw new PayrollError(
          'leave_capped_or_closed_year_reconciliation_required',
          409,
        )
      delta =
        Math.min(minutes, p.capMinutes - row.data.balanceMinutes + credited) -
        credited
      if (p.statutory) {
        const accruals = row.data.entries.filter((e, i, a) => e.operation === 'accrual'
          && !a.slice(i + 1).some(n => n.sourceId === e.sourceId))
        if (prior && row.data.entries.some(e => e.accrualCapped))
          throw new PayrollError('leave_capped_or_closed_year_reconciliation_required', 409)
        if (accruals.some(e => e.workedMinutes === undefined))
          throw new PayrollError('leave_statutory_history_reconciliation_required', 409)
        const totalBefore = accruals.reduce((n, e) => n + e.workedMinutes!, 0)
        const totalAfter = totalBefore - (prior?.workedMinutes ?? 0) + work.data.minutes
        const earnedDifference = Math.floor(totalAfter / 30) - Math.floor(totalBefore / 30)
        // Fractional earned minutes survive short work records. Capped or closed
        // history still requires the explicit reconciliation above.
        delta = Math.min(earnedDifference, p.capMinutes - row.data.balanceMinutes)
        accrualCapped = delta < earnedDifference
        minutes = credited + delta
        workedMinutes = work.data.minutes
      }
      deps.push({ kind: 'work', id: work.id, version: work.version })
    } else if (operation === 'use') {
      if (!minutes || choice(input.owner, ['willow', 'payroll']) !== owner)
        throw new PayrollError('leave_balance_owner_changed', 409)
      choice(input.code, ['pto', 'holiday', 'sick', 'unpaid', 'termination'])
      if (bucket !== 'combined' && ![bucket, 'unpaid', 'termination'].includes(String(input.code)))
        throw new PayrollError('leave_code_bank_conflict', 409)
      rateCents = input.code === 'unpaid' ? 0 : integer(input.rateCents)
      amountCents = Number((BigInt(minutes) * BigInt(rateCents) + 30n) / 60n)
      const debitMinutes = input.code === 'unpaid' ? 0 : minutes
      const priorDebit = prior?.code === 'unpaid' ? 0 : (prior?.minutes ?? 0)
      delta = -(debitMinutes - priorDebit)
    } else {
      // A sourced reconciliation is explicit, reviewed and signed; never an automatic balance plug.
      const direction = choice(input.direction, ['credit', 'debit'])
      if (!minutes || prior) throw new PayrollError('invalid_leave_adjustment')
      delta = minutes * (direction === 'credit' ? 1 : -1)
    }
    const balanceMinutes = row.data.balanceMinutes + delta
    if (balanceMinutes < 0 || balanceMinutes > row.data.policy.capMinutes)
      throw new PayrollError('leave_balance_out_of_range', 409)
    const entry: LeaveEntry = {
      sourceId,
      sourceVersion,
      owner,
      operation,
      day,
      deltaMinutes: delta,
      balanceMinutes,
      minutes,
      rateCents,
      amountCents,
      code: operation === 'use' ? String(input.code) : '',
      evidence,
      corrects: prior?.sourceVersion ?? null,
      ...(workedMinutes === undefined ? {} : { workedMinutes, accrualCapped }),
      ...(handoff ? { handoff } : {}),
    }
    const workRows = await this.store.list<WorkDay>(
      actor,
      'work',
      personId,
      true,
      false,
    )
    for (const e of row.data.entries.filter(
      (e, i, a) =>
        e.operation === 'accrual' &&
        !a.slice(i + 1).some((n) => n.sourceId === e.sourceId),
    )) {
      if (e.sourceId === sourceId && operation === 'accrual') continue
      const w = workRows.find((w) => w.id === e.sourceId)
      if (!w || w.version !== e.sourceVersion || !w.sourcesCurrent)
        throw new PayrollError('leave_work_reconciliation_required', 409)
      deps.push({ kind: 'work', id: w.id, version: w.version })
    }
    const ledgerEntries = [...row.data.entries, entry]
    for (const e of ledgerEntries.filter(
      (e, i, a) =>
        e.handoff && !a.slice(i + 1).some((n) => n.sourceId === e.sourceId),
    ))
      deps.push(e.handoff!)
    return this.store.append(
      actor,
      'leave-account',
      row.id,
      row.version,
      {
        ...row.data,
        owner: nextOwner,
        balanceMinutes,
        entries: [...row.data.entries, entry],
      },
      personId,
      true,
      {
        objects: deps,
        reviewSets,
      },
    )
  }
  async preview(actor: Actor, personId: string, from: string, through: string) {
    const rows = latest(await this.read(actor, personId))
    const lines: (LeaveEntry & { bucket: string })[] = []
    for (const row of rows) {
      approved(row)
      const uses = row.data.entries.filter(e => e.operation === 'use')
      lines.push(...uses.filter(e =>
        !uses.some(n => n.sourceId === e.sourceId && n.sourceVersion > e.sourceVersion)
        && e.day >= from && e.day <= through,
      ).map(e => ({ ...e, bucket: row.data.bucket ?? 'combined' })))
    }
    return {
      rows,
      minutes: lines.reduce((s, e) => s + e.minutes, 0),
      amountCents: lines.reduce((s, e) => s + e.amountCents, 0),
      lines,
    }
  }
}
