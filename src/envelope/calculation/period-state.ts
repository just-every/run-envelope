import {roundRatio,validCents} from '../industry/federal-withholding'
export const periodStateSources:Record<string,string>={
 UT:'https://tax.utah.gov/forms-pubs/pub-14/',
 CO:'https://tax.colorado.gov/sites/tax/files/documents/DR_1098_Colorado_Withholding_Worksheet_for_Employees.pdf',
 ID:'https://tax.idaho.gov/wp-content/uploads/pubs/EPB00744/EPB00744_07-23-2026.pdf',
 IA:'https://revenue.iowa.gov/media/53/download?inline=',
}
const exactKeys=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
const positive=(n:bigint)=>n>0n?n:0n
export function periodState(state:string,wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',payDate:string,election:Record<string,unknown>){
 if(!Object.hasOwn(periodStateSources,state))return null
 const periods={weekly:52,biweekly:26,semimonthly:24,monthly:12}[frequency]
 let amount:number,detail:Record<string,unknown>
 if(state==='UT'){
   if(!exactKeys(election,['certificate','filingStatus'])||election.certificate!=='modern-w4'||!['single','married','head_household'].includes(String(election.filingStatus)))throw new Error('utah_modern_certificate_required')
   const [allowance,threshold]={weekly:{single:[9,180],married:[19,360]},biweekly:{single:[19,360],married:[37,719]},semimonthly:{single:[20,390],married:[40,779]},monthly:{single:[40,779],married:[81,1558]}}[frequency][election.filingStatus==='married'?'married':'single']
   const gross=BigInt(wages)*445n,credit=positive(BigInt(allowance)*1000000n-positive(BigInt(wages)-BigInt(threshold)*100n)*130n)
   amount=roundRatio(positive(gross-credit),10000n)
   detail={method:'Publication 14 published period schedule',rateBasisPoints:445,baseAllowanceDollars:allowance,thresholdDollars:threshold,phaseoutBasisPoints:130}
 }else if(state==='CO'){
   if(!exactKeys(election,['certificate','filingStatus'])||election.certificate!=='w4-only'||!['single','married_joint','head_household'].includes(String(election.filingStatus)))throw new Error('colorado_w4_only_election_required')
   const deduction=election.filingStatus==='married_joint'?1100000n:550000n
   amount=roundRatio(positive(BigInt(wages)*BigInt(periods)-deduction)*440n,BigInt(periods)*10000n)
   detail={method:'DR1098 lines 1a through 2f',certificate:election.certificate,annualDeductionCents:String(deduction),rateBasisPoints:440,rounding:'Nearest cent, half up; no inferred whole-dollar federal payroll rounding.'}
 }else if(state==='ID'){
   if(payDate<'2026-07-23')throw new Error('idaho_retained_july_edition_not_yet_effective')
   if(!exactKeys(election,['filingStatus','childAllowances','additionalCents'])||!['single','married','head_household'].includes(String(election.filingStatus))||election.childAllowances!==0||!validCents(election.additionalCents))throw new Error('idaho_explicit_current_election_required')
   const thresholds={weekly:[31000,61900],biweekly:[61900,123800],semimonthly:[67100,134200],monthly:[134200,268300]}
   const threshold=thresholds[frequency][election.filingStatus==='married'?1:0]
   amount=roundRatio(positive(BigInt(wages)-BigInt(threshold))*530n,10000n)+election.additionalCents
   detail={method:'EPB00744 published period table',thresholdCents:threshold,rateBasisPoints:530,childAllowances:0,additionalCents:election.additionalCents}
 }else{
   if(!exactKeys(election,['formYear','filingStatus','annualAllowanceCents','additionalCents'])||election.formYear!==2026||!['other','head_household','joint-single-income'].includes(String(election.filingStatus))||!validCents(election.annualAllowanceCents)||!validCents(election.additionalCents))throw new Error('iowa_2026_certificate_required')
   const deductions={weekly:[25000,37500,50000],biweekly:[50000,75000,100000],semimonthly:[54167,81250,108333],monthly:[108333,162500,216667]}
   const deduction=deductions[frequency][['other','head_household','joint-single-income'].indexOf(String(election.filingStatus))]
   // Iowa's worked examples round T2 and W divided by P to cents separately.
   const t2=roundRatio(positive(BigInt(wages)-BigInt(deduction))*380n,10000n)
   const allowance=roundRatio(BigInt(election.annualAllowanceCents),BigInt(periods))
   amount=Math.max(0,t2-allowance)+election.additionalCents
   detail={method:'2026 formula steps 1A, 2, 3A and 4',deductionCents:deduction,rateBasisPoints:380,t2Cents:t2,periodAllowanceCents:allowance,additionalCents:election.additionalCents}
 }
 return {withholdingCents:amount,calculation:detail}
}
