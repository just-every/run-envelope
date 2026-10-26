import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page,Card,Field,Hidden,Select,Submit,companyPath } from '../pages'
import { directories, type NewHireReporting, type HireReport } from './new-hire-reporting'
import type { Revision } from '../workspace/store'
export function newHirePage(session:Session, companies:Company[], actor:Actor,person:Person,rows:Awaited<ReturnType<NewHireReporting['reports']>>, review?:Revision<HireReport>&{reviewToken:string},packet?:Awaited<ReturnType<NewHireReporting['transfer']>>,selectedDirectory='OH',selectedRepair?:string) {
 const directory=directories.find(d=>d.code===selectedDirectory) ?? directories.find(d=>d.code==='OH')!
 const repair=rows.find(r=>r.id===selectedRepair && ['draft','rejected'].includes(r.data.status) && rows.find(other=>other.id===r.id)?.version===r.version)
 const base=companyPath(actor.company)+'/people/'+person.id+'/new-hire-reports'
 return page(session,person.name+' · New-hire reporting',companies,actor.company,<>
  <Card title="Reviewed reporting, separate from onboarding">
   <p>Employee reports are prepared for explicit owner transfer to the official portal. No report is sent automatically. Portal transfer does not mean agency acceptance. Confirm the actual agency response below.</p>
   <p>Deadlines use calendar dates in UTC. The selected directory’s published calendar deadline is retained on the report. Rehire uses the new start date. The owner is responsible for repair. Unmapped directory requirements remain visible in nationwide coverage.</p>
   <p><a href={companyPath(actor.company)+'/new-hire-coverage'}>Nationwide coverage and remaining directories</a> · <a href={companyPath(actor.company)+'/new-hire-elections'}>Multistate reporting election</a></p>
  </Card>
  {packet && <Card title="Exact portal transfer prepared"><p>Submission is not claimed. Use the approved employer account at <a href={packet.directoryUrl} rel="noreferrer">Selected official reporting directory</a>.</p><dl className="evidence-text">{Object.entries(packet.fields).map(([k,v])=><div key={k}><dt>{fieldLabels[k] ?? k.replace(/([A-Z])/g,' $1')}</dt><dd>{v}</dd></div>)}</dl></Card>}
  {review && <Card title="Review exact report"><p>{review.data.state} directory · Work state {review.data.workState} · {review.data.eventType} · {review.data.hireDate} · Election {review.data.electionId || 'none'} version {review.data.electionVersion} · Due {review.data.dueOn} · Repair owner {review.data.repairOwnerName}</p><dl className="evidence-text">{Object.entries(review.data.fields).map(([k,v])=><div key={k}><dt>{fieldLabels[k] ?? k.replace(/([A-Z])/g,' $1')}</dt><dd>{v}</dd></div>)}</dl><form method="post" action={base+'/'+review.id+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit primary>Approve exact portal transfer</Submit></form></Card>}
  <Card title="Reports and repair">
   {!rows.length && <p>No state reports prepared. Completing onboarding does not file a report.</p>}
   {rows.filter((r,i)=>rows.findIndex(other=>other.id===r.id)===i).map(r=><article key={r.id}>
    <h3>{r.data.state} · {r.data.eventType} · {r.data.hireDate}</h3><p>{r.data.status} · Due {r.data.dueOn}{r.overdue?' · Overdue':''}. Repair owner: {r.data.repairOwnerName}. Version {r.version}.</p>
    {r.data.history.map(h=><p className="evidence-text" key={h.receiptId}>Agency response: {h.response} · Reported {h.reportingDate} · Reference {h.receiptId} · Recorded by {h.recordedBy}.</p>)}
    {r.data.status==='draft' && !r.approvedBy && r.sourcesCurrent ?<a className="btn" href={base+'/'+r.id+'/review'}>Review exact report</a>:null}
    {r.data.status==='draft' && r.canTransfer && <form method="post" action={base+'/'+r.id+'/transfer'}><Hidden name="version" value={r.version}/><Submit>Prepare approved portal transfer</Submit></form>}
    {r.data.status==='draft' && (!r.sourcesCurrent || (r.approvedBy && !r.canTransfer)) && <p role="alert">Transfer held: current sources and fresh owner approval are required. <a href={base+'?directory='+r.data.state+'&repair='+r.id}>Prepare current report again</a></p>}
    {r.data.status==='transferred' && <form className="field" method="post" action={base+'/'+r.id+'/response'}><Hidden name="version" value={r.version}/><Field name="receiptId" label="Agency receipt reference"/><Select name="response" label="Actual agency response" choices={['accepted','rejected']}/><Field name="reportingDate" label="Actual reporting date" type="date"/><Field name="agencyResponse" label="Retained agency response evidence" maxLength={1000}/><Submit>Record observed agency response</Submit></form>}
    {r.data.status==='rejected' && <p role="alert">Repair required. Correct the source fields, then review the new exact version. The rejected report stays in history. <a className="btn" href={base+'?directory='+r.data.state+'&repair='+r.id}>Repair rejected report</a></p>}
   </article>)}
  </Card>
  <Card title="Choose reporting directory"><form className="field" method="get" action={base}><Select name="directory" label="Reporting directory" value={directory.code} choices={directories.map(d=>d.code)} labels={directories.map(d=>d.name)}/><Submit>Choose directory fields</Submit></form></Card>
  <Card title={(repair?'Repair ':'Prepare ')+directory.name+' employee report'}>
   {directory.implemented ? <form className="field" method="post" action={repair?base+'/'+repair.id+'/repair':base}>
    {repair && <Hidden name="version" value={repair.version}/>}
    <p>Source updated {directory.updated}. Calendar deadline: {directory.deadlineDays} days. Required source fields are shown below. Optional worker fields are omitted. <a href={'additionalSource' in directory ? String(directory.additionalSource) : 'https://acf.gov/ocse/contact-information/state-new-hire-reporting-contacts-and-program-requirements'}>Official requirements</a></p>
    <Select name="eventType" label="Employment event" choices={['hire','rehire']} value={repair?.data.eventType}/><Hidden name="state" value={directory.code}/><Select name="workState" label="Actual state of hire" choices={directories.map(d=>d.code)} value={repair?.data.workState ?? directory.code}/><Field name="hireDate" label="First day of this employment" type="date" value={repair?.data.hireDate}/>
    {directory.requiredFields.map(field=><Field key={field} name={field} value={repair?.data.fields[field]} label={fieldLabels[field] ?? field.replace(/([A-Z])/g,' $1')} type={field.endsWith('Ssn')||field.endsWith('Fein')?'password':field==='employeeDateOfBirth'?'date':'text'} required={field!=='employeeMiddleName'} maxLength={field.toLowerCase().endsWith('address')?500:120}/>)}
    {directory.requiredFields.some(f=>f.includes('Insurance')) && <p>Health availability uses yes or no. If no dependent health benefits exist, enter not-eligible for the eligibility date.</p>}
    {directory.requiredFields.includes('workerType') && <p>Worker type is employee. Contractor reporting is a separate obligation.</p>}
    <Field name="electionId" label="Approved multistate election ID (optional)" value={repair?.data.electionId} required={false}/><Submit primary={!review}>{repair?'Prepare repaired version':'Prepare for exact review'}</Submit>
   </form> : <p role="alert">Reporting unavailable: {directory.gap} The obligation remains open; no submission is claimed.</p>}
  </Card>
 </>)
}
export function coveragePage(session:Session,companies:Company[],actor:Actor,result:ReturnType<typeof import('./new-hire-reporting').coverage>) {
 return page(session,'New-hire coverage',companies,actor.company,<Card title="All 50 states and DC remain in scope"><p>{result.passing} of {result.total} directory field schemas mapped; independent agency verification remains unproved. Nationwide completeness fails until every listed directory is mapped and proven.</p><a href={result.source}>Federal OCSS source matrix</a><ul>{result.directories.map(d=><li key={d.code}>{d.name}: {d.schema}. Source updated {d.updated}. {d.gap}</li>)}</ul></Card>)
}
export function electionContent(session:Session,companies:Company[],actor:Actor,rows:Revision[],review?:Revision&{reviewToken:string}) {
 const base=companyPath(actor.company)+'/new-hire-elections'
 return page(session,'Multistate reporting election',companies,actor.company,<>
 <Card title="Registered election, explicit human review"><p>Record an actual federal multistate registration confirmation. This record does not register an election or send worker data. Choose a mapped destination and record the actual confirmed work-state scope. All 51 directories remain coverage obligations.</p>
 {review && <><dl><dt>Registered directory</dt><dd>{String(review.data.state)}</dd><dt>Confirmed work-state scope</dt><dd>{Array.isArray(review.data.workStates)?review.data.workStates.join(', '):'Unknown'}</dd><dt>Effective date</dt><dd>{String(review.data.effectiveFrom)}</dd><dt>Federal registration confirmation</dt><dd>{String(review.data.confirmation)}</dd></dl><form method="post" action={base+'/'+review.id+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit>Approve exact election record</Submit></form></>}
 {rows.map(r=><p key={r.version}>{r.id} v{r.version} · {r.approvedBy?'Reviewed':'Review required'} · {String(r.data.effectiveFrom)} {!r.approvedBy && <a href={base+'/'+r.id+'/review'}>Review exact election</a>}</p>)}
 <form className="field" method="post" action={base}><Select name="state" label="Registered reporting directory" choices={directories.filter(d=>d.implemented).map(d=>d.code)}/><Field name="workStates" label="Confirmed work-state scope (comma separated codes)"/><Hidden name="version" value={rows[0]?.version ?? 0}/><Field name="effectiveFrom" label="Confirmed election effective date" type="date"/><Field name="confirmation" label="Federal registration confirmation reference" maxLength={500}/><Submit primary>Record actual election confirmation</Submit></form></Card></>)
}

const fieldLabels:Record<string,string>={employeeFirstName:'Employee first name',employeeMiddleName:'Employee middle name',employeeLastName:'Employee last name',employeeAddress:'Employee complete mailing address',employeeSsn:'Employee SSN (9 digits)',employeeDateOfBirth:'Employee date of birth',employerName:'Employer legal name',employerAddress:'Employer complete mailing address',employerFein:'Employer FEIN (9 digits)',healthInsuranceEligibleOn:'Health coverage eligibility date or not-eligible',stateEmployerId:'State employer account ID',workerType:'Worker type (employee)'}
