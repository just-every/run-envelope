import {roundRatio,validCents} from '../industry/federal-withholding'
export const alabamaSource='https://www.revenue.alabama.gov/wp-content/uploads/2026/01/whbooklet_0126.pdf'
/** A-4 ordinary-wage formula, January 2026 booklet pages 7 and 8. */
export function alabamaWithholding(wages:number,periods:number,federal:number,election:Record<string,unknown>){
 if(Object.keys(election).length!==3||!['0','S','MS','M','H'].includes(String(election.filingStatus))||!validCents(election.dependents)||!validCents(election.additionalCents))throw new Error('alabama_a4_certificate_required')
 const status=String(election.filingStatus),annual=BigInt(wages)*BigInt(periods)
 const separate=status==='MS',joint=status==='M',head=status==='H'
 const maximum=separate?425000n:joint?850000n:head?520000n:300000n
 const minimum=joint?500000n:250000n,threshold=separate?1299900n:2599900n
 const interval=separate?25000n:50000n,decrement=separate?8800n:joint?17500n:head?13500n:2500n
 const increments=annual>threshold?(annual-threshold+interval-1n)/interval:0n
 const reduced=maximum-increments*decrement,standard=reduced<minimum?minimum:reduced
 const personal=status==='0'?0n:joint||head?300000n:150000n
 const perDependent=annual<=5000000n?100000n:annual<=10000000n?50000n:30000n
 const deductions=standard+personal+BigInt(election.dependents)*perDependent+BigInt(federal)*BigInt(periods)
 const taxable=annual>deductions?annual-deductions:0n
 const first=joint?100000n:50000n,second=joint?600000n:300000n
 const numerator=taxable<=first?taxable*200n:taxable<=second?first*200n+(taxable-first)*400n:first*200n+(second-first)*400n+(taxable-second)*500n
 return {withholdingCents:roundRatio(numerator,BigInt(periods)*10000n)+election.additionalCents,
   calculation:{method:'January 2026 A-4 annual computer formula',ratesBasisPoints:[200,400,500],bracketFloorsCents:['0',first.toString(),second.toString()],annualWagesCents:annual.toString(),federalDeductionCents:String(BigInt(federal)*BigInt(periods)),standardDeductionCents:standard.toString(),personalExemptionCents:personal.toString(),dependentExemptionCents:String(BigInt(election.dependents)*perDependent),taxableAnnualWagesCents:taxable.toString(),additionalCents:election.additionalCents}}
}
