import type { Actor } from '../access'
import { requireAction } from '../access'
import { PayrollError, text, date } from '../security'
import type { Input } from '../records'

export type WorkKind = 'run' | 'notice' | 'registration' | 'funding' | 'filing'
export type SourceKind = 'earnings-run' | 'notice' | 'registration'
export interface FirmSettings { blotterOrigin: string; version: number }
export interface FirmPerson {
  id: string; name: string; role: string; locations: string[]; fields: string[]; actions: string[]
}
export interface WorkData {
  title: string; details: string; dueDate: string; dueTime: string; timeZone: string; evidenceRef: string
  handoff?: { jobUrl: string; jobId: string; recipientId: string; evidenceRef: string; recordedBy: string; recordedAt: number }
  acknowledgement?: { evidenceRef: string; actorId: string; occurredAt: number }
}
export interface FirmWorkItem {
  id: string; companyId: string; workKind: WorkKind; sourceKind: SourceKind; sourceId: string; sourceVersion: number
  locationId: string | null; action: string; fields: string[]; assigneeId: string; backupId: string | null
  version: number; status: 'open' | 'pending-handoff' | 'acknowledged' | 'recipient-changed'
  sourceCurrent: number; data: WorkData; createdBy: string; updatedAt: number
}
export interface FirmWorkHistory {
  id: number; version: number; assigneeId: string; assigneeName: string; backupId: string | null; backupName: string | null
  actorId: string | null; actorName: string | null; authoritySubject: string | null; authoritySubjectName: string | null
  event: string; occurredAt: number; status: FirmWorkItem['status']; data: WorkData
}
export interface WorkRow {
  company_id: string; id: string; work_kind: WorkKind; source_kind: SourceKind; source_id: string; source_version: number
  location_id: string | null; action: string; fields: string; assignee_id: string; backup_id: string | null
  version: number; handoff_state: FirmWorkItem['status']; cipher: string; created_by: string; updated_at: number; sourceCurrent: number
}
export const context = (company: string, id: string) => JSON.stringify([company, 'firm-work', id])
export const sourceCurrent = (w: string) => `(CASE ${w}.source_kind
 WHEN 'notice' THEN EXISTS(SELECT 1 FROM env_notices n WHERE n.company_id=${w}.company_id AND n.id=${w}.source_id AND ${w}.source_version=1 AND n.location_id=${w}.location_id)
 WHEN 'registration' THEN ${w}.source_version=(SELECT MAX(version) FROM env_jurisdictions j WHERE j.company_id=${w}.company_id AND j.code=${w}.source_id)
 ELSE ${w}.source_version=(SELECT MAX(version) FROM env_workspace_versions v WHERE v.company_id=${w}.company_id AND v.kind='earnings-run' AND v.object_id=${w}.source_id) END)`
export function workScope(actor: Actor, row: Pick<WorkRow, 'location_id' | 'action' | 'fields'>, write = false) {
  requireAction(actor, write ? 'records:write' : 'records:read', row.location_id || undefined)
  if (write) requireAction(actor, row.action, row.location_id || undefined)
  if (!row.location_id && actor.grant.role !== 'owner' && !actor.grant.locations.includes('*'))
    throw new PayrollError('payroll_access_denied', 403)
  for (const field of JSON.parse(row.fields) as string[]) requireAction(actor, write ? 'records:write' : 'records:read', row.location_id || undefined, field)
}
export function workInput(input: Input) {
  const workKind = text(input.workKind || input.category || 'run') as WorkKind
  const sourceKind: SourceKind = workKind === 'notice' ? 'notice' : ['registration', 'filing'].includes(workKind) ? 'registration' : 'earnings-run'
  if (!['run', 'notice', 'registration', 'funding', 'filing'].includes(workKind) || (input.sourceKind && input.sourceKind !== sourceKind))
    throw new PayrollError('invalid_work_source')
  const allowed = sourceKind === 'earnings-run' ? ['rates:propose', 'pay:approve'] : sourceKind === 'notice' ? ['notices:write', 'notices:approve'] : ['records:write']
  const action = input.action ? text(input.action) : allowed[0]
  if (!allowed.includes(action)) throw new PayrollError('invalid_work_action')
  const required = sourceKind === 'earnings-run' ? 'compensation' : 'tax'
  const fields = Array.isArray(input.fields) ? [...new Set([...input.fields, required])] : [required]
  if (fields.some(f => !['compensation', 'tax'].includes(String(f)))) throw new PayrollError('invalid_scope')
  const dueTime = text(input.dueTime, 5), timeZone = text(input.timeZone, 100)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) throw new PayrollError('invalid_work_deadline')
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format() } catch { throw new PayrollError('invalid_work_timezone') }
  const data: WorkData = { title: text(input.title, 200), details: text(input.details, 8000), dueDate: date(input.dueDate), dueTime, timeZone, evidenceRef: text(input.evidenceRef, 1000) }
  return { workKind, sourceKind, action, fields: JSON.stringify(fields), data }
}
