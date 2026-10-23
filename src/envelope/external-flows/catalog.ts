import type { Records } from '../records'
import type { Actor } from '../access'
import { fence } from '../access'
import { PayrollError } from '../security'

export interface InstallationFlow {recipient:string;destination:string;purpose:string;fields:string[];credential:string;custody:string;state:string}
/** Describe only integrations the installed code actually uses. No key values. */
export async function installationFlows(records:Records,actor:Actor):Promise<InstallationFlow[]> {
  if(actor.grant.role!=='owner') throw new PayrollError('owner_required',403)
  const f=fence(actor),link=await records.statement(`SELECT issuer,metadata,needs_relink FROM rer_dependency_link WHERE interface='oidc-provider@1' AND ${f.sql}`,[...f.args]).first<{issuer:string;metadata:string;needs_relink:number}>(),env=records.env,
    mail=env.AUTH_LOCAL==='true'||env.RER_DEMO==='1' ? 'development' : env.MAIL_PROVIDER??'development',
    destinations={resend:'https://api.resend.com/emails',sendgrid:'https://api.sendgrid.com/v3/mail/send',cloudflare:'https://api.cloudflare.com/client/v4/accounts/<owner-account>/email/sending/send',development:'No external request'}
  const flows:InstallationFlow[]=[{
    recipient:'Owner-selected Cloudflare hosting and private D1 storage',destination:'This installation’s Worker and D1 bindings',
    purpose:'Serve authenticated requests and retain private payroll evidence',fields:['HTTP request metadata','owner-controlled encrypted payroll records'],credential:'Owner deployment credentials and runtime bindings; never sent to notice providers',
    custody:'Owner’s Cloudflare account; installation encryption key remains outside archives',state:'Installation infrastructure',
  },{
    recipient:mail==='development'?'No external sign-in mail recipient':mail+' and the addressed invited operator',destination:destinations[mail],
    purpose:'Allowlisted sign-in, invitations and session-bound sensitive-action confirmation only',fields:['addressed operator email','sender','purpose-specific expiring sign-in or confirmation link'],
    credential:'Owner-selected MAIL_PROVIDER, MAIL_FROM and MAIL_API_KEY; Cloudflare additionally uses MAIL_ACCOUNT_ID. Values never returned.',
    custody:'Runtime credential only; selected mail provider processes delivery under owner terms. Links are authentication secrets, never payroll payloads.',state:mail==='development'?'Suppressed; external delivery unavailable':'Explicit installation mail configuration',
  }]
  let metadata:{authorization?:string;token?:string;jwks?:string}={}
  if(link) {try {metadata=JSON.parse(link.metadata)} catch {throw new PayrollError('identity_declaration_unavailable',503)}}
  flows.push({recipient:link?.issuer??'No linked identity provider',destination:link?[metadata.authorization,metadata.token,metadata.jwks].filter(Boolean).join('; '):'No external request',
    purpose:'Optional owner-linked native operator identity; never payroll authority',fields:['OIDC client ID','one-time authorization code','PKCE verifier','short-lived client assertion','requested identity and step-up claims'],
    credential:'Owner-approved installation signing key in rer_dependency_keys; no payroll or notice API credential',
    custody:'Linked issuer’s identity processing; local sessions and keys do not transfer in payroll archives; restored links require fresh setup',state:link?(link.needs_relink?'Unavailable until owner relinks':'Owner-approved pinned link'):'Unavailable'})
  return flows
}
