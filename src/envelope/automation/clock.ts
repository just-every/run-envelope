// Federal Reserve offices remain open on the preceding Friday for Saturday holidays.
const eastern = new Intl.DateTimeFormat('en-US', { timeZone: ['America','New_York'].join('/'), year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23' })
function parts(at: number) { return Object.fromEntries(eastern.formatToParts(at).map(p=>[p.type,p.value])) }
function holiday(y:number,m:number,d:number) {
  const weekday = new Date(Date.UTC(y,m-1,d)).getUTCDay()
  const fixed = [[1,1],[6,19],[7,4],[11,11],[12,25]]
  if (fixed.some(([month,day])=>m===month && (d===day || (d===day+1 && weekday===1)))) return true
  return (m===1 && weekday===1 && d>=15 && d<=21) || (m===2 && weekday===1 && d>=15 && d<=21) ||
    (m===5 && weekday===1 && d>=25) || (m===9 && weekday===1 && d<=7) ||
    (m===10 && weekday===1 && d>=8 && d<=14) || (m===11 && weekday===4 && d>=22 && d<=28)
}
export function supportThreshold(deadline:number,hours:number) {
  let cursor=deadline, remaining=hours*60
  while(remaining>0) {
    const p=parts(cursor-30000)
    if(!['Sat','Sun'].includes(p.weekday) && Number(p.hour)>=8 && Number(p.hour)<20 && !holiday(Number(p.year),Number(p.month),Number(p.day))) remaining--
    cursor-=60000
  }
  return cursor
}
