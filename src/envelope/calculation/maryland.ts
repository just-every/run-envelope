import {roundRatio,validCents} from '../industry/federal-withholding'
export const marylandSource='https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf'
export function marylandWithholding(wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',election:Record<string,unknown>){
 if(Object.keys(election).length!==3||!['single','joint'].includes(String(election.filingStatus))||!validCents(election.allowances)||!validCents(election.additionalCents))throw new Error('maryland_mw507_election_required')
 const [standard,exemption,minimum,singleCeiling,jointCeiling]={weekly:[6538,6154,9600,192300,288500],biweekly:[13076,12308,19200,384600,576900],semimonthly:[14166,13333,20800,416700,625000],monthly:[28333,26667,41700,833300,1250000]}[frequency]
 const taxable=Math.max(0,wages-standard-exemption*election.allowances)
 if(taxable>(election.filingStatus==='joint'?jointCeiling:singleCeiling))return {withholdingCents:null,reason:'Maryland higher percentage brackets and complete county withholding require their published period tables; the first state bracket is not substituted.'}
 return {withholdingCents:wages<minimum?0:roundRatio(BigInt(taxable)*475n,10000n)+election.additionalCents,reason:'State component only, in the first published percentage bracket. County or special nonresident tax is not included and remains held.',calculation:{method:'2026 Employer Withholding Guide percentage method, first state bracket',periodStandardDeductionCents:standard,periodExemptionCents:exemption,taxablePeriodWagesCents:taxable,rateBasisPoints:wages<minimum?0:475,grossMinimumCents:minimum,additionalCents:election.additionalCents,countyAmountCents:null,rounding:'Nearest cent, half up'}}
}
