import {roundRatio,validCents} from '../industry/federal-withholding'
export const montanaSource='https://revenuefiles.mt.gov/files/Forms/Montana_Employer_and_Information_Agent_Guide_with_Tax_Tables.pdf'
export function montanaWithholding(wages:number,frequency:'weekly'|'biweekly'|'semimonthly'|'monthly',election:Record<string,unknown>){
 if(Object.keys(election).length!==3||election.certificate!=='MW-4-2026'||!['single','married_joint','head_household','married_both_working'].includes(String(election.filingStatus))||!validCents(election.additionalCents))throw new Error('montana_current_mw4_required')
 const group=election.filingStatus==='married_joint'?1:election.filingStatus==='head_household'?2:0
 // Published period values include independently rounded bracket bases.
 const tables={weekly:[[310,1223,43],[619,2446,86],[464,1835,65]],biweekly:[[619,2446,86],[1238,4892,172],[929,3669,129]],semimonthly:[[671,2650,94],[1342,5300,187],[1006,3975,140]],monthly:[[1342,5300,187],[2683,10600,372],[2013,7950,280]]}
 const [low,high,base]=tables[frequency][group],floor=wages>=high*100?high:low,rate=wages>=high*100?565:470
 const raw=wages<=low*100?0n:BigInt(wages>=high*100?base:0)*1000000n+BigInt(wages-floor*100)*BigInt(rate)
 const ceil=(raw+999999n)/1000000n,nearest=BigInt(roundRatio(raw,1000000n))
 // Page 16 mandates rounding up, while some examples round to nearest.
 // Only return a component where those two readings agree.
 if(ceil!==nearest)return {withholdingCents:null,reason:'Montana page 16 requires rounding up while examples use nearest-dollar rounding. These readings differ for this amount; obtain authoritative clarification before using it.'}
 const amount=Number(ceil)*100+election.additionalCents
 return {withholdingCents:amount,reason:'The retained period formula and both printed rounding readings agree; other state programs remain unmapped.',calculation:{method:'2026 MW-4 period formula, pages 16 through 19',floorDollars:floor,baseDollars:wages>=high*100?base:0,rateBasisPoints:wages<=low*100?0:rate,rounding:'Whole dollar; upward and nearest readings agree for this amount',additionalCents:election.additionalCents}}
}
