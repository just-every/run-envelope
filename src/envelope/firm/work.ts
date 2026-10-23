import type { Records, Input } from '../records'
import type { Actor } from '../access'
import { fence, auditStatement, requireAction } from '../access'
import { PayrollError, text, integer, recordKey, seal, unseal } from '../security'
import { context, sourceCurrent, workInput, workScope, type FirmSettings, type FirmPerson, type FirmWorkItem, type WorkRow, type WorkData, type FirmWorkHistory } from './work-types'
import { handoffInput, acknowledgementInput } from './handover'
export type { FirmSettings, FirmPerson, FirmWorkItem, WorkData, WorkKind, SourceKind } from './work-types'

const uuid = () => crypto.randomUUID()
export class FirmWork {
  constructor(public records: Records) {}
  async settings(actor: Actor): Promise<FirmSettings> {
    const f = fence(actor)
    const row = await this.records.statement(`SELECT blotter_origin AS blotterOrigin,version FROM env_firm_settings WHERE company_id=? AND ${f.sql}`, [actor.company, ...f.args]).first<FirmSettings>()
    return row || { blotterOrigin: '', version: 0 }
  }
  async configure(actor: Actor, input: Input) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
    const value = text(input.blotterOrigin, 300)
    let url: URL
    try { url = new URL(value) } catch { throw new PayrollError('invalid_blotter_origin') }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || value !== url.origin)
      throw new PayrollError('invalid_blotter_origin')
    const version = input.version === 0 || input.version === '0' ? 0 : integer(input.version), f = fence(actor), event = uuid()
    const result = await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_firm_settings(company_id,blotter_origin,version,change_id,actor_id,updated_at)
        SELECT ?,?,1,?,?,? WHERE ${f.sql} AND (?=0 OR EXISTS(SELECT 1 FROM env_firm_settings WHERE company_id=? AND version=?))
        ON CONFLICT(company_id) DO UPDATE SET blotter_origin=excluded.blotter_origin,version=env_firm_settings.version+1,change_id=excluded.change_id,actor_id=excluded.actor_id,updated_at=excluded.updated_at WHERE env_firm_settings.version=? RETURNING version`,
      [actor.company, url.origin, event, actor.session.operator.id, Date.now(), ...f.args, version, actor.company, version, version]),
      auditStatement(this.records.env, actor, event, 'firm.settings.changed', actor.company, version + 1, 'EXISTS(SELECT 1 FROM env_firm_settings WHERE change_id=?)', [event]),
    ])
    if (!result[0].results.length) throw new PayrollError('firm_settings_changed', 409)
    return { blotterOrigin: url.origin, version: version + 1 }
  }
  async people(actor: Actor): Promise<FirmPerson[]> {
    requireAction(actor, 'records:read')
    const f = fence(actor)
    const rows = (await this.records.statement(`SELECT o.id,o.display_name AS name,g.role,g.locations,g.fields,g.actions FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=? AND g.revoked_at IS NULL AND o.status='active' AND ${f.sql} ORDER BY o.display_name,o.id`, [actor.company, ...f.args]).all<{ id: string; name: string; role: string; locations: string; fields: string; actions: string }>()).results
    return rows.map(r => ({ ...r, locations: JSON.parse(r.locations), fields: JSON.parse(r.fields), actions: JSON.parse(r.actions) }))
  }
  visible(actor: Actor) {
    const f = fence(actor)
    return { sql: `${f.sql} AND EXISTS(SELECT 1 FROM env_grants vg WHERE vg.company_id=w.company_id AND vg.operator_id=? AND (vg.role='owner' OR (
      EXISTS(SELECT 1 FROM json_each(vg.actions) WHERE value='records:read')
      AND EXISTS(SELECT 1 FROM json_each(vg.locations) WHERE value='*' OR value=w.location_id)
      AND NOT EXISTS(SELECT 1 FROM json_each(w.fields) wf WHERE NOT EXISTS(SELECT 1 FROM json_each(vg.fields) WHERE value=wf.value)))))`, args: [...f.args, actor.session.operator.id] }
  }
  async decode(row: WorkRow): Promise<FirmWorkItem> {
    const key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    return { id: row.id, companyId: row.company_id, workKind: row.work_kind, sourceKind: row.source_kind, sourceId: row.source_id, sourceVersion: row.source_version,
      locationId: row.location_id, action: row.action, fields: JSON.parse(row.fields), assigneeId: row.assignee_id, backupId: row.backup_id,
      version: row.version, status: row.handoff_state, sourceCurrent: row.sourceCurrent, data: JSON.parse(await unseal(key, context(row.company_id, row.id), row.cipher)), createdBy: row.created_by, updatedAt: row.updated_at }
  }
  async list(actor: Actor): Promise<FirmWorkItem[]> {
    const f = this.visible(actor), event = uuid()
    const results = await this.records.env.DB.batch<Record<string, unknown>>([
      auditStatement(this.records.env, actor, event, 'firm.work.read', actor.company, actor.grant.version),
      this.records.statement(`SELECT w.*,${sourceCurrent('w')} AS sourceCurrent FROM env_firm_work w WHERE w.company_id=? AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) ORDER BY w.updated_at DESC,w.id`, [actor.company, ...f.args, event]),
    ])
    if (!results[0].meta.changes) throw new PayrollError('authority_changed', 409)
    return Promise.all((results[1].results as unknown as WorkRow[]).map(r => this.decode(r)))
  }
  async row(actor: Actor, id: string, write = false) {
    const f = this.visible(actor)
    const row = await this.records.statement(`SELECT w.*,${sourceCurrent('w')} AS sourceCurrent FROM env_firm_work w WHERE w.company_id=? AND w.id=? AND ${f.sql}`, [actor.company, text(id), ...f.args]).first<WorkRow>()
    if (!row) throw new PayrollError('firm_work_unavailable', 403)
    workScope(actor, row, write)
    return row
  }
  async save(actor: Actor, input: Input) {
    const parsed = workInput(input), sourceId = text(input.sourceId), sourceVersion = integer(input.sourceVersion)
    let locationId: string | null = null
    const f = fence(actor)
    if (parsed.sourceKind === 'notice') {
      const n = await this.records.statement(`SELECT location_id FROM env_notices WHERE company_id=? AND id=? AND ${f.sql}`, [actor.company, sourceId, ...f.args]).first<{ location_id: string }>()
      if (!n || sourceVersion !== 1) throw new PayrollError('invalid_work_source')
      locationId = n.location_id
    }
    if (input.locationId && input.locationId !== locationId) throw new PayrollError('invalid_work_scope')
    workScope(actor, { location_id: locationId, action: parsed.action, fields: parsed.fields }, true)
    const id = uuid(), key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY), cipher = await seal(key, context(actor.company, id), JSON.stringify(parsed.data)), event = uuid()
    const assignee = text(input.assigneeId), backup = input.backupId ? text(input.backupId) : null
    const source = parsed.sourceKind === 'notice'
      ? `EXISTS(SELECT 1 FROM env_notices WHERE company_id=? AND id=? AND ?=1 AND location_id=?)`
      : parsed.sourceKind === 'registration'
        ? `(SELECT MAX(version) FROM env_jurisdictions WHERE company_id=? AND code=?)=?`
        : `(SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=?)=?`
    const args = parsed.sourceKind === 'notice' ? [actor.company, sourceId, sourceVersion, locationId] : [actor.company, sourceId, sourceVersion]
    const result = await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_firm_work(company_id,id,work_kind,source_kind,source_id,source_version,location_id,action,fields,assignee_id,backup_id,cipher,version,created_by,actor_id,event,change_id,updated_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,'work.created',?,? WHERE ${f.sql} AND ${source} RETURNING id`,
      [actor.company, id, parsed.workKind, parsed.sourceKind, sourceId, sourceVersion, locationId, parsed.action, parsed.fields, assignee, backup, cipher, actor.session.operator.id, actor.session.operator.id, event, Date.now(), ...f.args, ...args]),
      auditStatement(this.records.env, actor, event, 'firm.work.created', id, 1, 'EXISTS(SELECT 1 FROM env_firm_work WHERE company_id=? AND id=?)', [actor.company, id]),
    ])
    if (!result[0].results.length) throw new PayrollError('source_or_authority_changed', 409)
    return { id, version: 1 }
  }
  async update(actor: Actor, row: WorkRow, input: Input, assignee: string, backup: string | null, recipient: string | null, state: FirmWorkItem['status'], data: WorkData, action: string, extra = { sql: '1', args: [] as unknown[] }) {
    const version = integer(input.version), f = fence(actor), event = uuid(), key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    if (version !== row.version) throw new PayrollError('firm_work_changed', 409)
    const cipher = await seal(key, context(actor.company, row.id), JSON.stringify(data))
    const result = await this.records.env.DB.batch([
      this.records.statement(`UPDATE env_firm_work SET assignee_id=?,backup_id=?,handoff_recipient=?,handoff_state=?,cipher=?,version=version+1,actor_id=?,authority_subject=NULL,event=?,change_id=?,updated_at=? WHERE company_id=? AND id=? AND version=? AND ${f.sql} AND ${extra.sql} RETURNING version`, [assignee, backup, recipient, state, cipher, actor.session.operator.id, action, event, Date.now(), actor.company, row.id, version, ...f.args, ...extra.args]),
      auditStatement(this.records.env, actor, event, action, row.id, version + 1, 'EXISTS(SELECT 1 FROM env_firm_work WHERE company_id=? AND id=? AND change_id=?)', [actor.company, row.id, event]),
    ])
    if (!result[0].results.length) throw new PayrollError('firm_work_or_authority_changed', 409)
    return { id: row.id, version: version + 1 }
  }
  async delegate(actor: Actor, id: string, input: Input) {
    const row = await this.row(actor, id, true), item = await this.decode(row)
    const assignee = text(input.assigneeId), state = row.handoff_state === 'pending-handoff' && row.assignee_id !== assignee ? 'recipient-changed' : row.handoff_state
    return this.update(actor, row, input, assignee, input.backupId ? text(input.backupId) : null, item.data.handoff?.recipientId || null, state, item.data, 'work.delegated')
  }
  async handoff(actor: Actor, id: string, input: Input) {
    const row = await this.row(actor, id, true), item = await this.decode(row), settings = await this.settings(actor)
    const handoff = handoffInput(actor, input, settings)
    const data = { ...item.data, handoff, acknowledgement: undefined }
    return this.update(actor, row, input, handoff.recipientId, row.backup_id, handoff.recipientId, 'pending-handoff', data, 'work.handoff.recorded', {
      sql: `${sourceCurrent('env_firm_work')} AND EXISTS(SELECT 1 FROM env_firm_settings WHERE company_id=? AND version=? AND blotter_origin=?)`, args: [actor.company, settings.version, settings.blotterOrigin],
    })
  }
  async acknowledge(actor: Actor, id: string, input: Input) {
    const row = await this.row(actor, id, true), item = await this.decode(row)
    if (row.handoff_state !== 'pending-handoff' || item.data.handoff?.recipientId !== actor.session.operator.id || row.assignee_id !== actor.session.operator.id)
      throw new PayrollError('named_handoff_recipient_required', 403)
    const data = { ...item.data, acknowledgement: acknowledgementInput(actor, input) }
    return this.update(actor, row, input, row.assignee_id, row.backup_id, actor.session.operator.id, 'acknowledged', data, 'work.handoff.acknowledged', { sql: `${sourceCurrent('env_firm_work')} AND handoff_state='pending-handoff' AND handoff_recipient=?`, args: [actor.session.operator.id] })
  }
  async history(actor: Actor, id: string): Promise<FirmWorkHistory[]> {
    await this.row(actor, id)
    const f = this.visible(actor), key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY), event = uuid()
    const results = await this.records.env.DB.batch<Record<string, unknown>>([
      auditStatement(this.records.env, actor, event, 'firm.work.history.read', id, actor.grant.version),
      this.records.statement(`SELECT h.id,h.version,h.cipher,h.assignee_id AS assigneeId,h.assignee_name AS assigneeName,h.backup_id AS backupId,h.backup_name AS backupName,h.actor_id AS actorId,h.actor_name AS actorName,h.authority_subject AS authoritySubject,h.authority_subject_name AS authoritySubjectName,h.event,h.occurred_at AS occurredAt,h.handoff_state AS status FROM env_firm_work_history h JOIN env_firm_work w ON w.company_id=h.company_id AND w.id=h.work_id WHERE w.company_id=? AND w.id=? AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) ORDER BY h.version`, [actor.company, id, ...f.args, event]),
    ])
    if (!results[0].meta.changes) throw new PayrollError('authority_changed', 409)
    return Promise.all(results[1].results.map(async ({ cipher, ...r }) => ({ ...r, data: JSON.parse(await unseal(key, context(actor.company, id), String(cipher))) } as unknown as FirmWorkHistory)))
  }
}
