import type { Actor } from '../access'
import { fence, auditStatement } from '../access'
import {
  date,
  text,
  integer,
  recordKey,
  seal,
  unseal,
  PayrollError,
} from '../security'
import type { Input } from '../records'
import {
  WorkspaceStore,
  revision,
  objectId,
  choice,
  currentSources,
  type Revision,
} from '../workspace/store'
import { collectionPins } from '../workspace/review-inputs'
import { latest, approved, zero } from '../leave/ledger'
import { SourceIntake, type SourceEvent } from '../intake/sources'

export interface WorkerBinding {
  workerId: string
  evidence: string
}
export interface IncomeSource {
  from: string
  through: string
  grossCents: number
  sourceRef: string
  evidence: string
}
export interface ConsentData {
  requestId: string
  purpose: string
  from: string
  through: string
  fields: string[]
  requesterId: string
  retentionUntil: string
}
export interface Consent extends ConsentData {
  id: string
  personId: string
  workerId: string
  expiresAt: number
  revokedAt: number | null
  bindingId: string
  bindingVersion: number
}
export interface ProtectedDisclosure {
  authority?: { basis: string; sourceAuthority: string; requesterEvidence: string; purpose: string }
  consentId: string
  requesterId: string
  corrects: string
  response: Input
  provenance: { kind: string; id: string; version: number; sourceRef: string }[]
}
export const retentionDeadline = (value: string) =>
  Date.parse(value.length === 10 ? value + 'T23:59:59.999Z' : value)
export const boundedPeriod = (input: Input) => {
  const from = date(input.from),
    through = date(input.through)
  if (
    from > through ||
    (Date.parse(through) - Date.parse(from)) / 86400000 + 1 > 366
  )
    throw new PayrollError('verification_period_too_broad')
  return { from, through }
}
export const ownerOnly = (actor: Actor) => {
  if (actor.grant.role !== 'owner')
    throw new PayrollError('owner_required', 403)
}
export const bindingFence = (
  alias: string,
) => `EXISTS(SELECT 1 FROM oa_operators requester WHERE requester.id=${alias}.requester_id AND requester.version=${alias}.requester_version AND requester.status='active') AND EXISTS(SELECT 1 FROM oa_operators wo JOIN env_grants wg ON wg.operator_id=wo.id AND wg.company_id=${alias}.company_id
 WHERE wo.id=${alias}.worker_id AND wo.version=${alias}.worker_version AND wo.status='active' AND wg.version=${alias}.worker_grant_version AND wg.revoked_at IS NULL) AND EXISTS(SELECT 1 FROM env_workspace_versions b
 WHERE b.company_id=${alias}.company_id AND b.kind='verification-worker' AND b.object_id=${alias}.binding_id AND b.version=${alias}.binding_version
 AND b.version=(SELECT MAX(version) FROM env_workspace_versions nb WHERE nb.company_id=b.company_id AND nb.kind=b.kind AND nb.object_id=b.object_id)
 AND ${currentSources('b')}
 AND EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=b.company_id AND d.kind=b.kind AND d.object_id=b.object_id AND d.version=b.version AND d.decision='approved')
 AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=b.company_id AND d.kind=b.kind AND d.object_id=b.object_id AND d.version=b.version AND d.decision='withdrawn'))`
