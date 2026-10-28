import { roundRatio, validCents } from '../industry/federal-withholding'

// Extracted ordinary-wage rules. Published annual methods retain full precision
// until the source's specified rounding step; no binary floating-point money.
type Row=readonly [floorDollars:number,baseDollars:number,rateBasisPoints:number]
const caSingle:readonly Row[]=[[0,0,110],[11079,121.87,220],[26264,455.94,440],[41452,1124.21,660],[57542,2186.15,880],[72724,3522.17,1023],[371479,34084.81,1133],[445771,42502.09,1243],[742953,79441.81,1353],[1000000,114220.27,1463]]
const caMarried:readonly Row[]=[[0,0,110],[22158,243.74,220],[52528,911.88,440],[82904,2248.42,660],[115084,4372.30,880],[145448,7044.33,1023],[742958,68169.60,1133],[891542,85004.17,1243],[1000000,98485.50,1353],[1485906,164228.58,1463]]
const caHead:readonly Row[]=[[0,0,110],[22173,243.90,220],[52530,911.75,440],[67716,1579.93,660],[83805,2641.80,880],[98990,3978.08,1023],[505208,45534.18,1133],[606251,56982.35,1243],[1000000,105925.35,1353],[1010417,107334.77,1463]]
const cents=(v:number)=>BigInt(Math.round(v*100))
const nonnegative=(v:bigint)=>v>0n?v:0n
export const annualStateSources:Record<string,string>={
 NE:'https://revenue.nebraska.gov/sites/revenue.nebraska.gov/files/doc/business/Cir_En_2025/2026cir_en_whole.pdf',
 SC:'https://dor.sc.gov/sites/dor/files/forms/WH1603F_2026.pdf',
 DC:'https://otr.cfo.dc.gov/am/page/dc-individual-and-fiduciary-income-tax-rates',
 WI:'https://www.revenue.wi.gov/DOR%20Publications/pb166.pdf',
 VA:'https://www.tax.virginia.gov/sites/default/files/taxforms/withholding/any/employer-withholding-tables-july-2025-and-later-any.pdf',
 MN:'https://www.revenue.state.mn.us/sites/default/files/2025-12/wh-inst-26.pdf',
 ND:'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2026-iit/2026-income-tax-withholding-rates-booklet.pdf',
 MO:'https://dor.mo.gov/forms/Withholding%20Formula_2026.pdf',
 CA:'https://edd.ca.gov/siteassets/files/pdf_pub_ctr/26methb.pdf',
 NC:'https://www.ncdor.gov/income-tax-withholding-tables-and-instructions-employers/open',
 KY:'https://revenue.ky.gov/Software-Developer/Software%20Development%20Documents/2026%20Withholding%20Tax%20Tables%20-%20Computer%20Formula%2042A003%20%28TCF%29%2810-2025%29%282026%29.pdf',
 MI:'https://www.michigan.gov/taxes/business-taxes/withholding/calendar-year-tax-information',
 IN:'https://www.in.gov/dor/files/dn01.pdf',
}
/** Annual tax in ten-thousandths of one cent, before source rounding. */
function brackets(wages:bigint,rows:readonly Row[],denominator=1n){
 const row=[...rows].reverse().find(r=>wages>=cents(r[0])*denominator)??rows[0]
 return cents(row[1])*10000n*denominator+nonnegative(wages-cents(row[0])*denominator)*BigInt(row[2])
}
export function annualState(state:string,wages:number,periods:number,election:Record<string,unknown>){
 if(!Object.hasOwn(annualStateSources,state))return null
 if(Object.keys(election).some(k=>!['filingStatus','allowances','additionalAllowances','additionalCents'].includes(k)) || !['single','married','head_household'].includes(String(election.filingStatus)) || !validCents(election.allowances) || !validCents(election.additionalAllowances) || !validCents(election.additionalCents))throw new Error('complete_state_election_required')
 const a=BigInt(wages)*BigInt(periods),allowances=election.allowances,additionalAllowances=election.additionalAllowances,status=election.filingStatus
 const trace:Record<string,unknown>[]=[]
 const apply=(wages:bigint,rows:readonly Row[],denominator=1n)=>{const row=[...rows].reverse().find(r=>wages>=cents(r[0])*denominator)??rows[0];trace.push({base:{numerator:wages.toString(),denominator:denominator.toString(),unit:'cents'},floorDollars:row[0],annualTaxBaseDollars:row[1],rateBasisPoints:row[2]});return brackets(wages,rows,denominator)}
 let annual=0n,annualDenominator=1n,detail:Record<string,unknown>={},rounding:'cent'|'dollar'='cent'
 if(state==='CA'){
   const joint=status==='married'&&allowances>=2,head=status==='head_household',large=joint||head
   const low=large?37791:18896,standard=large?11412:5706
   const taxable=nonnegative(a-cents(standard)-BigInt(additionalAllowances)*100000n)
   const rows=head?caHead:status==='married'?caMarried:caSingle
   if(a>cents(low))annual=nonnegative(brackets(taxable,rows)-BigInt(allowances)*16830n*10000n)
   detail={method:'Method B annual method, page 4',lowIncomeExemptionDollars:low,standardDeductionDollars:standard,additionalDeductionDollars:additionalAllowances*1000,annualCreditCents:allowances*16830,taxableAnnualWagesCents:taxable.toString()}
 }else if(state==='NC'){
   if(additionalAllowances)throw new Error('unsupported_nc_additional_allowances')
   const standard=status==='head_household'?19125:12750,taxable=nonnegative(a-cents(standard)-BigInt(allowances)*250000n)
   annual=taxable*409n;rounding='dollar';detail={method:'NC-30 annualized wages, page 19',standardDeductionDollars:standard,allowanceDollars:2500,rateBasisPoints:409,taxableAnnualWagesCents:taxable.toString()}
 }else if(state==='KY'){
   if(allowances||additionalAllowances)throw new Error('kentucky_has_no_withholding_allowance')
   const taxable=nonnegative(a-336000n);annual=taxable*350n;detail={standardDeductionDollars:3360,rateBasisPoints:350,taxableAnnualWagesCents:taxable.toString()}
 }else if(state==='MI'){
   if(additionalAllowances)throw new Error('unsupported_michigan_additional_allowance')
   const taxable=nonnegative(a-BigInt(allowances)*590000n);annual=taxable*425n;detail={annualExemptionDollars:5900,rateBasisPoints:425,taxableAnnualWagesCents:taxable.toString()}
 }else if(state==='NE'){
   if(allowances||additionalAllowances)throw new Error('nebraska_nonzero_allowances_and_minimum_rule_unmapped')
   const rows:readonly Row[]=status==='married'?[[0,0,0],[8190,0,226],[13010,108.93,322],[32400,733.29,421],[50400,1491.09,435],[62530,2018.75,448],[82920,2932.22,460]]:[[0,0,0],[3430,0,226],[6710,74.13,322],[21810,560.35,421],[31610,972.93,435],[40130,1343.55,448],[75370,2922.30,460]]
   annual=apply(a,rows);detail={method:'Circular EN annualized-wages method used consistently with federal annualized withholding, page 8',allowances:0,taxableAnnualWagesCents:a.toString()}
 }else if(state==='SC'){
   if(additionalAllowances)throw new Error('unsupported_south_carolina_additional_allowance')
   const deduction=allowances?(a<7500000n?a:7500000n):0n
   const taxable=nonnegative(a*10n-deduction-BigInt(allowances)*5000000n)
   annualDenominator=10n
   annual=apply(taxable,[[0,0,0],[3640,0,300],[18230,437.70,600]],annualDenominator)
   detail={method:'2026 WH-1603F annual addition method',taxableAnnualWages:{numerator:taxable.toString(),denominator:'10',unit:'cents'},annualAllowanceDollars:5000}
 }else if(state==='DC'){
   if(status!=='single'||allowances||additionalAllowances||election.additionalCents)throw new Error('dc_single_zero_allowance_component_only')
   annual=apply(a,[[0,0,400],[10000,400,600],[40000,2200,650],[60000,3500,850],[250000,19650,925],[500000,42775,975],[1000000,91525,1075]])
   detail={method:'DC resident single zero-allowance ordinary wages',taxableAnnualWagesCents:a.toString()}
 }else if(state==='WI'){
   if(additionalAllowances)throw new Error('unsupported_wisconsin_additional_allowance')
   const married=status==='married',floor=cents(married?25727:17780),cap=cents(married?73032:73630),maximum=cents(married?9461:6702)
   const reduction=a>floor?(a-floor)*BigInt(married?20:12):0n
   const deduction=a>=cap?0n:nonnegative(maximum*100n-reduction)
   const taxable=nonnegative(a*100n-deduction-BigInt(allowances)*4000000n)
   annualDenominator=100n
   annual=apply(taxable,[[0,0,354],[12760,451.70,465],[25520,1045.04,530],[280950,14582.83,765]],annualDenominator)
   detail={method:'W-166 alternate computer method, pages 26 and 27',deduction:{numerator:deduction.toString(),denominator:'100',unit:'cents'},taxableAnnualWages:{numerator:taxable.toString(),denominator:'100',unit:'cents'},annualExemptionDollars:400}
 }else if(state==='VA'){
   const taxable=nonnegative(a-875000n-BigInt(allowances)*93000n-BigInt(additionalAllowances)*80000n)
   annual=apply(taxable,[[0,0,200],[3000,60,300],[5000,120,500],[17000,720,575]])
   detail={method:'Virginia exact withholding formula, July 2025 through 2026',standardDeductionDollars:8750,personalAndDependentAllowances:allowances,ageAndBlindnessAllowances:additionalAllowances,taxableAnnualWagesCents:taxable.toString()}
 }else if(state==='MN'){
   if(additionalAllowances)throw new Error('unsupported_minnesota_additional_allowance')
   const taxable=nonnegative(a-BigInt(allowances)*530000n)
   const rows:readonly Row[]=status==='married'?[[0,0,0],[14700,0,535],[63400,2605.45,680],[208180,12450.49,785],[352630,23789.82,985]]:[[0,0,0],[4700,0,535],[38010,1782.09,680],[114130,6958.25,785],[207850,14315.27,985]]
   annual=apply(taxable,rows);detail={method:'2026 computer formula, page 34',taxableAnnualWagesCents:taxable.toString(),annualAllowanceDollars:5300}
 }else if(state==='ND'){
   if(allowances||additionalAllowances||election.additionalCents)throw new Error('north_dakota_modern_certificate_only')
   const rows:readonly Row[]=status==='married'?[[0,0,0],[57500,0,195],[168525,2164.99,250]]:status==='head_household'?[[0,0,0],[78475,0,195],[289675,4118.40,250]]:[[0,0,0],[57625,0,195],[258450,3916.09,250]]
   annual=apply(a,rows);detail={method:'2026 modern certificate annual worksheet, page 45',taxableAnnualWagesCents:a.toString()}
 }else if(state==='MO'){
   if(allowances||additionalAllowances)throw new Error('missouri_has_no_withholding_allowances')
   const standard=status==='married'?32200:status==='head_household'?24150:16100
   const taxable=nonnegative(a-cents(standard))
   const rows:readonly Row[]=[[0,0,0],[1348,0,200],[2696,27,250],[4044,61,300],[5392,101,350],[6740,148,400],[8088,202,450],[9436,263,470]]
   annual=apply(taxable,rows);rounding='dollar';detail={method:'2026 annual percentage method with published whole-dollar lower-bracket amounts',standardDeductionDollars:standard,taxableAnnualWagesCents:taxable.toString()}
 }else{
   // DN01's printed deduction constants are already rounded per pay period.
   // Restrict this increment to zero exemptions until all three tables and the
   // first-time dependent and adopted-child elections are mapped together.
   if(allowances||additionalAllowances)throw new Error('indiana_nonzero_exemptions_not_mapped')
   annual=a*295n;detail={rateBasisPoints:295,exemptions:0,countyTax:'separate unmapped obligation'}
 }
 const ordinary=rounding==='dollar'?100*roundRatio(annual,BigInt(periods)*1000000n*annualDenominator):roundRatio(annual,BigInt(periods)*10000n*annualDenominator)
 return {withholdingCents:ordinary+election.additionalCents,calculation:{...detail,brackets:trace,filingStatus:status,allowances,additionalAllowances,additionalCents:election.additionalCents,periodsPerYear:periods,rounding}}
}
