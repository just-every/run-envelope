// @ts-expect-error Base publishes this runtime journal subpath without declarations.
import { erasureStatements, redactionStatements, invalidateTransfersStatements } from '@runeditrun/rer/modules/portability/journal'
import { fence, auditStatement, type Actor } from './access'
import type { Input, Records } from './records'
import { integer, PayrollError, text, recordKey, unseal } from './security'
import { stepUpFence } from './step-up'
import { digest } from './workspace/store'

const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"'
type Row = Record<string, unknown>
interface Table { name: string; columns: string[]; primary: string[]; parents: { table: string; pairs: { from: string; to: string }[] }[]; rows: Row[] }
interface Entry { id: string; table: string; key: Row; fields: string[]; fingerprint: string; row: Row }
const includes = (value: unknown, ids: Set<string>): boolean => typeof value === 'string' ? ids.has(value) :
  Array.isArray(value) ? value.some(v => includes(v, ids)) : !!value && typeof value === 'object' && Object.values(value).some(v => includes(v, ids))
const explicit = (value: unknown) => value === true || value === 'true'
export interface RetainedRecord { id: string; table: string; key: Row; fields: string[]; legalBasis: string; custodian: string; earliestReleaseAt: string | null; released: boolean }

/** Native local custody. No timer, provider deletion or outbound action. */
export class WorkerPrivacy {
  constructor(public records: Records) {}
  owner(actor: Actor) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.id !== this.records.session.id
      || actor.session.operator.email.trim().toLowerCase() !== this.records.env.OWNER_EMAIL.trim().toLowerCase())
      throw new PayrollError('owner_required', 403)
    return fence(actor)
  }
  async epoch(company: string) {
    return (await this.records.statement('SELECT version FROM env_privacy_epochs WHERE company_id=?', [company]).first<{version: number}>())?.version ?? 0
  }
  async scope(actor: Actor, personId: string) {
    const f = this.owner(actor)
    if (!await this.records.statement(`SELECT 1 WHERE ${f.sql}`, f.args).first()) throw new PayrollError('authority_changed', 409)
    await this.records.person(actor, personId)
    const epoch = await this.epoch(actor.company)
    const names = (await this.records.statement("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'env_*' AND name NOT GLOB 'env_privacy_*' AND name NOT IN ('env_audit','env_agent_access') ORDER BY name").all<{name: string}>()).results
    const tables: Table[] = []
    const key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    const payloads = new Map<Row, unknown>()
    for (const {name} of names) {
      const info = (await this.records.statement(`PRAGMA table_info(${quote(name)})`).all<{name: string; pk: number}>()).results
      if (!info.some(c => c.name === 'company_id')) continue
      const groups = new Map<number, {table: string; pairs: {from: string; to: string}[]}>()
      for (const fk of (await this.records.statement(`PRAGMA foreign_key_list(${quote(name)})`).all<{id: number; table: string; from: string; to: string}>()).results) {
        const group = groups.get(fk.id) ?? {table: fk.table, pairs: []}; group.pairs.push({from: fk.from, to: fk.to}); groups.set(fk.id, group)
      }
      const rows = (await this.records.statement(`SELECT * FROM ${quote(name)} WHERE company_id=?`, [actor.company]).all<Row>()).results
      tables.push({name, columns: info.map(c => c.name), primary: info.filter(c => c.pk).sort((a,b) => a.pk-b.pk).map(c => c.name), parents: [...groups.values()], rows})
      if (name === 'env_workspace_versions') for (const row of rows) payloads.set(row,
        JSON.parse(await unseal(key, JSON.stringify([actor.company, row.kind, row.object_id, row.version]), String(row.cipher))))
    }
    const selected = new Set<Row>(), ids = new Set([personId])
    let changed = true
    while (changed) {
      changed = false
      for (const table of tables) for (const row of table.rows) {
        if (selected.has(row)) continue
        const mappedSource = table.name === 'env_workspace_versions' && tables.find(t => t.name === 'env_hris_people')?.rows.some(link => selected.has(link) && link.source_id === row.object_id && row.kind === 'hris-hire')
        const earlierVersion = table.name === 'env_workspace_versions' && ids.has(String(row.object_id))
        const direct = table.name === 'env_people' ? row.id === personId :
          (table.name === 'env_notices' && ids.has(String(row.id))) ||
          row.person_id === personId || row.source_person_id === personId || ids.has(String(row.source_id))
          || ids.has(String(row.notice_id)) || ids.has(String(row.reply_id)) || includes(payloads.get(row), ids)
        const child = table.parents.some(parent => tables.find(t => t.name === parent.table)?.rows.some(p =>
          selected.has(p) && parent.pairs.every(pair => row[pair.from] != null && row[pair.from] === p[pair.to])))
        // A dependency or people pin belongs to the version containing it, not
        // merely to its referenced source. Include that owning derivative too.
        const owner = table.name === 'env_workspace_versions' && tables.some(t => ['env_workspace_people','env_workspace_dependencies','env_workspace_review_inputs'].includes(t.name)
          && t.rows.some(pin => selected.has(pin) && pin.kind === row.kind && pin.object_id === row.object_id && pin.version === row.version))
        if (direct || child || owner || mappedSource || earlierVersion) {
          selected.add(row); changed = true
          for (const column of ['id','object_id']) if (typeof row[column] === 'string') ids.add(String(row[column]))
        }
      }
    }
    const workers = new Set<string>()
    for (const table of tables) for (const row of table.rows) if(selected.has(row)) {
      if(typeof row.worker_id==='string') workers.add(row.worker_id)
      if(table.name==='env_workspace_versions' && row.kind==='verification-worker') {
        const payload=payloads.get(row) as {workerId?:string}|undefined
        if(payload?.workerId) workers.add(payload.workerId)
      }
    }
    const entries: Entry[] = []
    for (const table of tables) for (const row of table.rows) if (selected.has(row)) {
      if (!table.primary.length) throw new PayrollError('privacy_inventory_unclassified', 409)
      const primary = Object.fromEntries(table.primary.map(column => [column, row[column]]))
      entries.push({id: await digest(JSON.stringify([table.name, primary])), table: table.name, key: primary,
        fields: table.columns, fingerprint: await digest(JSON.stringify(row)), row})
    }
    if (await this.epoch(actor.company) !== epoch) throw new PayrollError('privacy_scope_changed', 409)
    const fingerprint = await digest(JSON.stringify(entries.map(e => [e.id, e.fingerprint])))
    return {entries, tables, epoch, fingerprint, ids, workers}
  }
  async requests(actor: Actor) {
    const f = this.owner(actor)
    const result = await this.records.env.DB.batch([
      auditStatement(this.records.env, actor, crypto.randomUUID(), 'privacy.requests.read', actor.company, 1),
      this.records.statement(`SELECT id,person_id AS personId,status,created_at AS createdAt,completed_at AS completedAt,records_deleted AS recordsDeleted FROM env_privacy_requests WHERE company_id=? AND ${f.sql} ORDER BY created_at,id`, [actor.company, ...f.args]),
    ])
    if (!result[0].meta.changes) throw new PayrollError('authority_changed',409)
    return result[1].results as Row[]
  }
  async read(actor: Actor, personId: string) {
    const f = this.owner(actor), scope = await this.scope(actor, personId)
    const holds = (await this.records.statement('SELECT * FROM env_privacy_holds WHERE company_id=?', [actor.company]).all<Row>()).results
    const retained: RetainedRecord[] = scope.entries.filter(e => e.table !== 'env_people').map(entry => {
      const hold = holds.find(h => h.record_id === entry.id && h.fingerprint === entry.fingerprint)
      return {id: entry.id, table: entry.table, key: entry.key, fields: entry.fields,
        legalBasis: String(hold?.legal_basis ?? 'Unclassified statutory retention; owner review required'),
        custodian: String(hold?.custodian ?? this.records.env.OWNER_EMAIL), earliestReleaseAt: hold?.release_at ? String(hold.release_at) : null,
        released: !!hold?.released_at}
    })
    const result = await this.records.env.DB.batch([
      auditStatement(this.records.env, actor, crypto.randomUUID(), 'privacy.retained-set.read', personId, 1),
      this.records.statement(`SELECT 1 WHERE ${f.sql}`, f.args),
    ])
    if (!result[0].meta.changes || !result[1].results.length) throw new PayrollError('authority_changed', 409)
    return {personId, fingerprint: scope.fingerprint, version: (await this.records.person(actor, personId)).version,
      status: retained.some(r => !r.released) ? 'held' : 'eligible', retained,
      boundary: 'Downloaded copies and already-filed agency records are outside local recall. External provider deletion requires a separate authorized request; this door sends none.'}
  }
  async request(actor: Actor, personId: string, input: Input) {
    const f=this.owner(actor), proof=stepUpFence(actor), scope=await this.scope(actor,personId)
    if (!explicit(input.consent)) throw new PayrollError('consent_required')
    if (input.fingerprint!==scope.fingerprint) throw new PayrollError('privacy_scope_changed',409)
    const id=crypto.randomUUID()
    const result=await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_privacy_requests(company_id,id,person_id,status,created_at) SELECT ?,?,?,'held',? WHERE ${f.sql} AND ${proof.sql} AND COALESCE((SELECT version FROM env_privacy_epochs WHERE company_id=?),0)=? ON CONFLICT(company_id,person_id) DO NOTHING`, [actor.company,id,personId,Date.now(),...f.args,...proof.args,actor.company,scope.epoch]),
      auditStatement(this.records.env,actor,crypto.randomUUID(),'privacy.erasure.requested',personId,1, 'EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND id=?)',[actor.company,id]),
    ])
    if (!result[0].meta.changes && !await this.records.statement('SELECT 1 FROM env_privacy_requests WHERE company_id=? AND person_id=?',[actor.company,personId]).first()) throw new PayrollError('step_up_or_scope_changed',409)
    return this.read(actor,personId)
  }
  async review(actor: Actor, personId: string, input: Input, release = false) {
    const f = this.owner(actor), proof = stepUpFence(actor), scope = await this.scope(actor, personId)
    if (!explicit(input.consent)) throw new PayrollError('consent_required')
    if (input.fingerprint !== scope.fingerprint) throw new PayrollError('privacy_scope_changed', 409)
    const ids = Array.isArray(input.records) ? input.records : typeof input.records === 'string' ? [input.records] : []
    if (!ids.length || new Set(ids).size !== ids.length) throw new PayrollError('record_selection_required')
    const selected = ids.map(id => scope.entries.find(e => e.id === id && e.table !== 'env_people'))
    if (selected.some(e => !e)) throw new PayrollError('privacy_record_changed', 409)
    const reason = text(input.legalBasis, 1000), custodian = release ? '' : text(input.custodian, 240)
    const at = release ? '' : text(input.earliestReleaseAt, 24)
    if (!release && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at) || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at))
      throw new PayrollError('utc_release_gate_required')
    const condition = `${f.sql} AND ${proof.sql} AND COALESCE((SELECT version FROM env_privacy_epochs WHERE company_id=?),0)=?`
    const args = [...f.args, ...proof.args, actor.company, scope.epoch]
    const statements: D1PreparedStatement[] = [this.records.statement(`INSERT INTO rer_erasure_guard(value) SELECT CASE WHEN (${condition}) THEN 1 ELSE 0 END`, args)]
    for (const e of selected as Entry[]) {
      if (release) {
        statements.push(this.records.statement(`INSERT INTO rer_erasure_guard(value) SELECT CASE WHEN EXISTS(SELECT 1 FROM env_privacy_holds
          WHERE company_id=? AND record_id=? AND fingerprint=? AND release_at IS NOT NULL AND julianday(release_at)<=julianday('now') AND released_at IS NULL) THEN 1 ELSE 0 END`, [actor.company, e.id, e.fingerprint]))
        statements.push(this.records.statement(`UPDATE env_privacy_holds SET released_at=unixepoch('subsec')*1000,release_reason=? WHERE company_id=? AND record_id=?`, [reason, actor.company, e.id]))
      } else {
        // Classification can extend an established gate, never shorten it or
        // silently reuse a prior human release for changed record contents.
        statements.push(this.records.statement(`INSERT INTO env_privacy_holds(company_id,record_id,fingerprint,legal_basis,custodian,release_at)
          VALUES(?,?,?,?,?,?) ON CONFLICT(company_id,record_id) DO UPDATE SET fingerprint=excluded.fingerprint,legal_basis=excluded.legal_basis,custodian=excluded.custodian,
          release_at=MAX(env_privacy_holds.release_at,excluded.release_at),released_at=NULL,release_reason=NULL`, [actor.company, e.id, e.fingerprint, reason, custodian, at]))
      }
      statements.push(auditStatement(this.records.env, actor, crypto.randomUUID(), release ? 'privacy.hold.released' : 'privacy.hold.classified', e.id, 1))
    }
    statements.push(this.records.statement('DELETE FROM rer_erasure_guard'))
    try { await this.records.env.DB.batch(statements) } catch { throw new PayrollError(release ? 'hold_not_releasable_or_authority_changed' : 'step_up_or_scope_changed', 409) }
    return this.read(actor, personId)
  }
  async erase(actor: Actor, personId: string, input: Input) {
    const f = this.owner(actor), proof = stepUpFence(actor)
    if (!explicit(input.consent)) throw new PayrollError('consent_required')
    const expected = integer(input.version)
    if (!await this.records.statement(`SELECT 1 WHERE ${proof.sql}`, proof.args).first()) throw new PayrollError('step_up_required', 403)
    const person = await this.records.statement('SELECT version FROM env_people WHERE company_id=? AND id=?', [actor.company, personId]).first<{version: number}>()
    if (person?.version !== expected) throw new PayrollError('person_version_changed', 409)
    const scope = await this.scope(actor, personId)
    if (scope.entries.length > 1 && input.fingerprint !== scope.fingerprint) throw new PayrollError('erasure_retention_review_required', 409)
    const retained = (await this.records.statement('SELECT record_id,fingerprint,released_at,release_at FROM env_privacy_holds WHERE company_id=?', [actor.company]).all<Row>()).results
    if (scope.entries.some(e => e.table !== 'env_people' && !retained.some(h => h.record_id === e.id && h.fingerprint === e.fingerprint && h.released_at && Date.parse(String(h.release_at)) <= Date.now())))
      throw new PayrollError('erasure_retention_review_required', 409)
    if (scope.entries.length>1) {
      const selected=Array.isArray(input.records)?input.records:typeof input.records==='string'?[input.records]:[]
      const expectedIds=scope.entries.filter(e=>e.table!=='env_people').map(e=>e.id)
      if (selected.length!==expectedIds.length || new Set(selected).size!==selected.length || expectedIds.some(id=>!selected.includes(id))) throw new PayrollError('record_selection_required')
    }
    const anonymous = 'erased-' + crypto.randomUUID()
    const db = this.records.env.DB
    const statements: D1PreparedStatement[] = [this.records.statement(`INSERT INTO rer_erasure_guard(value) SELECT CASE WHEN (${f.sql} AND ${proof.sql}
      AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)
      AND COALESCE((SELECT version FROM env_privacy_epochs WHERE company_id=?),0)=?) THEN 1 ELSE 0 END`, [...f.args, ...proof.args, actor.company, personId, expected, actor.company, scope.epoch])]
    statements.push(this.records.statement(`INSERT INTO env_privacy_requests(company_id,id,person_id,status,created_at) VALUES(?,?,?,'held',?) ON CONFLICT(company_id,person_id) DO NOTHING`,[actor.company,anonymous,personId,Date.now()]))
    // The batch is atomic; a failed trigger, changed grant or new dependency
    // rolls back journals, deletions, redaction and the anonymous receipt.
    statements.push(...await invalidateTransfersStatements(db))
    for (const entry of scope.entries.filter(e => e.table !== 'env_people')) statements.push(this.records.statement(`INSERT INTO rer_erasure_guard(value) SELECT CASE WHEN EXISTS(SELECT 1 FROM env_privacy_holds WHERE company_id=? AND record_id=? AND fingerprint=? AND released_at IS NOT NULL AND julianday(release_at)<=julianday('now')) THEN 1 ELSE 0 END`, [actor.company, entry.id, entry.fingerprint]))
    for (const entry of scope.entries) statements.push(...await erasureStatements(db, entry.table, entry.key))
    statements.push(...await redactionStatements(db))
    for (const table of new Set(scope.entries.map(e => e.table))) statements.push(this.records.statement('INSERT INTO env_privacy_guard(company_id,table_name) VALUES(?,?)', [actor.company, table]))
    for(const worker of scope.workers) statements.push(this.records.statement('INSERT INTO env_privacy_redactions(company_id,target_id,replacement) VALUES(?,?,?)',[actor.company,worker,anonymous]))
    statements.push(this.records.statement(`UPDATE env_audit SET actor_id=NULL WHERE company_id=? AND actor_id IN (SELECT target_id FROM env_privacy_redactions WHERE company_id=?)`,[actor.company,actor.company]))
    for (const id of new Set([...scope.ids, ...scope.entries.map(e => e.id)])) statements.push(this.records.statement('INSERT INTO env_privacy_redactions(company_id,target_id,replacement) VALUES(?,?,?)', [actor.company, id, anonymous]))
    statements.push(this.records.statement(`UPDATE env_agent_access SET target_id=? WHERE company_id=? AND target_id IN (SELECT target_id FROM env_privacy_redactions WHERE company_id=?)`, [anonymous, actor.company, actor.company]))
    statements.push(this.records.statement(`UPDATE env_audit SET target_id=? WHERE company_id=? AND target_id IN (SELECT target_id FROM env_privacy_redactions WHERE company_id=?)`, [anonymous, actor.company, actor.company]))
    for (const entry of scope.entries.filter(e => e.table === 'env_hris_people')) statements.push(this.records.statement('INSERT OR IGNORE INTO env_privacy_source_fences(company_id,source_hash) VALUES(?,?)', [actor.company, entry.row.source_key]))
    for (const entry of scope.entries.filter(e => e.table === 'env_workspace_review_inputs' && e.row.source_kind === 'intake-source'))
      statements.push(this.records.statement('INSERT OR IGNORE INTO env_privacy_source_fences(company_id,source_hash) VALUES(?,?)', [actor.company, entry.row.source_person_id]))
    for (const entry of scope.entries.filter(e => e.table === 'env_notices')) statements.push(this.records.statement('INSERT OR IGNORE INTO env_privacy_source_fences(company_id,source_hash) VALUES(?,?)', [actor.company, await digest(JSON.stringify(['notice-source',entry.row.reference]))]))
    for (const entry of scope.entries.filter(e => e.table === 'env_workspace_versions')) statements.push(this.records.statement('INSERT OR IGNORE INTO env_privacy_source_fences(company_id,source_hash) VALUES(?,?)', [actor.company, await digest(JSON.stringify([entry.row.kind, entry.row.object_id]))]))
    const ordered: Table[] = [], pending = scope.tables.filter(t => scope.entries.some(e => e.table === t.name))
    while (pending.length) {
      const next = pending.find(t => !pending.some(other => other.name !== t.name && other.parents.some(p => p.table === t.name)))
      if (!next) throw new PayrollError('privacy_dependency_cycle', 409)
      ordered.push(next); pending.splice(pending.indexOf(next), 1)
    }
    for (const table of ordered) for (const entry of scope.entries.filter(e => e.table === table.name))
      statements.push(this.records.statement(`DELETE FROM ${quote(table.name)} WHERE ${Object.keys(entry.key).map(c => quote(c) + ' IS ?').join(' AND ')}`, Object.values(entry.key)))
    for (const entry of scope.entries) statements.push(this.records.statement('DELETE FROM env_privacy_holds WHERE company_id=? AND record_id=?', [actor.company, entry.id]))
    statements.push(this.records.statement(`UPDATE env_privacy_requests SET person_id=NULL,status='completed',completed_at=?,records_deleted=? WHERE company_id=? AND person_id=?`, [Date.now(),scope.entries.length,actor.company,personId]))
    statements.push(this.records.statement('DELETE FROM env_privacy_guard WHERE company_id=?', [actor.company]), this.records.statement('DELETE FROM env_privacy_redactions WHERE company_id=?', [actor.company]),
      auditStatement(this.records.env, actor, crypto.randomUUID(), 'privacy.worker.erased', anonymous, expected), this.records.statement('DELETE FROM rer_erasure_guard'))
    try { await db.batch(statements) } catch { throw new PayrollError('erasure_retention_review_required', 409) }
    return {id: anonymous, erased: true, recordsDeleted: scope.entries.length}
  }
}
