import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Records,Company,Input } from '../records'
import { PayrollError,integer } from '../security'
import { companyPath } from '../pages'
import { WorkspaceStore } from '../workspace/store'
import { PayItems } from '../workspace/pay-items'
import { IndustryRecords } from './records'
import { IndustryReturns } from './returns'
import { classificationForm,checkForm } from './form-input'
import { industryPersonPage,industryReviewPage } from './pages'
import { returnsPage,returnReviewPage } from './return-pages'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}
const json=(v:unknown,status=200)=>Response.json(v,{status,headers})
const redirect=(location:string)=>new Response(null,{status:303,headers:{...headers,location}})
interface Context {ui:boolean;post:boolean;parts:string[];value:Input;records:Records;session:Session;companies:Company[]}
export async function industryResponse({ui,post,parts,value,records,session,companies}:Context):Promise<Response|null>{
 if(parts[0]!=='companies'||!(parts[2]==='industry-returns'||parts[2]==='people'&&parts[4]==='industry'))return null
 const actor=await records.actor(parts[1]),store=new WorkspaceStore(records),industry=new IndustryRecords(store),returns=new IndustryReturns(store)
 if(parts[2]==='industry-returns'){
  const base=companyPath(actor.company)+'/industry-returns'
  if(parts.length===3){
   if(post){const checks=ui?(Array.isArray(value.checks)?value.checks:[value.checks]).filter(Boolean).map(v=>{const [personId,id,version]=String(v).split(':');return{personId,id,version:Number(version)}}):value.checks
    const data=await returns.prepare(actor,{...value,checks,address:ui?{street:value.street,city:value.city,state:value.state,postalCode:value.postalCode}:value.address,certifications:value.certifications??[],seasonal:value.seasonal===true||value.seasonal==='true',priorYearWithholdingAdministrativeError:value.priorYearWithholdingAdministrativeError===true||value.priorYearWithholdingAdministrativeError==='true'});return ui?redirect(base):json(data,201)}
   return ui?returnsPage(session,companies,actor,await returns.list(actor),await returns.checks(actor)):json(await returns.list(actor))
  }
  if(parts.length===5){const id=parts[3]
   if(parts[4]==='review'&&!post){const row=await returns.review(actor,id);return ui?returnReviewPage(session,companies,actor,row):json(row)}
   if(parts[4]==='decision'&&post){const row=await returns.decide(actor,id,value);return ui?redirect(base):json(row)}
   if(parts[4]==='download'&&!post){const row=await returns.download(actor,id);return new Response(row.data.export.xml,{headers:{...headers,'content-type':row.data.export.mediaType+'; charset=utf-8','content-disposition':`attachment; filename="form-${row.data.form}-${row.data.taxYear}.xfdf"`}})}
  }
  throw new PayrollError('not_found',404)
 }
 const personId=parts[3],person=await industry.scope(actor,personId),base=companyPath(actor.company)+'/people/'+personId+'/industry'
 if(parts.length===5&&!post){const data=await industry.list(actor,personId);return ui?industryPersonPage(session,companies,actor,person,data,(await new PayItems(store).read(actor)).runs):json(data)}
 if(parts.length===6&&post){
  if(parts[5]==='classification'){const row=await industry.save(actor,personId,classificationForm(value));return ui?redirect(base):json(row,201)}
  if(parts[5]==='checks'){let body=checkForm(value);if(ui){const [runId,runVersion]=String(value.runSelection).split(':');body={...body,runId,runVersion:integer(runVersion)}}const row=await industry.preview(actor,personId,body);return ui?redirect(base):json(row,201)}
 }
 if(parts.length===8&&['industry-classification','industry-check'].includes(parts[6])){
  const kind=parts[6] as 'industry-classification'|'industry-check',id=parts[7]
  if(parts[5]==='review'&&!post){const row=await industry.review(actor,personId,kind,id);return ui?industryReviewPage(session,companies,actor,person,row):json(row)}
  if(parts[5]==='decision'&&post){const row=await industry.decide(actor,personId,kind,id,value);return ui?redirect(base):json(row)}
 }
 throw new PayrollError('not_found',404)
}
