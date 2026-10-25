import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company } from '../records'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import type { HrisHires } from './hris-hires'
import type { Revision } from '../workspace/store'
import type { SourceEvent } from '../intake/sources'
export function hirePage(
  session: Session,
  companies: Company[],
  actor: Actor,
  rows: Awaited<ReturnType<HrisHires['read']>>,
  review?: Revision<SourceEvent> & { reviewToken: string },
) {
  const base = companyPath(actor.company) + '/hris-hires'
  return page(
    session,
    'Willow hires · Payroll handoff',
    companies,
    actor.company,
    <>
      <Card title="Employment stays in Willow">
        <p>
          A named human reviews the source worker, payroll name, local work
          location and effective hire date. Applying a reviewed hire creates one
          payroll-required person. A reviewed correction updates that same person;
          replay makes no additional change.
        </p>
        <p>
          <a href="https://github.com/just-every/run-willow">
            Willow owns employment, policy, I-9, documents and enrollment.
          </a>{' '}
          Lodge sends hires through Willow.
        </p>
      </Card>
      {review && (
        <Card title="Review exact Willow hire">
          <p>
            Source {review.data.sourceId} v{review.data.sourceVersion}. Source
            worker {review.data.sourcePersonId}. Effective{' '}
            {review.data.effectiveDate}.
          </p>
          <p>
            Payroll person: {String(review.data.values.name)}. Work location:{' '}
            {String(review.data.values.locationId)}. Source approver{' '}
            {review.data.sourceApprovedBy}; evidence{' '}
            {review.data.sourceEvidence}.
            {review.data.values.personVersion ? ` Corrects payroll person version ${review.data.values.personVersion}.` : null}
          </p>
          <form method="post" action={base + '/' + review.id + '/approve'}>
            <Hidden name="version" value={review.version} />
            <Hidden name="reviewToken" value={review.reviewToken} />
            <Submit primary>Approve this exact hire mapping</Submit>
          </form>
        </Card>
      )}
      <Card title="Hire acknowledgements">
        {!rows.length && <p>No Willow hires received.</p>}
        {rows.map((r) => (
          <article key={r.id + ':' + r.version}>
            <h3>
              {String(r.data.values.name)} · effective {r.data.effectiveDate}
            </h3>
            <p>
              {r.data.sourcePersonId}; source {r.data.sourceId} v
              {r.data.sourceVersion}.{' '}
              {rows.some((newer) => newer.id === r.id && newer.version > r.version)
                ? 'Superseded'
                : r.withdrawnBy
                ? 'Withdrawn'
                : r.approvedBy
                  ? 'Reviewed'
                  : 'Awaiting human review'}
              .
            </p>
            {!rows.some((newer) => newer.id === r.id && newer.version > r.version) && !r.approvedBy && !r.withdrawnBy && (
              <a className="btn" href={base + '/' + r.id + '/review'}>
                Review exact hire mapping
              </a>
            )}
            {r.personId ? (
              <>
              <p>
                <a href={companyPath(actor.company) + '/people/' + r.personId}>
                  Open the linked payroll person
                </a>
                . Employment remains owned by Willow. Applied source revision {r.appliedVersion ?? 'unknown'}.
              </p>
                {!rows.some((newer) => newer.id === r.id && newer.version > r.version) && r.version > (r.appliedVersion ?? 0) && r.approvedBy && !r.withdrawnBy && (
                  <form method="post" action={base + '/' + r.id + '/apply'}>
                    <Hidden name="version" value={r.version} />
                    <Submit>Apply reviewed hire correction</Submit>
                  </form>
                )}
              </>
            ) : r.approvedBy && !r.withdrawnBy ? (
              <form method="post" action={base + '/' + r.id + '/apply'}>
                <Hidden name="version" value={r.version} />
                <Submit>Create linked payroll person</Submit>
              </form>
            ) : null}
          </article>
        ))}
      </Card>
      <Card title="Import an authorized Willow hire">
        <form className="field" method="post" action={base}>
          <Hidden name="provider" value="willow" />
          <Field name="sourcePersonId" label="Willow worker ID" />
          <Field
            name="sourceVersion"
            label="Willow source revision"
            type="number"
            value={1}
          />
          <Field
            name="version"
            label="Previous local hire version (0 for new)"
            type="number"
            value={0}
          />
          <Field name="sourceApprovedBy" label="Named Willow source approver" />
          <Field
            name="sourceEvidence"
            label="Willow source approval evidence"
            maxLength={500}
          />
          <label className="field">
            <span>Willow hire export (documented JSON)</span>
            <textarea
              name="export"
              aria-label="Willow hire export (documented JSON)"
              required
            />
          </label>
          <Submit primary={!review}>Import hire for exact review</Submit>
        </form>
      </Card>
    </>,
  )
}
