// The run site's document, header and footer for Envelope's homepage. Shared static HTML shell. Icons are Base's
// frozen head of the mark's favicons (public/favicon.ico, favicon-32.svg, apple-touch-icon.png).
import { iconHead } from '../../base/icon-head'

export const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Where the header, the hero and the closing link. `docs` is the public run guide. */
export interface SiteLinks { repository: string; docs: string; demo: string; contract: boolean }

/** One page: the faces and tokens from the public folder, then the site's compiled stylesheets. */
export function siteDocument(title: string, description: string, styles: string[], body: string) {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}">`
  + `<meta name="theme-color" content="#e1faf9"><meta property="og:type" content="website"><meta property="og:site_name" content="Envelope"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">${iconHead}`
  + '<link rel="preload" href="/fonts/nunito/nunito-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous"><link rel="preload" href="/fonts/inter/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous">'
  + `<link rel="stylesheet" href="/fonts/fonts.css">${styles.map(href => `<link rel="stylesheet" href="${escape(href)}">`).join('')}</head>`
  + `<body class="site">${body}</body></html>`
}

/** Mark 9 and the rounded wordmark. */
export const lockup = (size = 40) => `<a class="lockup" href="/"><img src="/brand/mark.svg" alt="" width="${size}" height="${size}"><span>Envelope</span></a>`

const nav = (links: SiteLinks) => `<a href="${escape(links.docs)}">Docs</a>${links.contract ? '<a href="/contract">Contract</a>' : ''}<a href="${escape(links.repository)}">Source</a>`

export const siteHeader = (links: SiteLinks) => `<header class="bar">${lockup()}<nav aria-label="Site">${nav(links)}</nav></header>`

export const siteFooter = (links: SiteLinks) => `<footer class="foot"><div class="foot-in"><div class="foot-brand">${lockup(36)}<p>Free, open source payroll</p></div>`
 + `<nav aria-label="Footer">${nav(links)}</nav></div></footer>`

export const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
/** The page's one coral action, "Run Envelope →", which opens /run. */
export const runButton = `<a class="run" href="/run">Run Envelope${ARROW}</a>`
