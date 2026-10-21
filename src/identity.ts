import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
import site from '../deploy-site.json'

export const alternative = '100% free, open source alternative to Gusto, ADP RUN, Paychex Flex'
export const identity: EditionIdentity = {
  product: branding.name,
  deployment: branding.name,
  purpose: '{deployment}: small-business payroll.',
  tagline: 'Small-business payroll.',
  signInPath: '/signin',
  runSite: `https://${site.domain}`,
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  band: '/brand/band.svg',
  // Linked before the theme on the Lobby and the Run pages: Envelope's look (the faces are in the theme).
  fonts: '/look/envelope.css',
  accentColor: branding.primaryColor,
}
