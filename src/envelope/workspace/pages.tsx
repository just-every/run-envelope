import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page,Card,Field,Hidden,Submit,Select,companyPath } from '../pages'
import type { Allocations } from './allocations'
import { states } from '../setup'

export function allocationsPage(session:Session,companies:Company[],actor:Actor,person:Person,history:Awaited<ReturnType<Allocations['read']>>,preview?:Awaited<ReturnType<Allocations['preview']>>) {
  const base=companyPath(actor.company)+'/people/'+person.id+'/allocations'
  return page(session,`${person.name} · Work and residence`,companies,actor.company,<>
    <Card title="Effective locations and allocation preview">
      <p>Keep residence changes separate from days worked across state lines. This preview identifies wage bases; tax amounts and net pay are not calculated.</p>
      <p><a href={companyPath(actor.company)}>Company records</a> · <a href={companyPath(actor.company)+'/people/'+person.id}>Person and rates</a></p>
      <form className="field" method="get" action={base}>
        <Field name="from" label="Preview from" type="date" value={preview?.from}/><Field name="through" label="Preview through" type="date" value={preview?.through}/>
        <Submit>Preview jurisdiction allocations</Submit>
      </form>
      {preview && <>
        <h3>Allocation preview only</h3><p>Work earnings ${(preview.totalWorkCents/100).toFixed(2)}. Allocated work earnings ${(preview.allocatedWorkCents/100).toFixed(2)}. No payment is authorized.</p>
        <p>{preview.explanation}</p>
        {preview.holds.length>0&&<div role="status"><h3>Assigned unresolved work</h3>{preview.holds.map((h,i)=><p key={i}>{h.day} · {h.reason} Owner: {h.owner}.</p>)}</div>}
        {preview.allocations.map((a,i)=><article key={i}><h3>{a.day} · ${(a.earnedCents/100).toFixed(2)}</h3><p>Physical work: {a.physicalWorkState}. Residence: {a.residentState}. Localities: {a.localities.join(', ')}.</p>{a.stateWageBases.map(b=><p key={b.state}>{b.state}: ${(b.basisCents/100).toFixed(2)} wage base · {b.role}</p>)}<p>Sources: {a.sourceIds.join(', ')}. Rules: {a.ruleIds.join(', ')}.</p></article>)}
      </>}
    </Card>
    <Card title="Residence history">
      {!history.residence.length&&<p>No effective residence recorded. A work preview will assign the missing location for review.</p>}
      {history.residence.map(r=><p key={r.id+':'+r.version}>{r.id} v{r.version} · {r.data.from}–{r.data.through} · {r.data.state}, {r.data.locality} · evidence {r.data.evidence} · owner {r.data.owner}</p>)}
      <form className="field" method="post" action={base+'/residence'}>
        <Field name="id" label="Residence record ID"/><Field name="version" label="Previous residence version (0 for new)" type="number" value={0}/>
        <Field name="from" label="Residence effective from" type="date"/><Field name="through" label="Residence effective through" type="date"/>
        <Select name="state" label="Residence state" choices={states}/><Field name="locality" label="Residence municipality / district"/>
        <Field name="evidence" label="Residence source reference" maxLength={500}/><Field name="owner" label="Residence review owner"/>
        <Submit>Record effective residence</Submit>
      </form>
    </Card>
    <Card title="Sourced work days">
      {!history.work.length&&<p>No sourced work days recorded.</p>}
      {history.work.map(r=><p key={r.id+':'+r.version}>{r.id} v{r.version} · {r.data.day} · {r.data.minutes} minutes · {r.data.state}, {r.data.locality} · ${(r.data.earnedCents/100).toFixed(2)} · source {r.data.sourceRef}</p>)}
      <form className="field" method="post" action={base+'/work'}>
        <Field name="id" label="Work allocation ID"/><Field name="version" label="Previous work version (0 for new)" type="number" value={0}/>
        <Field name="day" label="Work date" type="date"/><Select name="state" label="Physical work state" choices={states}/><Field name="locality" label="Work municipality / district"/>
        <Field name="minutes" label="Actual work minutes" type="number"/><Field name="earnedCents" label="Sourced work earnings in cents" type="number"/>
        <Select name="officeState" label="Assigned employer office state" choices={states}/><Select name="nyReason" label="NY outside-office determination" choices={['not-applicable','convenience','employer-necessity','undetermined']}/>
        <Field name="evidence" label="Employer necessity evidence (when applicable)" required={false} maxLength={500}/><Field name="sourceRef" label="Approved work / earnings source reference"/>
        <Field name="owner" label="Work allocation review owner"/><Submit>Record sourced work day</Submit>
      </form>
    </Card>
    <Card title="Reciprocity elections">
      {!history.elections.length&&<p>No reciprocity election recorded. An election never removes PA local tax obligations.</p>}
      {history.elections.map(r=><p key={r.id+':'+r.version}>{r.id} v{r.version} · {r.data.form} · resident {r.data.residentState}, work {r.data.workState} · {r.data.from}–{r.data.through} · signed evidence {r.data.evidence}</p>)}
      <form className="field" method="post" action={base+'/election'}>
        <Field name="id" label="Election record ID"/><Field name="version" label="Previous election version (0 for new)" type="number" value={0}/>
        <Field name="from" label="Election effective from" type="date"/><Field name="through" label="Election effective through" type="date"/>
        <Select name="residentState" label="Election resident state" choices={['PA','NJ']}/><Select name="workState" label="Election work state" choices={['NJ','PA']}/>
        <Select name="form" label="Signed official certificate" choices={['NJ-165','REV-419EX']}/><Field name="evidence" label="Signed certificate custody reference" maxLength={500}/>
        <Field name="owner" label="Election review owner"/><Submit>Record signed election reference</Submit>
      </form>
    </Card>
    <Card title="Official allocation sources">{Object.values(history.rules).map(r=><p key={r.id}><a href={r.url} rel="noreferrer">{r.title}</a> · edition {r.id}</p>)}</Card>
  </>)
}
