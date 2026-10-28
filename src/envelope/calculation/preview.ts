import { validDate } from '../industry/classification'
import { calculateIndustryPay } from '../industry/calculate'
import { roundRatio,validCents } from '../industry/federal-withholding'
import { calculateTipTaxes } from '../industry/tip-taxes'
import type { FederalW4, PayPeriods } from '../industry/types'
import { weeklyEarnings,type WorkWeek } from './earnings'
import { stateWithholding, stateCoverage } from './states'

export interface PreviewInput {
  edition:'2026-01';payDate:string;from:string;through:string;frequency:'weekly'|'biweekly'|'semimonthly'|'monthly'
  workState:string;residentState:string;locality:string
  remuneration:{kind:'hourly';weeks:WorkWeek[]}|{kind:'salary';cashCents:number;exempt:true}
  w4:FederalW4;stateElection:Record<string,unknown>
  yearToDate:{socialSecurityWagesCents:number;medicareWagesCents:number;futaWagesCents:number;suiWagesCents:number}
  tips:{heldCents:number;paycheckCents:number;furnishedCents:number}
  deductions:{kind:'voluntary-after-tax'|'ordinary-creditor';amountCents:number;authorizationRef:string}[]
}
const periods={weekly:52,biweekly:26,semimonthly:24,monthly:12} as const
const reject=(code:string):never=>{throw new Error(code)}
const checked=(n:unknown)=>{if(!validCents(n)||n>100000000)reject('invalid_preview_amount');return n as number}
const noTaxFacts={employerKind:'business',entityType:'corporation',workerRole:'employee',workKind:'nonagricultural',seasonal:false,taxResidency:'resident',claims:[]} as const

