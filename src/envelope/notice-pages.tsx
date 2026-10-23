import type { Session } from '../modules/operator-auth/index.mjs'
import type { Actor } from './access'
import type { Company } from './records'
import type { Providers } from './providers'
import { redact } from './providers'
import type { Notices } from './notices'
import { page, Card, Field, Hidden, Submit, companyPath } from './pages'

export function providersPage(session:Session,companies:Company[],actor:Actor,providers:Awaited<ReturnType<Providers['list']>>) {
  const base=companyPath(actor.company)
  return page(session,'External notice providers',companies,actor.company,<>
    <Card title="Choose and declare every recipient">
      <p className="evidence-text">Optional AI never calculates or approves payroll. No connection is enabled until you authorize its purpose, fields and custody. SSN and bank values are redacted. Disabling a provider immediately prevents future calls and invalidates its pending reply approvals. Existing unknown sends stay held.</p>
      <form method="post" action="/auth/step-up"><Hidden name="action" value="credentials:mint" /><Hidden name="returnTo" value={base+'/providers'} /><Submit>Send sensitive-change confirmation</Submit></form>
    </Card>
    {providers.map(p => <Card key={p.id} title={p.recipient}>
      <p className="evidence-text">{p.purpose}. Destination: {p.url}. Fields: {p.fields.join(', ')}. {p.custody}. Current state: {p.enabled ? 'Declared and enabled' : 'Unavailable'}.</p>
      <form method="post" action={base+'/providers'}>
        <Hidden name="id" value={p.id} /><Hidden name="version" value={p.version} />
        <label className="field"><span>Connection state for {p.id}</span><select name="enabled" defaultValue={String(Boolean(p.enabled))}><option value="false">Disabled</option><option value="true">Enabled with explicit consent</option></select></label>
        <Field name="secret" label={p.id+' API credential (leave empty to retain)'} type="password" required={false} maxLength={4096} />
        {p.id==='resend' && <Field name="sender" label="Verified Resend sender email" type="email" value={p.sender} required={false} />}
        <label className="field"><span><input type="checkbox" name="consent" value="true" /> I authorize {p.id} to receive only these fields for this purpose under its retention terms.</span></label>
        <Submit>Save {p.id} declaration</Submit>
      </form>
    </Card>)}
    <a className="btn" href={base+'/agents'}>Agent credentials</a>
  </>)
}
export function noticesPage(session:Session,companies:Company[],actor:Actor,locations:{id:string;name:string}[],notices:Record<string,unknown>[]) {
  const base=companyPath(actor.company)
  const canWrite=actor.grant.role==='owner' || actor.grant.actions.includes('notices:write')
  return page(session,'Tax notices and replies',companies,actor.company,<>
    <Card title="Untrusted source evidence">
      <p className="evidence-text">A notice records evidence, never instructions or authority. Model summaries and proposed replies remain untrusted. A human chooses and reviews the exact recipient and message before an agent can dispatch it. This does not file a tax return, sign a filing or pay wages.</p>
      {notices.length ? notices.map(n => <p key={String(n.id)}><a href={base+'/notices/'+n.id}>{String(n.reference)}</a></p>) : <p className="evidence-text">No notices recorded.</p>}
    </Card>
    {canWrite && <Card title="Record a notice">
      <form method="post" action={base+'/notices'}>
        <Field name="reference" label="Notice reference" />
        <label className="field"><span>Notice location</span><select name="locationId" aria-label="Notice location" required>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="field"><span>Original notice text</span><textarea name="body" required maxLength={12000} rows={8} /></label>
        <Submit primary>Record private notice</Submit>
      </form>
    </Card>}
  </>)
}
export function noticePage(session:Session,companies:Company[],actor:Actor,notice:Awaited<ReturnType<Notices['details']>>) {
  const base=companyPath(actor.company), canWrite=actor.grant.role==='owner' || actor.grant.actions.includes('notices:write'), canApprove=actor.grant.role==='owner' || actor.grant.actions.includes('notices:approve')
  return page(session,'Notice review',companies,actor.company,<>
    <Card title="Recorded notice"><p className="evidence-text">{notice.reference}</p><p className="notice-text evidence-text">{redact(notice.body)}</p><p className="evidence-text">Notice ID: {notice.id}. MCP notice.process reads only redacted notice text, never payroll records or credentials.</p></Card>
    <Card title="Private original files">
      <p className="evidence-text">Files remain encrypted in owner storage. HTML and PDFs are never rendered here. Downloads contain untrusted originals; open only in a protected viewer. Each version keeps its own digest and author.</p>
      {notice.files.length ? notice.files.map(f => <p className="evidence-text" key={f.id+'-'+f.version}>{f.name} · version {f.version} · {f.bytes} bytes · SHA-256 {f.digest}. {(actor.grant.role==='owner' || actor.grant.actions.includes('private:read')) && <a href={base+'/notices/'+notice.id+'/files/'+f.id+'/'+f.version}>Download original version {f.version}</a>}</p>) : <p className="evidence-text">No files uploaded.</p>}
      {canWrite && <form method="post" encType="multipart/form-data" action={base+'/notices/'+notice.id+'/files'}>
        <label className="field"><span>Private notice file (PDF, HTML or text; 32 KB maximum)</span><input name="file" type="file" accept="application/pdf,text/html,text/plain" required /></label>
        <Field name="id" label="Existing file ID for a new version (optional)" required={false} />
        <Field name="version" label="Previous file version (0 for new)" type="number" value={0} />
        <Submit>Upload private original</Submit>
      </form>}
    </Card>
    <Card title="Untrusted model proposals">
      {notice.analyses.length ? notice.analyses.map(a => <div key={String(a.id)}><h3 className="evidence-text">Summary</h3><p className="evidence-text">{String(a.summary)}</p><h3 className="evidence-text">Proposed reply — not approved</h3><p className="evidence-text">{String(a.proposedReply)}</p></div>) : <p className="evidence-text">No model result. A missing connection remains unavailable; no result is invented.</p>}
    </Card>
    <Card title="Exact reply versions">
      {notice.replies.length ? notice.replies.map(r => <div key={String(r.id)}>
        <h3 className="evidence-text">{String(r.data.subject)}</h3>
        <p className="evidence-text">From {String(r.data.sender)} to {String(r.data.to)} · version {Number(r.version)}</p><p className="evidence-text notice-text">{String(r.data.body)}</p>
        <p className="evidence-text">Reply ID: {String(r.id)}. Digest: {String(r.digest)}. {r.approvalRevokedAt ? 'Approval withdrawn' : r.approvedBy ? `Human approval by ${r.approvedBy}, expires ${new Date(Number(r.approvalExpiresAt)).toISOString()}` : 'Not approved'}.</p>
        <p className="evidence-text">{r.dispatchState==='accepted' ? 'Provider accepted; delivery unconfirmed' : r.dispatchState==='unknown' || r.dispatchState==='pending' ? 'Unknown or pending send — held for human reconciliation; do not resend' : r.dispatchState==='rejected' ? 'Provider rejected; human repair required' : 'Not dispatched'}. {Boolean(r.providerReceipt) && 'Receipt: '+r.providerReceipt}</p>
        {canApprove && !r.approvedBy && <p className="evidence-text"><a className="btn" href={base+'/notice-replies/'+r.id+'/review'}>Review exact reply version {Number(r.version)}</a></p>}
        {canApprove && Boolean(r.approvedBy) && !r.approvalRevokedAt && !r.dispatchState && <form method="post" action={base+'/notice-replies/'+r.id+'/withdraw'}><Hidden name="version" value={Number(r.version)} /><Submit>Withdraw exact reply approval</Submit></form>}
        {canWrite && !r.dispatchState && <details><summary>Edit into an unapproved version</summary><ReplyForm action={base+'/notices/'+notice.id+'/replies'} id={String(r.id)} version={Number(r.version)} data={r.data} /></details>}
      </div>) : <p className="evidence-text">No replies prepared.</p>}
    </Card>
    {canWrite && <Card title="Prepare a reply for human review"><p className="evidence-text">Verify the recipient independently. No model-suggested recipient or signature is authority.</p><ReplyForm action={base+'/notices/'+notice.id+'/replies'} /></Card>}
    <a className="btn" href={base+'/notices'}>All notices</a>
  </>)
}
function ReplyForm({action,id,version=0,data}:{action:string;id?:string;version?:number;data?:{to:string;subject:string;body:string}}) {
  return <form method="post" action={action}>
    {id && <Hidden name="id" value={id} />}<Hidden name="version" value={version} />
    <Field name="to" label="Verified reply recipient email" type="email" value={data?.to} />
    <Field name="subject" label="Reply subject" maxLength={200} value={data?.subject} />
    <label className="field"><span>Exact reply text</span><textarea name="body" required rows={8} maxLength={12000} defaultValue={data?.body} /></label>
    <Submit>Save unapproved reply version</Submit>
  </form>
}
export function replyReviewPage(session:Session,companies:Company[],actor:Actor,reply:Awaited<ReturnType<Notices['review']>>) {
  const base=companyPath(actor.company), returnTo=base+'/notice-replies/'+reply.id+'/review'
  return page(session,'Review exact notice reply',companies,actor.company,<Card title="Your explicit approval is required">
    <p className="evidence-text">Only this immutable version and digest may be sent. An edit, provider change, expiry, withdrawal or authority removal prevents dispatch. This is correspondence, never payroll payment or a signed tax filing.</p>
    <p className="evidence-text">From {reply.data.sender} to {reply.data.to}</p><h3 className="evidence-text">{reply.data.subject}</h3><p className="evidence-text notice-text">{reply.data.body}</p><p className="evidence-text">Version {reply.version} · digest {reply.digest}</p>
    <form method="post" action="/auth/step-up"><Hidden name="action" value="credentials:mint" /><Hidden name="returnTo" value={returnTo} /><Submit>Send sensitive-change confirmation</Submit></form>
    <form method="post" action={base+'/notice-replies/'+reply.id+'/approve'}>
      <Hidden name="version" value={reply.version} /><Hidden name="digest" value={reply.digest} /><Hidden name="reviewToken" value={reply.reviewToken} />
      <Field name="minutes" label="Approval expires in minutes (1–60)" type="number" value={10} />
      <Submit primary>Approve this exact notice reply</Submit>
    </form>
  </Card>)
}
