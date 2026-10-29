import type { Bindings } from '../../auth.server'
import { AgentTools, type AgentGrant } from '../agents'
import { ToolRefusal, type ToolContext, type Principal } from '../../modules/agent-door/index.ts'
import { digest } from '../workspace/store'
const admissionPrefix='native-admission/'
/** An irreversible, non-authorizing fingerprint of actual native admission.
 * Keeping it among the retained scopes fences delayed execution without changing
 * the client's durable identity or its idempotency namespace. */
async function admission(agent:AgentTools) {
  return admissionPrefix+agent.grant.id+'/'+await digest(JSON.stringify([agent.grant.token_hash,agent.grant.version,agent.grant.sponsor_grant_version,agent.grant.sponsor_operator_version,agent.authenticatedPolicyVersion]))
}
export async function scopes(agent: AgentTools) {
  return [...JSON.parse(agent.grant.actions) as string[], 'credentials:rotate',await admission(agent)]
}
/** Business credentials require an explicit native binding. A local client must
 * be the actual grant identity, with its original retained admission fingerprint. */
export async function nativeAgent(env: Bindings, who: Pick<ToolContext, 'agent' | 'person' | 'clientId' | 'consent' | 'scopes'>, company?: unknown) {
  const local=!who.consent && who.agent.id===who.clientId
  const row = await env.DB.prepare(`SELECT g.*,c.secret_expires_at,c.token_hash
    FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id
    WHERE g.sponsor_id=? AND (? IS NULL OR g.company_id=?) AND
    ((?=1 AND g.id=?) OR (?=0 AND EXISTS(SELECT 1 FROM env_business_agent_bindings b
      WHERE b.agent_id=? AND b.grant_id=g.id AND b.sponsor_id=g.sponsor_id)))
    ORDER BY g.created_at DESC,g.id LIMIT 1`).bind(who.person.id,company ?? null,company ?? null,local?1:0,who.clientId ?? '',local?1:0,who.agent.id).first<AgentGrant>()
  if (!row) throw new ToolRefusal('native_agent_grant_required')
  const agent = new AgentTools(env,row), fence=agent.fence()
  if (!await env.DB.prepare(`SELECT 1 WHERE ${fence.sql}`).bind(...fence.args).first()) throw new ToolRefusal('native_agent_grant_revoked')
  agent.authenticatedPolicyVersion = (await env.DB.prepare('SELECT version FROM env_agent_class_policy WHERE company_id=?').bind(row.company_id).first<{version:number}>())?.version ?? 0
  if(local && !who.scopes.includes(await admission(agent)))throw new ToolRefusal('native_agent_admission_changed','native_agent_admission_changed',{native_status:403})
  return agent
}
export async function currentScopes(env: Bindings, who: Principal) {
  try { return await scopes(await nativeAgent(env,who)) } catch { return [] }
}
