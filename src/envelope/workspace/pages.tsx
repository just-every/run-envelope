import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page, Card, Field, Hidden, Submit, Select, companyPath } from '../pages'
import type { Allocations } from './allocations'
import { Schedules, payFrequencies, timeZones } from './schedules'
import { Rules, ruleFamilies } from './rules'
import { states } from '../setup'
const NamedSelect = ({
  name,
  label,
  choices,
  value,
  required = true,
}: {
  name: string
  label: string
  choices: { id: string; name: string }[]
  value?: string
  required?: boolean
}) => (
  <label className="field">
    <span>{label}</span>
    <select name={name} aria-label={label} defaultValue={value} required={required}>
      {choices.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  </label>
)
const RecordFields = ({ row }: { row?: { id: string; version: number } }) => (
  <>
    <Hidden name="id" value={row?.id ?? crypto.randomUUID()} />
    <Hidden name="version" value={row?.version ?? 0} />
    {row && <p>Revising version {row.version}. The previous version will be retained.</p>}
  </>
)

export function allocationsPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  person: Person,
  history: Awaited<ReturnType<Allocations['read']>>,
  preview?: Awaited<ReturnType<Allocations['preview']>>,
  edit?: { kind: string; id: string },
) {
  const base = companyPath(actor.company) + '/people/' + person.id + '/allocations'
  const residence =
      edit?.kind === 'residence'
        ? history.residence.find((r) => r.id === edit.id)
        : undefined,
    work = edit?.kind === 'work' ? history.work.find((r) => r.id === edit.id) : undefined,
    election =
      edit?.kind === 'election'
        ? history.elections.find((r) => r.id === edit.id)
        : undefined
  return page(
    session,
    `${person.name} · Work and residence`,
    companies,
    actor.company,
    <>
      <Card title="Effective locations and allocation preview">
        <p>
          Keep residence changes separate from days worked across state lines. This
          preview identifies wage bases; tax amounts and net pay are not calculated.
        </p>
        <p>
          <a href={companyPath(actor.company)}>Company records</a> ·{' '}
          <a href={companyPath(actor.company) + '/people/' + person.id}>
            Person and rates
          </a>
        </p>
        <form className="field" method="get" action={base}>
          <Field name="from" label="Preview from" type="date" value={preview?.from} />
          <Field
            name="through"
            label="Preview through"
            type="date"
            value={preview?.through}
          />
          <Submit>Preview jurisdiction allocations</Submit>
        </form>
        {preview && (
          <>
            <h3>Allocation preview only</h3>
            <p>
              Work earnings ${(preview.totalWorkCents / 100).toFixed(2)}. Allocated work
              earnings ${(preview.allocatedWorkCents / 100).toFixed(2)}. No payment is
              authorized.
            </p>
            <p>{preview.explanation}</p>
            {preview.holds.length > 0 && (
              <div role="status">
                <h3>Assigned unresolved work</h3>
                {preview.holds.map((h, i) => (
                  <p key={i}>
                    {h.day} · {h.reason} Owner: {h.owner}.
                  </p>
                ))}
              </div>
            )}
            {preview.allocations.map((a, i) => (
              <article key={i}>
                <h3>
                  {a.day} · ${(a.earnedCents / 100).toFixed(2)}
                </h3>
                <p>
                  Physical work: {a.physicalWorkState}. Residence: {a.residentState}.
                  Localities: {a.localities.join(', ')}.
                </p>
                {a.stateWageBases.map((b) => (
                  <p key={b.state}>
                    {b.state}: ${(b.basisCents / 100).toFixed(2)} wage base · {b.role}
                  </p>
                ))}
                <p>
                  Sources: {a.sourceIds.join(', ')}. Rules: {a.ruleIds.join(', ')}.
                </p>
              </article>
            ))}
          </>
        )}
      </Card>
      <Card title="Residence history">
        {!history.residence.length && (
          <p>
            No effective residence recorded. A work preview will assign the missing
            location for review.
          </p>
        )}
        {history.residence.map((r) => (
          <p key={r.id + ':' + r.version}>
            {r.id} v{r.version} · {r.data.from}–{r.data.through} · {r.data.state},{' '}
            {r.data.locality} · evidence {r.data.evidence} · owner {r.data.owner} ·{' '}
            <a href={base + '?edit=residence&id=' + r.id}>Revise residence dates</a>
          </p>
        ))}
        <form className="field" method="post" action={base + '/residence'}>
          <RecordFields row={residence} />
          <Field
            name="from"
            label="Residence effective from"
            type="date"
            value={residence?.data.from}
          />
          <Field
            name="through"
            label="Residence effective through"
            type="date"
            value={residence?.data.through}
          />
          <Select
            name="state"
            label="Residence state"
            choices={states}
            value={residence?.data.state}
          />
          <Field
            name="locality"
            label="Residence municipality / district"
            value={residence?.data.locality}
          />
          <Field
            name="evidence"
            label="Residence source reference"
            maxLength={500}
            value={residence?.data.evidence}
          />
          <Field
            name="owner"
            label="Residence review owner"
            value={residence?.data.owner ?? session.operator.displayName}
          />
          <Submit>Record effective residence</Submit>
        </form>
      </Card>
      <Card title="Sourced work days">
        {!history.work.length && <p>No sourced work days recorded.</p>}
        {history.work.map((r) => (
          <p key={r.id + ':' + r.version}>
            {r.id} v{r.version} · {r.data.day} · {r.data.minutes} minutes · {r.data.state}
            , {r.data.locality} · ${(r.data.earnedCents / 100).toFixed(2)} · source{' '}
            {r.data.sourceRef} ·{' '}
            <a href={base + '?edit=work&id=' + r.id}>Revise work day</a>
          </p>
        ))}
        <form className="field" method="post" action={base + '/work'}>
          <RecordFields row={work} />
          <Field name="day" label="Work date" type="date" value={work?.data.day} />
          <Select
            name="state"
            label="Physical work state"
            choices={states}
            value={work?.data.state}
          />
          <Field
            name="locality"
            label="Work municipality / district"
            value={work?.data.locality}
          />
          <Field
            name="minutes"
            label="Actual work minutes"
            type="number"
            value={work?.data.minutes}
          />
          <Field
            name="earnedCents"
            label="Sourced work earnings in cents"
            type="number"
            value={work?.data.earnedCents}
          />
          <Select
            name="officeState"
            label="Assigned employer office state"
            choices={states}
            value={work?.data.officeState}
          />
          <Select
            name="nyReason"
            label="NY outside-office determination"
            choices={[
              'not-applicable',
              'convenience',
              'employer-necessity',
              'undetermined',
            ]}
            value={work?.data.nyReason}
          />
          <Field
            name="evidence"
            label="Employer necessity evidence (when applicable)"
            required={false}
            maxLength={500}
            value={work?.data.evidence}
          />
          <Field
            name="sourceRef"
            label="Approved work / earnings source reference"
            value={work?.data.sourceRef}
          />
          <Field
            name="owner"
            label="Work allocation review owner"
            value={work?.data.owner ?? session.operator.displayName}
          />
          <Submit>Record sourced work day</Submit>
        </form>
      </Card>
      <Card title="Reciprocity elections">
        {!history.elections.length && (
          <p>
            No reciprocity election recorded. An election never removes PA local tax
            obligations.
          </p>
        )}
        {history.elections.map((r) => (
          <p key={r.id + ':' + r.version}>
            {r.id} v{r.version} · {r.data.form} · resident {r.data.residentState}, work{' '}
            {r.data.workState} · {r.data.from}–{r.data.through} · signed evidence{' '}
            {r.data.evidence} ·{' '}
            <a href={base + '?edit=election&id=' + r.id}>Revise election</a>
          </p>
        ))}
        <form className="field" method="post" action={base + '/election'}>
          <RecordFields row={election} />
          <Field
            name="from"
            label="Election effective from"
            type="date"
            value={election?.data.from}
          />
          <Field
            name="through"
            label="Election effective through"
            type="date"
            value={election?.data.through}
          />
          <Select
            name="residentState"
            label="Election resident state"
            choices={['PA', 'NJ']}
            value={election?.data.residentState}
          />
          <Select
            name="workState"
            label="Election work state"
            choices={['NJ', 'PA']}
            value={election?.data.workState}
          />
          <Select
            name="form"
            label="Signed official certificate"
            choices={['NJ-165', 'REV-419EX']}
            value={election?.data.form}
          />
          <Field
            name="evidence"
            label="Signed certificate custody reference"
            maxLength={500}
            value={election?.data.evidence}
          />
          <Field
            name="owner"
            label="Election review owner"
            value={election?.data.owner ?? session.operator.displayName}
          />
          <Submit>Record signed election reference</Submit>
        </form>
      </Card>
      <Card title="Official allocation sources">
        {Object.values(history.rules).map((r) => (
          <p key={r.id}>
            <a href={r.url} rel="noreferrer">
              {r.title}
            </a>{' '}
            · edition {r.id}
          </p>
        ))}
      </Card>
    </>,
  )
}

