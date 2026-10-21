import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, integer, PayrollError } from '../security'
import {
  WorkspaceStore,
  objectId,
  revision,
  choice,
  optional,
  type Revision,
  type Sources,
  type Kind,
  digest,
} from './store'
import { addDays } from './schedules'
import type { WorkDay } from './allocations'
import { periodRules, ruleFingerprint, type PayrollRule } from './rules'

export interface Group {
  name: string
  people: { id: string; version: number; name: string }[]
}
export interface PayItem {
  name: string
  groupId: string
  groupVersion: number
  amountCents: number
  taxCode: string
  effectiveDate: string
  recurring: boolean
  evidenceRef: string
  returnExcessBy: string
}
export interface PayChange {
  name: string
  groupId: string
  groupVersion: number
  effectiveDate: string
  items: {
    personId: string
    personVersion: number
    personName: string
    rateCents: number
    basis: string
    employmentFrom: string
    employmentThrough: string
    unpaidDates: string[]
  }[]
}
export interface EarningsRun {
  periodStart: string
  periodEnd: string
  payDate: string
  frequency: string
  groupId: string
  people: {
    id: string
    name: string
    earningsCents: number
    taxableCashCents: number
    reimbursementCents: number
    afterTaxDeductionCents: number
    details: string[]
  }[]
  holds: { personId: string; reason: string }[]
  grossCashCents: number
  taxableCashCents: number
  reimbursementCents: number
  afterTaxDeductionCents: number
  taxAmounts: null
  netPay: null
  paymentReady: false
  setupFingerprint: string
  locationStates: string[]
  ruleFingerprint: string
  ruleSources: {
    id: string
    version: number
    name: string
    determination: string
    approved: boolean
  }[]
}
const latest = <T>(rows: Revision<T>[]) =>
  rows.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
const effective = (r: Revision<{ effectiveDate: string }>, day: string) =>
  r.approvedBy && !r.withdrawnBy && r.sourcesCurrent && r.data.effectiveDate <= day
const money = (n: bigint, d: bigint) => Number((n + d / 2n) / d)
const fingerprint = (
  groupId: string,
  changes: Revision<PayChange>[],
  items: Revision<PayItem>[],
) =>
  digest(
    JSON.stringify(
      [...changes, ...items]
        .filter((r) => r.data.groupId === groupId)
        .map((r) => [
          r.kind,
          r.id,
          r.version,
          r.approvedBy,
          r.withdrawnBy,
          r.sourcesCurrent,
        ])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ),
  )
const list = (v: unknown): unknown[] =>
  Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
