// Envelope's homepage on the run site (run-envelope.com), as the owner approved it on 20 Oct 2026 (hero G and page
// s1): one payday week for Kim Sorensen's four High Street businesses, stage by stage, then a fifth client switching
// in. Its main action is Run Envelope, which opens /run; it links no instance-only route.
import { siteDocument, siteFooter, type SiteLinks } from '../shell/frame'
import { finish } from './parts'
import { hero, headline, subline } from './hero'
import { weekSection } from './week'
import { kindsSection } from './kinds'
import { preparedSection } from './prepared'
import { precheckSection } from './precheck'
import { reconciledSection } from './reconciled'
import { protectedSection } from './protected'
import { registeredSection } from './registered'
import { interlude, closing } from './scenes'
import { quarterlySection } from './quarterly'
import { noticeSection } from './notice'
import { switchingSection } from './switching'

export function landingHtml(links: SiteLinks, clone: string, styles: string[]) {
 const body = `<main>${hero(links)}${weekSection()}${kindsSection()}${preparedSection()}${precheckSection()}${reconciledSection()}${protectedSection()}${registeredSection()}`
  + `${interlude()}${quarterlySection()}${noticeSection()}${switchingSection(clone)}${closing(links)}</main>${siteFooter(links)}`
 return siteDocument(`Envelope: ${headline}`, subline, styles, finish(body) + '<script type="module" src="/site/type-layout.js"></script>')
}
