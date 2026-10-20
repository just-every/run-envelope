// 02 Payday week: Kim's four businesses on four schedules, Mon Oct 26 to Fri Oct 30, as five day cards on a forest
// rail. Each event leads with its business chip (or "All 4"); red only on the two exceptions.
import { section, head, chip, all4, done, keep, dot, type Business } from './parts'

const event = (lead: string, body: string, tone = '') => `<li class="ev${tone ? ` ev--${tone}` : ''}">${lead}<p>${body}</p></li>`
const day = (name: string, events: string, extra = '') => `<li class="day${extra}"><h3>${keep(name)}</h3><ul class="day-events">${events}</ul></li>`
const legend = (business: Business, schedule: string) => `<li>${chip(business)}<span>${schedule}</span></li>`

export function weekSection() {
 const days = day('Mon Oct 26',
  event(all4, done(`Q3 Form 941${dot}IRS accepted 11:02 am`))
  + event(chip('rosa'), done(`Toast hours and tips in${dot}run prepared`))
  + event(chip('northpaw'), keep(`Ana Flores${dot}TIN mismatch${dot}payment blocked`), 'bad'))
  + day('Tue Oct 27',
   event(chip('northpaw'), done(`Ana’s W-9 corrected${dot}TIN matched 9:31 am`))
   + event(chip('brightside'), done('Dr. Lena Brooks approved 10:05 am'))
   + event(chip('northpaw'), done('Nadia Okafor approved 2:30 pm')))
  + day('Wed Oct 28',
   event(chip('kessler'), `<span class="bad">${keep(`timesheets imported twice${dot}stopped 7:04 am`)}</span><span class="ev-then" aria-hidden="true">↓</span>${done('Walt Kessler approved 9:30 am')}`)
   + event(chip('rosa'), done('Rosa Medina approved 3:40 pm'))
   + event(all4, done(`5:00 pm cutoff${dot}4 of 4 runs funded`)))
  + day('Thu Oct 29',
   event(chip('brightside'), done(`Mia Torres’s new bank held${dot}confirmed 10:21 am`))
   + event(all4, done('Federal, Ohio, Columbus and Colorado deposits scheduled')))
  + day('Fri Oct 30',
   `<li class="ev ev--payday"><p class="payday">${done(`58 people paid${dot}$126,773.80 net pay landed`)}</p></li>`
   + `<li class="ev"><p>${done(`Every deposit accepted${dot}4 journals posted${dot}QuickBooks Online × 2, Xero × 2`)}</p></li>`, ' day--payday')
 return section('week-title', 'aqua',
  `<div class="center">${head('week-title', 'Payday week · High Street, Columbus · Mon Oct 26 – Fri Oct 30, ET', 'Kim runs four payrolls.', '58 people paid on time.',
   'Kim Sorensen keeps the books for four High Street businesses on four pay schedules. Each owner approved their own run.')}</div>`
  + `<ul class="legend" aria-label="Pay schedules">${legend('kessler', 'weekly')}${legend('rosa', 'biweekly')}${legend('brightside', 'semimonthly')}${legend('northpaw', 'monthly')}</ul>`
  + `<ol class="days">${days}</ol>`, 'week')
}
