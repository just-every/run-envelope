import type { Bindings } from '../../auth.server'
import { ToolRefusal, type ToolDefinition, type ToolContext, type ClassAndFacts } from '../../modules/agent-door/index.ts'
import { policyCall, requireAgentPolicy } from '../agent-policy'
import { PayrollError } from '../security'
import { prepareBonus, readBonus, bonusReport } from '../bonus-runs'
import { presentReview } from '../review-presentation'
import { processNotice, dispatchReply } from '../notices'
import { digest } from '../workspace/store'
import { nativeAgent } from './native'
import { outputSchema } from './schemas'
import { rotate, rotationKey } from './rotation'
import { effect, sensitiveRecords } from './effects'
import { catalogue } from './catalogue'

async function snapshot(env: Bindings, ctx: ToolContext) {
  const agent=await nativeAgent(env,ctx), f=agent.fence(), l=agent.location('location_id')
  agent.allow('records:read',agent.grant.company_id)
  const people=(await env.DB.prepare(`SELECT id,name,version FROM env_people WHERE company_id=? AND ${l.sql} AND ${f.sql} ORDER BY id`).bind(agent.grant.company_id,...l.args,...f.args).all()).results
  const drafts=(await env.DB.prepare(`SELECT id,person_version,minutes,fingerprint FROM env_run_drafts WHERE company_id=? AND credential_id=? AND ${f.sql} ORDER BY id`).bind(agent.grant.company_id,agent.grant.id,...f.args).all()).results
  const bonuses=(await env.DB.prepare(`SELECT v.object_id,v.version,v.cipher FROM env_workspace_versions v WHERE v.company_id=? AND v.kind='earnings-run' AND ${f.sql} AND EXISTS(SELECT 1 FROM env_agent_access a WHERE a.company_id=v.company_id AND a.target_id=v.object_id AND a.action='bonus.prepared' AND a.credential_id=?) ORDER BY v.object_id,v.version`).bind(agent.grant.company_id,...f.args,agent.grant.id).all()).results
  const notices=JSON.parse(agent.grant.fields).includes('tax') ? (await env.DB.prepare(`SELECT id,digest FROM env_notices WHERE company_id=? AND ${l.sql} AND ${f.sql} ORDER BY id`).bind(agent.grant.company_id,...l.args,...f.args).all()).results : []
  const analyses=(await env.DB.prepare(`SELECT id,cipher FROM env_notice_analysis WHERE company_id=? AND credential_id=? AND ${f.sql} ORDER BY id`).bind(agent.grant.company_id,agent.grant.id,...f.args).all()).results
  const dispatches=(await env.DB.prepare(`SELECT id,state,provider_receipt FROM env_notice_dispatches WHERE company_id=? AND credential_id=? AND ${f.sql} ORDER BY id`).bind(agent.grant.company_id,agent.grant.id,...f.args).all()).results
  const presentations=(await env.DB.prepare(`SELECT token_hash,run_id,run_version FROM env_review_presentations WHERE company_id=? AND credential_id=? AND ${f.sql} ORDER BY token_hash`).bind(agent.grant.company_id,agent.grant.id,...f.args).all()).results
  return {people:people.length,drafts:drafts.length,bonuses:bonuses.length,sha256:await digest(JSON.stringify([people,drafts,bonuses,notices,analyses,dispatches,presentations,agent.grant.token_hash]))}
}

