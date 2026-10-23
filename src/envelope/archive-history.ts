import { sessionFence } from './access'
import type { Company, Input, Records } from './records'
import { PayrollError, text } from './security'
import { sessionProofFence } from './step-up'

const normalize = (value: string) => value.trim().toLowerCase()
const unavailable = () => new PayrollError('archive_adoption_unavailable', 409)

/** Explicit access to retained evidence; this grant cannot activate payroll operations. */
export class ArchiveHistory {
  constructor(public records: Records) {}

  private ownerFence() {
    const { session, env } = this.records
    const ownerEmail = normalize(env.OWNER_EMAIL)
    if (session.kind !== 'native' || session.operator.role !== 'owner'
      || !ownerEmail || normalize(session.operator.email) !== ownerEmail)
      throw new PayrollError('owner_required', 403)
    const current = sessionFence(session)
    return {
      sql: `${current.sql} AND EXISTS(SELECT 1 FROM oa_sessions native JOIN oa_operators owner
        ON owner.id=native.operator_id WHERE native.id=? AND native.kind='native'
        AND owner.id=? AND owner.role='owner' AND owner.status='active'
        AND lower(trim(owner.email))=?)`,
      args: [...current.args, session.id, session.operator.id, ownerEmail],
    }
  }

  private availability() {
    const owner = this.ownerFence()
    return {
      sql: `${owner.sql} AND c.created_by=?
        AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE kind='import' AND phase='complete')
        AND NOT EXISTS(SELECT 1 FROM env_grants existing WHERE existing.company_id=c.id)`,
      args: [...owner.args, this.records.session.operator.id],
    }
  }

  async list(): Promise<Company[]> {
    const available = this.availability()
    return (await this.records.statement(
      `SELECT c.id,c.name,c.ein_suffix AS einSuffix FROM env_companies c
       WHERE ${available.sql} ORDER BY c.name,c.id`, available.args,
    ).all<Company>()).results
  }

  async adopt(input: Input) {
    const available = this.availability()
    if (input.consent !== true) throw new PayrollError('consent_required', 400)
    const companyId = text(input.companyId), { session } = this.records
    const proof = sessionProofFence(session), owner = this.ownerFence()
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
         WHERE c.id=? AND ${available.sql} AND ${proof.sql} RETURNING company_id AS id`,
        [session.operator.id, grant.role, JSON.stringify(grant.locations), JSON.stringify(grant.fields),
          JSON.stringify(grant.actions), event, companyId, ...available.args, ...proof.args],
      ),
      this.records.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
         SELECT ?,?,?,'archive.history.adopted',?,1,?
         WHERE EXISTS(SELECT 1 FROM env_grants WHERE company_id=? AND operator_id=? AND change_id=?)`,
        [event, companyId, session.operator.id, companyId, Date.now(), companyId, session.operator.id, event],
      ),
    ])
    if (!result[0].results.length) throw unavailable()
    return { id: companyId, ...grant }
  }
}
