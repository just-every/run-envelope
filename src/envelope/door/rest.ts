import type { Bindings } from '../../auth.server'
import { AgentTools } from '../agents'
import type { Input } from '../records'
import { PayrollError } from '../security'
import { envelopeDoor } from './index'
import { scopes } from './native'
import { catalogue } from './catalogue'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}
/** The existing REST vocabulary is a transport adapter into the same door.
 * Native validation and its strict REST inputs remain authoritative. */
export async function agentRest(request:Request,env:Bindings,read:()=>Promise<Input>) {
  const url=new URL(request.url)
  if(request.headers.has('cookie'))throw new PayrollError('ambiguous_authentication',403)
  if(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.has('origin')&&request.headers.get('origin')!==env.AUTH_ORIGIN)throw new PayrollError('invalid_origin',403)
  const bearer=request.headers.get('authorization')
  if(!bearer?.startsWith('Bearer '))throw new PayrollError('agent_authentication_required',401)
  const agent=await AgentTools.authenticate(env,bearer.slice(7)),originalScopes=await scopes(agent)
  const opened=await agent.log('transport.rest.v1',agent.grant.id).run()
  if(!opened.meta.changes)throw new PayrollError('agent_authority_revoked',403)
  const report=/^\/api\/envelope\/v1\/companies\/([-a-zA-Z0-9]+)\/reports\/(proposals|bonus-runs)$/.exec(url.pathname)
  const record=/^\/api\/envelope\/v1\/companies\/([-a-zA-Z0-9]+)\/(records|drafts|bonus-runs)(?:\/([-a-zA-Z0-9]+))?$/.exec(url.pathname)
  let name:string,args:Input,status=200
  const page=()=> {
    if([...url.searchParams.keys()].some(k=>!['limit','after'].includes(k)||url.searchParams.getAll(k).length!==1))throw new PayrollError('invalid_record_query')
    const result:Input={}
    if(url.searchParams.has('limit')){const value=url.searchParams.get('limit')!;if(!/^\d+$/.test(value))throw new PayrollError('invalid_record_query');result.limit=Number(value)}
    if(url.searchParams.has('after'))result.after=url.searchParams.get('after')!
    return result
  }
  if(report&&request.method!=='POST') {
    name=report[2]==='bonus-runs'?'envelope.reports.bonuses':'envelope.reports.proposals';args={companyId:report[1],...page()}
  } else if(record) {
    const [,companyId,kind,id]=record
    if(kind==='records'&&!id&&request.method!=='POST'){name='envelope.records.list';args={companyId,...page()}}
    else if(kind!=='records'&&!id&&request.method==='POST') {
      if(url.search)throw new PayrollError('invalid_draft_input')
      if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new PayrollError('unsupported_content_type',415)
      const value=await read();if(Object.hasOwn(value,'companyId'))throw new PayrollError('invalid_draft_input')
      name=kind==='drafts'?'envelope.draft.prepare':'envelope.bonus.prepare'
      const definition=catalogue.find(tool=>tool.name===name)!
      if(Object.keys(value).some(key=>!Object.hasOwn(definition.properties,key)))throw new PayrollError('invalid_draft_input')
      args={...value,companyId,idempotency_key:'rest:'+name+':'+String(value.requestKey??crypto.randomUUID())};status=201
    } else if(kind!=='records'&&id&&request.method!=='POST') {
      if(url.search)throw new PayrollError('invalid_draft_input')
      name=kind==='drafts'?'envelope.draft.read':'envelope.bonus.read';args={companyId,[kind==='drafts'?'draftId':'runId']:id}
    } else throw new PayrollError('agent_tool_denied',403)
  } else throw new PayrollError('agent_tool_denied',403)
  const result=await envelopeDoor(env).invoke(name,args,{person:{id:agent.grant.sponsor_id},agent:{id:agent.grant.id,name:agent.grant.name,specialist:'payroll'},clientId:agent.grant.id,scopes:originalScopes})
  if(result.outcome==='done')return request.method==='HEAD'?new Response(null,{headers}):Response.json(result.result,{status,headers})
  const code=result.code??'approval_required',fields={...result.fields},nativeStatus=Number(fields.native_status)
  delete fields.native_status
  if(typeof fields.setup_url==='string'&&!fields.setupLink)fields.setupLink=fields.setup_url
  const failure=Number.isInteger(nativeStatus)&&nativeStatus>=400&&nativeStatus<=599?nativeStatus:['idempotency_conflict','revision_conflict'].includes(code)?409:code==='invalid_arguments'?400:code==='unauthenticated'?401:code==='execution_failed'?500:403
  return Response.json({error:code,...fields,...(result.approval?{approval:result.approval}:{})},{status:failure,headers})
}
