// 08 Registered: Sam Rivera moves to Denver; the agent prepares Northpaw Studio's four Colorado and Denver
// registrations, Nadia signs, every account is issued before October's run, and Sam's month splits 7 to 15 workdays.
import { section, head, chip, done, keep, tail, dot } from './parts'

const stop = (when: string, body: string) => `<li><p class="when">${keep(when)}</p><p>${body}</p></li>`
const account = (name: string, state: string, issued: boolean) => `<tr><th scope="row">${name}</th><td><span class="state${issued ? ' state--ok' : ''}">${issued ? done(state) : keep(state)}</span></td></tr>`

export function registeredSection() {
 const rail = stop('Thu Oct 8, 4:30 pm', keep(`Sam’s Denver address in the portal${dot}working from Denver Mon Oct 12`))
  + stop('4:34 pm', keep(`agent: Northpaw has no Colorado accounts${dot}4 registrations prepared`))
  + stop('Fri Oct 9, 9:15 am', `${done('Nadia Okafor signed')}${dot}${keep('all 4 filed by 10:20 am')}`)
 const accounts = account('Ohio withholding', 'Sam ends Fri Oct 9', false) + account('Columbus income tax', 'Sam ends Fri Oct 9', false)
  + account('Colorado withholding', 'issued Tue Oct 13', true) + account('Colorado unemployment', 'issued Thu Oct 15', true)
  + account('Denver occupational privilege tax', 'issued Mon Oct 19', true) + account('Colorado FAMLI', 'issued Tue Oct 20', true)
 const register = `<article class="register" aria-labelledby="register-title"><h3 id="register-title">${chip('northpaw')}<span>Tax accounts</span></h3><table><tbody>${accounts}</tbody></table></article>`
 const split = `<article class="split" aria-labelledby="split-title"><h3 id="split-title">${tail(keep(`Sam Rivera${dot}designer${dot}October`))}</h3>`
  + '<p class="split-scale" aria-hidden="true"><span></span><span></span></p>'
  + `<div class="split-bar"><p class="split-oh"><span>${keep(`Oct 1–9${dot}Ohio`)}</span><b>$2,386.36</b><small>${keep('7 of 22 workdays')}</small></p>`
  + `<p class="split-co"><span>${keep(`Oct 12–31${dot}Colorado`)}</span><b>$5,113.64</b><small>${keep('15 of 22 workdays')}</small></p></div>`
  + `<div class="split-caps"><span>${keep('7 of 22 workdays')}</span><span>${keep('15 of 22 workdays')}</span></div>`
  + `<p class="split-stub">${done(`Columbus 2.5% $59.66${dot}Colorado withholding${dot}FAMLI${dot}Denver OPT $5.75${dot}$7,500.00`)}</p>`
  + `<p class="ready">${done(`Ready Tue Oct 20${dot}10 days before payday`)}</p></article>`
 return section('registered-title', 'white',
  head('registered-title', 'Registered · Northpaw Studio · Thu Oct 8 – Fri Oct 30', 'Sam moved to Denver.', 'Colorado was ready by payday.',
   'When Sam’s address changed, the agent prepared four Colorado and Denver registrations. Every account was issued before October’s run.')
  + `<ol class="dates">${rail}</ol><div class="registered">${register}${split}</div>`, 'registered-band')
}
