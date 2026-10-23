import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Company, Person } from '../records'
import type { Actor } from '../access'
import type { Privacy } from './requests'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'

export function privacyPage(session:Session,companies:Company[],actor:Actor,people:Person[],requests:Awaited<ReturnType<Privacy['list']>>) {
  const base=companyPath(actor.company)+'/privacy'
  return page(session,'Privacy and retention',companies,actor.company,<>
    <Card title="Owner-requested erasure">
      <p className="evidence-text">Nothing is deleted automatically. Eligible local person and private records are removed in one transaction; their action audit becomes anonymous. Existing payroll evidence requires a lawful retention review and remains held. Downloads and already-filed agency records cannot be recalled locally. External provider deletion must be handled separately; a local completion is not a provider receipt.</p>
      <form method="post" action="/auth/step-up"><Hidden name="action" value="credentials:mint" /><Hidden name="returnTo" value={base} /><Submit>Send privacy confirmation</Submit></form>
      {people.length>0 && <form method="post" action={base}>
        <PersonSelect people={people} />
        <label className="field"><span><input type="checkbox" name="confirm" value="true" required /> I request erasure of this person’s eligible local data.</span></label>
        <Submit>Request eligible erasure</Submit>
      </form>}
    </Card>
    <Card title="Statutory or legal hold">
      <p className="evidence-text">Record the actual legal basis, responsible custodian and review/release date. The date never automatically releases a hold. A request remains held until you attest that release is lawful and explicitly request its cascade.</p>
      {people.length>0 && <form method="post" action={base+'/holds'}>
        <PersonSelect people={people} />
        <Field name="basis" label="Legal basis for retaining these records" maxLength={500} />
        <Field name="custodian" label="Responsible records custodian" maxLength={200} />
        <Field name="releaseDate" label="Hold review or release date" type="date" />
        <label className="field"><span><input type="checkbox" name="confirm" value="true" required /> I have verified the basis and custodian for this hold.</span></label>
        <Submit>Record lawful hold</Submit>
      </form>}
    </Card>
    <Card title="Request history">
      {requests.length ? requests.map(r=><div key={r.id}>
        <h3 className="evidence-text">{r.state==='complete'?'Eligible local erasure complete':'Held — not completed'}</h3>
        <p className="evidence-text">Request {r.id}. Requested {new Date(r.requestedAt).toISOString()}{r.completedAt ? '; completed '+new Date(r.completedAt).toISOString() : ''}.</p>
        {r.state==='held' && <><pre className="evidence-text">{JSON.stringify(r.retained,null,2)}</pre><form method="post" action={base+'/release'}>
          <Hidden name="personId" value={r.personId!} />
          <Field name="evidence" label="Verified lawful release evidence" maxLength={500} />
          <label className="field"><span><input type="checkbox" name="confirm" value="true" required /> I confirm release is lawful and request eligible deletion now.</span></label>
          <Submit>Release hold and request erasure</Submit>
        </form></>}
      </div>) : <p className="evidence-text">No privacy requests recorded.</p>}
    </Card>
  </>)
}
function PersonSelect({people}:{people:Person[]}) {
  return <label className="field"><span>Person for this privacy action</span><select name="personId" required>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
}
