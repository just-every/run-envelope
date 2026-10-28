import {roundRatio,validCents} from '../industry/federal-withholding'
export const arkansasSource='https://www.dfa.arkansas.gov/wp-content/uploads/Withholding-Tax-Formula.pdf'
export function arkansasWithholding(wages:number,periods:number,election:Record<string,unknown>){
 if(Object.keys(election).length!==2||!validCents(election.allowances)||!validCents(election.additionalCents))throw new Error('arkansas_ar4ec_required')
 const annual=BigInt(wages)*BigInt(periods),net=annual>247000n?annual-247000n:0n
 // The current instructions use 100,001, but their worked example says
 // 97,701. Hold the disputed interval rather than choose a rounding edition.
 if(net>=9770100n&&net<10000100n)return {withholdingCents:null,reason:'Arkansas Step 2 and the worked example give different upper limits for the midrange method. This interval remains held pending authoritative clarification.'}
 const taxable=net<10000100n?(net/10000n)*10000n+5000n:net
 let rate=0n,adjustment=0n
 if(taxable>=560000n&&taxable<1120000n){rate=200n;adjustment=11198n}
 else if(taxable>=1120000n&&taxable<1600000n){rate=300n;adjustment=22397n}
 else if(taxable>=1600000n&&taxable<2640000n){rate=340n;adjustment=28797n}
 else if(taxable>=2640000n&&taxable<=9470000n){rate=370n;adjustment=36716n}
 else if(taxable>9470000n&&taxable<=9760000n){rate=370n;const band=(taxable-9470000n-1n)/10000n;adjustment=36990n-band*1000n}
 else if(taxable>9760000n){rate=370n;adjustment=7990n}
 const raw=taxable*rate-adjustment*10000n
 const annualGrossDollars=roundRatio(raw>0n?raw:0n,1000000n)
 const afterCredits=Math.max(0,annualGrossDollars*100-election.allowances*2900)
 return {withholdingCents:roundRatio(BigInt(afterCredits),BigInt(periods))+election.additionalCents,reason:'2026 AR4EC computer formula outside the disputed midrange interval; other programs remain unmapped.',calculation:{method:'2026 formula method steps 1 through 6',annualSalaryCents:annual.toString(),standardDeductionCents:247000,netTaxableAnnualWagesCents:net.toString(),midrangeOrExactTaxableCents:taxable.toString(),rateBasisPoints:Number(rate),annualBracketAdjustmentCents:adjustment.toString(),roundedAnnualGrossTaxCents:annualGrossDollars*100,annualPersonalCreditsCents:election.allowances*2900,additionalCents:election.additionalCents,rounding:'Midrange where unambiguous; annual gross tax to nearest whole dollar before personal credits, final period to cents'}}
}