/** A stateless proposed calculation, never an approval, pay instruction or persisted check. */
export function calculationPreview(input:PreviewInput){
  if(!input || Object.keys(input).some(k=>!['edition','payDate','from','through','frequency','workState','residentState','locality','remuneration','w4','stateElection','yearToDate','tips','deductions'].includes(k))) reject('unsupported_preview_input')
  if(input.edition!=='2026-01' || !validDate(input.payDate)||!validDate(input.from)||!validDate(input.through)||input.from>input.through || !input.payDate.startsWith('2026-') || !input.from.startsWith('2026-') || !input.through.startsWith('2026-') || !Object.hasOwn(periods,input.frequency)) reject('calculation_edition_or_period_unavailable')
  if(!input.yearToDate || !['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','suiWagesCents'].every(k=>validCents(input.yearToDate[k as keyof PreviewInput['yearToDate']]))) reject('complete_year_to_date_required')
  if(!input.tips || ![input.tips.heldCents,input.tips.paycheckCents,input.tips.furnishedCents].every(validCents) || !Array.isArray(input.deductions) || input.deductions.length>20) reject('complete_tips_and_deductions_required')
  const holds:{code:string;location:string;reason:string;nextAction:string}[]=[]
  const hold=(code:string,location:string,reason:string)=>holds.push({code,location,reason,nextAction:'Request official-source mapping or correct the inputs; keep this employee held.'})
  if(input.workState!==input.residentState)hold('multistate-allocation-unmapped',input.workState+' and '+input.residentState,'Cross-state sourcing and resident credits require a mapped allocation.')
  if(typeof input.locality!=='string'||input.locality!=='none')hold('locality-unmapped',String(input.locality??''),'A mapped work and residence locality is required. Unknown local tax is never zero tax.')
  const r=input.remuneration
  let earnings:ReturnType<typeof weeklyEarnings>|undefined,gross!:number
  if(r?.kind==='hourly'){
    if(Object.keys(r).some(k=>!['kind','weeks'].includes(k)))reject('unsupported_remuneration')
    earnings=weeklyEarnings(r.weeks,input.workState,input.from,input.through);gross=earnings.grossCents
  }else if(r?.kind==='salary'&&r.exempt===true){
    if(Object.keys(r).some(k=>!['kind','cashCents','exempt'].includes(k)))reject('unsupported_remuneration')
    gross=checked(r.cashCents)
  }else reject('supported_remuneration_required')
  const state=stateWithholding(input.workState,gross,input.frequency,input.payDate,input.stateElection)
  if(state.withholdingCents===null)hold('state-withholding-unmapped',input.workState,state.reason)
  // A component result cannot establish complete taxes for a state. All other
  // state programs and local obligations remain explicit coverage holds.
  if(input.workState!=='TX')hold('state-programs-unmapped',input.workState,'Complete SUI, disability, leave, compensation and other applicable assessments remain unproved for this state.')
  if(input.workState==='TX' && input.locality!=='none')hold('texas-location-unmapped',input.locality,'The Texas no-local-income-tax determination requires an identified Texas location.')
  const p=periods[input.frequency] as PayPeriods
  const federal=calculateIndustryPay({payDate:input.payDate,cashGrossCents:gross,housingAllowanceCents:0,shareholderHealthInsuranceCents:0,periodsPerYear:p,facts:{...noTaxFacts,claims:[]},w4:input.w4,yearToDate:input.yearToDate})
  const tips=input.tips.heldCents+input.tips.paycheckCents
  const tip= tips ? calculateTipTaxes({wagesCents:gross,heldTipsCents:checked(input.tips.heldCents),paycheckTipsCents:checked(input.tips.paycheckCents),furnishedCents:checked(input.tips.furnishedCents),socialSecurityBeforeCents:input.yearToDate.socialSecurityWagesCents,medicareBeforeCents:input.yearToDate.medicareWagesCents,w4:input.w4,periods:p,payDate:input.payDate}) : undefined
  if(!tips && input.tips.furnishedCents)reject('furnished_funds_require_reported_tips')
  const newCash=gross+input.tips.paycheckCents
  const federalCollected=tip?newCash-tip.netCashCents:federal.totalEmployeeTaxCents
  const disposable=Math.max(0,newCash-federalCollected-(state.withholdingCents??0))
  const deductions=input.deductions.map(d=>{
    checked(d.amountCents)
    if(!['voluntary-after-tax','ordinary-creditor'].includes(d.kind)||typeof d.authorizationRef!=='string'||!d.authorizationRef.trim())reject('documented_deduction_required')
    return {...d}
  })
  const creditor=deductions.filter(d=>d.kind==='ordinary-creditor').reduce((n,d)=>n+d.amountCents,0)
  const federalGarnishmentLimit=Math.min(Math.floor(disposable/4),Math.max(0,disposable-roundRatio(21750n*52n,BigInt(p))))
  if(creditor>federalGarnishmentLimit)hold('unlawful-garnishment',input.workState,'The aggregate ordinary garnishment exceeds the CCPA ceiling.')
  else if(creditor)hold('state-garnishment-law-unmapped',input.workState,'State garnishment protection and order applicability require independent review; the federal ceiling alone never authorizes a deduction.')
  const deducted=deductions.reduce((n,d)=>n+d.amountCents,0)
  if(deducted>disposable)hold('negative-net-deduction',input.workState,'Deductions exceed available disposable cash; no negative payout is created.')
  if(deducted)hold('lawful-deduction-review-required',input.workState,'Minimum-wage, overtime and state deduction protections require a current lawful determination.')
  const suiBase=Math.min(gross+tips,Math.max(0,900000-input.yearToDate.suiWagesCents))
  const sui=input.workState==='TX'?{taxableWagesCents:suiBase,amountCents:roundRatio(BigInt(suiBase)*270n,10000n),rateBasisPoints:270,determination:'Texas 2.7% floor only; NAICS new-employer rate and assigned rate require review',source:'https://www.twc.texas.gov/programs/unemployment-tax/tax-rates'}:null
  // A 2.7% floor is not an employer-specific SUI determination.
  hold('sui-rate-review-required',input.workState,'The current assigned or NAICS-specific new-employer SUI rate must be supplied by a reviewed rule edition.')
  return {edition:input.edition,payDate:input.payDate,status:holds.length?'held':'calculated-preview',paymentReady:false,approval:'unavailable',dispatch:'unavailable',
    earnings,grossCashCents:gross,heldTipsCents:input.tips.heldCents,paycheckTipsCents:input.tips.paycheckCents,newCashBeforeTaxCents:newCash,
    federal,state,tipTaxes:tip,sui,deductions,federalGarnishmentLimitCents:federalGarnishmentLimit,
    netCashCents:holds.length?null:disposable-deducted,holds,coverage:stateCoverage(),
    limitations:['Proposed calculation only; no money moves and no historical payroll record is changed.','The complete 51-state programs and the 688-entry large-local file remain in the denominator.','No supplied account number, provider grant or client approval creates payment authority.']}
}
