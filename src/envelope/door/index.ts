import { createAgentDoor, type Trust } from '../../modules/agent-door/index.ts'
import { operatorAuth, payrollBusinessSettings, type Bindings } from '../../auth.server'
import { AgentTools, AgentCapacityError, agentRequestsPerMinute } from '../agents'
import { currentScopes, scopes } from './native'
import { payrollPeople } from './people'
import { notTools } from './catalogue'
import { nativeTools } from './tools'

export const capabilities = ['tools','policy','pause','audit','idempotency'] as const
function trust(env: Bindings): Trust | null {
  const {RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:keys}=env
  if (![issuer,installationId,keys,env.RER_BUSINESS_TRUST].some(Boolean)) return null
  if (!issuer || !installationId || !keys) throw new Error('Incomplete agent trust')
  return {issuer,installationId,appOrigin:env.AUTH_ORIGIN,publicKeys:JSON.parse(keys)}
}
export async function envelopeDoor(env: Bindings) {
  const stopped=await env.DB.prepare('SELECT stopped FROM bs_settings WHERE singleton=1').first<{stopped:number}>()
  if (stopped?.stopped) env={...env,RER_BUSINESS_TRUST:undefined,RER_OWNER_CLAIM_ISSUER:undefined,RER_OWNER_CLAIM_INSTALLATION_ID:undefined,RER_OWNER_CLAIM_PUBLIC_KEYS:undefined}
  const exhausted = new WeakMap<Request, AgentCapacityError>()
  const door = createAgentDoor({seed:'envelope',name:'Envelope',specialist:'payroll',db:env.DB,origin:env.AUTH_ORIGIN,trust:trust(env),capabilities,
    limits:{requestsPerMinute:agentRequestsPerMinute},
    paths:['/mcp','/api/envelope/mcp'],
    people:payrollPeople(env),
    tools:nativeTools(env),resources:[],
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
  })
  return {...door,async handle(request:Request) {
    const response=await door.handle(request),capacity=exhausted.get(request)
    exhausted.delete(request)
    // The pinned shared authenticator catches local errors. Preserve its parsed
    // request id and validation order, then restore a genuine capacity refusal.
    if (!capacity || response?.status!==401) return response
    const body=await response.json() as {id:unknown},headers=new Headers(response.headers)
    headers.delete('www-authenticate')
    headers.set('retry-after',String(capacity.retryAfter))
    return Response.json({jsonrpc:'2.0',id:body.id,error:{code:-32000,message:'Capacity exceeded',data:{code:capacity.code}}},{status:429,headers})
  }}
}
export async function agentResponse(request: Request, env: Bindings) {
  const path=new URL(request.url).pathname
  if(!['/mcp','/api/envelope/mcp','/api/rer/agent-policy','/api/rer/business-settings','/rer-business-logo','/rer-business.css','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp','/agents'].includes(path) && !path.startsWith('/agents/')) return null
  if (['/api/rer/business-settings','/rer-business-logo','/rer-business.css'].includes(path))
    return payrollBusinessSettings(env,operatorAuth(env).businessTeam).handle(request)
  return (await envelopeDoor(env)).handle(request)
}
