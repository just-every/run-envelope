export interface ProrationPolicy {
  name: string
  groupId: string
  groupVersion: number
  effectiveDate: string
  method: 'calendar-days' | 'scheduled-workdays' | 'scheduled-hours'
  /** Scheduled minutes by UTC calendar weekday, Sunday through Saturday. */
  weekMinutes: number[]
  weekStartsOn: number
}

export interface SalarySetup {
  /** Annual salary, in cents. */
  rateCents: number
  employmentFrom: string
  employmentThrough: string
  salaryType: 'exempt' | 'nonexempt' | 'unverified'
  unpaidDates: string[]
  unpaidLeave: {
    day: string
    minutes: number
    reason: 'personal' | 'sickness-plan' | 'fmla' | 'other'
    evidenceRef: string
  }[]
}

export interface SalaryDayInput {
  day: string
  periodStart: string
  periodEnd: string
  periods: number
  setup: SalarySetup
  policy?: ProrationPolicy
  workedMinutes: number
}

export interface SalaryDayResult {
  numerator: bigint
  denominator: bigint
  detail?: string
  holds: { code: string; reason: string }[]
}

const dayMs = 86400000
function utcDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN
  const value = Date.parse(day + 'T00:00:00Z')
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === day
    ? value
    : NaN
}
const minutes = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 1440
function rational(numerator: bigint, denominator: bigint) {
  if (!numerator || !denominator) return { numerator: 0n, denominator: 1n }
  let a = numerator, b = denominator
  while (b) [a, b] = [b, a % b]
  return { numerator: numerator / a, denominator: denominator / a }
}

/**
 * Exact, unrounded earnings preview for one calendar day. The caller chooses the
 * effective approved policy and retains the jurisdiction/payment eligibility holds.
 * This helper does not determine exemption or complete state-law compliance.
 */
