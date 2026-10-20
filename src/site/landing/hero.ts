// 01 Hero: approved hero G. The six clay figurines on the clay headline are a text-free plate (the painted header,
// cards, copy and button are redrawn as plain ground and rebuilt here as HTML at their places); the headline is the
// page's real h1, set for search and screen readers; at phone width the 390 plan's four-line plate takes over.
import { siteHeader, runButton, type SiteLinks } from '../shell/frame'
import { dot, to, keep, done, plate } from './parts'

export const headline = 'Everyone paid. Every tax filed.'
export const subline = 'Envelope turns hours, tips and salaries into every paycheck, moves net pay and taxes on payday, and files every federal, state and local return, W-2 and 1099.'

const art = plate('hero', [800, 1236, 1854, 2472], [1236, 576], '(min-width: 1700px) 1360px, (min-width: 760px) 80.5vw, 100vw',
 'Six clay figurines stand on the clay words “Everyone paid. Every tax filed.”: a server with an order pad, a plumber with a pipe wrench, a dental hygienist, a designer with a pencil, a sign painter with a brush and a line cook.',
 { widths: [390, 780, 1170], size: [860, 908] }, true)

const card = (body: string) => `<li class="hc">${keep(body)}</li>`
const left = card(`Ana Flores${dot}sign painter, contractor${dot}<span class="bad">TIN mismatch</span>${to}<span class="bad">W-9</span> corrected ${keep('Tue Oct 27')}${to}<span class="ok">${done('$2,400.00 paid Fri')}</span>`)
 + card(`Brightside Dental${dot}Mia Torres’s new bank ${keep('Thu Oct 29')}${to}held, confirmed on her old phone${to}<span class="ok">${done('paid Fri')}</span>`)
const right = card(`Marcus Hill${dot}line cook${dot}child support $262.00 + creditor $150.00 within limits${dot}<span class="ok">${done('remitted')}</span>`)
 + card(`Northpaw Studio${dot}Sam Rivera moved to Denver${dot}Colorado accounts and FAMLI <span class="ok">${done('registered Tue Oct 20')}</span>`)

export function hero(links: SiteLinks) {
 return `<section class="hero" aria-labelledby="hero-title">${siteHeader(links)}<div class="hero-stage">`
  + `<p class="hero-top">${keep(`High Street, Columbus${dot}payday Fri Oct 30${dot}one bookkeeper, 4 clients, 58 people`)}</p>`
  + `<h1 class="sr" id="hero-title">${headline}</h1><div class="hero-art">${art}</div>`
  + '<div class="hero-foot">'
  + `<ul class="hero-cards hero-cards--left" aria-label="Payday week on High Street">${left}</ul>`
  + `<div class="hero-copy"><p class="hero-sub">${subline}</p>`
  + '<p class="hero-alt">100% free, open source alternative to <strong>Gusto</strong>, <strong>ADP RUN</strong> and <strong>Paychex Flex</strong></p>'
  + `<div class="hero-actions">${runButton}<p class="hero-links"><a href="${links.demo}">Try the demo</a><a href="${links.docs}">Read the docs</a></p></div></div>`
  + `<ul class="hero-cards hero-cards--right" aria-label="More from payday week">${right}</ul>`
  + '</div></div></section>'
}
