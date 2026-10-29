import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { PayrollError } from './security'

export const actions = [
  'records:read',
  'records:write',
  'paper:entry',
  'paper:review',
  'paper:download',
  'rates:propose',
  'rates:approve',
  'private:read',
  'private:write',
  'export',
  'bank:edit',
  'pay:approve',
  'pay:release',
  'audit:read',
  'automation:inspect',
  'automation:prepare',
  'automation:dispose',
  'cases:intake',
  'cases:investigate',
  'cases:review',
  'cases:download',
  'notices:read',
  'notices:write',
  'notices:approve',
  'notices:dispatch',
] as const
export const fields = ['compensation', 'ssn', 'bank', 'tax'] as const
export const roles = [
  'owner',
  'payroll-admin',
  'preparer',
  'approver',
  'accountant',
  'viewer',
  'employee',
  'contractor',
] as const
export interface Grant {
  role: string
  locations: string[]
  fields: string[]
  actions: string[]
  version: number
}
export interface Actor {
  session: Session
  company: string
  grant: Grant
}
export function decodeGrant(row: Record<string, unknown>): Grant {
  return {
    role: String(row.role),
    locations: JSON.parse(String(row.locations)),
    fields: JSON.parse(String(row.fields)),
    actions: JSON.parse(String(row.actions)),
    version: Number(row.version),
  }
}
// Every statement repeats native session, identity-provider and payroll-grant
// fences. No authority from a cookie role, query parameter, or cached grant.
export function sessionFence(session: Session) {
  return {
    sql: `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
 WHERE s.id=? AND s.operator_id=? AND s.operator_version=? AND o.version=s.operator_version
 AND o.status='active' AND s.revoked_at IS NULL AND s.expires_at>?
 AND (s.kind!='oidc' OR EXISTS(SELECT 1 FROM oa_provider_sessions ps JOIN oa_auth_settings settings
 ON settings.singleton=1 AND settings.idp_sign_in=1 AND settings.generation=ps.generation WHERE ps.session_id=s.id))
 AND NOT EXISTS(SELECT 1 FROM oa_provider_session_pins pin WHERE pin.session_id=s.id AND NOT EXISTS(
 SELECT 1 FROM oa_identity_providers ip WHERE ip.provider_id=pin.provider_id AND ip.status='linked'
 AND ip.issuer=pin.issuer AND ip.client_id=pin.client_id AND ip.linked_at=pin.linked_at)))`,
    args: [session.id, session.operator.id, session.operator.version, Date.now()],
  }
}
export function fence(actor: Actor) {
  const session = sessionFence(actor.session)
  return {
    sql: `${session.sql} AND (NOT EXISTS(SELECT 1 FROM env_privacy_requests pr WHERE pr.company_id=? AND pr.status='held') OR (?='native' AND ?='owner' AND ?='owner')) AND EXISTS(SELECT 1 FROM env_grants g WHERE g.company_id=? AND g.operator_id=? AND g.version=? AND g.revoked_at IS NULL)`,
    args: [...session.args, actor.company, actor.session.kind, actor.session.operator.role, actor.grant.role, actor.company, actor.session.operator.id, actor.grant.version],
  }
}
export async function actorFor(env: Bindings, session: Session, company: string): Promise<Actor> {
  const s = sessionFence(session)
  const row = await env.DB.prepare(
    `SELECT * FROM env_grants WHERE company_id=? AND operator_id=? AND revoked_at IS NULL AND ${s.sql}`,
  )
    .bind(company, session.operator.id, ...s.args)
    .first<Record<string, unknown>>()
  if (!row) throw new PayrollError('payroll_access_denied', 403)
  const actor = { session, company, grant: decodeGrant(row) }
  const held = await env.DB.prepare("SELECT 1 FROM env_privacy_requests WHERE company_id=? AND status='held'").bind(company).first()
  if (held) {
    if (session.kind!=='native' || session.operator.role!=='owner' || actor.grant.role!=='owner' || session.operator.email.trim().toLowerCase()!==env.OWNER_EMAIL.trim().toLowerCase()) throw new PayrollError('retained_data_owner_required',403)
    const audit=await auditStatement(env,actor,crypto.randomUUID(),'privacy.retained-access',company,actor.grant.version).run()
    if (!audit.meta.changes) throw new PayrollError('authority_changed',409)
  }
  return actor
}
export function requireAction(actor: Actor, action: string, location?: string, field?: string) {
  if (
    actor.grant.role !== 'owner' &&
    (!actor.grant.actions.includes(action) ||
      (location &&
        !actor.grant.locations.includes('*') &&
        !actor.grant.locations.includes(location)) ||
      (field && !actor.grant.fields.includes(field)))
  )
    throw new PayrollError('payroll_access_denied', 403)
}
export const locationSql = (actor: Actor, column: string) =>
  actor.grant.locations.includes('*')
    ? { sql: '1', args: [] }
    : {
        sql: `${column} IN (SELECT value FROM json_each(?))`,
        args: [JSON.stringify(actor.grant.locations)],
      }
export function auditStatement(
  env: Bindings,
  actor: Actor,
  id: string,
  action: string,
  target: string,
  version: number,
  condition = '1',
  args: unknown[] = [],
) {
  const f = fence(actor)
  return env.DB.prepare(
    `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
 SELECT ?,?,?,?,?,?,? WHERE ${f.sql} AND ${condition}`,
  ).bind(
    id,
    actor.company,
    actor.session.operator.id,
    action,
    target,
    version,
    Date.now(),
    ...f.args,
    ...args,
  )
}
