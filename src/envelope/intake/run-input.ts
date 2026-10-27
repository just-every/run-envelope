import { read, utils, write } from '@e965/xlsx'
import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, PayrollError } from '../security'
import {
  WorkspaceStore,
  digest,
  objectId,
  revision,
  choice,
} from '../workspace/store'

export const intakeColumns = [
  'sourceId',
  'personId',
  'day',
  'workweek',
  'code',
  'minutes',
  'amountCents',
  'settlement',
  'evidence',
  'state',
  'riskClass',
] as const
export const intakeCodes = [
  'regular',
  'bonus',
  'nondiscretionary-bonus',
  'commission',
  'other-earning',
  'reimbursement',
  'tip',
  'meal-premium',
  'rest-premium',
  'wa-assessment-hours',
  'or-assessment-hours',
] as const
export interface IntakeLine {
  sourceId: string
  personId: string
  day: string
  workweek: string
  code: string
  minutes: number
  amountCents: number
  settlement: string
  evidence: string
  state: string
  riskClass: string
}
export interface RunInput {
  namespace: string
  rows: IntakeLine[]
  fileDigest: string
  editorId: string
  editorName: string
  format: string
}
type Cell = {
  sourceId: string
  personId: string
  workweek: string
  code: string
  field: string
  before: string | number | null
  after: string | number
  status: 'create' | 'change' | 'unchanged'
}
const amount = (v: unknown, fractional = false) => {
  if (
    typeof v !== 'number' &&
    (typeof v !== 'string' || !/^\d+(?:\.\d{1,6})?$/.test(v))
  )
    throw new PayrollError('invalid_intake_number')
  const n = Number(v)
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    n > 100000000 ||
    (!fractional && !Number.isSafeInteger(n))
  )
    throw new PayrollError('invalid_intake_number')
  return n
}
const empty = (v: unknown) => v === undefined || v === null || v === ''
const fileHash = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)),
    byte => byte.toString(16).padStart(2, '0')
  ).join('')

