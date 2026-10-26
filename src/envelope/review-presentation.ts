import { AgentTools } from './agents'
import type { Bindings } from '../auth.server'
import type { Input } from './records'
import { PayrollError, text } from './security'
import { digest } from './workspace/store'

/** A reference link identifies the presenting credential; it grants no human authority. */
export async function presentReview(agent: AgentTools, input: Input) {
  agent.allow('drafts:read',input.companyId)
  if(Object.keys(input).some(k=>!['companyId','runId'].includes(k))) throw new PayrollError('invalid_input')
  if(!JSON.parse(agent.grant.fields).includes('compensation') || !JSON.parse(agent.grant.locations).includes('*'))
    throw new PayrollError('agent_scope_denied',403)
  const runId=text(input.runId), f=agent.fence(), token=crypto.randomUUID()+crypto.randomUUID()
  const result=await agent.env.DB.prepare(`INSERT INTO env_review_presentations(token_hash,company_id,run_id,run_version,credential_id,grant_version,credential_hash,expires_at)
    SELECT ?,company_id,object_id,MAX(version),?,?,?,? FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=? AND ${f.sql}
    HAVING MAX(version) IS NOT NULL RETURNING run_version`).bind(await digest(token),agent.grant.id,agent.grant.version,agent.grant.token_hash,Date.now()+300000,
      agent.grant.company_id,runId,...f.args).first<{run_version:number}>()
  if(!result) throw new PayrollError('review_unavailable',404)
  await agent.log('run.review',runId).run()
  return {runId,version:result.run_version,reviewUrl:agent.env.AUTH_ORIGIN+'/app/envelope/companies/'+encodeURIComponent(agent.grant.company_id)+'/pay-settings/earnings-run/'+encodeURIComponent(runId)+'/review?presentation='+encodeURIComponent(token),approval:'requires-separate-human-proof'}
}
export async function presentationFence(env: Bindings, hash: string, company: string, runId: string, version: number) {
  if(!hash) return {client:'native-envelope',sql:'1',args:[] as unknown[]}
  const row=await env.DB.prepare(`SELECT a.*,c.secret_expires_at,c.token_hash FROM env_review_presentations p
    JOIN env_agent_grants a ON a.id=p.credential_id AND a.version=p.grant_version
    JOIN env_agent_credentials c ON c.id=a.id AND c.token_hash=p.credential_hash
    WHERE p.token_hash=? AND p.company_id=? AND p.run_id=? AND p.run_version=? AND p.expires_at>?`)
    .bind(hash,company,runId,version,Date.now()).first<ConstructorParameters<typeof AgentTools>[1]>()
  if(!row) throw new PayrollError('presenting_client_revoked',403)
  const f=new AgentTools(env,row).fence()
  const result={client:row.id,sql:`${f.sql} AND EXISTS(SELECT 1 FROM env_review_presentations WHERE token_hash=? AND company_id=? AND run_id=? AND run_version=? AND expires_at>unixepoch('subsec')*1000)`,args:[...f.args,hash,company,runId,version]}
  if(!await env.DB.prepare(`SELECT 1 AS current WHERE ${result.sql}`).bind(...result.args).first())
    throw new PayrollError('presenting_client_revoked',403)
  return result
}
