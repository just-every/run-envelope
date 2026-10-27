import type { Actor } from './access'
import type { Input } from './records'
import { Notices } from './notices'
import { WorkerPrivacy } from './worker-privacy'
import { PayrollError, date, text, recordKey, unseal } from './security'
import { WorkspaceStore, choice, revision } from './workspace/store'
import type { EarningsRun } from './workspace/pay-items'
import type { WorkDay } from './workspace/allocations'
import type { PayrollRule } from './workspace/rules'

export interface Document { pdf:string; sha256:string; quote:string }
interface Facts {
  type:string; agency:string; periodStart:string; periodEnd:string; dueOn:string
  principalCents:number; proposedPenaltyCents:number; state:string; ratePercent:string; effectiveFrom:string
}
interface Evidence { kind:string; reference:string; document:Document; recordedBy:string; recordedAt:number; amountCents:number|null; disposition:{residualCents:number;assessedPenaltyCents:number;abatedPenaltyCents:number}|null }
export interface SuiAssessment {
  noticeId:string; noticeVersion:number; originalSha256:string; ruleId:string; ruleVersion:number
  state:string; ratePercent:string; wageBaseCents:number; wageBaseSourceUrl:string; wageBaseReference:string
  yearToDateWagesCents:number; yearToDateEvidence:string; currentWagesCents:number; taxableWagesCents:number
  employerLiabilityCents:number; employeeDeductionCents:0; paid:false
}
export interface TaxNoticeCase {
  sourceDigest:string; original:Document; rawExtraction:string; facts:Facts; correctionReason:string
  ownerId:string; ownerName:string; status:'open'|'closure-reported'|'reopened'
  evidence:Evidence[]; residualCents:number|null; assessedPenaltyCents:number|null; abatedPenaltyCents:number|null
  rate:{id:string;version:number}|null
}
const checked=(value:unknown)=>value===true || value==='true'
function amount(value:unknown) {
  const n=typeof value==='string' && /^\d+$/.test(value)?Number(value):value
  if(!Number.isSafeInteger(n) || Number(n)<0 || Number(n)>100000000) throw new PayrollError('explicit_notice_amount_required')
  return Number(n)
}
function paragraph(value:unknown,max=12000) {
  if(typeof value!=='string' || !value.trim() || value.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new PayrollError('invalid_notice_text')
  return value.trim()
}
export async function noticeDocument(input:Input):Promise<Document> {
  const pdf=text(input.pdf,512000)
  let binary:string
  try { binary=atob(pdf) } catch { throw new PayrollError('notice_pdf_required') }
  if(!binary.startsWith('%PDF-') || !binary.trimEnd().endsWith('%%EOF')) throw new PayrollError('notice_pdf_required')
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')
  return {pdf,sha256,quote:paragraph(input.quote,4000)}
}
/** Human-reviewed source custody. No agency, payment or payroll authority is inferred. */
export class TaxNoticeCases {
  constructor(public store:WorkspaceStore) {}
  async authority(actor:Actor,id:string) {
    new WorkerPrivacy(this.store.records).owner(actor)
    return new Notices(this.store.records).notice(actor,id)
  }
  async history(actor:Actor,id:string) {
    await this.authority(actor,id)
    const rows=(await this.store.list<TaxNoticeCase>(actor,'tax-notice-case')).filter(r=>r.id===id)
    return rows.map(r=>({...r,data:{...r.data,original:{...r.data.original,pdf:undefined},evidence:r.data.evidence.map(e=>({...e,document:{...e.document,pdf:undefined}}))},
      resolved:false,independentlyVerifiedAgencyDisposition:false,payrollChanged:false,
      overdue:r.data.facts.dueOn<new Date().toISOString().slice(0,10),
      nextAction:r.data.facts.dueOn<new Date().toISOString().slice(0,10)?'Urgent named-human follow-up; missed response deadline retained.':r.data.status==='closure-reported'?'Verify the reported agency disposition and remaining liability.':'Named human must reconcile evidence and respond before the agency deadline.'}))
  }
  async current(actor:Actor,id:string) {
    await this.authority(actor,id)
    return this.store.find<TaxNoticeCase>(actor,'tax-notice-case',id)
  }
  async employer(actor:Actor,ein:unknown) {
    const row=await this.store.records.statement('SELECT ein_cipher FROM env_companies WHERE id=?',[actor.company]).first<{ein_cipher:string}>()
    const expected=await unseal(await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'ein']),row!.ein_cipher)
    if(text(ein).replaceAll('-','')!==expected.replaceAll('-','')) throw new PayrollError('notice_employer_mismatch',409)
  }
  facts(input:Input):Facts {
    const type=choice(input.type,['sui-rate','deposit-mismatch']),periodStart=date(input.periodStart),periodEnd=date(input.periodEnd),dueOn=date(input.dueOn)
    if(periodEnd<periodStart) throw new PayrollError('invalid_notice_period')
    const ratePercent=type==='sui-rate'?text(input.ratePercent,20):''
    if(type==='sui-rate' && (!/^\d+(\.\d{1,6})?$/.test(ratePercent) || Number(ratePercent)>100)) throw new PayrollError('invalid_notice_rate')
    return {type,agency:text(input.agency),periodStart,periodEnd,dueOn,principalCents:amount(input.principalCents),proposedPenaltyCents:amount(input.proposedPenaltyCents),
      state:type==='sui-rate'?choice(input.state,'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')):'US',ratePercent,effectiveFrom:type==='sui-rate'?date(input.effectiveFrom):''}
  }
  async save(actor:Actor,id:string,input:Input) {
    const notice=await this.authority(actor,id)
    await this.employer(actor,input.employerEin)
    if(!checked(input.verifiedExtraction)) throw new PayrollError('human_extraction_verification_required',409)
    const expected=revision(input.version),rows=await this.store.list<TaxNoticeCase>(actor,'tax-notice-case'),prior=rows.find(r=>r.id===id)
    if((prior?.version ?? 0)!==expected) throw new PayrollError('notice_case_changed',409)
    if(prior?.data.status==='closure-reported') throw new PayrollError('reopen_before_correction',409)
    const original=prior?.data.original ?? await noticeDocument(input),rawExtraction=prior?.data.rawExtraction ?? paragraph(input.rawExtraction)
    if(prior && (input.pdf!==undefined || input.rawExtraction!==undefined)) throw new PayrollError('original_notice_immutable',409)
    const correctionReason=prior?paragraph(input.correctionReason,1000):'Initial human verification against retained original.'
    const data:TaxNoticeCase={sourceDigest:notice.digest,original,rawExtraction,facts:this.facts(input),correctionReason,
      ownerId:actor.session.operator.id,ownerName:actor.session.operator.displayName,status:prior?.data.status ?? 'open',evidence:prior?.data.evidence ?? [],
      residualCents:null,assessedPenaltyCents:null,abatedPenaltyCents:null,rate:null}
    return this.store.append(actor,'tax-notice-case',id,expected,data)
  }
  async review(actor:Actor,id:string) {
    await this.authority(actor,id)
    const row=await this.store.review<TaxNoticeCase>(actor,'tax-notice-case',id)
    return {version:row.version,reviewToken:row.reviewToken,history:await this.history(actor,id)}
  }
  async approve(actor:Actor,id:string,input:Input) {
    await this.authority(actor,id)
    return this.store.decide(actor,'tax-notice-case',id,input)
  }
  async evidence(actor:Actor,id:string,input:Input) {
    const row=await this.current(actor,id)
    await this.employer(actor,input.employerEin)
    if(date(input.periodStart)!==row.data.facts.periodStart || date(input.periodEnd)!==row.data.facts.periodEnd) throw new PayrollError('notice_evidence_period_mismatch',409)
    const kind=choice(input.kind,['deposit','agency-response','reopening']),reference=text(input.reference,240),doc=await noticeDocument(input)
    const disposition=kind==='agency-response'?{residualCents:amount(input.residualCents),assessedPenaltyCents:amount(input.assessedPenaltyCents),abatedPenaltyCents:amount(input.abatedPenaltyCents)}:null
    if(disposition && (!checked(input.reviewedAgencyEvidence) || disposition.abatedPenaltyCents>disposition.assessedPenaltyCents)) throw new PayrollError('agency_evidence_review_required',409)
    const entry:Evidence={kind,reference,document:doc,recordedBy:actor.session.operator.id,recordedAt:Date.now(),amountCents:kind==='deposit'?amount(input.amountCents):null,disposition}
    const old=row.data.evidence.find(e=>e.reference===reference)
    if(old) {
      if(JSON.stringify({...old,recordedBy:'',recordedAt:0})!==JSON.stringify({...entry,recordedBy:'',recordedAt:0})) throw new PayrollError('conflicting_notice_evidence',409)
      return {id,version:row.version,replayed:true}
    }
    if(row.version!==revision(input.version)) throw new PayrollError('notice_case_changed',409)
    let data:TaxNoticeCase={...row.data,evidence:[...row.data.evidence,entry]}
    if(kind==='agency-response') {
      // Reported amounts never establish independent closure or erase the duty.
      data={...data,status:'closure-reported',...disposition!}
    } else if(kind==='reopening') data={...data,status:'reopened',residualCents:null,assessedPenaltyCents:null,abatedPenaltyCents:null,rate:null}
    else if(row.data.status==='closure-reported') throw new PayrollError('reopen_before_evidence',409)
    return this.store.append(actor,'tax-notice-case',id,row.version,data,undefined,false,{objects:data.rate?[{kind:'rule',id:data.rate.id,version:data.rate.version,approved:true}]:[]})
  }
  async linkRate(actor:Actor,id:string,input:Input) {
    const row=await this.current(actor,id)
    if(row.version!==revision(input.version) || !row.approvedBy || row.withdrawnBy || !row.sourcesCurrent || row.data.facts.type!=='sui-rate') throw new PayrollError('reviewed_rate_case_required',409)
    const rule=await this.store.find<PayrollRule>(actor,'rule',text(input.ruleId),undefined,true),facts=row.data.facts
    if(rule.version!==revision(input.ruleVersion) || !rule.approvedBy || rule.withdrawnBy || !rule.sourcesCurrent || rule.data.family!=='sui' || rule.data.determination!=='final' || rule.data.state!==facts.state || rule.data.unit!=='percent' || Number(rule.data.value)!==Number(facts.ratePercent) || rule.data.effectiveFrom!==facts.effectiveFrom || rule.data.sourceRef!==`notice:${id}:${row.data.original.sha256}`) throw new PayrollError('exact_reviewed_notice_rule_required',409)
    return this.store.append(actor,'tax-notice-case',id,row.version,{...row.data,rate:{id:rule.id,version:rule.version}},undefined,false,{objects:[{kind:'rule',id:rule.id,version:rule.version,approved:true}]})
  }
  async assessment(actor:Actor,person:string,run:EarningsRun,input:Input):Promise<SuiAssessment|null> {
    // A known applicable notice cannot be silently bypassed by omitting its ID.
    const history=await this.store.list<TaxNoticeCase>(actor,'tax-notice-case',undefined,true,false)
    const current=history.filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i)
    const candidates=current.filter(r=>r.data.facts.type==='sui-rate' && run.locationStates.includes(r.data.facts.state) && r.data.facts.effectiveFrom<=run.payDate)
    if(!candidates.length && !input.suiNoticeId) return null
    new WorkerPrivacy(this.store.records).owner(actor)
    if(candidates.length!==1 || candidates[0].id!==input.suiNoticeId) throw new PayrollError('exact_sui_notice_selection_required',409)
    const row=candidates[0],facts=row.data.facts,link=row.data.rate
    if(!link || !row.approvedBy || row.withdrawnBy || !row.sourcesCurrent || row.data.status==='closure-reported') throw new PayrollError('current_reviewed_sui_case_required',409)
    const rule=await this.store.find<PayrollRule>(actor,'rule',link.id,undefined,true)
    if(rule.version!==link.version || !rule.approvedBy || rule.withdrawnBy || !rule.sourcesCurrent || rule.data.family!=='sui' || rule.data.determination!=='final' || rule.data.unit!=='percent' || rule.data.state!==facts.state || rule.data.effectiveFrom!==facts.effectiveFrom || Number(rule.data.value)!==Number(facts.ratePercent) || rule.data.sourceRef!==`notice:${row.id}:${row.data.original.sha256}` || run.payDate<rule.data.effectiveFrom || run.payDate>rule.data.effectiveThrough || rule.data.taxYear!==Number(run.payDate.slice(0,4))) throw new PayrollError('current_reviewed_sui_rule_required',409)
    // This bounded application requires ordinary wages entirely sourced to one state.
    const work=await this.store.list<WorkDay>(actor,'work',person,true,false)
    const days=work.filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i).filter(r=>r.data.day>=run.periodStart && r.data.day<=run.periodEnd)
    if(run.locationStates.length!==1 || !days.length || days.some(r=>r.data.state!==facts.state)) throw new PayrollError('single_state_sui_wages_required',409)
    const wageBaseCents=amount(rule.data.details.wageBaseCents),yearToDateWagesCents=amount(input.suiYearToDateWagesCents)
    if(!wageBaseCents || !rule.data.details.wageBaseSourceUrl || !rule.data.details.wageBaseReference) throw new PayrollError('reviewed_sui_wage_base_required',409)
    const worker=run.people.find(p=>p.id===person)!,currentWagesCents=worker.taxableCashCents
    const taxableWagesCents=Math.min(currentWagesCents,Math.max(0,wageBaseCents-yearToDateWagesCents))
    const [whole,fraction='']=facts.ratePercent.split('.'),rate=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'))
    const employerLiabilityCents=Number((BigInt(taxableWagesCents)*rate+50000000n)/100000000n)
    return {noticeId:row.id,noticeVersion:row.version,originalSha256:row.data.original.sha256,ruleId:rule.id,ruleVersion:rule.version,state:facts.state,ratePercent:facts.ratePercent,wageBaseCents,wageBaseSourceUrl:rule.data.details.wageBaseSourceUrl,wageBaseReference:rule.data.details.wageBaseReference,yearToDateWagesCents,yearToDateEvidence:text(input.suiYearToDateEvidence,1000),currentWagesCents,taxableWagesCents,employerLiabilityCents,employeeDeductionCents:0,paid:false}
  }
  async original(actor:Actor,id:string,version:number,index:number) {
    await this.authority(actor,id)
    const rows=await this.store.list<TaxNoticeCase>(actor,'tax-notice-case'),row=rows.find(r=>r.id===id && r.version===version)
    const doc=index===0?row?.data.original:row?.data.evidence[index-1]?.document
    if(!doc) throw new PayrollError('notice_original_unavailable',404)
    return Uint8Array.from(atob(doc.pdf),c=>c.charCodeAt(0))
  }
}
