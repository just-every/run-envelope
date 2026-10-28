import type { Records, Company, Input } from '../records'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import { WorkspaceStore, type Revision } from '../workspace/store'
import { Journals, ledgers, components, type Journal } from './journals'
import { PayrollError } from '../security'
interface Context { ui: boolean; post: boolean; parts: string[]; value: Input; records: Records; session: Session; companies: Company[] }
export async function accountingResponse({ ui, post, parts, value, records, session, companies }: Context) {
  if (parts[0] !== 'companies' || parts[2] !== 'accounting') return null
  const actor = await records.actor(parts[1]), journals = new Journals(new WorkspaceStore(records)), base = companyPath(actor.company) + '/accounting'
  journals.owner(actor)
  const action = parts[3], id = parts[4]
  let result: unknown, preview: Journal | undefined, review: (Revision<Journal> & { reviewToken: string }) | undefined
  if (post) {
    if (parts.length === 4 && action === 'connections') result = await journals.saveConnection(actor, value)
    else if (parts.length === 4 && ['preview', 'prepare'].includes(action)) result = await journals.prepare(actor, value, action === 'prepare')
    else if (parts.length === 6 && action === 'journals' && parts[5] === 'approve') result = await journals.decide(actor, id, value)
    else if (parts.length === 6 && action === 'journals' && parts[5] === 'post') result = await journals.post(actor, id, value)
    else throw new PayrollError('not_found', 404)
    if (ui && action === 'preview') preview = result as Journal
    else if (!ui) return Response.json(result, { headers: { 'cache-control': 'no-store' } })
    if (!preview) return new Response(null, { status: 303, headers: { location: base, 'cache-control': 'no-store' } })
  }
  if (!post && parts.length === 6 && action === 'journals' && parts[5] === 'review') review = await journals.review(actor, id)
  else if (!post && parts.length !== 3) throw new PayrollError('not_found', 404)
  const connections = await journals.connections(actor), rows = await journals.rows(actor)
  if (!ui) return Response.json(review ?? { connections, journals: rows, posting: 'unavailable' }, { headers: { 'cache-control': 'no-store' } })
  const labels = { wages: 'Wage expense', reimbursements: 'Reimbursement expense', 'employer-tax': 'Employer tax expense', 'net-funding': 'Net pay funding', 'tax-funding': 'Tax funding', deductions: 'Deduction liability' }
  const fieldValue = (key: string) => preview && (typeof value[key] === 'string' || typeof value[key] === 'number') ? value[key] as string | number : undefined
  const amount = (cents: number) => '$' + (cents / 100).toFixed(2)
  return page(session, 'Accounting settings', companies, actor.company, <>
    <Card title="Prepare a balanced journal"><p>Review proposed allocations against an earnings draft. Taxes and net pay are estimates entered here, not calculated payroll. Nothing is posted to a ledger.</p><p>Finalized payroll, provider reconciliation and ledger adapters remain unavailable. A reviewed worksheet cannot authorize payment or external posting.</p></Card>
    {review && <Card title="Review exact journal preparation"><p>Journal {review.id} · version {review.version} · earnings run {review.data.runId} version {review.data.runVersion} · mapping {review.data.connectionId} version {review.data.connectionVersion} · date {review.data.postingDate} · debit {amount(review.data.totalDebitCents)} · credit {amount(review.data.totalCreditCents)}</p><p>Proposed net {amount(review.data.proposedNetCents)} · employee taxes {amount(review.data.proposedEmployeeTaxCents)} · employer taxes {amount(review.data.proposedEmployerTaxCents)} · deductions {amount(review.data.deductionCents)} · repair owner {review.data.repairOwner}</p>{review.data.correctionOf && <p>Correction of {review.data.correctionOf}: {review.data.correctionReason}. Review the complete reversal and replacement below.</p>}{(review.data.correctionOf ? review.data.correctionLines : review.data.lines).map((line, i) => <p key={i}>{line.component} · {line.account} · debit {amount(line.debitCents)} · credit {amount(line.creditCents)} · {Object.values(line.dimensions).filter(Boolean).join(' · ')}</p>)}<form method="post" action={base + '/journals/' + review.id + '/approve'}><Hidden name="version" value={String(review.version)}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit>Approve journal preparation</Submit></form></Card>}
    {preview && <Card title="Allocation preview"><p>Known gross cash {amount(preview.grossCashCents)} · proposed net {amount(preview.proposedNetCents)} · proposed employee taxes {amount(preview.proposedEmployeeTaxCents)} · proposed employer taxes {amount(preview.proposedEmployerTaxCents)}</p><p>Debit {amount(preview.totalDebitCents)} · credit {amount(preview.totalCreditCents)}. No preparation has been saved.</p>{preview.lines.map((line, i) => <p key={i}>{labels[line.component]} · {line.account} · debit {amount(line.debitCents)} · credit {amount(line.creditCents)} · {Object.values(line.dimensions).filter(Boolean).join(' · ')}</p>)}</Card>}
    {!review && <Card title="Ledger mapping"><details open><summary>Add or edit mapping</summary><form method="post" action={base + '/connections'} className="field">
      <Field name="id" label="Mapping reference"/><Field name="version" label="Current mapping version (0 for new)" type="number" value="0"/>
      <Field name="name" label="Mapping name"/><label className="field"><span>Ledger</span><select name="ledger">{ledgers.map(l => <option key={l}>{l}</option>)}</select></label>
      <Field name="ledgerUrl" label="Ledger workspace link (HTTPS, no query)"/><Field name="repairOwner" label="Responsible repair owner"/>
      <label className="field"><span>Preparation</span><select name="enabled"><option value="true">Enabled</option><option value="false">Disconnected</option></select></label>
      <Field name="closedThrough" label="Period closed through" type="date" required={false}/>
      {components.map(component => <Field key={component} name={'account-' + component} label={labels[component] + ' account'} required={false}/>)}<p>Missing accounts stay assigned to the repair owner. Preparation requires every account.</p><Submit>Save mapping</Submit>
    </form></details>{connections.map(c => <p key={c.id}>{c.data.name} · reference {c.id} · {c.data.ledger} · version {c.version} · {c.data.enabled ? 'Preparation enabled; connection unverified' : 'Disconnected'} · repair: {c.data.repairOwner}{components.some(k => !c.data.accounts[k]) && ' · Missing accounts: ' + components.filter(k => !c.data.accounts[k]).map(k => labels[k]).join(', ')}</p>)}</Card>}
    {!review && <Card title="Journal worksheet"><form method="post" action={base + '/prepare'} className="field">
      <Field name="id" value={fieldValue("id")} label="Journal reference"/><Field name="version" label="Current journal version (0 for new)" type="number" value={fieldValue("version") ?? "0"}/>
      <Field name="connectionId" value={fieldValue("connectionId")} label="Mapping reference"/><Field name="runId" value={fieldValue("runId")} label="Earnings run reference"/><Field name="runVersion" value={fieldValue("runVersion")} label="Exact earnings run version" type="number"/>
      <Field name="postingDate" value={fieldValue("postingDate")} label="Proposed posting date" type="date"/><Field name="proposedEmployeeTaxCents" value={fieldValue("proposedEmployeeTaxCents")} label="Proposed employee taxes in cents" type="number"/><Field name="proposedEmployerTaxCents" value={fieldValue("proposedEmployerTaxCents")} label="Proposed employer taxes in cents" type="number"/>
      {[0, 1].map(i => <fieldset key={i}><legend>{i === 0 ? 'First expense allocation' : 'Additional expense allocation (optional)'}</legend><label className="field"><span>Expense type</span><select name={'split-' + i + '-component'} defaultValue={String(fieldValue('split-' + i + '-component') ?? 'wages')}><option value="wages">Wages</option><option value="reimbursements">Reimbursements</option></select></label><Field name={'split-' + i + '-amountCents'} value={fieldValue('split-' + i + '-amountCents')} label="Allocation in cents" type="number" required={i === 0}/>{['department', 'class', 'location', 'job'].map(k => <Field key={k} name={'split-' + i + '-' + k} value={fieldValue('split-' + i + '-' + k)} label={k[0].toUpperCase() + k.slice(1)} required={i === 0}/>)}</fieldset>)}<p>Allocate wages and reimbursements separately. Each total must match its earnings draft amount.</p>
      <Field name="correctionOf" value={fieldValue("correctionOf")} label="Original reviewed journal reference" required={false}/><Field name="correctionReason" value={fieldValue("correctionReason")} label="Correction reason" required={false} maxLength={500}/><button className="btn" type="submit" formAction={base + '/preview'}>Preview allocation</button><Submit>Prepare worksheet</Submit>
    </form></Card>}

    <Card title={rows.length ? 'Retained journal preparations' : 'No journal preparations yet'}>{rows.map(row => <div className="field" key={row.id + row.version}><p>{row.id} · version {row.version} · {row.approvedBy ? 'Preparation reviewed' : 'Review required'} · {row.sourcesCurrent && row.preparationCurrent ? 'Sources current' : 'Sources changed or unavailable; prepare again'}</p><p>Debit {amount(row.data.totalDebitCents)} · credit {amount(row.data.totalCreditCents)} · proposed net {amount(row.data.proposedNetCents)}</p><p>Posting unresolved · repair owner: {row.data.repairOwner}</p>{row.data.correctionOf && <p>Corrects {row.data.correctionOf}: {row.data.correctionReason}</p>}<a href={row.data.ledgerUrl} target="_blank" rel="noreferrer noopener">Open ledger workspace</a>{!row.approvedBy && row.sourcesCurrent && row.preparationCurrent && <a className="btn" href={base + '/journals/' + row.id + '/review'}>Review exact preparation</a>}</div>)}</Card>
  </>)
}
