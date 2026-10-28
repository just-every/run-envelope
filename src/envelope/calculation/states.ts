import { njWithholding,type NjWithholdingInput } from '../workspace/nj-withholding'
import { nyWithholding,type NyWithholdingInput } from '../workspace/ny-withholding'
import { roundRatio,validCents } from '../industry/federal-withholding'
const states='AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
const sources:Record<string,string>={
  PA:'https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/employer-withholding',
  NJ:'https://www.nj.gov/treasury/taxation/pdf/withholdingtables.pdf',
  NY:'https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf',
  IL:'https://tax.illinois.gov/forms/withholding/currentyear/il-700-t-withholding-guide-tables.html',
  AZ:'https://azdor.gov/forms/withholding-forms/arizona-withholding-percentage-election',
  TX:'https://comptroller.texas.gov/taxes/',
  WA:'https://dor.wa.gov/taxes-rates/income-tax',
  NH:'https://www.revenue.nh.gov/taxes-glance',
}
const mapped=Object.keys(sources)
export function stateCoverage(){return {edition:'2026-01',retrievedAt:'2026-10-28',total:states.length,
  mappedWithholdingComponents:mapped.length,completeStates:0,complete:false,
  states:states.map(state=>({state,withholding:mapped.includes(state)?'ordinary-cash-component':'unmapped',programs:'unmapped',
    source:sources[state]??'https://taxadmin.org/state-tax-agencies/',
    suiSource:'https://oui.doleta.gov/unemploy/content/sigpros/2020-2029/January2026.pdf',
    nextAction:'Map current official state programs and local authorities before calculating a complete paycheck.'}))}}
export function stateWithholding(state:string,wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',payDate:string,election:Record<string,unknown>){
  const base={state,taxableWagesCents:wages,withholdingCents:null as number|null,source:sources[state]??'https://taxadmin.org/state-tax-agencies/',effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',retrievedAt:'2026-10-28',
    reason:'Current official withholding rules and a cent-level public-door case are not mapped for this state.'}
  if(!states.includes(state) || !mapped.includes(state))return base
  if(!election || typeof election!=='object' || Array.isArray(election))throw new Error('state_election_required')
  if(!/^2026-/.test(payDate))throw new Error('state_withholding_edition_unavailable')
  let withholding:number
  let detail:unknown
  if(['TX','WA','NH'].includes(state)){
    if(Object.keys(election).length)throw new Error('unexpected_state_election')
    withholding=0;detail={determination:'No individual wage income tax; other payroll programs remain separately required.'}
  }else if(state==='PA'){
    if(Object.keys(election).length)throw new Error('unsupported_pa_election')
    withholding=roundRatio(BigInt(wages)*307n,10000n);detail={rateBasisPoints:307,rounding:'Aggregate period compensation, nearest cent half up.'}
  }else if(state==='NJ'){
    if(Object.keys(election).some(k=>!['table','allowances','additionalCents'].includes(k)))throw new Error('unsupported_nj_election')
    const result=njWithholding({...election,taxableWagesCents:wages,frequency,payDate} as NjWithholdingInput)
    withholding=result.withholdingCents;detail=result.calculation
  }else if(state==='NY'){
    if(Object.keys(election).some(k=>!['filingStatus','allowances','additionalCents'].includes(k)))throw new Error('unsupported_ny_election')
    const result=nyWithholding({...election,taxableWagesCents:wages,frequency,payDate} as NyWithholdingInput)
    withholding=result.withholdingCents;detail=result.calculation
  }else if(state==='AZ'){
    if(Object.keys(election).some(k=>!['rateBasisPoints','additionalCents'].includes(k)) || ![50,100,150,200,250,300,350].includes(Number(election.rateBasisPoints)) || !validCents(election.rateBasisPoints) || !validCents(election.additionalCents))throw new Error('reviewed_arizona_a4_election_required')
    withholding=roundRatio(BigInt(wages)*BigInt(election.rateBasisPoints),10000n)+election.additionalCents;detail=election
  }else{
    if(Object.keys(election).some(k=>!['allowances','additionalAllowances','additionalCents'].includes(k)) || !validCents(election.allowances)||!validCents(election.additionalAllowances)||!validCents(election.additionalCents))throw new Error('illinois_w4_election_required')
    const periods={weekly:52,biweekly:26,semimonthly:24,monthly:12}[frequency]
    const annual=BigInt(wages)*BigInt(periods)-BigInt(election.allowances)*292500n-BigInt(election.additionalAllowances)*100000n
    withholding=roundRatio((annual>0n?annual:0n)*495n,BigInt(periods)*10000n)+election.additionalCents
    detail={rateBasisPoints:495,annualExemptionCents:292500,annualAdditionalAllowanceCents:100000,...election}
  }
  return {...base,withholdingCents:withholding,calculation:detail,reason:'Ordinary taxable cash wages only; no residency credit, reciprocal exemption, supplemental flat-rate election or complete program determination.'}
}
