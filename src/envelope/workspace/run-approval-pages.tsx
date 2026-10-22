import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company } from '../records'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import type { EarningsRun } from './pay-items'
import type { ApprovalPolicy, RunApprovalStatus } from './run-approvals'
import type { Revision } from './store'

const dollars = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

/** What one exact run version binds, as the approver sees it before deciding. */
export const RunBinding = ({ run }: { run: EarningsRun }) => (
  <dl>
    <div>
      <dt>Period and pay date</dt>
      <dd>
        {run.periodStart}–{run.periodEnd} · pays {run.payDate} · {run.frequency}
      </dd>
    </div>
    <div>
      <dt>Known debit</dt>
      <dd>{dollars(run.grossCashCents)} cash earnings and reimbursements</dd>
    </div>
    <div>
      <dt>Tax obligations, net pay and provider fees</dt>
      <dd>Not calculated. No tax amount, fee or payment rail is part of this version.</dd>
    </div>
    <div>
      <dt>Destinations</dt>
      <dd>
        {(run.destinations ?? []).map((d) => (
          <span key={d.personId}>
            {run.people.find((p) => p.id === d.personId)?.name ?? d.personId}:{' '}
            {d.bankVersion ? `bank record v${d.bankVersion} on file (masked)` : 'no bank account on file'}
            <br />
          </span>
        ))}
      </dd>
    </div>
    <div>
      <dt>Rules</dt>
      <dd>
        {run.ruleSources.length
          ? run.ruleSources.map((r) => `${r.name} v${r.version} (${r.determination})`).join('; ')
          : 'No period rule sources'}
      </dd>
    </div>
  </dl>
)

export const RunApproval = ({
  base,
  run,
  status,
}: {
  base: string
  run: Revision<EarningsRun>
  status?: RunApprovalStatus
}) =>
  run.data.holds.some((h) => h.code?.startsWith('proration-')) ? (
    <p>
      Not approvable: salary proration previews stay preview-only until stricter work-state and
      final-pay rules exist. Nothing can be released from this version.
    </p>
  ) : status ? (
    <div>
      <h4>Approval of v{run.version}</h4>
      <p>
        {status.current} of {status.required} current approval{status.required > 1 ? 's' : ''}
        {status.thresholdCents !== null
          ? ` · two people approve runs from ${dollars(status.thresholdCents)}`
          : ' · one person approves each run'}
      </p>
      {status.approvals.map((a) => (
        <p key={a.approverId}>
          {a.approverName} ({a.role}, grant v{a.grantVersion}) approved {when(a.occurredAt)}
          {a.current ? '' : ' · no longer current: approver authority changed'}
        </p>
      ))}
      <p>
        <a href={`${base}/earnings-run/${run.id}/review`}>Review {run.id} v{run.version} for approval</a>
      </p>
      <form method="post" action={`${base}/earnings-run/${run.id}/release`}>
        <Hidden name="version" value={run.version} />
        <Submit>Release {run.id} v{run.version}</Submit>
      </form>
      <p>
        Release rechecks this exact version, its sources, destinations, rules and every
        approver's current grant. It then refuses: tax obligations and an authorized payment
        rail do not exist yet, so nothing is sent.
      </p>
    </div>
  ) : null

