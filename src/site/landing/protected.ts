// 07 Pay protected: Mia's new bank account held until her own phone confirmed it, and Ana's W-9 blocked until her TIN
// matched; each card is a timeline from a red start to a green end, and a person approves each change.
import { section, head, chip, done, keep, nw, dot } from './parts'

const at = (body: string, tone: 'past' | 'bad' | 'good' = 'past', extra = '') => `<li class="tl tl--${tone}">${extra || `<p>${body}</p>`}</li>`

export function protectedSection() {
 const mia = `<article class="guard" aria-labelledby="guard-mia"><p class="guard-head" id="guard-mia">${chip('brightside')}<b>${keep(`Mia Torres${dot}dental hygienist`)}</b></p><ol class="timeline">`
  + at(keep(`Thu Oct 29, 10:14 am${dot}new account ••7731 added in the portal${dot}new device`), 'bad')
  + at(keep(`held${dot}payday is tomorrow${dot}Friday’s pay stays with verified ••2208`))
  + at('', 'past', `<p>${keep(`10:15 am${dot}text to her number on file, ending 4418`)}</p><div class="sms"><p class="sms-in"><span>Envelope</span>New account ••7731 for your pay. ${nw('Was this you?')}</p><p class="sms-out"><span class="sms-bubble">Yes, that was me.</span><time>${keep('10:21 am')}</time></p></div>`)
  + at(done(`10:40 am${dot}Dr. Lena Brooks approved the new account`))
  + at(`${done(`Fri Oct 30${dot}$2,455.20 paid to ••2208`)}${dot}${keep('••7731 from Fri Nov 13')}`, 'good')
  + '</ol></article>'
 const ana = `<article class="guard" aria-labelledby="guard-ana"><p class="guard-head" id="guard-ana">${chip('northpaw')}<b>${keep(`Ana Flores${dot}sign painter, contractor`)}</b></p><ol class="timeline">`
  + at(keep(`Mon Oct 26, 2:10 pm${dot}W-9${dot}Flores Sign Co.${dot}SSN`))
  + at(keep(`2:12 pm${dot}IRS TIN match: name and number don’t match${dot}payment blocked`), 'bad')
  + at(keep(`Tue Oct 27, 9:30 am${dot}Ana corrected it${dot}name Ana Flores, business Flores Sign Co.`))
  + at(done(`9:31 am${dot}TIN matched`), 'good')
  + at(done(`Tue 2:30 pm${dot}Nadia Okafor approved $2,400.00`))
  + at(`${done(`Fri Oct 30${dot}paid by ACH`)}${dot}on her 1099-NEC in January`, 'good')
  + '</ol></article>'
 return section('protected-title', 'aqua',
  `<div class="center">${head('protected-title', 'Pay protected · Brightside Dental and Northpaw Studio · Mon Oct 26 – Fri Oct 30, ET', 'Mia’s new bank, confirmed.', 'Ana’s W-9, fixed and paid.',
   'A bank change the day before payday waited for Mia’s own phone. A W-9 that didn’t match IRS records waited for Ana’s fix.')}</div>`
  + `<div class="guards">${mia}${ana}</div><p class="foot-pill foot-pill--ok">${done(`Nobody unpaid${dot}nothing paid to the wrong place`)}</p>`, 'protected-band')
}