export function schedulesPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  people: Person[],
  result: Awaited<ReturnType<Schedules['read']>>,
  edit?: string,
) {
  const base = companyPath(actor.company) + '/schedules'
  const selected = result.history.find((r) => r.id === edit)
  return page(
    session,
    'Pay schedules',
    companies,
    actor.company,
    <>
      <Card title="Calendar and processing eligibility">
        <p>{result.eligibility.reason}</p>
        <p>
          No funding deadline, approval cutoff or fee is quoted. Calendar settings alone
          never authorize payment.
        </p>
        <p>
          <a href={companyPath(actor.company) + '/workspace'}>Payroll preparation</a>
        </p>
      </Card>
      <Card title="Schedule proposals">
        {!result.history.length && <p>No schedule proposals yet.</p>}
        {result.history.map((r) => (
          <article key={r.id + ':' + r.version}>
            <h3>
              {r.data.name} · v{r.version}
            </h3>
            <p>
              {r.data.frequency} · {r.data.periodStart}–{r.data.periodEnd} ·{' '}
              {r.data.timeZone}
            </p>
            <p>
              Requested payday {r.data.requestedPayDate}; calendar-adjusted payday{' '}
              {r.data.payDate}. Policy: {r.data.holidayPolicy}.
            </p>
            <p>
              Local period instants: {r.data.periodStartInstant} through{' '}
              {r.data.periodEndExclusiveInstant} (exclusive).
            </p>
            <p>
              {r.data.occupation} · {r.data.workState} · worker{' '}
              {people.find((p) => p.id === r.data.personId)?.name ?? 'Unavailable'} ·{' '}
              {r.data.exceptionRef
                ? 'Official exception reference requires verification: ' +
                  r.data.exceptionRef
                : 'No exception recorded.'}
            </p>
            <p>
              Proposal only. Frequency verification for all work states and current
              provider eligibility are required before a payable run can use it.
            </p>
            <p>
              <a href={base + '?edit=' + r.id}>Revise this schedule</a>
            </p>
          </article>
        ))}
      </Card>
      <Card title="Prepare a schedule">
        <form className="field" method="post" action={base}>
          <RecordFields row={selected} />
          <Field name="name" label="Schedule name" value={selected?.data.name} />
          <NamedSelect
            name="personId"
            label="Worker"
            choices={people}
            value={selected?.data.personId}
          />
          <Select
            name="frequency"
            label="Pay frequency"
            choices={payFrequencies}
            value={selected?.data.frequency}
          />
          <Select
            name="timeZone"
            label="Employer time zone"
            choices={timeZones}
            value={selected?.data.timeZone}
          />
          <Field
            name="periodStart"
            label="Local period starts"
            type="date"
            value={selected?.data.periodStart}
          />
          <Field
            name="payDate"
            label="Requested payday"
            type="date"
            value={selected?.data.requestedPayDate}
          />
          <Select
            name="holidayPolicy"
            label="Non-banking-day policy"
            choices={['earlier', 'later', 'refuse']}
            value={selected?.data.holidayPolicy}
          />
          <Select
            name="workState"
            label="Frequency rule state"
            choices={['NY']}
            value={selected?.data.workState}
          />
          <Select
            name="occupation"
            label="Occupation for frequency rule"
            choices={['manual', 'clerical', 'executive', 'other']}
            value={selected?.data.occupation}
          />
          <Field
            name="exceptionRef"
            label="Official agency exception custody reference"
            required={false}
            maxLength={500}
            value={selected?.data.exceptionRef}
          />
          <NamedSelect
            name="exceptionPersonId"
            label="Exception worker"
            required={false}
            choices={[{ id: '', name: 'No exception' }, ...people]}
            value={selected?.data.exceptionRef ? selected.data.personId : ''}
          />
          <Field
            name="exceptionFrom"
            label="Exception starts"
            type="date"
            required={false}
            value={selected?.data.exceptionFrom}
          />
          <Field
            name="exceptionThrough"
            label="Exception expires"
            type="date"
            required={false}
            value={selected?.data.exceptionThrough}
          />
          <Submit primary>Prepare calendar proposal</Submit>
        </form>
      </Card>
      <Card title="Official calendar and frequency sources">
        {Object.entries(result.sources).map(([name, url]) => (
          <p key={name}>
            <a href={url} rel="noreferrer">
              {{
                holidays: 'Federal Reserve banking holidays',
                newYork: 'New York pay frequency',
                scope: 'State payday requirements',
              }[name] ?? name}
            </a>
          </p>
        ))}
      </Card>
    </>,
  )
}
export function workspacePage(
  session: Session,
  companies: Company[],
  actor?: Actor,
  people: Person[] = [],
) {
  return page(
    session,
    'Payroll preparation',
    companies,
    actor?.company,
    <>
      <Card title="Preparation settings">
        <p>
          Effective inputs and previews are available. No payment, filing or complete tax
          calculation is authorized here.
        </p>
        {actor ? (
          <>
            <p>
              <a href={companyPath(actor.company)}>Company records and access</a> ·{' '}
              <a href={companyPath(actor.company) + '/schedules'}>Pay schedules</a> ·{' '}
              <a href={companyPath(actor.company) + '/pay-settings'}>
                Pay items and reviewed changes
              </a>{' '}
              ·{' '}
              <a href={companyPath(actor.company) + '/rules'}>
                Rule editions and deadlines
              </a>
            </p>
            {people.map((p) => (
              <p key={p.id}>
                <a href={companyPath(actor.company) + '/people/' + p.id + '/allocations'}>
                  {p.name} · Work and residence
                </a>
              </p>
            ))}
          </>
        ) : (
          companies.map((c) => (
            <p key={c.id}>
              <a href={companyPath(c.id) + '/workspace'}>{c.name} · Preparation</a>
            </p>
          ))
        )}
      </Card>
    </>,
  )
}

