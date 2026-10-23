import { zero } from '../leave/ledger'
import { auditStatement, fence, requireAction, type Actor } from '../access'
import type { Input } from '../records'
import { date, integer, text, recordKey, unseal, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, type Sources, type Revision } from '../workspace/store'
import type { IndustryCheck } from './records'
import { exportAgencyForm,exportAgencyCorrection,type AgencyCompany,type AgencyTotals,type AgencyFormExport,type AgencyCorrectionInput } from './agency-forms'
export interface IndustryReturn {
 form:'941'|'943';taxYear:number;quarter?:1|2|3|4;company:AgencyCompany;totals:AgencyTotals;employeeCount:number
 checks:{personId:string;id:string;version:number}[];corrects:string;export:AgencyFormExport;basis:string
}
const emptyTotals=():AgencyTotals=>({incomeTaxWagesCents:0,incomeTaxWithheldCents:0,socialSecurityWagesCents:0,socialSecurityTaxCents:0,medicareWagesCents:0,medicareTaxCents:0,additionalMedicareWagesCents:0,additionalMedicareTaxCents:0})
export class IndustryReturns {
 constructor(public store:WorkspaceStore){}
 async authority(actor:Actor,action='records:read'){
  if(!['native','oidc','password','dev'].includes(actor.session.kind))throw new PayrollError('human_session_required',403)
  await this.store.authority(actor,action,undefined,true);requireAction(actor,action,undefined,'tax');requireAction(actor,'private:read',undefined,'tax');requireAction(actor,'export',undefined,'tax')
 }
 async list(actor:Actor){await this.authority(actor);return this.store.list<IndustryReturn>(actor,'industry-return',undefined,true)}
 async checks(actor:Actor){await this.authority(actor);const people=await this.store.records.people(actor);const rows=await Promise.all(people.map(async p=>({person:p,checks:await this.store.list<IndustryCheck>(actor,'industry-check',p.id,true)})));return rows}
 async entity(actor:Actor,input:Input):Promise<AgencyCompany>{
  requireAction(actor,'export',undefined,'tax');requireAction(actor,'private:read',undefined,'tax')
  const f=fence(actor),event=crypto.randomUUID(),records=this.store.records
  const result=await records.env.DB.batch<Record<string,unknown>>([
   auditStatement(records.env,actor,event,'industry.return.identity.read',actor.company,actor.grant.version),
   records.statement(`SELECT name,ein_cipher FROM env_companies WHERE id=? AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?)`,[actor.company,...f.args,event]),
  ])
  const row=result[1].results[0];if(!row)throw new PayrollError('authority_changed',409)
  const ein=await unseal(await recordKey(records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'ein']),String(row.ein_cipher))
  const address=input.address as AgencyCompany['address']
  if(!address||typeof address!=='object')throw new PayrollError('employer_mailing_address_required')
  return {ein,legalName:String(row.name),address}
 }
 async prepare(actor:Actor,input:Input){
  await this.authority(actor,'rates:propose')
  const form=text(input.form) as '941'|'943',taxYear=integer(input.taxYear),quarter=form==='941'?integer(input.quarter) as 1|2|3|4:undefined
  if(!['941','943'].includes(form)||![2025,2026].includes(taxYear))throw new PayrollError('unsupported_return_period')
  const selections=input.checks
  if(!Array.isArray(selections)||!selections.length||selections.length>200)throw new PayrollError('reviewed_checks_required')
  const checks:IndustryReturn['checks']=[],totals=emptyTotals(),workers=new Set<string>(),dependencies:NonNullable<Sources['objects']>=[],seen=new Set<string>()
  for(const selection of selections){
   const s=selection as Input,personId=objectId(s.personId),id=objectId(s.id),version=integer(s.version)
   const row=await this.store.find<IndustryCheck>(actor,'industry-check',id,personId,true)
   requireAction(actor,'records:read',(await this.store.records.person(actor,personId)).locationId,'tax')
   if(row.version!==version||!row.approvedBy||row.withdrawnBy||!row.sourcesCurrent)throw new PayrollError('current_reviewed_check_required',409)
   const c=row.data,r=c.result,key=c.personId+':'+c.runId+':'+c.runVersion
   if(seen.has(key))throw new PayrollError('duplicate_payment_in_return',409);seen.add(key)
   if(r.taxYear!==taxYear||(quarter&&Math.floor((Number(r.payDate.slice(5,7))-1)/3)+1!==quarter))throw new PayrollError('check_outside_return_period')
   checks.push({personId,id,version});dependencies.push({kind:'industry-check',id,version,approved:true})
   if(r.formAssignment!==form)continue
   workers.add(personId)
   totals.incomeTaxWagesCents+=r.wages.w2Box1WagesCents;totals.incomeTaxWithheldCents+=r.employeeTaxes.incomeTaxCents
   totals.socialSecurityWagesCents+=r.wages.socialSecurityWagesCents;totals.socialSecurityTaxCents+=r.employeeTaxes.socialSecurityCents+r.employerTaxes.socialSecurityCents
   totals.medicareWagesCents+=r.wages.medicareWagesCents;totals.medicareTaxCents+=r.employeeTaxes.medicareCents+r.employerTaxes.medicareCents
   totals.additionalMedicareWagesCents+=r.wages.additionalMedicareWagesCents;totals.additionalMedicareTaxCents+=r.employeeTaxes.additionalMedicareCents
  }
  const company=await this.entity(actor,input),corrects=input.corrects?objectId(input.corrects):'',basis=text(input.basis,2000)
  // Line 1 counts the form's specified reference pay period; it is not the annual unique worker count.
  const employeeCount=zero(input.employeeCount)
  if(employeeCount>workers.size)throw new PayrollError('employee_count_exceeds_selected_workers')
  let output:AgencyFormExport
  if(corrects){
   const prior=await this.store.find<IndustryReturn>(actor,'industry-return',corrects,undefined,true)
   if(!prior.approvedBy||prior.withdrawnBy||prior.data.form!==form||prior.data.taxYear!==taxYear||prior.data.quarter!==quarter)throw new PayrollError('reviewed_matching_original_required',409)
   output=exportAgencyCorrection({form,taxYear,quarter,company,original:prior.data.totals,corrected:totals,discoveredOn:date(input.discoveredOn),reason:text(input.reason,3000),process:input.process as 'adjustment'|'claim',w2FiledOrWillFile:input.w2FiledOrWillFile===true||input.w2FiledOrWillFile==='true'?true:false as true,certifications:input.certifications as AgencyCorrectionInput['certifications'],priorYearWithholdingAdministrativeError:input.priorYearWithholdingAdministrativeError===true?true:undefined})
  }else output=exportAgencyForm({form,taxYear,quarter,company,totals,employeeCount,depositsCents:zero(input.depositsCents),seasonal:input.seasonal===true,monthlyLiabilityCents:input.monthlyLiabilityCents as number[]|undefined})
  const data:IndustryReturn={form,taxYear,quarter,company,totals,employeeCount,checks,corrects,export:output,basis}
  return this.store.append(actor,'industry-return',objectId(input.id),revision(input.version),data,undefined,true,{objects:dependencies})
 }
 async review(actor:Actor,id:string){await this.authority(actor,'rates:approve');requireAction(actor,'export',undefined,'tax');return this.store.review<IndustryReturn>(actor,'industry-return',id)}
 async decide(actor:Actor,id:string,input:Input){await this.authority(actor,'rates:approve');return this.store.decide(actor,'industry-return',id,input)}
 async download(actor:Actor,id:string){
  await this.authority(actor);requireAction(actor,'export',undefined,'tax');requireAction(actor,'private:read',undefined,'tax')
  const row=await this.store.find<IndustryReturn>(actor,'industry-return',id,undefined,true)
  if(!row.approvedBy||row.withdrawnBy||!row.sourcesCurrent)throw new PayrollError('reviewed_current_form_required',409)
  for(const c of row.data.checks){const check=await this.store.find<IndustryCheck>(actor,'industry-check',c.id,c.personId,true);if(!check.sourcesCurrent||check.withdrawnBy||!check.approvedBy)throw new PayrollError('return_check_source_changed',409)}
  return row
 }
}
