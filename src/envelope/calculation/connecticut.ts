import {roundRatio,validCents} from '../industry/federal-withholding'
export const connecticutSource='https://portal.ct.gov/-/media/drs/forms/2025/wth/tpg-211_1225.pdf'
const creditUpper:Record<string,number[]>={
 A:[15000,15500,16000,16500,17000,17500,18000,18500,20000,20500,21000,21500,25000,25500,26000,26500,27000,48000,48500,49000,49500,50000,50500,51000,51500,52000,52500],
 B:[24000,24500,25000,25500,26000,26500,27000,27500,34000,34500,35000,35500,44000,44500,45000,45500,46000,74000,74500,75000,75500,76000,76500,77000,77500,78000,78500],
 C:[30000,30500,31000,31500,32000,32500,33000,33500,40000,40500,41000,41500,50000,50500,51000,51500,52000,96000,96500,97000,97500,98000,98500,99000,99500,100000,100500],
 F:[18800,19300,19800,20300,20800,21300,21800,22300,25000,25500,26000,26500,31300,31800,32300,32800,33300,60000,60500,61000,61500,62000,62500,63000,63500,64000,64500],
}
const creditPercent=[75,70,65,60,55,50,45,40,35,30,25,20,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]
const cents=(v:number)=>BigInt(Math.round(v*100))
const positive=(v:bigint)=>v>0n?v:0n
const steps=(salary:bigint,threshold:number,width:number)=>salary<=cents(threshold)?0n:(salary-cents(threshold)+cents(width)-1n)/cents(width)
const capped=(v:bigint,cap:number)=>v>BigInt(cap)?BigInt(cap):v
export function connecticutWithholding(wages:number,periods:number,election:Record<string,unknown>){
 if(Object.keys(election).length!==3||!['A','B','C','D','F'].includes(String(election.code))||!validCents(election.additionalCents)||!validCents(election.reductionCents)||(election.additionalCents&&election.reductionCents))throw new Error('complete_connecticut_ctw4_required')
 const code=String(election.code),salary=BigInt(wages)*BigInt(periods)
 const [maximum,exemptionStart]=code==='B'?[19000,38000]:code==='C'?[24000,48000]:code==='F'?[15000,30000]:code==='D'?[0,0]:[12000,24000]
 const exemption=positive(cents(maximum)-steps(salary,exemptionStart,1000)*100000n),taxable=positive(salary-exemption)
 const rows=code==='B'?[[0,0,200],[16000,320,450],[80000,3200,550],[160000,7600,600],[320000,17200,650],[400000,22400,690],[800000,50000,699]]:code==='C'?[[0,0,200],[20000,400,450],[100000,4000,550],[200000,9500,600],[400000,21500,650],[500000,28000,690],[1000000,62500,699]]:[[0,0,200],[10000,200,450],[50000,2000,550],[100000,4750,600],[200000,10750,650],[250000,14000,690],[500000,31250,699]]
 const row=[...rows].reverse().find(r=>taxable>=cents(r[0]))??rows[0]
 const initial=cents(row[1])*10000n+(taxable-cents(row[0]))*BigInt(row[2])
 const [start,width,increment,cap]=code==='B'?[78500,4000,40,400]:code==='C'?[100500,5000,50,500]:code==='F'?[56500,5000,25,250]:[50250,2500,25,250]
 const addback=capped(steps(salary,start,width)*BigInt(increment),cap)*100n
 const [rStart,rWidth,rIncrement,rCap,secondStart,secondWidth,secondIncrement,secondCap,thirdStart,thirdWidth,thirdIncrement,thirdCap]=code==='B'?[168000,8000,40,400,320000,8000,140,4600,800000,8000,80,5320]:code==='C'?[210000,10000,50,500,400000,10000,180,5900,1000000,10000,100,6800]:[105000,5000,25,250,200000,5000,90,2950,500000,5000,50,3400]
 let recapture=capped(steps(salary,rStart,rWidth)*BigInt(rIncrement),rCap)
 if(salary>cents(secondStart))recapture=capped(BigInt(rCap)+steps(salary,secondStart,secondWidth)*BigInt(secondIncrement),secondCap)
 if(salary>cents(thirdStart))recapture=capped(BigInt(secondCap)+steps(salary,thirdStart,thirdWidth)*BigInt(thirdIncrement),thirdCap)
 const index=code==='D'?-1:creditUpper[code].findIndex(upper=>salary<=cents(upper))
 const credit=index<0?0:creditPercent[index]
 const tax=taxable===0n?0n:(initial+(addback+recapture*100n)*10000n)*BigInt(100-credit)
 const ordinary=roundRatio(tax,BigInt(periods)*1000000n)
 return {withholdingCents:Math.max(0,ordinary+election.additionalCents-election.reductionCents),reason:'Ordinary periodic wages under CT-W4 calculation rules; supplemental compensation and other programs remain separate.',calculation:{method:'TPG-211 2026 steps 1 through 16',code,annualSalaryCents:salary.toString(),personalExemptionCents:exemption.toString(),taxableAnnualWagesCents:taxable.toString(),annualBracketFloorDollars:row[0],annualBracketBaseDollars:row[1],rateBasisPoints:row[2],annualPhaseoutAddbackCents:addback.toString(),annualRecaptureCents:(recapture*100n).toString(),personalTaxCreditPercent:credit,additionalCents:election.additionalCents,reductionCents:election.reductionCents,rounding:'Nearest cent, half up, after annual credit and division'}}
}
