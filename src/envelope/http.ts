import type { Bindings } from '../auth.server'
import type { OperatorAuth } from '../modules/operator-auth/index.mjs'
import { Records, type Input } from './records'
import { PayrollError } from './security'
import { companyIndex,companyPage,grantsPage,personPage,ratePage,errorPage,companyPath } from './pages'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const redirect=(location:string)=>new Response(null,{status:303,headers:{...headers,location}})
async function input(request:Request):Promise<Input> {
 if(!request.body)throw new PayrollError('invalid_input')
 const reader=request.body.getReader(),chunks:Uint8Array[]=[],limit=64000;let size=0
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new PayrollError('input_too_large',413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}
 const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes),type=request.headers.get('content-type')?.split(';')[0]
 if(type==='application/x-www-form-urlencoded') {
  const params=new URLSearchParams(body),result:Input={}
  for(const key of new Set(params.keys())){const values=params.getAll(key);result[key]=['actions','fields','locations'].includes(key)?values:values.length===1?values[0]:(()=>{throw new PayrollError('duplicate_input')})()}
  return result
 }
 if(type!=='application/json')throw new PayrollError('unsupported_content_type',415)
 try{const parsed=JSON.parse(body);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw 0;return parsed}catch{throw new PayrollError('invalid_input')}
}
/** Only real records are exposed. No placeholder bank-change/payroll endpoints. */
export async function payrollResponse(request:Request,env:Bindings,auth:OperatorAuth):Promise<Response|null> {
 const url=new URL(request.url),ui=url.pathname==='/app/envelope'||url.pathname.startsWith('/app/envelope/'),api=url.pathname.startsWith('/api/envelope/')
 if(!ui&&!api)return null
 let session
 try {
  if(url.origin!==env.AUTH_ORIGIN||request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())throw new PayrollError('invalid_host',403)
  if(!['GET','HEAD','POST'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD, POST'}})
  session=await auth.getSession(request)
  if(!session)return ui&&request.method!=='POST'?redirect('/signin?returnTo=%2Fapp%2Fenvelope'):json({error:'authentication_required'},401)
  if(!['native','oidc','dev'].includes(session.kind))throw new PayrollError('human_session_required',403)
  if(!await env.DB.prepare('SELECT singleton FROM oa_first_run WHERE singleton=1').first())throw new PayrollError('finish_setup_required',409)
  if(request.method==='POST'&&(request.headers.get('origin')!==env.AUTH_ORIGIN||request.headers.get('sec-fetch-site')==='cross-site'))throw new PayrollError('invalid_origin',403)
  const parts=(ui?url.pathname.slice('/app/envelope'.length)||'/companies':url.pathname.slice('/api/envelope'.length)).split('/').filter(Boolean)
  if(parts.some(p=>!/^[-a-zA-Z0-9]+$/.test(p)))throw new PayrollError('not_found',404)
  const records=new Records(env,session),post=request.method==='POST',value=post?await input(request):{},companies=ui?await records.companies():[]
  let response:Response
  if(parts[0]!=='companies')throw new PayrollError('not_found',404)
  if(parts.length===1) {
   if(post){const company=await records.createCompany(value);response=ui?redirect(companyPath(company.id)):json(company,201)}
   else response=ui?companyIndex(session,companies):json(await records.companies())
  } else {
   const companyId=parts[1],actor=await records.actor(companyId),tail=parts.slice(2),base=companyPath(companyId)
   if(!tail.length&&!post) {
    const company=await records.company(actor),locations=await records.locations(actor),people=actor.grant.role==='owner'||actor.grant.actions.includes('records:read')?await records.people(actor):[]
    response=ui?companyPage(session,companies,company,actor,locations,people):json({company,locations,people})
   } else if(tail.join('/')==='locations'&&post) {
    const location=await records.createLocation(actor,value);response=ui?redirect(base):json(location,201)
   } else if(tail.join('/')==='grants') {
    if(post){const grant=await records.setGrant(actor,value);response=ui?redirect(`${base}/grants`):json(grant)}
    else{const grants=await records.grants(actor);response=ui?grantsPage(session,companies,actor,await records.locations(actor),grants,await auth.listOperators(request)):json(grants)}
   } else if(tail.join('/')==='people'&&post) {
    const person=await records.createPerson(actor,value);response=ui?redirect(`${base}/people/${person.id}`):json(person,201)
   } else if(tail[0]==='people'&&tail.length===2&&!post) {
    const person=await records.details(actor,tail[1]);response=ui?personPage(session,companies,actor,person):json(person)
   } else if(tail[0]==='people'&&tail[2]==='private'&&tail.length===3&&post) {
    const stored=await records.savePrivate(actor,tail[1],value);response=ui?redirect(`${base}/people/${tail[1]}`):json(stored,201)
   } else if(!ui&&tail[0]==='people'&&tail[2]==='private'&&tail.length===4&&!post) {
    const privateValue=await records.readPrivate(actor,tail[1],tail[3]);response=new Response(privateValue,{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':'attachment; filename="private-record.txt"'}})
   } else if(tail[0]==='people'&&tail[2]==='rates'&&tail.length===3&&post) {
    const proposal=await records.proposeRate(actor,tail[1],value);response=ui?redirect(actor.grant.role==='owner'||actor.grant.actions.includes('rates:approve')?`${base}/rates/${proposal.id}`:`${base}/people/${tail[1]}`):json(proposal,201)
   } else if(tail[0]==='rates'&&tail.length===2&&!post) {
    const proposal=await records.reviewRate(actor,tail[1]);response=ui?ratePage(session,companies,actor,proposal):json(proposal)
   } else if(tail[0]==='rates'&&tail[2]==='approve'&&tail.length===3&&post) {
    const approved=await records.approveRate(actor,tail[1],value);response=ui?redirect(base):json(approved)
   } else if(!ui&&tail.join('/')==='audit'&&!post) {
    response=json(await records.audit(actor));response.headers.set('content-disposition','attachment; filename="payroll-audit.json"')
   } else if(!ui&&tail.join('/')==='export'&&!post) {
    response=new Response(await records.export(actor),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="record-register.csv"'}})
   } else throw new PayrollError('not_found',404)
  }
  return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response
 } catch(error) {
  const known=error instanceof PayrollError,code=known?error.code:'payroll_unavailable',status=known?error.status:503
  if(ui&&session){const response=errorPage(session,code);return new Response(request.method==='HEAD'?null:response.body,{status,headers:response.headers})}
  return request.method==='HEAD'?new Response(null,{status,headers}):json({error:code},status)
 }
}
