import type { Actor } from '../access'
import { fence } from '../access'
import type { Input } from '../records'
import { date, integer, PayrollError, text } from '../security'
import { WorkspaceStore, digest, objectId, revision, type Revision } from '../workspace/store'

/** OAR 436-070-0010 and 0020, adopted order 25-054. Never infer another year's rate. */
export const wbfEdition = {
  id: 'OR-WBF-2026-order-25-054-period-rounding', taxYear: 2026, state: 'OR',
  effectiveFrom: '2026-01-01', effectiveThrough: '2026-12-31', totalCentsPerHour: '1.8', employeeCentsPerHour: '0.9',
  rounding: 'nearest-cent-per-pay-period-half-up', employerMethod: 'equal-to-sum-of-rounded-employee-period-amounts',
  sources: [{ authority: 'Oregon DCBS', title: 'Order 25-054, adopted October 2, 2025, effective January 1, 2026',
    url: 'https://wcd.oregon.gov/laws/Documents/New_rules/070%20WBF%20-%20January%201%2c%202026/70-25054-rule-notice-and-rules.pdf',
    sha256: '8cab16f8cea0f9c0dae8f18236911466ea7a77defcfb15ef8b14e695d18657a4',
    sections: ['436-070-0010(1)', '436-070-0020(1)(a)', '436-070-0020(1)(b)', '436-070-0020(2)', '436-070-0020(3)'],
    interpretation: '2026 rate 1.8 cents per hour; retain half for each employee each pay period, round half cents upward; employer matches the sum of retained employee amounts. Untracked hours require documented flat, contract or reasonable method. Combined reporting remains separately authorized.' }],
  excludedAmbiguousEdition: 'DCBS 440-4999 December 2025 contains inconsistent rounding examples; it supplies no rounding authority here.',
} as const
const sourceId = 'or-wbf-source-2026'
function fail(code: string, status = 409): never { throw new PayrollError(code, status) }
const keys = (v: Input, allowed: string[]) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('unsupported_wbf_input', 400)
}
const year = (v: unknown) => { if (Number(v) !== 2026) fail('wbf_year_unsupported'); return 2026 }
const quarter = (v: unknown) => { const n = integer(v); if (n > 4) fail('wbf_quarter_unsupported'); return n }
const paidQuarter = (paidOn: string) => Math.ceil(Number(paidOn.slice(5, 7)) / 3)
const noHold = (actor: Actor) => ({ sql: "NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND status='held')", args: [actor.company] })
const reviewed = (row: Revision<unknown>, version: number) => {
  if (row.version !== version || !row.sourcesCurrent || !row.approvedBy || row.withdrawnBy) fail('wbf_current_reviewed_evidence_required')
}
const latest = <T>(rows: Revision<T>[]) => rows.filter((r, i) => rows.findIndex(x => x.id === r.id) === i)
const hoursMicros = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{1,4}(\.\d{1,6})?$/.test(v)) fail('wbf_exact_decimal_hours_required', 400)
  const [whole, fraction = ''] = (v as string).split('.')
  const n = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'))
  if (n > 744000000) fail('wbf_hours_outside_period', 400)
  return n
}
const hoursText = (micros: number) => (micros / 1000000).toFixed(6).replace(/\.?0+$/, '') || '0'
const periodId = (person: string, from: string) => objectId('wbf-' + objectId(person) + '-' + date(from))
interface Source { edition: typeof wbfEdition; reference: string }
interface Hours {
  taxYear: number; state: 'OR'; subject: true; from: string; through: string; payDate: string
  frequency: string; hours: string; hoursMicros: number; actualHoursTracked: boolean
  method: string; reference: string; methodReference: string; methodExplanation: string
}
interface Selection { personId: string; from: string; version: number }
interface Preparation { fingerprint: string; sourceVersion: number; periods: Selection[]; result: WbfResult }
export interface WbfResult {
  taxYear: number; quarter: number; state: 'OR'; sourceVersion: number; sourceReference: string; sourceEdition: typeof wbfEdition
  status: 'preparation-only'; coverage: 'selected-reviewed-periods'; unsigned: true; unfiled: true
  rows: (Hours & { personId: string; evidenceId: string; evidenceVersion: number; employeeCents: number; employerCents: number; totalCents: number })[]
  employeeCents: number; employerCents: number; totalCents: number; hours: string
  combinedReportWorksheet: { form: 'OQ'; taxYear: number; quarter: number; subjectHours: string; proposedEmployeeCents: number; proposedEmployerCents: number; proposedAssessmentCents: number; status: 'unsigned-unfiled-worksheet' }
  collectedEmployeeCents: null; paidEmployerCents: null; payrollApproval: null; paymentReady: false; filing: 'unavailable'; payment: 'unavailable'
}

