import type { Bindings } from '../../auth.server'
import { ToolRefusal, type ToolDefinition, type ToolContext, type ClassAndFacts } from '../../modules/agent-door/index.ts'
import { policyCall } from '../agent-policy'
import { PayrollError } from '../security'
import { prepareBonus, readBonus, bonusReport } from '../bonus-runs'
import { presentReview } from '../review-presentation'
import { processNotice, dispatchReply } from '../notices'
import { digest } from '../workspace/store'
import { nativeAgent } from './native'
import { effect } from './effects'
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
  return catalogue.map(entry=> {
    const name=entry.name, nativeName=entry.nativeName
    const tool: ToolDefinition = {
      name,title:nativeName,description:entry.description,scope:entry.scope,readOnly:entry.readOnly,
      inputSchema:{type:'object',properties:{...entry.properties},required:[...entry.required],additionalProperties:false},
      outputSchema:{type:'object'},classes:[...entry.classes],clauses:[...entry.clauses],
      async classify(args,ctx,completed) {
        const agent=await nativeAgent(env,ctx,args.companyId)
        if (nativeName!=='credentials.rotate') agent.allow(entry.scope,args.companyId ?? agent.grant.company_id)
        if (!completed) await effect(env,nativeName,args,ctx)
        const facts: ClassAndFacts[]=entry.classes.map(cls=>({class:cls,facts: cls==='sensitive' ? {measure:1,kind:'payroll'} : cls==='external' ? {measure:1,counterparty:'known'} : cls==='commitment' ? {measure:0,currency:'USD',counterparty:'known'} : cls==='security' ? {measure:1,setting:'native-agent-credential'} : {measure:1}}))
        return facts
      },
      async run(args,ctx) {
        try {
          if (nativeName==='workspace.snapshot') return {result:await snapshot(env,ctx)}
          const agent=await nativeAgent(env,ctx,args.companyId)
          agent.doorContext=ctx
          const value=await policyCall(agent,nativeName,'shared-door',async()=> {
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
            if (nativeName==='credentials.rotate') return agent.rotate()
            throw new ToolRefusal('tool_not_found')
          })
          return {result:value}
        } catch(error) {
          if (error instanceof PayrollError) throw new ToolRefusal(error.code)
          throw error
        }
      },
    }
    if (!entry.readOnly) {
      tool.summary=async(args,ctx)=>(await effect(env,nativeName,args,ctx))?.summary ?? {items:[entry.description]}
      tool.target=async(args,ctx)=>(await effect(env,nativeName,args,ctx))?.target ?? null
      tool.revision=async(args,ctx)=>(await effect(env,nativeName,args,ctx))?.revision ?? null
      if(nativeName==='notice.process') tool.revisionType='string'
    }
    if (nativeName==='credentials.rotate') tool.authority=async(_args,ctx)=>({subject:(await nativeAgent(env,ctx)).grant.id,widens:false})
    return tool
  })
}