export function salaryDay(input: SalaryDayInput): SalaryDayResult {
  const { day, periodStart, periodEnd, periods, setup, workedMinutes } = input
  const holds: SalaryDayResult['holds'] = []
  const details: string[] = []
  const hold = (code: string, reason: string) => holds.push({ code, reason })
  const result = (numerator = 0n, denominator = 1n): SalaryDayResult => ({
    ...rational(numerator, denominator),
    ...(details.length ? { detail: details.join('; ') } : {}),
    holds,
  })
  const start = utcDay(periodStart), end = utcDay(periodEnd), current = utcDay(day)
  const from = utcDay(setup.employmentFrom), through = utcDay(setup.employmentThrough)
  if (![start, end, current, from, through].every(Number.isFinite) ||
      start > end || from > through || !Number.isSafeInteger(periods) || periods <= 0 ||
      !Number.isSafeInteger(setup.rateCents) || setup.rateCents < 0 || !minutes(workedMinutes)) {
    hold('proration-input-review', `${day}: invalid salary dates, annual rate, period count or worked minutes.`)
    return result()
  }
  if (current < start || current > end) return result()
  const policy = input.policy
  if (policy && (policy.weekMinutes.length !== 7 ||
      !policy.weekMinutes.every(minutes) || !Number.isInteger(policy.weekStartsOn) ||
      policy.weekStartsOn < 0 || policy.weekStartsOn > 6 ||
      !['calendar-days', 'scheduled-workdays', 'scheduled-hours'].includes(policy.method) ||
      !Number.isFinite(utcDay(policy.effectiveDate)) || policy.effectiveDate > day)) {
    hold('proration-policy-required', `${day}: a valid effective reviewed salary proration policy is required.`)
    return result()
  }
  if (!policy)
    hold('proration-policy-required', `${day}: calendar-day preview only; choose an effective human-reviewed salary proration policy.`)
  if (setup.salaryType !== 'exempt' && setup.salaryType !== 'nonexempt')
    hold('proration-classification-review', `${day}: salary exemption is unverified; this is an earnings preview only.`)

  let scheduledDays = 0, scheduledMinutes = 0
  if (policy) {
    for (let date = start; date <= end; date += dayMs) {
      const count = policy.weekMinutes[new Date(date).getUTCDay()]
      scheduledDays += count > 0 ? 1 : 0
      scheduledMinutes += count
    }
  }
  const calendarDays = (end - start) / dayMs + 1
  const scheduledToday = policy ? policy.weekMinutes[new Date(current).getUTCDay()] : 0
  const actualWork = setup.salaryType === 'nonexempt' && Boolean(policy)
  const method = actualWork ? 'actual-worked-minutes' : policy?.method ?? 'calendar-days'
  const periodUnits = actualWork || method === 'scheduled-hours' ? scheduledMinutes
    : method === 'scheduled-workdays' ? scheduledDays : calendarDays
  if (day === periodStart || day === policy?.effectiveDate) {
    details.push(`Salary preview: ${method}; period ${periodStart} through ${periodEnd}; ` +
      `${calendarDays} calendar days, ${scheduledDays} scheduled workdays, ${scheduledMinutes} scheduled minutes; ` +
      `annual rate ${setup.rateCents} cents / ${periods} periods / ${periodUnits} ${actualWork || method === 'scheduled-hours' ? 'scheduled minutes' : method === 'scheduled-workdays' ? 'scheduled workdays' : 'calendar days'}` +
      (policy ? `; policy ${policy.name}, effective ${policy.effectiveDate}, workweek starts weekday ${policy.weekStartsOn}` : '; no reviewed policy'))
    if (actualWork)
      details.push(`ENV-006 regular-rate input: ${setup.rateCents} annual cents / ${periods} periods / ${scheduledMinutes} scheduled period minutes; actual work minutes applied by day; workweek overtime and premiums require separate calculation`)
  }
  if (!periodUnits) {
    hold('proration-schedule-review', `${day}: the selected salary basis has no scheduled units in this period.`)
    return result()
  }
  if (current < from || current > through) return result()

  let units = actualWork ? workedMinutes : method === 'scheduled-hours' ? scheduledToday
    : method === 'scheduled-workdays' ? Number(scheduledToday > 0) : 1
  const untyped = setup.unpaidDates.includes(day)
  if (untyped && (!policy || scheduledToday > 0)) {
    hold('proration-leave-review', `${day}: untyped unpaid date requires leave reason and evidence review; no salary deduction applied.`)
    details.push(`${day}: untyped unpaid date retained as paid in this preview`)
  }
  const leave = setup.unpaidLeave.filter((entry) => entry.day === day)
  if (leave.length) {
    if (!policy) {
      hold('proration-leave-review', `${day}: reviewed work schedule is required before a salary leave deduction; no deduction applied.`)
      details.push(`${day}: unpaid leave pending reviewed work schedule`)
    } else if (!scheduledToday) {
      details.push(`${day}: unpaid leave falls on an unscheduled day; no salary deduction`)
    } else if (actualWork) {
      details.push(`${day}: nonexempt salary uses ${workedMinutes} actual worked minutes; no additional leave deduction`)
    } else {
      const total = leave.reduce((sum, entry) => sum + entry.minutes, 0)
      const allowed = setup.salaryType === 'exempt' &&
        leave.every((entry) => minutes(entry.minutes) && entry.minutes > 0 &&
          entry.evidenceRef.trim().length > 0 &&
          (entry.reason === 'fmla' ||
            ((entry.reason === 'personal' || entry.reason === 'sickness-plan') && entry.minutes === scheduledToday))) &&
        total <= scheduledToday && total + workedMinutes <= scheduledToday
      if (allowed) {
        details.push(`${day}: ${total}/${scheduledToday} scheduled minutes unpaid (${leave.map((entry) => `${entry.reason}, evidence ${entry.evidenceRef}`).join('; ')})`)
        // Convert leave minutes to this policy's day/hour unit without rounding.
        return result(BigInt(setup.rateCents) * BigInt(units) * BigInt(scheduledToday - total),
          BigInt(periods) * BigInt(periodUnits) * BigInt(scheduledToday))
      }
      hold('proration-leave-review', `${day}: exempt salary leave needs evidenced whole scheduled personal/sickness-plan days or evidenced FMLA minutes, without conflicting work; no deduction applied.`)
      details.push(`${day}: salary leave held for review; no deduction`)
    }
  }
  return result(BigInt(setup.rateCents) * BigInt(units), BigInt(periods) * BigInt(periodUnits))
}
