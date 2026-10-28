import {roundRatio,validCents} from '../industry/federal-withholding'
type Row=readonly [number,number,number]
export const bracketStateSources:Record<string,string>={
 DE:'https://revenue.delaware.gov/employers-guide-withholding-regulations-employers-duties/',
 KS:'https://www.ksrevenue.gov/kw100.html',
}
const tables:Record<string,readonly Row[]>={
 DE:[[0,0,0],[2000,0,220],[5000,66,390],[10000,261,480],[20000,741,520],[25000,1001,555],[60000,2943.50,660]],
}
const cents=(v:number)=>BigInt(Math.round(v*100))
export function bracketState(state:string,wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',election:Record<string,unknown>){
 if(!Object.hasOwn(bracketStateSources,state))return null
 if(Object.keys(election).some(k=>!['filingStatus','allowances','additionalCents'].includes(k))||Object.keys(election).length!==3||!['single','married'].includes(String(election.filingStatus))||!validCents(election.allowances)||!validCents(election.additionalCents))throw new Error('explicit_state_certificate_required')
 const periods={weekly:52,biweekly:26,semimonthly:24,monthly:12}[frequency]
 let withholding:number,detail:Record<string,unknown>
 if(state==='KS'){
   const married=election.filingStatus==='married',allowances=election.allowances
   const personal=married?Math.min(allowances,2)*916000:Math.min(allowances,1)*916000
   const dependents=Math.max(0,allowances-(married?2:1))*232000
   const allowance=roundRatio(BigInt(personal+dependents),BigInt(periods))
   const net=Math.max(0,wages-allowance)
   const values={weekly:{single:[69,512,23],married:[158,1043,46]},biweekly:{single:[139,1023,46],married:[317,2086,92]},semimonthly:{single:[150,1109,49.83],married:[343,2260,99.67]},monthly:{single:[300,2217,99.67],married:[687,4520,199.33]}}[frequency][married?'married':'single']
   const [low,high,base]=values
   withholding=net>high*100?Number(cents(base))+roundRatio(BigInt(net-high*100)*558n,10000n):net>low*100?roundRatio(BigInt(net-low*100)*520n,10000n):0
   detail={method:'KW-100 published percentage period table',periodsPerYear:periods,periodAllowanceCents:allowance,netWagesCents:net,lowerThresholdDollars:low,upperThresholdDollars:high,upperBaseDollars:base,rounding:'Nearest cent, half up; optional whole-dollar rounding not selected.'}
 }else{
   const deduction=election.filingStatus==='married'?650000n:325000n
   const taxable=BigInt(wages)*BigInt(periods)>deduction?BigInt(wages)*BigInt(periods)-deduction:0n
   const row=[...tables[state]].reverse().find(r=>taxable>=cents(r[0]))??tables[state][0]
   const annual=cents(row[1])*10000n+(taxable-cents(row[0]))*BigInt(row[2])-BigInt(election.allowances)*11000n*10000n
   withholding=roundRatio(annual>0n?annual:0n,BigInt(periods)*10000n)
   detail={method:'Delaware exact annual computation',annualStandardDeductionCents:String(deduction),taxableAnnualWagesCents:taxable.toString(),annualCreditCents:election.allowances*11000,bracket:{floorDollars:row[0],baseDollars:row[1],rateBasisPoints:row[2]}}
 }
 return {withholdingCents:withholding+election.additionalCents,calculation:{...detail,additionalCents:election.additionalCents}}
}
