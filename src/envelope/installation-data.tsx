import { renderToStaticMarkup } from 'react-dom/server'
import type { Bindings } from '../auth.server'
import seed from '../../seed.json'
import { webhookDestination } from './lifecycle'

/** Extend only successful native owner documents; keep their authority and CSP. */
export async function installationDataResponse(response: Response, env: Bindings): Promise<Response> {
  if (response.status !== 200 || !/^text[/]html(?:;|$)/.test(response.headers.get('content-type') ?? '')) return response
  const linked = await env.DB.prepare("SELECT issuer FROM rer_dependency_link WHERE interface='oidc-provider@1'").first<{issuer: string}>()
  const local = env.AUTH_LOCAL === 'true' || env.RER_DEMO === '1'
  const mail = local ? 'Local mail is suppressed' : ['rer', 'resend', 'sendgrid', 'cloudflare'].includes(env.MAIL_PROVIDER ?? '')
    ? `Selected native mail: ${env.MAIL_PROVIDER}` : 'Native mail is unavailable'
  let receiver = 'No proposal webhook receiver configured'
  try { receiver = webhookDestination(env) } catch { /* no invalid configuration or credential is displayed */ }
  const content = renderToStaticMarkup(<section aria-labelledby="external-data-heading">
    <h2 id="external-data-heading">External data recipients</h2>
    <p>{mail}. Installation credentials stay in owner Worker bindings and are never displayed here. Company notice providers require separate explicit consent in company settings.</p>
    {seed.externals.map(recipient => <details key={recipient.id}>
      <summary>{recipient.name}</summary>
      <p>{recipient.availability === 'unavailable' ? 'Unavailable — no outbound connection'
        : recipient.availability === 'hosting' ? 'Owner-controlled hosting' : 'Requires explicit owner configuration'}.</p>
      <p>{recipient.why}</p>
      <p>Permitted fields: {recipient.data.join(', ')}.</p>
      <p>Destination: {recipient.availability === 'unavailable' ? 'None authorized; no request is made'
        : recipient.id === 'rer-mail' ? env.MAIL_PROVIDER === 'rer' ? env.MAIL_RELAY_URL ?? 'No managed mail relay configured' : 'Managed mail is not selected'
        : recipient.id === 'proposal-webhooks' ? receiver
        : recipient.id === 'identity-provider' ? linked?.issuer ?? 'No identity issuer linked'
        : recipient.adapters.join(', ') || 'Owner-controlled hosting and storage'}.</p>
    </details>)}
    <p>Cloudflare native mail sends the intended sender, recipient and single-use sign-in, invitation or sensitive-change link. Its scoped credential and account identifier stay in owner bindings; messages and delivery metadata follow the owner account terms. Local and demo mail never leaves this installation.</p>
    <p>Payroll rails, account verification, tax and identity agencies, recordkeepers, carriers, HR, time, POS, ledgers, Inkwell, SMS, chat and push are unavailable as outbound connections. Imported source records do not establish a live connection. The unavailable declarations above retain the full contracted recipient families. Each future connection must replace its prospective declaration with the exact authorized recipient, purpose, fields, credential and custody before its first request.</p>
    <p>Optional AI processes redacted notice proposals only. Calculation, payment, filing, reconciliation and worker portal completion remain unfinished; disabling AI never supplies a substitute result.</p>
  </section>)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.set('cache-control', 'no-store')
  return new Response((await response.text()).replace('</main>', content + '</main>'), {status:response.status,headers})
}
