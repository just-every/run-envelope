import type { Actor } from './access'
import type { Input } from './records'
import { PayrollError, text } from './security'
import { WorkerPrivacy } from './worker-privacy'
import { WorkspaceStore, choice, revision } from './workspace/store'

interface ProviderRequest {
  requestId: string
  provider: string
  reference: string
  status: string
  evidence: string
  provenance: 'owner-attested'
  externalDeletionVerified: false
}

/** Private manual follow-up. Recording a receipt never performs destruction. */
export class ProviderPrivacy {
  constructor(public store: WorkspaceStore) {}
  async read(actor: Actor) {
    new WorkerPrivacy(this.store.records).owner(actor)
    return this.store.list<ProviderRequest>(actor, 'provider-deletion-request')
  }
  async save(actor: Actor, input: Input, id: string = crypto.randomUUID()) {
    new WorkerPrivacy(this.store.records).owner(actor)
    if (input.consent !== true) throw new PayrollError('consent_required')
    const rows = await this.read(actor), prior = rows.find(r => r.id === id)
    const expected = revision(input.version)
    if (expected !== (prior?.version ?? 0)) throw new PayrollError('provider_request_changed', 409)
    const requestId = prior?.data.requestId ?? text(input.requestId)
    if (!await this.store.records.statement('SELECT 1 FROM env_privacy_requests WHERE company_id=? AND id=?', [actor.company, requestId]).first())
      throw new PayrollError('local_request_required', 409)
    const status = choice(input.status, ['requested', 'submitted', 'unknown', 'rejected', 'confirmation-reported'])
    const transitions: Record<string, string[]> = {
      requested: ['submitted'], submitted: ['unknown', 'rejected', 'confirmation-reported'],
      unknown: ['rejected', 'confirmation-reported'], rejected: ['submitted'], 'confirmation-reported': [],
    }
    if ((!prior && status !== 'requested') || (prior && !transitions[prior.data.status].includes(status)))
      throw new PayrollError('provider_request_transition_refused', 409)
    const data: ProviderRequest = {
      requestId, provider: prior?.data.provider ?? choice(input.provider, ['openai', 'resend', 'willow', 'bamboohr', 'hibob', 'rippling', 'gauge', 'plinth', 'glove', 'mallet', 'strap', 'orbit']),
      reference: prior?.data.reference ?? text(input.reference, 240), status, evidence: text(input.evidence, 2000),
      provenance: 'owner-attested', externalDeletionVerified: false,
    }
    // No worker identifier joins this separate obligation. Encrypted immutable
    // evidence survives local completion; fresh proof is required per gesture.
    return this.store.append(actor, 'provider-deletion-request', id, expected, data, undefined, false, {freshProof: true})
  }
}
