import {roundRatio,validCents} from '../industry/federal-withholding'
export const oregonSource='https://www.oregon.gov/dor/forms/FormsPubs/withholding-tax-formulas_206-436_2026.pdf'
/** Ordinary single OR-W-4 zero-allowance wages. Retain explicit source conflicts. */
export function oregonWithholding(wages:number,periods:number,federal:number,election:Record<string,unknown>){
 if(Object.keys(election).length!==3||election.filingStatus!=='single'||election.allowances!==0||!validCents(election.additionalCents))throw new Error('oregon_single_zero_allowance_certificate_required')
 const annual=BigInt(wages)*BigInt(periods),fit=BigInt(federal)*BigInt(periods)
 const unmapped=(reason:string)=>({withholdingCents:null,reason,calculation:{annualWagesCents:annual.toString(),federalIncomeTaxCents:fit.toString(),method:'2026 formulas pages 6 and 7'}})
 // The 2026 formula states $8,750; its FAQ 3 still says $8,500. Below
 // $8,500 both give the same subtraction. Do not invent an interpretation
 // for the disputed interval; those proposed checks remain visibly held.
 if(fit>850000n && annual<12500000n)return unmapped('The retained official Oregon edition conflicts on the federal subtraction cap; source clarification is required for this check.')
 const caps=annual>=14500000n?0:annual>=14000000n?175000:annual>=13500000n?350000:annual>=13000000n?525000:annual>=12500000n?700000:875000
 const subtraction=fit<BigInt(caps)?fit:BigInt(caps)
 const base=annual-subtraction-291000n
 if(base<0n)return unmapped('The proposed Oregon base falls outside the retained formula table; low-wage applicability requires mapping.')
 let numerator:bigint
 const rateBasisPoints=annual<5000000n?(base<=455000n?475:base<=1140000n?675:875):base<=12500000n?875:990
 if(annual<5000000n){
   numerator=base<=455000n?26300n*10000n+base*475n:base<=1140000n?47900n*10000n+(base-455000n)*675n:94100n*10000n+(base-1140000n)*875n
 }else{
   numerator=base<=12500000n?67800n*10000n+(base-1140000n)*875n:1061800n*10000n+(base-12500000n)*990n
 }
 const ordinary=roundRatio(numerator>0n?numerator:0n,BigInt(periods)*10000n)
 return {withholdingCents:ordinary+election.additionalCents,reason:'Ordinary single zero-allowance OR-W-4 only; WBF, transit, paid leave and local programs remain separate.',calculation:{annualWagesCents:annual.toString(),federalSubtractionCents:subtraction.toString(),standardDeductionCents:291000,baseCents:base.toString(),additionalCents:election.additionalCents,method:'2026 annual formulas, pages 6 and 7',rateBasisPoints,rounding:'Nearest cent, half up; optional whole-dollar rounding not selected.'}}
}
