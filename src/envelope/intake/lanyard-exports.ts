import type { Input } from '../records'
import { PayrollError, text, date } from '../security'
import { digest } from '../workspace/store'
import type { IntakeLine } from './run-input'

const object = (value: unknown): Input => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PayrollError('invalid_provider_export')
  return value as Input
}
const signed = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > 100000000)
    throw new PayrollError('invalid_provider_number')
  return value
}
type Export = { payload: Input; mappings: Input; evidence: string }
const sourceKey = (line: Input) => text(line.timeId || line.payInputId || line.sickUseId || line.holidayPayId || line.arrivalPremiumId, 90)
const sourceRoot = (line: Input) => text(line.rootId || line.payInputId || line.sickUseId || line.holidayPayId || line.arrivalPremiumId || line.timeId, 90)
const detail = (line: Input) => line.sickLine ? ['sick'] : line.holidayPayId ? ['nonwork-holiday'] :
  line.differentialLine ? ['differential', line.ruleId ?? ''] :
  line.premiumLine ? ['premium', line.kind ?? '', line.date ?? ''] :
    line.holidayLine && !line.holidayPayId ? ['holiday', line.date ?? ''] : []
const sourceVersion = (line: Input) => [line.revision, line.premiumRevision, line.ruleRevision].map((value, i) => {
  if (i && value === undefined) return 0
  const version = signed(value)
  if (version < 1) throw new PayrollError('invalid_provider_revision')
  return version
})
const sourceVersionKey = (line: Input) => JSON.stringify([sourceKey(line), line.payCode || 'regular', detail(line), line.premiumInputId ?? ''])
const newer = (current: number[], previous: number[]) => {
  for (let i = 0; i < current.length; i++) if (current[i] !== previous[i]) return current[i] > previous[i]
  return false
}

