import type { Session } from '../modules/operator-auth/index.mjs'
import type { Actor } from './access'
import type { Company } from './records'
import type { TaxNoticeCases } from './tax-notices'
import { page,Card,Field,Hidden,Select,Submit,companyPath } from './pages'
import { redact } from './providers'

type History=Awaited<ReturnType<TaxNoticeCases['history']>>
export function taxNoticeCasePage(session:Session,companies:Company[],actor:Actor,id:string,history:History,review?:Awaited<ReturnType<TaxNoticeCases['review']>>) {
  const base=companyPath(actor.company)+'/notices/'+id,door=base+'/case',current=history[0],facts=current?.data.facts
  const pdf=()=><label className="field"><span>Original PDF (up to 384 KB)</span><input type="file" name="pdf" accept=".pdf" required/></label>
  const periods=()=><><Field name="employerEin" label="Employer EIN from original"/><Field name="periodStart" label="Period start" type="date" value={facts?.periodStart}/><Field name="periodEnd" label="Period end" type="date" value={facts?.periodEnd}/></>
  return page(session,'Notice evidence and deadlines',companies,actor.company,<>
    <Card title="Follow through with evidence">
      <p>Originals, extraction and corrections remain private. A person verifies each fact. Model proposals cannot approve rates, send responses or change pay.</p>
      <p>Reported agency closure needs independent verification. Unknown balances stay unknown. Worker IRS instruction records are available from signed paper elections; calculated withholding remains unavailable.</p>
      <a href={base}>Review notice and exact correspondence</a>
    </Card>
    {review && <Card title={'Review exact case version '+review.version}>
      <p>Inspect the original and all facts in version {review.version} below. This decision reviews the record; it authorizes no payment, filing or payroll change.</p>
      <form method="post" action={door+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit primary>Confirm exact case review</Submit></form>
    </Card>}
    <Card title="Retained case history">
      {!history.length && <p>No verified case facts recorded.</p>}
      {history.map((row,index)=><article key={row.version}>
        <h3>Version {row.version} · {row.data.status}</h3>
        <p>{row.data.facts.agency} · {row.data.facts.type} · {row.data.facts.periodStart} to {row.data.facts.periodEnd}.</p>
        <p>Response due {row.data.facts.dueOn}. {row.overdue?'Response overdue. ':''}{row.nextAction} Responsible person: {row.data.ownerName}.</p>
        <p>Notice principal ${(row.data.facts.principalCents/100).toFixed(2)}; proposed penalty ${(row.data.facts.proposedPenaltyCents/100).toFixed(2)}. Reported residual: {row.data.residualCents===null?'Unknown':'$'+(row.data.residualCents/100).toFixed(2)}. Assessed penalty: {row.data.assessedPenaltyCents===null?'Unknown':'$'+(row.data.assessedPenaltyCents/100).toFixed(2)}. Actually abated, as reported: {row.data.abatedPenaltyCents===null?'Unknown':'$'+(row.data.abatedPenaltyCents/100).toFixed(2)}.</p>
        <p>Entered by {row.createdBy} at {new Date(row.createdAt).toISOString()}; reviewed by {row.approvedBy ?? 'no reviewer'}. {row.sourcesCurrent?'':'Linked source changed; fresh reconciliation required.'}</p>
        {row.data.facts.type==='sui-rate' && <p>SUI rate {row.data.facts.ratePercent}% effective {row.data.facts.effectiveFrom}. {row.data.rate?'Linked reviewed rule '+row.data.rate.id+' version '+row.data.rate.version:'No reviewed rule linked.'} Payroll calculation remains unavailable.</p>}
        <details><summary>Inspect source and evidence for version {row.version}</summary>
          <p className="notice-text">Unverified extraction: {redact(row.data.rawExtraction)}</p><p>{redact(row.data.correctionReason)}</p>
          <p className="notice-text">Original citation: {redact(row.data.original.quote)}</p><a href={door+'/original/'+row.version+'/0'}>Download retained notice original</a>
          {row.data.evidence.map((e,i)=><div key={e.reference}><p>{e.kind} · {e.reference} · recorded by {e.recordedBy} at {new Date(e.recordedAt).toISOString()}. {e.amountCents===null?'':'Deposit evidence amount $'+(e.amountCents/100).toFixed(2)}</p><p className="notice-text">{redact(e.document.quote)}</p><a href={door+'/original/'+row.version+'/'+(i+1)}>Download {e.kind} original</a></div>)}
        </details>
        {!index && row.approvedBy && row.data.facts.type==='sui-rate' && !review && <details><summary>Link an exact reviewed SUI edition</summary><a href={companyPath(actor.company)+'/rules'}>Review sourced payroll rules</a><p className="evidence-text">Rule source reference: notice:{id}:{row.data.original.sha256}. Match the state, effective date and percentage above. Linking does not calculate payroll.</p><form method="post" action={door+'/link-rate'}><Hidden name="version" value={row.version}/><Field name="ruleId" label="Reviewed SUI rule ID"/><Field name="ruleVersion" label="Reviewed SUI rule version" type="number"/><Submit>Link exact reviewed SUI rule</Submit></form></details>}
        {!index && !row.approvedBy && !review && <a className="btn" href={door+'/review'}>Review exact case version</a>}
      </article>)}
    </Card>
    {!review && <>
      {current?.data.status!=='closure-reported' && <Card title={current?'Correct verified case facts':'Record verified case facts'}>
        <form method="post" encType={['multipart','form-data'].join('/')} action={door}>
          <Hidden name="version" value={current?.version ?? 0}/><Select name="type" label="Notice type" choices={['sui-rate','deposit-mismatch']} value={facts?.type}/>
          <Field name="agency" label="Agency from original" value={facts?.agency}/>{periods()}<Field name="dueOn" label="Agency response deadline" type="date" value={facts?.dueOn}/>
          <Field name="principalCents" label="Notice principal in cents" type="number" value={facts?.principalCents}/><Field name="proposedPenaltyCents" label="Proposed penalty in cents" type="number" value={facts?.proposedPenaltyCents}/>
          <details><summary>SUI rate letter fields</summary><Field name="state" label="SUI state code" required={false} value={facts?.state}/><Field name="ratePercent" label="SUI rate percent" required={false} value={facts?.ratePercent}/><Field name="effectiveFrom" label="SUI effective date" type="date" required={false} value={facts?.effectiveFrom}/></details>
          {current?<Field name="correctionReason" label="Correction reason and original citation" maxLength={1000}/>:<>{pdf()}<label className="field"><span>Raw extraction, including any OCR error</span><textarea name="rawExtraction" required maxLength={12000}/></label><Field name="quote" label="Exact supporting source quotation" maxLength={4000}/></>}
          <label className="field"><span><input type="checkbox" name="verifiedExtraction" value="true" required/> I checked these facts against the original.</span></label><Submit>Save verified case version</Submit>
        </form>
      </Card>}
      {current && <Card title="Attach deposit or agency evidence">
        <form method="post" encType={['multipart','form-data'].join('/')} action={door+'/evidence'}>
          <Hidden name="version" value={current.version}/><Select name="kind" label="Evidence kind" choices={['deposit','agency-response','reopening']}/><Field name="reference" label="Unique source reference" maxLength={240}/>{periods()}{pdf()}<Field name="quote" label="Exact evidence quotation" maxLength={4000}/>
          <Field name="amountCents" label="Deposit evidence amount in cents" type="number" required={false}/>
          <details><summary>Reported agency disposition</summary><p>Complete all three amounts explicitly for agency response evidence. This records a human report and does not independently resolve the notice.</p><Field name="residualCents" label="Reported remaining balance in cents" type="number" required={false}/><Field name="assessedPenaltyCents" label="Assessed penalty in cents" type="number" required={false}/><Field name="abatedPenaltyCents" label="Actually abated penalty in cents" type="number" required={false}/><label className="field"><span><input type="checkbox" name="reviewedAgencyEvidence" value="true"/> I reviewed the agency evidence and these reported amounts.</span></label></details>
          <Submit>Retain evidence and follow-up</Submit>
        </form>
      </Card>}
    </>}
  </>)
}
