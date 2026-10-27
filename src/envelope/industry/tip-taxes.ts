import type { Actor } from '../access'
import type { Input } from '../records'
import { date, integer, text, PayrollError } from '../security'
import { ownerOnly } from '../income-verification/requests'
import { WorkspaceStore, objectId, revision, digest } from '../workspace/store'
import { collectionPins } from '../workspace/review-inputs'
import { PayItems, type EarningsRun } from '../workspace/pay-items'
import { IndustryRecords, type ClassificationRecord } from './records'
import { federalIncomeTax, roundRatio, validCents } from './federal-withholding'
import type { PayPeriods, FederalW4 } from './types'

const tax = (cents: number, points: number) => roundRatio(BigInt(cents) * BigInt(points), 10000n)
const cents = (value: unknown) => { if (!validCents(value) || value > 100000000) throw new PayrollError('invalid_tip_tax_amount'); return value }
export function collectionDeadline(receivedOn: string) {
  const [year, month] = receivedOn.split('-').map(Number)
  return new Date(Date.UTC(year, month, 10)).toISOString().slice(0, 10)
}

/** Federal aggregate-method preparation only; never a transfer or a filed return. */
export function calculateTipTaxes(input: {
  wagesCents: number; heldTipsCents: number; paycheckTipsCents: number; furnishedCents: number
  socialSecurityBeforeCents: number; medicareBeforeCents: number; w4: FederalW4
  periods: PayPeriods; payDate: string
}) {
  const { wagesCents: wages, heldTipsCents: held, paycheckTipsCents: paycheck, furnishedCents: furnished } = input
  for (const amount of [wages, held, paycheck, furnished, input.socialSecurityBeforeCents, input.medicareBeforeCents]) cents(amount)
  const year = Number(input.payDate.slice(0,4))
  if (year !== 2026) throw new PayrollError('tip_tax_year_unavailable',409)
  const tips = held + paycheck
  if (tips < 2000) throw new PayrollError('monthly_tip_reporting_threshold_requires_review',409)
  const cap = Math.max(0,18450000-input.socialSecurityBeforeCents)
  const wageSs = tax(Math.min(wages,cap),620), tipSs = tax(Math.min(tips,Math.max(0,cap-wages)),620)
  const wageMed = tax(wages,145), tipMed = tax(tips,145)
  const above = (amount: number) => Math.max(0, input.medicareBeforeCents + amount - 20000000) - Math.max(0,input.medicareBeforeCents - 20000000)
  const wageAdditional = tax(above(wages),90), tipAdditional = tax(above(wages+tips),90)-wageAdditional
  const fit = (amount: number) => federalIncomeTax({taxYear:year,taxableWagesCents:amount,periodsPerYear:input.periods,w4:input.w4,nonresidentAdjustment:false}).incomeTaxCents
  const wageFit = fit(wages), tipFit = Math.max(0,fit(wages+tips)-wageFit)
  const regular = wageSs+wageMed+wageAdditional+wageFit
  if (regular>wages) throw new PayrollError('regular_wage_withholding_exceeds_wages',409)
  const available = wages-regular+paycheck+furnished
  const tipFica = tipSs+tipMed+tipAdditional, collectedFica = Math.min(available,tipFica)
  // Allocate a partially collected FICA group proportionally; residual cents go
  // to Medicare, then Additional Medicare. This convention remains reviewable.
  const collectedSs = tipFica ? Math.min(tipSs,roundRatio(BigInt(collectedFica)*BigInt(tipSs),BigInt(tipFica))) : 0
  const collectedMed = Math.min(tipMed,collectedFica-collectedSs)
  const collectedAdditional = collectedFica-collectedSs-collectedMed
  const collectedFit = Math.min(available-collectedFica,tipFit)
  const fromWages = Math.min(wages-regular+paycheck,collectedFica+collectedFit)
  const usedFurnished = collectedFica+collectedFit-fromWages
  const uncollectedSs = tipSs-collectedSs, uncollectedMed = tipMed-collectedMed
  return {
    wagesCents:wages, heldTipsCents:held, paycheckTipsCents:paycheck, reportedTipsCents:tips,
    newCashBeforeTaxCents:wages+paycheck, netCashCents:wages+paycheck-regular-fromWages,
    furnishedCents:furnished, usedFurnishedCents:usedFurnished, unusedFurnishedCents:furnished-usedFurnished,
    order:[{kind:'regular-wage-taxes',dueCents:regular,collectedCents:regular},
      {kind:'tip-social-security-and-medicare',dueCents:tipFica,collectedCents:collectedFica},
      {kind:'tip-income-tax',dueCents:tipFit,collectedCents:collectedFit}],
    regular:{socialSecurityCents:wageSs,medicareCents:wageMed,additionalMedicareCents:wageAdditional,incomeTaxCents:wageFit},
    tipTaxes:{socialSecurityCents:tipSs,medicareCents:tipMed,additionalMedicareCents:tipAdditional,incomeTaxCents:tipFit},
    collected:{socialSecurityCents:collectedSs,medicareCents:collectedMed,additionalMedicareCents:collectedAdditional,incomeTaxCents:collectedFit},
    uncollected:{socialSecurityCents:uncollectedSs,medicareCents:uncollectedMed,additionalMedicareCents:tipAdditional-collectedAdditional,incomeTaxCents:tipFit-collectedFit},
    employer:{socialSecurityCents:wageSs+tipSs,medicareCents:wageMed+tipMed},
    reportingBasis:{form941:{line5bTipWagesCents:Math.min(tips,Math.max(0,cap-wages)),line5bTaxCents:2*tipSs,
      line5cWagesCents:wages+tips,line5cTaxCents:2*(wageMed+tipMed),line5dWagesCents:above(wages+tips),line5dTaxCents:wageAdditional+tipAdditional,
      line9AdjustmentCents:-(uncollectedSs+uncollectedMed)},form944:{line6AdjustmentCents:-(uncollectedSs+uncollectedMed)},
      w2Box12:{A:uncollectedSs,B:uncollectedMed}},
    paymentReady:false, filingStatus:'calculation-only',
  }
}

