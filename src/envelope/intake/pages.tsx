import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import {
  page,
  Card,
  Field,
  Hidden,
  Select,
  Submit,
  companyPath,
} from '../pages'
import type { Revision } from '../workspace/store'
import type { SourceEvent, SourceIntake } from './sources'
import { hrisProviders, hrisTypes } from '../connectors/hris/adapters'
import { earningProviders } from '../connectors/siblings/earnings'
export function sourcePage(
  session: Session,
  companies: Company[],
  actor: Actor,
  person: Person,
  kind: 'hris-event' | 'source-earning',
  rows: Awaited<ReturnType<SourceIntake['read']>>,
  review?: Revision<SourceEvent> & { reviewToken: string },
) {
  const route = kind === 'hris-event' ? 'hris' : 'earnings-sources',
    base = companyPath(actor.company) + '/people/' + person.id + '/' + route
  return page(
    session,
    person.name + (kind === 'hris-event' ? ' · HR handoff' : ' · Job earnings'),
    companies,
    actor.company,
    <>
      <Card
        title={
          kind === 'hris-event'
            ? 'Reviewed HR changes'
            : 'Approved source earnings'
        }
      >
        <p>
          Source exports are proposals until a named human reviews the exact
          identity mapping, dates and amount. Acknowledgement means accepted for
          payroll preview. No payment, policy update or source delivery is
          implied.
        </p>
        <p>
          <a href={companyPath(actor.company) + '/people/' + person.id}>
            Person and rates
          </a>{' '}
          ·{' '}
          <a href={companyPath(actor.company) + '/pay-settings'}>
            Payroll previews
          </a>
        </p>
        {kind === 'hris-event' ? (
          <p>
            Willow owns employment, policy, I-9, documents, enrollment and
            offboarding. Lodge hires must come through Willow. BambooHR,
            Rippling and HiBob hourly-rate exports are supported. Other external
            event types and live connections remain unavailable.
          </p>
        ) : (
          <p>
            <a href="https://github.com/just-every/run-easel">Easel</a> plans
            headcount;{' '}
            <a href="https://github.com/just-every/run-coaster">Coaster</a> owns
            reimbursement choice;{' '}
            <a href="https://github.com/just-every/run-purse">Purse</a> owns
            supplier payments. None can authorize payroll here. Reconciled labor
            actuals remain unavailable until an actual payroll close exists.
          </p>
        )}
      </Card>
      {review && (
        <Card title="Review exact source revision">
          <p>
            {review.data.provider} · {review.data.type} · source person{' '}
            {review.data.sourcePersonId} → {person.name}. Source{' '}
            {review.data.sourceId} v{review.data.sourceVersion}, effective{' '}
            {review.data.effectiveDate}.
          </p>
          <dl>
            {Object.entries(review.data.values).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
          <p>
            Source approver: {review.data.sourceApprovedBy}. Evidence:{' '}
            {review.data.sourceEvidence}. Schema: {review.data.schema}.
          </p>
          <form method="post" action={base + '/' + review.id + '/approve'}>
            <Hidden name="version" value={review.version} />
            <Hidden name="reviewToken" value={review.reviewToken} />
            <Submit primary>Approve this exact source mapping</Submit>
          </form>
        </Card>
      )}
      <Card title="Source history and acknowledgements">
        {!rows.length && <p>No source changes recorded.</p>}
        {rows.map((r) => (
          <article key={r.id + ':' + r.version}>
            <h3>
              {r.data.provider} · {r.data.type} · {r.data.effectiveDate}
            </h3>
            <p>
              <a href={r.data.ownerUrl} rel="noreferrer">
                Owning product
              </a>{' '}
              · {r.data.sourceId} v{r.data.sourceVersion} · {r.acknowledgement}.
              Source delivery: pending.
            </p>
            <dl>
              {Object.entries(r.data.values).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
            <p>
              Source person {r.data.sourcePersonId}; source approver{' '}
              {r.data.sourceApprovedBy}; local reviewer{' '}
              {r.approvedBy ?? 'pending'}. {r.data.sourceEvidence}
            </p>
            <p>
              Affected retained runs:{' '}
              {r.affectedRuns
                .map(
                  (run) =>
                    run.id +
                    ' v' +
                    run.version +
                    ' (' +
                    run.periodStart +
                    '–' +
                    run.periodEnd +
                    ')',
                )
                .join(', ') || 'none'}
              .
            </p>
            {r.acknowledgement === 'held-for-human-review' && (
              <a className="btn" href={base + '/' + r.id + '/review'}>
                Review exact source mapping
              </a>
            )}
            {kind === 'hris-event' &&
              r.data.provider === 'willow' &&
              r.data.type === 'leave' &&
              r.approvedBy &&
              !r.withdrawnBy && (
                <form
                  className="field"
                  method="post"
                  action={base + '/' + r.id + '/leave-handoff'}
                >
                  <Field
                    name="ledgerVersion"
                    label="Current reviewed Willow leave ledger version"
                    type="number"
                  />
                  <label className="field">
                    <span>
                      <input
                        type="checkbox"
                        name="revisePending"
                        value="true"
                      />
                      Revise an existing pending ledger proposal for a new exact
                      review
                    </span>
                  </label>
                  <Submit>Propose this source leave in the ledger</Submit>
                </form>
              )}
            {r.approvedBy && !r.withdrawnBy && (
              <form method="post" action={base + '/' + r.id + '/withdraw'}>
                <Hidden name="version" value={r.version} />
                <Submit>Withdraw source approval</Submit>
              </form>
            )}
          </article>
        ))}
      </Card>
      <Card title="Import an authorized source export">
        <form className="field" method="post" action={base}>
          <Select
            name="provider"
            label="Owning source"
            choices={
              kind === 'hris-event' ? [...hrisProviders] : [...earningProviders]
            }
          />
          {kind === 'hris-event' && (
            <Select
              name="type"
              label="Payroll change"
              choices={[...hrisTypes]}
            />
          )}
          <Field
            name="sourcePersonId"
            label="Person ID in the source product"
          />
          <Field
            name="sourceVersion"
            label="Source revision number"
            type="number"
            value={1}
          />
          <Field
            name="version"
            label="Previous local revision (0 for new)"
            type="number"
            value={0}
          />
          <Field name="sourceApprovedBy" label="Named source approver" />
          <Field
            name="sourceEvidence"
            label="Authorized source/version evidence"
            maxLength={500}
          />
          <label className="field">
            <span>Source export (documented JSON)</span>
            <textarea
              name="export"
              aria-label="Source export (documented JSON)"
              required
            />
          </label>
          <Submit primary={!review}>Import for exact review</Submit>
        </form>
      </Card>
    </>,
  )
}
