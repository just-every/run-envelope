import * as XLSX from 'xlsx'
import type { Actor } from '../access'
import type { Input } from '../records'
import { states } from '../setup'
import { date, integer, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, digest, choice } from './store'
import { PayItems } from './pay-items'

const fields = ['rowId','personId','day','code','minutes','amountCents','settlement','state','riskClass','coveredMinutes','sourceRef'] as const
const codes = ['hours','tip','bonus','reimbursement','meal-premium','rest-premium','assessment'] as const
export interface IntakeRow {
  rowId: string; personId: string; day: string; code: string; minutes: number; amountCents: number
  settlement: string; state: string; riskClass: string; coveredMinutes: number; sourceRef: string
}
export interface RunInput {
  workweekStart?: string; bonusAllocation?: string
  name: string; groupId: string; periodStart: string; periodEnd: string; rows: IntakeRow[]
  fileName: string; fileDigest: string
  diff: {rowId:string; sourceRow:number; action:string; before:IntakeRow|null; after:IntakeRow}[]
}
const numeric = (v: unknown) => v === 0 || v === '0' ? 0 : integer(v)
const blank = (v: unknown) => v === undefined || v === null || v === ''

/** No worksheet row limit is passed to the reader: a bound refuses the whole file. */
export function worksheetRows(bytes: Uint8Array, mapping: Record<string,string> = {}) {
  let book: XLSX.WorkBook
  try { book = XLSX.read(bytes, {type:'array',cellDates:false,raw:true}) }
  catch { throw new PayrollError('invalid_earnings_file') }
  if (book.SheetNames.length !== 1) throw new PayrollError('one_earnings_worksheet_required')
  const sheet = book.Sheets[book.SheetNames[0]]
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  if (range.e.r > 10000 || range.e.c > 100) throw new PayrollError('earnings_worksheet_too_large',413)
  if (Object.entries(sheet).some(([key,value]) => !key.startsWith('!') && value && typeof value === 'object' && 'f' in value)) throw new PayrollError('earnings_formulas_require_values')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',blankrows:true,raw:true})
  const header = (rows.shift() ?? []).map(String)
  if (new Set(header).size !== header.length) throw new PayrollError('duplicate_earnings_column')
  for (const key of Object.keys(mapping)) if (!fields.includes(key as typeof fields[number])) throw new PayrollError('unknown_earnings_mapping')
  const columns = fields.map(field => header.indexOf(mapping[field] ?? field))
  if (columns[0] < 0 || columns[1] < 0) throw new PayrollError('earnings_identity_columns_required')
  return rows.map((row,index) => ({...Object.fromEntries(fields.map((field,i) => [field,columns[i]<0?'':row[columns[i]]])),sourceRow:index+2}))
    .filter(row => fields.some(field => !blank((row as Input)[field])))
}
export async function earningsMultipart(request: Request): Promise<Input> {
  if (!request.body) throw new PayrollError('earnings_file_required')
  const reader=request.body.getReader(), chunks:Uint8Array[]=[]
  let size=0
  while(true) {
    const {done,value}=await reader.read()
    if(done) break
    size+=value.length
    if(size>2*1024*1024) {await reader.cancel();throw new PayrollError('earnings_file_too_large',413)}
    chunks.push(value)
  }
  const bytes=new Uint8Array(size)
  let offset=0
  for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length}
  const form = await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData()
  const file = form.get('file')
  if (!(file instanceof File) || !/\.(csv|xls|xlsx)$/i.test(file.name)) throw new PayrollError('earnings_file_required')
  const input: Input = {}
  for (const [key,value] of form) {
    if (form.getAll(key).length !== 1) throw new PayrollError('duplicate_input')
    if (key !== 'file' && typeof value === 'string') input[key] = value
  }
  let mapping: Record<string,string> = {}
  try { mapping = input.mapping ? JSON.parse(String(input.mapping)) : {} }
  catch { throw new PayrollError('invalid_earnings_mapping') }
  if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object' || Object.values(mapping).some(v => typeof v !== 'string')) throw new PayrollError('invalid_earnings_mapping')
  const contents = new Uint8Array(await file.arrayBuffer())
  input.rows = worksheetRows(contents,mapping)
  input.fileName = file.name
  input.fileDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',contents))).map(byte=>byte.toString(16).padStart(2,'0')).join('')
  return input
}
export function earningsTemplate(format: string) {
  if (!['csv','xls','xlsx'].includes(format)) throw new PayrollError('unknown_earnings_format',404)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([fields.slice()]),'Earnings')
  return new Response(XLSX.write(book,{type:'array',bookType:format as XLSX.BookType}),{headers:{
    'content-type':format==='csv'?'text/csv':'application/octet-stream',
    'content-disposition':`attachment; filename="envelope-earnings.${format}"`,
    'cache-control':'no-store',
  }})
}
export class RunInputs {
  constructor(public store: WorkspaceStore) {}
  async prepare(actor: Actor, input: Input) {
    await this.store.authority(actor,'rates:propose',undefined,true)
    const id = objectId(input.id), group = await new PayItems(this.store).approvedGroup(actor,objectId(input.groupId))
    const count = await this.store.records.statement("SELECT COUNT(*) AS n FROM env_workspace_versions WHERE company_id=? AND kind='run-input'",[actor.company]).first<{n:number}>()
    const rows = await this.store.list<RunInput>(actor,'run-input',undefined,true,false)
    const previous = rows.find(row => row.id === id)
    const expected = revision(input.version)
    if ((previous?.version ?? 0) !== expected) throw new PayrollError('intake_version_changed',409)
    const periodStart = date(input.periodStart), periodEnd = date(input.periodEnd)
    if (periodStart > periodEnd || (Date.parse(periodEnd)-Date.parse(periodStart))/86400000 > 30) throw new PayrollError('invalid_pay_period')
    if (previous && (previous.data.groupId !== group.id || previous.data.periodStart !== periodStart || previous.data.periodEnd !== periodEnd)) throw new PayrollError('intake_scope_changed',409)
    if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length>10000) throw new PayrollError('invalid_earnings_rows')
    const active = rows.filter((row,index) => rows.findIndex(other => other.id === row.id) === index && row.id !== id)
    const result = new Map((previous?.data.rows ?? []).map(row => [row.rowId,row]))
    const seen = new Set<string>(), diff: RunInput['diff'] = []
    for (const [index,raw] of input.rows.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PayrollError('invalid_earnings_row')
      const value = raw as Input, rowId = objectId(value.rowId), before = result.get(rowId) ?? null
      if (seen.has(rowId)) throw new PayrollError('duplicate_earnings_row')
      seen.add(rowId)
      const merged = {...before,...Object.fromEntries(Object.entries(value).filter(([,v]) => !blank(v)))} as Input
      const after: IntakeRow = {rowId,personId:objectId(merged.personId),day:date(merged.day),code:choice(merged.code,codes),
        minutes:numeric(merged.minutes ?? 0),amountCents:numeric(merged.amountCents ?? 0),
        settlement:blank(merged.settlement)?'':choice(merged.settlement,['cash','paycheck']),
        state:blank(merged.state)?'':choice(merged.state,states),riskClass:blank(merged.riskClass)?'':text(merged.riskClass,80),
        coveredMinutes:numeric(merged.coveredMinutes ?? 0),sourceRef:text(merged.sourceRef)}
      if (!group.data.people.some(person => person.id === after.personId)) throw new PayrollError('person_outside_reviewed_group')
      if (before && (before.personId !== after.personId || before.sourceRef !== after.sourceRef || before.code !== after.code)) throw new PayrollError('earnings_source_identity_changed',409)
      if (after.day < periodStart || after.day > periodEnd) throw new PayrollError('earning_outside_run_period')
      if (!before && (after.code === 'tip' && blank(merged.amountCents) || after.code === 'hours' && blank(merged.minutes))) throw new PayrollError('earning_amount_required')
      if (['hours','assessment'].includes(after.code) && !after.state) throw new PayrollError('earning_state_required')
      if (after.code === 'tip' && !after.settlement) throw new PayrollError('ambiguous_tip_settlement')
      if (after.code !== 'tip' && after.settlement) throw new PayrollError('unexpected_tip_settlement')
      if (after.code !== 'hours' && after.minutes) throw new PayrollError('premium_or_assessment_cannot_add_work_hours')
      if (after.minutes > 1440 || after.coveredMinutes > 1440) throw new PayrollError('invalid_work_minutes')
      if (after.riskClass && after.state !== 'WA') throw new PayrollError('risk_class_requires_wa')
      result.set(rowId,after)
      diff.push({rowId,sourceRow:numeric(value.sourceRow ?? index+1),action:!before?'create':JSON.stringify(before)===JSON.stringify(after)?'unchanged':'change',before,after})
    }
    const next = [...result.values()]
    if (active.some(run => run.data.rows.some(row => next.some(nextRow => nextRow.sourceRef === row.sourceRef)))) throw new PayrollError('source_already_in_another_run',409)
    if (new Set(next.map(row => row.sourceRef)).size !== next.length) throw new PayrollError('duplicate_earning_source')
    const workweekStart = input.workweekStart ? date(input.workweekStart) : previous?.data.workweekStart
    const bonusAllocation = input.bonusAllocation ? choice(input.bonusAllocation,['hours-worked']) : previous?.data.bonusAllocation
    if (workweekStart && (workweekStart>periodStart || (Date.parse(periodStart)-Date.parse(workweekStart))/86400000>6)) throw new PayrollError('invalid_workweek_anchor')
    const data: RunInput = {workweekStart,bonusAllocation,name:`Run ${id} earnings`,groupId:group.id,periodStart,periodEnd,rows:next,diff,
      fileName:input.fileName ? text(input.fileName,240) : 'manual-entry',fileDigest:input.fileDigest ? text(input.fileDigest,64):await digest(JSON.stringify(input.rows))}
    return {id,expected,previous,data,group,count:count!.n}
  }
  async save(actor: Actor,input: Input) {
    const ready = await this.prepare(actor,input)
    if (ready.previous && ready.data.diff.every(row => row.action==='unchanged') && ready.data.workweekStart===ready.previous.data.workweekStart && ready.data.bonusAllocation===ready.previous.data.bonusAllocation) return {id:ready.id,kind:'run-input',version:ready.expected,replayed:true}
    return this.store.append(actor,'run-input',ready.id,ready.expected,ready.data,undefined,true,{
      writeFence:{sql:"(SELECT COUNT(*) FROM env_workspace_versions WHERE company_id=? AND kind='run-input')=?",args:[actor.company,ready.count]},
      people:ready.group.data.people.map(person => ({id:person.id,version:person.version})),
      objects:[{kind:'group',id:ready.group.id,version:ready.group.version,approved:true}],
    })
  }
}
