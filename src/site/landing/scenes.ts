// 09 Interlude and 13 Closing: the two clay scenes after the hero. The plates carry no text beyond the shop signs and
// Northpaw's window lettering; the tag, the closing cards, heading and actions are HTML.
import { runButton, type SiteLinks } from '../shell/frame'
import { plate, chip, done, keep, tail, dot } from './parts'

export function interlude() {
 const art = plate('interlude', [768, 1152, 1536, 2304, 3072], [1536, 1024], '100vw',
  'Dev Patel, the plumber in a green cap and overalls, kneels at a customer’s water heater in a clay basement corner with a red pipe wrench; an open red toolbox and a coil of copper pipe sit beside him while the homeowner watches, holding a mug.',
  { widths: [390, 780, 1170], size: [1000, 830] })
 return `<section class="scene scene--interlude" aria-label="Fri Oct 30 at a Kessler Plumbing job"><div class="scene-art">${art}</div>`
  + `<p class="scene-tag">${done(`Fri Oct 30${dot}Kessler Plumbing${dot}14 paid${dot}Dev’s 6 overtime hours at $48.00`)}</p></section>`
}

const card = (lead: string, one: string, two: string) => `<li class="close-card"><p class="close-chips">${lead}</p><p class="close-one">${one}</p><p class="close-two">${two}</p></li>`

export function closing(links: SiteLinks) {
 const art = plate('closing', [768, 1152, 1536, 2304, 3072], [1536, 730], '100vw',
  'High Street at 8:00 am on a Friday, in clay: staff carry crates into Rosa’s Taquería, a plumber loads a red toolbox into Kessler Plumbing’s green van, Brightside Dental’s door stands open, Northpaw Studio’s window is hand-lettered, Arch City Hardware’s shutter goes up, and a bookkeeper walks past with a coffee.',
  { widths: [390, 780, 1170], size: [940, 650] })
 const cards = card(`${chip('rosa', 'Rosa’s')}${chip('kessler', 'Kessler')}${chip('brightside', 'Brightside')}${chip('arch', 'Arch City')}`, done(`Fri Nov 13${dot}4 runs${dot}60 people paid`), keep('Northpaw next on Mon Nov 30'))
  + card(chip('arch'), `<span class="ok">${done('first Envelope run')}</span>`, done('11 people paid'))
  + card(chip('brightside'), `<span class="ok">${done('first pay to ••7731')}</span>`, keep(`Mia Torres${dot}new bank`))
  + card(chip('kessler'), `<span class="ok">${done('IRS notice closed')}</span>`, `<span class="ok">${done('$0.00 owed')}</span>`)
 return `<section class="scene scene--closing" aria-labelledby="closing-title"><div class="scene-art">${art}</div>`
  + `<div class="wrap"><ul class="close-cards" aria-label="Fri Nov 13 on High Street">${cards}</ul>`
  + `<h2 class="display" id="closing-title"><span class="l1">${tail('Two Fridays later,')}</span> <span class="l2">${tail('everyone paid again.')}</span></h2>`
  + `<p class="close-free">100% free and open source.</p><div class="close-actions">${runButton}<a class="text-link" href="${links.docs}">Read the docs</a></div></div></section>`
}