/** One bounded workbook, no formulas, inferred people, hidden worksheets or executable macros. */
export function workbookRows(bytes: Uint8Array, mapping: Input = {}) {
  let book
  try {
    book = read(bytes, {
      type: 'array',
      cellFormula: true,
      bookVBA: true,
      sheetRows: 502,
    })
  } catch {
    throw new PayrollError('invalid_intake_file')
  }
  if (
    book.SheetNames.length !== 1 ||
    book.vbaraw ||
    book.Workbook?.Sheets?.some((s) => s.Hidden)
  )
    throw new PayrollError('single_plain_worksheet_required')
  const sheet = book.Sheets[book.SheetNames[0]]
  for (const [key, cell] of Object.entries(sheet))
    if (!key.startsWith('!') && (cell.f || cell.l || cell.t === 'e'))
      throw new PayrollError('intake_formula_or_link_refused')
  const table = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  })
  if (table.length < 2 || table.length > 501)
    throw new PayrollError('intake_row_limit')
  const headers = table[0].map(String)
  if (new Set(headers).size !== headers.length)
    throw new PayrollError('duplicate_intake_column')
  const selected = intakeColumns.map((key) => String(mapping[key] || key))
  if (
    new Set(selected).size !== selected.length ||
    selected.some((h) => !headers.includes(h))
  )
    throw new PayrollError('intake_column_mapping_required')
  return table
    .slice(1)
    .map((row) =>
      Object.fromEntries(
        intakeColumns.map((key, i) => [
          key,
          row[headers.indexOf(selected[i])] ?? '',
        ])
      )
    )
}
export function intakeTemplate(format: string) {
  choice(format, ['csv', 'xls', 'xlsx'])
  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.aoa_to_sheet([[...intakeColumns]]),
    'Earnings'
  )
  return new Uint8Array(
    write(book, {
      type: 'array',
      bookType: format === 'xls' ? 'biff8' : (format as 'csv' | 'xlsx'),
    })
  )
}
export async function runInputMultipart(request: Request): Promise<Input> {
  const reader = request.body?.getReader()
  if (!reader) throw new PayrollError('invalid_input')
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > 700000) {
      await reader.cancel()
      throw new PayrollError('input_too_large', 413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  let form: FormData
  try {
    form = await new Response(bytes, {
      headers: { 'content-type': request.headers.get('content-type')! },
    }).formData()
  } catch {
    throw new PayrollError('invalid_input')
  }
  const values: Input = {}
  for (const [key, value] of form) {
    if (Object.hasOwn(values, key)) throw new PayrollError('duplicate_input')
    values[key] = value
  }
  const file = values.file
  if (file instanceof File && file.size) {
    if (file.size > 512000 || !/\.(csv|xls|xlsx)$/i.test(file.name))
      throw new PayrollError('invalid_intake_file')
    const content = new Uint8Array(await file.arrayBuffer())
    values.fileBytes = content
    values.format = file.name.split('.').at(-1)!.toLowerCase()
  }
  return values
}
export class RunIntake {
  constructor(public store: WorkspaceStore) {}
  async rows(actor: Actor) {
    return this.store.list<RunInput>(actor, 'run-intake', undefined, true)
  }
  async preview(actor: Actor, input: Input) {
    await this.store.authority(actor, 'rates:propose', undefined, true)
    const id = objectId(input.id),
      expected = revision(input.version),
      namespace = text(input.namespace, 120)
    const existing = (await this.rows(actor)).find((r) => r.id === id)
    if ((existing?.version ?? 0) !== expected)
      throw new PayrollError('intake_version_conflict', 409)
    if (existing && existing.data.namespace !== namespace)
      throw new PayrollError('intake_namespace_immutable', 409)
    let patches: unknown = input.rows,
      format = choice(input.format || 'grid', ['grid', 'csv', 'xls', 'xlsx']),
      fileDigest = ''
    let mapping: Input = {}
    try {
      mapping =
        typeof input.columnMap === 'string'
          ? JSON.parse(input.columnMap || '{}')
          : ((input.columnMap as Input) ?? {})
    } catch {
      throw new PayrollError('invalid_column_mapping')
    }
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping))
      throw new PayrollError('invalid_column_mapping')
    for (const key of intakeColumns)
      if (typeof input['map.' + key] === 'string' && input['map.' + key])
        mapping[key] = input['map.' + key]
    if (input.fileBytes instanceof Uint8Array) {
      patches = workbookRows(input.fileBytes, mapping)
      fileDigest = await fileHash(input.fileBytes)
    } else if (typeof input.csv === 'string' && input.csv.trim()) {
      const bytes = new TextEncoder().encode(input.csv)
      patches = workbookRows(bytes, mapping)
      fileDigest = await fileHash(bytes)
      format = 'csv'
    } else if (typeof patches === 'string') {
      try {
        patches = JSON.parse(patches)
      } catch {
        throw new PayrollError('invalid_intake_rows')
      }
    }
    if (!patches) {
      patches = [0, 1, 2]
        .map((i) =>
          Object.fromEntries(
            intakeColumns.map((key) => [key, input[`row${i}.${key}`] ?? ''])
          )
        )
        .filter((row) => row.sourceId)
    }
    if (!Array.isArray(patches) || !patches.length || patches.length > 500)
      throw new PayrollError('intake_row_limit')
    const rows = [...(existing?.data.rows ?? [])],
      cells: Cell[] = [],
      seen = new Set<string>()
    const people = new Map(
      (await this.store.records.people(actor)).map((p) => [p.id, p])
    )
    for (const raw of patches) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new PayrollError('invalid_intake_row')
      const patch = raw as Input,
        sourceId = text(patch.sourceId, 120)
      if (seen.has(sourceId)) throw new PayrollError('duplicate_intake_source')
      seen.add(sourceId)
      const index = rows.findIndex((r) => r.sourceId === sourceId),
        prior = rows[index]
      const merged = Object.fromEntries(
        intakeColumns.map((key) => [
          key,
          empty(patch[key]) ? (prior?.[key] ?? '') : patch[key],
        ])
      ) as Input
      const line: IntakeLine = {
        sourceId,
        personId: objectId(merged.personId),
        day: date(merged.day),
        workweek: date(merged.workweek),
        code: choice(merged.code, intakeCodes),
        minutes: amount(merged.minutes || 0, true),
        amountCents: amount(merged.amountCents || 0),
        settlement: empty(merged.settlement)
          ? ''
          : choice(merged.settlement, ['cash', 'paycheck']),
        evidence: text(merged.evidence, 500),
        state: empty(merged.state) ? '' : text(merged.state, 2),
        riskClass: empty(merged.riskClass) ? '' : text(merged.riskClass, 80),
      }
      if (!people.has(line.personId))
        throw new PayrollError('intake_person_mapping_required', 409)
      await this.store.authority(actor, 'rates:propose', line.personId, true)
      const weekEnd = new Date(line.workweek + 'T12:00:00Z')
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
      if (
        line.day < line.workweek ||
        line.day > weekEnd.toISOString().slice(0, 10)
      )
        throw new PayrollError('intake_workweek_mismatch')
      if (line.minutes > 1440) throw new PayrollError('invalid_intake_minutes')
      if (line.code === 'tip' && !line.settlement)
        throw new PayrollError('tip_settlement_required', 409)
      if (line.code !== 'tip' && line.settlement)
        throw new PayrollError('unexpected_tip_settlement')
      if (line.code === 'regular' && line.amountCents !== 0)
        throw new PayrollError('regular_hours_require_reviewed_rate')
      if (
        line.code !== 'regular' &&
        !line.code.endsWith('assessment-hours') &&
        line.minutes !== 0
      )
        throw new PayrollError('premium_or_earning_cannot_create_hours')
      if (
        line.code.endsWith('assessment-hours') &&
        (line.amountCents ||
          line.state !== (line.code.startsWith('wa-') ? 'WA' : 'OR') ||
          (line.state === 'WA' && !line.riskClass))
      )
        throw new PayrollError('invalid_assessment_allocation')
      for (const field of intakeColumns)
        cells.push({
          sourceId,
          personId: line.personId,
          workweek: line.workweek,
          code: line.code,
          field,
          before: prior?.[field] ?? null,
          after: line[field],
          status: !prior
            ? 'create'
            : prior[field] === line[field]
              ? 'unchanged'
              : 'change',
        })
      if (index < 0) rows.push(line)
      else rows[index] = line
    }
    if (rows.length > 500) throw new PayrollError('intake_row_limit')
    for (const personId of new Set(rows.map((r) => r.personId))) {
      const weeks = [
        ...new Set(
          rows.filter((r) => r.personId === personId).map((r) => r.workweek)
        ),
      ].sort()
      if (
        weeks.some(
          (w) => (Date.parse(w) - Date.parse(weeks[0])) % 604800000 !== 0
        )
      )
        throw new PayrollError('intake_workweek_conflict')
    }
    rows.sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    const claims = await Promise.all(
      rows.map((r) => digest(JSON.stringify([namespace, r.sourceId])))
    )
    const collision = await this.store.records
      .statement(
        `SELECT source_person_id FROM env_workspace_review_inputs WHERE company_id=? AND source_kind='intake-source' AND object_id!=? AND source_person_id IN(SELECT value FROM json_each(?))`,
        [actor.company, id, JSON.stringify(claims)]
      )
      .first()
    if (collision) throw new PayrollError('source_already_assigned_to_run', 409)
    if (
      !fileDigest &&
      typeof input.fileDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(input.fileDigest)
    )
      fileDigest = input.fileDigest
    const data: RunInput = {
      namespace,
      rows,
      fileDigest,
      editorId: actor.session.operator.id,
      editorName: actor.session.operator.displayName,
      format,
    }
    const exact = await digest(
      JSON.stringify([
        actor.company,
        actor.session.id,
        actor.grant.version,
        id,
        expected,
        namespace,
        rows,
        fileDigest,
        format,
      ])
    )
    return {
      id,
      version: expected,
      data,
      cells,
      digest: exact,
      claims,
      unchanged: Boolean(
        existing && JSON.stringify(existing.data.rows) === JSON.stringify(rows)
      ),
      existing,
    }
  }
  async apply(actor: Actor, input: Input) {
    const preview = await this.preview(actor, input)
    if (input.digest !== preview.digest)
      throw new PayrollError('intake_preview_changed', 409)
    if (preview.unchanged)
      return { id: preview.id, version: preview.version, replayed: true }
    const people = [...new Set(preview.data.rows.map((r) => r.personId))]
    const pins = await Promise.all(
      people.map(async (id) => ({
        id,
        version: (await this.store.records.person(actor, id)).version,
      }))
    )
    return {
      ...(await this.store.append(
        actor,
        'run-intake',
        preview.id,
        preview.version,
        preview.data,
        undefined,
        true,
        { people: pins, exclusiveSourceIds: preview.claims }
      )),
      replayed: false,
    }
  }
}
