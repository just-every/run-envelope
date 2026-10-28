import {roundRatio,validCents} from '../industry/federal-withholding'
export const massachusettsSource='https://www.mass.gov/doc/massachusetts-circular-m-income-tax-withholding-tables-at-50-effective-january-1-2026/download'
export function massachusettsWithholding(wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',ficaCents:number|undefined,election:Record<string,unknown>){
 const keys=['allowances','headOfHousehold','blindCount','retirementDeductedBeforeCents','otherRetirementCurrentCents','additionalCents']
 if(Object.keys(election).length!==keys.length||!keys.every(k=>Object.hasOwn(election,k))||!validCents(ficaCents)||!validCents(election.allowances)||typeof election.headOfHousehold!=='boolean'||![0,1,2].includes(Number(election.blindCount))||!validCents(election.blindCount)||!validCents(election.retirementDeductedBeforeCents)||election.retirementDeductedBeforeCents>200000||!validCents(election.otherRetirementCurrentCents)||election.otherRetirementCurrentCents>wages||!validCents(election.additionalCents))throw new Error('massachusetts_m4_and_actual_retirement_accumulator_required')
 const [periods,one,per,base,head,blind,minimum]={weekly:[52,8500,1900,6600,231,212,15400],biweekly:[26,16900,3800,13100,462,423,30800],semimonthly:[24,18300,4200,14100,500,458,33300],monthly:[12,36700,8300,28400,1000,917,66700]}[frequency]
 const retirement=Math.min(200000-election.retirementDeductedBeforeCents,ficaCents+election.otherRetirementCurrentCents)
 const exemption=election.allowances===0?0:election.allowances===1?one:per*election.allowances+base
 const taxable=Math.max(0,wages-retirement-exemption),annual=BigInt(taxable)*BigInt(periods),threshold=110775000n
 const raw=(annual>threshold?threshold*500n+(annual-threshold)*900n:annual*500n)
 const beforeCredits=roundRatio(raw,BigInt(periods)*10000n)
 const ordinary=election.allowances>0&&wages<minimum?0:Math.max(0,beforeCredits-(election.headOfHousehold?head:0)-blind*election.blindCount)
 return {withholdingCents:ordinary+election.additionalCents,reason:'Circular M ordinary percentage method; supplemental wages, PFML and other programs remain separate.',calculation:{method:'Circular M Rev. 12/25 ordinary wages steps 1 through 7',actualFicaCents:ficaCents,retirementDeductedBeforeCents:election.retirementDeductedBeforeCents,currentRetirementDeductionCents:retirement,periodExemptionCents:exemption,annualTaxableWagesCents:annual.toString(),surtaxThresholdCents:threshold.toString(),ratesBasisPoints:[500,900],periodHeadOfHouseholdCreditCents:election.headOfHousehold?head:0,periodBlindCreditCents:blind*election.blindCount,additionalCents:election.additionalCents,rounding:'Nearest cent after annual tax and division, then subtract printed period credits'}}
}
