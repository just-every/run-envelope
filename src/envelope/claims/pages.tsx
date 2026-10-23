import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { PayrollError } from '../security'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import type { ClaimData, ClaimRecord, ClaimReview } from './types'
import { separationReasons } from './portal'
import { Choice, Check, Multiline, Representative, FileField, RequestBinding, DeadlineFields, PayrollFields, WillowFields, MandateFields, AnswerFields, AttachmentFields, claimTime, dollars, type ClaimRepresentativeChoice, type ClaimPayrollOption } from './form-fields'
export type { ClaimRepresentativeChoice, ClaimPayrollOption } from './form-fields'

const owner = (actor: Actor) => { if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403) }
const basePath = (actor: Actor) => companyPath(actor.company) + '/claims'
const statusText: Record<ClaimData['status'], string> = {
  'awaiting-evidence': 'Evidence needed', 'ready-for-preparation': 'Ready to prepare the response', held: 'Held for the employer representative', 'ready-for-review': 'Ready for exact review', signed: 'Signed for human portal transfer',
  'human-portal-handoff': 'Human portal handoff recorded; submission unconfirmed', 'confirmation-reported': 'Imported confirmation, not reviewed', 'agency-confirmation-reviewed': 'Imported agency confirmation reviewed', 'follow-up-required': 'Agency follow-up needs a human response',
}
const UploadNote = () => <details><summary>Original file limits</summary><p>Each file can be up to 512 KB. A claim can retain up to 2 MB of original evidence. Files remain in this company’s protected records.</p></details>
const ArtifactLinks = ({ data, base }: { data: ClaimData; base: string }) => <ul className="evidence-text">{data.artifacts.map(a => <li key={a.id}><a href={base + '/artifacts/' + a.id} download>{a.name}</a> · {Math.ceil(a.bytes / 1024)} KB</li>)}</ul>
function SourceFacts({ data, base }: { data: ClaimData; base: string }) {
  return <>
    <p>Matched payroll worker: {data.worker?.name ?? 'Not matched'}. {data.worker && 'The retained worker identifier was checked against this request.'}</p>
    {data.payroll.length > 0 && <ul className="evidence-text">{data.payroll.map(p => <li key={p.kind + ':' + p.id}>{p.from} to {p.through} · {dollars(p.grossCents)} · {p.sourceRef} · retained version {p.version}</li>)}</ul>}
    {data.willow && <><h3>Reviewed Willow separation</h3><p>Last employment day: {data.willow.separationDate}. Actual last day worked: {data.willow.lastDayWorked}.</p><p>Recorded HR reason: {data.willow.reason}. Reviewed agency category: {data.willow.portalReason}.</p><p className="evidence-text">{data.willow.facts}</p><p>Native completion: {claimTime(data.willow.sourceApprovedAt, data.request.timeZone)}. Envelope review: {claimTime(data.willow.reviewedAt, data.request.timeZone)}.</p></>}
    {data.mandate && <><h3>Employer mandate</h3><p>Authority for {data.representative.name} to answer {data.mandate.agency}, effective {data.mandate.effectiveFrom} through {data.mandate.effectiveThrough}. Evidence: {data.mandate.sourceRef}.</p></>}
    <details><summary>Retained original evidence</summary><ArtifactLinks data={data} base={base} /></details>
  </>
}
export function claimsPage(session: Session, companies: Company[], actor: Actor, rows: ClaimRecord[], representatives: ClaimRepresentativeChoice[]) {
  owner(actor)
  const base = basePath(actor)
  return page(session, 'Unemployment claims', companies, actor.company, <>
    {rows.length > 0 && <Card title="Open claim work">{rows.map(row => <article key={row.id}><h3><a href={base + '/' + row.id}>{row.data.request.claimantName} · {row.data.request.agency}</a></h3><p>{statusText[row.data.status]} · due {(row.data.activeFollowUp ?? row.data.request).dueOn} · {row.data.representative.name}</p></article>)}</Card>}
    <details open={!rows.length}><summary>Import an agency request</summary><Card title="Retain the original request"><form className="field" action={base + '/import'} method="post" encType="multipart/form-data">
      <FileField name="requestFile" label="Official request file" />
      <Choice name="exchange" label="Request type" options={[{ value: 'separation', label: 'Separation information' }, { value: 'earnings', label: 'Earnings verification' }]} />
      <Field name="requestId" label="Claim number on the agency request" /><Field name="agency" label="Responsible agency" /><Field name="state" label="Agency state (two letters)" maxLength={2} />
      <Field name="employerEin" label="Employer FEIN on the request" /><Field name="stateEmployerId" label="State employer account number on the request" />
      <Field name="claimantName" label="Claimant name on the request" /><Field name="claimantIdentifier" label="Claimant SSN on the request" type="password" maxLength={11} />
      <Field name="issuedOn" label="Agency request date" type="date" /><DeadlineFields />
      <Choice name="claimantStatedReason" label="Claimant separation category, if supplied" required={false} options={separationReasons.map(value => ({ value, label: value }))} />
      <Field name="sourceRef" label="Original request reference" maxLength={500} /><Representative choices={representatives} />
      <Field name="escalationAt" label="Internal escalation before the cutoff (UTC)" type="datetime-local" />
      <Multiline name="requestedWeeks" label="Requested week-ending dates, one per line (earnings requests only)" />
      <UploadNote /><Submit primary>Import and assign this request</Submit>
    </form></Card></details>
    {!rows.length && <p>The employer representative owns the response deadline. Imported requests stay held until the worker, payroll history and employer authority have been reviewed.</p>}
  </>)
}
export function claimDetailPage(session: Session, companies: Company[], actor: Actor, row: ClaimRecord, people: Person[], representatives: ClaimRepresentativeChoice[], payroll: ClaimPayrollOption[], history: ClaimRecord[] = []) {
  owner(actor)
  const data = row.data, deadline = data.activeFollowUp ?? data.request, base = basePath(actor) + '/' + row.id, canReview = !data.holds.length && Boolean(row.sourcesCurrent && data.packet && !data.handoff)
  const nextEvidence = !data.worker || !data.payroll.length || !data.mandate || (data.request.exchange === 'separation' && !data.willow)
  return page(session, data.request.claimantName + ' · Unemployment claim', companies, actor.company, <>
    <p><a href={basePath(actor)}>All unemployment claims</a></p>
    <Card title={statusText[data.status]}>
      <p>{data.request.agency} · {data.request.state} · claim {data.request.requestId}. Employer FEIN: {data.request.employerEin}; state account: {data.request.stateEmployerId}.</p>
      <p>Agency due date: {deadline.dueOn}. {deadline.deadlineBasis === 'agency-specified-instant' ? 'Agency response deadline' : 'Internal response cutoff'}: {claimTime(deadline.deadlineAt, deadline.timeZone)} ({deadline.timeZone}).</p>
      <p>Employer representative: <strong>{data.representative.name}</strong>. Internal escalation: {claimTime(data.escalationAt, data.request.timeZone)}.</p>
      {(data.holds.length > 0 || !row.sourcesCurrent) && <div role="status"><h3>Before this response can move forward</h3><ul>{data.holds.map((h, i) => <li key={i}>{h}</li>)}{!row.sourcesCurrent && <li>Retained payroll or worker evidence changed. Review current evidence before signing or transferring this response.</li>}</ul></div>}
      {canReview && !data.signature && <p><a className="btn btn--primary" href={base + '/review'}>Review this exact response</a></p>}
      {data.signature && <p>Signed by {data.signature.name} at {claimTime(data.signature.signedAt, data.request.timeZone)}. The signature authorizes this response only.</p>}
      {data.handoff && <p>Human portal handoff recorded at {claimTime(data.handoff.recordedAt, data.request.timeZone)}. {data.confirmations.length ? 'Inspect imported correspondence below.' : 'Agency submission and acceptance are unconfirmed.'}</p>}
    </Card>
    {data.activeFollowUp && <Card title="Agency follow-up response"><p>{data.activeFollowUp.agencyReference} · {data.activeFollowUp.status === 'response-confirmed' ? 'Imported confirmation reviewed' : 'A separate response to the agency’s later questions'}.</p><ul>{data.activeFollowUp.questions.map((q,i)=><li key={i}>{q.question}</li>)}</ul></Card>}
    <Card title="Worker, payroll and reviewed facts"><SourceFacts data={data} base={base} /></Card>
    {!data.handoff && <details open={nextEvidence}><summary>{nextEvidence ? 'Match and review evidence' : 'Change reviewed evidence'}</summary><Card title="Review original evidence"><form className="field" action={base + '/evidence'} method="post" encType="multipart/form-data">
      <Hidden name="version" value={row.version} /><RequestBinding data={data} /><PayrollFields people={people} choices={payroll} data={data} />
      <Representative choices={representatives} value={data.representative.id} /><WillowFields data={data} /><MandateFields data={data} />
      <Check name="disputed" checked={data.disputed}>An assertion is disputed or needs a legal determination by the employer representative.</Check>
      <Multiline name="missingFacts" label="Missing facts for the representative, one per line" value={data.missingFacts.join('\n')} />
      {data.disputed && <FileField name="resolutionFile" label="Original evidence resolving the disputed assertion, if resolved" required={false} />}
      <UploadNote /><Submit primary={nextEvidence}>Record evidence and remaining holds</Submit>
    </form></Card></details>}
    {!data.handoff && !nextEvidence && <details open={!data.packet && !data.holds.length}><summary>Prepare the cited agency response</summary><Card title="Answer the actual agency questions"><form className="field" action={base + '/prepare'} method="post" encType="multipart/form-data">
      <Hidden name="version" value={row.version} /><Hidden name="claimId" value={row.id} /><AttachmentFields data={data} /><AnswerFields data={data} />
      <fieldset><legend>Authorized preparer</legend><Choice name="preparerKind" label="Responding as" value={data.preparer?.kind} options={[{ value: 'Employer', label: 'Employer' }, { value: 'TPA', label: 'Authorized third-party administrator' }]} />
        <Field name="preparerName" label="Preparer name" value={data.preparer?.name ?? session.operator.displayName} /><Field name="jobTitle" label="Preparer job title" value={data.preparer?.jobTitle} /><Field name="phone" label="Preparer phone" type="tel" value={data.preparer?.phone} /><Field name="email" label="Preparer email" type="email" value={data.preparer?.email ?? session.operator.email} />
      </fieldset><Submit primary={!data.packet && !data.holds.length}>Prepare for exact human review</Submit>
    </form></Card></details>}
    {data.signature && !data.handoff && <Card title="Transfer the signed response yourself"><p>Review the signed packet, then open the official portal and match this request. Submit once in the portal and save its confirmation and response document.</p>
      <p><a href={base + '/packet'} download>Download signed response packet</a> · <a href={data.request.portalUrl} target="_blank" rel="noreferrer">Open official E-Response portal</a></p>
      {!data.portalReview ? <form className="field" method="post" action={base + '/portal-review'} encType="multipart/form-data"><Hidden name="version" value={row.version} /><Hidden name="responseDigest" value={data.responseDigest ?? ''} /><FileField name="portalResponseFile" label="Original View Response downloaded from the agency portal" /><Check name="matchesReviewedResponse" required>I compared every agency question, answer and attachment in this original preview with the signed response. All content matches.</Check><Submit>Retain and confirm the agency preview</Submit></form> : <><p>The original agency preview was retained and compared with this exact signed response. Select Submit in the official portal once, then retain its confirmation below.</p><form method="post" action={base + '/handoff'}><Hidden name="version" value={row.version} /><Hidden name="responseDigest" value={data.responseDigest ?? ''} /><Submit primary>Record one human portal handoff</Submit></form></>}
    </Card>}
    {data.handoff && <>
      <Card title="Agency confirmation and follow-through">
        {data.confirmations.length === 0 && <p>No agency confirmation is retained. A prepared packet, signature or human handoff does not establish submission.</p>}
        {data.confirmations.map(c => <article key={c.confirmationNumber}><h3>Confirmation {c.confirmationNumber}</h3><p>{c.evidenceStatus === 'agency-confirmation-reviewed' ? 'Imported agency confirmation reviewed by a human' : 'Imported confirmation, not reviewed'}. Reported submission: {claimTime(c.submittedAt, data.request.timeZone)} · {c.timeliness === 'before-cutoff' ? 'before the response cutoff' : 'after the response cutoff'}.</p><p>{c.sourceRef}. This is retained portal evidence; no live agency verification or eligibility decision is claimed.</p></article>)}
        <details open={!data.confirmations.length}><summary>Retain a portal confirmation</summary><form className="field" action={base + '/confirmation'} method="post" encType="multipart/form-data">
          <Hidden name="version" value={row.version} /><RequestBinding data={data} /><FileField name="confirmationFile" label="Original portal confirmation or downloaded response" />
          <Field name="confirmationNumber" label="Confirmation number on the portal record" /><Field name="submittedAt" label="Submission time (UTC)" type="datetime-local" step="1" /><Field name="sourceRef" label="Portal confirmation evidence reference" maxLength={500} />
          <Choice name="agencyMessage" label="Message on the original confirmation" required={false} options={[{ value: 'Your response has been accepted.', label: 'Your response has been accepted.' }]} />
          <Check name="reviewEvidence">I inspected this original confirmation and matched its employer, request and response to this claim.</Check><UploadNote /><Submit>Record imported confirmation</Submit>
        </form></details>
      </Card>
      <details open={data.followUps.some(f=>f.status!=='response-confirmed'&&f.agencyReference!==data.activeFollowUp?.agencyReference)}><summary>Agency requests for more information</summary><Card title="Retain and assign agency follow-up">
        {data.followUps.map(f => <article key={f.agencyReference}><h3>{f.agencyReference} · {f.status === 'response-confirmed' ? 'Response confirmation reviewed' : 'Human response needed'}</h3><p>Due {f.dueOn}; response cutoff {claimTime(f.deadlineAt, f.timeZone)} ({f.timeZone}).</p><ul>{f.questions.map((q, i) => <li key={i}>{q.question}</li>)}</ul>{f.status !== 'response-confirmed' && f.agencyReference !== data.activeFollowUp?.agencyReference && <form method="post" action={base + '/begin-follow-up'}><Hidden name="version" value={row.version} /><Hidden name="agencyReference" value={f.agencyReference} /><Submit>Answer this agency follow-up</Submit></form>}</article>)}
        <form className="field" action={base + '/follow-up'} method="post" encType="multipart/form-data"><Hidden name="version" value={row.version} /><RequestBinding data={data} />
          <FileField name="followUpFile" label="Original agency follow-up" /><Field name="agencyReference" label="Agency correspondence reference" /><Field name="receivedAt" label="Received time (UTC)" type="datetime-local" />
          <DeadlineFields timeZone={data.request.timeZone} followUp /><Multiline name="questions" label="Agency questions, one per line" required /><Field name="sourceRef" label="Original agency evidence reference" maxLength={500} /><Representative name="ownerId" choices={representatives} value={data.representative.id} /><UploadNote /><Submit>Retain and assign this follow-up</Submit>
        </form>
      </Card></details>
    </>}
    {Boolean(data.previousResponses?.length) && <Card title="Earlier signed responses">{data.previousResponses?.map(previous=>{const prior=history.find(h=>h.version===previous.version);return <article key={previous.version}><h3>{previous.agencyReference ?? 'Original agency response'}</h3><p>Version {previous.version} · signed by {prior?.data.signature?.name}. {prior?.data.confirmations.some(c=>c.responseAccepted) ? 'Imported agency confirmation reviewed.' : 'Agency acceptance unconfirmed.'}</p><p><a href={base + '/versions/' + previous.version + '/packet'} download>Download this earlier signed response</a></p></article>})}</Card>}
    <details><summary>Representative escalation and retained versions</summary><Card title="Named responsibility">
      {data.escalations.map(e => <p key={e.id}>{e.representativeName} · {claimTime(e.recordedAt, data.request.timeZone)} · {e.reason} {e.beforeDeadline ? 'Assigned before the recorded deadline.' : 'Assigned after the recorded deadline.'}</p>)}
      <form className="field" action={base + '/escalate'} method="post"><Hidden name="version" value={row.version} /><Multiline name="reason" label="Action needed from the employer representative" required maxLength={2000} /><Submit>Record escalation to {data.representative.name}</Submit></form>
      {history.length > 0 && <details><summary>Response versions</summary>{history.map(h => <p key={h.version}>Version {h.version} · {claimTime(h.createdAt, data.request.timeZone)} · {statusText[h.data.status]} · {h.data.representative.name}{h.data.signature && <> · signed by {h.data.signature.name}</>}</p>)}</details>}
    </Card></details>
  </>)
}
export function claimReviewPage(session: Session, companies: Company[], actor: Actor, review: ClaimReview) {
  owner(actor)
  const data = review.data, deadline = data.activeFollowUp ?? data.request, base = basePath(actor) + '/' + review.id, company = companies.find(c => c.id === actor.company)
  return page(session, 'Review exact unemployment response', companies, actor.company, <>
    <p><a href={base}>Back to this claim</a></p>
    <Card title={company?.name ?? 'Selected employer'}><p>Employer FEIN: {data.request.employerEin}. State account: {data.request.stateEmployerId}. {data.request.agency} claim {data.request.requestId} for {data.worker?.name}.</p><p>Named representative: {data.representative.name}. {data.activeFollowUp && <>Follow-up {data.activeFollowUp.agencyReference}. </>}Agency due date: {deadline.dueOn}; response cutoff {claimTime(deadline.deadlineAt, deadline.timeZone)} ({deadline.timeZone}).</p></Card>
    <Card title="Exact response to approve"><dl>{data.packet?.fields.map(f => <div key={f.field}><dt><strong>{f.label}</strong></dt><dd className="evidence-text">{f.value}<p>Evidence: {f.citations.map(c => data.willow?.artifactId === c ? 'Reviewed Willow separation evidence' : data.payroll.find(p => p.id === c)?.sourceRef ?? 'Retained original evidence').join('; ')}</p></dd></div>)}</dl><p>Preparer: {data.preparer?.name} · {data.preparer?.jobTitle} · {data.preparer?.phone} · {data.preparer?.email}.</p></Card>
    <Card title="Retained evidence for this version"><SourceFacts data={data} base={base} /></Card>
    <Card title="Confirm signing access"><p>Signing requires a recent confirmation from your own email.</p><form method="post" action="/auth/step-up"><Hidden name="action" value="credentials:mint" /><Hidden name="returnTo" value={base + "/review"} /><Submit>Send signing confirmation</Submit></form></Card>
    <Card title="Human approval and signature"><p>This approves only this exact response and its listed evidence. You will transfer it to the agency portal yourself.</p>
      {session.operator.id === data.representative.id && review.sourcesCurrent && !data.holds.length ? <form className="field" action={base + '/sign'} method="post"><Hidden name="version" value={review.version} /><Hidden name="reviewToken" value={review.reviewToken} /><Hidden name="responseDigest" value={review.responseDigest} /><Multiline name="statement" label="Your signature statement" required maxLength={1000} /><Check name="humanAttestation" required>I am {data.representative.name}, authorized by the reviewed employer mandate, and I reviewed the exact response and evidence above.</Check><Submit primary>Approve and sign this exact response</Submit></form> : <p>{data.representative.name} must sign in with current employer authority and review the current evidence.</p>}
    </Card>
  </>)
}
