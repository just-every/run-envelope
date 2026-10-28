import type { HiPreviewRequest } from '../benefits/hi-plan-shares'
import type { ExtendedRetirementProposal } from '../benefits/extended-retirement'
import { retirementContribution, type RetirementElection } from '../benefits/retirement'
import type { nyDblCalculation } from '../benefits/ny-dbl'
import { validDate } from '../industry/classification'
import { calculateIndustryPay } from '../industry/calculate'
import { roundRatio,validCents } from '../industry/federal-withholding'
import { calculateTipTaxes } from '../industry/tip-taxes'
import type { FederalW4, PayPeriods } from '../industry/types'
import { weeklyEarnings,type WorkWeek } from './earnings'
import { stateWithholding, stateCoverage } from './states'

export interface PreviewInput {
  hiBenefits?:HiPreviewRequest
  extendedRetirement?: {personId:string;setupId:string;setupVersion:number;request:unknown}
  nyDbl?:{personId:string;proposalId:string;version:number}
  edition:'2025-01'|'2026-01';payDate:string;from:string;through:string;frequency:'weekly'|'biweekly'|'semimonthly'|'monthly'
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
export function calculationPreview(input:PreviewInput, retirement?:ExtendedRetirementProposal,nyDbl?:ReturnType<typeof nyDblCalculation>){
  if(!input || Object.keys(input).some(k=>!['nyDbl','hiBenefits','extendedRetirement','edition','payDate','from','through','frequency','workState','residentState','locality','remuneration','w4','stateElection','yearToDate','tips','deductions'].includes(k))) reject('unsupported_preview_input')
  const year=input.edition==='2025-01'?'2025':'2026'
  if(!['2025-01','2026-01'].includes(input.edition) || !validDate(input.payDate)||!validDate(input.from)||!validDate(input.through)||input.from>input.through || input.payDate<input.through || !input.payDate.startsWith(year+'-') || !input.from.startsWith(year+'-') || !input.through.startsWith(year+'-') || !Object.hasOwn(periods,input.frequency)) reject('calculation_edition_or_period_unavailable')
  if(typeof input.workState!=='string'||typeof input.residentState!=='string'||!input.workState.trim()||!input.residentState.trim()||input.workState.length>80||input.residentState.length>80)reject('work_and_residence_locations_required')
  if(!input.yearToDate || !['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','suiWagesCents'].every(k=>validCents(input.yearToDate[k as keyof PreviewInput['yearToDate']]))) reject('complete_year_to_date_required')
  if(!input.tips || ![input.tips.heldCents,input.tips.paycheckCents,input.tips.furnishedCents].every(validCents) || !Array.isArray(input.deductions) || input.deductions.length>20) reject('complete_tips_and_deductions_required')
  if (input.extendedRetirement && !retirement) reject('reviewed_retirement_proposal_required')
  if (retirement && retirement.payDate !== input.payDate) reject('retirement_pay_date_mismatch')
  if (input.nyDbl && (!nyDbl || input.workState!=='NY' || Object.keys(input.nyDbl).some(k=>!['personId','proposalId','version'].includes(k)))) reject('invalid_dbl_preview_reference')
  if (nyDbl && nyDbl.rows.some(w=>w.weekFrom<input.from || w.weekFrom>input.through)) reject('dbl_proposal_outside_preview_period')
  const holds:{code:string;location:string;reason:string;nextAction:string}[]=[]
  const hold=(code:string,location:string,reason:string)=>holds.push({code,location:location||'Unassigned location',reason,nextAction:'Request official-source mapping or correct the inputs; keep this employee held.'})
  if(retirement)hold('retirement-payroll-integration-pending',input.workState,'Retirement amounts are separate held proposals; deductions, taxable wages and payment are not changed.')
  if(input.workState!==input.residentState)hold('multistate-allocation-unmapped',input.workState+' and '+input.residentState,'Cross-state sourcing and resident credits require a mapped allocation.')
  if(typeof input.locality!=='string'||input.locality!=='none')hold('locality-unmapped',String(input.locality??''),'A mapped work and residence locality is required. Unknown local tax is never zero tax.')
  if(nyDbl) hold('ny-dbl-preparation-only','NY','DBL is a proposed after-tax contribution. Actual coverage, collection, employer funding and insurer remittance remain unproved.')
  const r=input.remuneration
  let earnings:ReturnType<typeof weeklyEarnings>|undefined,gross!:number
  if(r?.kind==='hourly'){
    if(Object.keys(r).some(k=>!['kind','weeks'].includes(k)))reject('unsupported_remuneration')
    earnings=weeklyEarnings(r.weeks,input.workState,input.from,input.through);gross=earnings.grossCents
  }else if(r?.kind==='salary'&&r.exempt===true){
    if(Object.keys(r).some(k=>!['kind','cashCents','exempt'].includes(k)))reject('unsupported_remuneration')
    gross=checked(r.cashCents)
  }else reject('supported_remuneration_required')
  if(nyDbl && nyDbl.rows.reduce((n,w)=>n+w.wagesCents,0)!==gross) reject('dbl_wages_do_not_match_preview')
  const p=periods[input.frequency] as PayPeriods
  let federal:ReturnType<typeof calculateIndustryPay>
  try { federal=calculateIndustryPay({payDate:input.payDate,cashGrossCents:gross,housingAllowanceCents:0,shareholderHealthInsuranceCents:0,periodsPerYear:p,facts:{...noTaxFacts,claims:[]},w4:input.w4,yearToDate:input.yearToDate}) } catch(error) {
    if(!(error instanceof Error)||error.message!=='industry_cash_insufficient_for_regular_wage_withholding')throw error
    hold('regular-wage-cash-insufficient',input.workState,'Regular wage taxes exceed cash wages. Review the election and lawful collection; no negative payout is created.')
    return {...(retirement?{extendedRetirement:retirement}:{}),edition:input.edition,payDate:input.payDate,status:'held',paymentReady:false,approval:'unavailable',dispatch:'unavailable',earnings,grossCashCents:gross,federal:null,state:null,netCashCents:null,holds,coverage:stateCoverage(input.edition)}
  }
  let state=stateWithholding(input.workState,gross,input.frequency,input.payDate,input.stateElection,federal.employeeTaxes.incomeTaxCents,federal.employeeTaxes.socialSecurityCents+federal.employeeTaxes.medicareCents+federal.employeeTaxes.additionalMedicareCents,input.through)
  if(['CT','MA'].includes(input.workState)&&earnings?.weeks.some(w=>w.overtimeCents||w.productionBonusCents||w.premiums.length))state={...state,withholdingCents:null,reason:input.workState+' supplemental compensation requires its separate official withholding method; the periodic ordinary-wage calculation is not substituted.'}
  if(input.workState!==input.residentState)state={...state,withholdingCents:null,reason:'Cross-state sourcing and resident credits are unmapped; no single-state amount is substituted for them.'}
  if(input.tips.heldCents+input.tips.paycheckCents && !['AK','FL','NV','NH','SD','TN','TX','WA','WY'].includes(input.workState))state={...state,withholdingCents:null,reason:'Reported-tip state taxability and collection are not mapped; the ordinary wage component cannot be used as total withholding.'}
  if(state.withholdingCents===null)hold('state-withholding-unmapped',input.workState,state.reason)
  // A component result cannot establish complete taxes for a state. All other
  // state programs and local obligations remain explicit coverage holds.
  if(input.workState!=='TX')hold('state-programs-unmapped',input.workState,'Complete SUI, disability, leave, compensation and other applicable assessments remain unproved for this state.')
  if(input.workState==='TX' && input.locality!=='none')hold('texas-location-unmapped',input.locality,'The Texas no-local-income-tax determination requires an identified Texas location.')

  const tips=input.tips.heldCents+input.tips.paycheckCents
  const tip= tips ? calculateTipTaxes({wagesCents:gross,heldTipsCents:checked(input.tips.heldCents),paycheckTipsCents:checked(input.tips.paycheckCents),furnishedCents:checked(input.tips.furnishedCents),socialSecurityBeforeCents:input.yearToDate.socialSecurityWagesCents,medicareBeforeCents:input.yearToDate.medicareWagesCents,w4:input.w4,periods:p,payDate:input.payDate}) : undefined
  if(!tips && input.tips.furnishedCents)reject('furnished_funds_require_reported_tips')
  const newCash=gross+input.tips.paycheckCents
  const combinedFederalEmployer={socialSecurityCents:tip?tip.employer.socialSecurityCents:federal.employerTaxes.socialSecurityCents,medicareCents:tip?tip.employer.medicareCents:federal.employerTaxes.medicareCents,futaCents:roundRatio(BigInt(Math.min(gross+tips,Math.max(0,700000-input.yearToDate.futaWagesCents)))*600n,10000n)}
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
  const sui=year==='2026'&&input.workState==='TX'?{taxableWagesCents:suiBase,amountCents:roundRatio(BigInt(suiBase)*270n,10000n),rateBasisPoints:270,determination:'Texas 2.7% floor only; NAICS new-employer rate and assigned rate require review',source:'https://www.twc.texas.gov/programs/unemployment-tax/tax-rates'}:null
  // A 2.7% floor is not an employer-specific SUI determination.
  hold('sui-rate-review-required',input.workState,'The current assigned or NAICS-specific new-employer SUI rate must be supplied by a reviewed rule edition.')
  return {edition:input.edition,payDate:input.payDate,status:holds.length?'held':'calculated-preview',paymentReady:false,approval:'unavailable',dispatch:'unavailable',
    assumptions:{worker:'Ordinary resident employee of a taxable corporation, with no federal exemption',taxability:'Ordinary taxable cash wages; no pre-tax benefits, imputed income or special wage exclusions',companyEntity:'Hypothetical assumption; no actual company tax-entity determination is read or changed'},
    federalRatesBasisPoints:{socialSecurity:620,medicare:145,additionalMedicare:90,futaBeforeCredits:600},
    ...(retirement?{extendedRetirement:retirement}:{}),
    earnings,grossCashCents:gross,heldTipsCents:input.tips.heldCents,paycheckTipsCents:input.tips.paycheckCents,newCashBeforeTaxCents:newCash,
    nyDbl,federal,state,tipTaxes:tip,federalEmployerTaxes:combinedFederalEmployer,sui,deductions,federalGarnishmentLimitCents:federalGarnishmentLimit,
    netCashCents:holds.length?null:disposable-deducted,holds,coverage:stateCoverage(input.edition),
    limitations:['Proposed calculation only; no money moves and no historical payroll record is changed.','The complete 51-state programs and the 688-entry large-local file remain in the denominator.','No supplied account number, provider grant or client approval creates payment authority.']}
}

/** Retained retirement proposals expose their wage effects separately from the ordinary payroll estimate. */
export function retirementCalculationPreview(input: PreviewInput, election: RetirementElection) {
  const ordinaryPayrollPreview = calculationPreview(input)
  if (input.tips.heldCents || input.tips.paycheckCents || input.deductions.length) throw new Error('retirement_special_payroll_unavailable')
  const contribution = retirementContribution(election,ordinaryPayrollPreview.grossCashCents,input.payDate,input.from,input.through)
  return { ordinaryPayrollPreview, contribution, paymentReady:false, netCashCents:null,
    limitation:'Retirement wage effects are proposed separately. The ordinary payroll estimate has not applied these deductions; no complete pay, settled correction or provider outcome is recorded.' }
}
