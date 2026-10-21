import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import {
  actorFor,
  actions,
  fields,
  roles,
  fence,
  sessionFence,
  requireAction,
  locationSql,
  auditStatement,
  type Actor,
} from './access'
import { PayrollError, text, integer, date, recordKey, seal, unseal } from './security'

export interface Company {
  id: string
  name: string
  einSuffix: string
}
export interface Person {
  id: string
  name: string
  locationId: string
  version: number
}
export type Input = Record<string, unknown>
const uuid = () => crypto.randomUUID()
const hashes = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
export class Records {
  constructor(
    public env: Bindings,
    public session: Session,
  ) {}
  statement(sql: string, args: unknown[] = []) {
    return this.env.DB.prepare(sql).bind(...args)
  }
  async companies(): Promise<Company[]> {
    const f = sessionFence(this.session)
    return (
      await this.statement(
        `SELECT c.id,c.name,c.ein_suffix AS einSuffix FROM env_companies c JOIN env_grants g ON g.company_id=c.id
   WHERE g.operator_id=? AND g.revoked_at IS NULL AND ${f.sql} ORDER BY c.name,c.id`,
        [this.session.operator.id, ...f.args],
      ).all<Company>()
    ).results
  }
  async createCompany(input: Input) {
    if (this.session.operator.role !== 'owner') throw new PayrollError('owner_required', 403)
    const name = text(input.name),
      ein = text(input.ein, 10)
    if (!/^\d{2}-\d{7}$/.test(ein)) throw new PayrollError('invalid_ein')
    const id = uuid(),
      key = await recordKey(this.env.ENVELOPE_RECORD_KEY),
      cipher = await seal(key, JSON.stringify([id, 'ein']), ein),
      f = sessionFence(this.session),
      event = uuid()
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_companies(id,name,ein_cipher,ein_suffix,created_by,created_at)
    SELECT ?,?,?,?,?,? WHERE ${f.sql} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') RETURNING id`,
        [
          id,
          name,
          cipher,
          ein.slice(-4),
          this.session.operator.id,
          Date.now(),
          ...f.args,
          this.session.operator.id,
        ],
      ),
      this.statement(
        `INSERT INTO env_grants(company_id,operator_id,role,locations,fields,actions)
    SELECT ?,?,'owner','["*"]',?,? WHERE EXISTS(SELECT 1 FROM env_companies WHERE id=?)`,
        [id, this.session.operator.id, JSON.stringify(fields), JSON.stringify(actions), id],
      ),
      this.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
    SELECT ?,?,?,'company.created',?,1,? WHERE EXISTS(SELECT 1 FROM env_companies WHERE id=?)`,
        [event, id, this.session.operator.id, id, Date.now(), id],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('authority_changed', 409)
    return { id, name, einSuffix: ein.slice(-4) }
  }
  async actor(company: string) {
    return actorFor(this.env, this.session, company)
  }
  async company(actor: Actor) {
    const f = fence(actor)
    const value = await this.statement(
      `SELECT id,name,ein_suffix AS einSuffix FROM env_companies WHERE id=? AND ${f.sql}`,
      [actor.company, ...f.args],
    ).first<Company>()
    if (!value) throw new PayrollError('payroll_access_denied', 403)
    return value
  }
  async locations(actor: Actor) {
    const f = fence(actor),
      l = locationSql(actor, 'id')
    return (
      await this.statement(
        `SELECT id,name FROM env_locations WHERE company_id=? AND ${l.sql} AND ${f.sql} ORDER BY name,id`,
        [actor.company, ...l.args, ...f.args],
      ).all<{ id: string; name: string }>()
    ).results
  }
  async createLocation(actor: Actor, input: Input) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
    const id = uuid(),
      name = text(input.name),
      f = fence(actor),
      event = uuid()
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_locations(company_id,id,name) SELECT ?,?,? WHERE ${f.sql} RETURNING id`,
        [actor.company, id, name, ...f.args],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        'location.created',
        id,
        1,
        'EXISTS(SELECT 1 FROM env_locations WHERE company_id=? AND id=?)',
        [actor.company, id],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('authority_changed', 409)
    return { id, name }
  }
  async grants(actor: Actor) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
    const f = fence(actor)
    return (
      await this.statement(
        `SELECT g.operator_id AS operatorId,o.display_name AS name,g.role,g.locations,g.fields,g.actions,g.version,g.revoked_at AS revokedAt
   FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=? AND ${f.sql} ORDER BY o.display_name`,
        [actor.company, ...f.args],
      ).all()
    ).results
  }
  async setGrant(actor: Actor, input: Input) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
    const operatorId = text(input.operatorId),
      version = input.version === 0 || input.version === '0' ? 0 : integer(input.version),
      revoked = input.revoke === true || input.revoke === 'true'
    if (operatorId === this.session.operator.id)
      throw new PayrollError('owner_grant_unchanged', 409)
    const existing = await this.statement(
      'SELECT role FROM env_grants WHERE company_id=? AND operator_id=?',
      [actor.company, operatorId],
    ).first<{ role: string }>()
    if (existing?.role === 'owner') throw new PayrollError('owner_grant_unchanged', 409)
    const role = revoked ? 'viewer' : text(input.role)
    if (!roles.includes(role as (typeof roles)[number]) || role === 'owner')
      throw new PayrollError('invalid_role')
    const list = (value: unknown, choices: readonly string[]) => {
      const items = Array.isArray(value)
        ? value
        : typeof value === 'string' && value
          ? value.split(',').map((v) => v.trim())
          : []
      if (items.length > 50 || items.some((v) => typeof v !== 'string' || !choices.includes(v)))
        throw new PayrollError('invalid_scope')
      return [...new Set(items)]
    }
    const locations = list(input.locations, [
        '*',
        ...(await this.locations(actor)).map((l) => l.id),
      ]),
      fieldList = list(input.fields, fields),
      actionList = list(input.actions, actions),
      f = fence(actor),
      event = uuid()
    // An owner cannot elevate Base authentication roles here. Target must already
    // be an explicitly invited/active installation identity.
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_grants(company_id,operator_id,role,locations,fields,actions,version,revoked_at,change_id)
    SELECT ?,?,?,?,?,?,1,?,? WHERE (?=0 OR EXISTS(SELECT 1 FROM env_grants eg WHERE eg.company_id=? AND eg.operator_id=? AND eg.version=?)) AND ${f.sql} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status IN ('invited','active'))
    ON CONFLICT(company_id,operator_id) DO UPDATE SET role=excluded.role,locations=excluded.locations,fields=excluded.fields,actions=excluded.actions,
    version=env_grants.version+1,revoked_at=excluded.revoked_at,change_id=excluded.change_id WHERE env_grants.version=? AND env_grants.role!='owner' RETURNING version`,
        [
          actor.company,
          operatorId,
          role,
          JSON.stringify(locations),
          JSON.stringify(fieldList),
          JSON.stringify(actionList),
          revoked ? Date.now() : null,
          event,
          version,
          actor.company,
          operatorId,
          version,
          ...f.args,
          operatorId,
          version,
        ],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        revoked ? 'grant.revoked' : 'grant.changed',
        operatorId,
        version + 1,
        'EXISTS(SELECT 1 FROM env_grants WHERE company_id=? AND operator_id=? AND change_id=?)',
        [actor.company, operatorId, event],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('grant_or_identity_changed', 409)
    return { operatorId, version: version + 1 }
  }
  async people(actor: Actor): Promise<Person[]> {
    requireAction(actor, 'records:read')
    const f = fence(actor),
      l = locationSql(actor, 'location_id')
    return (
      await this.statement(
        `SELECT id,name,location_id AS locationId,version FROM env_people WHERE company_id=? AND ${l.sql} AND ${f.sql} ORDER BY name,id`,
        [actor.company, ...l.args, ...f.args],
      ).all<Person>()
    ).results
  }
  async person(actor: Actor, id: string) {
    requireAction(actor, 'records:read')
    const f = fence(actor),
      l = locationSql(actor, 'location_id')
    const value = await this.statement(
      `SELECT id,name,location_id AS locationId,version FROM env_people WHERE company_id=? AND id=? AND ${l.sql} AND ${f.sql}`,
      [actor.company, id, ...l.args, ...f.args],
    ).first<Person>()
    if (!value) throw new PayrollError('record_not_found', 404)
    return value
  }
  async createPerson(actor: Actor, input: Input) {
    const id = uuid(),
      name = text(input.name),
      locationId = text(input.locationId),
      f = fence(actor),
      event = uuid()
    requireAction(actor, 'records:write', locationId)
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_people(company_id,id,location_id,name,change_id) SELECT ?,?,?,?,? WHERE ${f.sql}
    AND EXISTS(SELECT 1 FROM env_locations WHERE company_id=? AND id=?) RETURNING id`,
        [actor.company, id, locationId, name, event, ...f.args, actor.company, locationId],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        'person.created',
        id,
        1,
        'EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND change_id=?)',
        [actor.company, id, event],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('location_or_authority_changed', 409)
    return { id, name, locationId, version: 1 }
  }
  async details(actor: Actor, id: string) {
    const person = await this.person(actor, id),
      f = fence(actor),
      event = uuid(),
      comp = actor.grant.role === 'owner' || actor.grant.fields.includes('compensation')
    const results = await this.env.DB.batch<Record<string, unknown>>([
      auditStatement(
        this.env,
        actor,
        event,
        comp ? 'compensation.read' : 'record.read',
        id,
        person.version,
        'EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)',
        [actor.company, id, person.version],
      ),
      this.statement(
        `SELECT id,hourly_cents AS hourlyCents,effective_date AS effectiveDate,approved_by AS approvedBy,approved_at AS approvedAt,proposed_by AS proposedBy
    FROM env_rate_proposals WHERE company_id=? AND person_id=? AND ?=1 AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) AND ${f.sql} ORDER BY effective_date,id`,
        [actor.company, id, comp ? 1 : 0, event, ...f.args],
      ),
      this.statement(
        `SELECT kind,version FROM env_private_records WHERE company_id=? AND person_id=? AND (?=1 OR kind IN (SELECT value FROM json_each(?))) AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) AND ${f.sql}`,
        [
          actor.company,
          id,
          actor.grant.role === 'owner' ? 1 : 0,
          JSON.stringify(actor.grant.fields),
          event,
          ...f.args,
        ],
      ),
    ])
    if (!results[0].meta.changes) throw new PayrollError('authority_or_record_changed', 409)
    return {
      ...person,
      rates: comp ? results[1].results : undefined,
      privateRecords: results[2].results.map((row) => ({ ...row, masked: '••••' })),
    }
  }
  async savePrivate(actor: Actor, id: string, input: Input) {
    const person = await this.person(actor, id),
      kind = text(input.kind),
      value = text(input.value, 16000),
      event = uuid(),
      f = fence(actor)
    if (!['ssn', 'bank', 'tax'].includes(kind)) throw new PayrollError('invalid_kind')
    requireAction(actor, 'private:write', person.locationId, kind)
    if (kind === 'bank') requireAction(actor, 'bank:edit', person.locationId, kind)
    const version = input.version === 0 || input.version === '0' ? 0 : integer(input.version),
      cipher = await seal(
        await recordKey(this.env.ENVELOPE_RECORD_KEY),
        JSON.stringify([actor.company, id, kind]),
        value,
      )
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_private_records(company_id,person_id,kind,cipher,version,change_id) SELECT ?,?,?,?,1,? WHERE ${f.sql}
    AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)
    AND (?=0 OR EXISTS(SELECT 1 FROM env_private_records WHERE company_id=? AND person_id=? AND kind=? AND version=?))
    ON CONFLICT(company_id,person_id,kind) DO UPDATE SET cipher=excluded.cipher,version=env_private_records.version+1,change_id=excluded.change_id
    WHERE env_private_records.version=? RETURNING version`,
        [
          actor.company,
          id,
          kind,
          cipher,
          event,
          ...f.args,
          actor.company,
          id,
          person.version,
          version,
          actor.company,
          id,
          kind,
          version,
          version,
        ],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        `private.${kind}.stored`,
        id,
        version + 1,
        'EXISTS(SELECT 1 FROM env_private_records WHERE company_id=? AND person_id=? AND kind=? AND change_id=?)',
        [actor.company, id, kind, event],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('record_or_authority_changed', 409)
    return { kind, version: version + 1, masked: '••••' }
  }
  async readPrivate(actor: Actor, id: string, kind: string) {
    const person = await this.person(actor, id),
      f = fence(actor),
      event = uuid()
    if (!['ssn', 'bank', 'tax'].includes(kind)) throw new PayrollError('invalid_kind')
    requireAction(actor, 'private:read', person.locationId, kind)
    const key = await recordKey(this.env.ENVELOPE_RECORD_KEY)
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
    SELECT ?,company_id,?,?,person_id,version,? FROM env_private_records WHERE company_id=? AND person_id=? AND kind=? AND ${f.sql}`,
        [
          event,
          this.session.operator.id,
          `private.${kind}.read`,
          Date.now(),
          actor.company,
          id,
          kind,
          ...f.args,
        ],
      ),
      this.statement(
        `SELECT cipher FROM env_private_records WHERE company_id=? AND person_id=? AND kind=? AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) AND ${f.sql}`,
        [actor.company, id, kind, event, ...f.args],
      ),
    ])
    const row = result[1].results[0]
    if (!row) throw new PayrollError('record_not_found', 404)
    return unseal(key, JSON.stringify([actor.company, id, kind]), String(row.cipher))
  }
  async proposeRate(actor: Actor, id: string, input: Input) {
    const person = await this.person(actor, id),
      hourlyCents = integer(input.hourlyCents),
      effectiveDate = date(input.effectiveDate),
      version = integer(input.version),
      proposal = uuid(),
      event = uuid(),
      f = fence(actor)
    requireAction(actor, 'rates:propose', person.locationId, 'compensation')
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_rate_proposals(company_id,id,person_id,person_version,hourly_cents,effective_date,proposed_by,created_at)
    SELECT ?,?,?,?,?,?,?,? WHERE ${f.sql} AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?) RETURNING id`,
        [
          actor.company,
          proposal,
          id,
          version,
          hourlyCents,
          effectiveDate,
          this.session.operator.id,
          Date.now(),
          ...f.args,
          actor.company,
          id,
          version,
        ],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        'rate.proposed',
        proposal,
        version,
        'EXISTS(SELECT 1 FROM env_rate_proposals WHERE company_id=? AND id=?)',
        [actor.company, proposal],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('record_or_authority_changed', 409)
    return { id: proposal, personId: id, hourlyCents, effectiveDate, personVersion: version }
  }
  async reviewRate(actor: Actor, id: string) {
    const f = fence(actor)
    const proposal = await this.statement(
      `SELECT id,person_id AS personId,person_version AS personVersion,hourly_cents AS hourlyCents,effective_date AS effectiveDate,approved_by AS approvedBy FROM env_rate_proposals WHERE company_id=? AND id=? AND ${f.sql}`,
      [actor.company, id, ...f.args],
    ).first<{
      id: string
      personId: string
      personVersion: number
      hourlyCents: number
      effectiveDate: string
      approvedBy: string | null
    }>()
    if (!proposal) throw new PayrollError('record_not_found', 404)
    const person = await this.person(actor, proposal.personId)
    requireAction(actor, 'rates:approve', person.locationId, 'compensation')
    if (proposal.approvedBy || person.version !== proposal.personVersion)
      throw new PayrollError('rate_review_stale', 409)
    const token = uuid() + uuid(),
      hash = await hashes(token),
      event = uuid()
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(`DELETE FROM env_rate_reviews WHERE expires_at<?`, [Date.now()]),
      this.statement(
        `INSERT INTO env_rate_reviews(token_hash,company_id,proposal_id,session_id,operator_id,grant_version,expires_at)
    SELECT ?,?,?,?,?,?,? WHERE ${f.sql} AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?) AND EXISTS(SELECT 1 FROM env_rate_proposals WHERE company_id=? AND id=? AND approved_at IS NULL) RETURNING token_hash`,
        [
          hash,
          actor.company,
          id,
          this.session.id,
          this.session.operator.id,
          actor.grant.version,
          Date.now() + 10 * 60 * 1000,
          ...f.args,
          actor.company,
          person.id,
          proposal.personVersion,
          actor.company,
          id,
        ],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        'rate.reviewed',
        id,
        person.version,
        'EXISTS(SELECT 1 FROM env_rate_reviews WHERE token_hash=?)',
        [hash],
      ),
    ])
    if (!result[1].results.length) throw new PayrollError('authority_changed', 409)
    return { ...proposal, personName: person.name, reviewToken: token }
  }
  async approveRate(actor: Actor, id: string, input: Input) {
    const token = text(input.reviewToken, 100),
      hash = await hashes(token),
      event = uuid(),
      f = fence(actor)
    // Proposal and review are immutable, session-bound, single use, and checked in
    // the same D1 transaction as the human decision and record-version advance.
    const proposal = await this.statement(
      'SELECT person_id AS personId,person_version AS version FROM env_rate_proposals WHERE company_id=? AND id=?',
      [actor.company, id],
    ).first<{ personId: string; version: number }>()
    if (!proposal) throw new PayrollError('record_not_found', 404)
    const person = await this.person(actor, proposal.personId)
    requireAction(actor, 'rates:approve', person.locationId, 'compensation')
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `UPDATE env_rate_proposals SET approved_by=?,approved_at=?,change_id=? WHERE company_id=? AND id=? AND approved_at IS NULL AND ${f.sql}
    AND EXISTS(SELECT 1 FROM env_people p WHERE p.company_id=env_rate_proposals.company_id AND p.id=env_rate_proposals.person_id AND p.version=env_rate_proposals.person_version)
    AND EXISTS(SELECT 1 FROM env_rate_reviews r WHERE r.token_hash=? AND r.company_id=? AND r.proposal_id=? AND r.session_id=? AND r.operator_id=? AND r.grant_version=? AND r.expires_at>?) RETURNING id`,
        [
          this.session.operator.id,
          Date.now(),
          event,
          actor.company,
          id,
          ...f.args,
          hash,
          actor.company,
          id,
          this.session.id,
          this.session.operator.id,
          actor.grant.version,
          Date.now(),
        ],
      ),
      this.statement(
        `UPDATE env_people SET version=version+1,change_id=? WHERE company_id=? AND id=? AND EXISTS(SELECT 1 FROM env_rate_proposals WHERE company_id=? AND id=? AND change_id=?)`,
        [event, actor.company, person.id, actor.company, id, event],
      ),
      this.statement(
        `DELETE FROM env_rate_reviews WHERE token_hash=? AND EXISTS(SELECT 1 FROM env_rate_proposals WHERE company_id=? AND id=? AND change_id=?)`,
        [hash, actor.company, id, event],
      ),
      auditStatement(
        this.env,
        actor,
        event,
        'rate.approved',
        id,
        proposal.version + 1,
        'EXISTS(SELECT 1 FROM env_rate_proposals WHERE company_id=? AND id=? AND change_id=?)',
        [actor.company, id, event],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('rate_review_stale', 409)
    return { id, approvedBy: this.session.operator.id, version: proposal.version + 1 }
  }
  async audit(actor: Actor) {
    requireAction(actor, 'audit:read')
    // Location-scoped readers must not infer other locations through audit IDs.
    if (!actor.grant.locations.includes('*')) throw new PayrollError('payroll_access_denied', 403)
    const f = fence(actor)
    return (
      await this.statement(
        `SELECT actor_id AS actorId,action,target_id AS targetId,version,occurred_at AS occurredAt FROM env_audit WHERE company_id=? AND ${f.sql} ORDER BY occurred_at DESC,id DESC LIMIT 200`,
        [actor.company, ...f.args],
      ).all()
    ).results
  }
  async export(actor: Actor) {
    requireAction(actor, 'export')
    requireAction(actor, 'records:read')
    const f = fence(actor),
      l = locationSql(actor, 'p.location_id'),
      event = uuid()
    const result = await this.env.DB.batch<Record<string, unknown>>([
      this.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at) SELECT ?||p.id,p.company_id,?,'record.exported',p.id,p.version,? FROM env_people p WHERE p.company_id=? AND ${l.sql} AND ${f.sql}`,
        [event, this.session.operator.id, Date.now(), actor.company, ...l.args, ...f.args],
      ),
      this.statement(
        `SELECT p.id,p.name,p.location_id AS locationId,p.version FROM env_people p WHERE p.company_id=? AND ${l.sql} AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit a WHERE a.id=?||p.id) ORDER BY p.id`,
        [actor.company, ...l.args, ...f.args, event],
      ),
    ])
    // The initial export is explicitly the identity/location register. Pay-rate
    // and private-document exports remain unavailable, never implied by this CSV.
    const csv = (value: unknown) =>
      '"' +
      String(value)
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""') +
      '"'
    return (
      [
        'record_id,name,location_id,version',
        ...result[1].results.map((row) =>
          [row.id, row.name, row.locationId, row.version].map(csv).join(','),
        ),
      ].join('\r\n') + '\r\n'
    )
  }
}
