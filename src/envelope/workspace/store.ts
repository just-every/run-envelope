import { stepUpFence } from '../step-up'
import type { Records, Input } from '../records'
import { currentReviewInputs, reviewInputFence, type ReviewInputSet } from './review-inputs'
import { fence, auditStatement, requireAction, type Actor } from '../access'
import { PayrollError, text, integer, recordKey, seal, unseal } from '../security'

export type Kind =
  | 'company-funding'
  | 'company-funding-plan'
  | 'tax-notice-case'
  | 'withholding-instruction'
  | 'paper-onboarding'
  | 'automation-policy'
  | 'new-hire-report'
  | 'new-hire-election'
  | 'ui-claim'
  | 'industry-classification'
  | 'industry-check'
  | 'industry-return'
  | 'verification-worker'
  | 'income-source'
  | 'disclosure'
  | 'hris-hire'
  | 'hris-event'
  | 'source-earning'
  | 'leave-account'
  | 'residence'
  | 'work'
  | 'tip'
  | 'election'
  | 'tax-election'
  | 'local-tax-input'
  | 'schedule'
  | 'pay-item'
  | 'pay-change'
  | 'proration-policy'
  | 'approval-policy'
  | 'rule'
  | 'group'
  | 'earnings-run'
export interface Revision<T = Input> {
  id: string
  kind: Kind
  version: number
  personId: string | null
  personVersion: number | null
  sourcesCurrent: number
  data: T
  createdBy: string
  createdAt: number
  approvedBy: string | null
  approvedAt: number | null
  withdrawnBy: string | null
}
export const revision = (v: unknown) => (v === 0 || v === '0' ? 0 : integer(v))
export const choice = (v: unknown, options: readonly string[]) => {
  const value = text(v)
  if (!options.includes(value)) throw new PayrollError('invalid_choice')
  return value
}
export const optional = (v: unknown, max = 240) =>
  v === undefined || v === '' ? '' : text(v, max)
export const objectId = (v: unknown) => {
  const id = text(v, 80)
  if (!/^[a-zA-Z0-9][-a-zA-Z0-9]{0,79}$/.test(id))
    throw new PayrollError('invalid_object_id')
  return id
}
export const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')

export interface Sources {
  freshProof?: boolean
  noPrivacyHold?: string
  reviewSets?: ReviewInputSet[]
  people?: { id: string; version: number }[]
  objects?: { kind: Kind; id: string; version: number; approved?: boolean }[]
}
export const currentSources = (
  alias: string,
) => `NOT EXISTS(SELECT 1 FROM env_workspace_people sp WHERE sp.company_id=${alias}.company_id AND sp.kind=${alias}.kind AND sp.object_id=${alias}.object_id AND sp.version=${alias}.version
  AND NOT EXISTS(SELECT 1 FROM env_people p WHERE p.company_id=sp.company_id AND p.id=sp.person_id AND p.version=sp.person_version))
  AND (EXISTS(SELECT 1 FROM env_workspace_decisions approved WHERE approved.company_id=${alias}.company_id AND approved.kind=${alias}.kind AND approved.object_id=${alias}.object_id AND approved.version=${alias}.version AND approved.decision='approved') OR ${currentReviewInputs(alias)})
  AND NOT EXISTS(SELECT 1 FROM env_workspace_dependencies dep WHERE dep.company_id=${alias}.company_id AND dep.kind=${alias}.kind AND dep.object_id=${alias}.object_id AND dep.version=${alias}.version
  AND ((SELECT MAX(version) FROM env_workspace_versions sv WHERE sv.company_id=dep.company_id AND sv.kind=dep.source_kind AND sv.object_id=dep.source_id)!=dep.source_version
    OR (dep.needs_approval=1 AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions sd WHERE sd.company_id=dep.company_id AND sd.kind=dep.source_kind AND sd.object_id=dep.source_id AND sd.version=dep.source_version AND sd.decision='approved'))
    OR EXISTS(SELECT 1 FROM env_workspace_decisions sd WHERE sd.company_id=dep.company_id AND sd.kind=dep.source_kind AND sd.object_id=dep.source_id AND sd.version=dep.source_version AND sd.decision='withdrawn')))`

