import { federalIncomeTax } from './industry/federal-withholding'
import type { IndustryPayInput, FederalW4, ModernW4 } from './industry/types'
import type { Actor } from './access'
import type { Input } from './records'
import { PayrollError,date,text } from './security'
import { WorkerPrivacy } from './worker-privacy'
import { TaxNoticeCases,noticeDocument,type Document } from './tax-notices'
import { WorkspaceStore,choice,digest,revision } from './workspace/store'
import { collectionPins } from './workspace/review-inputs'

export interface WithholdingInstruction {
  kind:string; original:Document; receivedOn:string; letterOn:string; effectiveFrom:string
  filingStatus:string; maximumAllowances:number; minimumAdditionalCents:number
  modernSettings?:ModernW4|null
  identityVersion:number; identityDigest:string; authenticationMethod:string; authenticationReference:string
  priorVersion:number; recordedByName:string
}
const amount=(value:unknown,max:number)=>{
  const n=typeof value==='string' && /^\d+$/.test(value)?Number(value):value
  if(!Number.isSafeInteger(n) || Number(n)<0 || Number(n)>max) throw new PayrollError('invalid_lock_in_settings')
  return Number(n)
}
/** Retained human-authenticated instructions; calculated previews convey no payment authority. */
export class WithholdingInstructions {
  constructor(public store:WorkspaceStore) {}
  owner(actor:Actor) {new WorkerPrivacy(this.store.records).owner(actor)}
  id(person:string) {return 'lock-in-'+person}
  async identity(actor:Actor,person:string) {
    return digest((await this.store.records.readPrivate(actor,person,'ssn')).replaceAll('-',''))
  }
  async identityVersion(actor:Actor,person:string) {
    await this.store.records.person(actor,person)
    const row=await this.store.records.statement("SELECT version FROM env_private_records WHERE company_id=? AND person_id=? AND kind='ssn'",[actor.company,person]).first<{version:number}>()
    if(!row) throw new PayrollError('lock_in_identity_reconciliation_required',409)
    return row.version
  }
  identityFence(actor:Actor,person:string,version:number) {
    return {sql:"EXISTS(SELECT 1 FROM env_private_records WHERE company_id=? AND person_id=? AND kind='ssn' AND version=?)",args:[actor.company,person,version]}
  }
  async checkedIdentity(actor:Actor,person:string) {
    const row=await this.store.find<WithholdingInstruction>(actor,'withholding-instruction',this.id(person),person)
    if(row.data.identityVersion!==await this.identityVersion(actor,person) || row.data.identityDigest!==await this.identity(actor,person)) throw new PayrollError('lock_in_identity_reconciliation_required',409)
    return this.identityFence(actor,person,row.data.identityVersion)
  }
  async history(actor:Actor,person:string) {
    this.owner(actor)
    const rows=await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person)
    const identityVersion=rows.length?await this.identityVersion(actor,person):0
    return rows.map(row=>({...row,sourcesCurrent:row.sourcesCurrent && row.data.identityVersion===identityVersion?1:0,data:{...row.data,identityVersion:undefined,identityDigest:undefined,original:{...row.data.original,pdf:undefined}}}))
  }
  async save(actor:Actor,person:string,input:Input) {
    this.owner(actor)
    await new TaxNoticeCases(this.store).employer(actor,input.employerEin)
    if(input.authenticated!==true && input.authenticated!=='true') throw new PayrollError('authenticated_irs_original_required',409)
    const identityVersion=await this.identityVersion(actor,person),identityDigest=await this.identity(actor,person)
    if(!/^\d{3}-?\d{2}-?\d{4}$/.test(text(input.workerSsn)) || await digest(text(input.workerSsn).replaceAll('-',''))!==identityDigest) throw new PayrollError('lock_in_worker_mismatch',409)
    const rows=await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person),expected=revision(input.version)
    if((rows[0]?.version ?? 0)!==expected) throw new PayrollError('lock_in_changed',409)
    const kind=choice(input.kind,['2800C','modification','release']),prior=rows.find(r=>r.approvedBy && !r.withdrawnBy)
    if(prior && prior.data.identityDigest!==identityDigest) throw new PayrollError('lock_in_identity_reconciliation_required',409)
    if(kind!=='2800C' && !prior) throw new PayrollError('approved_lock_in_required',409)
    if(kind==='2800C' && prior) throw new PayrollError('irs_modification_required',409)
    const receivedOn=date(input.receivedOn),letterOn=date(input.letterOn),effectiveFrom=date(input.effectiveFrom)
    if(receivedOn>new Date().toISOString().slice(0,10) || letterOn>receivedOn || (kind==='2800C' && effectiveFrom!==new Date(Date.parse(letterOn+'T00:00:00Z')+60*86400000).toISOString().slice(0,10)) || (kind!=='2800C' && effectiveFrom!==receivedOn)) throw new PayrollError('invalid_lock_in_effective_date')
    const format=choice(input.settingsFormat??'legacy',['legacy','current'])
    const modernSettings:ModernW4|null=kind!=='release' && format==='current'?{
      version:'2020_or_later',filingStatus:choice(input.filingStatus,['single','married','head-of-household'])==='married'?'married_joint':input.filingStatus==='head-of-household'?'head_household':'single',
      step2Checked:choice(input.multipleJobs,['yes','no'])==='yes',
      step3AnnualCreditsCents:amount(input.dependentCreditCents,100000000),step4aOtherIncomeCents:amount(input.otherIncomeCents,100000000),
      step4bDeductionsCents:amount(input.deductionsCents,100000000),step4cExtraWithholdingCents:amount(input.minimumAdditionalCents,100000000),
    }:null
    const data:WithholdingInstruction={kind,original:await noticeDocument(input),receivedOn,letterOn,effectiveFrom,
      modernSettings,filingStatus:kind==='release'?'':choice(input.filingStatus,modernSettings?['single','married','head-of-household']:['single','married','married-withhold-single']),
      maximumAllowances:kind==='release'||modernSettings?0:amount(input.maximumAllowances,99),minimumAdditionalCents:kind==='release'?0:amount(input.minimumAdditionalCents,100000000),
      identityVersion,identityDigest,authenticationMethod:choice(input.authenticationMethod,['agency-portal','verified-agency-correspondence']),authenticationReference:text(input.authenticationReference,500),
      priorVersion:prior?.version ?? 0,recordedByName:actor.session.operator.displayName}
    return this.store.append(actor,'withholding-instruction',this.id(person),expected,data,person,false,{condition:this.identityFence(actor,person,identityVersion)})
  }
  async review(actor:Actor,person:string) {
    this.owner(actor)
    const condition=await this.checkedIdentity(actor,person)
    const row=await this.store.review<WithholdingInstruction>(actor,'withholding-instruction',this.id(person),person,condition)
    return {version:row.version,reviewToken:row.reviewToken,history:await this.history(actor,person)}
  }
  async approve(actor:Actor,person:string,input:Input) {
    this.owner(actor)
    const condition=await this.checkedIdentity(actor,person)
    return this.store.decide(actor,'withholding-instruction',this.id(person),input,person,false,condition)
  }
  async original(actor:Actor,person:string,version:number) {
    this.owner(actor)
    const row=(await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person)).find(r=>r.version===version)
    if(!row) throw new PayrollError('lock_in_original_unavailable',404)
    return Uint8Array.from(atob(row.data.original.pdf),c=>c.charCodeAt(0))
  }
  async forCheck(actor:Actor,person:string,input:IndustryPayInput) {
    const rows=await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person,false,false)
    const relevant=rows.filter(r=>r.data.effectiveFrom<=input.payDate),pending=relevant[0],active=relevant.find(r=>r.approvedBy && !r.withdrawnBy)
    if(!pending) return null
    this.owner(actor)
    if(relevant.some(pending=>(!active || pending.version>active.version) && pending.data.kind!=='release' && !pending.withdrawnBy)) throw new PayrollError('lock_in_human_implementation_required',409)
    if(!active || !active.sourcesCurrent) throw new PayrollError('current_reviewed_lock_in_required',409)
    if(await this.identityVersion(actor,person)!==active.data.identityVersion || await this.identity(actor,person)!==active.data.identityDigest) throw new PayrollError('lock_in_identity_reconciliation_required',409)
    if(active.data.kind==='release') return {id:active.id,version:active.version,sourceVersion:pending.version,kind:'release',effectiveFrom:active.data.effectiveFrom,selectedW4:input.w4,lockedIncomeTaxCents:null,electedIncomeTaxCents:null,decision:'reviewed-irs-release'}
    const d=active.data
    const locked:FederalW4=d.modernSettings??{version:'2019_or_earlier',filingStatus:d.filingStatus==='married'?'married_joint':'single',allowances:d.maximumAllowances,extraWithholdingCents:d.minimumAdditionalCents,firstPaidBefore2020:true}
    const calculate=(w4:FederalW4)=>{
      try {return federalIncomeTax({taxYear:Number(input.payDate.slice(0,4)) as 2025|2026,taxableWagesCents:input.cashGrossCents,periodsPerYear:input.periodsPerYear,w4,nonresidentAdjustment:false}).incomeTaxCents}
      catch(error) {throw new PayrollError(error instanceof Error?error.message:'invalid_lock_in_calculation')}
    }
    const lockedIncomeTaxCents=calculate(locked),electedIncomeTaxCents=calculate(input.w4)
    return {id:active.id,version:active.version,sourceVersion:pending.version,kind:d.kind,effectiveFrom:d.effectiveFrom,selectedW4:electedIncomeTaxCents>=lockedIncomeTaxCents?input.w4:locked,lockedIncomeTaxCents,electedIncomeTaxCents,decision:electedIncomeTaxCents>=lockedIncomeTaxCents?'higher-or-equal-election':'binding-irs-instruction'}
  }
  async checkElection(actor:Actor,person:string,form:{form:string;effectiveFrom:string;fields:Input},tin:string) {
    // Pin before inspecting: a concurrent letter or human decision invalidates entry.
    const reviewSets=await collectionPins(this.store,actor,[{kind:'withholding-instruction',personId:person,exceptId:''}])
    const rows=await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person,false,false)
    const relevant=rows.filter(r=>r.data.effectiveFrom<=form.effectiveFrom)
    const active=relevant.find(r=>r.approvedBy && !r.withdrawnBy)
    if(relevant.some(pending=>(!active || pending.version>active.version) && pending.data.kind!=='release' && !pending.withdrawnBy)) throw new PayrollError('lock_in_human_implementation_required',409)
    if(active) {
      if(await this.identityVersion(actor,person)!==active.data.identityVersion || await this.identity(actor,person)!==active.data.identityDigest || await digest(tin.replaceAll('-',''))!==active.data.identityDigest) throw new PayrollError('lock_in_identity_reconciliation_required',409)
      if(active.data.kind!=='release') {
        const f=form.fields,d=active.data
        if(d.modernSettings) {
          const locked=d.modernSettings
          if(form.form!=='W-4' || f.filingStatus!==d.filingStatus || (f.multipleJobs==='yes')!==locked.step2Checked) throw new PayrollError('lock_in_amount_comparison_unavailable',409)
          if(f.exempt!=='no' || Number(f.dependentCreditCents)>locked.step3AnnualCreditsCents || Number(f.otherIncomeCents)<locked.step4aOtherIncomeCents || Number(f.deductionsCents)>locked.step4bDeductionsCents || Number(f.additionalCents)<locked.step4cExtraWithholdingCents) throw new PayrollError('w4_decreases_locked_withholding',409)
        } else {
          if(form.form!=='W-4-pre2020') throw new PayrollError('lock_in_amount_comparison_unavailable',409)
          if(f.exempt!=='no' || f.filingStatus!==d.filingStatus || Number(f.allowances)>d.maximumAllowances || Number(f.additionalCents)<d.minimumAdditionalCents) throw new PayrollError('w4_decreases_locked_withholding',409)
        }
      }
    }
    return reviewSets
  }
}
