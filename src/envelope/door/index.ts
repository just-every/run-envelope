import { createAgentDoor, type Trust, type AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { createBusinessSettings } from '../../modules/business-settings/index.ts'
import { operatorAuth, type Bindings } from '../../auth.server'
import { AgentTools, AgentCapacityError, agentRequestsPerMinute } from '../agents'
import { currentScopes, scopes } from './native'
import { payrollPeople } from './people'
import { notTools, capacityLimits } from './catalogue'
import { nativeTools } from './tools'
import { selfAdministration } from './authority'
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
/** The JSON-RPC id of a request within the advertised body limit, else null. */
async function requestId(request: {headers:Headers;text():Promise<string>}) {
  if(Number(request.headers.get('content-length')??0)>capacityLimits.maxBodyBytes)return null
  try {
    const text=await request.text()
    if(text.length>capacityLimits.maxBodyBytes)return null
    const id=(JSON.parse(text) as {id?:unknown}|null)?.id
    return typeof id==='string'||typeof id==='number'?id:null
  } catch {return null}
}
export function envelopeDoor(env: Bindings,execution?: ExecutionContext) {
  // A capacity refusal reads the request's JSON-RPC id so it can be answered.
  const exhausted = new WeakMap<Request, {error:AgentCapacityError;id:Promise<string|number|null>}>()
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
        if (error instanceof AgentCapacityError) exhausted.set(request,{error,id:request.bodyUsed?Promise.resolve(null):requestId(request.clone())})
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
    // The shared authenticator catches local errors and answers 401. Keep every
    // other answer as it is, then restore a genuine capacity refusal.
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
    // The shared door challenges an unadmitted bearer before reading its request.
    // This bearer is genuine and only over capacity, so answer its own request id.
    const headers=new Headers(response.headers)
    headers.delete('www-authenticate')
    headers.set('retry-after',String(capacity.error.retryAfter))
    return Response.json({jsonrpc:'2.0',id:await capacity.id,error:{code:-32000,message:'Capacity exceeded',data:{code:capacity.error.code}}},{status:429,headers})
  }}
}
export async function agentResponse(request: Request, env: Bindings, execution?: ExecutionContext) {
  const refused=await selfAdministration(request,env)
  if(refused)return refused
  const path=new URL(request.url).pathname
  if(path==='/docs/agents')return envelopeDoor(env).handle(request)
  if(!['/mcp','/api/envelope/mcp','/api/rer/agent-policy','/api/rer/agent-decisions','/api/rer/business-settings','/rer-business-logo','/rer-business.css','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp','/agents'].includes(path) && !path.startsWith('/agents/')) return null
  const settings=createBusinessSettings({db:env.DB,trust:env.RER_BUSINESS_TRUST ?? null,
    team:operatorAuth(env).businessTeam,
    business:{settings:1,values:['display_name','owner_name','brand_color','logo','timezone'],team:{roles:{admin:'admin',member:'member'}}}})
  return await settings.handle(request) ?? await envelopeDoor(env,execution).handle(request)
}
