// Parts every section shares: business chips in each client's colour, the one heavy done-green check, separators that
// never start a line, and copy that keeps its dates, times and figures with their units.

/** " · " that stays with the word before it, so no line starts with a separator. */
export const dot = ' · '
/** " → " that stays with the word before it. */
export const to = ' → '

const days = 'Mon|Tue|Wed|Thu|Fri|Sat|Sun'
const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'
/** Keep "Fri Oct 30", "Oct 11–24", "10:14 am", "552 h", "7 h 30 min" and "Q3 2026" whole. */
export const keep = (text: string) => text
 .replace(new RegExp(`\\b((?:${days}) )?(${months}) (\\d{1,2})\\b`, 'g'), (_, day = '', month, n) => `${day.replace(' ', ' ')}${month} ${n}`)
 .replace(/\b(\d{1,2}:\d{2}) (am|pm|AM|PM)\b/g, '$1 $2')
 .replace(/(\d) (h|min|workdays|people|paid|returns|runs|kinds)\b/g, '$1 $2')
 .replace(/\b(\d+) of (\d+)\b/g, '$1 of $2')
 .replace(/\b(Q\d) (\d{4})\b/g, '$1 $2')
 .replace(/ – /g, ' – ')
 .replace(/ ([·→+−×]) /g, ' $1 ')
 .replace(/ = /g, ' = ')

/** A title whose last two words stay together, so its last line is never one word. */
export const tail = (text: string) => text.replace(/ (?=\S+$)/, '\u00a0')

/** Text that never breaks inside. */
export const nw = (text: string) => `<span class="nw">${text}</span>`

export type Business = 'rosa' | 'kessler' | 'brightside' | 'northpaw' | 'arch'
export const businessName: Record<Business, string> = { rosa: 'Rosa’s Taquería', kessler: 'Kessler Plumbing', brightside: 'Brightside Dental', northpaw: 'Northpaw Studio', arch: 'Arch City Hardware' }
/** One chip component: a rounded pill in the business colour with its name in white. */
export const chip = (business: Business, label = businessName[business]) => `<span class="chip chip--${business}">${label}</span>`
/** The grey "All 4" pill. */
export const all4 = '<span class="chip chip--all">All 4</span>'

/** The page's one done glyph: a heavy check in done-green (or currentColor on a coloured ground). */
export const CHECK = '<svg class="ck" viewBox="0 0 16 16" role="img" aria-label="done"><path d="M2.8 8.7l3.4 3.3 7-7.6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
/** Copy ending in the check; the last word and the check never part. */
export const done = (text: string) => {
 const kept = keep(text)
 const at = kept.lastIndexOf(' ')
 return `${kept.slice(0, at + 1)}<span class="nw">${kept.slice(at + 1)} ${CHECK}</span>`
}

/** A section's eyebrow (stage, businesses and dates) and its two-line heading. */
export const head = (id: string, eyebrow: string, one: string, two: string, lede = '') => `<p class="eyebrow">${keep(eyebrow)}</p>`
 + `<h2 class="display" id="${id}"><span class="l1">${tail(keep(one))}</span> <span class="l2">${tail(keep(two))}</span></h2>${lede ? `<p class="lede">${keep(lede)}</p>` : ''}`

export type Tone = 'aqua' | 'white' | 'forest'
export const section = (id: string, tone: Tone, content: string, extra = '') => `<section class="band band--${tone}${extra ? ` ${extra}` : ''}" aria-labelledby="${id}"><div class="wrap">${content}</div></section>`

/** A responsive painted plate: AVIF and WebP at each width, a phone crop below 760 px when given. */
export function plate(name: string, widths: number[], size: [number, number], sizes: string, alt: string, phone?: { widths: number[]; size: [number, number] }, eager = false) {
 const set = (n: string, ws: number[], type: string) => ws.map(w => `/site/${n}-${w}.${type} ${w}w`).join(', ')
 const phoneSources = phone ? ['avif', 'webp'].map(type => `<source type="image/${type}" media="(max-width: 759px)" srcset="${set(`${name}-phone`, phone.widths, type)}" sizes="calc(100vw - 32px)" width="${phone.size[0]}" height="${phone.size[1]}">`).join('') : ''
 const fallback = widths.find(w => w >= 1152) ?? widths[widths.length - 1]
 return `<picture>${phoneSources}<source type="image/avif" srcset="${set(name, widths, 'avif')}" sizes="${sizes}">`
  + `<img src="/site/${name}-${fallback}.webp" srcset="${set(name, widths, 'webp')}" sizes="${sizes}" width="${size[0]}" height="${size[1]}" alt="${alt}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}></picture>`
}
