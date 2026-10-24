// 12 Switching: Arch City Hardware moves in from Paychex Flex mid-quarter. Its last Paychex payroll is rerun line by
// line (Hannah Price's paycheck matched to the cent), and running Envelope yourself is one terminal line.
import { section, head, chip, done, keep, tail, dot, CHECK } from './parts'

const stop = (when: string, body: string) => `<li><p><b>${keep(when)}</b>${dot}${body}</p></li>`
const line = (label: string, amount: string) => `<tr><th scope="row">${label}</th><td>${amount}</td><td class="eq" aria-label="equals">=</td><td>${amount}</td></tr>`

// Words stay whole on a phone and the installer's `install.sh | sh` stays together.
const words = (line: string) => line.split(/(\S*install\.sh \| sh|\S+)/).map(part => {
 const pipe = /^(.*\/)(install\.sh \| sh)$/.exec(part)
 return pipe ? `<span class="nw">${pipe[1]}</span><wbr><span class="nw">${pipe[2]}</span>` : part.trim() ? `<span class="nw">${part}</span>` : part
}).join('')

export function switchingSection(clone: string) {
 // The one start line every Run Edit Run page shows (the installer, then rer dev); the npx line is the alternative.
 const start = `curl -fsSL https://runeditrun.com/install.sh | sh -s -- ${clone.slice('npx -y @runeditrun/rer '.length)}`
 const tiles = `<ul class="tiles" aria-label="11 of 11 paychecks matched">${Array.from({ length: 11 }, () => `<li>${CHECK}</li>`).join('')}</ul>`
 const rail = stop('Mon Nov 2', keep(`year to date Jan 1 – Oct 30 imported${dot}13 people (11 current, 2 former)${dot}$412,960.25`))
  + stop('Tue Nov 3', done('Greg Novak signed the reporting-agent authorization'))
  + stop('Wed Nov 4', done('Oct 30 rerun matched'))
  + stop('Fri Nov 13', `first Envelope run${dot}${done('approved Tue Nov 10, a day early for Veterans Day')}`)
 const check = `<article class="rerun" aria-labelledby="rerun-title">${chip('arch')}<h3 id="rerun-title">Hannah Price<span>${dot}${tail('assistant manager')}</span></h3>`
  + `<table><thead><tr><th scope="col"><span class="sr">Line</span></th><th scope="col">${keep(`Paychex Flex${dot}Fri Oct 30`)}</th><th scope="col"><span class="sr">matches</span></th><th scope="col">Envelope rerun</th></tr></thead><tbody>`
  + line('Gross', '$2,200.00') + line('401(k) 4%', '$88.00') + line('Federal', '$182.40') + line('Social Security', '$136.40') + line('Medicare', '$31.90') + line('Ohio', '$36.75') + line('Columbus', '$55.00')
  + `</tbody><tfoot><tr><th scope="row">Net</th><td>$1,669.55</td><td class="eq" aria-label="equals">=</td><td>${done('$1,669.55')}</td></tr></tfoot></table></article>`
 const side = `<div class="switch-side"><article class="carried"><h3>Carried over</h3><p>${keep(`EIN${dot}semiweekly deposits${dot}Ohio withholding${dot}Ohio unemployment 2.1%${dot}Columbus`)}</p>`
  + '<p>Q4 941 will carry both Paychex’s October and Envelope’s November–December wages</p></article>'
  + `<figure class="term" aria-label="Run Envelope yourself"><pre><code><span class="prompt">$</span> ${words(start)}\n<span class="comment"># ${words(`Already have Node 22 or later? ${clone}`)}</span></code></pre><p class="term-ok">${CHECK} Envelope is ready</p></figure></div>`
 return section('switching-title', 'white',
  `<div class="center">${head('switching-title', 'Switching · Arch City Hardware · Mon Nov 2 – Fri Nov 13, ET', 'Moved in from Paychex Flex.', 'Every paycheck matched.',
   'Kim’s fifth client brought ten months of Paychex Flex history. Envelope reran its last Paychex payroll line by line.')}</div>`
  + `${tiles}<p class="tiles-sum">${done(`<b>11 of 11</b> paychecks${dot}gross $19,846.50 = $19,846.50${dot}to the cent`)}</p>`
  + `<div class="switch"><ol class="stops">${rail}</ol>${check}${side}</div><p class="also">Also moves in from Gusto and ADP RUN.</p>`, 'switching-band')
}
