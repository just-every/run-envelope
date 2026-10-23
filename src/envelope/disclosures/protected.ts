import { sessionFence, fence, auditStatement } from '../access'
import type { Actor } from '../access'
import type { Input } from '../records'
import { text, recordKey, unseal, PayrollError, integer } from '../security'
import { WorkspaceStore, digest, currentSources } from '../workspace/store'
import { currentReviewInputs } from '../workspace/review-inputs'
import {
  bindingFence,
  ownerOnly,
  VerificationRequests,
  type ProtectedDisclosure,
} from '../income-verification/requests'
const disclosureCurrent = `v.kind='disclosure'
 AND v.version=(SELECT MAX(version) FROM env_workspace_versions nv WHERE nv.company_id=v.company_id AND nv.kind=v.kind AND nv.object_id=v.object_id)
 AND ${currentSources('v')} AND ${currentReviewInputs('v')}
 AND EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='approved')
 AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='withdrawn')`
/** No outbound call. A protected response is retrieved by its named native identity. */
export class ProtectedResponses {
  constructor(public store: WorkspaceStore) {}
  async release(actor: Actor, personId: string, id: string, input: Input) {
    ownerOnly(actor)
    const row = await this.store.find<ProtectedDisclosure>(
      actor,
      'disclosure',
      id,
      personId,
      true,
    )
    if (integer(input.version) !== row.version)
      throw new PayrollError('disclosure_version_changed', 409)
    const consent = (
      await new VerificationRequests(this.store).consents(actor, personId)
    ).find((c) => c.id === row.data.consentId)
    if (!consent) throw new PayrollError('current_worker_consent_required', 403)
    const token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await digest(token),
      releaseId = crypto.randomUUID(),
      event = crypto.randomUUID(),
      f = fence(actor)
    const result = await this.store.records.env.DB.batch([
      this.store.records.statement(
        `INSERT INTO env_verification_releases(company_id,id,consent_id,disclosure_id,disclosure_version,token_hash,requester_id,issued_by,issuer_version,issuer_grant_version,issued_at,expires_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql}
      AND EXISTS(SELECT 1 FROM env_workspace_versions v JOIN env_verification_consents c ON c.company_id=v.company_id AND c.id=?
       WHERE v.company_id=? AND v.object_id=? AND v.version=? AND v.person_id=c.person_id AND c.person_id=? AND c.requester_id=?
       AND c.revoked_at IS NULL AND c.expires_at>? AND ${bindingFence('c')} AND ${disclosureCurrent})
      AND NOT EXISTS(SELECT 1 FROM env_verification_releases WHERE company_id=? AND disclosure_id=? AND disclosure_version=?) RETURNING id`,
        [
          actor.company,
          releaseId,
          consent.id,
          row.id,
          row.version,
          hash,
          consent.requesterId,
          actor.session.operator.id,
          actor.session.operator.version,
          actor.grant.version,
          Date.now(),
          consent.expiresAt,
          ...f.args,
          consent.id,
          actor.company,
          row.id,
          row.version,
          personId,
          consent.requesterId,
          Date.now(),
          actor.company,
          row.id,
          row.version,
        ],
      ),
      auditStatement(
        this.store.records.env,
        actor,
        event,
        'verification.response-released',
        releaseId,
        row.version,
        'EXISTS(SELECT 1 FROM env_verification_releases WHERE company_id=? AND id=?)',
        [actor.company, releaseId],
      ),
    ])
    if (!result[0].results.length)
      throw new PayrollError('disclosure_or_consent_changed', 409)
    return {
      id: releaseId,
      disclosureId: row.id,
      version: row.version,
      token,
      requesterId: consent.requesterId,
      expiresAt: consent.expiresAt,
      delivered: false,
    }
  }
  async retrieve(id: string, input: Input, ack = false) {
    const session = this.store.records.session,
      s = sessionFence(session),
      hash = await digest(text(input.token, 100)),
      event = crypto.randomUUID(),
      now = Date.now()
    const where = `EXISTS(SELECT 1 FROM oa_operators issuer JOIN env_grants ig ON ig.operator_id=issuer.id AND ig.company_id=r.company_id WHERE issuer.id=r.issued_by AND issuer.version=r.issuer_version AND issuer.status='active' AND ig.version=r.issuer_grant_version AND ig.role='owner' AND ig.revoked_at IS NULL) AND r.id=? AND r.token_hash=? AND r.requester_id=? AND r.expires_at>? AND c.expires_at>? AND c.revoked_at IS NULL
      AND ${bindingFence('c')} AND ${disclosureCurrent} AND ${s.sql}`
    const args = [id, hash, session.operator.id, now, now, ...s.args]
    // Authorization, audit, receipt and encrypted response selection share one D1 batch.
    const result = await this.store.records.env.DB.batch<
      Record<string, unknown>
    >([
      this.store.records.statement(
        `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
       SELECT ?,r.company_id,?,?,r.id,r.disclosure_version,? FROM env_verification_releases r
       JOIN env_verification_consents c ON c.company_id=r.company_id AND c.id=r.consent_id
       JOIN env_workspace_versions v ON v.company_id=r.company_id AND v.kind='disclosure' AND v.object_id=r.disclosure_id AND v.version=r.disclosure_version
       WHERE ${where}`,
        [
          event,
          session.operator.id,
          ack
            ? 'verification.receipt-acknowledged'
            : 'verification.response-opened',
          now,
          ...args,
        ],
      ),
      this.store.records.statement(
        `UPDATE env_verification_releases SET ${ack ? 'acknowledged_at=COALESCE(acknowledged_at,?)' : 'opened_at=COALESCE(opened_at,?)'} WHERE id=? AND EXISTS(SELECT 1 FROM env_audit WHERE id=? AND target_id=env_verification_releases.id)`,
        [now, id, event],
      ),
      this.store.records.statement(
        `SELECT v.company_id AS company,v.object_id AS disclosureId,v.version,v.cipher FROM env_verification_releases r
       JOIN env_verification_consents c ON c.company_id=r.company_id AND c.id=r.consent_id
       JOIN env_workspace_versions v ON v.company_id=r.company_id AND v.kind='disclosure' AND v.object_id=r.disclosure_id AND v.version=r.disclosure_version
       WHERE ${where} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?)`,
        [...args, event],
      ),
    ])
    const row = result[2].results[0]
    if (!row) throw new PayrollError('protected_response_unavailable', 403)
    if (ack) return { id, acknowledged: true }
    const data = JSON.parse(
      await unseal(
        await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY),
        JSON.stringify([
          row.company,
          'disclosure',
          row.disclosureId,
          row.version,
        ]),
        String(row.cipher),
      ),
    ) as ProtectedDisclosure
    return {
      id,
      disclosureId: row.disclosureId,
      version: row.version,
      response: data.response,
      provenance: data.provenance.map(({ kind, id, version }) => ({
        kind,
        id,
        version,
      })),
      corrects: data.corrects || null,
    }
  }
}
