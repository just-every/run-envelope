import type { Actor } from '../access'
import type { NoticeCases } from './cases'
import { Card, Field, Hidden, Submit } from '../pages'
const money=(value:number|null)=>value===null?'Unknown — unreconciled':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100)
export function CaseCard({actor,noticeId,base,work,files}:{actor:Actor;noticeId:string;base:string;work:Awaited<ReturnType<NoticeCases['read']>>;files:{id:string;version:number;name:string}[]}) {
  const latest=work.latest,data=latest?.data,canWrite=actor.grant.role==='owner'||actor.grant.actions.includes('notices:write')
  return <Card title="Case ownership and agency evidence">
    <p className="evidence-text">A reported amount is not a reconciled liability. Replies, model text and claimed abatements never close a case. Each case event cites an immutable source version. Lock-in implementation and outbound filing/payment remain unavailable.</p>
    {data ? <>
      <p className="evidence-text">{data.agency} · {data.period} · {data.kind} · version {latest.version}. State: {data.state}. {data.einMatched?'Company EIN matched.':'Wrong EIN — identity repair required.'}</p>
      <p className="evidence-text">Owner: {data.ownerId}. Response deadline: {data.deadline}. {work.overdue?'OVERDUE — escalate to the assigned human now.':''} {work.deadlineBreached?'The missed response deadline remains recorded.':''}</p>
      <p className="evidence-text">Reported amount: {money(data.reportedAmountCents)}. Agency-supported remaining liability: {money(data.remainingLiabilityCents)}. Abatement claimed: {money(data.claimedAbatementCents)}; actually supported by agency: {money(data.actualAbatementCents)}.</p>
      {data.events.map((e,i)=><p className="evidence-text" key={i}>{e.action} · {e.actorId} · {new Date(e.at).toISOString()} · {e.note}{e.file ? ` · file ${e.file.id}@${e.file.version} SHA-256 ${e.file.digest}`:''}{e.reference?' · '+e.reference:''}</p>)}
      <details><summary>Immutable case history</summary>{work.history.map(h=><p className="evidence-text" key={h.version}>Version {h.version} · {h.createdBy} · {new Date(h.createdAt).toISOString()} · SHA-256 {h.digest} · {h.data.state}</p>)}</details>
      {canWrite && files.length>0 && <form method="post" action={base+'/notices/'+noticeId+'/case'}>
        <Hidden name="version" value={latest.version} />
        <label className="field"><span>Case event</span><select name="action"><option value="deposit-proof">Attach deposit proof</option><option value="ocr-correction">Correct transcription and EIN</option><option value="claimed-abatement">Record abatement claim</option><option value="agency-close">Record verified agency disposition</option><option value="agency-reopen">Reopen from agency evidence</option><option value="rate-applied">Link a reviewed SUI rule</option><option value="correspondence">Link accepted correspondence</option></select></label>
        <Field name="fileId" label="Supporting private file ID" /><Field name="fileVersion" label="Supporting file version" type="number" value={1} />
        <Field name="note" label="Evidence note and source citation" maxLength={1000} />
        <Field name="ein" label="Corrected EIN (for transcription repair)" required={false} />
        <Field name="reportedAmountCents" label="Corrected reported amount in cents" type="number" value={data.reportedAmountCents} />
        <Field name="claimedAbatementCents" label="Abatement claimed in cents" type="number" value={data.claimedAbatementCents} />
        <Field name="actualAbatementCents" label="Agency-supported abatement in cents" type="number" value={data.actualAbatementCents} />
        <Field name="remainingLiabilityCents" label="Agency-supported remaining liability in cents" type="number" required={false} />
        <Field name="reference" label="Reviewed rule ID or dispatch intent ID (when linking)" required={false} />
        <label className="field"><span><input type="checkbox" name="confirm" value="true" /> I verified this agency disposition and its remaining balance from the cited original.</span></label>
        <Submit>Append cited case event</Submit>
      </form>}
    </> : canWrite && <form method="post" action={base+'/notices/'+noticeId+'/case'}>
      <Hidden name="version" value={0} /><Hidden name="action" value="intake" />
      <label className="field"><span>Notice kind</span><select name="kind"><option value="irs-deposit">IRS mismatched deposit</option><option value="sui-rate">SUI rate letter</option><option value="irs-lock-in">IRS lock-in — implementation held</option><option value="other">Other notice</option></select></label>
      <Field name="agency" label="Issuing agency" /><Field name="ein" label="EIN read from the original" />
      <Field name="period" label="Notice period" /><Field name="ownerId" label="Responsible human operator ID" value={actor.session.operator.id} />
      <Field name="deadline" label="Response deadline in UTC (YYYY-MM-DDTHH:mm:ssZ)" maxLength={40} />
      <Field name="reportedAmountCents" label="Reported amount in cents" type="number" value={0} />
      <Submit>Assign notice case</Submit>
    </form>}
  </Card>
}
