import {roundRatio,validCents} from '../industry/federal-withholding'
export const maineSource='https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_wh_tab_instr_August2026.pdf'
export function maineWithholding(wages:number,periods:number,election:Record<string,unknown>){
 if(Object.keys(election).length!==3||!['single','married'].includes(String(election.filingStatus))||!validCents(election.allowances)||!validCents(election.additionalCents))throw new Error('maine_w4me_required')
 const married=election.filingStatus==='married',annual=BigInt(wages)*BigInt(periods)
 if(annual>BigInt(married?20455000:10225000))return {withholdingCents:null,reason:'Maine high-income standard-deduction phaseout and surcharge require the retained four-decimal method and boundary cases; no low-income rule is substituted.'}
 const standard=BigInt(married?2855000:1285000),deductions=standard+BigInt(election.allowances)*530000n
 const taxable=annual>deductions?annual-deductions:0n
 const rows=married?[[0,0,580],[54850,3181,675],[129750,8237,715]]:[[0,0,580],[27400,1589,675],[64850,4117,715]]
 const row=[...rows].reverse().find(r=>taxable>=BigInt(r[0])*100n)??rows[0]
 const raw=BigInt(row[1])*1000000n+(taxable-BigInt(row[0])*100n)*BigInt(row[2])
 return {withholdingCents:100*roundRatio(raw,BigInt(periods)*1000000n)+election.additionalCents,reason:'Maine ordinary percentage method below the standard-deduction phaseout; other programs remain unmapped.',calculation:{method:'2026 revised August percentage method steps 1 through 6',annualSalaryCents:annual.toString(),annualStandardDeductionCents:standard.toString(),annualAllowanceDollars:5300,taxableAnnualWagesCents:taxable.toString(),annualBracketFloorDollars:row[0],annualBracketBaseDollars:row[1],rateBasisPoints:row[2],rounding:'Nearest whole dollar after division by payroll frequency',additionalCents:election.additionalCents}}
}
