import type { Session } from '../../modules/operator-auth/index.mjs'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import type { FirmDashboard } from './dashboard'
import type { BatchResult } from './batch'

export function firmPage(session: Session, view: FirmDashboard, result?: BatchResult) {
  return page(session, 'Client payroll work', view.companies, undefined, <>
    <details open={view.filter.due || Boolean(view.filter.company || view.filter.kind || view.filter.owner)}>
      <summary>Filter client work</summary>
      <form className="field" action="/app/envelope/firm" method="get">
        <Field name="day" label="Due date" type="date" value={view.filter.day} />
        <label><input name="due" type="checkbox" value="today" defaultChecked={view.filter.due} /> Due on this date</label>
        <label className="field"><span>Client</span><select aria-label="Client" name="company" defaultValue={view.filter.company}><option value="">All permitted clients</option>{view.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field"><span>Work type</span><select aria-label="Work type" name="kind" defaultValue={view.filter.kind}><option value="">All work</option>{['run','notice','registration','funding','filing'].map(k => <option key={k}>{k}</option>)}</select></label>
        <Submit>Apply filters</Submit><a href="/app/envelope/firm">Clear filters</a>
      </form>
    </details>
    {result && <Card title="Preparation results"><div role="status">{result.outcomes.map(r => <p key={r.companyId + r.groupId}>{view.companies.find(c => c.id === r.companyId)?.name ?? 'Requested client'}: {r.state === 'refused' ? `Refused: ${r.error?.replaceAll('_', ' ')}` : <a href={view.clients.find(c => c.id === r.companyId)?.canApprove ? companyPath(r.companyId) + '/pay-settings/earnings-run/' + r.id + '/review' : companyPath(r.companyId) + '/pay-settings'}>{r.state === 'prepared' ? 'Draft prepared' : 'Draft already prepared'} · review exact v{r.version}</a>}</p>)}</div></Card>}
    {!view.clients.length && <Card title="No client work in this view"><p>{view.companies.length ? 'Change the filters to see other permitted work.' : 'A client owner must grant your payroll access before any client records appear.'}</p></Card>}
    {view.clients.map(client => {
      const base = companyPath(client.id)
      return <Card key={client.id} title={client.name}>
        <p><a href={base}>Open client</a> · <a href={base + '/firm-work'}>Assigned work and handovers</a></p>
        <h3>Runs</h3>
        {!client.payrollVisible ? <p>Payroll details are outside your current scope.</p> : !client.runs.length ? <p>No retained runs in this view.</p> : client.runs.map(r => <article key={r.id}>
          <p><a href={client.canApprove ? base + '/pay-settings/earnings-run/' + r.id + '/review' : base + '/pay-settings'}>{r.periodStart}–{r.periodEnd} · pays {r.payDate} · v{r.version}</a></p>
          <p>{r.sourceStatus === 'current' ? `${r.currentApprovals} of ${r.requiredApprovals} current approvals` : 'Inputs changed; prepare a fresh version'}. {r.payable ? 'Ready for release review' : 'Payment unavailable: calculation and rail setup remain incomplete.'}</p>
          <a href={base + '/firm-work?sourceKind=earnings-run&sourceId=' + r.id + '&sourceVersion=' + r.version}>Assign run or funding work</a>
        </article>)}
        <h3>Notices</h3>
        {!client.noticesVisible ? <p>Tax notices are outside your current scope.</p> : !client.notices.length ? <p>No notices in this view.</p> : client.notices.map(n => <p key={String(n.id)}><a href={base + '/notices/' + n.id}>{String(n.reference)}</a> · <a href={base + '/firm-work?sourceKind=notice&sourceId=' + n.id + '&sourceVersion=1'}>Assign response</a></p>)}
        <h3>Registrations</h3>
        {!client.registrationsVisible ? <p>Registration details are outside your current scope.</p> : !client.registrations.length ? <p>No effective registration records.</p> : client.registrations.map(r => <p key={r.code}>{r.code}: {r.registration} · authority {r.authority} · <a href={base + '/firm-work?sourceKind=registration&sourceId=' + r.code + '&sourceVersion=' + r.version}>Assign registration or filing work</a></p>)}
        <h3>Deadlines and assigned work</h3>
        {!client.work.length ? <p>No sourced deadlines or assignments in this view.</p> : client.work.map(w => <p key={w.id}><a href={base + '/firm-work/' + w.id}>{w.data.title}</a> · {w.data.dueDate} {w.data.dueTime} {w.data.timeZone} · {w.workKind} · {w.status.replaceAll('-', ' ')}</p>)}
      </Card>
    })}
    {view.clients.some(c => c.canPrepare && c.groups.length) && <Card title="Prepare selected client runs">
      <form className="field" action="/app/envelope/firm/prepare" method="post">
        <Hidden name="requestKey" value={crypto.randomUUID()} />
        {view.clients.filter(c => c.canPrepare).map(c => <fieldset key={c.id}><legend>{c.name}</legend>{c.groups.map(g => <label key={g.id}><input type="checkbox" name="selections" value={`${c.id}:${g.id}:${g.version}`} /> {g.name} · reviewed v{g.version}</label>)}</fieldset>)}
        <Field name="periodStart" label="Period start" type="date" /><Field name="periodEnd" label="Period end" type="date" /><Field name="payDate" label="Pay date" type="date" />
        <label className="field"><span>Pay frequency</span><select name="frequency" aria-label="Pay frequency"><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice monthly</option><option value="monthly">Monthly</option></select></label>
        <Submit primary>Prepare selected drafts</Submit>
        <p>Each client is checked separately. Review each exact draft in its client before approving.</p>
      </form>
    </Card>}
  </>)
}
