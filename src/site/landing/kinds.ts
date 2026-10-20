// 03 Gross to net: six kinds of pay across the four businesses, one card each with its calculation, its green result
// and the grey rule chip that names the rule behind it.
import { section, head, chip, done, keep, tail, dot, type Business } from './parts'

// The person's name, then their role: on its own line in the six-across row, after a dot when the cards stack.
const pay = (business: Business, kind: string, name: string, role: string, lines: string[], result: string, rule: string) => `<li class="kind">`
 + `<div class="kind-card"><p class="kind-top">${chip(business)}<span class="kind-name">${kind}</span></p><h3>${name}<span class="role"><span class="role-dot">${dot}</span>${tail(role)}</span></h3>`
 + `<p class="kind-calc">${lines.map(line => `<span>${keep(line)}</span>`).join('')}</p><p class="kind-result">${result}</p></div>`
 + `<p class="kind-rule">${rule}</p></li>`

export function kindsSection() {
 const cards = pay('rosa', 'Tipped', 'Jade Park', 'server', ['week of Oct 18', '30 h × $5.50 + $142.00 tips = $307.00'], `→ ${done('topped up $23.00 to $330.00')}`, 'Ohio $11.00 minimum, $5.50 tipped')
  + pay('kessler', 'Overtime', 'Dev Patel', 'plumber', ['Oct 19–25', '40 h × $32.00 + 6 h × $48.00'], done('= $1,568.00'), 'FLSA overtime, 1.5× over 40 h')
  + pay('brightside', 'Salary', 'Mia Torres', 'dental hygienist', [`Oct 16–31${dot}$3,400.00`, '401(k) 6% $204.00'], done('Sat Oct 31 payday moved to Fri'), 'Saturday payday → Friday')
  + pay('northpaw', 'Two states', 'Sam Rivera', 'designer', [`October${dot}$7,500.00`, '= Ohio $2,386.36'], done('+ Colorado $5,113.64'), '7 of 22 workdays in Columbus')
  + pay('northpaw', 'Contractor', 'Ana Flores', 'sign painter', ['3 storefront signs × $800.00'], `${done('= $2,400.00')}<span class="kind-form">1099-NEC</span>`, done('IRS TIN match'))
  + pay('rosa', 'Garnished', 'Marcus Hill', 'line cook', ['child support $262.00', '+ creditor $150.00 = $412.00'], `${done('limit $415.00')}${dot}remitted`, 'support first, 25% of disposable pay')
 return section('kinds-title', 'white',
  head('kinds-title', 'Gross to net · 4 businesses · Fri Oct 30', 'Six kinds of pay.', 'Each line shows its rule.',
   'Tips, overtime, a salary, a move between states, a contractor and two court orders, each worked out line by line.')
  + `<ul class="kinds">${cards}</ul>`
  + `<p class="foot-pill">${keep(`Fri Oct 30${dot}6 kinds of pay${dot}4 runs${dot}58 people${dot}every stub line linked to its rule and rate`)}</p>`, 'kinds-band')
}