type Funds = {runId:string;reportReceivedOn:string;amountCents:number;receivedOn:string;receiptRef:string;provenance:string}
export class TipTaxPreviews {
  constructor(public store: WorkspaceStore) {}
  async basis(actor: Actor, personId: string, input: Input, fundsId = '') {
    if (!['native','oidc','dev'].includes(actor.session.kind)) throw new PayrollError('human_session_required',403)
    await new IndustryRecords(this.store).scope(actor,personId,'rates:propose')
    const run = await this.store.find<EarningsRun>(actor,'earnings-run',objectId(input.runId),undefined,true)
    if (run.version!==integer(input.runVersion)) throw new PayrollError('run_version_superseded',409)
    const current = await new PayItems(this.store).sourceCheck(actor,run)
    if (!current.setup || !current.rules) throw new PayrollError('run_sources_changed',409)
    const worker = run.data.people.find(p=>p.id===personId)
    const classification = await this.store.find<ClassificationRecord>(actor,'industry-classification','industry-'+personId,personId,true)
    if (!classification.approvedBy || classification.withdrawnBy || !classification.sourcesCurrent) throw new PayrollError('reviewed_current_classification_required',409)
    const c = classification.data
    if (run.data.payDate<c.effectiveFrom || run.data.payDate>c.effectiveThrough) throw new PayrollError('classification_outside_effective_period',409)
    if (!worker || run.data.bonusPreparation || run.data.locationStates.some(s=>s!=='TX') || c.facts.taxResidency!=='resident' || c.facts.employerKind!=='business' || c.facts.claims.length || worker.afterTaxDeductionCents || worker.reimbursementCents || worker.tipFundsCents || worker.taxableCashCents!==worker.earningsCents+worker.paycheckTipsCents)
      throw new PayrollError('tip_tax_basis_requires_complete_supported_remuneration',409)
    // Existing generic calculation holds remain. Never silently resolve a source,
    // premium or legal-deduction issue using this bounded federal calculation.
    if (run.data.holds.some(h=>h.personId===personId && !['tip-tax-calculation-unavailable','payroll-calculation-unavailable'].includes(h.code ?? ''))) throw new PayrollError('tip_tax_run_has_unresolved_inputs',409)
    const reportReceivedOn = date(input.reportReceivedOn), today = new Date().toISOString().slice(0,10)
    if (reportReceivedOn>today || reportReceivedOn<run.data.periodStart || reportReceivedOn.slice(0,4)!=='2026') throw new PayrollError('invalid_tip_report_date')
    const deadline = collectionDeadline(reportReceivedOn)
    const fundsPins = await collectionPins(this.store,actor,[{kind:'tip-tax-funds',personId,exceptId:fundsId}])
    const receipts = (await this.store.list<Funds>(actor,'tip-tax-funds',personId,true)).filter(r=>r.data.runId===run.id && r.data.reportReceivedOn===reportReceivedOn)
    const result = calculateTipTaxes({wagesCents:worker.earningsCents,heldTipsCents:worker.cashTipsCents,paycheckTipsCents:worker.paycheckTipsCents,
      furnishedCents:receipts.reduce((n,r)=>n+r.data.amountCents,0),socialSecurityBeforeCents:cents(input.socialSecurityBeforeCents),medicareBeforeCents:cents(input.medicareBeforeCents),
      w4:c.w4,periods:({weekly:52,biweekly:26,semimonthly:24,monthly:12} as const)[run.data.frequency as 'weekly'],payDate:run.data.payDate})
    return {run,classification,receipts,result,reportReceivedOn,deadline,today,fundsPins}
  }
  async preview(actor: Actor, personId: string, input: Input) {
    const b = await this.basis(actor,personId,input)
    const data = {runId:b.run.id,runVersion:b.run.version,reportReceivedOn:b.reportReceivedOn,reportEvidence:text(input.reportEvidence,1000),
      collectionDeadline:b.deadline,asOf:b.today,collectionState:b.today>b.deadline?'closed-report-uncollected':'open-collection-window',
      yearToDateEvidence:text(input.yearToDateEvidence,1000),socialSecurityBeforeCents:input.socialSecurityBeforeCents,medicareBeforeCents:input.medicareBeforeCents,
      receipts:b.receipts.map(r=>({id:r.id,...r.data})),result:b.result,
      limitations:'Federal aggregate-method calculation only. Existing run holds remain; no completed payroll, stub, filed schema, bank receipt or agency acknowledgement. Furnished funds are human-attested received money; no debit is authorized.'}
    const saved = await this.store.append(actor,'tip-tax-preview',objectId(input.id),revision(input.version),data,personId,true,{reviewSets:b.fundsPins,objects:[
      {kind:'earnings-run',id:b.run.id,version:b.run.version},{kind:'industry-classification',id:b.classification.id,version:b.classification.version,approved:true},
      ...b.receipts.map(r=>({kind:'tip-tax-funds' as const,id:r.id,version:r.version}))]})
    return {...saved,data}
  }
  async funds(actor: Actor, personId: string, input: Input) {
    ownerOnly(actor)
    const b = await this.basis(actor,personId,input,objectId(input.id))
    if (input.status!=='received' || b.today>b.deadline) throw new PayrollError('actual_funds_within_collection_window_required',409)
    const amountCents = integer(input.amountCents)
    const shortage = Object.values(b.result.uncollected).reduce((n,v)=>n+v,0)
    if (amountCents>shortage) throw new PayrollError('furnished_funds_exceed_shortage',409)
    const data:Funds = {runId:b.run.id,reportReceivedOn:b.reportReceivedOn,amountCents,receivedOn:b.today,
      receiptRef:text(input.receiptRef,500),provenance:'human-attested-received-funds'}
    const saved = await this.store.append(actor,'tip-tax-funds',objectId(input.id),0,data,personId,true,{reviewSets:b.fundsPins,exclusiveSourceIds:['tip-funds-'+await digest(JSON.stringify([personId,b.run.id,data.receiptRef]))],objects:[{kind:'earnings-run',id:b.run.id,version:b.run.version}]})
    return {...saved,data}
  }
}