export function paySettingsPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  people: Person[],
  result: Awaited<ReturnType<import('./pay-items').PayItems['read']>>,
  preview?: import('./pay-items').EarningsRun,
) {
  const base = companyPath(actor.company) + '/pay-settings'
  const revisions = (
    kind: 'group' | 'pay-item' | 'pay-change',
    rows: import('./store').Revision[],
  ) =>
    rows.map((r) => (
      <article key={kind + r.id + ':' + r.version}>
        <h3>
          {String(r.data.name)} · v{r.version}
        </h3>
        <p>
          {!r.sourcesCurrent
            ? 'Source changed; review a new proposal.'
            : r.withdrawnBy
              ? 'Withdrawn by ' + r.withdrawnBy
              : r.approvedBy
                ? 'Approved by ' + r.approvedBy
                : 'Awaiting exact human review'}
        </p>
        {!r.approvedBy && !r.withdrawnBy && Boolean(r.sourcesCurrent) && (
          <p>
            <a href={base + '/review/' + kind + '/' + r.id}>
              Review {String(r.data.name)}
            </a>
          </p>
        )}
        {r.approvedBy && !r.withdrawnBy && (
          <form method="post" action={base + '/' + kind + '/' + r.id + '/withdraw'}>
            <Hidden name="version" value={r.version} />
            <Submit>
              Withdraw {String(r.data.name)} v{r.version}
            </Submit>
          </form>
        )}
      </article>
    ))
  const groupIds = result.groups
    .filter(
      (g, i, a) =>
        g.approvedBy &&
        !g.withdrawnBy &&
        g.sourcesCurrent &&
        a.findIndex((x) => x.id === g.id) === i,
    )
    .map((g) => g.id)
  const run = (r: import('./pay-items').EarningsRun) => (
    <>
      <p>
        {r.periodStart}–{r.periodEnd} · pays {r.payDate} · Cash earnings and reimbursement
        ${(r.grossCashCents / 100).toFixed(2)}. Net pay and tax amounts are unavailable.
      </p>
      {r.people.map((p) => (
        <article key={p.id}>
          <h3>{p.name}</h3>
          <p>
            Regular/salaried earnings ${(p.earningsCents / 100).toFixed(2)} · taxable cash
            basis ${(p.taxableCashCents / 100).toFixed(2)} · proposed reimbursement $
            {(p.reimbursementCents / 100).toFixed(2)} · after-tax deductions $
            {(p.afterTaxDeductionCents / 100).toFixed(2)}
          </p>
          {p.details.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </article>
      ))}
      <div role="status">
        <h3>Unresolved before payroll</h3>
        {r.holds.map((h, i) => (
          <p key={i}>
            {people.find((p) => p.id === h.personId)?.name ?? 'Worker'}: {h.reason}
          </p>
        ))}
      </div>
    </>
  )
  return page(
    session,
    'Pay items and reviewed changes',
    companies,
    actor.company,
    <>
      <Card title="Human-reviewed payroll setup">
        <p>
          <a href={companyPath(actor.company) + '/workspace'}>Payroll preparation</a>
        </p>
        <p>
          Groups, pay items and rate changes use exact version review. Agents cannot
          approve them. Earnings previews retain their original inputs; they are not
          payable payroll.
        </p>
      </Card>
      {preview && <Card title="Earnings preview">{run(preview)}</Card>}
      <Card title="Reviewed groups">
        {!result.groups.length && <p>No payroll groups yet.</p>}
        {revisions('group', result.groups as unknown as import('./store').Revision[])}
        <form className="field" method="post" action={base + '/group'}>
          <Field name="id" label="Group ID" />
          <Field
            name="version"
            label="Previous group version (0 for new)"
            type="number"
            value={0}
          />
          <Field name="name" label="Payroll group name" />
          <fieldset>
            <legend>People in this exact group</legend>
            {people.map((p) => (
              <label className="field" key={p.id}>
                <span>
                  <input type="checkbox" name="people" value={p.id} />
                  {p.name}
                </span>
              </label>
            ))}
          </fieldset>
          <Submit>Propose payroll group</Submit>
        </form>
      </Card>
      <Card title="Custom and recurring pay items">
        {!result.items.length && <p>No pay items yet.</p>}
        {revisions('pay-item', result.items as unknown as import('./store').Revision[])}
        <form className="field" method="post" action={base + '/pay-item'}>
          <Field name="id" label="Pay item ID" />
          <Field
            name="version"
            label="Previous pay item version (0 for new)"
            type="number"
            value={0}
          />
          <Field name="name" label="Pay item name" />
          <NamedSelect
            name="groupId"
            label="Reviewed pay item group"
            choices={groupIds.map((id) => ({
              id,
              name: result.groups.find((g) => g.id === id)!.data.name,
            }))}
          />
          <Field name="amountCents" label="Recurring amount in cents" type="number" />
          <Field name="effectiveDate" label="Pay item effective date" type="date" />
          <Select
            name="taxCode"
            label="Tax treatment"
            choices={[
              'w2-cash-earning',
              'accountable-reimbursement',
              'after-tax-deduction',
            ]}
          />
          <Hidden name="recurring" value="true" />
          <Field
            name="evidenceRef"
            label="Accountable plan substantiation reference"
            maxLength={500}
            required={false}
          />
          <Field
            name="returnExcessBy"
            label="Return excess by"
            type="date"
            required={false}
          />
          <Submit>Propose recurring pay item</Submit>
        </form>
      </Card>
      <Card title="Bulk pay changes">
        {!result.changes.length && <p>No bulk changes yet.</p>}
        {revisions(
          'pay-change',
          result.changes as unknown as import('./store').Revision[],
        )}
        <p>
          Use the documented API to prepare a bulk change from current worker records. It
          retains every person's source version, effective rate, salary/hourly basis,
          employment dates and unpaid dates for exact human review.
        </p>
      </Card>
      <Card title="Preview and retain earnings">
        <form className="field" method="post" action={base + '/earnings-run'}>
          <Field name="id" label="Earnings draft ID" />
          <Field
            name="version"
            label="Previous earnings draft version (0 for new)"
            type="number"
            value={0}
          />
          <NamedSelect
            name="groupId"
            label="Reviewed preview group"
            choices={groupIds.map((id) => ({
              id,
              name: result.groups.find((g) => g.id === id)!.data.name,
            }))}
          />
          <Field name="periodStart" label="Earnings period starts" type="date" />
          <Field name="periodEnd" label="Earnings period ends" type="date" />
          <Field name="payDate" label="Earnings pay date" type="date" />
          <Select
            name="frequency"
            label="Salary periods per year"
            choices={['weekly', 'biweekly', 'semimonthly', 'monthly']}
          />
          <Submit primary>Retain exact earnings preview</Submit>
        </form>
      </Card>
      <Card title="Immutable earnings drafts">
        {!result.runs.length && <p>No earnings drafts yet.</p>}
        {result.runs.map((r) => (
          <article key={r.id + ':' + r.version}>
            <h3>
              {r.id} · v{r.version} · {r.sourceStatus}
            </h3>
            {run(r.data)}
          </article>
        ))}
      </Card>
    </>,
  )
}
export function exactReviewPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  row: import('./store').Revision & { reviewToken: string },
) {
  const base = companyPath(actor.company) + '/pay-settings'
  const details = (value: unknown): import('react').ReactNode =>
    Array.isArray(value) ? (
      <ol>
        {value.map((v, i) => (
          <li key={i}>{details(v)}</li>
        ))}
      </ol>
    ) : value && typeof value === 'object' ? (
      <dl>
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt>{k.replace(/([A-Z])/g, ' $1')}</dt>
            <dd>{details(v)}</dd>
          </div>
        ))}
      </dl>
    ) : (
      String(value)
    )
  return page(
    session,
    'Review exact payroll setup',
    companies,
    actor.company,
    <Card title={String(row.data.name ?? row.id)}>
      <p>
        Version {row.version}. Review these exact people, periods and terms. This decision
        does not approve or dispatch a pay run.
      </p>
      {details(row.data)}
      <form method="post" action={base + '/' + row.kind + '/' + row.id + '/approve'}>
        <Hidden name="version" value={row.version} />
        <Hidden name="reviewToken" value={row.reviewToken} />
        <Submit primary>Approve this exact setup</Submit>
      </form>
      <p>
        <a href={base}>Return without approving</a>
      </p>
    </Card>,
  )
}

