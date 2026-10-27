import { WithholdingInstructions } from '../withholding-instructions'
import { TaxNoticeCases, type SuiAssessment } from '../tax-notices'
import { collectionPins } from '../workspace/review-inputs'
import { zero } from '../leave/ledger'
import { requireAction, type Actor } from '../access'
import type { Input } from '../records'
import { date, integer, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, type Revision } from '../workspace/store'
import { PayItems, type EarningsRun } from '../workspace/pay-items'
import { classifyIndustryWorker } from './classification'
import { validateW4 } from './federal-withholding'
import { calculateIndustryPay, compareIndustryPay } from './calculate'
import type { IndustryFacts, IndustryPayInput, IndustryPayResult, FederalW4 } from './types'

export interface ClassificationRecord {
  effectiveFrom: string; effectiveThrough: string; facts: IndustryFacts; w4: FederalW4
  evidenceTitle: string; evidenceIssuer: string; evidenceReference: string; evidenceText: string
}
export interface IndustryCheck {
  sui?:SuiAssessment|null; totalEmployerLiabilityCents?:number
  withholdingInstruction?:Awaited<ReturnType<WithholdingInstructions['forCheck']>>
  personId: string; personName: string; runId: string; runVersion: number
  classificationId: string; classificationVersion: number; yearToDateEvidence: string; input: IndustryPayInput; result: IndustryPayResult
  corrects: string; correctionReason: string; amendment: ReturnType<typeof compareIndustryPay> | null
}
const human = (actor: Actor) => {
  if (!['native','oidc','password','dev'].includes(actor.session.kind)) throw new PayrollError('human_session_required',403)
}
const evidenceText=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>12000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new PayrollError('classification_evidence_required');return value.trim()}
export class IndustryRecords {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, personId: string, action = 'records:read') {
    const person = await this.store.authority(actor, action, personId, true)
    requireAction(actor, action, person?.locationId, 'tax')
    requireAction(actor,'private:read',person?.locationId,'tax')
    if(action==='rates:propose')requireAction(actor,'private:write',person?.locationId,'tax')
    return person!
  }
  async list(actor: Actor, personId: string) {
    await this.scope(actor,personId)
    return { classifications: await this.store.list<ClassificationRecord>(actor,'industry-classification',personId,true), checks: await this.store.list<IndustryCheck>(actor,'industry-check',personId,true) }
  }
  async save(actor: Actor, personId: string, input: Input) {
    human(actor);await this.scope(actor,personId,'rates:propose')
    const effectiveFrom=date(input.effectiveFrom),effectiveThrough=date(input.effectiveThrough)
    if(effectiveFrom>effectiveThrough)throw new PayrollError('invalid_effective_period')
    if(!input.facts||typeof input.facts!=='object'||!input.w4||typeof input.w4!=='object')throw new PayrollError('classification_facts_required')
    const facts=structuredClone(input.facts) as IndustryFacts
    if(!Array.isArray(facts.claims)||facts.claims.length>16)throw new PayrollError('invalid_claims')
    // Reviewer identity is never accepted from the client. The exact decision supplies it on use.
    facts.claims=facts.claims.map(claim=>({...claim,documentId:`industry-${personId}-v${revision(input.version)+1}-evidence`,reviewedAt:'',reviewedBy:'',effectiveFrom,effectiveThrough}))
    try{classifyIndustryWorker(facts,effectiveFrom,{requireReview:false});validateW4(input.w4 as FederalW4)}catch(error){throw new PayrollError(error instanceof Error?error.message:'invalid_classification')}
    const data:ClassificationRecord={effectiveFrom,effectiveThrough,facts,w4:structuredClone(input.w4) as FederalW4,
      evidenceTitle:text(input.evidenceTitle,160),evidenceIssuer:text(input.evidenceIssuer,240),evidenceReference:text(input.evidenceReference,500),evidenceText:evidenceText(input.evidenceText)}
    return this.store.append(actor,'industry-classification','industry-'+personId,revision(input.version),data,personId,true)
  }
  async review(actor: Actor, personId: string, kind: 'industry-classification'|'industry-check', id: string) {
    human(actor);await this.scope(actor,personId,'rates:approve')
    return this.store.review<ClassificationRecord|IndustryCheck>(actor,kind,id,personId)
  }
  async decide(actor: Actor, personId: string, kind: 'industry-classification'|'industry-check',id:string,input:Input) {
    human(actor);await this.scope(actor,personId,'rates:approve')
    return this.store.decide(actor,kind,id,input,personId,input.withdraw===true||input.withdraw==='true')
  }
  async preview(actor: Actor, personId:string,input:Input) {
    human(actor);const person=await this.scope(actor,personId,'rates:propose')
    const run=await this.store.find<EarningsRun>(actor,'earnings-run',objectId(input.runId),undefined,true)
    if(run.data.bonusPreparation)throw new PayrollError('special_pay_items_require_complete_calculation',409)
    const classification=await this.store.find<ClassificationRecord>(actor,'industry-classification','industry-'+personId,personId,true)
    if(!classification.approvedBy||classification.withdrawnBy||!classification.sourcesCurrent)throw new PayrollError('reviewed_current_classification_required',409)
    if(run.version!==integer(input.runVersion))throw new PayrollError('run_version_superseded',409)
    const sourceCheck=await new PayItems(this.store).sourceCheck(actor,run)
    if(!sourceCheck.setup||!sourceCheck.rules)throw new PayrollError('run_sources_changed',409)
    const worker=run.data.people.find(p=>p.id===personId)
    if(!worker)throw new PayrollError('worker_not_in_run',404)
    if(run.data.holds.some(h=>h.personId===personId&&h.code?.startsWith('proration-'))||worker.cashTipsCents||worker.paycheckTipsCents||worker.afterTaxDeductionCents||worker.reimbursementCents||worker.earningsCents!==worker.taxableCashCents)throw new PayrollError('special_pay_items_require_complete_calculation',409)
    const {effectiveFrom,effectiveThrough}=classification.data
    if(run.data.payDate<effectiveFrom||run.data.payDate>effectiveThrough)throw new PayrollError('classification_outside_effective_period',409)
    const facts=structuredClone(classification.data.facts)
    facts.claims=facts.claims.map((claim,i)=>({...claim,documentId:`${classification.id}-v${classification.version}-evidence-${i+1}`,reviewedBy:classification.approvedBy!,reviewedAt:new Date(classification.approvedAt!).toISOString(),effectiveFrom,effectiveThrough}))
    const ytd=input.yearToDate as IndustryPayInput['yearToDate']
    if(!ytd||typeof ytd!=='object')throw new PayrollError('year_to_date_basis_required')
    const payInput:IndustryPayInput={payDate:run.data.payDate,cashGrossCents:worker.earningsCents,housingAllowanceCents:zero(input.housingAllowanceCents??0),shareholderHealthInsuranceCents:zero(input.shareholderHealthInsuranceCents??0),periodsPerYear:({weekly:52,biweekly:26,semimonthly:24,monthly:12} as const)[run.data.frequency as 'weekly']!,facts,w4:classification.data.w4,yearToDate:ytd}
    const instructionPins=await collectionPins(this.store,actor,[{kind:'withholding-instruction',personId,exceptId:''},{kind:'private-ssn',personId,exceptId:''}])
    const withholdingInstruction=await new WithholdingInstructions(this.store).forCheck(actor,personId,payInput)
    if(withholdingInstruction) {
      if(facts.taxResidency!=='resident' || facts.claims.length || payInput.housingAllowanceCents || payInput.shareholderHealthInsuranceCents || facts.employerKind!=='business' || facts.workerRole!=='employee') throw new PayrollError('lock_in_special_taxability_unavailable',409)
      payInput.w4=withholdingInstruction.selectedW4
    }
    let result:IndustryPayResult;try{result=calculateIndustryPay(payInput)}catch(error){throw new PayrollError(error instanceof Error?error.message:'invalid_industry_calculation')}
    const reviewSets=await collectionPins(this.store,actor,[{kind:'tax-notice-case',personId:'',exceptId:''},{kind:'rule',personId:'',exceptId:''}])
    const sui=await new TaxNoticeCases(this.store).assessment(actor,personId,run.data,input)
    if(sui && (facts.employerKind!=='business' || facts.entityType!=='corporation' || facts.workerRole!=='employee' || facts.workKind!=='nonagricultural' || facts.claims.length || payInput.housingAllowanceCents || payInput.shareholderHealthInsuranceCents)) throw new PayrollError('sui_special_taxability_unavailable',409)
    const corrects=input.corrects?objectId(input.corrects):''
    const prior=corrects?await this.store.find<IndustryCheck>(actor,'industry-check',corrects,personId,true):null
    if(prior&&(!prior.approvedBy||prior.withdrawnBy||prior.data.runId!==run.id||prior.data.runVersion!==run.version))throw new PayrollError('reviewed_same_run_correction_required',409)
    const data:IndustryCheck={withholdingInstruction,sui,totalEmployerLiabilityCents:result.totalEmployerTaxCents+(sui?.employerLiabilityCents??0),personId,personName:person.name,runId:run.id,runVersion:run.version,classificationId:classification.id,classificationVersion:classification.version,yearToDateEvidence:text(input.yearToDateEvidence,1000),input:payInput,result,corrects,correctionReason:corrects?text(input.correctionReason,1000):'',amendment:prior?compareIndustryPay(prior.data.result,result):null}
    return this.store.append(actor,'industry-check',objectId(input.id),revision(input.version),data,personId,true,{reviewSets:[...reviewSets,...instructionPins],objects:[...(withholdingInstruction?[{kind:'withholding-instruction' as const,id:withholdingInstruction.id,version:withholdingInstruction.sourceVersion,approved:withholdingInstruction.sourceVersion===withholdingInstruction.version}]:[]),...(sui?[{kind:'tax-notice-case' as const,id:sui.noticeId,version:sui.noticeVersion,approved:true},{kind:'rule' as const,id:sui.ruleId,version:sui.ruleVersion,approved:true}]:[]),{kind:'industry-classification',id:classification.id,version:classification.version,approved:true},{kind:'earnings-run',id:run.id,version:run.version}]})
  }
}