/** Lanyard exports differences, including negative job allocations and non-work pay. */
export async function lanyardExports(input: Input, previous?: Input) {
  const batch = object(input.payload), mappings = object(input.mappings)
  const evidence = text(input.evidence, 500), batchId = text(batch.id, 60)
  if (!['exported', 'acknowledged'].includes(String(batch.status)) || !batch.exportedBy ||
      typeof batch.exportedAt !== 'string' || !Number.isFinite(Date.parse(batch.exportedAt)))
    throw new PayrollError('approved_provider_export_required', 409)
  if (!Number.isSafeInteger(batch.revision) || Number(batch.revision) < 1 || !Array.isArray(batch.lines))
    throw new PayrollError('invalid_provider_export')
  // History comes only from the retained server version, never the incoming capture.
  const exports = [...((previous?.signedExports as Export[] | undefined) ?? [])]
  const index = exports.findIndex(item => item.payload.id === batchId)
  const item = { payload: batch, mappings, evidence }
  if (index >= 0) {
    if (await digest(JSON.stringify(exports[index].payload)) !== await digest(JSON.stringify(batch)))
      throw new PayrollError('provider_export_changed', 409)
    exports[index] = item
  } else exports.push(item)
  if (exports.reduce((n, item) => n + (item.payload.lines as unknown[]).length, 0) > 5000)
    throw new PayrollError('intake_row_limit')
  const totals = new Map<string, IntakeLine>(), events = new Set<string>()
  const times = new Map<string, { root: string; revision: number }>()
  const revisions = new Map<string, number[]>(), sourceClaims = new Set<string>(), roots = new Set<string>()
  const workers = new Map<string, string>()
  for (const entry of exports) {
    const nextTimes = new Map<string, { root: string; revision: number }>()
    for (const raw of entry.payload.lines as unknown[]) {
      const line = object(raw), key = sourceKey(line), root = sourceRoot(line)
      const code = String(line.payCode || 'regular'), version = sourceVersion(line), revision = version[0]
      if (line.corrects && (!times.has(String(line.corrects)) || times.get(String(line.corrects))!.root !== root))
        throw new PayrollError('provider_correction_history_required', 409)
      const revisionKey = sourceVersionKey(line)
      if ((revisions.has(revisionKey) && !newer(version, revisions.get(revisionKey)!)) ||
          (line.payInputId && revision > 1 && !revisions.has(revisionKey)))
        throw new PayrollError('provider_correction_history_required', 409)
      if (line.timeId && roots.has(root) && !times.has(key) && !line.corrects)
        throw new PayrollError('provider_correction_history_required', 409)
      const mapping = object(entry.mappings[key]), worker = text(line.payrollId)
      let nativeCode: string
      if (line.sickLine === true || line.holidayPayId) nativeCode = 'paid-leave'
      else if (line.differentialLine === true || line.holidayLine === true || line.premiumLine === true) {
        if (mapping.code !== 'other-earning') throw new PayrollError('provider_pay_code_review_required', 409)
        nativeCode = 'other-earning'
      }
      else if (code === 'regular') nativeCode = 'regular'
      else if (code === 'tips') nativeCode = 'tip'
      else if (code === 'PTO') nativeCode = 'paid-leave'
      else if (code === 'meal premium' || code === 'rest premium') nativeCode = code.replaceAll(' ', '-')
      else throw new PayrollError('provider_pay_code_review_required', 409)
      if (mapping.sourcePersonId !== worker) throw new PayrollError('provider_worker_mapping_required', 409)
      if (typeof line.start !== 'string' || !Number.isFinite(Date.parse(line.start)))
        throw new PayrollError('invalid_provider_date')
      const sourceMinutes = signed(line.minutes), minutes = nativeCode === 'other-earning' ? 0 : sourceMinutes
      const monetary = ['tip','paid-leave','other-earning'].includes(nativeCode)
      const amountCents = monetary ? signed(line.costCents) : 0
      if (nativeCode === 'tip' && minutes !== 0) throw new PayrollError('invalid_provider_number')
      if (line.payInputId) {
        const approval = object(line.approval)
        text(approval.by); text(approval.reason, 500)
        if (typeof approval.at !== 'string' || !Number.isFinite(Date.parse(approval.at)))
          throw new PayrollError('approved_provider_export_required', 409)
      }
      const allocation = [line.job ?? '', line.area ?? '', line.site ?? '']
      const suffix = allocation.some(Boolean) ? ':' + (await digest(JSON.stringify(allocation))).slice(0, 12) : ''
      const sourceId = !detail(line).length && ['regular','tips','PTO','meal premium','rest premium'].includes(code)
        ? root + ':' + code.replaceAll(' ', '-') + suffix
        : 'lanyard-' + await digest(JSON.stringify([root,code,allocation,detail(line)]))
      const event = JSON.stringify([revisionKey,version,allocation])
      if (events.has(event)) throw new PayrollError('provider_export_already_claimed', 409)
      events.add(event)
      sourceClaims.add(root + ':' + code.replaceAll(' ', '-'))
      const prior = totals.get(sourceId)
      const personId = text(mapping.personId), day = date(mapping.day), workweek = date(mapping.workweek)
      const sourceWorker = JSON.stringify([worker, personId, day, workweek])
      if (workers.has(root) && workers.get(root) !== sourceWorker)
        throw new PayrollError('provider_correction_mapping_conflict', 409)
      workers.set(root, sourceWorker)
      if (prior && (prior.personId !== personId || prior.day !== day || prior.workweek !== workweek))
        throw new PayrollError('provider_correction_mapping_conflict', 409)
      if (nativeCode === 'tip' && !['cash', 'paycheck'].includes(String(mapping.settlement)))
        throw new PayrollError('tip_settlement_required', 409)
      totals.set(sourceId, {
        sourceId, personId, day, workweek,
        code: nativeCode,
        minutes: (prior?.minutes ?? 0) + minutes,
        amountCents: (prior?.amountCents ?? 0) + amountCents,
        settlement: nativeCode === 'tip' ? String(mapping.settlement) : '',
        evidence: entry.evidence,
        state: ['meal-premium','rest-premium'].includes(nativeCode) ? 'CA' : mapping.state ? text(mapping.state, 2) : '',
        riskClass: '', job: line.job ? text(line.job, 120) : mapping.job ? text(mapping.job, 120) : '',
      })
      nextTimes.set(key, { root, revision })
    }
    for (const [key, value] of nextTimes) times.set(key, value)
    for (const raw of entry.payload.lines as unknown[]) {
      const line = object(raw)
      revisions.set(sourceVersionKey(line), sourceVersion(line))
      roots.add(sourceRoot(line))
    }
    // Each exported batch must reconcile to a nonnegative retained entitlement.
    if ([...totals.values()].some(row => row.minutes < 0 || row.amountCents < 0))
      throw new PayrollError('provider_correction_exceeds_source', 409)
  }
  if (!totals.size) throw new PayrollError('intake_row_limit')
  // A replay of any earlier batch is stable; only reviewed mapping changes create a revision.
  const last = exports.at(-1)!
  return { rows: [...totals.values()], sourceClaims: [...sourceClaims],
    capture: { ...input, payload: last.payload, mappings: last.mappings, evidence: last.evidence,
      signedExports: exports, sourceDigest: await digest(JSON.stringify(last.payload)),
      boundary: 'human-reviewed-capture' } }
}
