import type { Bindings } from '../auth.server'
import type { Records, Input } from './records'
import { fence, auditStatement, type Actor } from './access'
import { requirePayrollProof, stepUpFence } from './step-up'
import { PayrollError, text, integer, date } from './security'

export const agentActions = ['records:read', 'drafts:prepare', 'drafts:read', 'notices:process', 'dispatch:execute'] as const
// Delegation never manufactures a human power. These are the ENV-028 powers
// needed by each actual tool; approval and bank powers are never delegated.
const inheritedActions: Record<string, string[]> = {
  'records:read': ['records:read'],
  'drafts:prepare': ['records:read', 'rates:propose'],
  'drafts:read': ['records:read'],
  'notices:process': ['notices:read', 'notices:write'],
  'dispatch:execute': ['notices:read', 'notices:dispatch'],
}

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
  secret_expires_at: number
  token_hash: string
}
const metadataColumns = `id,name,sponsor_id AS sponsorId,(SELECT display_name FROM oa_operators WHERE id=env_agent_grants.sponsor_id) AS sponsorName,actions,fields,locations,providers,models,created_at AS createdAt,expires_at AS expiresAt,(SELECT secret_expires_at FROM env_agent_credentials WHERE id=env_agent_grants.id) AS secretExpiresAt,revoked_at AS revokedAt,version`
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
export async function credentialDigest(secret: string, value: string) {
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
  sponsor(actor: Actor) {
    if (actor.grant.role !== 'owner' && !actor.grant.actions.includes('records:read'))
      throw new PayrollError('sponsor_scope_denied', 403)
  }
  async policy(actor: Actor) {
    this.sponsor(actor)
    const f = fence(actor)
    return await this.records.statement(`SELECT owner_only AS ownerOnly,version FROM env_agent_policy WHERE company_id=? AND ${f.sql}`, [actor.company,...f.args]).first() ?? {ownerOnly: 0,version: 0}
  }
  async setPolicy(actor: Actor, input: Input) {
    this.owner(actor)
    const f = fence(actor), version = input.version === 0 || input.version === '0' ? 0 : integer(input.version), id = uuid()
    const result = await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_agent_policy(company_id,owner_only,version,change_id) SELECT ?,?,1,? WHERE ${f.sql} AND COALESCE((SELECT version FROM env_agent_policy WHERE company_id=?),0)=?
        ON CONFLICT(company_id) DO UPDATE SET owner_only=excluded.owner_only,version=env_agent_policy.version+1,change_id=excluded.change_id WHERE env_agent_policy.version=? RETURNING version`,
        [actor.company,input.ownerOnly === true || input.ownerOnly === 'true' ? 1 : 0,id,...f.args,actor.company,version,version]),
      this.records.statement(`UPDATE env_agent_grants SET revoked_at=?,version=version+1 WHERE company_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM env_agent_policy WHERE company_id=? AND owner_only=1 AND change_id=?) AND sponsor_id NOT IN (SELECT operator_id FROM env_grants WHERE company_id=? AND role='owner' AND revoked_at IS NULL)`,[Date.now(),actor.company,actor.company,id,actor.company]),
      auditStatement(this.records.env,actor,id,'agent.policy',actor.company,version+1,'EXISTS(SELECT 1 FROM env_agent_policy WHERE change_id=?)',[id]),
    ])
    if (!result[0].results.length) throw new PayrollError('policy_or_authority_changed',409)
    return result[0].results[0]
  }
  async list(actor: Actor) {
    this.sponsor(actor)
    const f = fence(actor)
    return (
      await this.records
        .statement(
          `SELECT ${metadataColumns} FROM env_agent_grants WHERE company_id=? AND (?='owner' OR sponsor_id=?) AND ${f.sql} ORDER BY created_at,id`,
          [actor.company, actor.grant.role, actor.session.operator.id, ...f.args],
        )
        .all<Record<string, unknown>>()
    ).results
  }
  async issue(actor: Actor, input: Input) {
    this.sponsor(actor)
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
    const fields = list(input.fields, ['compensation', 'tax']),
      providers = list(input.providers, ['openai', 'resend']),
      models = list(input.models, ['gpt-4.1-mini'])
    const requiredActions = [...new Set(actions.flatMap(a => inheritedActions[a]))]
    if (actor.grant.role !== 'owner' && (
      requiredActions.some(a => !actor.grant.actions.includes(a)) ||
      fields.some(a => !actor.grant.fields.includes(a)) ||
      (!actor.grant.locations.includes('*') && locations.some(l => !actor.grant.locations.includes(l)))
    )) throw new PayrollError('sponsor_scope_denied',403)
    if (actions.some(a => a.startsWith('drafts:')) && !fields.includes('compensation'))
      throw new PayrollError('compensation_scope_required')
    if (actions.includes('notices:process') && (!fields.includes('tax') || !providers.includes('openai') || !models.includes('gpt-4.1-mini')))
      throw new PayrollError('notice_provider_scope_required')
    if (actions.includes('dispatch:execute') && (!fields.includes('tax') || !providers.includes('resend')))
      throw new PayrollError('dispatch_provider_scope_required')
    // Only a current owner-declared provider is grantable, with no implicit keys.
    for (const provider of providers) {
      const declared = await this.records.statement('SELECT id FROM env_external_providers WHERE company_id=? AND id=? AND enabled=1', [actor.company,provider]).first()
      if (!declared) throw new PayrollError('provider_not_declared')
    }
    if (models.length && !providers.includes('openai')) throw new PayrollError('provider_not_declared')
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')
    const id = uuid(),
      event = uuid(),
      now = Date.now(),
      expiresAt = input.reviewDate ? new Date(date(input.reviewDate)+'T23:59:59.999Z').getTime() : now + hours * 3600000,
      secretExpiresAt = Math.min(expiresAt, now + hours * 3600000)
    if (expiresAt <= now || expiresAt > now + 90 * 86400000) throw new PayrollError('invalid_review_date')
    const hash = await credentialDigest(this.records.env.SESSION_SECRET, token),
      f = fence(actor),
      p = stepUpFence(actor)
    const result = await this.records.env.DB.batch([
      this.records.statement(
        `INSERT INTO env_agent_grants(id,company_id,sponsor_id,sponsor_grant_version,sponsor_operator_version,name,actions,fields,locations,providers,models,created_at,expires_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql} AND ${p.sql} AND (?='owner' OR NOT EXISTS(SELECT 1 FROM env_agent_policy WHERE company_id=? AND owner_only=1)) RETURNING id`,
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
          actor.grant.role,
          actor.company,
        ],
      ),
      this.records.statement(
        `INSERT INTO env_agent_credentials(id,token_hash,secret_expires_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM env_agent_grants WHERE id=?)`,
        [id, hash, secretExpiresAt, id],
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
    return { id, token, expiresAt, secretExpiresAt, sponsorId: actor.session.operator.id }
  }
  async revoke(actor: Actor, id: string, input: Input) {
    this.sponsor(actor)
    const version = integer(input.version),
      f = fence(actor),
      event = uuid()
    const result = await this.records.env.DB.batch([
      this.records.statement(
        `UPDATE env_agent_grants SET revoked_at=?,revocation_id=?,version=version+1 WHERE company_id=? AND id=? AND version=? AND revoked_at IS NULL AND (?='owner' OR sponsor_id=?) AND ${f.sql} RETURNING id`,
        [Date.now(), event, actor.company, id, version, actor.grant.role, actor.session.operator.id, ...f.args],
      ),
      auditStatement(
        this.records.env,
        actor,
        event,
        'agent.revoked',
        id,
        version + 1,
        'EXISTS(SELECT 1 FROM env_agent_grants WHERE revocation_id=?)',
        [event],
      ),
    ])
    if (!result[0].results.length)
      throw new PayrollError('credential_or_authority_changed', 409)
    return { id, revoked: true, version: version + 1 }
  }
  async access(actor: Actor) {
    this.sponsor(actor)
    const f = fence(actor)
    return (
      await this.records
        .statement(
          `SELECT credential_id AS credentialId,sponsor_id AS sponsorId,action,target_id AS targetId,occurred_at AS occurredAt FROM env_agent_access WHERE company_id=? AND (?='owner' OR sponsor_id=?) AND ${f.sql} ORDER BY occurred_at DESC,id DESC LIMIT 200`,
          [actor.company, actor.grant.role, actor.session.operator.id, ...f.args],
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
    const hash = await credentialDigest(env.SESSION_SECRET, token)
    const row = await env.DB.prepare(
      'SELECT g.*,c.secret_expires_at,c.token_hash FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id WHERE c.token_hash=?',
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
    const window = Math.floor(Date.now() / 60000)
    const count = await env.DB.prepare(
      `INSERT INTO oa_limits(key,window,count) SELECT ?,?,1 WHERE ${f.sql}
      ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN oa_limits.window=excluded.window THEN oa_limits.count+1 ELSE 1 END RETURNING count`,
    )
      .bind('envelope-agent:' + row.id, window, ...f.args)
      .first<{ count: number }>()
    if (!count) throw new PayrollError('agent_authority_revoked', 403)
    if (count.count > 120) throw new PayrollError('agent_rate_limited', 429)
    return tools
  }
  fence() {
    const g = this.grant
    return {
      sql: `EXISTS(SELECT 1 FROM env_companies WHERE id=? AND restored=0) AND EXISTS(SELECT 1 FROM env_agent_grants a JOIN env_agent_credentials c ON c.id=a.id JOIN env_grants s ON s.company_id=a.company_id AND s.operator_id=a.sponsor_id JOIN oa_operators o ON o.id=a.sponsor_id
    WHERE a.id=? AND a.company_id=? AND a.version=? AND a.revoked_at IS NULL AND a.expires_at>unixepoch('subsec')*1000
    AND c.token_hash=? AND c.secret_expires_at>unixepoch('subsec')*1000
    AND o.status='active' AND o.version=a.sponsor_operator_version AND s.version=a.sponsor_grant_version AND s.revoked_at IS NULL
    AND (s.role='owner' OR (NOT EXISTS(SELECT 1 FROM env_agent_policy pol WHERE pol.company_id=a.company_id AND pol.owner_only=1)
      AND NOT EXISTS(SELECT 1 FROM json_each(a.fields) af WHERE af.value NOT IN (SELECT value FROM json_each(s.fields)))
      AND (EXISTS(SELECT 1 FROM json_each(s.locations) WHERE value='*') OR NOT EXISTS(SELECT 1 FROM json_each(a.locations) al WHERE al.value NOT IN (SELECT value FROM json_each(s.locations))))
      AND NOT EXISTS(SELECT 1 FROM json_each(?) req WHERE req.value NOT IN (SELECT value FROM json_each(s.actions))))))`,
      args: [g.company_id, g.id, g.company_id, g.version, g.token_hash, JSON.stringify([...new Set((JSON.parse(g.actions) as string[]).flatMap(a => inheritedActions[a] ?? ['ungrantable']))])],
    }
  }
  async rotate() {
    const f = this.fence(), token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),
      hash = await credentialDigest(this.env.SESSION_SECRET,token),
      secretExpiresAt = Math.min(this.grant.expires_at,Date.now()+86400000)
    // Compare-and-swap: an in-flight old bearer and concurrent rotations lose.
    const result = await this.env.DB.batch([
      this.log('credentials:rotate',this.grant.id),
      this.env.DB.prepare(`UPDATE env_agent_credentials SET token_hash=?,secret_expires_at=? WHERE id=? AND ${f.sql} RETURNING id`).bind(hash,secretExpiresAt,this.grant.id,...f.args),
    ])
    if (!result[1].results.length) throw new PayrollError('agent_authority_revoked',403)
    return {id:this.grant.id,token,secretExpiresAt,expiresAt:this.grant.expires_at}
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
    const fingerprint = await credentialDigest(
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
