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
function identity(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new PayrollError('invalid_provider_identity')
  return String(value)
}
function requireWorkerMapping(worker: unknown, mapping: Input) {
  if (typeof worker !== 'string' || !worker.trim() || worker !== worker.trim() ||
    worker.length > 120 || /[\u0000-\u001f]/.test(worker) || mapping.sourcePersonId !== worker)
    throw new PayrollError('provider_worker_mapping_required', 409)
}
function closedMinutes(start: number, end: number, values: unknown, keys: [string, string, string]) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000)
    throw new PayrollError('closed_provider_time_required', 409)
  if (!Array.isArray(values)) throw new PayrollError('provider_break_review_required', 409)
  const breaks = values.map(value => {
    const row = object(value), from = Date.parse(String(row[keys[0]])), through = Date.parse(String(row[keys[1]]))
    if (!Number.isFinite(from) || !Number.isFinite(through) || from < start || through > end || through <= from || typeof row[keys[2]] !== 'boolean')
      throw new PayrollError('provider_break_review_required', 409)
    return { from, through, paid: row[keys[2]] }
  }).sort((a,b) => a.from - b.from)
  if (breaks.some((row,i) => i > 0 && row.from < breaks[i-1].through))
    throw new PayrollError('provider_break_review_required', 409)
  return (end - start - breaks.filter(row => !row.paid).reduce((n,row) => n + row.through - row.from, 0)) / 60000
}