export const ApprovalPolicyForm = ({
  base,
  policies,
}: {
  base: string
  policies: Revision<ApprovalPolicy>[]
}) => (
  <>
    <p>
      The owner sets when a run needs two different people. Changing it voids every
      pending approval.
    </p>
    {!policies.length && <p>No two-person threshold: one person approves each run.</p>}
    {policies.map((p) => (
      <article key={p.id + ':' + p.version}>
        <h3>
          {p.data.name} · v{p.version}
        </h3>
        <p>
          Second approver from {dollars(p.data.secondApprovalAtCents)} ·{' '}
          {p.withdrawnBy
            ? 'withdrawn'
            : p.approvedBy
              ? 'approved by the owner'
              : 'awaiting the owner’s exact review'}
        </p>
        {!p.approvedBy && !p.withdrawnBy && Boolean(p.sourcesCurrent) && (
          <p>
            <a href={`${base}/review/approval-policy/${p.id}`}>Review {p.data.name}</a>
          </p>
        )}
      </article>
    ))}
    <form className="field" method="post" action={base + '/approval-policy'}>
      <Field name="id" label="Approval policy ID" />
      <Field name="version" label="Previous approval policy version (0 for new)" type="number" value={0} />
      <Field name="name" label="Approval policy name" />
      <Field name="secondApprovalAtCents" label="Second approver from (cents)" type="number" />
      <Submit>Propose approval policy</Submit>
    </form>
  </>
)

export function runReviewPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  row: Revision<EarningsRun> & { reviewToken: string; approval: RunApprovalStatus },
) {
  const base = companyPath(actor.company) + '/pay-settings'
  return page(
    session,
    'Review an exact run version',
    companies,
    actor.company,
    <Card title={`${row.id} · v${row.version}`}>
      <p>
        You are approving exactly this version. Any later edit, source, destination, rule or
        approver-grant change voids this approval before release. Approval sends nothing.
      </p>
      <RunBinding run={row.data} />
      {row.data.people.map((p) => (
        <article key={p.id}>
          <h3>{p.name}</h3>
          <p>
            Earnings {dollars(p.earningsCents)} · taxable cash basis {dollars(p.taxableCashCents)} ·
            reimbursement {dollars(p.reimbursementCents)} · after-tax deductions{' '}
            {dollars(p.afterTaxDeductionCents)}
          </p>
          {p.details.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </article>
      ))}
      <div role="status">
        <h3>Unresolved before payroll</h3>
        {row.data.holds.map((h, i) => (
          <p key={i}>
            {row.data.people.find((p) => p.id === h.personId)?.name ?? 'Worker'}: {h.reason}
          </p>
        ))}
      </div>
      <p>
        {row.approval.current} of {row.approval.required} current approval
        {row.approval.required > 1 ? 's. The second approval must come from a different person.' : '.'}
      </p>
      <form method="post" action={`${base}/earnings-run/${row.id}/approve`}>
        <Hidden name="version" value={row.version} />
        <Hidden name="reviewToken" value={row.reviewToken} />
        <Submit primary>Approve this exact run version</Submit>
      </form>
      <p>
        <a href={base}>Return without approving</a>
      </p>
    </Card>,
  )
}

const refusals: Record<string, string> = {
  proration_preview_not_payable:
    'Salary proration previews stay preview-only until stricter work-state and final-pay rules exist.',
  run_version_superseded: 'A newer version of this run exists. Review and approve the current version.',
  run_sources_changed:
    'A rate, work entry, person or reviewed setup changed after this version. Retain a new preview and approve it.',
  run_rules_changed:
    'A rule edition for this run’s states and period changed. Retain a new preview and approve it.',
  run_destination_changed: 'A payee’s bank record changed after this version. Approve a new version.',
  approval_authority_changed: 'An approver’s grant changed or was revoked, so that approval no longer counts.',
  approval_required: 'No current approval covers this exact version.',
  second_approval_required:
    'This run reaches the owner’s two-person threshold. A second, different person must approve it.',
  run_not_payable:
    'Every approval and binding is current, but tax obligations, net pay and an authorized payment rail do not exist yet, so nothing can be paid.',
}
export function releaseRefusalPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  runId: string,
  code: string,
) {
  return page(
    session,
    'Release refused',
    companies,
    actor.company,
    <Card title={`${runId}: nothing was sent`}>
      <p role="alert">{refusals[code] ?? code.replaceAll('_', ' ')}</p>
      <p>
        <a href={companyPath(actor.company) + '/pay-settings'}>Return to pay settings</a>
      </p>
    </Card>,
  )
}
