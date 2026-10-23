import type { Bindings } from '../auth.server'
import { fence, auditStatement, type Actor } from './access'
import type { Records, Input } from './records'
import type { AgentTools } from './agents'
import { requirePayrollProof, stepUpFence } from './step-up'
import { PayrollError, text, integer, recordKey, seal, unseal } from './security'

/** Fixed destinations and minimum fields; neither notice nor model chooses a URL. */
export const externalFlows = {
  openai: {
    recipient: 'OpenAI', url: 'https://api.openai.com/v1/responses',
    purpose: 'Optional extraction and proposed reply from untrusted tax-notice text',
    fields: ['redacted notice text'], model: 'gpt-4.1-mini',
    custody: 'Owner-provided API credential encrypted in company storage; OpenAI API processing with store:false; provider retention terms apply',
  },
  resend: {
    recipient: 'Resend and the exact human-reviewed email recipient', url: 'https://api.resend.com/emails',
    purpose: 'Deliver only an exact unexpired human-approved tax-notice reply',
    fields: ['approved sender', 'approved recipient', 'approved subject', 'approved redacted reply'],
    reconciliation: 'Optional separate consent: owner-requested lookup of a recorded original email ID at https://api.resend.com/emails/:id; sends only that ID, never resends',
    custody: 'Owner-provided API credential encrypted in company storage; delivery metadata/content held by Resend under owner terms',
  },
} as const
export type ProviderId = keyof typeof externalFlows
export interface Provider {
  id: ProviderId
  enabled: number
  sender: string
  version: number
  secret_cipher: string
  reconcile_consent:number
  change_id:string
}
export function providerId(value: unknown): ProviderId {
  if (value !== 'openai' && value !== 'resend') throw new PayrollError('provider_not_declared')
  return value
}
export const email = (value: unknown) => {
  const v = text(value,254)
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(v))
    throw new PayrollError('invalid_email')
  return v
}
export class Providers {
  constructor(public records: Records) {}
  owner(actor: Actor) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required',403)
  }
  async list(actor: Actor) {
    if (actor.grant.role !== 'owner' && !actor.grant.actions.includes('records:read')) throw new PayrollError('payroll_access_denied',403)
    const f = fence(actor)
    const rows = (await this.records.statement(`SELECT id,enabled,sender,version FROM env_external_providers WHERE company_id=? AND ${f.sql}`, [actor.company,...f.args]).all<{id:ProviderId;enabled:number;sender:string;version:number}>()).results
    return (Object.keys(externalFlows) as ProviderId[]).map(id => ({id,...externalFlows[id],enabled:0,sender:'',version:0,...rows.find(r => r.id===id)}))
  }
  async save(actor: Actor, input: Input) {
    this.owner(actor)
    await requirePayrollProof(this.records.env,actor)
    if(Object.keys(input).some(k=>!['id','version','enabled','consent','secret','sender','reconcileConsent'].includes(k)) || ![true,false,'true','false'].includes(input.enabled as boolean|string)) throw new PayrollError('invalid_provider_input')
    if((input.secret!==undefined && typeof input.secret!=='string') || (input.consent!==undefined && ![true,false,'true','false'].includes(input.consent as boolean|string))) throw new PayrollError('invalid_provider_input')
    const id = providerId(input.id), version = input.version === 0 || input.version === '0' ? 0 : integer(input.version),
      enabled = input.enabled === true || input.enabled === 'true' ? 1 : 0,
      f = fence(actor), proof = stepUpFence(actor), change = crypto.randomUUID()
    const prior = await this.records.statement('SELECT * FROM env_external_providers WHERE company_id=? AND id=?',[actor.company,id]).first<Provider>()
    const key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    const secret = input.secret ? text(input.secret,4096) : null
    if (enabled && !secret && !prior) throw new PayrollError('provider_credential_required')
    const cipher = secret ? await seal(key,JSON.stringify([actor.company,id,'provider-secret']),secret) : (prior?.secret_cipher ?? '')
    const reconcileConsent=id==='resend' && enabled && (input.reconcileConsent===true || input.reconcileConsent==='true') ? 1 : 0
    const sender = id==='resend' && enabled ? email(input.sender===undefined || input.sender==='' ? prior?.sender : input.sender) : ''
    if (enabled && input.consent !== 'true' && input.consent !== true) throw new PayrollError('provider_consent_required')
    const result = await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_external_providers(company_id,id,enabled,secret_cipher,sender,reconcile_consent,version,change_id)
        SELECT ?,?,?,?,?,?,1,? WHERE ${f.sql} AND ${proof.sql} AND COALESCE((SELECT version FROM env_external_providers WHERE company_id=? AND id=?),0)=?
        ON CONFLICT(company_id,id) DO UPDATE SET enabled=excluded.enabled,secret_cipher=excluded.secret_cipher,sender=excluded.sender,reconcile_consent=excluded.reconcile_consent,version=env_external_providers.version+1,change_id=excluded.change_id WHERE env_external_providers.version=? RETURNING version`,
        [actor.company,id,enabled,cipher,sender,reconcileConsent,change,...f.args,...proof.args,actor.company,id,version,version]),
      auditStatement(this.records.env,actor,change,'provider.declared',id,version+1,'EXISTS(SELECT 1 FROM env_external_providers WHERE change_id=?)',[change]),
    ])
    if (!result[0].results.length) throw new PayrollError('provider_or_authority_changed',409)
    return {id,version:version+1,enabled}
  }
}
export async function agentProvider(agent: AgentTools, id: ProviderId, version?: number) {
  const providers: string[] = JSON.parse(agent.grant.providers), models: string[] = JSON.parse(agent.grant.models)
  if (!providers.includes(id) || !JSON.parse(agent.grant.fields).includes('tax') || (id==='openai' && !models.includes(externalFlows.openai.model)))
    throw new PayrollError('agent_provider_denied',403)
  const f = agent.fence()
  const provider = await agent.env.DB.prepare(`SELECT * FROM env_external_providers WHERE company_id=? AND id=? AND enabled=1 ${version===undefined?'':'AND version=?'} AND ${f.sql}`)
    .bind(agent.grant.company_id,id,...(version===undefined?[]:[version]),...f.args).first<Provider>()
  if (!provider) throw new PayrollError('provider_or_authority_changed',403)
  return provider
}
export async function providerSecret(env: Bindings, company: string, provider: Provider) {
  return unseal(await recordKey(env.ENVELOPE_RECORD_KEY),JSON.stringify([company,provider.id,'provider-secret']),provider.secret_cipher)
}
/** All configured company credentials are redacted, including a different or disabled provider's key. */
export async function providerRedactions(env:Bindings,company:string) {
  const providers=(await env.DB.prepare('SELECT * FROM env_external_providers WHERE company_id=?').bind(company).all<Provider>()).results
  return Promise.all(providers.filter(p=>p.secret_cipher).map(p=>providerSecret(env,company,p)))
}
// These two flows never need identifiers/accounts. Minimize before any request,
// and again before storing or displaying model output. No payroll record is sent.
export function redact(value: string, secrets: string[] = []) {
  let v = value.normalize('NFKC').replace(/[\u200b-\u200d\u2060\ufeff]/g,'')
  for (const secret of secrets.filter(Boolean)) v = v.split(secret).join('[redacted credential]')
  return v.replace(/\b[A-Za-z0-9_-]{40,}\b/g,'[redacted credential]').replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g,'[redacted SSN]')
    .replace(/\b\d(?:[ -]?\d){7,}\b/g,match => /^\d{4}-\d{2}-\d{2}$/.test(match) ? match : '[redacted identifier]')
    .replace(/\b(?:SSN|social security|bank(?: account)?|routing|account(?: number)?)\s*[:#=]\s*[A-Za-z0-9][A-Za-z0-9 -]{2,40}/gi,'[redacted sensitive field]')
}
