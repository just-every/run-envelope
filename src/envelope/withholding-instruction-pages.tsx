import type { Session } from '../modules/operator-auth/index.mjs'
import type { Actor } from './access'
import type { Company } from './records'
import type { WithholdingInstructions } from './withholding-instructions'
import { page,Card,Field,Hidden,Select,Submit,companyPath } from './pages'
import { redact } from './providers'

type History=Awaited<ReturnType<WithholdingInstructions['history']>>
export function withholdingInstructionPage(session:Session,companies:Company[],actor:Actor,person:string,history:History,review?:Awaited<ReturnType<WithholdingInstructions['review']>>) {
 const door=companyPath(actor.company)+'/people/'+person+'/withholding-instructions'
 return page(session,'IRS withholding instructions',companies,actor.company,<>
  <Card title="Binding source, separate payroll work">
   <p>Only independently checked IRS originals can support these records. Agent text grants no authority. This door supports legacy marital-status and allowance instructions. Actual withholding calculation and first-required-check application remain unavailable.</p>
   <p>A current native owner must match the worker and review the exact instruction. Pending implementation requires urgent human follow-up. A release proposal does not disable an approved lock-in.</p>
   <a href={companyPath(actor.company)+'/people/'+person+'/paper-onboarding'}>Signed paper elections</a>
  </Card>
  {review && <Card title={'Review exact instruction version '+review.version}><p>Inspect the retained original, worker match, authentication reference, settings and effective date below. Review does not authorize a paycheck or certify source authenticity.</p><form method="post" action={door+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit primary>Approve exact instruction record</Submit></form></Card>}
  <Card title="Immutable instruction history">
   {!history.length && <p>No IRS instruction recorded.</p>}
   {history.map(row=><article key={row.version}><h3>Version {row.version} · {row.data.kind} · {row.approvedBy?'Human reviewed':'Pending human implementation'}</h3><p>Letter dated {row.data.letterOn}, received {row.data.receivedOn}, effective {row.data.effectiveFrom}. {row.data.kind==='release'?'Release requires this exact human approval.':`Withholding status ${row.data.filingStatus}, maximum allowances ${row.data.maximumAllowances}, minimum additional withholding $${(row.data.minimumAdditionalCents/100).toFixed(2)}.`}</p><p>Entered by {row.data.recordedByName} ({row.createdBy}) at {new Date(row.createdAt).toISOString()}; reviewed by {row.approvedBy ?? 'no reviewer'}{row.approvedAt?' at '+new Date(row.approvedAt).toISOString():''}.</p><p>Authentication: {row.data.authenticationMethod}, {redact(row.data.authenticationReference)}. Prior approved version: {row.data.priorVersion}.</p><p className="notice-text">Source quotation: {redact(row.data.original.quote)}</p><a href={door+'/original/'+row.version}>Download IRS source version {row.version}</a></article>)}
   {history[0] && !history[0].approvedBy && !review && <a className="btn" href={door+'/review'}>Review exact IRS instruction</a>}
  </Card>
  {!review && <Card title="Retain an authenticated IRS instruction"><form method="post" encType={['multipart','form-data'].join('/')} action={door}>
   <Hidden name="version" value={history[0]?.version ?? 0}/><Select name="kind" label="IRS instruction kind" choices={['2800C','modification','release']}/><Field name="employerEin" label="Employer EIN on letter"/><Field name="workerSsn" label="Worker SSN on letter" type="password"/>
   <Field name="letterOn" label="IRS letter date" type="date"/><Field name="receivedOn" label="Date received" type="date"/><Field name="effectiveFrom" label="Required effective date" type="date"/>
   <p>Legacy 2800C begins 60 days after the letter date. An authenticated modification or release is recorded effective on receipt.</p>
   <Select name="filingStatus" label="Required legacy marital status" choices={['single','married','married-withhold-single']}/><Field name="maximumAllowances" label="Maximum legacy withholding allowances" type="number" value={0}/><Field name="minimumAdditionalCents" label="Required additional withholding in cents" type="number" value={0}/>
   <Select name="authenticationMethod" label="Independent source check" choices={['agency-portal','verified-agency-correspondence']}/><Field name="authenticationReference" label="Independent agency source reference" maxLength={500}/><Field name="quote" label="Exact IRS instruction quotation" maxLength={4000}/><label className="field"><span>Retained IRS PDF (up to 384 KB)</span><input name="pdf" type="file" accept=".pdf" required/></label>
   <label className="field"><span><input name="authenticated" type="checkbox" value="true" required/> I independently checked the IRS source, worker identity and instruction. The attachment alone is not authentication.</span></label><Submit>Retain unapproved IRS instruction</Submit>
  </form></Card>}
 </>)
}
