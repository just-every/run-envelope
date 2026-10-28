import {roundRatio,validCents} from '../industry/federal-withholding'
export const printedSources:Record<string,string>={
 RI:'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-12/2026%20Withholding%20Tax%20Booklet.pdf',
 OK:'https://www.oklahoma.gov/content/dam/ok/en/tax/documents/resources/publications/businesses/withholding-tables/WHTables-2026.pdf',
 NM:'https://realfile.tax.newmexico.gov/FYI-104.pdf',
}
type Row=readonly [floorDollars:number,baseCents:number,rateBasisPoints:number]
const ok:Record<string,readonly (readonly Row[])[]>={
 weekly:[[[0,0,0],[194,0,250],[216,55,350],[261,210,450]],[[0,0,0],[388,0,250],[433,111,350],[521,420,450]]],
 biweekly:[[[0,0,0],[388,0,250],[433,111,350],[521,420,450]],[[0,0,0],[777,0,250],[865,221,350],[1042,840,450]]],
 semimonthly:[[[0,0,0],[421,0,250],[469,120,350],[565,455,450]],[[0,0,0],[842,0,250],[938,240,350],[1129,910,450]]],
 monthly:[[[0,0,0],[842,0,250],[938,240,350],[1129,910,450]],[[0,0,0],[1683,0,250],[1875,479,350],[2258,1821,450]]],
}
const nm:Record<string,readonly Row[]>={
 single:[[0,0,0],[155,0,150],[261,159,320],[395,589,320],[472,836,430],[645,1580,430],[799,2241,470],[1126,3778,470],[1434,5224,490],[4193,18746,590]],
 married:[[0,0,0],[310,0,150],[463,231,320],[617,723,320],[790,1277,430],[1098,2600,430],[1271,3344,470],[1963,6598,470],[2233,7863,490],[6367,28123,590]],
 head_household:[[0,0,0],[232,0,150],[386,231,320],[540,723,320],[713,1277,430],[1021,2600,430],[1194,3344,470],[1886,6598,470],[2155,7863,490],[6290,28123,590]],
}
export function printedWithholding(state:string,wages:number,frequency:string,election:Record<string,unknown>){
 if(Object.keys(election).some(k=>!['filingStatus','allowances','additionalCents'].includes(k))||!['single','married','head_household'].includes(String(election.filingStatus))||!validCents(election.allowances)||!validCents(election.additionalCents))throw new Error('explicit_state_certificate_required')
 if(state==='RI'&&(frequency!=='weekly'||election.allowances!==0))return {withholdingCents:null,reason:'Rhode Island retained component maps the published weekly percentage table with zero RI-W4 allowances. Other periods and nonzero certificate allowances remain unmapped.'}
 if(state==='NM' && (frequency!=='weekly'||election.allowances!==0))return {withholdingCents:null,reason:'New Mexico retained component maps the published weekly table without inferred allowances; other periods and certificate adjustments remain unmapped.'}
 if(state==='OK' && election.filingStatus==='head_household')throw new Error('oklahoma_single_or_married_certificate_required')
 const allowance=state==='OK'?{weekly:1923,biweekly:3846,semimonthly:4167,monthly:8333}[frequency as 'weekly']:0
 const taxable=BigInt(Math.max(0,wages-Number(election.allowances)*allowance))
 const rows:readonly Row[]=state==='RI'?[[0,0,375],[1578,5918,475],[3586,15456,599]]:state==='OK'?ok[frequency][election.filingStatus==='married'?1:0]:nm[String(election.filingStatus)]
 const row=[...rows].reverse().find(r=>taxable>=BigInt(r[0])*100n)??rows[0]
 const amount=roundRatio(BigInt(row[1])*10000n+(taxable-BigInt(row[0])*100n)*BigInt(row[2]),10000n)
 return {withholdingCents:amount+Number(election.additionalCents),reason:'Published ordinary period table only; other state programs remain unmapped.',calculation:{method:state==='RI'?'2026 RI-W4 zero-allowance weekly percentage method, page 9':state==='OK'?'2026 Oklahoma percentage tables, page 8':'2026 FYI-104 weekly percentage table, page 5',taxablePeriodWagesCents:taxable.toString(),floorDollars:row[0],baseTaxCents:row[1],rateBasisPoints:row[2],allowancePerPeriodCents:allowance,additionalCents:election.additionalCents,rounding:'Nearest cent, half up'}}
}
