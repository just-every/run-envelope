import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Records,Company,Input } from '../records'
import { requireAction } from '../access'
import { PayrollError } from '../security'
import { companyPath } from '../pages'
import { WorkspaceStore } from '../workspace/store'
import type { IncomeSource } from '../income-verification/requests'
import { ClaimsRecords } from './records'
import { resolveClaimForm } from './form-input'
import { claimsPage,claimDetailPage,claimReviewPage,type ClaimPayrollOption } from './pages'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}
const json=(v:unknown,status=200)=>Response.json(v,{status,headers})
const redirect=(location:string)=>new Response(null,{status:303,headers:{...headers,location}})
interface Context {ui:boolean;post:boolean;parts:string[];value:Input;records:Records;session:Session;companies:Company[]}
export async function claimsResponse({ui,post,parts,value,records,session,companies}:Context):Promise<Response|null>{
 if(parts[0]!=='companies'||parts[2]!=='claims')return null
 const actor=await records.actor(parts[1]),store=new WorkspaceStore(records),claims=new ClaimsRecords(store),base=companyPath(actor.company)+'/claims'
 const f=claims.lifecycle.scope(actor)
 const representatives=async()=> (await records.statement(`SELECT o.id,o.display_name AS name FROM oa_operators o JOIN env_grants g ON g.operator_id=o.id WHERE o.status='active' AND g.company_id=? AND g.role='owner' AND g.revoked_at IS NULL AND ${f.sql} ORDER BY o.display_name`,[actor.company,...f.args]).all<{id:string;name:string}>()).results
 if(parts.length===3&&!post){const rows=await claims.list(actor);return ui?claimsPage(session,companies,actor,rows,await representatives()):json(rows)}
 if(parts.length===4&&parts[3]==='import'&&post){const result=await claims.importRequest(actor,await resolveClaimForm('import',value,actor,store));return ui?redirect(base+'/'+result.id):json(result,201)}
 const id=parts[3];if(!id)throw new PayrollError('not_found',404)
 if(parts.length===4&&!post){
  const row=await claims.details(actor,id);if(!ui)return json(row)
  const people=await records.people(actor),payroll:ClaimPayrollOption[]=[]
  for(const person of people){for(const source of await store.list<IncomeSource>(actor,'income-source',person.id,true))if(source.approvedBy&&!source.withdrawnBy&&source.sourcesCurrent)payroll.push({kind:'income-source',id:source.id,version:source.version,personId:person.id,label:person.name+' · '+source.data.sourceRef,from:source.data.from,through:source.data.through,grossCents:source.data.grossCents})}
  return claimDetailPage(session,companies,actor,row,people,await representatives(),payroll,await claims.history(actor,id))
 }
 if(parts.length===5&&!post&&parts[4]==='review'){const review=await claims.review(actor,id);return ui?claimReviewPage(session,companies,actor,review):json(review)}
 if(!post&&parts.length===7&&parts[4]==='versions'&&parts[6]==='packet'){
  requireAction(actor,'export',undefined,'tax');requireAction(actor,'export',undefined,'ssn')
  const version=Number(parts[5]),row=(await claims.history(actor,id)).find(r=>r.version===version)
  if(!row?.data.signature||!row.data.packet)throw new PayrollError('signed_claim_packet_required',404)
  return new Response(row.data.packet.packetHtml,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-disposition':'attachment; filename="earlier-signed-claim-response.html"'}})
 }
 if(!post&&(parts.length===5&&parts[4]==='packet'||parts.length===6&&parts[4]==='artifacts')){
  requireAction(actor,'export',undefined,'tax');requireAction(actor,'export',undefined,'ssn')
  const row=await claims.details(actor,id)
  if(parts[4]==='packet'){
   if(!row.data.signature||!row.data.packet)throw new PayrollError('signed_claim_packet_required',409)
   return new Response(row.data.packet.packetHtml,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-disposition':'attachment; filename="signed-claim-response.html"'}})
  }
  const file=row.data.artifacts.find(a=>a.id===parts[5]);if(!file)throw new PayrollError('claim_artifact_not_found',404)
  return new Response(Uint8Array.from(atob(file.contentBase64),c=>c.charCodeAt(0)),{headers:{...headers,'content-type':['application','octet-stream'].join('/'),'content-security-policy':"sandbox; default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'x-download-options':'noopen','content-disposition':'attachment; filename="'+file.name.replace(/[^A-Za-z0-9._-]/g,'_')+'"'}})
 }
 if(parts.length===5&&post){
  if(value.claimId&&value.claimId!==id)throw new PayrollError('claim_identity_mismatch',409)
  const action=parts[4],input=await resolveClaimForm(action,{...value,claimId:id},actor,store)
  const methods={evidence:()=>claims.evidence(actor,id,input),prepare:()=>claims.prepare(actor,id,input),sign:()=>claims.sign(actor,id,input),'portal-review':()=>claims.portalReview(actor,id,input),handoff:()=>claims.handoff(actor,id,input),confirmation:()=>claims.confirmation(actor,id,input),'follow-up':()=>claims.followUp(actor,id,input),'begin-follow-up':()=>claims.beginFollowUp(actor,id,input),escalate:()=>claims.escalate(actor,id,input)}
  const method=methods[action as keyof typeof methods];if(!method)throw new PayrollError('not_found',404)
  const result=await method();return ui?redirect(base+'/'+id):json(result)
 }
 throw new PayrollError('not_found',404)
}
