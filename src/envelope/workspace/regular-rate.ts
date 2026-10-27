/** Federal weekly overtime on reviewed hourly intake; all numbers are integer cents or minutes. */
export function weeklyOvertime(weeks: {start:string;minutes:number;straightMinuteCents:bigint}[], bonusCents:number) {
  const total = weeks.reduce((sum,week)=>sum+week.minutes,0)
  if (!total) return []
  const round = (n:bigint,d:bigint)=>Number((n+d/2n)/d)
  return weeks.map(week=>{
    const overtimeMinutes=Math.max(0,week.minutes-2400)
    // 29 CFR 778.109 and 778.209: spread the approved period bonus by actual
    // hours; retain rational cents until rounding each week's extra half-time.
    const regularNumerator=week.straightMinuteCents*BigInt(total)+BigInt(bonusCents)*BigInt(week.minutes)*60n
    const premiumCents=week.minutes ? round(regularNumerator*BigInt(overtimeMinutes),BigInt(total)*BigInt(week.minutes)*120n):0
    return {start:week.start,minutes:week.minutes,overtimeMinutes,premiumCents}
  })
}
