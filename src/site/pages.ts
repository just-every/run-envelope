// The run site `rer build --site` writes: Envelope's homepage with its Run action, /run, /contract when the seed has
// a CONTRACT.md, the not-found page and the public files they use. Every Run page string and command is in run.json;
// nothing here reads installation data.
import './styles/site.css'
import './styles/hero.css'
import './styles/week.css'
import './styles/proof.css'
import './styles/returns.css'
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import run from './run.json'
import type { SiteLinks } from './shell/frame'
import { landingHtml } from './landing'

export function sitePages({ styles = [], contract }: Partial<SiteContext> = {}): SiteBuild {
 const data: RunData = run
 // The site has no /docs yet: Docs and "Read the docs" open the repository's run guide, and "Try the demo" opens
 // /run until a hosted demo serves.
 const links: SiteLinks = { repository: run.repository, docs: `${run.repository}/blob/main/RUN-LOCALLY.md`, demo: '/run', contract: Boolean(contract) }
 return {
  pages: [
   { path: '/', html: landingHtml(links, run.clone, styles) },
   { path: '/run', html: runPageHtml(identity, data, contract) },
   ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, data, contract) }] : []),
   { path: '/404', html: siteNotFoundHtml(identity, data, contract) },
  ],
  assets: ['rer-theme.css', 'fonts', 'brand', 'site', 'favicon.ico', 'favicon-32.svg', 'apple-touch-icon.png'],
 }
}
