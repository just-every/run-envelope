import guide from '../../RUN-LOCALLY.md?raw'
import './styles/docs.css'
import { escape, siteDocument, siteHeader, siteFooter, type SiteLinks } from './shell/frame'

// Render the guide's Markdown subset without accepting source HTML.
function inline(source: string): string {
 const tokens = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g
 let html = '', end = 0
 for (const match of source.matchAll(tokens)) {
  html += escape(source.slice(end, match.index))
  if (match[1]) html += `<code>${escape(match[1])}</code>`
  else if (match[2]) html += `<strong>${escape(match[2])}</strong>`
  else {
   const href = match[4]
   html += /^https?:\/\//i.test(href) || /^\/(?!\/)/.test(href)
    ? `<a href="${escape(href)}">${escape(match[3])}</a>` : escape(match[0])
  }
  end = match.index! + match[0].length
 }
 return html + escape(source.slice(end))
}

const headingId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function guideHtml(source: string): string {
 const lines = source.replace(/\r\n/g, '\n').split('\n')
 const blocks: string[] = []
 let paragraph: string[] = [], item: string[] = [], list = false, code: string[] | undefined
 const flushParagraph = () => {
  if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
  paragraph = []
 }
 const flushItem = () => {
  if (item.length) blocks.push(`<li>${inline(item.join(' '))}</li>`)
  item = []
 }
 const closeList = () => {
  if (list) { flushItem(); blocks.push('</ul>'); list = false }
 }
 for (const line of lines) {
  if (line.startsWith('```')) {
   if (code) { blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); code = undefined }
   else { flushParagraph(); closeList(); code = [] }
   continue
  }
  if (code) { code.push(line); continue }
  const heading = /^(#{1,6}) (.+)$/.exec(line)
  if (heading) {
   flushParagraph(); closeList()
   blocks.push(`<h${heading[1].length} id="${headingId(heading[2])}">${inline(heading[2])}</h${heading[1].length}>`)
  } else if (/^- /.test(line)) {
   flushParagraph(); flushItem()
   if (!list) { blocks.push('<ul>'); list = true }
   item.push(line.slice(2))
  } else if (!line.trim()) {
   flushParagraph(); closeList()
  } else if (list && /^\s+/.test(line)) item.push(line.trim())
  else { closeList(); paragraph.push(line.trim()) }
 }
 flushParagraph(); closeList()
 if (code) blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`)
 return blocks.join('\n')
}

export function docsPages(links: SiteLinks, styles: string[]): { path: string; html: string }[] {
 const docsLinks = { ...links, docs: '/docs' }
 const page = (title: string, description: string, body: string) => siteDocument(title, description, styles,
  `${siteHeader(docsLinks)}<main id="main" class="docs">${body}</main>${siteFooter(docsLinks)}`)
 const sections = [...guide.matchAll(/^## (.+)$/gm)].map(([, title]) =>
  `<li><a href="/docs/run-locally#${headingId(title)}">${escape(title)}</a></li>`).join('')
 return [
  { path: '/docs', html: page('Documentation · Envelope', 'Install, run and maintain Envelope.',
   `<section class="docs-intro"><p class="eyebrow">Envelope docs</p><h1>Run it your way.</h1><p>Install, run and maintain your own copy of Envelope.</p></section><section class="docs-index" aria-labelledby="guide-title"><h2 id="guide-title"><a href="/docs/run-locally">Run it locally</a></h2><p>The repository’s guide to launch, setup, backups and deployment.</p><ul>${sections}</ul></section>`) },
  { path: '/docs/run-locally', html: page('Run it locally · Envelope docs', 'The repository guide to running, backing up and deploying your installation.',
   `<nav class="docs-breadcrumb" aria-label="Breadcrumb"><a href="/docs">Documentation</a><span aria-hidden="true">/</span><span>Run it locally</span></nav><article class="docs-guide">${guideHtml(guide)}</article>`) },
 ]
}
