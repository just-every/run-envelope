import type { Actor } from '../access'
import { fence } from '../access'
import type { Input } from '../records'
import { date, integer, PayrollError, recordKey, text, unseal } from '../security'
import { WorkspaceStore, digest, objectId, revision, type Kind, type Revision } from '../workspace/store'
import { collectionPins } from '../workspace/review-inputs'
import { waLiNoticeRates } from '../workspace/rules'

const rule = {
  edition: 'WAC-296-17-31021-effective-2021-01-01',
  url: 'https://app.leg.wa.gov/wac/default.aspx?cite=296-17-31021',
  retainedExcerpt: 'Salaried employees: Actual hours worked; or assumed hours of one hundred-sixty hours per month. All salaried employees of an employer must be reported by the same method.',
}
interface Period { from: string; through: string }
interface Notice extends Period {
  companyId: string; employerEin: string; riskClass: string; totalRate: string; employeeRate: string
  sourceEdition: string; reference: string; documentText: string; sourceUrl: string; documentDigest: string
}
interface Allocation { riskClass: string; noticeId: string; noticeVersion: number; hours: string }
interface Hours extends Period { remuneration: string; method: string; reference: string; allocations: Allocation[] }
interface Selection { personId: string; version: number }
interface Election extends Period { method: string; workers: Selection[]; completeSalariedRoster: true; rule: typeof rule }
export interface WaLiResult extends Period {
  status: string; companyId: string; unsigned: true; unfiled: true; rule: typeof rule
  rows: { personId: string; evidenceVersion: number; remuneration: string; method: string; riskClass: string
    noticeId: string; noticeVersion: number; sourceEdition: string; reference: string; documentDigest: string
    totalRate: string; employeeRate: string; hours: string; totalPremiumCents: number; proposedEmployeeCents: number; employerRemainderCents: number }[]
  worksheet: { riskClass: string; hours: string; totalPremiumCents: number; proposedEmployeeCents: number; employerRemainderCents: number }[]
  totalPremiumCents: number; proposedEmployeeCents: number; employerRemainderCents: number
  collectedPremiumCents: null; accountAuthority: false; coverageEstablished: false; paymentReady: false
  payrollApproval: null; filing: string; payment: string; holds: string[]
}
interface Preparation extends Period { fingerprint: string; electionVersion: number; workers: Selection[]; result: WaLiResult }
const fail = (code: string, status = 409): never => { throw new PayrollError(code, status) }
const keys = (input: Input, allowed: string[]) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) fail('unsupported_wa_li_input', 400)
}
const period = (input: Input): Period => {
  const from = date(input.from), through = date(input.through)
  if (from > through || from.slice(0, 4) !== through.slice(0, 4)) fail('wa_li_period_unsupported')
  return { from, through }
}
const periodId = (p: Period) => p.from + '-' + p.through
const hoursId = (person: string, p: Period) => objectId(person + '-' + periodId(p))
const latest = <T>(rows: Revision<T>[]) => rows.filter((r, i) => rows.findIndex(x => x.id === r.id) === i)
const reviewed = (row: Revision<unknown>, version: number) => {
  if (row.version !== version || !row.sourcesCurrent || !row.approvedBy || row.withdrawnBy) fail('wa_li_current_reviewed_source_required')
}
const noHold = (actor: Actor) => ({ sql: "NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND status='held')", args: [actor.company] })
const fixed = (value: unknown, allowZero = false) => {
  const s = text(value, 24)
  if (!/^\d+(\.\d{1,6})?$/.test(s) || Number(s) > 100000 || (!allowZero && Number(s) === 0)) fail('invalid_wa_li_hours', 400)
  return s
}
const units = (s: string) => { const [whole, fraction = ''] = s.split('.'); return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')) }
const decimal = (u: bigint) => (u / 1000000n).toString() + (u % 1000000n ? '.' + (u % 1000000n).toString().padStart(6, '0').replace(/0+$/, '') : '')
const cents = (hours: string, rate: string) => Number((units(hours) * units(rate) + 5000000000n) / 10000000000n)
const assumedHours = (p: Period) => {
  const start = new Date(p.from + 'T00:00:00Z'), end = new Date(p.through + 'T00:00:00Z')
  if (start.getUTCDate() !== 1 || new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate() !== end.getUTCDate()) fail('wa_li_partial_month_assumption_unavailable')
  return String((end.getUTCMonth() - start.getUTCMonth() + 1) * 160)
}

/** Local reviewed preparation only. A notice transcription never authenticates coverage or a state account. */
export class WaLi {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, person?: string) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) fail('native_wa_li_owner_required', 403)
    await this.store.authority(actor, 'records:read', person, true)
    const f = fence(actor), h = noHold(actor)
    if (!await this.store.records.statement(`SELECT 1 WHERE ${f.sql} AND ${h.sql}`, [...f.args, ...h.args]).first()) fail('wa_li_source_held_or_authority_changed')
  }
  async notices(actor: Actor) { await this.scope(actor); return this.store.list<Notice>(actor, 'wa-li-notice', undefined, true) }
  async saveNotice(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['id', 'version', 'companyId', 'employerEin', 'riskClass', 'from', 'through', 'totalRate', 'employeeRate', 'sourceEdition', 'reference', 'documentText', 'sourceUrl'])
    if (input.companyId !== actor.company) fail('wa_li_notice_company_mismatch')
    const f = fence(actor)
    const own = await this.store.records.statement(`SELECT ein_cipher FROM env_companies WHERE id=? AND ${f.sql}`, [actor.company, ...f.args]).first<{ein_cipher: string}>()
    if (!own) return fail('authority_changed')
    const ein = await unseal(await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY), JSON.stringify([actor.company, 'ein']), own.ein_cipher)
    if (input.employerEin !== ein) fail('wa_li_notice_employer_mismatch')
    const rates = waLiNoticeRates(input), p = period(input)
    const sourceUrl = text(input.sourceUrl, 1000)
    let url: URL
    try { url = new URL(sourceUrl) } catch { return fail('wa_li_official_notice_source_required') }
    if (url.protocol !== 'https:' || url.hostname !== 'www.lni.wa.gov' || url.username || url.password || url.hash) fail('wa_li_official_notice_source_required')
    const data = { ...p, ...rates, companyId: actor.company, employerEin: ein, sourceUrl,
      sourceEdition: text(input.sourceEdition, 240), reference: text(input.reference, 240), documentText: text(input.documentText, 16000) }
    return this.store.append(actor, 'wa-li-notice', objectId(input.id), revision(input.version),
      { ...data, documentDigest: await digest(JSON.stringify(data)) }, undefined, true, { condition: noHold(actor) })
  }
  async notice(actor: Actor, allocation: Allocation, p: Period) {
    const row = await this.store.find<Notice>(actor, 'wa-li-notice', allocation.noticeId, undefined, true)
    reviewed(row, allocation.noticeVersion)
    if (row.data.companyId !== actor.company || row.data.riskClass !== allocation.riskClass
      || row.data.from > p.from || row.data.through < p.through) fail('wa_li_notice_class_or_period_mismatch')
    return row
  }
  async saveHours(actor: Actor, person: string, input: Input) {
    await this.scope(actor, person)
    const location = await this.store.records.statement('SELECT l.state_code AS state FROM env_people p JOIN env_locations l ON l.company_id=p.company_id AND l.id=p.location_id WHERE p.company_id=? AND p.id=?', [actor.company, person]).first<{state: string}>()
    if (location?.state !== 'WA') fail('wa_li_washington_worker_required')
    keys(input, ['version', 'from', 'through', 'remuneration', 'method', 'reference', 'allocations'])
    const p = period(input), remuneration = text(input.remuneration), method = text(input.method)
    if (!['hourly', 'salary'].includes(remuneration) || !['actual', 'wa-160-month'].includes(method)
      || (remuneration === 'hourly' && method !== 'actual')) fail('wa_li_hours_method_conflict')
    if (!Array.isArray(input.allocations) || !input.allocations.length || input.allocations.length > 20) fail('wa_li_class_hours_required', 400)
    if (method === 'wa-160-month' && (input.allocations as Input[]).length !== 1) fail('wa_li_assumed_class_allocation_unavailable')
    const allocations = (input.allocations as Input[]).map(a => {
      keys(a, method === 'actual' ? ['riskClass', 'noticeId', 'noticeVersion', 'hours'] : ['riskClass', 'noticeId', 'noticeVersion'])
      return { riskClass: text(a.riskClass, 80), noticeId: objectId(a.noticeId), noticeVersion: integer(a.noticeVersion),
        hours: method === 'actual' ? fixed(a.hours) : assumedHours(p) }
    }).sort((a, b) => a.riskClass.localeCompare(b.riskClass))
    if (new Set(allocations.map(a => a.riskClass)).size !== allocations.length) fail('wa_li_duplicate_class')
    const notices = await Promise.all(allocations.map(a => this.notice(actor, a, p)))
    return this.store.append<Hours>(actor, 'wa-li-hours', hoursId(person, p), revision(input.version),
      { ...p, remuneration, method, reference: text(input.reference, 240), allocations }, person, true,
      { condition: noHold(actor), objects: notices.map(n => ({ kind: 'wa-li-notice', id: n.id, version: n.version, approved: true })) })
  }
  async allHours(actor: Actor, p: Period, overlapping = false) {
    const rows: Revision<Hours>[] = []
    for (const person of await this.store.records.people(actor)) {
      const retained = latest(await this.store.list<Hours>(actor, 'wa-li-hours', person.id, true, false))
        .filter(r => overlapping ? r.data.from <= p.through && r.data.through >= p.from : r.data.from === p.from && r.data.through === p.through)
      rows.push(...retained)
    }
    return rows.sort((a, b) => a.personId!.localeCompare(b.personId!))
  }
  async pins(actor: Actor) { return collectionPins(this.store, actor, [{ kind: 'wa-li-hours', personId: '*', exceptId: '' }]) }
  async saveElection(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['version', 'from', 'through', 'method', 'workers', 'completeSalariedRoster', 'sourceEdition'])
    const reviewSets = await this.pins(actor)
    const p = period(input), method = text(input.method), workers = this.selection(input.workers)
    if (!['actual', 'wa-160-month'].includes(method) || input.completeSalariedRoster !== true || input.sourceEdition !== rule.edition) fail('wa_li_employer_election_required')
    const companySalaries = (await this.allHours(actor, p, true)).filter(r => r.data.remuneration === 'salary')
    for (const row of companySalaries) {
      reviewed(row, row.version)
      if (row.data.method !== method) fail('wa_li_mixed_salaried_methods')
    }
    const hours = (await this.allHours(actor, p)).filter(r => r.data.remuneration === 'salary')
    if (hours.length !== workers.length || hours.some((r, i) => r.personId !== workers[i].personId || r.version !== workers[i].version)) fail('wa_li_complete_salaried_roster_required')
    for (const row of hours) {
      reviewed(row, row.version)
      if (row.data.method !== method) fail('wa_li_mixed_salaried_methods')
    }
    if (method === 'wa-160-month') assumedHours(p)
    return this.store.append<Election>(actor, 'wa-li-election', periodId(p), revision(input.version),
      { ...p, method, workers, completeSalariedRoster: true, rule }, undefined, true,
      { condition: noHold(actor), reviewSets,
        people: hours.map(h => ({ id: h.personId!, version: h.personVersion! })),
        objects: hours.map(h => ({ kind: 'wa-li-hours', id: h.id, version: h.version, approved: true })) })
  }
  selection(input: unknown): Selection[] {
    if (!Array.isArray(input) || input.length > 100) fail('wa_li_workers_required', 400)
    const workers = (input as Input[]).map(w => { keys(w, ['personId', 'version']); return { personId: objectId(w.personId), version: integer(w.version) } }).sort((a, b) => a.personId.localeCompare(b.personId))
    if (new Set(workers.map(w => w.personId)).size !== workers.length) fail('wa_li_duplicate_worker')
    return workers
  }
  async inputs(actor: Actor, p: Period, workers: Selection[], electionVersion: number) {
    for (const worker of workers) await this.scope(actor, worker.personId)
    const hours = await this.allHours(actor, p)
    if (!hours.length || hours.length !== workers.length || hours.some((r, i) => r.personId !== workers[i].personId || r.version !== workers[i].version)) fail('wa_li_complete_period_evidence_required')
    for (const row of hours) reviewed(row, row.version)
    const salaries = hours.filter(r => r.data.remuneration === 'salary')
    let election: Revision<Election> | undefined
    if (salaries.length) {
      election = await this.store.find<Election>(actor, 'wa-li-election', periodId(p), undefined, true)
      reviewed(election, electionVersion)
      const companySalaries = (await this.allHours(actor, p, true)).filter(r => r.data.remuneration === 'salary')
      for (const row of companySalaries) {
        reviewed(row, row.version)
        if (row.data.method !== election.data.method) fail('wa_li_mixed_salaried_methods')
      }
      if (salaries.some(r => r.data.method !== election!.data.method)
        || JSON.stringify(salaries.map(r => ({ personId: r.personId, version: r.version }))) !== JSON.stringify(election.data.workers)) fail('wa_li_mixed_salaried_methods')
    } else if (electionVersion !== 0) fail('wa_li_unexpected_election')
    const notices = new Map<string, Revision<Notice>>()
    for (const row of hours) for (const allocation of row.data.allocations) {
      const notice = await this.notice(actor, allocation, p); notices.set(notice.id, notice)
    }
    return { hours, election, notices }
  }
  async preparationId(actor: Actor, p: Period) {
    let id = 'wa-li-' + periodId(p), generation = 0
    while (await this.store.records.statement('SELECT 1 FROM env_privacy_source_fences WHERE company_id=? AND source_hash=?',
      [actor.company, await digest(JSON.stringify(['wa-li-preparation', id]))]).first()) id = 'wa-li-' + periodId(p) + '-' + ++generation
    return id
  }
  async prepare(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['version', 'from', 'through', 'workers', 'electionVersion'])
    const reviewSets = await this.pins(actor)
    const p = period(input), workers = this.selection(input.workers), electionVersion = revision(input.electionVersion)
    const { hours, election, notices } = await this.inputs(actor, p, workers, electionVersion)
    const id = await this.preparationId(actor, p), fingerprint = await digest(JSON.stringify({ ...p, workers, electionVersion }))
    const prior = latest(await this.store.list<Preparation>(actor, 'wa-li-preparation', undefined, true, false)).find(r => r.id === id)
    if (prior?.sourcesCurrent && prior.data.fingerprint === fingerprint) { await this.scope(actor); return { id, version: prior.version, replayed: true, result: prior.data.result } }
    const rows = hours.flatMap(h => h.data.allocations.map(a => {
      const n = notices.get(a.noticeId)!, totalPremiumCents = cents(a.hours, n.data.totalRate), proposedEmployeeCents = cents(a.hours, n.data.employeeRate)
      return { personId: h.personId!, evidenceVersion: h.version, remuneration: h.data.remuneration, method: h.data.method,
        riskClass: a.riskClass, noticeId: n.id, noticeVersion: n.version, sourceEdition: n.data.sourceEdition,
        reference: n.data.reference, documentDigest: n.data.documentDigest, totalRate: n.data.totalRate, employeeRate: n.data.employeeRate,
        hours: a.hours, totalPremiumCents, proposedEmployeeCents, employerRemainderCents: totalPremiumCents - proposedEmployeeCents }
    }))
    const worksheet = [...new Set(rows.map(r => r.riskClass))].sort().map(riskClass => {
      const selected = rows.filter(r => r.riskClass === riskClass)
      return { riskClass, hours: decimal(selected.reduce((n, r) => n + units(r.hours), 0n)),
        totalPremiumCents: selected.reduce((n, r) => n + r.totalPremiumCents, 0),
        proposedEmployeeCents: selected.reduce((n, r) => n + r.proposedEmployeeCents, 0),
        employerRemainderCents: selected.reduce((n, r) => n + r.employerRemainderCents, 0) }
    })
    const result: WaLiResult = { ...p, status: 'preparation-only', companyId: actor.company, unsigned: true, unfiled: true, rule, rows, worksheet,
      totalPremiumCents: rows.reduce((n, r) => n + r.totalPremiumCents, 0), proposedEmployeeCents: rows.reduce((n, r) => n + r.proposedEmployeeCents, 0),
      employerRemainderCents: rows.reduce((n, r) => n + r.employerRemainderCents, 0),
      collectedPremiumCents: null, accountAuthority: false, coverageEstablished: false, paymentReady: false, payrollApproval: null,
      filing: 'unavailable', payment: 'unavailable', holds: ['Unsigned reporting worksheet only; no collected premiums, coverage, state account or submission authority.',
        'Alternative exposure units, partial assumed months, zero-hours filings and accepted quarterly reports and payments remain unproved.'] }
    const saved = await this.store.append<Preparation>(actor, 'wa-li-preparation', id, revision(input.version),
      { ...p, fingerprint, electionVersion, workers, result }, undefined, true, { condition: noHold(actor), reviewSets,
        people: hours.map(h => ({ id: h.personId!, version: h.personVersion! })),
        objects: [...hours.map(h => ({ kind: 'wa-li-hours' as Kind, id: h.id, version: h.version, approved: true })),
          ...[...notices.values()].map(n => ({ kind: 'wa-li-notice' as Kind, id: n.id, version: n.version, approved: true })),
          ...(election ? [{ kind: 'wa-li-election' as Kind, id: election.id, version: election.version, approved: true }] : [])] })
    return { ...saved, result }
  }
  async preparations(actor: Actor) {
    await this.scope(actor)
    return (await this.store.list<Preparation>(actor, 'wa-li-preparation', undefined, true)).map(row => ({ ...row,
      current: !!row.sourcesCurrent, unsigned: true, unfiled: true }))
  }
  async calculation(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['id', 'version'])
    const row = await this.store.find<Preparation>(actor, 'wa-li-preparation', objectId(input.id), undefined, true)
    if (row.version !== integer(input.version) || !row.sourcesCurrent) fail('wa_li_preparation_stale')
    await this.inputs(actor, row.data, row.data.workers, row.data.electionVersion)
    await this.scope(actor)
    return row.data.result
  }
  async evidence(actor: Actor, kind: 'wa-li-notice' | 'wa-li-hours' | 'wa-li-election', id: string | undefined, person: string | undefined, action: string, input: Input, post: boolean) {
    await this.scope(actor, person)
    if (action === '' && !post) return this.store.list(actor, kind, person, true)
    const key = objectId(id)
    if (action === 'review' && !post) return this.store.review(actor, kind, key, person, noHold(actor))
    if (action === 'approve' && post) return this.store.decide(actor, kind, key, input, person, false, noHold(actor))
    fail('not_found', 404)
  }
}
