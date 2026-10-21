import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, choice, optional } from './store'

export const payFrequencies = ['weekly', 'biweekly', 'semimonthly', 'monthly'] as const
export const timeZones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Phoenix',
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'Pacific/Honolulu',
] as const
export const scheduleSources = {
  holidays: 'https://www.frbservices.org/about/holiday-schedules',
  newYork: 'https://dol.ny.gov/frequency-pay',
  scope: 'https://www.dol.gov/agencies/whd/state/payday',
}
const dayMs = 86400000
export function addDays(day: string, n: number) {
  return new Date(Date.parse(day) + n * dayMs).toISOString().slice(0, 10)
}
const weekday = (day: string) => new Date(day + 'T12:00:00Z').getUTCDay()
function nthWeekday(year: number, month: number, dow: number, n: number) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  return addDays(first, ((dow - weekday(first) + 7) % 7) + 7 * (n - 1))
}
function lastWeekday(year: number, month: number, dow: number) {
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return addDays(last, -((weekday(last) - dow + 7) % 7))
}
/** Federal Reserve bank holidays: Sunday observed Monday; Saturday is not Friday. */
export function bankHolidays(year: number) {
  const fixed = ['01-01', '06-19', '07-04', '11-11', '12-25'].map((md) => `${year}-${md}`)
  return new Set([
    ...fixed,
    ...fixed.filter((d) => weekday(d) === 0).map((d) => addDays(d, 1)),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    lastWeekday(year, 5, 1),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 10, 1, 2),
    nthWeekday(year, 11, 4, 4),
  ])
}
export function bankingDay(day: string) {
  return ![0, 6].includes(weekday(day)) && !bankHolidays(Number(day.slice(0, 4))).has(day)
}
export function adjustedPayday(day: string, policy: string) {
  if (bankingDay(day)) return day
  if (policy === 'refuse') throw new PayrollError('non_banking_payday')
  const delta = policy === 'earlier' ? -1 : 1
  for (let i = 0; i < 14; i++) {
    day = addDays(day, delta)
    if (bankingDay(day)) return day
  }
  throw new PayrollError('bank_calendar_unavailable', 503)
}
function wallParts(ms: number, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ms)
  const at = (type: string) => parts.find((p) => p.type === type)!.value
  return `${at('year')}-${at('month')}-${at('day')}T${at('hour')}:${at('minute')}:${at('second')}`
}
export function localMidnight(day: string, zone: string) {
  const target = Date.parse(day + 'T00:00:00Z')
  let instant = target
  for (let i = 0; i < 4; i++) {
    const shown = Date.parse(wallParts(instant, zone) + 'Z')
    const delta = target - shown
    if (!delta) return new Date(instant).toISOString()
    instant += delta
  }
  throw new PayrollError('local_time_unresolved')
}
export function periodEnd(start: string, frequency: string) {
  const d = Number(start.slice(8)),
    y = Number(start.slice(0, 4)),
    m = Number(start.slice(5, 7))
  if (frequency === 'weekly' || frequency === 'biweekly')
    return addDays(start, frequency === 'weekly' ? 6 : 13)
  if (
    (frequency === 'monthly' && d !== 1) ||
    (frequency === 'semimonthly' && ![1, 16].includes(d))
  )
    throw new PayrollError('invalid_period_anchor')
  if (frequency === 'semimonthly' && d === 1) return start.slice(0, 8) + '15'
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
export interface Schedule {
  name: string
  frequency: string
  timeZone: string
  periodStart: string
  periodEnd: string
  requestedPayDate: string
  payDate: string
  holidayPolicy: string
  personId: string
  personVersion: number
  occupation: string
  workState: string
  exceptionRef: string
  exceptionFrom: string
  exceptionThrough: string
  periodStartInstant: string
  periodEndExclusiveInstant: string
  sourceUrl: string
}
export class Schedules {
  constructor(public store: WorkspaceStore) {}
  async save(actor: Actor, input: Input) {
    const personId = text(input.personId),
      person = await this.store.records.person(actor, personId)
    await this.store.authority(actor, 'rates:propose', undefined, true)
    const location = await this.store.records
      .statement(
        'SELECT state_code AS state FROM env_locations WHERE company_id=? AND id=?',
        [actor.company, person.locationId],
      )
      .first<{ state: string }>()
    if (location?.state !== 'NY')
      throw new PayrollError('work_state_frequency_rule_unimplemented')
    const frequency = choice(input.frequency, payFrequencies),
      timeZone = choice(input.timeZone, timeZones),
      start = date(input.periodStart),
      end = periodEnd(start, frequency),
      requestedPayDate = date(input.payDate),
      holidayPolicy = choice(input.holidayPolicy, ['earlier', 'later', 'refuse']),
      payDate = adjustedPayday(requestedPayDate, holidayPolicy)
    if (payDate < end) throw new PayrollError('payday_before_period_end')
    const occupation = choice(input.occupation, [
        'manual',
        'clerical',
        'executive',
        'other',
      ]),
      workState = choice(input.workState, ['NY']),
      exceptionRef = optional(input.exceptionRef, 500)
    const exceptionFrom = exceptionRef ? date(input.exceptionFrom) : '',
      exceptionThrough = exceptionRef ? date(input.exceptionThrough) : ''
    if (
      exceptionRef &&
      (exceptionFrom > start ||
        exceptionThrough < payDate ||
        input.exceptionPersonId !== personId)
    )
      throw new PayrollError('exception_outside_scope')
    // This does not accept a warning flag as an agency exception. The official
    // document is recorded with the exact worker/date scope for a human review.
    if (occupation === 'manual' && frequency !== 'weekly' && !exceptionRef)
      throw new PayrollError('ny_manual_weekly_required')
    if (occupation === 'clerical' && frequency === 'monthly')
      throw new PayrollError('ny_clerical_semimonthly_required')
    if (occupation === 'other') throw new PayrollError('occupation_rule_unresolved')
    const data: Schedule = {
      name: text(input.name),
      frequency,
      timeZone,
      periodStart: start,
      periodEnd: end,
      requestedPayDate,
      payDate,
      holidayPolicy,
      personId,
      personVersion: person.version,
      occupation,
      workState,
      exceptionRef,
      exceptionFrom,
      exceptionThrough,
      periodStartInstant: localMidnight(start, timeZone),
      periodEndExclusiveInstant: localMidnight(addDays(end, 1), timeZone),
      sourceUrl: scheduleSources.newYork,
    }
    return this.store.append(
      actor,
      'schedule',
      objectId(input.id),
      revision(input.version),
      data,
      undefined,
      true,
      { people: [{ id: person.id, version: person.version }] },
    )
  }
  async read(actor: Actor) {
    const history = await this.store.list<Schedule>(actor, 'schedule', undefined, true)
    return {
      history,
      sources: scheduleSources,
      eligibility: {
        status: 'not-connected',
        availableSpeeds: [],
        fundingDeadline: null,
        approvalCutoff: null,
        fees: null,
        reason:
          'An authorized current employer/run rail connection is required. No standard, two-day, next-day or same-day offer is available from stored schedule settings.',
      },
    }
  }
}
