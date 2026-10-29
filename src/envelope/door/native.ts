import type { Bindings } from '../../auth.server'
import { AgentTools, type AgentGrant } from '../agents'
import { ToolRefusal, type ToolContext, type Principal } from '../../modules/agent-door/index.ts'

export const scopes = (agent: AgentTools) => [...JSON.parse(agent.grant.actions) as string[], 'credentials:rotate']
/** A signed Business identity selects only an explicitly issued native grant.
 * The service still executes its original SQL fences at every effect. */
export async function nativeAgent(env: Bindings, who: Pick<ToolContext, 'agent' | 'person' | 'clientId'>, company?: unknown) {
  const row = await env.DB.prepare(`SELECT g.*,c.secret_expires_at,c.token_hash
    FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id
    WHERE g.sponsor_id=? AND (? IS NULL OR g.company_id=?) AND
    (g.id=? OR EXISTS(SELECT 1 FROM env_business_agent_bindings b
      WHERE b.agent_id=? AND b.grant_id=g.id AND b.sponsor_id=g.sponsor_id))
    ORDER BY g.id LIMIT 1`).bind(who.person.id,company ?? null,company ?? null,who.clientId ?? '',who.agent.id).first<AgentGrant>()
  if (!row) throw new ToolRefusal('native_agent_grant_required')
  const agent = new AgentTools(env,row), fence=agent.fence()
  if (!await env.DB.prepare(`SELECT 1 WHERE ${fence.sql}`).bind(...fence.args).first()) throw new ToolRefusal('native_agent_grant_revoked')
  agent.authenticatedPolicyVersion = (await env.DB.prepare('SELECT version FROM env_agent_class_policy WHERE company_id=?').bind(row.company_id).first<{version:number}>())?.version ?? 0
  return agent
}
export async function currentScopes(env: Bindings, who: Principal) {
  try { return scopes(await nativeAgent(env,who)) } catch { return [] }
}
