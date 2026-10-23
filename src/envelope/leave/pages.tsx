import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import {
  page,
  Card,
  Field,
  Hidden,
  Submit,
  Select,
  companyPath,
} from '../pages'
import type { Revision } from '../workspace/store'
import type { LeaveAccount } from './ledger'

export function leavePage(
  session: Session,
  companies: Company[],
  actor: Actor,
  person: Person,
  rows: Revision<LeaveAccount>[],
  review?: Revision<LeaveAccount> & { reviewToken: string },
) {
  const base = companyPath(actor.company) + '/people/' + person.id + '/leave',
    row = rows[0]
  return page(
    session,
    person.name + ' · Leave ledger',
    companies,
    actor.company,
    <>
      <Card title="One balance owner">
        <p>
          Willow owns connected leave policy and balances. Standalone payroll
          accruals use a reviewed policy. Entries reserve leave for payroll
          preview; no payment or pay stub is created here.
        </p>
        <p>
          <a href={companyPath(actor.company) + '/people/' + person.id}>
            Person and rates
          </a>{' '}
          ·{' '}
          <a href="https://github.com/just-every/run-willow" rel="noreferrer">
            Willow employment and leave
          </a>
        </p>
        {row ? (
          <>
            <p>
              Owner: {row.data.owner}. Balance: {row.data.balanceMinutes}{' '}
              minutes. Version {row.version}:{' '}
              {row.withdrawnBy
                ? 'withdrawn'
                : row.approvedBy
                  ? 'reviewed'
                  : 'awaiting exact human review'}
              .
            </p>
            {!row.approvedBy && !row.withdrawnBy && (
              <a className="btn" href={base + '/review'}>
                Review exact leave ledger
              </a>
            )}
          </>
        ) : (
          <p>No leave balance recorded.</p>
        )}
      </Card>
      {review && (
        <Card title="Review this exact leave revision">
          <p>
            Version {review.version}; owner {review.data.owner}; balance{' '}
            {review.data.balanceMinutes} minutes. This approves the ledger only.
          </p>
          <p>
            Policy evidence: {review.data.policy.evidence}. Hire date{' '}
            {review.data.policy.hireDate}; cap {review.data.policy.capMinutes};
            carryover {review.data.policy.carryoverMinutes} minutes.
          </p>
          {review.data.policy.tiers.map((t) => (
            <p key={t.years}>
              After {t.years} years: {t.earnedMinutes} minutes per{' '}
              {t.workedMinutes} worked minutes.
            </p>
          ))}
          {review.data.entries.map((e) => (
            <p key={e.sourceId + ':' + e.sourceVersion}>
              {e.day} · {e.operation} · {e.sourceId} v{e.sourceVersion} ·{' '}
              {e.deltaMinutes} minutes · balance {e.balanceMinutes} · {e.code} ·
              ${(e.amountCents / 100).toFixed(2)} preview · evidence{' '}
              {e.evidence}
            </p>
          ))}
          <form method="post" action={base + '/approve'}>
            <Hidden name="version" value={review.version} />
            <Hidden name="reviewToken" value={review.reviewToken} />
            <Submit primary>Approve this exact leave ledger</Submit>
          </form>
        </Card>
      )}
      {!row && (
        <Card title="Open payroll leave balance">
          <form className="field" method="post" action={base}>
            <Select
              name="owner"
              label="Balance owner"
              choices={['willow', 'payroll']}
            />
            <Field
              name="effectiveDate"
              label="Opening effective date"
              type="date"
            />
            <Field
              name="openingMinutes"
              label="Reconciled opening minutes"
              type="number"
              value={0}
            />
            <Field
              name="hireDate"
              label="Hire date for anniversary tiers"
              type="date"
            />
            <Field
              name="capMinutes"
              label="Balance cap in minutes"
              type="number"
            />
            <Field
              name="carryoverMinutes"
              label="January carryover cap in minutes"
              type="number"
            />
            <label className="field">
              <span>
                Accrual tiers (JSON: years, earnedMinutes, workedMinutes)
              </span>
              <textarea
                name="tiers"
                aria-label="Accrual tiers (JSON: years, earnedMinutes, workedMinutes)"
                required
                defaultValue={
                  '[{"years":0,"earnedMinutes":1,"workedMinutes":30}]'
                }
              />
            </label>
            <Field
              name="policyEvidence"
              label="Reviewed policy and lawful rate evidence"
              maxLength={500}
            />
            <Submit primary>Propose opening balance</Submit>
          </form>
        </Card>
      )}
      {row &&
        !row.withdrawnBy &&
        (row.approvedBy ||
          rows.some((r) => r.approvedBy && !r.withdrawnBy)) && (
          <Card title="Propose a sourced leave entry">
            <form className="field" method="post" action={base + '/entries'}>
              <Hidden name="version" value={row.version} />
              {!row.approvedBy && (
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      name="revisePending"
                      value="true"
                      required
                    />
                    Revise this pending proposal, retaining its entries for a
                    new exact review
                  </span>
                </label>
              )}
              <Field
                name="sourceId"
                label="Source record ID (work ID for accrual)"
              />
              <Field
                name="sourceVersion"
                label="Source version"
                type="number"
                value={1}
              />
              <Field name="day" label="Effective date" type="date" />
              <Select
                name="operation"
                label="Entry purpose"
                choices={[
                  'use',
                  'accrual',
                  'adjustment',
                  'carryover',
                  'transfer',
                ]}
              />
              <Select
                name="owner"
                label="Use owner or new transfer owner"
                choices={['willow', 'payroll']}
                value={row.data.owner}
              />
              <Field
                name="minutes"
                label="Leave minutes (use or adjustment)"
                type="number"
                value={0}
              />
              <Select
                name="code"
                label="Leave pay code"
                choices={['sick', 'pto', 'holiday', 'unpaid', 'termination']}
              />
              <Field
                name="rateCents"
                label="Lawful hourly rate in cents (paid leave)"
                type="number"
                required={false}
              />
              <Select
                name="direction"
                label="Adjustment direction"
                choices={['credit', 'debit']}
              />
              <Field
                name="reconciledMinutes"
                label="Confirmed transfer balance in minutes"
                type="number"
                required={false}
              />
              <Field
                name="evidence"
                label="Source approval, rate or reconciliation evidence"
                maxLength={500}
              />
              <Submit primary={!review}>Propose exact leave entry</Submit>
            </form>
          </Card>
        )}
      <Card title="Retained ledger revisions">
        {rows.map((r) => (
          <article key={r.version}>
            <h3>
              Version {r.version} · {r.data.owner} · {r.data.balanceMinutes}{' '}
              minutes
            </h3>
            <p>
              Recorded by {r.createdBy}; approved by {r.approvedBy ?? 'nobody'}.
            </p>
            {r.data.entries.map((e) => (
              <p key={e.sourceId + ':' + e.sourceVersion}>
                {e.day} · {e.operation} · {e.sourceId} v{e.sourceVersion} ·{' '}
                {e.deltaMinutes} minutes · ${(e.amountCents / 100).toFixed(2)}{' '}
                preview · {e.evidence}
              </p>
            ))}
          </article>
        ))}
      </Card>
    </>,
  )
}
