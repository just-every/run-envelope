import type { Input } from '../../records'
import { date, text, integer, PayrollError } from '../../security'
import { choice } from '../../workspace/store'

export const hrisProviders = [
  'willow',
  'bamboohr',
  'hibob',
  'rippling',
] as const
export const hrisTypes = [
  'hire',
  'rate',
  'location',
  'leave',
  'benefit',
  'termination',
] as const
export const object = (v: unknown): Input => {
  if (typeof v === 'string') {
    try {
      return object(JSON.parse(v))
    } catch {
      throw new PayrollError('invalid_source_export')
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new PayrollError('invalid_source_export')
  return v as Input
}
export const cents = (v: unknown) => {
  const raw = typeof v === 'number' ? String(v) : text(v, 40)
  const s = raw
    .replace(/^\$/, '')
    .replace(/\s+USD$/, '')
    .trim()
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s)
  if (!match) throw new PayrollError('invalid_usd_rate')
  const fraction = (match[2] ?? '').padEnd(2, '0')
  if (/[1-9]/.test(fraction.slice(2)))
    throw new PayrollError('fractional_cent_rate_requires_review', 409)
  return integer(Number(match[1]) * 100 + Number(fraction.slice(0, 2)))
}
/** Whitelist payroll facts; source policy, I-9s and documents never enter the payload. */
export function hrisFacts(
  provider: string,
  type: string,
  raw: Input,
): { sourceId: string; effectiveDate: string; values: Input; schema: string } {
  if (provider === 'bamboohr') {
    if (type !== 'rate' || raw.payType !== 'Hourly' || raw.payPer !== 'Hour')
      throw new PayrollError('hris_schema_not_supported', 409)
    return {
      sourceId: text(raw.id) + ':' + date(raw.payRateEffectiveDate),
      effectiveDate: date(raw.payRateEffectiveDate),
      values: { rateCents: cents(raw.payRate) },
      schema:
        'BambooHR v1 employee fields: id, payType, payPer, payRate, payRateEffectiveDate',
    }
  }
  if (provider === 'hibob') {
    if (
      type !== 'rate' ||
      raw.payPeriod !== 'Hourly' ||
      object(raw.base).currency !== 'USD'
    )
      throw new PayrollError('hris_schema_not_supported', 409)
    return {
      sourceId: String(integer(raw.id)),
      effectiveDate: date(raw.effectiveDate),
      values: { rateCents: cents(object(raw.base).value) },
      schema: 'HiBob Employee data API 1.0.0 SalaryEntry / CurrencyValue',
    }
  }
  if (provider === 'rippling') {
    if (type !== 'rate' || object(raw.hourly_wage).currency_type !== 'USD')
      throw new PayrollError('hris_schema_not_supported', 409)
    const effectiveDate = date(raw.salary_effective_date)
    return {
      sourceId: text(raw.id) + ':' + effectiveDate,
      effectiveDate,
      values: { rateCents: cents(object(raw.hourly_wage).value) },
      schema:
        'Rippling REST v2 Compensation: hourly_wage / salary_effective_date (published schema, 2026-10-23)',
    }
  }
  if (provider !== 'willow') throw new PayrollError('unsupported_hris_source')
  const sourceId = text(raw.sourceId),
    effectiveDate = date(raw.effectiveDate)
  if (raw.schema !== 'envelope-willow-payroll@1')
    throw new PayrollError('unsupported_source_schema')
  const data = object(raw.values),
    values: Input = {}
  if (type === 'rate') values.rateCents = integer(data.rateCents)
  else if (type === 'location') values.locationId = text(data.locationId)
  else if (type === 'leave') {
    values.minutes = integer(data.minutes)
    values.rateCents = integer(data.rateCents)
    values.code = choice(data.code, ['sick', 'pto', 'holiday', 'termination'])
  } else if (type === 'benefit') {
    values.amountCents = integer(data.amountCents)
    values.code = text(data.code)
  } else if (!['hire', 'termination'].includes(type))
    throw new PayrollError('unsupported_hris_event')
  return {
    sourceId,
    effectiveDate,
    values,
    schema: 'envelope-willow-payroll@1 (documented Envelope intake contract)',
  }
}
