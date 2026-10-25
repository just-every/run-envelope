import { sessionFence } from './access'
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
        consent.readable_history AS readableHistory,consent.actions,consent.occurred_at AS occurredAt
       FROM env_archive_adoptions consent JOIN env_grants g ON g.company_id=consent.company_id
       AND g.operator_id=consent.actor_id WHERE consent.actor_id=? AND g.revoked_at IS NULL
       AND (g.role='owner' OR EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='audit:read'))
       AND NOT EXISTS(SELECT 1 FROM env_privacy_requests pr WHERE pr.company_id=consent.company_id AND pr.status='held')
       AND ${native.sql} ORDER BY consent.occurred_at,consent.event_id`,
      [this.records.session.operator.id, ...native.args],
    ).all<{ eventId: string; companyId: string; companyName: string; readableHistory: string;
      actions: string; occurredAt: number }>()).results
    return rows.map(row => ({ ...row, readableHistory: JSON.parse(row.readableHistory),
      actions: JSON.parse(row.actions), operations: 'paused', providerLookup: false }))
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
        `INSERT INTO env_archive_adoptions(event_id,company_id,company_name,actor_id,readable_history,actions,occurred_at)
         SELECT ?,c.id,c.name,?,?,?,? FROM env_companies c
         WHERE c.id=? AND EXISTS(SELECT 1 FROM env_grants WHERE company_id=c.id AND operator_id=? AND change_id=?)`,
        [event, session.operator.id, JSON.stringify(historyFields), JSON.stringify(grant.actions), Date.now(),
          companyId, session.operator.id, event],
      ),
      this.records.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
         SELECT ?,?,?,'archive.history.adopted',?,1,?
         WHERE EXISTS(SELECT 1 FROM env_grants WHERE company_id=? AND operator_id=? AND change_id=?)`,
        [event, companyId, session.operator.id, companyId, Date.now(), companyId, session.operator.id, event],
      ),
    ])
    if (!result[0].results.length) throw unavailable()
    return { id: companyId, ...grant, consent: { companyName, readableHistory: [...historyFields],
      operations: 'paused', providerLookup: false, eventId: event } }
  }
}
