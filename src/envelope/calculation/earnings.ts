import { roundRatio, safeNumber, validCents } from '../industry/federal-withholding'
import { validDate } from '../industry/classification'

export interface WorkDay { day:string; segments:{hoursHundredths:number;rateCents:number}[] }
export interface WorkWeek {
  from:string; days:WorkDay[]; productionBonusCents:number
  premiums:{day:string;kind:'meal'|'rest';approvedBy:string;sourceId:string}[]
}
export const earningSources = [
  {id:'flsa-778-weighted-regular-rate',url:'https://www.ecfr.gov/current/title-29/section-778.115',section:'Weighted average for two or more rates'},
  {id:'flsa-778-production-bonus',url:'https://www.ecfr.gov/current/title-29/section-778.209',section:'Bonus allocated to the workweek'},
  {id:'ca-overtime-regular-rate',url:'https://www.dir.ca.gov/dlse/faq_overtime.htm',section:'Daily, weekly, seventh-day and production bonus overtime'},
  {id:'ca-meal-regular-rate',url:'https://www.dir.ca.gov/dlse/FAQ_MealPeriods.htm',section:'One hour at the regular rate for a missed meal period'},
  {id:'ca-rest-regular-rate',url:'https://www.dir.ca.gov/dlse/FAQ_RestPeriods.htm',section:'One hour at the regular rate for a missed rest period'},
]
const reject = (code:string):never => { throw new Error(code) }
const amount = (v:unknown) => {if(!validCents(v) || v>100000000) reject('invalid_earnings_amount');return v as number}
const label = (v:unknown) => typeof v==='string' && v.trim().length>0 && v.length<=160

/** Ordinary nonexempt workweeks. Production bonuses are allocated to their earned week.
 * Flat-sum bonuses, special wage orders and alternative workweeks require a separate rule.
 */
export function weeklyEarnings(weeks:WorkWeek[],state:string,from:string,through:string) {
  if(!Array.isArray(weeks) || !weeks.length || weeks.length>6) reject('actual_workweeks_required')
  let total=0n, worked=0
  const seenDays=new Set<string>(),seenSources=new Set<string>(),seenWeeks=new Set<string>()
  const results=weeks.map(week=>{
    if(!week || Object.keys(week).some(k=>!['from','days','productionBonusCents','premiums'].includes(k)) || !validDate(week.from) || seenWeeks.has(week.from)) reject('invalid_workweek')
    seenWeeks.add(week.from)
    const start=Date.parse(week.from+'T00:00:00Z'),finish=new Date(start+6*86400000).toISOString().slice(0,10)
    if(week.from<from || finish>through || !Array.isArray(week.days) || !week.days.length || week.days.length>7 || !Array.isArray(week.premiums)) reject('complete_workweek_required')
    const bonus=amount(week.productionBonusCents)
    let hours=0,straight=0n,ot=0,dt=0,nonDaily=0
    const days=[...week.days].sort((a,b)=>String(a?.day).localeCompare(String(b?.day)))
    for(const day of days){
      if(!validDate(day.day) || day.day<week.from || day.day>finish || seenDays.has(day.day) || !Array.isArray(day.segments) || !day.segments.length || day.segments.length>12) reject('invalid_workday')
      seenDays.add(day.day)
      let dayHours=0
      for(const segment of day.segments){
        const h=amount(segment.hoursHundredths),rate=amount(segment.rateCents)
        if(!h || !rate) reject('positive_work_hours_and_rate_required')
        dayHours+=h;straight+=BigInt(h)*BigInt(rate)
      }
      if(dayHours>2400) reject('workday_exceeds_24_hours')
      const seventh=state==='CA' && days.length===7 && day.day===finish
      const dailyDouble=state==='CA'?Math.max(0,dayHours-(seventh?800:1200)):0
      const dailyOver=state==='CA'?Math.min(seventh?800:400,Math.max(0,dayHours-(seventh?0:800))):0
      dt+=dailyDouble;ot+=dailyOver;nonDaily+=dayHours-dailyDouble-dailyOver;hours+=dayHours
    }
    if(!hours) reject('positive_work_hours_required')
    ot+=Math.max(0,nonDaily-4000)
    // Straight earnings retain hundredths of a cent. Add the production bonus
    // before dividing by hours; keep the rational regular rate until each line.
    const included=straight+BigInt(bonus)*100n
    const overtimeCents=roundRatio(included*BigInt(ot+2*dt),BigInt(hours)*200n)
    const straightCents=roundRatio(straight,100n)
    const premiumDays=new Set<string>()
    const premiums=week.premiums.map(p=>{
      if(state!=='CA' || !['meal','rest'].includes(p.kind) || !days.some(d=>d.day===p.day) || !label(p.approvedBy) || !label(p.sourceId) || seenSources.has(p.sourceId) || premiumDays.has(p.day+'-'+p.kind)) reject('invalid_approved_california_premium')
      premiumDays.add(p.day+'-'+p.kind);seenSources.add(p.sourceId)
      return {...p,amountCents:roundRatio(included,BigInt(hours)),hoursHundredths:0}
    })
    const grossCents=safeNumber(BigInt(straightCents)+BigInt(bonus)+BigInt(overtimeCents)+premiums.reduce((n,p)=>n+BigInt(p.amountCents),0n))
    total+=BigInt(grossCents);worked+=hours
    return {from:week.from,through:finish,workedHoursHundredths:hours,straightCents,productionBonusCents:bonus,
      regularRate:{numerator:included.toString(),denominator:String(hours),unit:'cents per hour'},
      overtimeHoursHundredths:ot,doubleTimeHoursHundredths:dt,overtimeCents,premiums,grossCents}
  })
  return {weeks:results,workedHoursHundredths:worked,grossCents:safeNumber(total),sources:earningSources,
    rounding:'Half up to cents on straight pay, the weekly overtime line and each approved premium. Bonuses do not create hours.'}
}
