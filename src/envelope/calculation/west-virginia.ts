import {roundRatio,validCents} from '../industry/federal-withholding'
export const westVirginiaSource='https://tax.wv.gov/Documents/Withholding/it100.2a.pdf'
type Row=readonly [floor:number,baseCents:number,rateBasisPoints:number]
const one:Record<string,readonly Row[]>={
 weekly:[[0,0,211],[192,405,281],[481,1217,316],[769,2127,422],[1154,3752,458]],
 biweekly:[[0,0,211],[385,812,281],[962,2434,316],[1538,4254,422],[2308,7503,458]],
 semimonthly:[[0,0,211],[417,880,281],[1042,2636,316],[1667,4611,422],[2500,8126,458]],
 monthly:[[0,0,211],[833,1758,281],[2083,5270,316],[3333,9220,422],[5000,16255,458]],
}
const two:Record<string,readonly Row[]>={
 weekly:[[0,0,211],[144,304,281],[361,913,316],[577,1595,422],[866,2814,458]],
 biweekly:[[0,0,211],[289,609,281],[722,1825,316],[1154,3190,422],[1731,5627,458]],
 semimonthly:[[0,0,211],[313,660,281],[782,1977,316],[1250,3458,422],[1875,6095,458]],
 monthly:[[0,0,211],[625,1318,281],[1562,3953,316],[2500,6915,422],[3750,12191,458]],
}
export function westVirginiaWithholding(wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',election:Record<string,unknown>){
 if(Object.keys(election).length!==3||!['one-earner-one-job','two-earner-or-multiple-jobs'].includes(String(election.table))||!validCents(election.allowances)||!validCents(election.additionalCents))throw new Error('west_virginia_it104_table_election_required')
 const allowance={weekly:3846,biweekly:7692,semimonthly:8333,monthly:16667}[frequency]
 const taxable=BigInt(Math.max(0,wages-allowance*election.allowances))
 const rows=(election.table==='one-earner-one-job'?one:two)[frequency]
 const row=[...rows].reverse().find(r=>taxable>=BigInt(r[0])*100n)??rows[0]
 const raw=BigInt(row[1])*10000n+(taxable-BigInt(row[0])*100n)*BigInt(row[2])
 return {withholdingCents:100*roundRatio(raw,1000000n)+election.additionalCents,reason:'2026 published percentage method; state programs remain separately unmapped.',calculation:{method:'IT-100.2A March 2026 period table',table:election.table,taxablePeriodWagesCents:taxable.toString(),exemptionPerPeriodCents:allowance,floorDollars:row[0],baseTaxCents:row[1],rateBasisPoints:row[2],rounding:'Nearest whole dollar, as the official Method II instructions require',roundingSource:'https://tax.wv.gov/business/withholding/helpandgeneralinformation/Pages/WithholdingHelpAndGeneralInformation.aspx',additionalCents:election.additionalCents}}
}
