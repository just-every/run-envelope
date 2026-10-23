import { sessionFence, type Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, text, integer, date, recordKey, unseal } from '../security'
import { requirePayrollProof, stepUpFence } from '../step-up'
import { WorkspaceStore, digest } from '../workspace/store'
import { approved, latest } from '../leave/ledger'
import type { IncomeSource } from '../income-verification/requests'
import { parsePortalRequest, preparePortalResponse, parsePortalConfirmation, parsePortalFollowUp } from './portal'
import type { PortalRequest, PortalRequestInput, PortalConfirmationInput, PortalFollowUpInput, PortalResponseInput } from './portal-types'
import { ClaimLifecycle, claimObject, claimInstant, reviewed, hexDigest, escalation, exactVersion, human, representativeSql, representativeArgs, artifacts, retainedArtifact, willowEvidence } from './lifecycle'
import type { ClaimData, ClaimMandate, ClaimSource, ClaimSignature } from './types'

export class ClaimsRecords {
  lifecycle: ClaimLifecycle
  constructor(public store: WorkspaceStore) { this.lifecycle = new ClaimLifecycle(store) }
  async list(actor: Actor) { return latest(await this.lifecycle.history(actor)) }
  async details(actor: Actor, id: string) { return this.lifecycle.details(actor, id) }
  async history(actor: Actor, id: string) { return this.lifecycle.history(actor, id) }
  async importRequest(actor: Actor, input: Input) {
    human(actor)
    const request = parsePortalRequest(claimObject(input.request) as unknown as PortalRequestInput), company = await this.lifecycle.company(actor)
    if (request.employerEin !== company.ein) throw new PayrollError('claim_employer_ein_mismatch', 403)
    const files = await artifacts([], input.artifacts)
    retainedArtifact({ artifacts: files }, request.sourceSha256)
    const id = 'claim-' + (await digest(request.requestIdentity)).slice(0, 48), requestDigest = await digest(JSON.stringify(request))
    const rows = latest(await this.lifecycle.history(actor)), prior = rows.find(r => r.id === id)
    if (prior) {
      if (prior.data.requestDigest !== requestDigest) throw new PayrollError('claim_request_identity_conflict', 409)
      return { id, kind: 'ui-claim' as const, version: prior.version, replayed: true }
    }
    const representative = await this.lifecycle.representative(actor, text(input.representativeId)), escalationAt = claimInstant(input.escalationAt)
    if (Date.parse(escalationAt) >= Date.parse(request.deadlineAt)) throw new PayrollError('escalation_must_precede_claim_deadline')
    const data: ClaimData = { artifacts: files, request, requestDigest, representative, escalationAt, payroll: [], disputed: false, missingFacts: [], holds: ['Match the worker and retain reviewed payroll, separation facts and employer mandate.'], answers: [], independentlyVerifiedAgencyAcceptance: false, confirmations: [], followUps: [], escalations: [], status: 'awaiting-evidence' }
    data.escalations.push(this.responseEscalation(data, 'The employer representative owns the missing evidence before the response deadline.'))
    try { return await this.lifecycle.append(actor, id, 0, data, 'claim.request.imported') } catch (error) {
      if (!(error instanceof PayrollError) || error.code !== 'claim_source_or_authority_changed') throw error
      const concurrent = latest(await this.lifecycle.history(actor)).find(r => r.id === id)
      if (concurrent?.data.requestDigest === requestDigest) return { id, kind: 'ui-claim' as const, version: concurrent.version, replayed: true }
      throw error
    }
  }
  async evidence(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id); exactVersion(row, input)
    if (row.data.handoff) throw new PayrollError('claim_already_handed_to_portal', 409)
    const data: ClaimData = { ...row.data, artifacts: await artifacts(row.data.artifacts, input.artifacts), signature: undefined, portalReview: undefined, packet: undefined, responseDigest: undefined, answers: [] }
    if (input.representativeId) data.representative = await this.lifecycle.representative(actor, text(input.representativeId))
    if (input.personId) {
      const person = await this.store.records.person(actor, text(input.personId)), f = this.lifecycle.scope(actor)
      const ssn = await this.store.records.statement(`SELECT cipher,version FROM env_private_records WHERE company_id=? AND person_id=? AND kind='ssn' AND ${f.sql}`, [actor.company, person.id, ...f.args]).first<{ cipher: string; version: number }>()
      if (!ssn) throw new PayrollError('native_worker_identifier_required', 409)
      const value = await unseal(await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY), JSON.stringify([actor.company, person.id, 'ssn']), ssn.cipher)
      if (value.replace(/\D/g, '') !== data.request.claimantIdentifier.replace(/\D/g, '')) throw new PayrollError('claim_worker_identifier_mismatch', 403)
      if (data.worker && data.worker.id !== person.id) { data.payroll = []; data.willow = undefined }
      data.worker = { ...person, ssnVersion: ssn.version }
    }
    if (input.payroll !== undefined) {
      if (!data.worker || !Array.isArray(input.payroll) || input.payroll.length > 24) throw new PayrollError('native_claim_payroll_required')
      data.payroll = await Promise.all(input.payroll.map(async value => {
        const pin = claimObject(value), kind = text(pin.kind), sourceId = text(pin.id), version = integer(pin.version)
        if (kind === 'income-source') {
          const source = await this.store.find<IncomeSource>(actor, kind, sourceId, data.worker!.id, true)
          approved(source)
          if (source.version !== version) throw new PayrollError('claim_payroll_source_changed', 409)
          return { kind, id: source.id, version, sourceRef: source.data.sourceRef, from: source.data.from, through: source.data.through, grossCents: source.data.grossCents } as ClaimSource
        }
        throw new PayrollError('reviewed_claim_payroll_history_required')
      }))
      if (new Set(data.payroll.map(p => p.kind + ':' + p.id)).size !== data.payroll.length || data.payroll.some(p => data.payroll.some(q => q.id !== p.id && q.from <= p.through && q.through >= p.from))) throw new PayrollError('overlapping_claim_payroll_sources', 409)
    }
    if (input.willow) {
      if (!reviewed(input.willowReviewed) || !data.worker) throw new PayrollError('human_willow_evidence_review_required', 409)
      data.willow = willowEvidence(actor, data, claimObject(input.willow))
      const sourceKey = await digest(JSON.stringify(['willow', data.willow.sourcePersonId])), f = this.lifecycle.scope(actor)
      const link = await this.store.records.statement(`SELECT 1 FROM env_hris_people WHERE company_id=? AND person_id=? AND source_key=? AND ${f.sql}`, [actor.company, data.worker.id, sourceKey, ...f.args]).first()
      if (!link) throw new PayrollError('claim_willow_worker_mapping_mismatch', 403)
    }
    if (input.mandate) {
      if (!reviewed(input.mandateReviewed)) throw new PayrollError('human_employer_mandate_review_required', 409)
      const m = claimObject(input.mandate)
      const mandate: ClaimMandate = { artifactId: text(m.artifactId), sourceRef: text(m.sourceRef, 500), sourceSha256: hexDigest(m.sourceSha256), sourceVersion: integer(m.sourceVersion), employerEin: text(m.employerEin), agency: text(m.agency), state: text(m.state), representativeId: text(m.representativeId), effectiveFrom: date(m.effectiveFrom), effectiveThrough: date(m.effectiveThrough), scope: 'unemployment-claim-response', reviewedBy: actor.session.operator.id, reviewedAt: new Date().toISOString() }
      if (m.scope !== mandate.scope || mandate.employerEin !== data.request.employerEin || mandate.agency !== data.request.agency || mandate.state !== data.request.state || mandate.representativeId !== data.representative.id || mandate.effectiveFrom > mandate.effectiveThrough) throw new PayrollError('claim_mandate_scope_mismatch', 403)
      if (retainedArtifact(data, mandate.sourceSha256).id !== mandate.artifactId) throw new PayrollError('claim_mandate_artifact_mismatch', 409)
      data.mandate = mandate
    }
    if (row.data.disputed && !reviewed(input.disputed)) {
      const resolution=data.artifacts.find(a=>a.id===input.disputeResolutionRef)
      if(!resolution)throw new PayrollError('retained_dispute_resolution_required',409)
      data.disputeResolution={artifactId:resolution.id,reviewedBy:actor.session.operator.id,reviewedAt:new Date().toISOString()}
    }
    data.disputed = reviewed(input.disputed)
    data.missingFacts = Array.isArray(input.missingFacts) ? input.missingFacts.map(v => text(v, 500)).slice(0, 20) : []
    data.holds = this.holds(data)
    data.status = data.holds.length ? 'held' : 'ready-for-preparation'
    if (data.holds.length) data.escalations = [...data.escalations, this.responseEscalation(data, data.holds.join(' '))]
    return this.lifecycle.append(actor, id, row.version, data, 'claim.evidence.reviewed', { sql: representativeSql, args: representativeArgs(actor, data.representative) })
  }
  holds(data: ClaimData) {
    const holds = [...data.missingFacts], today = new Date().toISOString().slice(0, 10)
    if (!data.worker) holds.push('Match the request to the retained native worker identifier.')
    if (!data.payroll.length) holds.push('Retain and review payroll history for this worker.')
    if (data.request.exchange === 'separation' && !data.willow) holds.push('Retain and review the actual Willow separation export and completion audit.')
    if (!data.mandate || data.mandate.representativeId !== data.representative.id || data.mandate.effectiveFrom > today || data.mandate.effectiveThrough < today) holds.push('A reviewed effective employer mandate must name this representative.')
    if (data.request.claimantStatedReason && data.willow && data.request.claimantStatedReason !== data.willow.portalReason) holds.push('The agency assertion and reviewed employer separation category conflict; the named representative must resolve the dispute.')
    if (data.disputed) holds.push('A disputed assertion requires the named employer representative; no legal determination is inferred.')
    return holds
  }
  private responseRequest(data: ClaimData): PortalRequest {
    const followUp = data.activeFollowUp
    return followUp ? { ...data.request, dueOn: followUp.dueOn, deadlineAt: followUp.deadlineAt,
      timeZone: followUp.timeZone, deadlineBasis: followUp.deadlineBasis ?? 'internal-cutoff-on-agency-due-date' } : data.request
  }
  private responseEscalation(data: ClaimData, reason: string) {
    const item = escalation(data, reason), deadlineAt = this.responseRequest(data).deadlineAt
    return { ...item, deadlineAt, beforeDeadline: item.recordedAt < Date.parse(deadlineAt) }
  }
  async responseInput(actor: Actor, data: ClaimData): Promise<PortalResponseInput> {
    if (!data.worker || !data.preparer) throw new PayrollError('claim_response_inputs_required', 409)
    const company = await this.lifecycle.company(actor)
    return { request: this.responseRequest(data), followUp: data.activeFollowUp, company: { ...company, stateEmployerId: data.request.stateEmployerId }, worker: { personId: data.worker.id, name: data.worker.name }, payrollEvidence: data.payroll, willowFacts: data.willow, answers: data.answers, preparer: data.preparer, attachments: data.attachments }
  }
  async prepare(actor: Actor, id: string, input: Input) {
    const row = await this.details(actor, id); exactVersion(row, input)
    if (row.data.handoff) throw new PayrollError('claim_already_handed_to_portal', 409)
    const data: ClaimData = { ...row.data, signature: undefined, portalReview: undefined, packet: undefined, responseDigest: undefined }
    data.holds = this.holds(data)
    if (data.holds.length) {
      data.status = 'held'; data.escalations = [...data.escalations, this.responseEscalation(data, data.holds.join(' '))]
      return this.lifecycle.append(actor, id, row.version, data, 'claim.response.held')
    }
    if (!Array.isArray(input.answers)) throw new PayrollError('cited_claim_answers_required')
    data.answers = input.answers as unknown as ClaimData['answers']
    data.preparer = claimObject(input.preparer) as unknown as ClaimData['preparer']
    data.attachments = input.attachments === undefined ? [] : input.attachments as ClaimData['attachments']
    if (!Array.isArray(data.attachments)) throw new PayrollError('invalid_claim_attachments')
    for (const attachment of data.attachments) {
      const original = retainedArtifact(data, attachment.sha256)
      if (attachment.id !== original.id || attachment.bytes !== original.bytes) throw new PayrollError('retained_attachment_required', 409)
    }
    data.packet = await preparePortalResponse(await this.responseInput(actor, data)); data.responseDigest = data.packet.responseDigest; data.status = 'ready-for-review'
    return this.lifecycle.append(actor, id, row.version, data, 'claim.response.prepared', { sql: representativeSql, args: representativeArgs(actor, data.representative) })
  }
  async review(actor: Actor, id: string) { return this.lifecycle.review(actor, await this.details(actor, id)) }
  async sign(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id); exactVersion(row, input)
    const data = { ...row.data }, proof = stepUpFence(actor)
    if (this.holds(data).length || !row.sourcesCurrent || !data.packet || data.handoff || input.responseDigest !== data.responseDigest || actor.session.operator.id !== data.representative.id) throw new PayrollError('exact_claim_representative_review_required', 409)
    await requirePayrollProof(this.store.records.env, actor)
    const signature = { actorId: actor.session.operator.id, name: actor.session.operator.displayName, operatorVersion: actor.session.operator.version, grantVersion: actor.grant.version, sessionId: actor.session.id, responseDigest: data.responseDigest!, signedAt: Date.now(), statement: text(input.statement, 1000) }
    data.packet = await preparePortalResponse({ ...await this.responseInput(actor, data), approvedSignature: { signerId: signature.actorId, signerName: signature.name, signedAt: new Date(signature.signedAt).toISOString(), responseDigest: signature.responseDigest, statement: signature.statement } })
    data.signature = signature; data.portalReview = undefined; data.status = 'signed'
    const tokenHash = await digest(text(input.reviewToken, 100))
    return this.lifecycle.append(actor, id, row.version, data, 'claim.response.signed', { sql: `${proof.sql} AND ${representativeSql} AND EXISTS(SELECT 1 FROM env_workspace_reviews WHERE token_hash=? AND company_id=? AND kind='ui-claim' AND object_id=? AND version=? AND session_id=? AND operator_id=? AND grant_version=? AND expires_at>?)`, args: [...proof.args, ...representativeArgs(actor, data.representative), tokenHash, actor.company, id, row.version, actor.session.id, actor.session.operator.id, actor.grant.version, Date.now()] })
  }
  private signatureAuthority(actor: Actor, data: ClaimData, responseDigest: unknown): ClaimSignature {
    const signature = data.signature
    if (!signature || !data.packet?.signature || !data.responseDigest ||
      signature.actorId !== actor.session.operator.id || data.representative.id !== actor.session.operator.id ||
      signature.operatorVersion !== actor.session.operator.version || signature.grantVersion !== actor.grant.version ||
      signature.responseDigest !== responseDigest || signature.responseDigest !== data.responseDigest ||
      data.packet.responseDigest !== signature.responseDigest || data.packet.signature.responseDigest !== signature.responseDigest ||
      data.packet.signature.signerId !== signature.actorId)
      throw new PayrollError('current_exact_claim_signature_required', 409)
    return signature
  }
  async portalReview(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id); exactVersion(row, input)
    if (row.data.handoff) throw new PayrollError('claim_already_handed_to_portal', 409)
    const signature = this.signatureAuthority(actor, row.data, input.responseDigest)
    if (!reviewed(input.matchesReviewedResponse) || this.holds(row.data).length || !row.sourcesCurrent)
      throw new PayrollError('exact_portal_response_review_required', 409)
    await requirePayrollProof(this.store.records.env, actor)
    const originals = await artifacts([], input.artifacts), artifactId = text(input.portalResponseArtifactId)
    const original = originals.find(file => file.id === artifactId)
    if (!original) throw new PayrollError('original_portal_view_response_required', 409)
    const data: ClaimData = { ...row.data, artifacts: await artifacts(row.data.artifacts, originals),
      portalReview: { artifactId: original.id, sourceSha256: original.sha256, responseDigest: signature.responseDigest,
        reviewedBy: actor.session.operator.id, reviewedAt: new Date().toISOString() } }
    const proof = stepUpFence(actor), signedSession = sessionFence({ ...actor.session, id: signature.sessionId })
    return this.lifecycle.append(actor, id, row.version, data, 'claim.portal-response.reviewed', {
      sql: `${proof.sql} AND ${representativeSql} AND ${signedSession.sql}`,
      args: [...proof.args, ...representativeArgs(actor, data.representative), ...signedSession.args],
    })
  }
  async handoff(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id)
    const data = { ...row.data }
    if (data.handoff) {
      if (input.responseDigest !== data.handoff.responseDigest) throw new PayrollError('claim_handoff_identity_conflict', 409)
      return { id, kind: 'ui-claim' as const, version: row.version, replayed: true }
    }
    exactVersion(row, input)
    const signature = this.signatureAuthority(actor, data, input.responseDigest), portalReview = data.portalReview
    if (this.holds(data).length || !row.sourcesCurrent) throw new PayrollError('current_exact_claim_signature_required', 409)
    const original = data.artifacts.find(file => file.id === portalReview?.artifactId)
    if (!portalReview || portalReview.responseDigest !== signature.responseDigest || portalReview.reviewedBy !== signature.actorId ||
      !original || original.sha256 !== portalReview.sourceSha256)
      throw new PayrollError('matching_original_portal_response_review_required', 409)
    const handoff = { id: crypto.randomUUID(), responseDigest: signature.responseDigest, recordedBy: actor.session.operator.id, recordedAt: Date.now(), portalUrl: data.request.portalUrl, portalResponseArtifactId: original.id, portalResponseSha256: original.sha256, status: 'human-portal-handoff' as const, remoteSubmission: 'unconfirmed' as const }
    data.handoff = handoff; data.status = 'human-portal-handoff'
    const signedSession = sessionFence({ ...actor.session, id: signature.sessionId })
    const extra = { sql: `${representativeSql} AND ${signedSession.sql} AND NOT EXISTS(SELECT 1 FROM env_workspace_versions sent WHERE sent.company_id=? AND sent.kind='ui-claim' AND sent.object_id=? AND sent.version>?)`, args: [...representativeArgs(actor, data.representative), ...signedSession.args, actor.company, id, row.version] }
    return this.lifecycle.append(actor, id, row.version, data, 'claim.portal.handoff', extra)
  }
  async confirmation(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id), data: ClaimData = { ...row.data, artifacts: await artifacts(row.data.artifacts, input.artifacts) }
    if (!data.handoff || !data.packet) throw new PayrollError('claim_portal_handoff_required', 409)
    const raw = { ...claimObject(input.confirmation) }; delete raw.evidenceReview
    const original = retainedArtifact(data, hexDigest(raw.sourceSha256))
    if (reviewed(input.reviewEvidence)) raw.evidenceReview = { reviewedBy: actor.session.operator.id, reviewedAt: new Date().toISOString(), artifactId: original.id, artifactSha256: original.sha256 }
    if (data.activeFollowUp && Date.parse(String(raw.submittedAt)) < Date.parse(data.activeFollowUp.receivedAt)) throw new PayrollError('claim_confirmation_predates_followup', 409)
    const confirmation = parsePortalConfirmation(raw as unknown as PortalConfirmationInput, this.responseRequest(data), data.packet)
    const existing = data.confirmations.find(c => c.confirmationNumber === confirmation.confirmationNumber)
    if (existing) {
      if (existing.responseDigest !== confirmation.responseDigest || existing.sourceSha256 !== confirmation.sourceSha256) throw new PayrollError('claim_confirmation_identity_conflict', 409)
      if (existing.evidenceStatus === confirmation.evidenceStatus || confirmation.evidenceStatus === 'reported-unverified') return { id, kind: 'ui-claim' as const, version: row.version, replayed: true }
    }
    exactVersion(row, input)
    data.confirmations = existing ? data.confirmations.map(c => c === existing ? confirmation : c) : [...data.confirmations, confirmation]; data.status = confirmation.evidenceStatus === 'agency-confirmation-reviewed' ? 'agency-confirmation-reviewed' : 'confirmation-reported'
    if (data.activeFollowUp && confirmation.evidenceStatus === 'agency-confirmation-reviewed') {
      const answered = { ...data.activeFollowUp, status: 'response-confirmed' as const, responseDigest: confirmation.responseDigest, confirmationNumber: confirmation.confirmationNumber }
      data.activeFollowUp = answered
      data.followUps = data.followUps.map(f => f.agencyReference === answered.agencyReference && f.sourceSha256 === answered.sourceSha256 ? answered : f)
    }
    if (data.followUps.some(f => f.status === 'needs-human-response' && f.agencyReference !== data.activeFollowUp?.agencyReference)) data.status = 'follow-up-required'
    return this.lifecycle.append(actor, id, row.version, data, 'claim.portal.confirmation-recorded', undefined, true)
  }
  async beginFollowUp(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id); exactVersion(row, input)
    const agencyReference = text(input.agencyReference), followUp = row.data.followUps.find(f => f.agencyReference === agencyReference)
    if (!followUp || followUp.requestIdentity !== row.data.request.requestIdentity) throw new PayrollError('retained_claim_followup_required', 409)
    if (followUp.status === 'response-confirmed' || (row.data.activeFollowUp && row.data.activeFollowUp.status !== 'response-confirmed')) throw new PayrollError('claim_followup_already_active_or_answered', 409)
    if (!row.data.handoff || !row.data.responseDigest) throw new PayrollError('claim_prior_portal_handoff_required', 409)
    retainedArtifact(row.data, followUp.sourceSha256)
    const representative = await this.lifecycle.representative(actor, followUp.ownerId)
    if (representative.id !== actor.session.operator.id) throw new PayrollError('named_employer_representative_required', 403)
    const previous = { version: row.version, responseDigest: row.data.responseDigest, ...(row.data.activeFollowUp ? { agencyReference: row.data.activeFollowUp.agencyReference } : {}) }
    const data: ClaimData = { ...row.data, representative, escalationAt: new Date().toISOString(), activeFollowUp: { ...followUp },
      previousResponses: [...(row.data.previousResponses ?? []), previous], packet: undefined, responseDigest: undefined,
      signature: undefined, portalReview: undefined, handoff: undefined, confirmations: [], answers: [], preparer: undefined, attachments: [], status: 'ready-for-preparation' }
    data.holds = this.holds(data)
    if (!row.sourcesCurrent) data.holds.push('Current payroll and worker evidence must be reviewed before preparing this follow-up response.')
    if (data.holds.length) data.status = 'held'
    data.escalations = [...data.escalations, { ...this.responseEscalation(data, 'Prepare a cited response to the retained agency follow-up.'), deadlineAt: followUp.deadlineAt, beforeDeadline: Date.now() < Date.parse(followUp.deadlineAt) }]
    return this.lifecycle.append(actor, id, row.version, data, 'claim.follow-up.response-started', { sql: representativeSql, args: representativeArgs(actor, representative) }, true)
  }
  async followUp(actor: Actor, id: string, input: Input) {
    human(actor)
    const row = await this.details(actor, id), data: ClaimData = { ...row.data, artifacts: await artifacts(row.data.artifacts, input.artifacts) }
    if (!data.handoff && !data.previousResponses?.length) throw new PayrollError('claim_portal_handoff_required', 409)
    const followUp = parsePortalFollowUp(claimObject(input.followUp) as unknown as PortalFollowUpInput, data.request)
    retainedArtifact(data, followUp.sourceSha256)
    const owner = await this.lifecycle.representative(actor, followUp.ownerId)
    const previous = data.followUps.find(f => f.agencyReference === followUp.agencyReference)
    if (previous) {
      if (previous.sourceSha256 !== followUp.sourceSha256) throw new PayrollError('claim_followup_identity_conflict', 409)
      return { id, kind: 'ui-claim' as const, version: row.version, replayed: true }
    }
    exactVersion(row, input)
    data.followUps = [...data.followUps, followUp]; data.status = 'follow-up-required'
    data.escalations = [...data.escalations, { ...escalation({ ...data, representative: owner }, 'An agency request for more information requires this employer representative.'), deadlineAt: followUp.deadlineAt, beforeDeadline: Date.now() < Date.parse(followUp.deadlineAt) }]
    return this.lifecycle.append(actor, id, row.version, data, 'claim.agency.follow-up-recorded', undefined, true)
  }
  async escalate(actor: Actor, id: string, input: Input) {
    const row = await this.details(actor, id); exactVersion(row, input)
    const data = { ...row.data, escalations: [...row.data.escalations, this.responseEscalation(row.data, text(input.reason, 2000))] }
    return this.lifecycle.append(actor, id, row.version, data, 'claim.representative.escalated', undefined, true)
  }
}
