// 04 Run prepared: Rosa's Taquería's biweekly run, pulled from Toast overnight and prepared by the agent with one plain
// note per change, each note in its own row behind a dotted leader; Rosa approves it herself.
import { section, head, chip, done, keep, dot } from './parts'

const row = (label: string, note: string) => `<tr><th scope="row"><span class="row-l"><span>${keep(label)}</span><span class="leader" aria-hidden="true"></span></span></th><td>${note}</td></tr>`

export function preparedSection() {
 const source = `<aside class="toast" aria-label="Toast import"><p class="toast-name">Toast</p><p>${keep('Oct 11–24')}</p><p>22 timesheets</p><p>${keep('1,486.5 h')}</p><p>charged tips $6,214.00</p>`
  + `<p class="ok">${done('imported Sun Oct 25, 6:00 am')}</p></aside><span class="feed" aria-hidden="true"></span>`
 const rows = row(`Tip top-ups${dot}3 servers`, keep(`Jade Park $23.00, Carmen Díaz $14.50, Owen Grady $8.25${dot}$45.75`))
  + row(`Luis Romero${dot}new hire`, done(`new prep cook from Mon Oct 12${dot}Ohio new-hire report Tue Oct 13`))
  + row(`Elena Cruz${dot}rate`, keep(`$16.00 → $17.50 an hour from Sun Oct 11${dot}set by Rosa Fri Oct 9`))
  + row(`Marcus Hill${dot}garnishment`, keep(`creditor order from Mon Oct 19${dot}$150.00 after child support${dot}within limits`))
  + row(`Overtime${dot}4 cooks`, keep('31.5 h at 1.5×'))
 const run = '<article class="run-card" aria-label="Rosa’s Taquería run preview">'
  + `<p class="run-head">${chip('rosa')}<span>${keep(`biweekly${dot}Oct 11–24${dot}payday Fri Oct 30`)}</span></p>`
  + `<p class="run-sum"><span>${keep(`22 people${dot}gross <b>$41,860.00</b>${dot}net <b>$34,499.00</b>`)}</span><span class="ok">${keep('+$1,212.40 vs Fri Oct 16')}</span></p>`
  + `<p class="prepared-at">${keep('Prepared Mon Oct 26, 7:00 am')}</p><table class="changes"><thead><tr><th scope="col">Change</th><th scope="col">${keep('Prepared Mon Oct 26, 7:00 am')}</th></tr></thead><tbody>${rows}</tbody></table>`
  + `<p class="run-foot"><span class="ok"><b>Rosa Medina approved</b>${dot}${done('Wed Oct 28, 3:40 pm')}</span>${dot}22 stubs${dot}9 in Spanish</p></article>`
 return section('prepared-title', 'aqua',
  `<div class="right">${head('prepared-title', 'Run prepared · Rosa’s Taquería · Sun Oct 25 – Wed Oct 28, ET', 'Every change, explained.', 'Rosa approved on Wednesday.',
   'The agent pulled Toast hours and tips overnight and wrote one line for every change since the last run.')}</div>`
  + `<div class="prepared">${source}${run}</div>`, 'prepared-band')
}
