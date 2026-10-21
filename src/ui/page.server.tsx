import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fontHead } from '../base/font-head'
import { iconHead } from '../base/icon-head'
import branding from '../branding.json'
import { PayRunHome } from './pay-run'
import type { Viewer } from './viewer'
import type { Company } from '../envelope/records'

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
const headers = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
  'content-security-policy':
    "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
}

/** A signed-in app document rendered once on the server: no script, styles only from the served theme and look. */
export function appDocument(title: string, body: ReactElement): Response {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<title>${escape(title)}</title>${iconHead}<link rel="stylesheet" href="/rer-theme.css">${fontHead}</head><body class="app">${renderToStaticMarkup(body)}</body></html>`,
    { headers },
  )
}

/** /app: the signed-in person's pay run home. */
export const payRunDocument = (viewer: Viewer, companies: Company[] = []) =>
  appDocument(`Pay runs · ${branding.name}`, <PayRunHome viewer={viewer} companies={companies} />)
