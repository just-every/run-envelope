// 06 Reconciled: Dev Patel's stub at the centre, tied by dotted connectors to Kessler Plumbing's run, the bank debit,
// the tax deposits, Guideline and the QuickBooks Online journal; a strip of the other three runs closes it.
import { section, head, chip, done, keep, tail, dot, type Business } from './parts'

const line = (label: string, amount: string) => `<tr><th scope="row">${label}</th><td>${amount}</td></tr>`
const spoke = (side: 'l' | 'r', title: string, body: string, extra = '') => `<article class="spoke spoke--${side}${extra}"><h3>${tail(keep(title))}</h3>${body}</article>`
const run = (business: Business, amount: string, books: string) => `<li>${chip(business)}<p>${done(`${amount}${dot}${books}`)}</p></li>`
const pointer = '<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1 1v12.5l3.4-3.2 2.4 5 2-1-2.3-4.8H11z" fill="currentColor"/></svg>'

export function reconciledSection() {
 const stub = `<article class="stub" aria-label="Dev Patel’s pay stub">${chip('kessler')}<p class="stub-who">${keep(`Dev Patel${dot}plumber${dot}Oct 19–25`)}</p>`
  + `<table><tbody>${line('Gross', '$1,568.00')}${line('401(k) 3%', '$47.04')}${line('Social Security', '$97.22')}${line('Medicare', '$22.74')}${line('Federal', '$121.30')}${line('Ohio', '$28.45')}${line('Columbus 2.5%', '$39.20')}</tbody>`
  + `<tfoot>${line('Net', '$1,212.05')}</tfoot></table><p class="ok stub-paid">${done('paid Fri Oct 30')}</p></article>`
 const left = spoke('l', `Run${dot}Kessler Plumbing${dot}Oct 19–25${dot}14 people`, `<p>${keep('gross $22,680.00 − taxes $4,762.80 − 401(k) $680.40 = net $17,236.80')}</p>`)
  + spoke('l', `Bank${dot}funded Wed Oct 28`, `<p>${done('$24,444.06 = net $17,236.80 + taxes $6,526.86 + 401(k) $680.40')}</p>`
   + `<p class="cursors"><span class="cursor cursor--kim">Kim${dot}bookkeeper${pointer}</span><span class="cursor cursor--walt">Walt${dot}owner${pointer}</span></p>`
   + `<p class="hand">to the cent <svg class="ck" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 8.7l3.4 3.3 7-7.6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg></p>`, ' spoke--bank')
 const right = spoke('r', 'Deposits', `<p>${keep(`EFTPS $5,430.84${dot}Ohio $499.98${dot}Columbus $567.00${dot}`)}<span class="ok">${done('accepted Fri Oct 30')}</span></p><p class="small">federal and Ohio unemployment $29.04 set aside for the quarter</p>`)
  + spoke('r', `401(k)${dot}Guideline`, `<p>${keep(`$680.40${dot}14 contributions${dot}`)}${done('accepted')}</p>`)
  + spoke('r', `Journal${dot}QuickBooks Online`, `<p>${keep('debits $24,444.06 = credits $24,444.06')}</p><p>${done('cash line = bank debit')}</p>`)
 return section('reconciled-title', 'white',
  `<div class="center">${head('reconciled-title', 'Reconciled · Kessler Plumbing and all four · Fri Oct 30, ET', 'Paid, deposited, posted.', 'Bank, books and IRS agree.',
   'The agent checks every paycheck, bank debit, tax deposit and journal line until they match.')}</div>`
  + `<div class="hub"><div class="hub-side hub-side--l">${left}</div>${stub}<div class="hub-side hub-side--r">${right}</div></div>`
  + `<ul class="runs" aria-label="All four runs">${run('rosa', '$45,208.80', 'QuickBooks Online')}${run('brightside', '$49,680.48', 'Xero')}${run('northpaw', '$58,411.40', 'Xero')}`
  + `<li class="runs-total"><p>${done(`4 runs${dot}$177,744.74${dot}0 differences`)}</p></li></ul>`, 'reconciled-band')
}