/** Uses existing payroll powers; no cookie role, agent flag or client-supplied actor. */
export class WorkspaceStore {
  constructor(public records: Records) {}
  async authority(
    actor: Actor,
    action: string,
    personId?: string | null,
    compensation = false,
  ) {
    if (personId) {
      const person = await this.records.person(actor, personId)
      requireAction(
        actor,
        action,
        person.locationId,
        compensation ? 'compensation' : undefined,
      )
      return person
    }
    requireAction(actor, action, undefined, compensation ? 'compensation' : undefined)
    if (!actor.grant.locations.includes('*'))
      throw new PayrollError('all_locations_required', 403)
    return null
  }
  async list<T = Input>(
    actor: Actor,
    kind: Kind,
    personId?: string,
    compensation = false,
    audited = true,
  ): Promise<Revision<T>[]> {
    const person = await this.authority(actor, 'records:read', personId, compensation)
    const key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    const f = fence(actor),
      event = crypto.randomUUID()
    const result = await this.records.env.DB.batch<Record<string, unknown>>([
      ...(audited
        ? [
            auditStatement(
              this.records.env,
              actor,
              event,
              `workspace.${kind}.read`,
              personId ?? actor.company,
              actor.grant.version,
            ),
          ]
        : []),
      this.records.statement(
        `SELECT v.object_id AS id,v.kind,v.version,v.person_id AS personId,v.person_version AS personVersion,v.cipher,v.created_by AS createdBy,v.created_at AS createdAt,(${currentSources('v')}) AS sourcesCurrent,
        (SELECT actor_id FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='approved') AS approvedBy,
        (SELECT occurred_at FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='approved') AS approvedAt,
        (SELECT actor_id FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='withdrawn') AS withdrawnBy
        FROM env_workspace_versions v WHERE v.company_id=? AND v.kind=? AND ${personId ? 'v.person_id=?' : 'v.person_id IS NULL'} AND ${f.sql}
        ${audited ? 'AND EXISTS(SELECT 1 FROM env_audit WHERE id=?)' : ''}
        ${person ? 'AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)' : ''}
        ORDER BY v.object_id,v.version DESC`,
        [
          actor.company,
          kind,
          ...(personId ? [personId] : []),
          ...f.args,
          ...(audited ? [event] : []),
          ...(person ? [actor.company, person.id, person.version] : []),
        ],
      ),
    ])
    if (audited && !result[0].meta.changes)
      throw new PayrollError('authority_changed', 409)
    return Promise.all(
      result[audited ? 1 : 0].results.map(async (row) => {
        const { cipher, ...publicRow } = row
        const data = JSON.parse(
          await unseal(
            key,
            JSON.stringify([actor.company, kind, row.id, row.version]),
            String(cipher),
          ),
        )
        return { ...publicRow, data } as unknown as Revision<T>
      }),
    )
  }
  async append<T extends object>(
    actor: Actor,
    kind: Kind,
    id: string,
    expected: number,
    payload: T,
    personId?: string,
    compensation = false,
    sources: Sources = {},
  ) {
    objectId(id)
    const person = await this.authority(
      actor,
      compensation ? 'rates:propose' : 'records:write',
      personId,
      compensation,
    )
    const f = fence(actor),
      event = crypto.randomUUID(),
      version = expected + 1
    if (sources.freshProof) {
      const proof = stepUpFence(actor)
      f.sql += ` AND ${proof.sql}`
      f.args.push(...proof.args)
    }
    const pins = [
      ...(sources.people ?? []),
      ...(person ? [{ id: person.id, version: person.version }] : []),
    ]
    if (new Set(pins.map((p) => p.id)).size !== pins.length)
      throw new PayrollError('duplicate_source')
    const deps = sources.objects ?? []
    // Constant-size binding sets avoid D1's per-statement variable limit for
    // genuine 100-person groups and multi-day source collections.
    const sourceSql = `${sources.noPrivacyHold ? "AND NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND person_id=? AND status='held')" : ''} AND NOT EXISTS(SELECT 1 FROM json_each(?) pin WHERE NOT EXISTS(
      SELECT 1 FROM env_people p WHERE p.company_id=? AND p.id=json_extract(pin.value,'$.id') AND p.version=json_extract(pin.value,'$.version')))
      AND NOT EXISTS(SELECT 1 FROM json_each(?) src WHERE
        COALESCE((SELECT MAX(version) FROM env_workspace_versions sv WHERE sv.company_id=? AND sv.kind=json_extract(src.value,'$.kind') AND sv.object_id=json_extract(src.value,'$.id')),0)!=json_extract(src.value,'$.version')
        OR (json_extract(src.value,'$.approved')=1 AND (
          NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=? AND d.kind=json_extract(src.value,'$.kind') AND d.object_id=json_extract(src.value,'$.id') AND d.version=json_extract(src.value,'$.version') AND d.decision='approved')
          OR EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=? AND d.kind=json_extract(src.value,'$.kind') AND d.object_id=json_extract(src.value,'$.id') AND d.version=json_extract(src.value,'$.version') AND d.decision='withdrawn'))))`
    const reviewInputs = reviewInputFence(actor.company, sources.reviewSets ?? [])
    const sourceArgs = [
      ...(sources.noPrivacyHold ? [actor.company,sources.noPrivacyHold] : []),
      JSON.stringify(pins),
      actor.company,
      JSON.stringify(deps),
      actor.company,
      actor.company,
      actor.company,
    ]

    const erasedSource = await digest(JSON.stringify([kind, id]))
    if (await this.records.statement('SELECT 1 FROM env_privacy_source_fences WHERE company_id=? AND source_hash=?', [actor.company, erasedSource]).first())
      throw new PayrollError('erased_source', 409)
    const key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    const cipher = await seal(
      key,
      JSON.stringify([actor.company, kind, id, version]),
      JSON.stringify(payload),
    )
    const result = await this.records.env.DB.batch<Record<string, unknown>>([
      this.records.statement(
        `INSERT INTO env_workspace_versions(company_id,kind,object_id,version,person_id,person_version,cipher,created_by,created_at,change_id)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${f.sql}
        AND COALESCE((SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind=? AND object_id=?),0)=?
        ${person ? 'AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)' : ''}
        AND NOT EXISTS(SELECT 1 FROM env_workspace_versions WHERE company_id=? AND kind=? AND object_id=? AND person_id IS NOT ?) ${sourceSql} AND ${reviewInputs.sql} AND NOT EXISTS(SELECT 1 FROM env_privacy_source_fences WHERE company_id=? AND source_hash=?) RETURNING version`,
        [
          actor.company,
          kind,
          id,
          version,
          person?.id ?? null,
          person?.version ?? null,
          cipher,
          actor.session.operator.id,
          Date.now(),
          event,
          ...f.args,
          actor.company,
          kind,
          id,
          expected,
          ...(person ? [actor.company, person.id, person.version] : []),
          actor.company,
          kind,
          id,
          person?.id ?? null,
          ...sourceArgs,
          ...reviewInputs.args,
          actor.company, erasedSource,
        ],
      ),
      this.records.statement(
        `INSERT INTO env_workspace_people(company_id,kind,object_id,version,person_id,person_version)
        SELECT ?,?,?,?,json_extract(value,'$.id'),json_extract(value,'$.version') FROM json_each(?) WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`,
        [actor.company, kind, id, version, JSON.stringify(pins), event],
      ),
      this.records.statement(
        `INSERT INTO env_workspace_dependencies(company_id,kind,object_id,version,source_kind,source_id,source_version,needs_approval)
        SELECT ?,?,?,?,json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.version'),COALESCE(json_extract(value,'$.approved'),0) FROM json_each(?) WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`,
        [actor.company, kind, id, version, JSON.stringify(deps), event],
      ),
      this.records.statement(
        `INSERT INTO env_workspace_review_inputs(company_id,kind,object_id,version,source_kind,source_person_id,except_id,versions,decisions)
        SELECT ?,?,?,?,json_extract(value,'$.kind'),json_extract(value,'$.personId'),json_extract(value,'$.exceptId'),json_extract(value,'$.versions'),json_extract(value,'$.decisions') FROM json_each(?) WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`,
        [actor.company,kind,id,version,JSON.stringify(sources.reviewSets ?? []),event],
      ),
      auditStatement(
        this.records.env,
        actor,
        event,
        `workspace.${kind}.recorded`,
        id,
        version,
        'EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)',
        [event],
      ),
    ])
    if (!result[0].results.length)
      throw new PayrollError('input_or_authority_changed', 409)
    return { id, kind, version }
  }
  async find<T = Input>(
    actor: Actor,
    kind: Kind,
    id: string,
    personId?: string,
    compensation = false,
  ) {
    const rows = await this.list<T>(actor, kind, personId, compensation, false)
    const row = rows.find((r) => r.id === id)
    if (!row) throw new PayrollError('record_not_found', 404)
    return row
  }
  async review<T = Input>(actor: Actor, kind: Kind, id: string, personId?: string) {
    const row = await this.find<T>(actor, kind, id, personId, true)
    await this.authority(actor, 'rates:approve', personId, true)
    if (!row.sourcesCurrent || row.approvedBy || row.withdrawnBy)
      throw new PayrollError('review_stale', 409)
    const token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await digest(token),
      f = fence(actor),
      event = crypto.randomUUID()
    const result = await this.records.env.DB.batch([
      this.records.statement(
        `INSERT INTO env_workspace_reviews(token_hash,company_id,kind,object_id,version,session_id,operator_id,grant_version,expires_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE ${f.sql} AND (SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind=? AND object_id=?)=? RETURNING token_hash`,
        [
          hash,
          actor.company,
          kind,
          id,
          row.version,
          actor.session.id,
          actor.session.operator.id,
          actor.grant.version,
          Date.now() + 600000,
          ...f.args,
          actor.company,
          kind,
          id,
          row.version,
        ],
      ),
      auditStatement(this.records.env, actor, event, `workspace.${kind}.reviewed`, id, row.version,
        'EXISTS(SELECT 1 FROM env_workspace_reviews WHERE token_hash=? AND session_id=?)',
        [hash, actor.session.id]),
    ])
    if (!result[0].results.length) throw new PayrollError('review_stale', 409)
    return { ...row, reviewToken: token }
  }
  async decide(
    actor: Actor,
    kind: Kind,
    id: string,
    input: Input,
    personId?: string,
    withdraw = false,
  ) {
    const row = await this.find(actor, kind, id, personId, true)
    await this.authority(actor, 'rates:approve', personId, true)
    const version = integer(input.version),
      f = fence(actor),
      event = crypto.randomUUID()
    if (
      (!withdraw && !row.sourcesCurrent) ||
      row.version !== version ||
      row.withdrawnBy ||
      (withdraw ? !row.approvedBy : row.approvedBy)
    )
      throw new PayrollError('review_stale', 409)
    const hash = withdraw ? '' : await digest(text(input.reviewToken, 100))
    const result = await this.records.env.DB.batch<Record<string, unknown>>([
      this.records.statement(
        `INSERT INTO env_workspace_decisions(company_id,kind,object_id,version,decision,actor_id,occurred_at,change_id)
        SELECT ?,?,?,?,?,?,?,? WHERE ${f.sql}
        AND (SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind=? AND object_id=?)=?
        ${row.personId ? 'AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)' : ''}
        ${withdraw ? '' : `AND EXISTS(SELECT 1 FROM env_workspace_versions v WHERE v.company_id=? AND v.kind=? AND v.object_id=? AND v.version=? AND ${currentSources('v')})`}
        AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions WHERE company_id=? AND kind=? AND object_id=? AND version=? AND decision=?)
        ${withdraw ? '' : `AND EXISTS(SELECT 1 FROM env_workspace_reviews WHERE token_hash=? AND company_id=? AND kind=? AND object_id=? AND version=? AND session_id=? AND operator_id=? AND grant_version=? AND expires_at>?)`}
        RETURNING version`,
        [
          actor.company,
          kind,
          id,
          version,
          withdraw ? 'withdrawn' : 'approved',
          actor.session.operator.id,
          Date.now(),
          event,
          ...f.args,
          actor.company,
          kind,
          id,
          version,
          ...(row.personId ? [actor.company, row.personId, row.personVersion] : []),
          ...(withdraw ? [] : [actor.company, kind, id, version]),
          actor.company,
          kind,
          id,
          version,
          withdraw ? 'withdrawn' : 'approved',
          ...(withdraw
            ? []
            : [
                hash,
                actor.company,
                kind,
                id,
                version,
                actor.session.id,
                actor.session.operator.id,
                actor.grant.version,
                Date.now(),
              ]),
        ],
      ),
      auditStatement(
        this.records.env,
        actor,
        event,
        `workspace.${kind}.${withdraw ? 'withdrawn' : 'approved'}`,
        id,
        version,
        'EXISTS(SELECT 1 FROM env_workspace_decisions WHERE change_id=?)',
        [event],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('review_stale', 409)
    return {
      id,
      version,
      decision: withdraw ? 'withdrawn' : 'approved',
      actorId: actor.session.operator.id,
    }
  }
}
