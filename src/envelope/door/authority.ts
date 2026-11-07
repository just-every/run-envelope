import type { Bindings } from '../../auth.server'
import { AgentTools } from '../agents'
import { recordSelfEscalation } from '../agent-policy'
import { PayrollError } from '../security'

const privateHeaders = {'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}
const roles:Record<string,number> = {member:0,admin:1,owner:2}

/** Person administration never becomes agent authority, even with an owner cookie.
 * Recognize the real native administration doors before their person handlers. */
export async function selfAdministration(request:Request,env:Bindings):Promise<Response|null> {
  const bearer=request.headers.get('authorization')
  if(!bearer || !/^Bearer [A-Za-z0-9_-]{43}$/.test(bearer) || ['GET','HEAD','OPTIONS'].includes(request.method))return null
  const path=new URL(request.url).pathname
  const company=/^\/(?:api|app)\/envelope\/companies\/([-a-zA-Z0-9]+)\/(agents\/(?:class-policy|policy|pause)|grants)$/.exec(path)
  const shared=['/agents/api/policy','/agents/api/pause'].includes(path)
  const sponsorRole=path==='/auth/operator/role'
  if(!company&&!shared&&!sponsorRole)return null
  const reply=(error:string,status:number)=>Response.json({error},{status,headers:privateHeaders})
  if(new URL(request.url).origin!==env.AUTH_ORIGIN || request.headers.get('origin')!==env.AUTH_ORIGIN || request.headers.get('sec-fetch-site')==='cross-site')return reply('invalid_origin',403)
  try {
    const agent=await AgentTools.authenticate(env,bearer.slice(7))
    if(company&&company[1]!==agent.grant.company_id)return reply('human_session_required',403)
    let tool=path.endsWith('/pause')?'agents.pause':'company.policy'
    if(sponsorRole || company?.[2]==='grants') {
      // Inspect only identity and direction. No administration body is executed.
      if(Number(request.headers.get('content-length')??0)>16384)return reply('invalid_input',400)
      const body=await request.clone().text()
      if(body.length>16384)return reply('invalid_input',400)
      let input:Record<string,unknown>
      try {input=JSON.parse(body)}catch{return reply('invalid_input',400)}
      if(!input || Array.isArray(input) || input.operatorId!==agent.grant.sponsor_id)return reply('human_session_required',403)
      if(sponsorRole) {
        const current=await env.DB.prepare('SELECT role FROM oa_operators WHERE id=?').bind(agent.grant.sponsor_id).first<{role:string}>()
        if(!current || !Object.hasOwn(roles,String(input.role)) || roles[String(input.role)]<=roles[current.role])return reply('human_session_required',403)
        tool='sponsor.role'
      } else {
        const current=await env.DB.prepare('SELECT role,actions,fields,locations FROM env_grants WHERE company_id=? AND operator_id=? AND revoked_at IS NULL').bind(agent.grant.company_id,agent.grant.sponsor_id).first<{role:string;actions:string;fields:string;locations:string}>()
        if(!current)return reply('human_session_required',403)
        const widens=input.role==='owner'&&current.role!=='owner'||(['actions','fields','locations'] as const).some(key=>Array.isArray(input[key])&&(input[key] as unknown[]).some(value=>!JSON.parse(current[key]).includes(value)&&!(key==='locations'&&JSON.parse(current.locations).includes('*'))))
        if(!widens)return reply('human_session_required',403)
        tool='sponsor.grant'
      }
    }
    await recordSelfEscalation(agent,tool,{direction:'widen',peopleCount:1},'native-administration')
    return reply('self_escalation',403)
  } catch(error) {
    if(error instanceof PayrollError)return reply(error.code,error.status)
    throw error
  }
}
