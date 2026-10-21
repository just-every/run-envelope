import type { ReactNode } from 'react'
import { appDocument } from '../ui/page.server'
import { AppBar } from '../ui/bar'
import { Heading } from '../ui/heading'
import { ClientChips } from '../ui/chips'
import type { Session } from '../modules/operator-auth/index.mjs'
import { actions, fields, roles, type Actor } from './access'
import type { Company, Person } from './records'

const actionLabels: Record<string, string> = {
  'records:read': 'View people',
  'records:write': 'Add people',
  'rates:propose': 'Propose rates',
  'rates:approve': 'Approve exact rates',
  'private:read': 'Read private records',
  'private:write': 'Store private records',
  export: 'Export record register',
  'bank:edit': 'Store bank documents',
  'pay:approve': 'Approve payroll (unavailable)',
  'pay:release': 'Release payroll (unavailable)',
  'audit:read': 'Read company audit',
}

export const companyPath = (id: string) => `/app/envelope/companies/${encodeURIComponent(id)}`
const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="check card">
    <h2 className="check-name">{title}</h2>
    <div className="field">{children}</div>
  </section>
)
const Field = ({
  name,
  label,
  type = 'text',
  value,
  required = true,
}: {
  name: string
  label: string
  type?: string
  value?: string | number
  required?: boolean
}) => (
  <label className="field">
    <span>{label}</span>
    <input
      name={name}
      type={type}
      defaultValue={value}
      required={required}
      maxLength={type === 'password' ? 16000 : 120}
      autoComplete="off"
    />
  </label>
)
const Submit = ({ children, primary = false }: { children: ReactNode; primary?: boolean }) => (
  <button className={`btn${primary ? ' btn--primary' : ''}`} type="submit">
    {children}
  </button>
)
const Hidden = ({ name, value }: { name: string; value: string | number }) => (
  <input type="hidden" name={name} value={value} />
)
const can = (actor: Actor, action: string, field?: string) =>
  actor.grant.role === 'owner' ||
  (actor.grant.actions.includes(action) && (!field || actor.grant.fields.includes(field)))
export function page(
  session: Session,
  title: string,
  companies: Company[],
  selected: string | undefined,
  children: ReactNode,
) {
  const response = appDocument(
    `${title} · Envelope`,
    <>
      <div className="app-wrap">
        <AppBar viewer={session.operator} />
      </div>
      <main className="app-wrap">
        {companies.length > 0 && (
          <ClientChips
            clients={companies.map((c, i) => ({
              name: c.name,
              status: 'Company records',
              colour: (['goldenrod', 'forest', 'teal', 'slate', 'violet'] as const)[i % 5],
              href: companyPath(c.id),
              open: c.id === selected,
            }))}
          />
        )}
        <div className="payrun-head">
          <Heading
            lead={title}
            then="Current payroll access."
            meta={<a href="/app/envelope">Companies and payroll settings</a>}
          />
        </div>
        <div className="field">{children}</div>
      </main>
    </>,
  )
  // Native forms need an Origin header. No secret values enter URLs/referrers.
  response.headers.set('referrer-policy', 'strict-origin')
  return response
}
export const companyIndex = (session: Session, companies: Company[]) =>
  page(
    session,
    'Payroll records',
    companies,
    undefined,
    <>
      <Card title={companies.length ? 'Your companies' : 'No companies yet'}>
        <p>
          Company records and access settings are available. Pay runs, bank changes, deposits and
          tax forms are still being built.
        </p>
        {companies.map((c) => (
          <p key={c.id}>
            <a href={companyPath(c.id)}>{c.name}</a> · EIN ending {c.einSuffix}
          </p>
        ))}
      </Card>
      {session.operator.role === 'owner' && (
        <p>
          <a className="btn" href="/auth/settings/identity">
            Identity settings
          </a>
        </p>
      )}
      {session.operator.role === 'owner' && (
        <Card title="Add a company">
          <form className="field" method="post" action="/app/envelope">
            <Field name="name" label="Legal company name" />
            <Field name="ein" label="EIN (12-3456789)" />
            <Submit primary>Create company records</Submit>
          </form>
        </Card>
      )}
    </>,
  )
