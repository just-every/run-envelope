import type { Bindings } from '../../auth.server'
import { ToolRefusal, type ToolContext, type ApprovalSummary, type NativeTarget } from '../../modules/agent-door/index.ts'
import { recordKey, unseal } from '../security'
import { replyBody } from '../notices'
import { nativeAgent } from './native'
import type { AgentTools } from '../agents'
import { readBonus, bonusReport } from '../bonus-runs'
import { digest } from '../workspace/store'
import { PayrollError } from '../security'

/** Read the actual scoped native target, never accept a caller's risk flags. */
export async function effect(env: Bindings, name: string, args: Record<string,unknown>, ctx: ToolContext): Promise<{target:NativeTarget;revision:string|number;summary:ApprovalSummary} | null> {
  const agent=await nativeAgent(env,ctx,args.companyId),f=agent.fence()
  if (name==='credentials.rotate') return {target:{kind:'agent-grant',id:agent.grant.id},revision:agent.grant.version,summary:{target:{id:agent.grant.id,name:agent.grant.name},items:['Replace only this native credential; retain its scope and expiry.']}}
  if (name==='draft.prepare' || name==='bonus.prepare') {
    agent.allow('drafts:prepare',args.companyId)
    const l=agent.location('location_id')
    const row=await env.DB.prepare(`SELECT id,name,version FROM env_people WHERE company_id=? AND id=? AND ${l.sql} AND ${f.sql}`).bind(args.companyId,args.personId,...l.args,...f.args).first<{id:string;name:string;version:number}>()
    if(!row) throw new ToolRefusal('record_unavailable')
    return {target:{kind:'worker',id:row.id},revision:row.version,summary:{target:{id:row.id,name:row.name},items:[name==='bonus.prepare'?'Uncalculated bonus preparation':'Uncalculated hourly proposal',String(args.periodStart)+' to '+String(args.periodEnd),'Pay date '+String(args.payDate),...(args.minutes?[String(args.minutes)+' minutes']:[])],...(args.amountCents?{amount:{value:Number(args.amountCents)/100,currency:'USD'}}:{})}}
  }
  if(name==='notice.process') {
    agent.allow('notices:process',args.companyId)
    const l=agent.location('location_id'),row=await env.DB.prepare(`SELECT id,reference,digest FROM env_notices WHERE company_id=? AND id=? AND ${l.sql} AND ${f.sql}`).bind(args.companyId,args.noticeId,...l.args,...f.args).first<{id:string;reference:string;digest:string}>()
    if(!row)throw new ToolRefusal('notice_unavailable','notice_unavailable',{native_status:403})
    return {target:{kind:'notice',id:row.id},revision:row.digest,summary:{target:{id:row.id,name:row.reference},recipients:['OpenAI'],items:['Redacted tax-notice text; untrusted extraction only.']}}
  }
  if(name==='reply.dispatch') {
    agent.allow('dispatch:execute',args.companyId)
    const l=agent.location('n.location_id'),row=await env.DB.prepare(`SELECT r.id,r.version,r.cipher FROM env_notice_replies r JOIN env_notices n ON n.company_id=r.company_id AND n.id=r.notice_id WHERE r.company_id=? AND r.id=? AND r.version=(SELECT MAX(version) FROM env_notice_replies WHERE company_id=r.company_id AND id=r.id) AND ${l.sql} AND ${f.sql}`).bind(args.companyId,args.replyId,...l.args,...f.args).first<{id:string;version:number;cipher:string}>()
    if(!row)throw new ToolRefusal('record_unavailable')
    const payload=JSON.parse(await unseal(await recordKey(env.ENVELOPE_RECORD_KEY),JSON.stringify([args.companyId,'reply',row.id,row.version]),row.cipher))
    return {target:{kind:'notice-reply',id:row.id},revision:row.version,summary:{target:{id:row.id},recipients:[payload.to],items:[payload.subject,replyBody(payload)]}}
  }
  if(name==='run.review') {
    agent.allow('drafts:read',args.companyId)
    const run=await env.DB.prepare(`SELECT object_id AS id,MAX(version) AS version FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=? AND ${f.sql} AND (NOT EXISTS(SELECT 1 FROM env_agent_access a WHERE a.company_id=env_workspace_versions.company_id AND a.target_id=env_workspace_versions.object_id AND a.action='bonus.prepared') OR EXISTS(SELECT 1 FROM env_agent_access a WHERE a.company_id=env_workspace_versions.company_id AND a.target_id=env_workspace_versions.object_id AND a.action='bonus.prepared' AND a.credential_id=?)) HAVING MAX(version) IS NOT NULL`).bind(args.companyId,args.runId,...f.args,agent.grant.id).first<{id:string;version:number}>()
    if(!run)throw new ToolRefusal('review_unavailable','review_unavailable',{native_status:404})
    return {target:{kind:'earnings-run',id:run.id},revision:run.version,summary:{target:{id:run.id},items:['Present version '+run.version+' for separate native human review; no approval.']}}
  }
  return null
}

/** Select the exact permitted response before policy evaluation. No read audit is
 * written until execution; even an empty report still has the sensitive class. */
export const selectedReads = ['records.list','draft.read','bonus.read','reports.proposals','reports.bonuses']
export async function readSelection(agent: AgentTools, name: string, args: Record<string,unknown>, audit = false) {
  let value: Record<string,unknown>
  if(name==='records.list') value=await agent.records(args,audit)
  else if(name==='draft.read') value=await agent.readDraft(args,audit)
  else if(name==='bonus.read') value=await readBonus(agent,args,audit)
  else if(name==='reports.proposals') value=await agent.proposalReport(args,audit)
  else if(name==='reports.bonuses') value=await bonusReport(agent,args,audit)
  else throw new ToolRefusal('tool_not_found')
  const f=agent.fence()
  if(!await agent.env.DB.prepare(`SELECT 1 WHERE ${f.sql}`).bind(...f.args).first()) throw new PayrollError('agent_authority_revoked',403)
  const records=name==='records.list' ? (value.records as unknown[]).length : name==='reports.proposals' ? (value.proposals as unknown[]).length : name==='reports.bonuses' ? (value.bonuses as unknown[]).length : 1
  const parameters=Object.fromEntries(Object.keys(args).sort().map(key=>[key,args[key]]))
  return {value,records,target:{kind:name==='records.list'?'masked-worker-selection':'compensation-selection',id:await digest(JSON.stringify([name,agent.grant.id,agent.grant.version,agent.grant.fields,agent.grant.locations,parameters,value]))}}
}
