import type { Actor } from '../access'
import { auditStatement } from '../access'
import type { Input } from '../records'
import { PayrollError, date, text } from '../security'
import { WithholdingInstructions } from '../withholding-instructions'
import { WorkerPrivacy } from '../worker-privacy'
import { WorkspaceStore, choice, revision, type Revision } from '../workspace/store'

interface Original {
  signedBy: string
  signedOn: string
  pdf: string
}
interface PaperForm {
  form: string
  effectiveFrom: string
  original: Original
  fields: Input
}
interface Packet {
  enteredByName: string
  workerType: string
  hiredOn: string
  paymentMethod: 'paper-check'
  tin: string
  address: string
  federal: PaperForm
  state: PaperForm | null
}
const object = (value: unknown): Input => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PayrollError('invalid_form')
  return value as Input
}
const number = (value: unknown, max = 100000000) => {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) throw new PayrollError('invalid_form_amount')
  return Number(value)
}
const code = (value: unknown, pattern: RegExp) => {
  const result = text(value)
  if (!pattern.test(result)) throw new PayrollError('invalid_certificate_code')
  return result
}
function paper(value: unknown, federal: boolean, workerType: string): PaperForm {
  const input = object(value), fields = object(input.fields), original = object(input.original)
  if (original.signed !== true) throw new PayrollError('signed_original_required')
  const signedOn = date(original.signedOn), effectiveFrom = date(input.effectiveFrom)
  const pdf = text(original.pdf, 512000)
  let bytes: string
  try { bytes = atob(pdf) } catch { throw new PayrollError('invalid_original_pdf') }
  if (!bytes.startsWith('%PDF-') || !bytes.trimEnd().endsWith('%%EOF')) throw new PayrollError('invalid_original_pdf')
  const form = choice(input.form, federal ? workerType === 'contractor' ? ['W-9'] : ['W-4','W-4-pre2020'] : ['PA-residency','OH-IT-4'])
  if (form==='W-4-pre2020' && signedOn>='2020-01-01') throw new PayrollError('legacy_election_original_required')
  let values: Input
  if (form === 'W-4') values = {
    filingStatus: choice(fields.filingStatus,['single','married','head-of-household']),
    multipleJobs: choice(fields.multipleJobs,['yes','no']),
    dependentCreditCents:number(fields.dependentCreditCents), otherIncomeCents:number(fields.otherIncomeCents),
    deductionsCents:number(fields.deductionsCents), additionalCents:number(fields.additionalCents),
    exempt:choice(fields.exempt,['yes','no']),
  }
  else if (form === 'W-4-pre2020') values = {
    filingStatus:choice(fields.filingStatus,['single','married','married-withhold-single']),
    allowances:number(fields.allowances,99),additionalCents:number(fields.additionalCents),exempt:choice(fields.exempt,['yes','no']),
  }
  else if (form === 'W-9') values = {taxClassification:text(fields.taxClassification,120),exemptPayeeCode:typeof fields.exemptPayeeCode==='string' ? fields.exemptPayeeCode.trim() : ''}
  else if (form === 'PA-residency') values = {
    residenceAddress:text(fields.residenceAddress,500), residencePsd:code(fields.residencePsd,/^\d{6}$/),
    workAddress:text(fields.workAddress,500), workPsd:code(fields.workPsd,/^\d{6}$/),
    localExemption:choice(fields.localExemption,['none','claimed']),exemptionEvidence:fields.localExemption==='claimed'?text(fields.exemptionEvidence,500):'',
  }
  else values = {
    residenceAddress:text(fields.residenceAddress,500),schoolDistrictName:text(fields.schoolDistrictName,120),
    schoolDistrictNumber:code(fields.schoolDistrictNumber,/^\d{4}$/),allowances:number(fields.allowances,99),
    additionalCents:number(fields.additionalCents),localExemption:choice(fields.localExemption,['none','claimed']),
    exemptionEvidence:fields.localExemption==='claimed'?text(fields.exemptionEvidence,500):'',
  }
  return {form,effectiveFrom,fields:values,original:{signedBy:text(original.signedBy,240),signedOn,pdf}}
}
/** Signed paper custody and review only. No taxpayer signature or payable authority is manufactured. */
export class PaperOnboarding {
  constructor(public store: WorkspaceStore) {}
  owner(actor: Actor) { return new WorkerPrivacy(this.store.records).owner(actor) }
  async access(actor: Actor, personId: string) {
    const person=await this.store.paperAuthority(actor,'records:read',personId)
    if (actor.grant.role!=='owner' && !['paper:entry','paper:review','paper:download'].some(action=>actor.grant.actions.includes(action)))
      throw new PayrollError('payroll_access_denied',403)
    return person
  }
  async setPolicy(actor: Actor, input: Input) {
    this.owner(actor)
    if (input.requireSeparateReviewer!==true && input.requireSeparateReviewer!==false && input.requireSeparateReviewer!=='true' && input.requireSeparateReviewer!=='false') throw new PayrollError('invalid_paper_policy')
    return this.store.append(actor,'paper-policy','paper-review',revision(input.version),{requireSeparateReviewer:input.requireSeparateReviewer===true || input.requireSeparateReviewer==='true'})
  }
  id(personId: string) { return 'paper-' + personId }
  async save(actor: Actor, personId: string, input: Input) {
    await this.store.paperAuthority(actor,'paper:entry',personId)
    if (input.attestTranscription !== true) throw new PayrollError('paper_transcription_attestation_required')
    const workerType=choice(input.workerType,['employee','contractor'])
    const tin=code(input.tin,/^\d{9}$/)
    choice(input.paymentMethod,['paper-check'])
    const data: Packet={enteredByName:actor.session.operator.displayName,workerType,hiredOn:date(input.hiredOn),paymentMethod:'paper-check',tin,address:text(input.address,500),
      federal:paper(input.federal,true,workerType),state:workerType==='contractor' && input.state==null?null:paper(input.state,false,workerType)}
    const reviewSets=workerType==='employee'?await new WithholdingInstructions(this.store).checkElection(actor,personId,data.federal,data.tin):[]
    return this.store.append(actor,'paper-onboarding',this.id(personId),revision(input.version),data,personId,false,{reviewSets})
  }
  masked(row: Revision<Packet>) {
    const {data,...meta}=row
    const redact = (form: PaperForm) => ({...form,original:{signedBy:form.original.signedBy,signedOn:form.original.signedOn,attached:true}})
    return {...meta,data:{...data,tin:'•••••'+data.tin.slice(-4),federal:redact(data.federal),state:data.state?redact(data.state):null},
      paperworkReviewed:!!row.approvedBy && !row.withdrawnBy && !!row.sourcesCurrent,
      payable:false, holds:['Payroll eligibility and payment execution remain unimplemented. Contractor TIN matching and backup withholding remain unavailable.']}
  }
  async history(actor: Actor, personId: string) {
    await this.access(actor,personId)
    return (await this.store.list<Packet>(actor,'paper-onboarding',personId)).map(row=>this.masked(row))
  }
  async review(actor: Actor, personId: string) {
    await this.store.paperAuthority(actor,'paper:review',personId)
    const row=await this.store.review<Packet>(actor,'paper-onboarding',this.id(personId),personId)
    return {...this.masked(row),reviewToken:row.reviewToken}
  }
  async decide(actor: Actor, personId: string, input: Input, withdraw=false) {
    await this.store.paperAuthority(actor,'paper:review',personId)
    return this.store.decide(actor,'paper-onboarding',this.id(personId),input,personId,withdraw)
  }
  async original(actor: Actor, personId: string, version: string, which: string) {
    const person=await this.store.paperAuthority(actor,'paper:download',personId)
    const rows=await this.store.list<Packet>(actor,'paper-onboarding',personId)
    const row=rows.find(r=>String(r.version)===version)
    if (!row || !['federal','state'].includes(which)) throw new PayrollError('record_not_found',404)
    const form=which==='federal'?row.data.federal:row.data.state
    if (!form) throw new PayrollError('record_not_found',404)
    const event=await auditStatement(this.store.records.env,actor,crypto.randomUUID(),'onboarding.original.read',row.id,row.version,
      'EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)',[actor.company,personId,person.version]).run()
    if (!event.meta.changes) throw new PayrollError('authority_changed',409)
    return Uint8Array.from(atob(form.original.pdf),c=>c.charCodeAt(0))
  }
}
