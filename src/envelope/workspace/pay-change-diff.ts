import type { Actor } from '../access'
import { PayrollError } from '../security'
import type { PayChange } from './pay-items'
import type { WorkDay } from './allocations'
import { salaryDay, type ProrationPolicy } from './proration'
import { addDays, adjustedPayday, periodEnd, type Schedule } from './schedules'
import type { WorkspaceStore, Revision, Sources } from './store'

type FirstPeriod = {
  periodStart: string; periodEnd: string; payDate: string; frequency: string
  scheduleId: string; scheduleVersion: number
}
type PersonDiff = {
  personId: string; personName: string; firstPeriod: FirstPeriod | null
  beforeRateCents: number | null; afterRateCents: number; basis: string
  beforeEarningsCents: number | null; afterEarningsCents: number | null
  deltaCents: number | null; eligibility: 'earnings-preview-only' | 'needs-input'; holds: string[]
}
type Setup = PayChange['items'][number]
const dayMs = 86400000
const latest = <T>(rows: Revision<T>[]) => rows.filter((r) =>
  !rows.some((other) => other.id === r.id && other.version > r.version))
const approved = <T>(r: Revision<T>) => Boolean(r.approvedBy && !r.withdrawnBy && r.sourcesCurrent)
const sortEffective = <T extends { effectiveDate: string }>(rows: Revision<T>[]) => rows.sort((a, b) =>
  b.data.effectiveDate.localeCompare(a.data.effectiveDate) || b.version - a.version)

function firstPeriod(row: Revision<Schedule>, effectiveDate: string): FirstPeriod {
  const s = row.data
  let start = s.periodStart
  if (s.frequency === 'weekly' || s.frequency === 'biweekly') {
    const span = s.frequency === 'weekly' ? 7 : 14
    start = addDays(start, Math.floor((Date.parse(effectiveDate) - Date.parse(start)) / dayMs / span) * span)
  } else if (s.frequency === 'monthly' || s.frequency === 'semimonthly') {
    // Validate the saved anchor before deriving its corresponding calendar period.
    periodEnd(start, s.frequency)
    start = effectiveDate.slice(0, 8) +
      (s.frequency === 'semimonthly' && Number(effectiveDate.slice(8)) >= 16 ? '16' : '01')
  } else throw new PayrollError('invalid_pay_frequency')
  const end = periodEnd(start, s.frequency)
  const offset = (Date.parse(s.requestedPayDate) - Date.parse(s.periodEnd)) / dayMs
  if (!Number.isSafeInteger(offset)) throw new PayrollError('invalid_payday_offset')
  const payDate = adjustedPayday(addDays(end, offset), s.holidayPolicy)
  if (payDate < end) throw new PayrollError('payday_before_period_end')
  if (s.exceptionRef && (s.exceptionFrom > start || s.exceptionThrough < payDate))
    throw new PayrollError('exception_outside_scope')
  return { periodStart: start, periodEnd: end, payDate, frequency: s.frequency,
    scheduleId: row.id, scheduleVersion: row.version }
}