export function companyPage(
  session: Session,
  companies: Company[],
  company: Company,
  actor: Actor,
  locations: { id: string; name: string }[],
  people: Person[],
) {
  const base = companyPath(company.id)
  return page(
    session,
    company.name,
    companies,
    company.id,
    <>
      <Card title="Company records">
        <p>
          EIN ending {company.einSuffix}. Private documents are masked. Stored bank documents do not
          change payment destinations or authorize a debit.
        </p>
        <div className="choices">
          {actor.grant.role === 'owner' && (
            <a className="btn" href={`${base}/grants`}>
              Payroll grants
            </a>
          )}
          {can(actor, 'export') && can(actor, 'records:read') && (
            <a className="btn" href={`/api/envelope/companies/${company.id}/export`}>
              Export record register
            </a>
          )}
          {can(actor, 'audit:read') && actor.grant.locations.includes('*') && (
            <a className="btn" href={`/api/envelope/companies/${company.id}/audit`}>
              Download attributed audit
            </a>
          )}
        </div>
      </Card>
      <Card title="People">
        {people.length ? (
          people.map((p) => (
            <p key={p.id}>
              <a href={`${base}/people/${p.id}`}>{p.name}</a>
            </p>
          ))
        ) : (
          <p>No permitted people records yet.</p>
        )}
        {can(actor, 'records:write') && locations.length > 0 && (
          <form className="field" method="post" action={`${base}/people`}>
            <Field name="name" label="Person’s name" />
            <label className="field">
              <span>Work location</span>
              <select aria-label="Work location" name="locationId" required>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <Submit>Add person record</Submit>
          </form>
        )}
      </Card>
      <Card title="Locations">
        {locations.length ? (
          locations.map((l) => <p key={l.id}>{l.name}</p>)
        ) : (
          <p>No permitted locations yet.</p>
        )}
        {actor.grant.role === 'owner' && (
          <form className="field" method="post" action={`${base}/locations`}>
            <Field name="name" label="Location name" />
            <Submit>Add location</Submit>
          </form>
        )}
      </Card>
    </>,
  )
}
export function grantsPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  locations: { id: string; name: string }[],
  grants: Record<string, unknown>[],
  operators: { id: string; displayName: string; email: string }[],
  selectedOperator?: string,
) {
  const base = companyPath(actor.company)
  const selected = grants.find((g) => g.operatorId === selectedOperator && g.role !== 'owner')
  const checked = (scope: string, value: string) =>
    selected ? JSON.parse(String(selected[scope])).includes(value) : false
  return page(
    session,
    'Payroll grants',
    companies,
    actor.company,
    <>
      <Card title="Current grants">
        <p>
          Roles label the grant. Actions, locations and sensitive fields determine access. Changing
          or revoking a grant ends that person’s existing sessions across this installation.
        </p>
        {grants.map((g) => (
          <div key={String(g.operatorId)}>
            <p>
              <b>{String(g.name)}</b> · {String(g.role)} · version {String(g.version)}
              {g.revokedAt ? ' · revoked' : ''}
            </p>
            <p>
              Actions:{' '}
              {JSON.parse(String(g.actions))
                .map((a: string) => actionLabels[a] ?? a)
                .join(', ') || 'none'}
            </p>
            <p>Fields: {JSON.parse(String(g.fields)).join(', ') || 'none'}</p>
            <p>
              Locations:{' '}
              {JSON.parse(String(g.locations))
                .map((id: string) =>
                  id === '*'
                    ? 'All locations'
                    : (locations.find((l) => l.id === id)?.name ?? 'Unavailable location'),
                )
                .join(', ') || 'none'}
            </p>
            {g.role !== 'owner' && (
              <p>
                <a href={`${base}/grants?operator=${encodeURIComponent(String(g.operatorId))}`}>
                  {g.revokedAt ? 'Set fresh access for' : 'Edit access for'} {String(g.name)}
                </a>
              </p>
            )}
            {g.role !== 'owner' && !g.revokedAt && (
              <form method="post" action={`${base}/grants`}>
                <Hidden name="operatorId" value={String(g.operatorId)} />
                <Hidden name="version" value={Number(g.version)} />
                <Hidden name="revoke" value="true" />
                <Submit>Revoke {String(g.name)}</Submit>
              </form>
            )}
          </div>
        ))}
      </Card>
      <Card title="Set an explicit grant">
        <p>
          Invite identities through Base first, then choose their explicit access.
          Employee/contractor labels alone do not restrict a grant to one person; assign only the
          locations and fields that person may access.
        </p>
        <form className="field" method="post" action={`${base}/grants`}>
          <Hidden name="version" value={selected ? Number(selected.version) : 0} />
          {selected ? (
            <>
              <p>Editing access for {String(selected.name)}.</p>
              <Hidden name="operatorId" value={String(selected.operatorId)} />
            </>
          ) : (
            <label className="field">
              <span>Person</span>
              <select aria-label="Person" name="operatorId" required>
                {operators
                  .filter(
                    (o) =>
                      o.id !== session.operator.id && !grants.some((g) => g.operatorId === o.id),
                  )
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName} ({o.email})
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Role label</span>
            <select
              aria-label="Role label"
              name="role"
              defaultValue={selected ? String(selected.role) : 'accountant'}
              required
            >
              {roles
                .filter((r) => r !== 'owner')
                .map((r) => (
                  <option key={r}>{r}</option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>Locations</legend>
            {[{ id: '*', name: 'All locations' }, ...locations].map((l) => (
              <label className="field" key={l.id}>
                <span>
                  <input
                    type="checkbox"
                    name="locations"
                    value={l.id}
                    defaultChecked={checked('locations', l.id)}
                  />{' '}
                  {l.name}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Sensitive fields</legend>
            {fields.map((f) => (
              <label className="field" key={f}>
                <span>
                  <input
                    type="checkbox"
                    name="fields"
                    value={f}
                    defaultChecked={checked('fields', f)}
                  />{' '}
                  {f}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Independent actions</legend>
            {actions
              .filter((a) => !a.startsWith('pay:'))
              .map((a) => (
                <label className="field" key={a}>
                  <span>
                    <input
                      type="checkbox"
                      name="actions"
                      value={a}
                      defaultChecked={checked('actions', a)}
                    />{' '}
                    {actionLabels[a]}
                  </span>
                </label>
              ))}
          </fieldset>
          <p>
            Bank document custody does not change payment instructions. Payroll approvals and
            payments are unavailable.
          </p>
          <Submit primary>Save this grant</Submit>
        </form>
      </Card>
    </>,
  )
}
export interface PersonDetail extends Person {
  rates?: Record<string, unknown>[]
  privateRecords: Record<string, unknown>[]
}
export function personPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  person: PersonDetail,
) {
  const base = `${companyPath(actor.company)}/people/${person.id}`
  return page(
    session,
    person.name,
    companies,
    actor.company,
    <>
      <Card title="Rate history">
        <p>
          Record version {person.version}. Approved hourly rates retain their effective date and
          named reviewer. Payroll calculation is still being built.
        </p>
        {!person.rates ? (
          <p>Compensation is restricted.</p>
        ) : person.rates.length ? (
          person.rates.map((r) => (
            <p key={String(r.id)}>
              ${(Number(r.hourlyCents) / 100).toFixed(2)} per hour · {String(r.effectiveDate)} ·{' '}
              {r.approvedBy ? 'Approved' : 'Awaiting human review'}
              {!r.approvedBy && can(actor, 'rates:approve', 'compensation') && (
                <>
                  {' '}
                  · <a href={`${companyPath(actor.company)}/rates/${r.id}`}>Review exact rate</a>
                </>
              )}
            </p>
          ))
        ) : (
          <p>No reviewed rates yet.</p>
        )}
        {can(actor, 'rates:propose', 'compensation') && (
          <form className="field" method="post" action={`${base}/rates`}>
            <Hidden name="version" value={person.version} />
            <Field name="hourlyCents" label="Proposed hourly rate in cents" type="number" />
            <Field name="effectiveDate" label="Effective date" type="date" />
            <Submit>Prepare rate for review</Submit>
          </form>
        )}
      </Card>
      <Card title="Private records">
        <p>
          Private values are encrypted and masked by default. Every full read creates an attributed
          audit event. Stored bank/tax text is documentary evidence, never a verified payment
          instruction or filed form.
        </p>
        {person.privateRecords.length ? (
          person.privateRecords.map((r) => (
            <p key={String(r.kind)}>
              {String(r.kind)} · •••• · version {String(r.version)}
              {can(actor, 'private:read', String(r.kind)) && (
                <>
                  {' '}
                  ·{' '}
                  <a
                    href={`/api/envelope/companies/${actor.company}/people/${person.id}/private/${r.kind}`}
                  >
                    Read {String(r.kind)} record
                  </a>
                </>
              )}
            </p>
          ))
        ) : (
          <p>No permitted private records.</p>
        )}
        {fields
          .filter(
            (f) =>
              f !== 'compensation' &&
              can(actor, 'private:write', f) &&
              (f !== 'bank' || can(actor, 'bank:edit', f)),
          )
          .map((kind) => (
            <details key={kind}>
              <summary>Store {kind} record</summary>
              <form className="field" method="post" action={`${base}/private`}>
                <Hidden name="kind" value={kind} />
                <Hidden
                  name="version"
                  value={Number(person.privateRecords.find((r) => r.kind === kind)?.version ?? 0)}
                />
                <Field
                  name="value"
                  label={`${kind} private text (not shown again)`}
                  type="password"
                />
                <Submit>Store encrypted {kind} record</Submit>
              </form>
            </details>
          ))}
      </Card>
    </>,
  )
}
export function ratePage(
  session: Session,
  companies: Company[],
  actor: Actor,
  proposal: {
    id: string
    personName: string
    personVersion: number
    hourlyCents: number
    effectiveDate: string
    reviewToken: string
  },
) {
  return page(
    session,
    'Review hourly rate',
    companies,
    actor.company,
    <Card title={proposal.personName}>
      <p>
        ${(proposal.hourlyCents / 100).toFixed(2)} per hour, effective {proposal.effectiveDate},
        person record version {proposal.personVersion}.
      </p>
      <p>
        Reviewing as {session.operator.displayName}. This decision records exactly this rate; it
        does not approve or release any payroll.
      </p>
      <form method="post" action={`${companyPath(actor.company)}/rates/${proposal.id}/approve`}>
        <Hidden name="reviewToken" value={proposal.reviewToken} />
        <Submit primary>Approve this exact rate</Submit>
      </form>
    </Card>,
  )
}
export const errorPage = (session: Session, code: string) =>
  page(
    session,
    'Request held',
    [],
    undefined,
    <Card title="No action completed">
      <p role="alert">{code.replaceAll('_', ' ')}</p>
      <a className="btn" href="/app/envelope">
        Return to payroll settings
      </a>
    </Card>,
  )