export class OrWbf {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, person?: string) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) fail('native_wbf_owner_required', 403)
    await this.store.authority(actor, 'records:read', person, true)
    const f = fence(actor), h = noHold(actor)
    if (!await this.store.records.statement(`SELECT 1 WHERE ${f.sql} AND ${h.sql}`, [...f.args, ...h.args]).first()) fail('wbf_source_held_or_authority_changed')
    if (person) {
      const row = await this.store.records.statement('SELECT 1 FROM env_people p JOIN env_locations l ON l.company_id=p.company_id AND l.id=p.location_id WHERE p.company_id=? AND p.id=? AND l.state_code=\'OR\'', [actor.company, person]).first()
      if (!row) fail('wbf_oregon_worker_required')
    }
  }
  async sources(actor: Actor) { await this.scope(actor); return this.store.list<Source>(actor, 'or-wbf-source', undefined, true) }
  async saveSource(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['version', 'taxYear', 'state', 'sourceEdition', 'rounding', 'reference'])
    year(input.taxYear)
    if (input.state !== 'OR' || input.sourceEdition !== wbfEdition.id || input.rounding !== wbfEdition.rounding) fail('wbf_exact_2026_period_rounding_edition_required')
    return this.store.append<Source>(actor, 'or-wbf-source', sourceId, revision(input.version), { edition: wbfEdition, reference: text(input.reference, 500) }, undefined, true, { condition: noHold(actor) })
  }
  async reviewSource(actor: Actor) { await this.scope(actor); return this.store.review(actor, 'or-wbf-source', sourceId, undefined, noHold(actor)) }
  async approveSource(actor: Actor, input: Input) { await this.scope(actor); return this.store.decide(actor, 'or-wbf-source', sourceId, input, undefined, false, noHold(actor)) }
  async periods(actor: Actor, person: string) { await this.scope(actor, person); return this.store.list<Hours>(actor, 'or-wbf-hours', person, true) }
  async saveHours(actor: Actor, person: string, from: string, input: Input) {
    await this.scope(actor, person)
    keys(input, ['version', 'taxYear', 'state', 'subject', 'from', 'through', 'payDate', 'frequency', 'hours', 'actualHoursTracked', 'method', 'reference', 'methodReference', 'methodExplanation'])
    year(input.taxYear)
    if (input.state !== 'OR' || input.subject !== true) fail('wbf_subject_oregon_evidence_required')
    const start = date(from), through = date(input.through), payDate = date(input.payDate)
    if (start !== input.from || start > through || payDate < through || !payDate.startsWith('2026-')) fail('wbf_period_or_paid_year_mismatch')
    const days = (Date.parse(through) - Date.parse(start)) / 86400000 + 1
    const frequency = text(input.frequency), method = text(input.method)
    if (!['weekly', 'biweekly', 'semimonthly', 'monthly'].includes(frequency) || days > 31) fail('wbf_pay_frequency_unsupported')
    const micros = hoursMicros(input.hours)
    if (micros > days * 24000000) fail('wbf_hours_outside_period')
    const tracked = input.actualHoursTracked
    if (typeof tracked !== 'boolean' || !['actual', 'flat', 'contract', 'reasonable'].includes(method) || (method === 'actual') !== tracked) fail('wbf_explicit_hours_method_required')
    const methodReference = text(input.methodReference, 500), methodExplanation = text(input.methodExplanation, 1000)
    if (method === 'flat') {
      const month = start.slice(0, 7), last = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10)
      const complete = frequency === 'weekly' ? days === 7 : frequency === 'biweekly' ? days === 14 : frequency === 'monthly'
        ? start === month + '-01' && through === last
        : (start === month + '-01' && through === month + '-15') || (start === month + '-16' && through === last)
      const expected = { weekly: 40000000, biweekly: 80000000, monthly: 173330000, semimonthly: 86665000 }[frequency]!
      if (!complete || micros !== expected) fail('wbf_flat_oregon_hours_required')
    }
    const id = periodId(person, start), previous = latest(await this.periods(actor, person))
    if (previous.some(row => row.id !== id && row.data.from <= through && row.data.through >= start)) fail('wbf_overlapping_pay_period')
    const reference = text(input.reference, 240)
    return this.store.append<Hours>(actor, 'or-wbf-hours', id, revision(input.version), {
      taxYear: 2026, state: 'OR', subject: true, from: start, through, payDate, frequency, hours: hoursText(micros), hoursMicros: micros,
      actualHoursTracked: tracked, method, reference, methodReference, methodExplanation,
    }, person, true, { condition: noHold(actor), exclusiveSourceIds: [await digest(JSON.stringify(['or-wbf-period-source', reference]))] })
  }
  async reviewHours(actor: Actor, person: string, from: string) { await this.scope(actor, person); return this.store.review(actor, 'or-wbf-hours', periodId(person, from), person, noHold(actor)) }
  async approveHours(actor: Actor, person: string, from: string, input: Input) { await this.scope(actor, person); return this.store.decide(actor, 'or-wbf-hours', periodId(person, from), input, person, false, noHold(actor)) }
  async inputs(actor: Actor, periods: Selection[], sourceVersion: number, q: number) {
    const source = await this.store.find<Source>(actor, 'or-wbf-source', sourceId, undefined, true)
    reviewed(source, sourceVersion)
    // Old records remain immutable. A familiar id or an earlier approval is no exact source review.
    if (JSON.stringify(source.data.edition) !== JSON.stringify(wbfEdition)) fail('wbf_exact_2026_period_rounding_edition_required')
    const hours: Revision<Hours>[] = []
    for (const p of periods) {
      await this.scope(actor, p.personId)
      const row = await this.store.find<Hours>(actor, 'or-wbf-hours', periodId(p.personId, p.from), p.personId, true)
      reviewed(row, p.version)
      if (paidQuarter(row.data.payDate) !== q || !row.data.payDate.startsWith('2026-')) fail('wbf_paid_quarter_mismatch')
      hours.push(row)
    }
    return { source, hours }
  }
  async preparationId(actor: Actor, q: number) {
    const retired = new Set((await this.store.records.statement('SELECT source_hash FROM env_privacy_source_fences WHERE company_id=?', [actor.company]).all<{ source_hash: string }>()).results.map(r => r.source_hash))
    const base = 'or-wbf-preparation-2026-' + q
    let id = base, generation = 0
    while (retired.has(await digest(JSON.stringify(['or-wbf-preparation', id])))) id = base + '-' + ++generation
    return id
  }
  async prepare(actor: Actor, taxYear: unknown, qInput: unknown, input: Input) {
    year(taxYear); const q = quarter(qInput); await this.scope(actor)
    keys(input, ['version', 'taxYear', 'quarter', 'sourceVersion', 'periods'])
    year(input.taxYear); if (quarter(input.quarter) !== q) fail('wbf_quarter_mismatch')
    if (!Array.isArray(input.periods) || !input.periods.length || input.periods.length > 100) fail('wbf_period_evidence_required', 400)
    const periods = (input.periods as Input[]).map(p => {
      keys(p, ['personId', 'from', 'version'])
      return { personId: objectId(p.personId), from: date(p.from), version: integer(p.version) }
    }).sort((a, b) => a.personId.localeCompare(b.personId) || a.from.localeCompare(b.from))
    if (new Set(periods.map(p => periodId(p.personId, p.from))).size !== periods.length) fail('wbf_duplicate_period')
    const sourceVersion = integer(input.sourceVersion), { source, hours } = await this.inputs(actor, periods, sourceVersion, q)
    const id = await this.preparationId(actor, q), fingerprint = await digest(JSON.stringify({ sourceVersion, periods }))
    const prior = (await this.store.list<Preparation>(actor, 'or-wbf-preparation', undefined, true, false, id))[0]
    if (prior?.data.fingerprint === fingerprint && prior.sourcesCurrent) { await this.scope(actor); return { id, kind: 'or-wbf-preparation', version: prior.version, replayed: true, result: prior.data.result } }
    const rows = hours.map(row => {
      // 0.9 cents per hour, using millionths of an hour. No floating-point money or rounded hours.
      const employeeCents = Number((BigInt(row.data.hoursMicros) * 9n + 5000000n) / 10000000n)
      return { ...row.data, personId: row.personId!, evidenceId: row.id, evidenceVersion: row.version, employeeCents, employerCents: employeeCents, totalCents: employeeCents * 2 }
    })
    const employeeCents = rows.reduce((n, row) => n + row.employeeCents, 0), totalHours = hoursText(rows.reduce((n, row) => n + row.hoursMicros, 0))
    const result: WbfResult = { taxYear: 2026, quarter: q, state: 'OR', sourceVersion, sourceReference: source.data.reference, sourceEdition: source.data.edition,
      status: 'preparation-only', coverage: 'selected-reviewed-periods', unsigned: true, unfiled: true, rows, hours: totalHours,
      employeeCents, employerCents: employeeCents, totalCents: employeeCents * 2,
      combinedReportWorksheet: { form: 'OQ', taxYear: 2026, quarter: q, subjectHours: totalHours, proposedEmployeeCents: employeeCents, proposedEmployerCents: employeeCents, proposedAssessmentCents: employeeCents * 2, status: 'unsigned-unfiled-worksheet' },
      collectedEmployeeCents: null, paidEmployerCents: null, payrollApproval: null, paymentReady: false, filing: 'unavailable', payment: 'unavailable' }
    const saved = await this.store.append<Preparation>(actor, 'or-wbf-preparation', id, revision(input.version), { fingerprint, sourceVersion, periods, result }, undefined, true,
      { condition: noHold(actor), people: [...new Map(hours.map(h => [h.personId!, { id: h.personId!, version: h.personVersion! }])).values()],
        objects: [{ kind: 'or-wbf-source', id: sourceId, version: sourceVersion, approved: true }, ...hours.map(h => ({ kind: 'or-wbf-hours' as const, id: h.id, version: h.version, approved: true }))] })
    return { ...saved, result }
  }
  async preparations(actor: Actor, taxYear: unknown, qInput: unknown) {
    year(taxYear); const q = quarter(qInput); await this.scope(actor)
    const id = await this.preparationId(actor, q), rows = await this.store.list<Preparation>(actor, 'or-wbf-preparation', undefined, true)
    return rows.filter(r => r.data.result.quarter === q).map(row => ({ ...row, current: row.id === id && row.version === rows.find(r => r.id === id)?.version && !!row.sourcesCurrent }))
  }
  async calculation(actor: Actor, input: Input, period?: { from: string; through: string; payDate: string; frequency: string; workState: string }) {
    await this.scope(actor)
    keys(input, ['taxYear', 'quarter', 'version', 'personId', 'from'])
    year(input.taxYear); const q = quarter(input.quarter), id = await this.preparationId(actor, q)
    const row = await this.store.find<Preparation>(actor, 'or-wbf-preparation', id, undefined, true)
    if (row.version !== integer(input.version) || !row.sourcesCurrent) fail('wbf_preparation_stale')
    await this.inputs(actor, row.data.periods, row.data.sourceVersion, q)
    if (!period) return row
    const person = objectId(input.personId), from = date(input.from)
    const selected = row.data.result.rows.find(r => r.personId === person && r.from === from)
    if (!selected || selected.from !== period.from || selected.through !== period.through || selected.payDate !== period.payDate || selected.frequency !== period.frequency || period.workState !== 'OR') fail('wbf_preview_period_mismatch')
    await this.scope(actor, person)
    return { ...row.data.result, rows: [selected], employeeCents: selected.employeeCents, employerCents: selected.employerCents, totalCents: selected.totalCents, hours: selected.hours }
  }
  async reviewPreparation(actor: Actor, taxYear: unknown, qInput: unknown) {
    year(taxYear); const q = quarter(qInput), id = await this.preparationId(actor, q)
    await this.scope(actor)
    const row = await this.store.find<Preparation>(actor, 'or-wbf-preparation', id, undefined, true)
    await this.calculation(actor, { taxYear: 2026, quarter: q, version: row.version })
    return this.store.review(actor, 'or-wbf-preparation', id, undefined, noHold(actor))
  }
}