export function rulesPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  result: Awaited<ReturnType<Rules['read']>>,
) {
  const base = companyPath(actor.company) + '/rules',
    person = (id: string) =>
      result.duties.find((p) => p.id === id)?.name ?? 'Duty owner unavailable'
  return page(
    session,
    'Rule editions and deadlines',
    companies,
    actor.company,
    <>
      <Card title="Official sources and named decisions">
        <p>
          <a href={companyPath(actor.company) + '/workspace'}>Payroll preparation</a>
        </p>
        <p>{result.explanation}</p>
        <p>
          Rule administration records proposals and human decisions. It cannot authorize a
          payment or treat an upload as wages received.
        </p>
      </Card>
      <Card title="Compliance duties">
        {!result.obligations.length && <p>No rule duties recorded.</p>}
        {result.obligations.map((o) => (
          <article key={o.id + ':' + o.version}>
            <h3>
              {
                result.history.find((r) => r.id === o.id && r.version === o.version)?.data
                  .name
              }{' '}
              · {o.proposedMutation}
            </h3>
            <p>
              Owner: {person(o.ownerId)}. Backup: {person(o.backupId)}. Approval due{' '}
              {o.approvalDue}. Wage deadline {o.wageDeadline}.
            </p>
            <p>
              {o.missedInternalApprovalDeadline
                ? 'Missed internal approval deadline retained.'
                : 'Internal approval deadline not missed.'}{' '}
              {o.escalation === 'backup-action-required'
                ? 'Backup action is required.'
                : ''}
            </p>
            <p>{o.wageDuty}</p>
            <p>Payment receipt: unavailable.</p>
          </article>
        ))}
      </Card>
      <Card title="Source editions and candidate impact">
        {!result.history.length && <p>No sourced rule editions yet.</p>}
        {result.history.map((r) => (
          <article key={r.id + ':' + r.version}>
            <h3>
              {r.data.name} · {r.data.edition} · v{r.version}
            </h3>
            <p>
              {r.data.state} {r.data.locality} · {r.data.family} · {r.data.determination}{' '}
              · {r.data.effectiveFrom}–{r.data.effectiveThrough} · {r.data.value}{' '}
              {r.data.unit}
            </p>
            <p>
              <a href={r.data.sourceUrl} rel="noreferrer">
                {r.data.sourceTitle}
              </a>{' '}
              · published {r.data.publishedDate} · custody {r.data.sourceRef}
            </p>
            <p>
              {r.approvedBy
                ? 'Reviewed by ' + person(r.approvedBy)
                : 'Awaiting named human review'}
              {r.withdrawnBy ? ' · withdrawn' : ''}
            </p>
            {!r.approvedBy &&
              !r.withdrawnBy &&
              result.history.find((x) => x.id === r.id)?.version === r.version && (
                <p>
                  <a href={base + '/review/' + r.id}>Review {r.data.name}</a>
                </p>
              )}
            {result.impacts
              .filter((i) => i.id === r.id && i.version === r.version)
              .map((i) => (
                <div key={i.id}>
                  <p>
                    Candidate people:{' '}
                    {i.people.map((p) => p.name).join(', ') ||
                      'None identified from current assigned locations'}
                    . {i.drafts.length} candidate earnings drafts.
                    Historical/multiple-work-state and local coverage remains unproved.
                  </p>
                </div>
              ))}
          </article>
        ))}
      </Card>
      {result.missingFinalFuta.length > 0 && (
        <Card title="Final FUTA determination missing">
          <p>
            Years: {result.missingFinalFuta.join(', ')}. An approved forecast is not a
            final rate. Last year's final notice is not substituted.
          </p>
        </Card>
      )}
      <Card title="Record a rule proposal">
        <form className="field" method="post" action={base}>
          <Field name="id" label="Rule record ID" />
          <Field
            name="version"
            label="Previous rule version (0 for new)"
            type="number"
            value={0}
          />
          <Field name="name" label="Rule name" />
          <Select name="family" label="Rule family" choices={ruleFamilies} />
          <Select name="state" label="Rule jurisdiction" choices={['US', ...states]} />
          <Field name="locality" label="City / local jurisdiction" required={false} />
          <Field name="effectiveFrom" label="Rule effective from" type="date" />
          <Field name="effectiveThrough" label="Rule effective through" type="date" />
          <Field name="publishedDate" label="Official publication date" type="date" />
          <Field name="sourceTitle" label="Official source title" maxLength={240} />
          <Field
            name="sourceUrl"
            label="Official government source URL"
            type="url"
            maxLength={1000}
          />
          <Field
            name="sourceRef"
            label="Source document custody reference"
            maxLength={500}
          />
          <Field name="edition" label="Source edition" />
          <Field name="taxYear" label="Tax year" type="number" />
          <Select
            name="determination"
            label="Determination"
            choices={['provisional', 'final']}
          />
          <Field name="value" label="Published rule value" />
          <Select
            name="unit"
            label="Published unit"
            choices={[
              'USD/hour',
              'USD/year',
              'cents/hour',
              'percent',
              'USD/week',
              'calendar-rule',
            ]}
          />
          <label className="field">
            <span>Accountable person</span>
            <select name="ownerId" required>
              {result.duties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Backup person</span>
            <select name="backupId" required>
              {result.duties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="approvalDue"
            label="Internal approval due (UTC, YYYY-MM-DDTHH:MM:SSZ)"
          />
          <Field
            name="wageDeadline"
            label="Legal wage deadline (UTC, YYYY-MM-DDTHH:MM:SSZ)"
          />
          <p>
            WA L&I, OR WBF, HI plan-share and FUTA proposals need their additional
            documented API fields. An incomplete proposal refuses.
          </p>
          <Submit primary>Record sourced proposal</Submit>
        </form>
      </Card>
    </>,
  )
}
export function ruleReviewPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  row: import('./store').Revision & { reviewToken: string },
) {
  const base = companyPath(actor.company) + '/rules'
  return page(
    session,
    'Review exact source edition',
    companies,
    actor.company,
    <Card title={String(row.data.name)}>
      <p>
        Version {row.version}. A forecast remains provisional after review. This decision
        cannot approve payroll or delay a wage deadline.
      </p>
      <dl>
        {Object.entries(row.data).map(([k, v]) => (
          <div key={k}>
            <dt>{k.replace(/([A-Z])/g, ' $1')}</dt>
            <dd>
              {typeof v === 'object'
                ? Object.entries(v ?? {}).map(([name, value]) => (
                    <p key={name}>
                      {name}: {String(value)}
                    </p>
                  ))
                : String(v)}
            </dd>
          </div>
        ))}
      </dl>
      <form method="post" action={base + '/' + row.id + '/approve'}>
        <Hidden name="version" value={row.version} />
        <Hidden name="reviewToken" value={row.reviewToken} />
        <Submit primary>Approve this exact source edition</Submit>
      </form>
      <p>
        <a href={base}>Return without approving</a>
      </p>
    </Card>,
  )
}
