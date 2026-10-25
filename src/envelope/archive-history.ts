import { requireAction, sessionFence } from './access'
import { WorkspaceStore } from './workspace/store'
import type { IndustryReturn } from './industry/returns'
import type { Company, Input, Records } from './records'
import { PayrollError, text } from './security'
import { sessionProofFence } from './step-up'

const normalize = (value: string) => value.trim().toLowerCase()
const unavailable = () => new PayrollError('archive_adoption_unavailable', 409)
const historyFields = ['compensation', 'tax'] as const

/** Explicit access to retained evidence; this grant cannot activate payroll operations. */
export class ArchiveHistory {
  constructor(public records: Records) {}

  private nativeFence() {
    const { session } = this.records
    if (session.kind !== 'native') throw new PayrollError('native_identity_required', 403)
    const current = sessionFence(session)
    return {
      sql: `${current.sql} AND EXISTS(SELECT 1 FROM oa_sessions native JOIN oa_operators owner
        ON owner.id=native.operator_id WHERE native.id=? AND native.kind='native'
        AND owner.id=? AND owner.status='active')`,
      args: [...current.args, session.id, session.operator.id],
    }
  }

  private availability() {
    const owner = this.nativeFence()
    return {
      sql: `${owner.sql} AND (c.created_by=? OR EXISTS(SELECT 1 FROM oa_operators current_owner
        WHERE current_owner.id=? AND current_owner.role='owner' AND current_owner.status='active'
        AND lower(trim(current_owner.email))=?))
        AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE kind='import' AND phase='complete')
        AND NOT EXISTS(SELECT 1 FROM env_grants existing WHERE existing.company_id=c.id)`,
      args: [...owner.args, this.records.session.operator.id, this.records.session.operator.id,
        normalize(this.records.env.OWNER_EMAIL)],
    }
  }

  async list() {
    const available = this.availability()
    return (await this.records.statement(
      `SELECT c.id,c.name,c.ein_suffix AS einSuffix FROM env_companies c
       WHERE ${available.sql} ORDER BY c.name,c.id`, available.args,
    ).all<Company>()).results.map(company => ({ ...company, readableHistory: [...historyFields],
      operations: 'paused', providerLookup: false }))
  }

  async consents() {
    const native = this.nativeFence()
    const rows = (await this.records.statement(
      `SELECT consent.event_id AS eventId,consent.company_id AS companyId,consent.company_name AS companyName,
        consent.readable_history AS readableHistory,consent.actions,event.actor_id AS actorId,event.occurred_at AS occurredAt
       FROM env_archive_adoptions consent JOIN env_audit event ON event.id=consent.event_id
       AND event.company_id=consent.company_id AND event.action='archive.history.adopted'
       JOIN env_grants g ON g.company_id=consent.company_id
       AND g.operator_id=event.actor_id WHERE event.actor_id=? AND g.revoked_at IS NULL
       AND (g.role='owner' OR EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='audit:read'))
       AND NOT EXISTS(SELECT 1 FROM env_privacy_requests pr WHERE pr.company_id=consent.company_id AND pr.status='held')
       AND ${native.sql} ORDER BY event.occurred_at,consent.event_id`,
      [this.records.session.operator.id, ...native.args],
    ).all<{ eventId: string; companyId: string; companyName: string; readableHistory: string;
      actions: string; actorId: string; occurredAt: number }>()).results
    return rows.map(row => ({ ...row, readableHistory: JSON.parse(row.readableHistory),
      actions: JSON.parse(row.actions), operations: 'paused', providerLookup: false }))
  }

  async taxHistory(companyId: string) {
    const native = this.nativeFence()
    const actor = await this.records.actor(companyId)
    requireAction(actor, 'records:read', undefined, 'compensation')
    requireAction(actor, 'private:read', undefined, 'tax')
    if (!actor.grant.locations.includes('*')) throw new PayrollError('payroll_access_denied', 403)
    const adopted = await this.records.statement(
      `SELECT 1 FROM env_archive_adoptions consent JOIN env_audit event ON event.id=consent.event_id
       AND event.company_id=consent.company_id AND event.action='archive.history.adopted'
       WHERE consent.company_id=? AND event.actor_id=? AND ${native.sql}`,
      [companyId, this.records.session.operator.id, ...native.args],
    ).first()
    if (!adopted) throw unavailable()
    const rows = await new WorkspaceStore(this.records).list<IndustryReturn>(actor, 'industry-return', undefined, true)
    // Forms contain the employer EIN and require independent export permission.
    // Read-only recovery exposes only the exact retained totals and source links.
    return rows.map(row => ({ id: row.id, version: row.version, approvedBy: row.approvedBy,
      approvedAt: row.approvedAt, withdrawnBy: row.withdrawnBy, sourcesCurrent: row.sourcesCurrent,
      data: { form: row.data.form, taxYear: row.data.taxYear, quarter: row.data.quarter,
        totals: row.data.totals, employeeCount: row.data.employeeCount,
        checks: row.data.checks, corrects: row.data.corrects } }))
  }

  async adopt(input: Input) {
    const available = this.availability()
    if (input.consent !== true) throw new PayrollError('consent_required', 400)
    const companyId = text(input.companyId), companyName = text(input.companyName), { session } = this.records
    const readableHistory = input.readableHistory
    if (!Array.isArray(readableHistory) || readableHistory.length !== historyFields.length
      || historyFields.some(field => !readableHistory.includes(field)))
      throw new PayrollError('history_consent_required', 400)
    const proof = sessionProofFence(session), owner = this.nativeFence()
    const fresh = await this.records.statement(`SELECT 1 WHERE ${owner.sql} AND ${proof.sql}`,
      [...owner.args, ...proof.args]).first()
    if (!fresh) throw new PayrollError('step_up_required', 403)
    const event = crypto.randomUUID()
    const grant = { role: 'viewer', locations: ['*'], fields: ['compensation', 'tax'],
      actions: ['records:read', 'private:read', 'audit:read'], version: 1 }
    const result = await this.records.env.DB.batch<{ id: string }>([
      this.records.statement(
        `INSERT INTO env_grants(company_id,operator_id,role,locations,fields,actions,version,change_id)
         SELECT c.id,?,?,?,?,?,1,? FROM env_companies c
         WHERE c.id=? AND c.name=? AND ${available.sql} AND ${proof.sql} RETURNING company_id AS id`,
        [session.operator.id, grant.role, JSON.stringify(grant.locations), JSON.stringify(grant.fields),
          JSON.stringify(grant.actions), event, companyId, companyName, ...available.args, ...proof.args],
      ),
      this.records.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
         SELECT ?,?,?,'archive.history.adopted',?,1,?
         WHERE EXISTS(SELECT 1 FROM env_grants WHERE company_id=? AND operator_id=? AND change_id=?)`,
        [event, companyId, session.operator.id, companyId, Date.now(), companyId, session.operator.id, event],
      ),
      this.records.statement(
        `INSERT INTO env_archive_adoptions(event_id,company_id,company_name,readable_history,actions)
         SELECT event.id,c.id,c.name,?,? FROM env_companies c JOIN env_audit event ON event.company_id=c.id
         WHERE c.id=? AND event.id=? AND event.actor_id=? AND event.action='archive.history.adopted'`,
        [JSON.stringify(historyFields), JSON.stringify(grant.actions), companyId, event, session.operator.id],
      ),
    ])
    if (!result[0].results.length) throw unavailable()
    return { id: companyId, ...grant, consent: { companyName, readableHistory: [...historyFields],
      operations: 'paused', providerLookup: false, eventId: event } }
  }
}
