import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
import site from '../deploy-site.json'

export const alternative = '100% free, open source alternative to Gusto, ADP RUN, Paychex Flex'
export const identity: EditionIdentity = {
  product: branding.name,
  deployment: branding.name,
  purpose: 'Small-business payroll.',
  tagline: 'Small-business payroll.',
  signInPath: '/signin',
  runSite: `https://${site.domain}`,
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  band: '/brand/band.svg',
  fonts: '/fonts/fonts.css',
  accentColor: branding.primaryColor,
}
