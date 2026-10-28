import {roundRatio,validCents} from '../industry/federal-withholding'
export const mississippiSource='https://www.dor.ms.gov/sites/default/files/business/Computer%20Payroll%20Flowchart%20-%20updated%208-13-25.pdf'
/** DOR computer flowchart explicitly labeled for periods in 2026. */
export function mississippiWithholding(wages:number,periods:number,election:Record<string,unknown>){
 if(Object.keys(election).length!==3||!['S','M','B','H'].includes(String(election.filingStatus))||!validCents(election.exemptionCents)||!validCents(election.additionalCents))throw new Error('mississippi_signed_certificate_amount_required')
 const standard=election.filingStatus==='M'?460000:election.filingStatus==='H'?340000:230000
 const taxable=BigInt(wages)*BigInt(periods)-BigInt(standard)-BigInt(election.exemptionCents)
 const excess=taxable>1000000n?taxable-1000000n:0n
 const ordinary=100*roundRatio(excess*400n,BigInt(periods)*1000000n)
 const withholding=100*roundRatio(BigInt(ordinary+election.additionalCents),100n)
 return {withholdingCents:withholding,calculation:{method:'DOR 2026 computer payroll flowchart',standardDeductionCents:standard,annualCertificateExemptionCents:election.exemptionCents,taxableAnnualWagesCents:(taxable>0n?taxable:0n).toString(),zeroRateBandCents:1000000,rateBasisPoints:400,additionalCents:election.additionalCents,rounding:'Whole dollars on period tax, then whole dollars after the agreed additional amount'}}
}
