import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page, Card, Field, Hidden, Select, Submit, companyPath } from '../pages'
import type { Revision } from '../workspace/store'
import type { WorkerBinding, IncomeSource, ProtectedDisclosure, VerificationRequests } from './requests'
import type { ProtectedResponses } from '../disclosures/protected'
export interface VerificationView {
  history:Awaited<ReturnType<VerificationRequests['history']>>
  bindings:Revision<WorkerBinding>[]
  income:Revision<IncomeSource>[]
  disclosures:Revision<ProtectedDisclosure>[]
}
const Details=({value}:{value:unknown}):import('react').ReactNode=>Array.isArray(value)?<ol className="evidence-text">{value.map((v,i)=><li key={i}><Details value={v}/></li>)}</ol>:value && typeof value==='object'?<dl className="evidence-text">{Object.entries(value).map(([k,v])=><div key={k}><dt>{k}</dt><dd><Details value={v}/></dd></div>)}</dl>:String(value??'none')
export function verificationPage(session:Session,companies:Company[],actor:Actor,person:Person,result:VerificationView,self=false,review?:Revision & {reviewToken:string},issued?:Awaited<ReturnType<ProtectedResponses['release']>>){
  const base=companyPath(actor.company)+'/people/'+person.id+'/verification',current=result.bindings[0]
  return page(session,person.name+' · Verification',companies,actor.company,<>
    <Card title="Selected facts, explicit worker consent">
      <p>A named requester receives only the selected period and fields after exact owner review. Every retrieval rechecks consent, expiry, worker identity and source versions. There is no automatic external enrollment or outbound submission.</p>
      <p><a href={companyPath(actor.company)+'/people/'+person.id}>Person and rates</a> · <a href="https://github.com/just-every/run-willow">Willow employment provenance</a></p>
      <p>Interim policy: explicit worker consent, owner-only review and release, no legal-authority override. Expired responses become unavailable; retained history is restricted. Policy approval is pending.</p>
    </Card>
    {issued && <Card title="Protected response prepared for handover">
      <p>Release ID: <code data-release-id="true">{issued.id}</code>. Named requester: {issued.requesterId}. Give these details to that verified person through your approved private channel.</p>
      <p>Token (shown once): <code className="evidence-text" data-release-token="true">{issued.token}</code></p>
      <p><a href="/app/envelope/protected-response">Requester opens a protected response</a>. Expiry: {new Date(issued.expiresAt).toISOString()}. No delivery or acknowledgement is claimed.</p>
    </Card>}
    {review && <Card title="Review exact protected record">
      <p>{review.kind} · version {review.version}. Review the worker, requester, selected fields, period and provenance before deciding.</p>
      <Details value={review.data}/>
      <form method="post" action={base+'/'+review.kind+'/'+review.id+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit primary>Approve this exact protected record</Submit></form>
    </Card>}
    {!self && <>
      <Card title="Verified worker link">
        {current && <p>Native worker identity: {current.data.workerId}. Version {current.version}; {current.approvedBy&&!current.withdrawnBy?'reviewed':'review required'}.</p>}
        {current && !current.approvedBy && <a className="btn" href={base+'/verification-worker/'+current.id+'/review'}>Review worker identity link</a>}
        <form className="field" method="post" action={base+'/worker'}><Hidden name="version" value={current?.version??0}/><Field name="workerId" label="Verified native worker identity ID"/><Field name="evidence" label="Worker identity-link evidence" maxLength={500}/><Submit>Propose verified worker link</Submit></form>
      </Card>
      <Card title="Historical payroll register sources">
        <p>Import only documented historical wages. A reviewed source register is evidence; it does not initiate or certify a new payment.</p>
        {result.income.map(r=><article key={r.id+':'+r.version}><h3>{r.data.from}–{r.data.through} · ${(r.data.grossCents/100).toFixed(2)}</h3><p>{r.data.sourceRef} v{r.version}; {r.approvedBy&&!r.withdrawnBy?'reviewed':'review required'}.</p>{!r.approvedBy && <a href={base+'/income-source/'+r.id+'/review'}>Review source register</a>}</article>)}
        <form className="field" method="post" action={base+'/income'}><Field name="id" label="Register source ID"/><Field name="version" label="Previous register version (0 for new)" type="number" value={0}/><Field name="from" label="Wage period starts" type="date"/><Field name="through" label="Wage period ends" type="date"/><Field name="grossCents" label="Documented gross wages in cents" type="number"/><Field name="sourceRef" label="Original payroll register reference"/><Field name="evidence" label="Wage source reconciliation evidence" maxLength={500}/><Submit>Propose historical wage source</Submit></form>
      </Card>
    </>}
    {self && <Card title="Authorize one verification request">
      <form className="field" method="post" action={base+'/consents'}>
        <Field name="requesterId" label="Verified requester identity ID"/>
        <Select name="purpose" label="Lawful purpose" choices={['mortgage','rental','employment']}/>
        <Field name="from" label="Selected period starts" type="date"/><Field name="through" label="Selected period ends" type="date"/>
        <fieldset><legend>Only these fields may be disclosed</legend>{['hireDate','employmentStatus','grossWages'].map(f=><label className="field" key={f}><span><input name="fields" type="checkbox" value={f}/>{f==='hireDate'?'Hire date':f==='employmentStatus'?'Employment status':'Gross wages in the selected period'}</span></label>)}</fieldset>
        <Field name="expiresOn" label="Consent expires (within 30 days)" type="date"/><Field name="retentionUntil" label="Restricted history retention date (within 90 days)" type="date"/>
        <Submit primary>Consent to these exact fields and period</Submit>
      </form>
    </Card>}
    <Card title="Requests and disclosure history">
      {!result.history.consents.length && <p>No worker-authorized requests.</p>}
      {result.history.consents.map(c=><article key={c.id}><h3>{c.purpose} · {c.from}–{c.through}</h3><p>Request {c.id}. Requester {c.requesterId}. Fields: {c.fields.join(', ')}. {c.revokedAt?'Revoked':c.expiresAt<=Date.now()?'Expired':'Consent active'}. Restricted retention until {c.retentionUntil}.</p>
        {self && !c.revokedAt && <form method="post" action={base+'/consents/'+c.id+'/revoke'}><Submit>Revoke this consent</Submit></form>}
        {self && <form className="field" method="post" action={base+'/consents/'+c.id+'/corrections'}><Field name="reason" label={'Correction requested for '+c.id} maxLength={2000}/><Submit>Ask owner to correct the source</Submit></form>}
      </article>)}
      {result.history.releases.map((r,i)=><p key={i}>Response {String(r.disclosureId)} v{String(r.disclosureVersion)} · requester {String(r.requesterId)} · released {new Date(Number(r.issuedAt)).toISOString()} · {r.openedAt?'opened':'not opened'} · {r.acknowledgedAt?'requester acknowledged':'no acknowledgement'}.</p>)}
      {result.history.corrections.map(r=><p key={r.id}>Correction request {r.id}: {r.reason}. Owner source review required.</p>)}
    </Card>
    {!self && <>
      <Card title="Prepare a minimal protected response">
        <form className="field" method="post" action={base+'/disclosures'}><Field name="id" label="Protected response ID"/><Hidden name="version" value={0}/><Field name="consentId" label="Current worker consent request ID"/><Field name="corrects" label="Earlier response ID being corrected (optional)" required={false}/><Submit primary={!review}>Prepare selected facts for exact review</Submit></form>
      </Card>
      <Card title="Protected response versions">
        {result.disclosures.map(r=><article key={r.id+':'+r.version}><h3>{r.id} v{r.version}</h3><Details value={r.data}/>{!r.approvedBy?<a className="btn" href={base+'/disclosure/'+r.id+'/review'}>Review exact protected response</a>:<form method="post" action={base+'/disclosure/'+r.id+'/release'}><Hidden name="version" value={r.version}/><Submit>Release reviewed protected response</Submit></form>}</article>)}
      </Card>
    </>}
  </>)
}
export function protectedResponsePage(session:Session,result?:Awaited<ReturnType<ProtectedResponses['retrieve']>>,values?:{id:string;token:string}){
  return page(session,'Protected verification response',[],undefined,<Card title={result?'Selected reviewed facts':'Open your protected response'}>
    {result ? <><Details value={result}/>{values && !('acknowledged' in result) && <form method="post" action="/app/envelope/protected-response/ack"><Hidden name="id" value={values.id}/><Hidden name="token" value={values.token}/><Submit primary>Acknowledge receipt of these facts</Submit></form>}</> : <form className="field" method="post" action="/app/envelope/protected-response/read"><Field name="id" label="Protected release ID"/><Field name="token" label="Private response token" type="password"/><Submit primary>Open selected reviewed facts</Submit></form>}
    <p>This response is bound to the named requester. A token alone gives no access; revocation, expiry or changed sources refuse retrieval.</p>
  </Card>)
}