/** Reviewed source captures, never an authenticated provider acknowledgement. */
export async function providerInput(value: unknown) {
  let input: Input
  try { input = object(typeof value === 'string' ? JSON.parse(value) : value) }
  catch { throw new PayrollError('invalid_provider_export') }
  const provider = text(input.provider), account = text(input.account, 80)
  if (!['lanyard', 'toast', 'clockify', 'square', 'deputy', 'when-i-work', 'homebase', '7shifts', 'quickbooks-time', 'clover'].includes(provider)) throw new PayrollError('unsupported_time_provider')
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
  } else if (provider === 'homebase' || provider === '7shifts') {
    const homebase = provider === 'homebase', envelope = homebase ? undefined : object(payload)
    const entries = homebase ? payload : envelope!.data
    if (!Array.isArray(entries)) throw new PayrollError('invalid_provider_export')
    if (envelope) {
      const cursor = object(object(envelope.meta).cursor)
      // A final page can still advertise omitted earlier punches.
      if (envelope.object !== 'time_punches' || cursor.prev !== null || cursor.next !== null)
        throw new PayrollError('complete_provider_capture_required', 409)
    }
    for (const value of entries) {
      const entry = object(value), id = identity(entry.id), worker = identity(entry.user_id), mapping = object(mappings[id])
      if (mapping.sourcePersonId !== worker || (!homebase && String(entry.company_id) !== account))
        throw new PayrollError('provider_worker_mapping_required', 409)
      if (entry.approved !== true || (!homebase && (entry.deleted !== false || entry.auto_clocked_out !== false)))
        throw new PayrollError('approved_provider_export_required', 409)
      const minutes = closedMinutes(Date.parse(String(entry[homebase ? 'clock_in' : 'clocked_in'])),
        Date.parse(String(entry[homebase ? 'clock_out' : 'clocked_out'])), entry[homebase ? 'timebreaks' : 'breaks'],
        homebase ? ['start_at','end_at','paid'] : ['in','out','paid'])
      add(id + ':regular', mapping, 'regular', minutes, 0)
      if (homebase) {
        const labor = object(entry.labor)
        // Timecard labor cannot prove time-off totals; never silently import them as worked time.
        for (const key of ['break_penalty','paid_time_off_hours','time_off_hours','daily_overtime','double_overtime','seventh_day_overtime_15','seventh_day_overtime_20'])
          if (labor[key] !== undefined && labor[key] !== 0) throw new PayrollError('provider_pay_code_review_required', 409)
        if (Math.abs(number(labor.paid_hours) * 60 - minutes) > 0.000001 ||
          Math.abs((number(labor.regular_hours) + number(labor.weekly_overtime)) * 60 - minutes) > 0.000001)
          throw new PayrollError('provider_hours_reconciliation_required', 409)
        const settlements = object(mapping.settlements)
        for (const key of ['cash_tips','credit_tips']) {
          if (!['cash','paycheck'].includes(String(settlements[key]))) throw new PayrollError('tip_settlement_required', 409)
          add(id + ':' + key, mapping, 'tip', 0, cents(labor[key]), String(settlements[key]))
        }
      } else {
        const amount = number(entry.tips)
        if (!Number.isSafeInteger(amount)) throw new PayrollError('provider_fractional_cent')
        if (!['cash','paycheck'].includes(String(mapping.settlement))) throw new PayrollError('tip_settlement_required', 409)
        add(id + ':tip', mapping, 'tip', 0, amount, String(mapping.settlement))
      }
    }
  } else if (provider === 'quickbooks-time') {
    const envelope = object(payload), entries = object(object(envelope.results).timesheets), supplemental = object(envelope.supplemental_data)
    const users = object(supplemental.users), jobs = object(supplemental.jobcodes)
    if (envelope.more !== false) throw new PayrollError('complete_provider_capture_required', 409)
    for (const [key, value] of Object.entries(entries)) {
      const entry = object(value), id = identity(entry.id), worker = identity(entry.user_id), mapping = object(mappings[id])
      const user = object(users[worker]), job = object(jobs[identity(entry.jobcode_id)])
      if (key !== id || identity(user.id) !== worker || mapping.sourcePersonId !== worker)
        throw new PayrollError('provider_worker_mapping_required', 409)
      const day = date(entry.date), approvedThrough = date(user.approved_to)
      if (user.active !== true || approvedThrough < day) throw new PayrollError('approved_provider_export_required', 409)
      if (mapping.day !== day) throw new PayrollError('provider_day_mapping_required', 409)
      if (entry.type !== 'regular' || job.type !== 'regular' || entry.on_the_clock !== false)
        throw new PayrollError('provider_pay_code_review_required', 409)
      const minutes = closedMinutes(Date.parse(String(entry.start)), Date.parse(String(entry.end)), [], ['start','end','paid'])
      if (!Number.isSafeInteger(entry.duration) || number(entry.duration) !== minutes * 60)
        throw new PayrollError('provider_hours_reconciliation_required', 409)
      add(id + ':regular', mapping, 'regular', minutes, 0)
    }
  } else if (provider === 'clover') {
    const entries = object(payload).elements
    if (!Array.isArray(entries) || input.currency !== 'USD') throw new PayrollError('invalid_provider_export')
    for (const value of entries) {
      const entry = object(value), id = text(entry.id, 100), mapping = object(mappings[id])
      requireWorkerMapping(object(entry.employee).id, mapping)
      if (entry.deletedTime || (entry.overrideInTime && (!entry.overrideInEmployee || !object(entry.overrideInEmployee).id)) || (entry.overrideOutTime && (!entry.overrideOutEmployee || !object(entry.overrideOutEmployee).id)))
        throw new PayrollError('provider_pay_code_review_required', 409)
      const start = entry.overrideInTime || entry.inTime, end = entry.overrideOutTime || entry.outTime
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new PayrollError('closed_provider_time_required', 409)
      const minutes = closedMinutes(Number(start), Number(end), [], ['start','end','paid']), amount = number(entry.cashTipsCollected)
      if (!Number.isSafeInteger(amount)) throw new PayrollError('provider_fractional_cent')
      if (!['cash','paycheck'].includes(String(mapping.settlement))) throw new PayrollError('tip_settlement_required', 409)
      add(id + ':regular', mapping, 'regular', minutes, 0)
      add(id + ':tip', mapping, 'tip', 0, amount, String(mapping.settlement))
    }
  } else if (provider === 'deputy' || provider === 'when-i-work') {
    if (!Array.isArray(payload)) throw new PayrollError('invalid_provider_export')
    for (const value of payload) {
      const entry = object(value), deputy = provider === 'deputy'
      const rawId = deputy ? entry.Id : entry.id, rawWorker = deputy ? entry.Employee : entry.user_id
      if (!Number.isSafeInteger(rawId) || Number(rawId) < 1 || !Number.isSafeInteger(rawWorker) || Number(rawWorker) < 1)
        throw new PayrollError('invalid_provider_identity')
      const id = String(rawId), mapping = object(mappings[id])
      if (mapping.sourcePersonId !== String(rawWorker) || (!deputy && String(entry.account_id) !== account))
        throw new PayrollError('provider_worker_mapping_required', 409)
      let hours: number, start: number, end: number
      if (deputy) {
        if (entry.TimeApproved !== true || entry.PayRuleApproved !== true || entry.Discarded !== false ||
          entry.IsLeave !== false || entry.isInProgress !== false || entry.ValidationFlag !== 0)
          throw new PayrollError('approved_provider_export_required', 409)
        if (!Number.isSafeInteger(entry.TimeApprover) || Number(entry.TimeApprover) < 1 || !Number.isSafeInteger(entry.StartTime) || !Number.isSafeInteger(entry.EndTime))
          throw new PayrollError('invalid_provider_export')
        hours = number(entry.TotalTime); start = Number(entry.StartTime) * 1000; end = Number(entry.EndTime) * 1000
        if (date(String(entry.Date).slice(0,10)) !== mapping.day) throw new PayrollError('provider_day_mapping_required', 409)
      } else {
        if (entry.is_approved !== true || entry.is_alerted !== false || entry.alert_type !== 0 || entry.split_time ||
          (entry.rounded_length !== undefined && entry.rounded_length !== entry.length))
          throw new PayrollError('approved_provider_export_required', 409)
        hours = number(entry.length); start = Date.parse(String(entry.start_time)); end = Date.parse(String(entry.end_time))
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || hours * 3600000 > end - start || end - start > 86400000)
        throw new PayrollError('closed_provider_time_required', 409)
      add(id + ':regular', mapping, 'regular', hours * 60, 0)
      if (!deputy && entry.cash_tips !== null && entry.cash_tips !== undefined) {
        if (typeof entry.cash_tips !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(entry.cash_tips)) throw new PayrollError('invalid_provider_number')
        if (!['cash','paycheck'].includes(String(mapping.settlement))) throw new PayrollError('tip_settlement_required', 409)
        add(id + ':tip', mapping, 'tip', 0, cents(Number(entry.cash_tips)), String(mapping.settlement))
      }
    }
  } else if (provider === 'square') {
    if (!Array.isArray(payload)) throw new PayrollError('invalid_provider_export')
    for (const value of payload) {
      const entry = object(value), id = text(entry.id, 100), mapping = object(mappings[id])
      requireWorkerMapping(entry.team_member_id, mapping)
      if (entry.location_id !== account) throw new PayrollError('provider_worker_mapping_required', 409)
      const start = Date.parse(String(entry.start_at)), end = Date.parse(String(entry.end_at))
      if (entry.status !== 'CLOSED' || !Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        throw new PayrollError('closed_provider_time_required', 409)
      if (!Number.isSafeInteger(entry.version) || Number(entry.version) < 1 || !Array.isArray(entry.breaks))
        throw new PayrollError('invalid_provider_export')
      const breaks = entry.breaks.map(value => {
        const row = object(value), from = Date.parse(String(row.start_at)), through = Date.parse(String(row.end_at))
        if (!Number.isFinite(from) || !Number.isFinite(through) || from < start || through > end || through <= from || typeof row.is_paid !== 'boolean')
          throw new PayrollError('provider_break_review_required', 409)
        return { from, through, paid: row.is_paid }
      }).sort((a,b) => a.from - b.from)
      if (breaks.some((row,i) => i && row.from < breaks[i-1].through)) throw new PayrollError('provider_break_review_required', 409)
      const unpaid = breaks.filter(row => !row.paid).reduce((n,row) => n + row.through - row.from, 0)
      const tip = object(entry.declared_cash_tip_money), amount = number(tip.amount)
      if (tip.currency !== 'USD' || !Number.isSafeInteger(amount)) throw new PayrollError('invalid_provider_number')
      if (!['cash','paycheck'].includes(String(mapping.settlement))) throw new PayrollError('tip_settlement_required', 409)
      add(id + ':regular', mapping, 'regular', (end - start - unpaid) / 60000, 0)
      add(id + ':tip', mapping, 'tip', 0, amount, String(mapping.settlement))
    }
  } else if (provider === 'clockify') {
    if (!Array.isArray(payload)) throw new PayrollError('invalid_provider_export')
    for (const value of payload) {
      const entry = object(value), id = text(entry.id, 100), worker = text(entry.userId)
      const interval = object(entry.timeInterval), mapping = object(mappings[id])
      if (entry.workspaceId !== account || mapping.sourcePersonId !== worker)
        throw new PayrollError('provider_worker_mapping_required', 409)
      if (entry.type !== 'REGULAR' || entry.isLocked !== true)
        throw new PayrollError('reviewed_locked_time_required', 409)
      if (typeof interval.duration !== 'string' || !/^\d+$/.test(interval.duration))
        throw new PayrollError('provider_duration_review_required', 409)
      const seconds = Number(interval.duration), start = Date.parse(String(interval.start)), end = Date.parse(String(interval.end))
      if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start !== seconds * 1000)
        throw new PayrollError('closed_provider_time_required', 409)
      add(id + ':regular', mapping, 'regular', seconds / 60, 0)
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