export function nativeTools(env: Bindings): ToolDefinition[] {
  const titles:Record<string,string>={'records.list':'Read worker records','draft.prepare':'Prepare hourly inputs','draft.read':'Read an hourly proposal','bonus.prepare':'Prepare bonus earnings','bonus.read':'Read bonus earnings','reports.proposals':'Read hourly preparations','reports.bonuses':'Read bonus preparations','run.review':'Present a run for human review','notice.process':'Extract a tax notice','reply.dispatch':'Send the approved reply','credentials.rotate':'Rotate this native credential','workspace.snapshot':'Check preparation state'}
  return catalogue.map(entry=> {
    const name=entry.name, nativeName=entry.nativeName
    const tool: ToolDefinition = {
      name,title:titles[nativeName],description:entry.description,scope:entry.scope,readOnly:entry.readOnly,
      inputSchema:{type:'object',properties:{...entry.properties},required:[...entry.required],additionalProperties:false},
      outputSchema:outputSchema(nativeName),classes:[...entry.classes],clauses:[...entry.clauses],
      async classify(args,ctx,completed) {
        const agent=await nativeAgent(env,ctx,args.companyId)
        agent.doorContext=ctx
        try { await requireAgentPolicy(agent,nativeName) } catch(error) {if(error instanceof PayrollError)throw new ToolRefusal(error.code,error.code,{native_status:error.status,...('setupLink' in error?{setupLink:error.setupLink}:{})});throw error}
        if (nativeName!=='credentials.rotate') agent.allow(entry.scope,args.companyId ?? agent.grant.company_id)
        if(nativeName==='credentials.rotate') await rotationKey(args.publicKey)
        if (!completed) await effect(env,nativeName,args,ctx)
        const records=entry.classes.includes('sensitive' as never)?await sensitiveRecords(env,nativeName,args,ctx):0
        const facts: ClassAndFacts[]=entry.classes.map(cls=>({class:cls,facts: cls==='sensitive' ? {measure:records,kind:nativeName==='notice.process'?'tax-notice':'compensation'} : cls==='external' ? {measure:1,counterparty:'known'} : cls==='commitment' ? {measure:0,currency:'USD',counterparty:'known'} : cls==='security' ? {measure:1,setting:'native-agent-credential'} : {measure:1}}))
        return facts
      },
      async run(args,ctx) {
        try {
          const agent=await nativeAgent(env,ctx,args.companyId)
          agent.doorContext=ctx
          const value=await policyCall(agent,nativeName,'shared-door',async()=> {
            if (nativeName==='workspace.snapshot') return snapshot(env,ctx)
            if (nativeName==='records.list') return agent.records(args)
            if (nativeName==='draft.prepare') return agent.prepare(args)
            if (nativeName==='draft.read') return agent.readDraft(args)
            if (nativeName==='bonus.prepare') return prepareBonus(agent,args)
            if (nativeName==='bonus.read') return readBonus(agent,args)
            if (nativeName==='reports.bonuses') return bonusReport(agent,args)
            if (nativeName==='reports.proposals') return agent.proposalReport(args)
            if (nativeName==='run.review') return presentReview(agent,args)
            if (nativeName==='notice.process') return processNotice(agent,args)
            if (nativeName==='reply.dispatch') return dispatchReply(agent,args)
            if (nativeName==='credentials.rotate') return rotate(agent,args.publicKey)
            throw new ToolRefusal('tool_not_found')
          })
          return {result:value}
        } catch(error) {
          if (error instanceof PayrollError) throw new ToolRefusal(error.code,error.code,{native_status:error.status,...('setupLink' in error?{setupLink:error.setupLink}:{})})
          throw error
        }
      },
    }
    if (entry.readOnly && nativeName!=='workspace.snapshot' || nativeName==='notice.process') tool.untrusted=true
    if (!entry.readOnly) {
      tool.summary=async(args,ctx)=>{const summary=(await effect(env,nativeName,args,ctx))?.summary ?? {items:[entry.description]};if(nativeName==='credentials.rotate')summary.items=[...summary.items??[],'Delivery key SHA-256 '+await digest(JSON.stringify(args.publicKey))];return summary}
      tool.target=async(args,ctx)=>(await effect(env,nativeName,args,ctx))?.target ?? null
      tool.revision=async(args,ctx)=>{const target=await effect(env,nativeName,args,ctx);if(!target)return null;const agent=await nativeAgent(env,ctx,args.companyId);return JSON.stringify([target.revision,agent.grant.version,agent.authenticatedPolicyVersion])}
      tool.revisionType='string'
    }
    if (nativeName==='credentials.rotate') tool.authority=async(_args,ctx)=>({subject:(await nativeAgent(env,ctx)).grant.id,widens:false})
    return tool
  })
}
