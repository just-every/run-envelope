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
  identityDigest:string; authenticationMethod:string; authenticationReference:string
  priorVersion:number; recordedByName:string
}
const amount=(value:unknown,max:number)=>{
  const n=typeof value==='string' && /^\d+$/.test(value)?Number(value):value
  if(!Number.isSafeInteger(n) || Number(n)<0 || Number(n)>max) throw new PayrollError('invalid_lock_in_settings')
  return Number(n)
}
/** Retained human-authenticated legacy instructions. Payroll calculation is separate. */
export class WithholdingInstructions {
  constructor(public store:WorkspaceStore) {}
  owner(actor:Actor) {new WorkerPrivacy(this.store.records).owner(actor)}
  id(person:string) {return 'lock-in-'+person}
  async identity(actor:Actor,person:string) {
    return digest((await this.store.records.readPrivate(actor,person,'ssn')).replaceAll('-',''))
  }
  async history(actor:Actor,person:string) {
    this.owner(actor)
    return (await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person)).map(row=>({...row,data:{...row.data,identityDigest:undefined,original:{...row.data.original,pdf:undefined}}}))
  }
  async save(actor:Actor,person:string,input:Input) {
    this.owner(actor)
    await new TaxNoticeCases(this.store).employer(actor,input.employerEin)
    if(input.authenticated!==true && input.authenticated!=='true') throw new PayrollError('authenticated_irs_original_required',409)
    const identityDigest=await this.identity(actor,person)
    if(!/^\d{3}-?\d{2}-?\d{4}$/.test(text(input.workerSsn)) || await digest(text(input.workerSsn).replaceAll('-',''))!==identityDigest) throw new PayrollError('lock_in_worker_mismatch',409)
    const rows=await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person),expected=revision(input.version)
    if((rows[0]?.version ?? 0)!==expected) throw new PayrollError('lock_in_changed',409)
    const kind=choice(input.kind,['2800C','modification','release']),prior=rows.find(r=>r.approvedBy && !r.withdrawnBy)
    if(prior && prior.data.identityDigest!==identityDigest) throw new PayrollError('lock_in_identity_reconciliation_required',409)
    if(kind!=='2800C' && !prior) throw new PayrollError('approved_lock_in_required',409)
    if(kind==='2800C' && prior) throw new PayrollError('irs_modification_required',409)
    const receivedOn=date(input.receivedOn),letterOn=date(input.letterOn),effectiveFrom=date(input.effectiveFrom)
    if(receivedOn>new Date().toISOString().slice(0,10) || letterOn>receivedOn || (kind==='2800C' && effectiveFrom!==new Date(Date.parse(letterOn+'T00:00:00Z')+60*86400000).toISOString().slice(0,10)) || (kind!=='2800C' && effectiveFrom!==receivedOn)) throw new PayrollError('invalid_lock_in_effective_date')
    const data:WithholdingInstruction={kind,original:await noticeDocument(input),receivedOn,letterOn,effectiveFrom,
      filingStatus:kind==='release'?'':choice(input.filingStatus,['single','married','married-withhold-single']),
      maximumAllowances:kind==='release'?0:amount(input.maximumAllowances,99),minimumAdditionalCents:kind==='release'?0:amount(input.minimumAdditionalCents,100000000),
      identityDigest,authenticationMethod:choice(input.authenticationMethod,['agency-portal','verified-agency-correspondence']),authenticationReference:text(input.authenticationReference,500),
      priorVersion:prior?.version ?? 0,recordedByName:actor.session.operator.displayName}
    return this.store.append(actor,'withholding-instruction',this.id(person),expected,data,person)
  }
  async review(actor:Actor,person:string) {
    this.owner(actor)
    const row=await this.store.review<WithholdingInstruction>(actor,'withholding-instruction',this.id(person),person)
    return {version:row.version,reviewToken:row.reviewToken,history:await this.history(actor,person)}
  }
  async approve(actor:Actor,person:string,input:Input) {
    this.owner(actor)
    return this.store.decide(actor,'withholding-instruction',this.id(person),input,person)
  }
  async original(actor:Actor,person:string,version:number) {
    this.owner(actor)
    const row=(await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person)).find(r=>r.version===version)
    if(!row) throw new PayrollError('lock_in_original_unavailable',404)
    return Uint8Array.from(atob(row.data.original.pdf),c=>c.charCodeAt(0))
  }
  async checkElection(actor:Actor,person:string,form:{form:string;effectiveFrom:string;fields:Input},tin:string) {
    // Pin before inspecting: a concurrent letter or human decision invalidates entry.
    const reviewSets=await collectionPins(this.store,actor,[{kind:'withholding-instruction',personId:person,exceptId:''}])
    const rows=await this.store.list<WithholdingInstruction>(actor,'withholding-instruction',person,false,false)
    const relevant=rows.filter(r=>r.data.effectiveFrom<=form.effectiveFrom)
    const pending=relevant[0]
    const active=relevant.find(r=>r.approvedBy && !r.withdrawnBy)
    if(pending && (!active || pending.version>active.version) && pending.data.kind!=='release') throw new PayrollError('lock_in_human_implementation_required',409)
    if(active) {
      if(await this.identity(actor,person)!==active.data.identityDigest || await digest(tin.replaceAll('-',''))!==active.data.identityDigest) throw new PayrollError('lock_in_identity_reconciliation_required',409)
      if(active.data.kind!=='release') {
        const f=form.fields,d=active.data
        if(form.form!=='W-4-pre2020') throw new PayrollError('lock_in_amount_comparison_unavailable',409)
        if(f.exempt!=='no' || f.filingStatus!==d.filingStatus || Number(f.allowances)>d.maximumAllowances || Number(f.additionalCents)<d.minimumAdditionalCents) throw new PayrollError('w4_decreases_locked_withholding',409)
      }
    }
    return reviewSets
  }
}
