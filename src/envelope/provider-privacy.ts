import type { Actor } from './access'
import type { Input } from './records'
import { PayrollError, text } from './security'
import { WorkerPrivacy } from './worker-privacy'
import { WorkspaceStore, choice, revision } from './workspace/store'

const manualChannels = {
  'openai-privacy-portal': {provider: 'openai', destination: 'https://privacy.openai.com/'},
  'resend-privacy-support': {provider: 'resend', destination: 'mailto:support@resend.com'},
} as const

interface ProviderRequest {
  requestId: string
  provider: string
  reference: string
  status: string
  evidence: string
  provenance: 'owner-attested'
  externalDeletionVerified: false
  scope?: { fingerprint: string; records: string[] }
  channel?: keyof typeof manualChannels
}

/** Private manual follow-up. Recording a receipt never performs destruction. */
export class ProviderPrivacy {
  constructor(public store: WorkspaceStore) {}
  async read(actor: Actor) {
    new WorkerPrivacy(this.store.records).owner(actor)
    return this.store.list<ProviderRequest>(actor, 'provider-deletion-request')
  }
  async packet(actor: Actor, id: string) {
    const row = (await this.read(actor)).find(row => row.id === id)
    if (!row) throw new PayrollError('provider_request_unavailable', 404)
    const channel = row.data.channel && manualChannels[row.data.channel]
    if (!row.data.scope || !channel || channel.provider !== row.data.provider)
      throw new PayrollError('provider_request_scope_required', 409)
    return {
      id, version: row.version, provider: row.data.provider, reference: row.data.reference,
      scope: row.data.scope, channel: row.data.channel,
      officialChannel: channel.destination,
      transport: 'owner-manual', provenance: 'owner-attested',
      requestSent: false, externalDeletionVerified: false,
      boundary: 'A prepared request is not submission, deletion authority or completion. The provider must resolve its retention obligations. Downloaded copies and filed agency records remain outside local recall.',
    }
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
    for (const field of ['requestId', 'provider', 'reference', 'channel'] as const) {
      if (prior && input[field] !== undefined && input[field] !== prior.data[field])
        throw new PayrollError('provider_request_scope_changed', 409)
    }
    let scope = prior?.data.scope
    let channel = prior?.data.channel
    let condition
    if (!prior && (input.records !== undefined || input.fingerprint !== undefined || input.channel !== undefined)) {
      // Pin only opaque inventory keys. The separately retained obligation must
      // survive erasure without carrying the worker or the erased field values.
      const request = await this.store.records.statement('SELECT person_id FROM env_privacy_requests WHERE company_id=? AND id=? AND status=\'held\'', [actor.company, requestId]).first<{person_id: string}>()
      if (!request?.person_id) throw new PayrollError('held_local_request_required', 409)
      const inventory = await new WorkerPrivacy(this.store.records).scope(actor, request.person_id)
      if (input.fingerprint !== inventory.fingerprint) throw new PayrollError('privacy_scope_changed', 409)
      if (!Array.isArray(input.records) || !input.records.length || input.records.some(record => typeof record !== 'string' || !inventory.entries.some(row => row.id === record && row.table !== 'env_people')) || new Set(input.records).size !== input.records.length)
        throw new PayrollError('provider_request_scope_required', 409)
      const selectedChannel = typeof input.channel === 'string' && Object.hasOwn(manualChannels, input.channel) ? input.channel as keyof typeof manualChannels : undefined
      if (!selectedChannel || input.provider !== manualChannels[selectedChannel].provider)
        throw new PayrollError('provider_request_channel_unavailable', 409)
      scope = {fingerprint: inventory.fingerprint, records: [...input.records as string[]].sort()}
      channel = selectedChannel
      condition = {
        sql: 'COALESCE((SELECT version FROM env_privacy_epochs WHERE company_id=?),0)=? AND EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND id=? AND status=\'held\')',
        args: [actor.company, inventory.epoch, actor.company, requestId],
      }
    } else if (input.records !== undefined || input.fingerprint !== undefined) {
      throw new PayrollError('provider_request_scope_changed', 409)
    }
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
      provenance: 'owner-attested', externalDeletionVerified: false, scope, channel,
    }
    // No worker identifier joins this separate obligation. Encrypted immutable
    // evidence survives local completion; fresh proof is required per gesture.
    return this.store.append(actor, 'provider-deletion-request', id, expected, data, undefined, false, {freshProof: true, condition})
  }
}
