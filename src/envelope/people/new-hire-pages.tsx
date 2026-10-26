import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page,Card,Field,Hidden,Select,Submit,companyPath } from '../pages'
import type { NewHireReporting, HireReport } from './new-hire-reporting'
import type { Revision } from '../workspace/store'
export function newHirePage(session:Session, companies:Company[], actor:Actor,person:Person,rows:Awaited<ReturnType<NewHireReporting['reports']>>, review?:Revision<HireReport>&{reviewToken:string},packet?:Awaited<ReturnType<NewHireReporting['transfer']>>) {
 const base=companyPath(actor.company)+'/people/'+person.id+'/new-hire-reports'
 return page(session,person.name+' · New-hire reporting',companies,actor.company,<>
  <Card title="Reviewed reporting, separate from onboarding">
   <p>Ohio employee reports are prepared for explicit owner transfer to the official portal. No report is sent automatically. Portal transfer does not mean agency acceptance. Confirm the actual agency response below.</p>
   <p>Deadlines use calendar dates in UTC. Ohio reports are due within 20 days of hire. Rehire uses the new start date. The owner is responsible for repair. Other directory schemas remain unavailable.</p>
   <p><a href={companyPath(actor.company)+'/new-hire-coverage'}>Nationwide coverage and remaining directories</a> · <a href={companyPath(actor.company)+'/new-hire-elections'}>Multistate reporting election</a></p>
  </Card>
  {packet && <Card title="Exact portal transfer prepared"><p>Submission is not claimed. Use the approved employer account at <a href={packet.directoryUrl} rel="noreferrer">Ohio New Hire Reporting Center</a>.</p><dl className="evidence-text">{Object.entries(packet.fields).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></Card>}
  {review && <Card title="Review exact report"><p>{review.data.eventType} · {review.data.hireDate} · Due {review.data.dueOn} · Repair owner {review.data.repairOwner}</p><dl className="evidence-text">{Object.entries(review.data.fields).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><form method="post" action={base+'/'+review.id+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit primary>Approve exact portal transfer</Submit></form></Card>}
  <Card title="Reports and repair">
   {!rows.length && <p>No state reports prepared. Completing onboarding does not file a report.</p>}
   {rows.filter((r,i)=>rows.findIndex(other=>other.id===r.id)===i).map(r=><article key={r.id}>
    <h3>{r.data.eventType} · {r.data.hireDate}</h3><p>{r.data.status} · Due {r.data.dueOn}{r.overdue?' · Overdue':''}. Repair owner: {r.data.repairOwner}. Version {r.version}.</p>
    {r.data.history.map(h=><p className="evidence-text" key={h.receiptId}>Agency response: {h.response} · Reported {h.reportingDate} · Reference {h.receiptId} · Recorded by {h.recordedBy}.</p>)}
    {r.data.status==='draft' && (!r.approvedBy?<a className="btn" href={base+'/'+r.id+'/review'}>Review exact report</a>:<form method="post" action={base+'/'+r.id+'/transfer'}><Hidden name="version" value={r.version}/><Submit>Prepare approved portal transfer</Submit></form>)}
    {r.data.status==='transferred' && <form className="field" method="post" action={base+'/'+r.id+'/response'}><Hidden name="version" value={r.version}/><Field name="receiptId" label="Agency receipt reference"/><Select name="response" label="Actual agency response" choices={['accepted','rejected']}/><Field name="reportingDate" label="Actual reporting date" type="date"/><Field name="agencyResponse" label="Retained agency response evidence" maxLength={1000}/><Submit>Record observed agency response</Submit></form>}
    {r.data.status==='rejected' && <p role="alert">Repair required. Submit corrected fields through the documented people API, then review the new exact version. The rejected report stays in history.</p>}
   </article>)}
  </Card>
  <Card title="Prepare Ohio employee report"><form className="field" method="post" action={base}>
   <Select name="eventType" label="Employment event" choices={['hire','rehire']}/><Hidden name="state" value="OH"/><Field name="hireDate" label="First day of this employment" type="date"/>
   <Field name="employeeFirstName" label="Employee first name"/><Field name="employeeMiddleName" label="Employee middle name" required={false}/><Field name="employeeLastName" label="Employee last name"/><Field name="employeeAddress" label="Employee complete mailing address" maxLength={500}/><Field name="employeeSsn" label="Employee SSN (9 digits)" type="password"/><Field name="employeeDateOfBirth" label="Employee date of birth" type="date"/>
   <Field name="employerName" label="Employer legal name"/><Field name="employerAddress" label="Employer complete mailing address" maxLength={500}/><Field name="employerFein" label="Employer FEIN (9 digits)" type="password"/><Field name="electionId" label="Approved multistate election ID (optional)" required={false}/><Submit primary={!review}>Prepare for exact review</Submit>
  </form></Card>
 </>)
}
export function coveragePage(session:Session,companies:Company[],actor:Actor,result:ReturnType<typeof import('./new-hire-reporting').coverage>) {
 return page(session,'New-hire coverage',companies,actor.company,<Card title="All 50 states and DC remain in scope"><p>{result.passing} of {result.total} directory schemas implemented. Nationwide completeness fails until every listed directory is mapped and proven.</p><a href={result.source}>Federal OCSS source matrix</a><ul>{result.directories.map(d=><li key={d.code}>{d.name}: {d.schema}. Source updated {d.updated}.</li>)}</ul></Card>)
}
export function electionContent(session:Session,companies:Company[],actor:Actor,rows:Revision[],review?:Revision&{reviewToken:string}) {
 const base=companyPath(actor.company)+'/new-hire-elections'
 return page(session,'Multistate reporting election',companies,actor.company,<>
 <Card title="Registered election, explicit human review"><p>Record an actual federal multistate registration confirmation. This record does not register an election or send worker data. Ohio is the implemented destination; all other directories remain coverage obligations.</p>
 {review && <><p className="evidence-text">{JSON.stringify(review.data)}</p><form method="post" action={base+'/'+review.id+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit>Approve exact election record</Submit></form></>}
 {rows.map(r=><p key={r.version}>{r.id} v{r.version} · {r.approvedBy?'Reviewed':'Review required'} · {String(r.data.effectiveFrom)} {!r.approvedBy && <a href={base+'/'+r.id+'/review'}>Review exact election</a>}</p>)}
 <form className="field" method="post" action={base}><Hidden name="state" value="OH"/><Hidden name="version" value={rows[0]?.version ?? 0}/><Field name="effectiveFrom" label="Confirmed election effective date" type="date"/><Field name="confirmation" label="Federal registration confirmation reference" maxLength={500}/><Submit primary>Record actual election confirmation</Submit></form></Card></>)
}
