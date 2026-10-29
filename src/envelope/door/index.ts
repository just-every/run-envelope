import { createAgentDoor, operatorAuthPeople, type Trust } from '../../modules/agent-door/index.ts'
import { createBusinessSettings } from '../../modules/business-settings/index.ts'
import { authConfig, operatorAuth, type Bindings } from '../../auth.server'
import { AgentTools } from '../agents'
import { currentScopes, scopes } from './native'
import { nativeTools } from './tools'

export const capabilities = ['tools','policy','pause','audit','idempotency'] as const
function trust(env: Bindings): Trust | null {
  const {RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:keys}=env
  if (![issuer,installationId,keys].some(Boolean)) return null
  if (!issuer || !installationId || !keys) throw new Error('Incomplete agent trust')
  return {issuer,installationId,appOrigin:env.AUTH_ORIGIN,publicKeys:JSON.parse(keys)}
}
export function envelopeDoor(env: Bindings) {
  return createAgentDoor({seed:'envelope',name:'Envelope',specialist:'payroll',db:env.DB,origin:env.AUTH_ORIGIN,trust:trust(env),capabilities,
    paths:['/mcp','/api/envelope/mcp'],
    people:operatorAuthPeople({db:env.DB,allowList:authConfig(env).allowList,session:request=>operatorAuth(env).getSession(request)}),
    tools:nativeTools(env),resources:[],
    currentScopes:who=>currentScopes(env,who),
    async localCredentials(request) {
      const value=request.headers.get('authorization')?.replace(/^Bearer /,'')
      if (!value) return null
      try { const agent=await AgentTools.authenticate(env,value)
        return {sponsor:{id:agent.grant.sponsor_id},agent:{id:agent.grant.id,name:agent.grant.name,specialist:'payroll'},scopes:scopes(agent),clientId:agent.grant.id}
      } catch { return null }
    },
    notTools:[{clauses:['ENV-053'],reason:'import-door'},{clauses:['ENV-050'],reason:'installation'},{clauses:['ENV-034'],reason:'screen'}],
  })
}
export async function agentResponse(request: Request, env: Bindings) {
  const settings=createBusinessSettings({db:env.DB,trust:env.RER_BUSINESS_TRUST ?? null,
    team:operatorAuth(env).businessTeam,
    business:{settings:1,values:['display_name','owner_name','brand_color','logo','timezone'],team:{roles:{admin:'admin',member:'member'}}}})
  return await settings.handle(request) ?? await envelopeDoor(env).handle(request)
}