export class PayItems {
  constructor(public store: WorkspaceStore) {}
  async group(actor: Actor, input: Input) {
    const ids = list(input.people).map((v) => text(v))
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
      throw new PayrollError('invalid_group_members')
    const people = await Promise.all(
      ids.map((id) => this.store.records.person(actor, id)),
    )
    return this.store.append(
      actor,
      'group',
      objectId(input.id),
      revision(input.version),
      {
        name: text(input.name),
        people: people.map((p) => ({ id: p.id, version: p.version, name: p.name })),
      },
      undefined,
      true,
      { people: people.map((p) => ({ id: p.id, version: p.version })) },
    )
  }
  async approvedGroup(actor: Actor, id: string) {
    const row = await this.store.find<Group>(actor, 'group', id, undefined, true)
    if (!row.approvedBy || row.withdrawnBy || !row.sourcesCurrent)
      throw new PayrollError('group_requires_current_human_approval', 409)
    return row
  }
  async item(actor: Actor, input: Input) {
    const group = await this.approvedGroup(actor, objectId(input.groupId)),
      taxCode = choice(input.taxCode, [
        'w2-cash-earning',
        'accountable-reimbursement',
        'after-tax-deduction',
      ]),
      effectiveDate = date(input.effectiveDate)
    const amountCents = integer(input.amountCents),
      evidenceRef = optional(input.evidenceRef, 500),
      returnExcessBy =
        taxCode === 'accountable-reimbursement' ? date(input.returnExcessBy) : ''
    if (
      taxCode === 'accountable-reimbursement' &&
      (!evidenceRef || returnExcessBy < effectiveDate)
    )
      throw new PayrollError('accountable_plan_evidence_required')
    const data: PayItem = {
      name: text(input.name),
      groupId: group.id,
      groupVersion: group.version,
      amountCents,
      taxCode,
      effectiveDate,
      recurring: input.recurring === true || input.recurring === 'true',
      evidenceRef,
      returnExcessBy,
    }
    return this.store.append(
      actor,
      'pay-item',
      objectId(input.id),
      revision(input.version),
      data,
      undefined,
      true,
      {
        people: group.data.people.map((p) => ({ id: p.id, version: p.version })),
        objects: [
          { kind: 'group', id: group.id, version: group.version, approved: true },
        ],
      },
    )
  }
  async change(actor: Actor, input: Input) {
    const group = await this.approvedGroup(actor, objectId(input.groupId)),
      effectiveDate = date(input.effectiveDate)
    let raw: unknown = input.items
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        throw new PayrollError('invalid_pay_change')
      }
    }
    if (!Array.isArray(raw) || !raw.length || raw.length > 100)
      throw new PayrollError('invalid_pay_change')
    const seen = new Set<string>(),
      items: PayChange['items'] = []
    for (const value of raw) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new PayrollError('invalid_pay_change')
      const item = value as Input,
        personId = objectId(item.personId),
        person = await this.store.records.person(actor, personId)
      if (!group.data.people.some((p) => p.id === personId) || seen.has(personId))
        throw new PayrollError('person_outside_reviewed_group')
      if (integer(item.personVersion) !== person.version)
        throw new PayrollError('person_source_stale', 409)
      const employmentFrom = date(item.employmentFrom),
        employmentThrough = date(item.employmentThrough),
        unpaidDates = list(item.unpaidDates).map(date)
      if (
        employmentFrom > employmentThrough ||
        unpaidDates.length > 366 ||
        new Set(unpaidDates).size !== unpaidDates.length
      )
        throw new PayrollError('invalid_employment_period')
      items.push({
        personId,
        personVersion: person.version,
        personName: person.name,
        rateCents: integer(item.rateCents),
        basis: choice(item.basis, ['hourly', 'annual-salary']),
        employmentFrom,
        employmentThrough,
        unpaidDates,
      })
      seen.add(personId)
    }
    const data: PayChange = {
      name: text(input.name),
      groupId: group.id,
      groupVersion: group.version,
      effectiveDate,
      items,
    }
    return this.store.append(
      actor,
      'pay-change',
      objectId(input.id),
      revision(input.version),
      data,
      undefined,
      true,
      {
        people: items.map((p) => ({ id: p.personId, version: p.personVersion })),
        objects: [
          { kind: 'group', id: group.id, version: group.version, approved: true },
        ],
      },
    )
  }
  async read(actor: Actor) {
    await this.store.authority(actor, 'records:read', undefined, true)
    const groups = await this.store.list<Group>(actor, 'group', undefined, true),
      items = await this.store.list<PayItem>(actor, 'pay-item', undefined, true),
      changes = await this.store.list<PayChange>(actor, 'pay-change', undefined, true),
      runs = await this.store.list<EarningsRun>(actor, 'earnings-run', undefined, true)
    const rules = await this.store.list<PayrollRule>(
      actor,
      'rule',
      undefined,
      true,
      false,
    )
    return {
      groups,
      items,
      changes,
      runs: await Promise.all(
        runs.map(async (r) => ({
          ...r,
          sourceStatus:
            r.sourcesCurrent &&
            r.data.setupFingerprint ===
              (await fingerprint(r.data.groupId, changes, items)) &&
            r.data.ruleFingerprint ===
              (await ruleFingerprint(
                rules,
                r.data.locationStates,
                r.data.periodStart,
                r.data.periodEnd,
              ))
              ? 'current'
              : 'changed-repreview-required',
        })),
      ),
    }
  }
  async preview(actor: Actor, input: Input, persist?: false): Promise<EarningsRun>
  async preview(
    actor: Actor,
    input: Input,
    persist: true,
  ): Promise<{ id: string; kind: Kind; version: number; preview: EarningsRun }>
  async preview(actor: Actor, input: Input, persist = false) {
    const group = await this.approvedGroup(actor, objectId(input.groupId)),
      periodStart = date(input.periodStart),
      periodEnd = date(input.periodEnd),
      payDate = date(input.payDate),
      frequency = choice(input.frequency, [
        'weekly',
        'biweekly',
        'semimonthly',
        'monthly',
      ])
    const days = (Date.parse(periodEnd) - Date.parse(periodStart)) / 86400000 + 1
    if (days < 1 || days > 31 || payDate < periodEnd)
      throw new PayrollError('invalid_pay_period')
    const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[frequency]!
    const allChanges = await this.store.list<PayChange>(
        actor,
        'pay-change',
        undefined,
        true,
        false,
      ),
      allItems = await this.store.list<PayItem>(actor, 'pay-item', undefined, true, false)
    const changes = latest(allChanges).filter((c) => c.data.groupId === group.id),
      items = latest(allItems).filter((i) => i.data.groupId === group.id)
    const people: EarningsRun['people'] = [],
      holds: EarningsRun['holds'] = [],
      objects: NonNullable<Sources['objects']> = [
        { kind: 'group', id: group.id, version: group.version, approved: true },
      ]
    for (const member of group.data.people) {
      const work = latest(
        await this.store.list<WorkDay>(actor, 'work', member.id, true, false),
      ).filter((w) => w.data.day >= periodStart && w.data.day <= periodEnd)
      let numerator = 0n,
        denominator = 1n,
        earnings = 0
      const details: string[] = []
      // Integer rational accumulation avoids daily salary-rounding drift.
      const add = (n: bigint, d: bigint) => {
        numerator = numerator * d + n * denominator
        denominator *= d
        const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a)
        const g = gcd(numerator, denominator)
        numerator /= g
        denominator /= g
      }
      const used = new Map<string, Revision<PayChange>>()
      for (let day = periodStart; day <= periodEnd; day = addDays(day, 1)) {
        const candidates = changes
          .filter(
            (c) =>
              c.data.effectiveDate <= day &&
              c.data.items.some((p) => p.personId === member.id),
          )
          .sort(
            (a, b) =>
              b.data.effectiveDate.localeCompare(a.data.effectiveDate) ||
              b.createdAt - a.createdAt,
          )
        const current = candidates[0]
        if (!current || !effective(current, day)) {
          holds.push({
            personId: member.id,
            reason: `${day}: no current human-approved effective pay setup; proposed changes cannot authorize underpayment or late wages.`,
          })
          continue
        }
        if (
          candidates.length > 1 &&
          candidates[1].data.effectiveDate === current.data.effectiveDate
        ) {
          holds.push({
            personId: member.id,
            reason: `${day}: contradictory effective pay setups require named review.`,
          })
          continue
        }
        used.set(current.id, current)
        const setup = current.data.items.find((p) => p.personId === member.id)!
        if (
          day < setup.employmentFrom ||
          day > setup.employmentThrough ||
          setup.unpaidDates.includes(day)
        )
          continue
        if (setup.basis === 'annual-salary')
          add(BigInt(setup.rateCents), BigInt(periods * days))
        else {
          const entries = work.filter((w) => w.data.day === day)
          const minutes = entries.reduce((s, w) => s + w.data.minutes, 0)
          if (minutes > 1440) {
            holds.push({
              personId: member.id,
              reason: `${day}: contradictory work minutes.`,
            })
            continue
          }
          // Hourly regular earnings only: overtime and premium coverage remain a hold.
          add(BigInt(minutes) * BigInt(setup.rateCents), 60n)
          for (const w of entries)
            objects.push({ kind: 'work', id: w.id, version: w.version })
        }
      }
      earnings = money(numerator, denominator)
      if (!Number.isSafeInteger(earnings) || earnings > 100000000)
        throw new PayrollError('earnings_out_of_range')
      let taxable = earnings,
        reimbursement = 0,
        deductions = 0
      for (const c of used.values()) {
        objects.push({ kind: 'pay-change', id: c.id, version: c.version, approved: true })
        details.push(`${c.data.name} v${c.version}, effective ${c.data.effectiveDate}`)
      }
      for (const item of items) {
        if (!effective(item, payDate)) {
          if (item.data.effectiveDate <= payDate)
            holds.push({
              personId: member.id,
              reason: `${item.data.name}: current exact human approval required.`,
            })
          continue
        }
        if (!item.data.recurring) {
          holds.push({
            personId: member.id,
            reason: `${item.data.name}: one-time assignment/consumption is not implemented.`,
          })
          continue
        }
        if (item.data.taxCode === 'accountable-reimbursement') {
          // A standing recurring setup is insufficient for per-run substantiation.
          holds.push({
            personId: member.id,
            reason: `${item.data.name}: verify this period's substantiation and return of excess before tax exclusion.`,
          })
          reimbursement += item.data.amountCents
        } else if (item.data.taxCode === 'after-tax-deduction')
          deductions += item.data.amountCents
        else taxable += item.data.amountCents
        details.push(
          `${item.data.name} v${item.version}: ${item.data.amountCents} cents, ${item.data.taxCode}`,
        )
        objects.push({
          kind: 'pay-item',
          id: item.id,
          version: item.version,
          approved: true,
        })
      }
      holds.push({
        personId: member.id,
        reason:
          'Gross-to-net, overtime/premiums, legal deduction limits and complete jurisdiction tax treatment are not implemented. This earnings preview cannot be approved or dispatched as payroll.',
      })
      people.push({
        id: member.id,
        name: member.name,
        earningsCents: earnings,
        taxableCashCents: taxable,
        reimbursementCents: reimbursement,
        afterTaxDeductionCents: deductions,
        details,
      })
    }
    const sum = (
      field: 'taxableCashCents' | 'reimbursementCents' | 'afterTaxDeductionCents',
    ) => people.reduce((s, p) => s + p[field], 0)
    const assigned = (
      await this.store.records
        .statement(
          'SELECT p.id,l.state_code AS state FROM env_people p JOIN env_locations l ON l.company_id=p.company_id AND l.id=p.location_id WHERE p.company_id=?',
          [actor.company],
        )
        .all<{ id: string; state: string }>()
    ).results
    const locationStates = [
      ...new Set(
        assigned
          .filter((p) => group.data.people.some((m) => m.id === p.id))
          .map((p) => p.state),
      ),
    ]
    const rules = await this.store.list<PayrollRule>(
      actor,
      'rule',
      undefined,
      true,
      false,
    )
    const selectedRules = periodRules(rules, locationStates, periodStart, periodEnd)

    const result: EarningsRun = {
      periodStart,
      periodEnd,
      payDate,
      frequency,
      groupId: group.id,
      people,
      holds,
      grossCashCents: sum('taxableCashCents') + sum('reimbursementCents'),
      taxableCashCents: sum('taxableCashCents'),
      reimbursementCents: sum('reimbursementCents'),
      afterTaxDeductionCents: sum('afterTaxDeductionCents'),
      taxAmounts: null,
      netPay: null,
      paymentReady: false,
      setupFingerprint: await fingerprint(group.id, allChanges, allItems),
      locationStates,
      ruleFingerprint: await ruleFingerprint(
        rules,
        locationStates,
        periodStart,
        periodEnd,
      ),
      ruleSources: selectedRules.map((r) => ({
        id: r.id,
        version: r.version,
        name: r.data.name,
        determination: r.data.determination,
        approved: Boolean(r.approvedBy && !r.withdrawnBy),
      })),
    }
    if (!persist) return result
    const unique = objects.filter(
      (o, i, a) => a.findIndex((x) => x.kind === o.kind && x.id === o.id) === i,
    )
    return {
      ...(await this.store.append(
        actor,
        'earnings-run',
        objectId(input.id),
        revision(input.version),
        result,
        undefined,
        true,
        {
          people: group.data.people.map((p) => ({ id: p.id, version: p.version })),
          objects: unique,
        },
      )),
      preview: result,
    }
  }
}
