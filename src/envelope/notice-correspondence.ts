import type { Bindings } from '../auth.server'
import { AgentTools, type AgentGrant } from './agents'
import type { Actor } from './access'
import { fence, locationSql } from './access'
import type { Records } from './records'
import { PayrollError, recordKey, unseal } from './security'

export interface ReplyAgent {
  agentId:string; sponsorId:string; grantId:string; label:string
  grantVersion:number; sponsorGrantVersion:number; sponsorOperatorVersion:number
}
export interface ReplyData {
  sender:string; to:string; subject:string; body:string
  sourceAnalysisId?:string
  preparedBy?:ReplyAgent
  sendingAgent?:ReplyAgent
  humanReviewer?:{id:string;name:string;operatorVersion:number;grantVersion:number}
  destination?:{counterparty:'known'|'new';recipientCount:1;evidence?:{replyId:string;version:number;digest:string;providerReceipt:string}}
}
export const replyBody=(reply:ReplyData)=>reply.body+
  (reply.preparedBy?'\n\nPrepared by '+reply.preparedBy.label:'')+
  (reply.sendingAgent?'\nSent by '+reply.sendingAgent.label:'')+
  (reply.humanReviewer?'\nHuman reviewer: '+reply.humanReviewer.name:'')

export function agentAttribution(agent:AgentTools):ReplyAgent {
  const g=agent.grant, ctx=agent.doorContext
  if(!ctx)throw new PayrollError('reviewed_sender_required',409)
  return {agentId:ctx.agent.id,sponsorId:g.sponsor_id,grantId:g.id,label:ctx.actor.label,
    grantVersion:g.version,sponsorGrantVersion:g.sponsor_grant_version,sponsorOperatorVersion:g.sponsor_operator_version}
}
export function requireReviewedSender(agent:AgentTools,payload:ReplyData) {
  const actual=agentAttribution(agent), reviewed=payload.sendingAgent
  // Labels are retained attribution text; identity and authority bind the review.
  const binding=['agentId','sponsorId','grantId','grantVersion','sponsorGrantVersion','sponsorOperatorVersion'] as const
  if(!reviewed || binding.some(key=>actual[key]!==reviewed[key]))throw new PayrollError('reviewed_sender_changed',409)
}

/** Only live native dispatch grants and explicit Business bindings can be selected. */
export async function correspondenceChoices(records:Records,actor:Actor,location:string) {
  const f=fence(actor)
  const rows=(await records.statement(`SELECT g.*,c.token_hash,c.secret_expires_at,o.display_name AS sponsorName,
    b.agent_id AS businessAgentId FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id
    JOIN oa_operators o ON o.id=g.sponsor_id LEFT JOIN env_business_agent_bindings b ON b.grant_id=g.id AND b.sponsor_id=g.sponsor_id
    WHERE g.company_id=? AND ${f.sql} ORDER BY g.created_at,g.id`,[actor.company,...f.args]).all<AgentGrant & {sponsorName:string;businessAgentId:string|null}>()).results
  const senders:{value:string;identity:ReplyAgent}[]=[]
  for(const g of rows) {
    if(!JSON.parse(g.actions).includes('dispatch:execute') || !JSON.parse(g.fields).includes('tax') || !JSON.parse(g.providers).includes('resend') ||
      !JSON.parse(g.locations).some((id:string)=>id==='*'||id===location))continue
    const authority=new AgentTools(records.env,g).authorityFence()
    if(!await records.statement(`SELECT 1 WHERE ${f.sql} AND ${authority.sql}`,[...f.args,...authority.args]).first())continue
    for(const agentId of [g.id,...(g.businessAgentId?[g.businessAgentId]:[])]) {
      const value=JSON.stringify([g.id,agentId])
      if(!senders.some(s=>s.value===value))senders.push({value,identity:{agentId,sponsorId:g.sponsor_id,grantId:g.id,
        label:g.name+' for '+g.sponsorName,grantVersion:g.version,sponsorGrantVersion:g.sponsor_grant_version,sponsorOperatorVersion:g.sponsor_operator_version}})
    }
  }
  const reviewers=(await records.statement(`SELECT o.id,o.display_name AS name,o.version AS operatorVersion,g.version AS grantVersion
    FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=? AND g.revoked_at IS NULL AND o.status='active'
    AND (g.role='owner' OR (EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='notices:approve')
      AND EXISTS(SELECT 1 FROM json_each(g.fields) WHERE value='tax')
      AND EXISTS(SELECT 1 FROM json_each(g.locations) WHERE value='*' OR value=?))) AND ${f.sql} ORDER BY o.display_name,o.id`,[actor.company,location,...f.args]).all<NonNullable<ReplyData['humanReviewer']>>()).results
  return {senders,reviewers}
}

