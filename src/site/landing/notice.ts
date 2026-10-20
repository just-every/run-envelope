// 11 Notice: an IRS failure-to-deposit notice for Kessler Plumbing, set as real lines with the unpaid line ringed; the
// agent's three notes in the margin, the matched EFTPS record, and the timeline to the IRS letter. Walt signs.
import { section, head, chip, done, keep, dot } from './parts'

const note = (body: string) => `<li><p>${keep(body)}</p></li>`
const stop = (body: string) => `<li><p>${body}</p></li>`

export function noticeSection() {
 const page = '<article class="notice" aria-label="IRS notice">'
  + `<p>${keep('Notice dated Mon Oct 5')}</p><p>${keep(`Kessler Plumbing${dot}Form 941${dot}tax period Jun 30, 2026`)}</p>`
  + '<p>We didn’t find a deposit of $5,118.62 for this period.</p><p>A 10% failure-to-deposit penalty applies.</p>'
  + `<p class="ringed"><span>${keep(`Unpaid $5,118.62${dot}failure-to-deposit penalty $511.86${dot}total $5,630.48 plus interest`)}</span></p>`
  + `<p>${keep('Pay by Mon Oct 26 to avoid more interest.')}</p></article>`
 const notes = `<div class="margin"><p class="eyebrow">${keep('Agent · 8:43 am Fri Oct 9')}</p><ul class="notes">`
  + note(`Deposit found: EFTPS Wed Jul 1${dot}$5,118.62${dot}for the Fri Jun 26 payroll`)
  + note(`Filed under Q3 2026${dot}Q3 shows the same $5,118.62 extra`)
  + note('Reply drafted: move the deposit to Q2 and remove the penalty') + '</ul></div>'
 const record = `<p class="eftps">${chip('kessler')}<span>${keep(`EFTPS${dot}Wed Jul 1${dot}$5,118.62${dot}Form 941${dot}applied to Q3 2026${dot}`)}<b class="ok">${done('matched')}</b></span></p>`
 const rail = stop(keep(`Fri Oct 9, 8:40 am${dot}scanned by Kim`)) + stop(keep(`8:43 am${dot}matched and drafted`))
  + stop(`${keep('Tue Oct 13, 10:50 am')}${dot}${done('Walt Kessler signed')}${dot}${keep('sent 11:10 am')}`)
  + `<li class="closed"><p>${done(`Mon Nov 9${dot}IRS letter: deposit moved to Q2${dot}penalty removed${dot}$0.00 owed`)}</p></li>`
 return section('notice-title', 'aqua',
  head('notice-title', 'Notice · Kessler Plumbing · Fri Oct 9 – Mon Nov 9, ET', 'An IRS notice on Friday.', 'Closed with $0.00 owed.',
   'The agent found the “missing” deposit, applied by the IRS to the wrong quarter, and drafted the reply. Walt signed it, and the IRS agreed.')
  + `<div class="notice-row"><svg class="note-links" aria-hidden="true"></svg>${page}${notes}</div><script type="module" src="/site/notice-connectors.js"></script>${record}<ol class="n-rail">${rail}</ol>`, 'notice-band')
}
