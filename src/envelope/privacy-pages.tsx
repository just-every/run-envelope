import type { Session } from '../modules/operator-auth/index.mjs'
import type { Actor } from './access'
import type { Company } from './records'
import { page, Card, Field, Hidden, Submit, companyPath } from './pages'
import type { WorkerPrivacy } from './worker-privacy'
type State=Awaited<ReturnType<WorkerPrivacy['read']>>
export function privacyPage(session:Session,companies:Company[],actor:Actor,state:State|undefined,requests:Record<string,unknown>[]) {
 const base=companyPath(actor.company),door=state?base+'/people/'+state.personId+'/privacy':''
 const binding=()=>state&&<><Hidden name="fingerprint" value={state.fingerprint}/><Hidden name="version" value={state.version}/></>
 const consent=()=> <label className="field"><span><input type="checkbox" name="consent" value="true" required/> I explicitly authorize this record-specific action.</span></label>
 const selection=()=>[...new Set(state?.retained.map(record=>record.table))].map(table=><details key={table}><summary>{table}: {state?.retained.filter(record=>record.table===table).length} records</summary>{state?.retained.filter(record=>record.table===table).map(record=><label className="field" key={record.id}><span><input type="checkbox" name="records" value={record.id}/> {JSON.stringify(record.key)}</span><span>Fields: {record.fields.join(', ')}. {record.legalBasis}. Custodian: {record.custodian}. Earliest release UTC: {record.earliestReleaseAt??'Unclassified; release refused'}. {record.released?'Explicitly released':'Held'}.</span></label>)}</details>)
 return page(session,'Privacy and retention',companies,actor.company,<div className="evidence-text">
  <p>Downloaded copies and already-filed agency records are outside local recall. External provider deletion requires a separate authorized request; this screen sends none.</p>
  <p>Custody clock source: server Date.now(), rendered in UTC. Earliest release instants are UTC.</p>
  <p>Fresh native email confirmation is required for each sensitive action. No timer releases a hold or deletes data.</p>
  <a className="btn" href={base+'/privacy-requests'}>Request history</a>
  {state&&<>
   <Card title={'Local inventory: '+state.status}><p>{state.retained.length} dependent records. Retained data is restricted to the native owner and every owner access is audited. While an erasure request is held, company access is paused for other identities to protect shared derivatives.</p>
    <form method="post" action={door+'/request'}>{binding()}{consent()}<Submit>Request erasure</Submit></form>
   </Card>
   <Card title="Review statutory retention"><form method="post" action={door+'/retain'}>{binding()}{selection()}<Field name="legalBasis" label="Record-specific legal basis" maxLength={1000}/><Field name="custodian" label="Custodian"/><Field name="earliestReleaseAt" label="Earliest release UTC instant" value=""/>{consent()}<Submit>Classify selected holds</Submit></form></Card>
   <Card title="Release selected records"><form method="post" action={door+'/release'}>{binding()}{selection()}<Field name="legalBasis" label="Lawful release reason" maxLength={1000}/>{consent()}<Submit>Release selected holds</Submit></form></Card>
   <Card title="Complete local erasure"><form method="post" action={base+'/people/'+state.personId+'/erase'}>{binding()}{selection()}{consent()}<p>Select every dependent record. Unclassified, changed or unreleased records refuse erasure.</p><Submit>Erase selected local records</Submit></form></Card>
  </>}
  <Card title="Durable erasure requests">{requests.length?requests.map(request=><p key={String(request.id)}>Request {String(request.id)}: {String(request.status)}. Created {new Date(Number(request.createdAt)).toISOString()}. {request.status==='completed'?<>Completed {new Date(Number(request.completedAt)).toISOString()}; {String(request.recordsDeleted)} local records deleted. Worker identifier removed.</>:<a href={base+'/people/'+String(request.personId)+'/privacy'}>Review held records</a>}</p>):<p>No erasure requests. No deletion has been performed.</p>}</Card>
 </div>)
}
