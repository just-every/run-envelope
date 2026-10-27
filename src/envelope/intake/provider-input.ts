import type { Input } from '../records'
import { PayrollError, text, date } from '../security'
import { digest } from '../workspace/store'
import type { IntakeLine } from './run-input'

function object(value: unknown): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PayrollError('invalid_provider_export')
  return value as Input
}
function number(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new PayrollError('invalid_provider_number')
  return value
}
function cents(value: unknown) {
  const result = Math.round(number(value) * 100)
  if (Math.abs(result / 100 - Number(value)) > 0.000001)
    throw new PayrollError('provider_fractional_cent')
  return result
}

/** Reviewed source captures, never an authenticated provider acknowledgement. */
export async function providerInput(value: unknown) {
  let input: Input
  try { input = object(typeof value === 'string' ? JSON.parse(value) : value) }
  catch { throw new PayrollError('invalid_provider_export') }
  const provider = text(input.provider), account = text(input.account, 80)
  if (!['lanyard', 'toast'].includes(provider)) throw new PayrollError('unsupported_time_provider')
  const payload = input.payload, mappings = object(input.mappings), evidence = text(input.evidence, 500)
  const rows: IntakeLine[] = []
  const add = (id: string, map: Input, code: string, minutes: number, amountCents: number, settlement = '') => {
    rows.push({ sourceId: id, personId: text(map.personId), day: date(map.day),
      workweek: date(map.workweek), code, minutes, amountCents, settlement, evidence, state: '', riskClass: '' })
  }
  if (provider === 'lanyard') {
    const batch = object(payload)
    if (!['exported', 'acknowledged'].includes(String(batch.status)) || !batch.exportedBy || !batch.exportedAt)
      throw new PayrollError('approved_provider_export_required', 409)
    text(batch.id, 60)
    if (!Number.isSafeInteger(batch.revision) || Number(batch.revision) < 1 || !Array.isArray(batch.lines))
      throw new PayrollError('invalid_provider_export')
    for (const value of batch.lines) {
      const line = object(value), worker = text(line.payrollId), code = String(line.payCode || 'regular')
      // Lanyard corrections are signed deltas. Refuse rather than treating one as a replacement.
      if (line.corrects || !['regular', 'tips', 'meal premium', 'rest premium'].includes(code))
        throw new PayrollError('provider_pay_code_review_required', 409)
      const minutes = number(line.minutes), amount = code === 'tips' ? number(line.costCents) : 0
      if (!Number.isSafeInteger(amount) || (code === 'tips' && minutes !== 0))
        throw new PayrollError('invalid_provider_number')
      if (!Number.isSafeInteger(line.revision) || Number(line.revision) < 1) throw new PayrollError('invalid_provider_revision')
      const key = text(line.rootId || line.timeId || line.payInputId, 90)
      const mapping = object(mappings[text(line.timeId || line.payInputId, 90)])
      if (mapping.sourcePersonId !== worker) throw new PayrollError('provider_worker_mapping_required', 409)
      if (typeof line.start !== 'string' || !Number.isFinite(Date.parse(line.start)))
        throw new PayrollError('invalid_provider_date')
      if (code === 'tips' && !['cash','paycheck'].includes(String(mapping.settlement)))
        throw new PayrollError('tip_settlement_required', 409)
      const premium = code === 'meal premium' || code === 'rest premium'
      add(key + ':' + code.replaceAll(' ', '-'), mapping, code === 'tips' ? 'tip' : premium ? code.replaceAll(' ', '-') : 'regular', minutes, amount,
        code === 'tips' ? String(mapping.settlement) : '')
      if (premium) rows.at(-1)!.state = 'CA'
    }
  } else {
    if (!Array.isArray(payload)) throw new PayrollError('invalid_provider_export')
    for (const value of payload) {
      const entry = object(value), id = text(entry.guid, 60), worker = text(object(entry.employeeReference).guid)
      if (entry.deleted !== false || entry.autoClockedOut !== false || !entry.outDate ||
        !Number.isFinite(Date.parse(String(entry.inDate))) || !Number.isFinite(Date.parse(String(entry.outDate))) ||
        Date.parse(String(entry.outDate)) <= Date.parse(String(entry.inDate)))
        throw new PayrollError('closed_provider_time_required', 409)
      // These amounts need their own reviewed earning treatment; never silently discard them.
      for (const key of ['cashGratuityServiceCharges','nonCashGratuityServiceCharges','tipsWithheld','nonCashTipsRoundingLoss'])
        if (entry[key] !== undefined && entry[key] !== 0) throw new PayrollError('provider_pay_code_review_required', 409)
      const mapping = object(mappings[id]), settlements = object(mapping.settlements)
      if (mapping.sourcePersonId !== worker) throw new PayrollError('provider_worker_mapping_required', 409)
      if (String(entry.businessDate) !== String(mapping.day).replaceAll('-', '')) throw new PayrollError('provider_day_mapping_required', 409)
      add(id + ':regular', mapping, 'regular', (number(entry.regularHours) + number(entry.overtimeHours)) * 60, 0)
      for (const key of ['declaredCashTips','nonCashTips']) {
        if (!['cash','paycheck'].includes(String(settlements[key]))) throw new PayrollError('tip_settlement_required', 409)
        add(id + ':' + key, mapping, 'tip', 0, cents(entry[key]), String(settlements[key]))
      }
    }
  }
  if (!rows.length || rows.length > 500) throw new PayrollError('intake_row_limit')
  return { rows, namespace: provider + ':' + account,
    capture: { ...input, provider, account, sourceDigest: await digest(JSON.stringify(payload)), boundary: 'human-reviewed-capture' } }
}