/** Prior provider acceptance is destination evidence, never proof of delivery.
 * Restrict evidence to the reader's current company and location custody. */
export async function replyDestination(records:Records,actor:Actor,to:string):Promise<NonNullable<ReplyData['destination']>> {
  const f=fence(actor),l=locationSql(actor,'n.location_id'),key=await recordKey(records.env.ENVELOPE_RECORD_KEY)
  const rows=(await records.statement(`SELECT r.id,r.version,r.digest,r.cipher,d.provider_receipt AS receipt
    FROM env_notice_replies r JOIN env_notice_dispatches d ON d.company_id=r.company_id AND d.reply_id=r.id AND d.version=r.version AND d.digest=r.digest
    JOIN env_notices n ON n.company_id=r.company_id AND n.id=r.notice_id
    WHERE r.company_id=? AND d.state='accepted' AND d.provider_receipt IS NOT NULL AND ${l.sql} AND ${f.sql}
    ORDER BY d.created_at DESC,d.id`,[actor.company,...l.args,...f.args]).all<{id:string;version:number;digest:string;cipher:string;receipt:string}>()).results
  for(const r of rows) {
    const prior:ReplyData=JSON.parse(await unseal(key,JSON.stringify([actor.company,'reply',r.id,r.version]),r.cipher))
    if(prior.to===to)return {counterparty:'known',recipientCount:1,evidence:{replyId:r.id,version:r.version,digest:r.digest,providerReceipt:r.receipt}}
  }
  return {counterparty:'new',recipientCount:1}
}

/** A permission-filtered attribution projection; never export message content. */
export async function correspondenceRecord(env:Bindings,actor:Actor,replyId:string,version?:number) {
  if(actor.grant.role!=='owner' && (!actor.grant.actions.includes('notices:read') || !actor.grant.fields.includes('tax')))return null
  const f=fence(actor),l=locationSql(actor,'n.location_id')
  const row=await env.DB.prepare(`SELECT r.id,r.version,r.cipher,a.actor_id AS approvedBy,d.state
    FROM env_notice_replies r JOIN env_notices n ON n.company_id=r.company_id AND n.id=r.notice_id
    LEFT JOIN env_notice_approvals a ON a.company_id=r.company_id AND a.reply_id=r.id AND a.version=r.version
    LEFT JOIN env_notice_dispatches d ON d.company_id=r.company_id AND d.reply_id=r.id AND d.version=r.version
    WHERE r.company_id=? AND r.id=? AND ${version===undefined?'r.version=(SELECT MAX(version) FROM env_notice_replies WHERE company_id=r.company_id AND id=r.id)':'r.version=?'} AND ${l.sql} AND ${f.sql}`)
    .bind(actor.company,replyId,...(version===undefined?[]:[version]),...l.args,...f.args).first<{id:string;version:number;cipher:string;approvedBy:string|null;state:string|null}>()
  if(!row)return null
  const data:ReplyData=JSON.parse(await unseal(await recordKey(env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'reply',row.id,row.version]),row.cipher))
  return {replyId:row.id,version:row.version,preparedBy:data.preparedBy??null,sendingAgent:data.sendingAgent??null,
    humanReviewer:data.humanReviewer??null,approvedBy:row.approvedBy,state:row.state}
}
