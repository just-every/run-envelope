import type { Bindings } from '../../auth.server'
import { ToolRefusal, type ResourceDefinition, type ResourceContext, type ClassAndFacts } from '../../modules/agent-door/index.ts'
import { policyCall, requireAgentPolicy } from '../agent-policy'
import { nativeAgent } from './native'
import { digest } from '../workspace/store'
import { maskedPerson, type Person } from '../records'
import { proposalSelect, proposalState, type AgentTools } from '../agents'

export const personTemplate='envelope://companies/{company}/people/{person}'
export const personUri=(company:string,person:string)=>'envelope://companies/'+encodeURIComponent(company)+'/people/'+encodeURIComponent(person)
export const proposalTemplate='envelope://companies/{company}/drafts/{draft}'
export const proposalUri=(company:string,draft:string)=>'envelope://companies/'+encodeURIComponent(company)+'/drafts/'+encodeURIComponent(draft)

type SharedState={envelope:unknown;local_document:unknown;local_revision:unknown;local_paused:unknown}
interface Fence {agent:AgentTools;ctx:ResourceContext;state:SharedState}
interface NativeRecord {
  uriTemplate:string;name:string;description:string;scope:string;classes:ClassAndFacts[]
  /** The native call this read is audited and policed as. */
  tool:string
  /** The audited native read under the caller's current grant. */
  load(agent:AgentTools,company:string,id:string):Promise<unknown>
  /** The same projection, re-read at the final authority fence. */
  current(at:Fence,company:string,id:string):Promise<unknown>
}
// The live shared agent and the unchanged shared policy, joined to a final read.
const sharedJoin='JOIN agent_door_agents c ON c.id=? JOIN agent_door_state s ON s.id=1'
const sharedAgent='c.revoked=0 AND c.sponsor=?'
const sharedPolicy='s.envelope IS ? AND s.local_document IS ? AND s.local_revision IS ? AND s.local_paused IS ?'
const policyArgs=(state:SharedState)=>[state.envelope,state.local_document,state.local_revision,state.local_paused]

function nativeResource(env: Bindings,record: NativeRecord): ResourceDefinition {
  const pattern=new RegExp('^'+record.uriTemplate.replace(/\{[^}]+\}/g,'([A-Za-z0-9-]+)')+'$')
  // This is a restriction snapshot, never an alternate source of authority.
  const sharedState=async()=>JSON.stringify(await env.DB.prepare('SELECT envelope,local_document,local_revision,local_paused FROM agent_door_state WHERE id=1').first())
  return {uriTemplate:record.uriTemplate,name:record.name,description:record.description,mimeType:'application/json',scope:record.scope,classes:record.classes.map(item=>item.class),
    classify:()=>record.classes,
    async read(uri,ctx) {
      const match=pattern.exec(uri)
      if(!match)return null
      try {
        const before=await sharedState(),agent=await nativeAgent(env,ctx,match[1])
        agent.resourceContext=ctx
        await requireAgentPolicy(agent,record.tool)
        const value=await policyCall(agent,record.tool,'shared-door',async()=> {
          const value=await record.load(agent,match[1],match[2])
          if(!value)return null
          // Retain only a digest in native decision facts. Pending approvals and
          // their later retries keep the original operation across restarts.
          const selection=await digest(JSON.stringify([match[1],value]))
          const prior=await env.DB.prepare(`SELECT f.facts FROM env_agent_call_facts f JOIN env_agent_call_audit a ON a.id=f.call_id WHERE a.company_id=? AND a.credential_id=? AND a.tool=? AND a.door_operation_id=? ORDER BY a.rowid LIMIT 1`)
            .bind(match[1],agent.grant.id,record.tool,ctx.operationId).first<{facts:string}>()
          if(prior && JSON.parse(prior.facts).selection!==selection)throw new ToolRefusal('resource_changed')
          if(!prior)await env.DB.prepare(`INSERT INTO env_agent_call_facts(call_id,facts) SELECT id,? FROM env_agent_call_audit WHERE company_id=? AND credential_id=? AND tool=? AND door_operation_id=? ORDER BY rowid DESC LIMIT 1`)
            .bind(JSON.stringify({selection}),match[1],agent.grant.id,record.tool,ctx.operationId).run()
          return value
        })
        if(await sharedState()!==before)throw new ToolRefusal('resource_unavailable')
        if(!value)return null
        const state=JSON.parse(before) as SharedState|null
        // Re-read the record at the final authority fence. An edit or erasure
        // after the native SELECT cannot deliver the earlier projection.
        const current=state && await record.current({agent,ctx,state},match[1],match[2])
        if(!current)throw new ToolRefusal('resource_unavailable')
        if(JSON.stringify(current)!==JSON.stringify(value))throw new ToolRefusal('resource_changed')
        return {json:value,untrusted:true}
      } catch(error) {
        if(error instanceof ToolRefusal && error.code==='resource_changed')throw error
        // Missing, foreign, held and out-of-scope records reveal no existence.
        throw new ToolRefusal('resource_unavailable')
      }
    },
  }
}

export function nativeResources(env: Bindings): ResourceDefinition[] {
  // Discovery lists templates in this order; the public reference sorts by URI.
  return [nativeResource(env,{uriTemplate:proposalTemplate,name:'Hourly proposal',description:'One uncalculated hourly proposal this credential prepared; the worker name and source reference are untrusted data.',scope:'drafts:read',
    tool:'draft.proposal',classes:[{class:'sensitive',facts:{measure:1,kind:'compensation'}}],
    load:(agent,company,id)=>agent.readDraft({companyId:company,draftId:id}),
    async current({agent,ctx,state},company,id) {
      const f=agent.fence(),l=agent.location('p.location_id')
      const row=await env.DB.prepare(`${proposalSelect} ${sharedJoin}
          WHERE d.company_id=? AND d.id=? AND d.credential_id=? AND ${l.sql} AND ${sharedAgent} AND ${f.sql}
          AND ${sharedPolicy}`)
        .bind(ctx.agent.id,company,id,agent.grant.id,...l.args,ctx.person.id,...f.args,...policyArgs(state)).first<Record<string,unknown>>()
      return row && {...row,...proposalState}
    },
  }),nativeResource(env,{uriTemplate:personTemplate,name:'Masked worker',description:'Current native worker identity; customer names are untrusted data.',scope:'records:read',
    tool:'records.person',classes:[{class:'standard',facts:{measure:1}}],
    load:(agent,company,id)=>agent.person(company,id),
    async current({agent,ctx,state},company,id) {
      const f=agent.fence(),l=agent.location('p.location_id')
      const row=await env.DB.prepare(`SELECT p.id,p.name,p.location_id AS locationId,p.version
          FROM env_people p ${sharedJoin}
          WHERE p.company_id=? AND p.id=? AND ${l.sql} AND ${sharedAgent} AND ${f.sql}
          AND ${sharedPolicy}`)
        .bind(ctx.agent.id,company,id,...l.args,ctx.person.id,...f.args,...policyArgs(state)).first<Person>()
      return row && maskedPerson(row)
    },
  })]
}
