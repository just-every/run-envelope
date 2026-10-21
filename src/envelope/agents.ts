import type { Bindings } from '../auth.server'
import type { Records, Input } from './records'
import { fence, auditStatement, type Actor } from './access'
import { requirePayrollProof, stepUpFence } from './step-up'
import { PayrollError, text, integer, date } from './security'

export const agentActions = ['records:read', 'drafts:prepare', 'drafts:read'] as const
interface AgentGrant {
  id: string
  company_id: string
  sponsor_id: string
  sponsor_grant_version: number
  sponsor_operator_version: number
  name: string
  actions: string
  fields: string
  locations: string
  providers: string
  models: string
  expires_at: number
  version: number
}
const metadataColumns = `id,name,sponsor_id AS sponsorId,actions,fields,locations,providers,models,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt,version`
const uuid = () => crypto.randomUUID()
const list = (value: unknown, allowed: readonly string[]) => {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : []
  if (
    entries.length > 50 ||
    entries.some((x) => typeof x !== 'string' || !allowed.includes(x))
  )
    throw new PayrollError('invalid_agent_scope')
  return [...new Set(entries)] as string[]
}
async function digest(secret: string, value: string) {
  const enc = new TextEncoder(),
    key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, enc.encode('envelope-agent\0' + value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
}
export class AgentSettings {
  constructor(public records: Records) {}
  owner(actor: Actor) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
  }
  async list(actor: Actor) {
    this.owner(actor)
    const f = fence(actor)
    return (
      await this.records
        .statement(
          `SELECT ${metadataColumns} FROM env_agent_grants WHERE company_id=? AND ${f.sql} ORDER BY created_at,id`,
          [actor.company, ...f.args],
        )
        .all<Record<string, unknown>>()
    ).results
  }
  async issue(actor: Actor, input: Input) {
    this.owner(actor)
    await requirePayrollProof(this.records.env, actor)
    const name = text(input.name),
      hours = integer(input.hours),
      actions = list(input.actions, agentActions)
    if (hours > 24 || !actions.length) throw new PayrollError('invalid_agent_scope')
    const locations = list(input.locations, [
      '*',
      ...(await this.records.locations(actor)).map((l) => l.id),
    ])
    if (!locations.length) throw new PayrollError('invalid_agent_scope')
    const fields = list(input.fields, ['compensation']),
      providers = list(input.providers, []),
      models = list(input.models, [])
    if (actions.includes('drafts:prepare') && !fields.includes('compensation'))
      throw new PayrollError('compensation_scope_required')
    // No provider/model adapter is exposed by this credential. Empty allowlists
    // are enforced, rather than a wildcard or inherited runtime provider key.
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')
    const id = uuid(),
      event = uuid(),
      now = Date.now(),
      expiresAt = now + hours * 3600000
    const hash = await digest(this.records.env.SESSION_SECRET, token),
      f = fence(actor),
      p = stepUpFence(actor)
    const result = await this.records.env.DB.batch([
      this.records.statement(
        `INSERT INTO env_agent_grants(id,company_id,sponsor_id,sponsor_grant_version,sponsor_operator_version,name,actions,fields,locations,providers,models,created_at,expires_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql} AND ${p.sql} RETURNING id`,
        [
          id,
          actor.company,
          actor.session.operator.id,
          actor.grant.version,
          actor.session.operator.version,
          name,
          JSON.stringify(actions),
          JSON.stringify(fields),
          JSON.stringify(locations),
          JSON.stringify(providers),
          JSON.stringify(models),
          now,
          expiresAt,
          ...f.args,
          ...p.args,
        ],
      ),
      this.records.statement(
        `INSERT INTO env_agent_credentials(id,token_hash) SELECT ?,? WHERE EXISTS(SELECT 1 FROM env_agent_grants WHERE id=?)`,
        [id, hash, id],
      ),
      auditStatement(
        this.records.env,
        actor,
        event,
        'agent.issued',
        id,
        1,
        'EXISTS(SELECT 1 FROM env_agent_credentials WHERE id=?)',
        [id],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('authority_or_proof_changed', 409)
    return { id, token, expiresAt, sponsorId: actor.session.operator.id }
  }
  async revoke(actor: Actor, id: string, input: Input) {
    this.owner(actor)
    const version = integer(input.version),
      f = fence(actor),
      event = uuid()
    const result = await this.records.env.DB.batch([
      this.records.statement(
        `UPDATE env_agent_grants SET revoked_at=?,version=version+1 WHERE company_id=? AND id=? AND version=? AND revoked_at IS NULL AND ${f.sql} RETURNING id`,
        [Date.now(), actor.company, id, version, ...f.args],
      ),
      auditStatement(
        this.records.env,
        actor,
        event,
        'agent.revoked',
        id,
        version + 1,
        'EXISTS(SELECT 1 FROM env_agent_grants WHERE id=? AND company_id=? AND version=? AND revoked_at IS NOT NULL)',
        [id, actor.company, version + 1],
      ),
    ])
    if (!result[0].results.length)
      throw new PayrollError('credential_or_authority_changed', 409)
    return { id, revoked: true, version: version + 1 }
  }
  async access(actor: Actor) {
    this.owner(actor)
    const f = fence(actor)
    return (
      await this.records
        .statement(
          `SELECT credential_id AS credentialId,sponsor_id AS sponsorId,action,target_id AS targetId,occurred_at AS occurredAt FROM env_agent_access WHERE company_id=? AND ${f.sql} ORDER BY occurred_at DESC,id DESC LIMIT 200`,
          [actor.company, ...f.args],
        )
        .all<Record<string, unknown>>()
    ).results
  }
  async drafts(actor: Actor) {
    this.owner(actor)
    const f = fence(actor)
    return (
      await this.records
        .statement(
          `SELECT d.id,d.person_id AS personId,p.name AS personName,d.person_version AS personVersion,d.rate_id AS rateId,d.minutes,d.period_start AS periodStart,d.period_end AS periodEnd,d.pay_date AS payDate,d.source_ref AS sourceRef,d.credential_id AS credentialId FROM env_run_drafts d JOIN env_people p ON p.company_id=d.company_id AND p.id=d.person_id WHERE d.company_id=? AND ${f.sql} ORDER BY d.created_at DESC,d.id LIMIT 200`,
          [actor.company, ...f.args],
        )
        .all<Record<string, unknown>>()
    ).results
  }
}
export class AgentTools {
  constructor(
    public env: Bindings,
    public grant: AgentGrant,
  ) {}
  static async authenticate(env: Bindings, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new PayrollError('agent_authentication_required', 401)
    const hash = await digest(env.SESSION_SECRET, token)
    const row = await env.DB.prepare(
      'SELECT g.* FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id WHERE c.token_hash=?',
    )
      .bind(hash)
      .first<AgentGrant>()
    if (!row) throw new PayrollError('agent_authentication_required', 401)
    const tools = new AgentTools(env, row),
      f = tools.fence()
    if (
      !(await env.DB.prepare(`SELECT 1 AS active WHERE ${f.sql}`)
        .bind(...f.args)
        .first())
    )
      throw new PayrollError('agent_authority_revoked', 403)
    return tools
  }
  fence() {
    const g = this.grant
    return {
      sql: `EXISTS(SELECT 1 FROM env_agent_grants a JOIN env_agent_credentials c ON c.id=a.id JOIN env_grants s ON s.company_id=a.company_id AND s.operator_id=a.sponsor_id JOIN oa_operators o ON o.id=a.sponsor_id
    WHERE a.id=? AND a.company_id=? AND a.version=? AND a.revoked_at IS NULL AND a.expires_at>?
    AND o.status='active' AND o.version=a.sponsor_operator_version AND s.version=a.sponsor_grant_version AND s.revoked_at IS NULL AND s.role='owner')`,
      args: [g.id, g.company_id, g.version, Date.now()],
    }
  }
  allow(action: string, company: unknown) {
    if (company !== this.grant.company_id || !JSON.parse(this.grant.actions).includes(action))
      throw new PayrollError('agent_scope_denied', 403)
  }
  location(column: string) {
    return JSON.parse(this.grant.locations).includes('*')
      ? { sql: '1', args: [] }
      : { sql: `${column} IN (SELECT value FROM json_each(?))`, args: [this.grant.locations] }
  }
  log(action: string, target: string, condition = '1', args: unknown[] = []) {
    const f = this.fence()
    return this.env.DB.prepare(
      `INSERT INTO env_agent_access(id,company_id,credential_id,sponsor_id,action,target_id,occurred_at) SELECT ?,?,?,?,?,?,? WHERE ${f.sql} AND ${condition}`,
    ).bind(
      uuid(),
      this.grant.company_id,
      this.grant.id,
      this.grant.sponsor_id,
      action,
      target,
      Date.now(),
      ...f.args,
      ...args,
    )
  }
  async records(input: Input) {
    this.allow('records:read', input.companyId)
    const f = this.fence(),
      l = this.location('location_id'),
      event = uuid()
    const result = await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO env_agent_access(id,company_id,credential_id,sponsor_id,action,target_id,occurred_at) SELECT ?,?,?,?,'records:read',?,? WHERE ${f.sql}`,
      ).bind(
        event,
        this.grant.company_id,
        this.grant.id,
        this.grant.sponsor_id,
        this.grant.company_id,
        Date.now(),
        ...f.args,
      ),
      this.env.DB.prepare(
        `SELECT id,name,location_id AS locationId,version FROM env_people WHERE company_id=? AND ${l.sql} AND ${f.sql} AND EXISTS(SELECT 1 FROM env_agent_access WHERE id=?) ORDER BY name,id LIMIT 100`,
      ).bind(this.grant.company_id, ...l.args, ...f.args, event),
    ])
    if (!result[0].meta.changes) throw new PayrollError('agent_authority_revoked', 403)
    return { records: result[1].results, limit: 100 }
  }
  async prepare(input: Input) {
    this.allow('drafts:prepare', input.companyId)
    if (!JSON.parse(this.grant.fields).includes('compensation'))
      throw new PayrollError('agent_scope_denied', 403)
    const allowed = [
      'companyId',
      'personId',
      'minutes',
      'periodStart',
      'periodEnd',
      'payDate',
      'sourceRef',
      'requestKey',
    ]
    if (Object.keys(input).some((k) => !allowed.includes(k)))
      throw new PayrollError('invalid_draft_input')
    const person = text(input.personId),
      minutes = integer(input.minutes),
      periodStart = date(input.periodStart),
      periodEnd = date(input.periodEnd),
      payDate = date(input.payDate),
      source = text(input.sourceRef, 240),
      requestKey = text(input.requestKey, 120)
    if (periodStart > periodEnd || payDate < periodEnd || minutes > 44640)
      throw new PayrollError('invalid_draft_period')
    const id = uuid(),
      f = this.fence(),
      l = this.location('p.location_id')
    // One atomic INSERT selects a genuine reviewed rate and current worker version.
    // No helper-only draft, calculation claim, approval bit or outbound side effect.
    const fingerprint = await digest(
      this.env.SESSION_SECRET,
      JSON.stringify([person, minutes, periodStart, periodEnd, payDate, source]),
    )
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.env.DB.prepare(
        `INSERT INTO env_run_drafts(company_id,id,credential_id,person_id,person_version,rate_id,period_start,period_end,pay_date,minutes,source_ref,created_at,request_key,fingerprint)
    SELECT p.company_id,?,?,p.id,p.version,r.id,?,?,?,?,?,?,?,? FROM env_people p JOIN env_rate_proposals r ON r.company_id=p.company_id AND r.person_id=p.id
    WHERE p.company_id=? AND p.id=? AND ${l.sql} AND r.approved_by IS NOT NULL AND r.effective_date<=? AND ${f.sql}
    AND r.id=(SELECT rr.id FROM env_rate_proposals rr WHERE rr.company_id=p.company_id AND rr.person_id=p.id AND rr.approved_by IS NOT NULL AND rr.effective_date<=? ORDER BY rr.effective_date DESC,rr.approved_at DESC,rr.id DESC LIMIT 1)
    ON CONFLICT(company_id,credential_id,request_key) DO NOTHING RETURNING id`,
      ).bind(
        id,
        this.grant.id,
        periodStart,
        periodEnd,
        payDate,
        minutes,
        source,
        Date.now(),
        requestKey,
        fingerprint,
        this.grant.company_id,
        person,
        ...l.args,
        periodStart,
        ...f.args,
        periodStart,
      ),
      this.log(
        'drafts:prepare',
        id,
        'EXISTS(SELECT 1 FROM env_run_drafts WHERE company_id=? AND id=?)',
        [this.grant.company_id, id],
      ),
      this.env.DB.prepare(
        `SELECT id FROM env_run_drafts WHERE company_id=? AND credential_id=? AND request_key=? AND fingerprint=? AND ${f.sql}`,
      ).bind(this.grant.company_id, this.grant.id, requestKey, fingerprint, ...f.args),
    ])
    const row = result[2].results[0]
    if (!row) throw new PayrollError('draft_input_or_authority_changed', 409)
    return {
      id: row.id,
      status: 'uncalculated-proposal',
      approval: 'not-approved',
      dispatch: 'unavailable',
    }
  }
  async readDraft(input: Input) {
    this.allow('drafts:read', input.companyId)
    if (!JSON.parse(this.grant.fields).includes('compensation'))
      throw new PayrollError('agent_scope_denied', 403)
    const id = text(input.draftId),
      f = this.fence(),
      l = this.location('p.location_id')
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.log(
        'drafts:read',
        id,
        `EXISTS(SELECT 1 FROM env_run_drafts d JOIN env_people p ON p.company_id=d.company_id AND p.id=d.person_id WHERE d.company_id=? AND d.id=? AND ${l.sql})`,
        [this.grant.company_id, id, ...l.args],
      ),
      this.env.DB.prepare(
        `SELECT d.id,d.person_id AS personId,p.name AS personName,d.person_version AS personVersion,d.rate_id AS rateId,r.hourly_cents AS hourlyCents,d.minutes,d.period_start AS periodStart,d.period_end AS periodEnd,d.pay_date AS payDate,d.source_ref AS sourceRef,(p.version!=d.person_version) AS stale
    FROM env_run_drafts d JOIN env_people p ON p.company_id=d.company_id AND p.id=d.person_id JOIN env_rate_proposals r ON r.company_id=d.company_id AND r.id=d.rate_id
    WHERE d.company_id=? AND d.id=? AND ${l.sql} AND ${f.sql}`,
      ).bind(this.grant.company_id, id, ...l.args, ...f.args),
    ])
    if (!result[0].meta.changes || !result[1].results[0])
      throw new PayrollError('draft_or_authority_unavailable', 403)
    return {
      ...result[1].results[0],
      status: 'uncalculated-proposal',
      approval: 'not-approved',
      dispatch: 'unavailable',
    }
  }
}
