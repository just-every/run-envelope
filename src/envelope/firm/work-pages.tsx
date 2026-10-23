import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company } from '../records'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import type { FirmWorkItem, FirmSettings, FirmPerson, FirmWorkHistory } from './work-types'

const personName = (people: FirmPerson[], id: string | null) => !id ? 'Client owner' : people.find(p => p.id === id)?.name ?? 'Former staff member'
const PersonSelect = ({ people, name, label, value }: { people: FirmPerson[]; name: string; label: string; value?: string }) => <label className="field"><span>{label}</span><select name={name} defaultValue={value} required>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
export function firmSettingsPage(session: Session, companies: Company[], actor: Actor, settings: FirmSettings) {
  return page(session, 'Practice handoff settings', companies, actor.company, <Card title="Blotter destination"><form className="field" method="post" action={companyPath(actor.company) + '/firm-settings'}>
    <Hidden name="version" value={settings.version} /><Field name="blotterOrigin" label="Your Blotter website" type="url" value={settings.blotterOrigin} />
    <p>People record the handover in Blotter themselves. This setting permits job links to that website and sends no payroll data.</p><Submit>Save destination</Submit>
  </form></Card>)
}
export function firmWorkPage(session: Session, companies: Company[], actor: Actor, items: FirmWorkItem[], people: FirmPerson[], query: URLSearchParams) {
  const base = companyPath(actor.company), sourceKind = query.get('sourceKind'), sourceId = query.get('sourceId'), sourceVersion = query.get('sourceVersion')
  const canWrite = actor.grant.role === 'owner' || actor.grant.actions.includes('records:write')
  return page(session, 'Assigned payroll work', companies, actor.company, <>
    <p><a href="/app/envelope/firm">All client work</a>{actor.grant.role === 'owner' && <> · <a href={base + '/firm-settings'}>Practice handoff settings</a></>}</p>
    <Card title={items.length ? 'Current assignments' : 'No assignments yet'}>{items.map(w => <p key={w.id}><a href={base + '/firm-work/' + w.id}>{w.data.title}</a> · {personName(people,w.assigneeId)} · {w.data.dueDate} {w.data.dueTime} {w.data.timeZone} · {w.status.replaceAll('-', ' ')}</p>)}{!items.length && <p>Assign work from a run, notice or registration in the client workspace.</p>}</Card>
    {canWrite && sourceKind && sourceId && sourceVersion && <Card title="Assign sourced work"><form className="field" action={base + '/firm-work'} method="post">
      <Hidden name="sourceKind" value={sourceKind} /><Hidden name="sourceId" value={sourceId} /><Hidden name="sourceVersion" value={sourceVersion} />
      <label className="field"><span>Work type</span><select name="workKind">{(sourceKind === 'earnings-run' ? ['run','funding'] : sourceKind === 'notice' ? ['notice'] : ['registration','filing']).map(k => <option key={k}>{k}</option>)}</select></label>
      <Hidden name="action" value={sourceKind === 'earnings-run' ? 'rates:propose' : sourceKind === 'notice' ? 'notices:write' : 'records:write'} />
      <Field name="title" label="Work to do" /><Field name="details" label="Handover notes" maxLength={2000} /><Field name="dueDate" label="Due date" type="date" /><Field name="dueTime" label="Due time" type="time" />
      <Field name="timeZone" label="Deadline time zone" value="America/New_York" /><Field name="evidenceRef" label="Deadline source reference" maxLength={1000} />
      <PersonSelect people={people} name="assigneeId" label="Responsible person" /><PersonSelect people={people} name="backupId" label="Backup person" />
      <Submit primary>Assign this work</Submit>
    </form></Card>}
  </>)
}
export function firmWorkDetail(session: Session, companies: Company[], actor: Actor, item: FirmWorkItem, people: FirmPerson[], history: FirmWorkHistory[], settings: FirmSettings) {
  const base = companyPath(actor.company) + '/firm-work/' + item.id, canWrite = actor.grant.role === 'owner' || actor.grant.actions.includes('records:write')
  const source = companyPath(actor.company) + (item.sourceKind === 'notice' ? '/notices/' + item.sourceId : item.sourceKind === 'earnings-run' ? '/pay-settings' : '/firm-work')
  return page(session, item.data.title, companies, actor.company, <>
    <Card title="Current handover"><p>{item.data.details}</p><p>Due {item.data.dueDate} at {item.data.dueTime} {item.data.timeZone}. Source: {item.data.evidenceRef}</p>
      <p>Responsible: {personName(people,item.assigneeId)}. Backup: {personName(people,item.backupId)}.</p><p>{item.status.replaceAll('-', ' ')} · v{item.version} · {item.sourceCurrent ? 'source version current' : 'source changed; review again'}</p><p><a href={source}>Open source in this client</a> · <a href="/app/envelope/firm">All client work</a></p>
      {item.data.handoff && <p><a href={item.data.handoff.jobUrl} rel="noreferrer" target="_blank">Open recorded Blotter job</a>. Human-recorded handoff; payroll approval remains in Envelope.</p>}
    </Card>
    {canWrite && <Card title="Delegate work"><form className="field" method="post" action={base + '/delegate'}><Hidden name="version" value={item.version} /><PersonSelect people={people} name="assigneeId" label="Responsible person" value={item.assigneeId} /><PersonSelect people={people} name="backupId" label="Backup person" value={item.backupId ?? undefined} /><Submit>Record delegation</Submit></form></Card>}
    {canWrite && <Card title="Record a human Blotter handoff">{settings.blotterOrigin ? <form className="field" method="post" action={base + '/handoff'}>
      <Hidden name="version" value={item.version} /><p>Open your <a href={settings.blotterOrigin} target="_blank" rel="noreferrer">Blotter workspace</a>, create or update the client job, then record its link here. Share the client, deadline and protected source link; the recipient signs in separately to read payroll.</p>
      <Field name="jobUrl" label="Blotter job link" type="url" maxLength={1000} /><PersonSelect people={people} name="recipientId" label="Receiving person" value={item.assigneeId} /><Field name="evidenceRef" label="Handoff reference" maxLength={1000} /><Submit>Record pending handoff</Submit>
    </form> : <p>The client owner must configure the Blotter destination in practice handoff settings.</p>}</Card>}
    {item.assigneeId === session.operator.id && item.status === 'pending-handoff' && <Card title="Acknowledge handover"><form className="field" method="post" action={base + '/acknowledge'}><Hidden name="version" value={item.version} /><Field name="evidenceRef" label="Receipt reference" maxLength={1000} /><Submit primary>I received this work</Submit></form></Card>}
    <details><summary>Handover history</summary>{history.map(entry => <p key={entry.id}>{new Date(entry.occurredAt).toISOString().replace('T',' ').slice(0,16)} UTC · {entry.actorName ?? 'Authority change for ' + (entry.authoritySubjectName ?? 'former staff')} · {entry.event.replaceAll('.', ' ')} · assigned to {entry.assigneeName}{entry.backupName ? ', backup ' + entry.backupName : ''} · v{entry.version}</p>)}</details>
  </>)
}
