import type { Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, date, integer, text } from '../security'
import { WorkspaceStore, digest, revision, choice } from '../workspace/store'
import type { TipEntry } from '../workspace/tips'

const columns = ['sourceItem', 'day', 'amountCents', 'settlement', 'furnishedCents', 'settlementEvidence'] as const
const cents = (v: unknown) => v === 0 || v === '0' ? 0 : integer(v)
const object = (v: unknown): Input => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new PayrollError('invalid_tip_mapping')
  return v as Input
}
/** Bounded RFC 4180 records; quoted commas, newlines and escaped quotes are data. */
function csv(value: unknown) {
  if (typeof value !== 'string' || value.length > 120000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))
    throw new PayrollError('invalid_tip_csv')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false, closed = false
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (quoted) {
      if (c === '"' && value[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else cell += c
    } else if (c === ',' || c === '\r' || c === '\n') {
      row.push(cell); cell = ''; closed = false
      if (c !== ',') {
        if (c === '\r' && value[i + 1] === '\n') i++
        rows.push(row); row = []
      }
    } else if (c === '"' && !cell && !closed) quoted = true
    else {
      if (closed || c === '"') throw new PayrollError('invalid_tip_csv')
      cell += c
    }
  }
  if (quoted) throw new PayrollError('invalid_tip_csv')
  if (cell || row.length || closed) rows.push([...row, cell])
  if (rows.length < 2 || rows.length > 501) throw new PayrollError('invalid_tip_csv')
  const header = rows.shift()!.map(v => v.trim())
  if (header.some(v => !v) || new Set(header).size !== header.length || rows.some(r => r.length !== header.length))
    throw new PayrollError('invalid_tip_csv')
  return { header, rows }
}

export const tipTemplate = columns.join(',') + '\r\nsynthetic-envelope-1,2026-03-02,60000,cash,0,synthetic-envelope-2\r\n'

/** One source item is applied atomically, after an exact preview, never a partial batch. */
export class TipIntake {
  constructor(public store: WorkspaceStore) {}
  async record(actor: Actor, personId: string, input: Input) {
    await this.store.authority(actor, 'rates:propose', personId, true)
    const format = choice(input.format, ['manual', 'csv'])
    const mode = choice(input.mode, ['preview', 'apply'])
    const sourceRef = text(input.sourceRef, 240)
    let values: Input, fileDigest = '', sourceRow = 1, mapping: Input = {}
    if (format === 'csv') {
      const parsed = csv(input.csv)
      const provided = object(input.mapping)
      mapping = Object.fromEntries(columns.map(k => [k, text(provided[k])]))
      const mapped = columns.map(k => text(mapping[k]))
      if (new Set(mapped).size !== mapped.length || mapped.some(k => !parsed.header.includes(k)))
        throw new PayrollError('invalid_tip_mapping')
      sourceRow = integer(input.row)
      const selected = parsed.rows[sourceRow - 1]
      if (!selected) throw new PayrollError('invalid_tip_row')
      values = Object.fromEntries(columns.map(k => [k, selected[parsed.header.indexOf(String(mapping[k]))].trim()]))
      fileDigest = await digest(String(input.csv))
    } else values = object(input.values)
    const sourceItem = text(values.sourceItem, 240)
    // Person is deliberately absent: the same item cannot be assigned to two workers.
    const id = 'tip-source-' + (await digest(JSON.stringify([sourceRef, sourceItem]))).slice(0, 40)
    const history = await this.store.list<TipEntry>(actor, 'tip', personId, true, false)
    const prior = history.find(r => r.id === id)
    const version = prior?.version ?? 0
    if (revision(input.version) !== version) throw new PayrollError('tip_source_version_changed', 409)
    const preserve = (key: string) => values[key] === '' || values[key] === undefined
      ? prior?.data[key as keyof TipEntry] : values[key]
    const settlement = preserve('settlement')
    if (!settlement) throw new PayrollError('ambiguous_tip_settlement')
    const after = {
      day: date(preserve('day')),
      amountCents: cents(preserve('amountCents')),
      settlement: choice(settlement, ['cash', 'paycheck']) as TipEntry['settlement'],
      furnishedCents: cents(preserve('furnishedCents')),
      settlementEvidence: text(preserve('settlementEvidence'), 500),
      sourceRef,
      sourceItem,
    }
    if (after.furnishedCents > after.amountCents) throw new PayrollError('invalid_tip_funds')
    const before = prior ? Object.fromEntries(Object.keys(after).map(k => [k, prior.data[k as keyof TipEntry]])) : null
    const status = !prior ? 'create' : JSON.stringify(before) === JSON.stringify(after) ? 'unchanged' : 'change'
    const preview = { id, version, personId, sourceRow, fileDigest, mapping, before, after, status }
    const previewDigest = await digest(JSON.stringify(preview))
    if (mode === 'preview') return { ...preview, previewDigest, applied: false }
    if (input.previewDigest !== previewDigest) throw new PayrollError('tip_preview_changed', 409)
    if (status === 'unchanged') return { ...preview, applied: false }
    const saved = await this.store.append(actor, 'tip', id, version, {
      ...after, owner: actor.session.operator.displayName, ownerId: actor.session.operator.id,
      provenance: { format, fileDigest, sourceRow, mapping, before, editorId: actor.session.operator.id },
    }, personId, true)
    return { ...preview, ...saved, applied: true }
  }
}