export class VerificationRequests {
  constructor(public store: WorkspaceStore) {}
  private async scope(actor: Actor, personId: string, self: boolean) {
    const f = fence(actor)
    if (self) {
      const binding = await this.binding(actor, personId, true)
      f.sql += ` AND EXISTS(SELECT 1 FROM env_workspace_versions b WHERE b.company_id=? AND b.kind='verification-worker' AND b.object_id=? AND b.version=?
        AND b.version=(SELECT MAX(version) FROM env_workspace_versions nb WHERE nb.company_id=b.company_id AND nb.kind=b.kind AND nb.object_id=b.object_id)
        AND ${currentSources('b')}
        AND EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=b.company_id AND d.kind=b.kind AND d.object_id=b.object_id AND d.version=b.version AND d.decision='approved')
        AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=b.company_id AND d.kind=b.kind AND d.object_id=b.object_id AND d.version=b.version AND d.decision='withdrawn'))`
      f.args.push(actor.company, binding.id, binding.version)
    } else {
      ownerOnly(actor)
      await this.store.authority(actor, 'records:read', personId, true)
    }
    return f
  }
  async bind(actor: Actor, personId: string, input: Input) {
    ownerOnly(actor)
    const workerId = text(input.workerId)
    const worker = await this.store.records
      .statement("SELECT id FROM oa_operators WHERE id=? AND status='active'", [
        workerId,
      ])
      .first()
    if (!worker) throw new PayrollError('known_worker_identity_required', 409)
    return this.store.append(
      actor,
      'verification-worker',
      'verify-' + personId,
      revision(input.version),
      { workerId, evidence: text(input.evidence, 500) },
      personId,
      true,
    )
  }
  async binding(actor: Actor, personId: string, self = false) {
    const rows = await this.store.list<WorkerBinding>(
        actor,
        'verification-worker',
        personId,
        !self,
        false,
      ),
      row = rows[0]
    if (!row) throw new PayrollError('verified_worker_link_required', 403)
    approved(row)
    if (self && row.data.workerId !== actor.session.operator.id)
      throw new PayrollError('own_worker_only', 403)
    return row
  }
  async income(actor: Actor, personId: string, input: Input) {
    ownerOnly(actor)
    const data: IncomeSource = {
      ...boundedPeriod(input),
      grossCents: zero(input.grossCents),
      sourceRef: text(input.sourceRef, 240),
      evidence: text(input.evidence, 500),
    }
    if (data.through > new Date().toISOString().slice(0, 10))
      throw new PayrollError('historical_wage_period_required', 409)
    return this.store.append(
      actor,
      'income-source',
      objectId(input.id),
      revision(input.version),
      data,
      personId,
      true,
    )
  }
  async consent(actor: Actor, personId: string, input: Input) {
    const binding = await this.binding(actor, personId, true),
      person = await this.store.records.person(actor, personId)
    const requesterId = text(input.requesterId),
      requester = await this.store.records
        .statement(
          "SELECT id,version FROM oa_operators WHERE id=? AND status='active'",
          [requesterId],
        )
        .first<{id: string; version: number}>()
    if (!requester || requesterId === actor.session.operator.id)
      throw new PayrollError('verified_requester_required', 403)
    const fields = Array.isArray(input.fields)
      ? input.fields
      : typeof input.fields === 'string'
        ? input.fields.split(',')
        : []
    if (
      !fields.length ||
      fields.length > 3 ||
      new Set(fields).size !== fields.length ||
      fields.some(
        (v) =>
          !['hireDate', 'employmentStatus', 'grossWages'].includes(String(v)),
      )
    )
      throw new PayrollError('verification_fields_not_permitted', 403)
    const expiry =
        input.expiresAt === undefined
          ? date(input.expiresOn) + 'T23:59:59.999Z'
          : text(input.expiresAt, 30),
      expiresAt = Date.parse(expiry),
      retentionUntil = text(input.retentionUntil, 30)
    if (
      !Number.isFinite(expiresAt) ||
      new Date(expiresAt).toISOString() !== expiry
    )
      throw new PayrollError('invalid_verification_expiry')
    const retentionAt = retentionDeadline(retentionUntil)
    if (
      !Number.isFinite(retentionAt) ||
      (retentionUntil.length === 10
        ? date(retentionUntil) !== retentionUntil
        : new Date(retentionAt).toISOString() !== retentionUntil)
    )
      throw new PayrollError('invalid_verification_retention')
    if (
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + 30 * 86400000 ||
      retentionAt < expiresAt ||
      retentionAt > Date.now() + 90 * 86400000
    )
      throw new PayrollError('invalid_verification_expiry')
    const payload: ConsentData = {
      requestId: objectId(input.requestId),
      ...boundedPeriod(input),
      requesterId,
      fields: fields.map(String),
      purpose: choice(input.purpose, ['mortgage', 'rental', 'employment']),
      retentionUntil,
    }
    const id = crypto.randomUUID(),
      event = crypto.randomUUID(),
      f = fence(actor),
      cipher = await seal(
        await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY),
        JSON.stringify([actor.company, 'verification-consent', id]),
        JSON.stringify(payload),
      )
    const result = await this.store.records.env.DB.batch([
      this.store.records.statement(
        `INSERT INTO env_verification_consents(company_id,id,person_id,worker_id,worker_version,worker_grant_version,requester_id,requester_version,binding_id,binding_version,cipher,created_session,created_at,expires_at,change_id)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active') AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)
      AND EXISTS(SELECT 1 FROM env_workspace_versions b WHERE b.company_id=? AND b.kind='verification-worker' AND b.object_id=? AND b.version=? AND ${currentSources('b')}
       AND b.version=(SELECT MAX(version) FROM env_workspace_versions nb WHERE nb.company_id=b.company_id AND nb.kind=b.kind AND nb.object_id=b.object_id)
       AND EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=b.company_id AND d.kind=b.kind AND d.object_id=b.object_id AND d.version=b.version AND d.decision='approved')
       AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=b.company_id AND d.kind=b.kind AND d.object_id=b.object_id AND d.version=b.version AND d.decision='withdrawn')) RETURNING id`,
        [
          actor.company,
          id,
          personId,
          actor.session.operator.id,
          actor.session.operator.version,
          actor.grant.version,
          requesterId,
          requester.version,
          binding.id,
          binding.version,
          cipher,
          actor.session.id,
          Date.now(),
          expiresAt,
          event,
          ...f.args,
          requesterId,
          requester.version,
          actor.company,
          personId,
          person.version,
          actor.company,
          binding.id,
          binding.version,
        ],
      ),
      auditStatement(
        this.store.records.env,
        actor,
        event,
        'verification.consent-given',
        id,
        1,
        'EXISTS(SELECT 1 FROM env_verification_consents WHERE change_id=?)',
        [event],
      ),
    ])
    if (!result[0].results.length)
      throw new PayrollError('verification_authority_changed', 409)
    return { id, expiresAt, ...payload }
  }
  async consents(
    actor: Actor,
    personId: string,
    self = false,
  ): Promise<Consent[]> {
    const f = await this.scope(actor, personId, self),
      rows = await this.store.records
        .statement(
          `SELECT id,person_id AS personId,worker_id AS workerId,binding_id AS bindingId,binding_version AS bindingVersion,expires_at AS expiresAt,revoked_at AS revokedAt,cipher FROM env_verification_consents WHERE company_id=? AND person_id=? ${self ? 'AND worker_id=?' : ''} AND ${f.sql} ORDER BY created_at DESC`,
          [actor.company, personId, ...(self ? [actor.session.operator.id] : []), ...f.args],
        )
        .all<{
          id: string
          personId: string
          workerId: string
          bindingId: string
          bindingVersion: number
          expiresAt: number
          revokedAt: number | null
          cipher: string
        }>()
    const key = await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY)
    return Promise.all(
      rows.results.map(async ({ cipher, ...r }) => ({
        ...r,
        ...JSON.parse(
          await unseal(
            key,
            JSON.stringify([actor.company, 'verification-consent', r.id]),
            cipher,
          ),
        ),
      })),
    )
  }
  async revoke(actor: Actor, personId: string, id: string) {
    await this.binding(actor, personId, true)
    const f = fence(actor),
      event = crypto.randomUUID(),
      result = await this.store.records.env.DB.batch([
        this.store.records.statement(
          `UPDATE env_verification_consents SET revoked_at=?,revocation_id=? WHERE company_id=? AND id=? AND person_id=? AND worker_id=? AND revoked_at IS NULL AND ${f.sql} RETURNING id`,
          [
            Date.now(),
            event,
            actor.company,
            id,
            personId,
            actor.session.operator.id,
            ...f.args,
          ],
        ),
        auditStatement(
          this.store.records.env,
          actor,
          event,
          'verification.consent-revoked',
          id,
          1,
          'EXISTS(SELECT 1 FROM env_verification_consents WHERE company_id=? AND id=? AND worker_id=? AND revocation_id=?)',
          [actor.company, id, actor.session.operator.id, event],
        ),
      ])
    if (!result[0].results.length)
      throw new PayrollError('verification_request_unavailable', 409)
    return { id, revoked: true }
  }
  async propose(actor: Actor, personId: string, input: Input) {
    ownerOnly(actor)
    const consent = (await this.consents(actor, personId)).find(
      (c) => c.id === input.consentId,
    )
    if (!consent || consent.revokedAt || consent.expiresAt <= Date.now())
      throw new PayrollError('current_worker_consent_required', 403)
    boundedPeriod({from:consent.from,through:consent.through})
    const basis = choice(input.basis ?? 'worker-consent', ['worker-consent', 'legal-authority'])
    const authority = basis === 'legal-authority' ? {
      basis, sourceAuthority: text(input.sourceAuthority, 1000),
      requesterEvidence: text(input.requesterEvidence, 500), purpose: consent.purpose,
    } : undefined
    const binding = await this.binding(actor, personId)
    if (
      binding.id !== consent.bindingId ||
      binding.version !== consent.bindingVersion
    )
      throw new PayrollError('worker_link_changed', 403)
    const hr = (
      await new SourceIntake(this.store).timeline(actor, personId, 'hris-event')
    )
      .filter(
        (r) =>
          r.data.provider === 'willow' &&
          r.data.effectiveDate <= consent.through &&
          ['hire', 'termination'].includes(r.data.type),
      )
      .sort((a, b) => b.data.effectiveDate.localeCompare(a.data.effectiveDate))
    const hire = hr.find((r) => r.data.type === 'hire')
    if (!hire)
      throw new PayrollError('reviewed_willow_employment_required', 409)
    for (const r of hr) approved(r)
    const sources: NonNullable<
      import('../workspace/store').Sources['objects']
    > = [
      {
        kind: 'verification-worker',
        id: binding.id,
        version: binding.version,
        approved: true,
      },
      ...hr.map((r) => ({
        kind: r.kind,
        id: r.id,
        version: r.version,
        approved: true,
      })),
    ]
    const provenance: ProtectedDisclosure['provenance'] = hr.map((r) => ({
      kind: r.kind,
      id: r.id,
      version: r.version,
      sourceRef: r.data.sourceId,
    }))
    const response: Input = {
      periodStart: consent.from,
      periodEnd: consent.through,
    }
    if (consent.fields.includes('hireDate'))
      response.hireDate = hire.data.effectiveDate
    if (consent.fields.includes('employmentStatus'))
      response.employmentStatus =
        hr[0].data.type === 'termination' ? 'terminated' : 'employed'
    if (consent.fields.includes('grossWages')) {
      const income = latest(
        await this.store.list<IncomeSource>(
          actor,
          'income-source',
          personId,
          true,
          false,
        ),
      ).filter(
        (r) => r.data.from <= consent.through && r.data.through >= consent.from,
      )
      if (
        !income.length ||
        income.some(
          (r) => r.data.from < consent.from || r.data.through > consent.through,
        )
      )
        throw new PayrollError('exact_period_wage_source_required', 409)
      for (const r of income) {
        approved(r)
        if (
          income.some(
            (n) =>
              n.id !== r.id &&
              n.data.from <= r.data.through &&
              n.data.through >= r.data.from,
          )
        )
          throw new PayrollError('overlapping_wage_sources', 409)
      }
      const ordered = [...income].sort((a, b) =>
        a.data.from.localeCompare(b.data.from),
      )
      if (
        ordered[0].data.from !== consent.from ||
        ordered.at(-1)!.data.through !== consent.through ||
        ordered.some(
          (r, i) =>
            i > 0 &&
            Date.parse(r.data.from) -
              Date.parse(ordered[i - 1].data.through) !==
              86400000,
        )
      )
        throw new PayrollError('incomplete_wage_period', 409)
      response.grossWagesCents = income.reduce(
        (s, r) => s + r.data.grossCents,
        0,
      )
      response.currency = 'USD'
      provenance.push(
        ...income.map((r) => ({
          kind: 'income-source',
          id: r.id,
          version: r.version,
          sourceRef: r.data.sourceRef,
        })),
      )
      sources.push(
        ...income.map((r) => ({
          kind: 'income-source' as const,
          id: r.id,
          version: r.version,
          approved: true,
        })),
      )
    }
    let corrects = ''
    if (input.corrects) {
      corrects = objectId(input.corrects)
      const prior = await this.store.find<ProtectedDisclosure>(
        actor,
        'disclosure',
        corrects,
        personId,
        true,
      )
      if (prior.data.requesterId !== consent.requesterId)
        throw new PayrollError('correction_recipient_changed', 403)
    }
    if ((!corrects && input.id !== consent.requestId) || (corrects && (await this.store.find<ProtectedDisclosure>(actor, 'disclosure', corrects, personId, true)).data.consentId !== consent.id))
      throw new PayrollError('fresh_request_consent_required', 403)
    if (input.fields !== undefined && JSON.stringify(input.fields) !== JSON.stringify(consent.fields))
      throw new PayrollError('fresh_field_consent_required', 403)
    const data: ProtectedDisclosure = {
      ...(authority ? { authority } : {}),
      consentId: consent.id,
      requesterId: consent.requesterId,
      corrects,
      response,
      provenance,
    }
    return this.store.append(
      actor,
      'disclosure',
      objectId(input.id),
      revision(input.version),
      data,
      personId,
      true,
      {
        objects: sources,
        reviewSets: await collectionPins(this.store, actor, [
          { kind: 'hris-event', personId, exceptId: '' },
          { kind: 'income-source', personId, exceptId: '' },
        ]),
      },
    )
  }
  async correction(actor: Actor, personId: string, id: string, input: Input) {
    const consent = (await this.consents(actor, personId, true)).find(
      (c) => c.id === id,
    )
    if (!consent)
      throw new PayrollError('verification_request_unavailable', 404)
    const f = await this.scope(actor, personId, true),
      key = crypto.randomUUID(),
      event = crypto.randomUUID(),
      cipher = await seal(
        await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY),
        JSON.stringify([actor.company, 'verification-correction', key]),
        text(input.reason, 2000),
      )
    const results = await this.store.records.env.DB.batch([
      this.store.records.statement(
        `INSERT INTO env_verification_corrections(company_id,id,consent_id,worker_id,cipher,created_at) SELECT ?,?,?,?,?,? WHERE ${f.sql} RETURNING id`,
        [
          actor.company,
          key,
          id,
          actor.session.operator.id,
          cipher,
          Date.now(),
          ...f.args,
        ],
      ),
      auditStatement(
        this.store.records.env,
        actor,
        event,
        'verification.correction-requested',
        id,
        1,
        'EXISTS(SELECT 1 FROM env_verification_corrections WHERE company_id=? AND id=?)',
        [actor.company, key],
      ),
    ])
    if (!results[0].results.length)
      throw new PayrollError('verification_authority_changed', 409)
    return { id: key, status: 'awaiting-owner-source-review' }
  }
  async history(actor: Actor, personId: string, self = false) {
    const consents = await this.consents(actor, personId, self),
      f = await this.scope(actor, personId, self),
      event = crypto.randomUUID()
    const results = await this.store.records.env.DB.batch<
      Record<string, unknown>
    >([
      auditStatement(
        this.store.records.env,
        actor,
        event,
        'verification.disclosure-history-read',
        personId,
        actor.grant.version,
        f.sql,
        f.args,
      ),
      this.store.records.statement(
        `SELECT r.id,r.consent_id AS consentId,r.disclosure_id AS disclosureId,r.disclosure_version AS disclosureVersion,r.requester_id AS requesterId,r.issued_at AS issuedAt,r.expires_at AS expiresAt,r.opened_at AS openedAt,r.acknowledged_at AS acknowledgedAt,v.cipher
        FROM env_verification_releases r JOIN env_verification_consents c ON c.company_id=r.company_id AND c.id=r.consent_id
        JOIN env_workspace_versions v ON v.company_id=r.company_id AND v.kind='disclosure' AND v.object_id=r.disclosure_id AND v.version=r.disclosure_version
        WHERE c.company_id=? AND c.person_id=? ${self ? 'AND c.worker_id=?' : ''} AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?)`,
        [actor.company, personId, ...(self ? [actor.session.operator.id] : []), ...f.args, event],
      ),
      this.store.records.statement(
        `SELECT id,consent_id AS consentId,worker_id AS workerId,cipher,created_at AS createdAt FROM env_verification_corrections
        WHERE company_id=? AND consent_id IN(SELECT id FROM env_verification_consents WHERE company_id=? AND person_id=? ${self ? 'AND worker_id=?' : ''}) AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?)`,
        [actor.company, actor.company, personId, ...(self ? [actor.session.operator.id] : []), ...f.args, event],
      ),
    ])
    if (!results[0].meta.changes)
      throw new PayrollError('verification_authority_changed', 409)
    const key = await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY)
    return {
      consents,
      releases: await Promise.all(
        results[1].results.map(async ({ cipher, ...r }) => {
          const consent = consents.find((c) => c.id === r.consentId),
            retained =
              consent && retentionDeadline(consent.retentionUntil) >= Date.now()
          const disclosed = retained
            ? (JSON.parse(
                await unseal(
                  key,
                  JSON.stringify([
                    actor.company,
                    'disclosure',
                    r.disclosureId,
                    r.disclosureVersion,
                  ]),
                  String(cipher),
                ),
              ) as ProtectedDisclosure)
            : undefined
          return {
            id: String(r.id),
            consentId: String(r.consentId),
            disclosureId: String(r.disclosureId),
            disclosureVersion: Number(r.disclosureVersion),
            requesterId: String(r.requesterId),
            issuedAt: Number(r.issuedAt),
            expiresAt: Number(r.expiresAt),
            openedAt: r.openedAt == null ? null : Number(r.openedAt),
            acknowledgedAt:
              r.acknowledgedAt == null ? null : Number(r.acknowledgedAt),
            retentionStatus: retained
              ? 'visible-until-selected-date'
              : 'restricted-after-selected-date',
            basis: disclosed ? disclosed.authority?.basis ?? 'worker-consent' : null,
            response: disclosed?.response ?? null,
            corrects: disclosed?.corrects ?? null,
          }
        }),
      ),
      corrections: await Promise.all(
        results[2].results.map(async ({ cipher, ...r }) => ({
          id: String(r.id),
          consentId: String(r.consentId),
          workerId: String(r.workerId),
          createdAt: Number(r.createdAt),
          reason: consents.some(
            (c) =>
              c.id === r.consentId &&
              retentionDeadline(c.retentionUntil) >= Date.now(),
          )
            ? await unseal(
                key,
                JSON.stringify([
                  actor.company,
                  'verification-correction',
                  r.id,
                ]),
                String(cipher),
              )
            : 'Restricted after selected retention date',
        })),
      ),
    }
  }
}
