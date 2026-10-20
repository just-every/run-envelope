// 10 Quarterly: Q3 filed a week early. Four real Form 941 pages dealt across the width, each with the Ohio
// unemployment wage report behind it, and the foot rail from Kim's approval to the Mon Nov 2 deadline.
import { section, head, chip, done, keep, dot, businessName, type Business } from './parts'

const form = (business: Business, wages: string, taxes: string) => `<li class="f941 f941--${business}"><p class="ohio">${keep('Ohio unemployment wage report · Q3 2026')} <span class="pill-ok">${done('accepted')}</span></p>`
 + `<article class="f941-page" aria-label="${businessName[business]} Form 941"><p class="f941-q">${keep('Q3 2026')}</p><h3>Form 941</h3><p class="f941-sub">Employer’s QUARTERLY Federal Tax Return</p>${chip(business)}`
 + `<table><tbody><tr><th scope="row">2</th><td>Wages, tips and other compensation</td><td>${wages}</td></tr><tr><th scope="row">12</th><td>Total taxes</td><td>${taxes}</td></tr>`
 + `<tr><th scope="row">13</th><td>Total deposits</td><td>${taxes}</td></tr><tr><th scope="row">14</th><td>Balance due</td><td>$0.00</td></tr></tbody></table>`
 + `<p class="pill-ok pill-ok--big">${done('IRS accepted')}</p></article></li>`
const stop = (body: string, tone = '') => `<li${tone ? ` class="${tone}"` : ''}><p>${body}</p></li>`

export function quarterlySection() {
 const forms = form('rosa', '$248,316.00', '$50,408.15') + form('kessler', '$293,412.50', '$70,272.29') + form('brightside', '$276,900.00', '$64,241.88') + form('northpaw', '$147,000.00', '$35,140.50')
 const rail = stop(keep(`Mon Oct 26, 8:30 am${dot}Kim Sorensen approved 8 returns`))
  + stop(done(`11:02 am${dot}IRS accepted 4 of 4`), 'ok')
  + stop(done(`Tue Oct 27${dot}Ohio unemployment accepted 4 of 4`), 'ok')
  + stop(`${keep('due Mon Nov 2')} <span class="muted">${keep('(Oct 31 is a Saturday)')}</span>`, 'due')
 return section('quarterly-title', 'white',
  head('quarterly-title', 'Quarterly · 4 businesses · Mon Oct 26 – Tue Oct 27, ET', 'Q3 filed a week early.', 'Eight returns, all accepted.',
   'Form 941 and the Ohio unemployment wage report for all four businesses, filed a week before the Mon Nov 2 deadline.')
  + `<ul class="forms">${forms}</ul><ol class="q-rail">${rail}</ol>`, 'quarterly-band')
}
