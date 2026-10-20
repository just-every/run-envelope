// 05 Pre-run check: the page's one failure and its recovery, on the one dark forest band. QuickBooks Time sent Kessler
// Plumbing's 12 timesheets twice; the run stopped before approval, Kim kept batch 1 and Walt Kessler approved.
import { section, head, chip, done, keep, nw, dot } from './parts'

const step = (time: string, body: string, tone: 'past' | 'bad' | 'good') => `<li class="rail-step rail-step--${tone}"><p><b>${keep(time)}</b>${dot}${body}</p></li>`
const batch = (title: string, extra = '', badge = '') => `<div class="batch${extra}"><p class="batch-title"><span>${title}</span>${badge}</p>`
 + `<table><tbody><tr><th scope="row">Dev Patel</th><td>${keep('46 h')}</td></tr><tr><th scope="row">Tom Reyes</th><td>${keep('40 h')}</td></tr><tr><th scope="row">Nate Grant</th><td>${keep('44 h')}</td></tr></tbody></table></div>`

export function precheckSection() {
 const rail = step('6:58 am', 'foreman re-approved the week in QuickBooks Time', 'past')
  + step('7:01 am', keep(`batch 1${dot}12 timesheets${dot}552 h`), 'past')
  + step('7:02 am', keep(`batch 2${dot}same 12 people, same days, same hours, new IDs`), 'bad')
  + step('7:04 am', keep(`run stopped: 1,104 h instead of 552${dot}gross $51,246.00 instead of $22,680.00${dot}$28,566.00 at stake${dot}${nw('12 of 14 people affected')}`), 'bad')
  + step('7:06 am', keep(`agent: batch 2 repeats batch 1 line for line${dot}keep batch 1`), 'past')
  + step('8:12 am', done('Kim Sorensen kept batch 1'), 'good')
  + step('8:13 am', `${done(`re-previewed${dot}552 h = QuickBooks Time approved hours`)}${dot}${done('gross $22,680.00')}`, 'good')
  + step('9:30 am', `${done('Walt Kessler approved')}${dot}${keep('7 h 30 min')} before the cutoff`, 'good')
 const batches = '<div class="batches" aria-label="The two imports">'
  + batch(`Batch 2${dot}${keep('7:02 am')}${dot}duplicate`, ' batch--dup')
  + batch(`Batch 1${dot}${keep('7:01 am')}`, ' batch--kept', chip('kessler'))
  + `<p class="callout"><b>${keep(`Dev Patel${dot}92 h → $3,776.00`)}</b> instead of $1,568.00</p></div>`
 return section('precheck-title', 'forest',
  head('precheck-title', 'Pre-run check · Kessler Plumbing · Wed Oct 28, ET', 'Timesheets imported twice.', 'Fixed before Walt approved.',
   'QuickBooks Time sent the same 12 timesheets twice. Envelope stopped the run before approval, with the people and the money at stake.')
  + `<div class="precheck"><ol class="rail">${rail}</ol>${batches}</div>`, 'precheck-band')
}
