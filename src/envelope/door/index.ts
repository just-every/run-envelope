import { createAgentDoor, type Trust, type AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { operatorAuth, payrollBusinessSettings, type Bindings } from '../../auth.server'
import { AgentTools, AgentCapacityError, agentRequestsPerMinute } from '../agents'
import { currentScopes, scopes } from './native'
import { payrollPeople } from './people'
import { notTools, capacityLimits } from './catalogue'
import { nativeTools } from './tools'
import { nativeResources } from './resources'
import { agentReference, agentInstructions, agentDocs } from './docs'
import { specialistPrompts } from './prompts'

export const capabilities = ['tools','policy','pause','audit','idempotency','resources','prompts'] as const
function trust(env: Bindings): Trust | null {
  const {RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:keys}=env
  if (![issuer,installationId,keys,env.RER_BUSINESS_TRUST].some(Boolean)) return null
  if (!issuer || !installationId || !keys) throw new Error('Incomplete agent trust')
  return {issuer,installationId,appOrigin:env.AUTH_ORIGIN,publicKeys:JSON.parse(keys)}
}
export async function envelopeDoor(env: Bindings, execution?: ExecutionContext) {
  const stopped=await env.DB.prepare('SELECT stopped FROM bs_settings WHERE singleton=1').first<{stopped:number}>()
  if (stopped?.stopped) env={...env,RER_BUSINESS_TRUST:undefined,RER_OWNER_CLAIM_ISSUER:undefined,RER_OWNER_CLAIM_INSTALLATION_ID:undefined,RER_OWNER_CLAIM_PUBLIC_KEYS:undefined}
  const exhausted = new WeakMap<Request, AgentCapacityError>()
  const options: AgentDoorOptions = {seed:'envelope',name:'Envelope',specialist:'payroll',db:env.DB,origin:env.AUTH_ORIGIN,trust:trust(env),capabilities,
    limits:{...capacityLimits,requestsPerMinute:agentRequestsPerMinute},
    paths:['/mcp','/api/envelope/mcp'],
    people:payrollPeople(env),
    tools:nativeTools(env,execution?work=>execution.waitUntil(work):undefined),resources:nativeResources(env),prompts:specialistPrompts,
    currentScopes:who=>currentScopes(env,who),
    async localCredentials(request) {
      const value=request.headers.get('authorization')?.replace(/^Bearer /,'')
      if (!value) return null
      try { const agent=await AgentTools.authenticate(env,value)
        return {sponsor:{id:agent.grant.sponsor_id},agent:{id:agent.grant.id,name:agent.grant.name,specialist:'payroll'},scopes:await scopes(agent),clientId:agent.grant.id}
      } catch (error) {
        if (error instanceof AgentCapacityError) exhausted.set(request,error)
        return null
      }
    },
    notTools:notTools.map(item=>({reason:item.reason,clauses:[...item.clauses]})),
  }
  const door=createAgentDoor(options)
  return {...door,async handle(request:Request) {
    const path=new URL(request.url).pathname
    if(path==='/docs/agents')return agentDocs(request,agentReference(options))
    const response=await door.handle(request),capacity=exhausted.get(request)
    exhausted.delete(request)
    // The pinned shared authenticator catches local errors. Preserve its parsed
    // request id and validation order, then restore a genuine capacity refusal.
    if (!capacity || response?.status!==401) {
    if(response?.ok && options.paths?.includes(path) && response.headers.get('content-type')?.includes('application/json')) {
      const message=await response.clone().json() as {result?:{instructions?:string;capabilities?:unknown;_meta?:Record<string,unknown>}}
      if(typeof message.result?.instructions==='string' && message.result.capabilities) {
        message.result.instructions=agentInstructions(agentReference(options))
        if(message.result._meta)message.result._meta['com.runeditrun/docs']='/docs/agents'
        return Response.json(message,{status:response.status,headers:response.headers})
      }
    }
      return response
    }
    const body=await response.json() as {id:unknown},headers=new Headers(response.headers)
    headers.delete('www-authenticate')
    headers.set('retry-after',String(capacity.retryAfter))
    return Response.json({jsonrpc:'2.0',id:body.id,error:{code:-32000,message:'Capacity exceeded',data:{code:capacity.code}}},{status:429,headers})
  }}
}
export async function agentResponse(request: Request, env: Bindings, execution?: ExecutionContext) {
  const path=new URL(request.url).pathname
  if(path==='/docs/agents')return (await envelopeDoor(env,execution)).handle(request)
  if(!['/mcp','/api/envelope/mcp','/api/rer/agent-policy','/api/rer/business-settings','/rer-business-logo','/rer-business.css','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp','/agents'].includes(path) && !path.startsWith('/agents/')) return null
  if (['/api/rer/business-settings','/rer-business-logo','/rer-business.css'].includes(path))
    return payrollBusinessSettings(env,operatorAuth(env).businessTeam).handle(request)
  return (await envelopeDoor(env,execution)).handle(request)
}