/** Compare actual first-period base earnings; never tax, net pay or dispatch authority. */
export async function payChangeDiff(
  store: WorkspaceStore, actor: Actor, change: PayChange, proposalId: string,
) {
  const [scheduleHistory, changeHistory, policyHistory] = await Promise.all([
    store.list<Schedule>(actor, 'schedule', undefined, true, false),
    store.list<PayChange>(actor, 'pay-change', undefined, true, false),
    store.list<ProrationPolicy>(actor, 'proration-policy', undefined, true, false),
  ])
  const schedules = latest(scheduleHistory)
  const policies = policyHistory.filter((p) => p.data.groupId === change.groupId)
  const objects = new Map<string, NonNullable<Sources['objects']>[number]>()
  const people = new Map<string, number>()
  const pin = <T>(row: Revision<T>, history: Revision<T>[], approval = false) => {
    if (row.kind === 'pay-change' && row.id === proposalId) return
    const timeline = latest(history.filter((r) => r.id === row.id))[0]
    const value = { kind: row.kind, id: row.id, version: timeline.version,
      approved: approval && row.version === timeline.version }
    const key = row.kind + ':' + row.id, prior = objects.get(key)
    if (prior && prior.version !== value.version)
      throw new PayrollError('conflicting_period_source_versions', 409)
    objects.set(key, { ...value, approved: Boolean(value.approved || prior?.approved) })
  }
  const result: PersonDiff[] = []
  for (const proposed of change.items) {
    const person = await store.authority(actor, 'records:read', proposed.personId, true)
    if (!person || person.version !== proposed.personVersion)
      throw new PayrollError('person_source_stale', 409)
    if (people.has(person.id) && people.get(person.id) !== person.version)
      throw new PayrollError('conflicting_period_source_versions', 409)
    people.set(person.id, person.version)
    const row: PersonDiff = {
      personId: person.id, personName: person.name, firstPeriod: null,
      beforeRateCents: null, afterRateCents: proposed.rateCents, basis: proposed.basis,
      beforeEarningsCents: null, afterEarningsCents: null, deltaCents: null,
      eligibility: 'needs-input', holds: [],
    }
    result.push(row)
    const hold = (reason: string) => { if (!row.holds.includes(reason)) row.holds.push(reason) }
    const available = schedules.filter((s) => s.data.personId === person.id && s.sourcesCurrent && !s.withdrawnBy)
    if (available.length !== 1) {
      hold(available.length ? 'Conflicting saved schedules require selection.' : 'A current saved worker schedule is required.')
      continue
    }
    const schedule = available[0]
    pin(schedule, scheduleHistory)
    try { row.firstPeriod = firstPeriod(schedule, change.effectiveDate) }
    catch (error) {
      if (!(error instanceof PayrollError)) throw error
      hold('First affected pay period requires schedule review: ' + error.code)
      continue
    }
    const period = row.firstPeriod
    const workHistory = await store.list<WorkDay>(actor, 'work', person.id, true, false)
    const work = latest(workHistory).filter((w) =>
      w.data.day >= period.periodStart && w.data.day <= period.periodEnd)
    for (const w of work) pin(w, workHistory)
    const relevant = changeHistory.filter((c) => c.data.items.some((p) => p.personId === person.id))
    // A draft update of this same proposal may compare with its prior approved
    // revision; it must not depend on itself through a latest-version source pin.
    const baseline = (day: string) => {
      const current = sortEffective(latest(relevant.filter((c) =>
        c.data.effectiveDate <= day && (c.id !== proposalId || approved(c)))))
      const selected = current[0]
      if (!selected || !approved(selected)) return null
      if (current[1]?.data.effectiveDate === selected.data.effectiveDate) return null
      pin(selected, changeHistory, true)
      return selected.data.items.find((p) => p.personId === person.id) ?? null
    }
    row.beforeRateCents = baseline(change.effectiveDate)?.rateCents ?? null
    const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[period.frequency]
    if (!periods) throw new PayrollError('invalid_pay_frequency')
    const calculate = (after: boolean): number | null => {
      let numerator = 0n, denominator = 1n, complete = true
      const add = (n: bigint, d: bigint) => {
        numerator = numerator * d + n * denominator
        denominator *= d
        let a = numerator, b = denominator
        while (b) [a, b] = [b, a % b]
        const gcd = a || 1n
        numerator /= gcd; denominator /= gcd
      }
      for (let day = period.periodStart; day <= period.periodEnd; day = addDays(day, 1)) {
        const setup: Setup | null = after && day >= change.effectiveDate ? proposed : baseline(day)
        if (!setup) {
          complete = false
          hold(`${day}: no unambiguous current approved baseline pay setup; before earnings are unknown.`)
          continue
        }
        const entries = work.filter((w) => w.data.day === day)
        const minutes = entries.reduce((sum, w) => sum + w.data.minutes, 0)
        if (entries.some((w) => !w.sourcesCurrent || w.withdrawnBy) ||
            !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440) {
          complete = false; hold(`${day}: stale or contradictory work minutes require review.`); continue
        }
        if (setup.basis === 'annual-salary') {
          const candidates = sortEffective(latest(policies.filter((p) => p.data.effectiveDate <= day)))
          const selected = candidates[0]
          if (!selected || !approved(selected) || candidates[1]?.data.effectiveDate === selected.data.effectiveDate) {
            complete = false; hold(`${day}: one current effective human-reviewed salary proration policy is required.`); continue
          }
          pin(selected, policies, true)
          if (setup.salaryType === 'nonexempt' && !work.length) {
            complete = false; hold('Persisted actual work minutes are required for nonexempt salary earnings.'); continue
          }
          const calculated = salaryDay({ day, ...period, periods,
            setup: { ...setup, salaryType: setup.salaryType ?? 'unverified',
              unpaidDates: setup.unpaidDates ?? [], unpaidLeave: setup.unpaidLeave ?? [] },
            policy: selected.data, workedMinutes: minutes })
          add(calculated.numerator, calculated.denominator)
          for (const issue of calculated.holds) hold(issue.reason)
        } else if (setup.basis === 'hourly') {
          if (day < setup.employmentFrom || day > setup.employmentThrough || (setup.unpaidDates ?? []).includes(day)) continue
          if (!work.length) {
            complete = false; hold('Persisted actual work minutes are required for hourly earnings.'); continue
          }
          add(BigInt(setup.rateCents) * BigInt(minutes), 60n)
        } else {
          complete = false; hold(`${day}: unsupported pay basis requires review.`)
        }
      }
      if (!complete) return null
      const cents = Number((numerator + denominator / 2n) / denominator)
      if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000)
        throw new PayrollError('earnings_out_of_range')
      return cents
    }
    row.beforeEarningsCents = calculate(false)
    row.afterEarningsCents = calculate(true)
    if (row.beforeEarningsCents !== null && row.afterEarningsCents !== null)
      row.deltaCents = row.afterEarningsCents - row.beforeEarningsCents
    row.eligibility = row.holds.length ? 'needs-input' : 'earnings-preview-only'
  }
  const sum = (field: 'beforeEarningsCents' | 'afterEarningsCents' | 'deltaCents') =>
    result.some((r) => r[field] === null) ? null : result.reduce((total, r) => total + r[field]!, 0)
  return {
    diff: { people: result, totals: { beforeEarningsCents: sum('beforeEarningsCents'),
      afterEarningsCents: sum('afterEarningsCents'), deltaCents: sum('deltaCents') },
      scope: 'First affected scheduled period; actual base earnings only. Salary uses reviewed proration policy. Overtime, premiums, pay items, taxes, net pay and lawful payment eligibility require separate calculation and review.' },
    sources: { people: [...people].map(([id, version]) => ({ id, version })),
      objects: [...objects.values()] } satisfies Sources,
  }
}
