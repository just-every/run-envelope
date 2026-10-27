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
import {
  intakeColumns,
  intakeCodes,
  type RunInput,
  type RunIntake,
} from './run-input'

export function runIntakePage(
  session: Session,
  companies: Company[],
  actor: Actor,
  people: Person[],
  rows: Revision<RunInput>[],
  preview?: Awaited<ReturnType<RunIntake['preview']>>,
  review?: Revision<RunInput> & { reviewToken: string }
) {
  const base = companyPath(actor.company) + '/pay-settings/intake'
  return page(
    session,
    'Run hours and earnings',
    companies,
    actor.company,
    <div className="field evidence-text">
      <Card title="Prepare one exact run">
        <p>
          <a href={companyPath(actor.company) + '/pay-settings'}>
            Payroll preparation
          </a>
        </p>
        <p>
          Keep the same run ID and source namespace for corrections. Blank cells
          preserve existing values; zero replaces a value. Cash tips are already
          held by the worker. Paycheck tips add new cash. Preparation and review
          send no money.
        </p>
        <p>
          {['csv', 'xls', 'xlsx'].map((format) => (
            <span key={format}>
              <a href={base + '/template?format=' + format}>
                Download {format.toUpperCase()} template
              </a>
              {' · '}
            </span>
          ))}
        </p>
        <form
          className="field"
          method="post"
          encType={['multipart', 'form-data'].join('/')}
          action={base + '/preview'}
        >
          <Field name="id" label="Run ID" />
          <Field
            name="version"
            label="Current intake version (0 for new)"
            type="number"
            value={0}
          />
          <Field
            name="namespace"
            label="Source name for manual or spreadsheet intake"
            required={false}
          />
          <label className="field">
            <span>Upload completed template</span>
            <input name="file" type="file" accept=".csv,.xls,.xlsx" />
          </label>
          <details>
            <summary>Map spreadsheet columns</summary>
            <div className="field">
              {intakeColumns.map((key) => (
                <Field
                  key={key}
                  name={'map.' + key}
                  label={
                    'Uploaded column for ' +
                    {
                      sourceId: 'source row',
                      personId: 'worker ID',
                      day: 'earning date',
                      workweek: 'workweek start',
                      code: 'earning code',
                      minutes: 'minutes',
                      amountCents: 'amount in cents',
                      settlement: 'tip settlement',
                      evidence: 'approval evidence',
                      state: 'state',
                      riskClass: 'risk class',
                    }[key]
                  }
                  value={key}
                />
              ))}
            </div>
          </details>
          <label className="field">
            <span>Or paste template CSV</span>
            <textarea name="csv" rows={4} />
          </label>
          <p>
            Or enter up to three source rows below. Amounts are cents; minutes
            may be fractional. Each row needs its actual workweek start and
            retained approval evidence.
          </p>
          {[0, 1, 2].map((i) => (
            <details key={i}>
              <summary>Manual row {i + 1}</summary>
              <div className="field">
                <Field
                  name={`row${i}.sourceId`}
                  label="Stable source row ID"
                  required={false}
                />
                <label className="field">
                  <span>Worker</span>
                  <select name={`row${i}.personId`} defaultValue="">
                    <option value="">Choose worker</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  name={`row${i}.day`}
                  label="Work or earning date"
                  type="date"
                  required={false}
                />
                <Field
                  name={`row${i}.workweek`}
                  label="Actual workweek starts"
                  type="date"
                  required={false}
                />
                <Select
                  name={`row${i}.code`}
                  label="Earning code"
                  choices={[...intakeCodes]}
                />
                <Field
                  name={`row${i}.minutes`}
                  label="Minutes"
                  type="number"
                  step="any"
                  required={false}
                />
                <Field
                  name={`row${i}.amountCents`}
                  label="Amount in cents"
                  type="number"
                  required={false}
                />
                <Select
                  name={`row${i}.settlement`}
                  label="Tip settlement (tips only)"
                  choices={['', 'cash', 'paycheck']}
                />
                <Field
                  name={`row${i}.evidence`}
                  label="Source approval or settlement evidence"
                  required={false}
                />
                <Field
                  name={`row${i}.state`}
                  label="Assessment state (WA or OR)"
                  required={false}
                />
                <Field
                  name={`row${i}.riskClass`}
                  label="WA risk class"
                  required={false}
                />
              </div>
            </details>
          ))}
<details>
            <summary>Import reviewed provider data</summary>
            <p>Paste a reviewed Lanyard, Deputy, Homebase, When I Work, 7shifts, QuickBooks Time, Clockify, Toast, Square or Clover capture. Its source workplace supplies the source name. Exact review is still required; use the documented provider format.</p>
            <label className="field"><span>Reviewed source data (JSON)</span><textarea name="providerCapture" rows={4} /></label>
          </details>
          <Submit primary>Preview exact cell changes</Submit>
        </form>
      </Card>
      {preview && (
        <Card title="Exact changes before applying">
          <p>
            Run {preview.id} · previous version {preview.version} ·{' '}
            {preview.unchanged
              ? 'Unchanged; replay creates no new earnings'
              : 'Review these source changes'}
          </p>
          {preview.cells
            .filter((c) => c.status !== 'unchanged')
            .map((cell, i) => (
              <p key={i}>
                {cell.sourceId} ·{' '}
                {people.find((p) => p.id === cell.personId)?.name} ·{' '}
                {cell.workweek} · {cell.code} · {cell.field}:{' '}
                {cell.before === null ? 'new' : String(cell.before)} →{' '}
                {String(cell.after)} ({cell.status})
              </p>
            ))}
          <p>
            {preview.cells.filter((c) => c.status === 'unchanged').length}{' '}
            unchanged cells. File digest:{' '}
            {preview.data.fileDigest || 'manual entry'}.
          </p>
          <form method="post" action={base + '/apply'}>
            <Hidden name="id" value={preview.id} />
            <Hidden name="version" value={preview.version} />
            <Hidden name="namespace" value={preview.data.namespace} />
            {preview.data.providerCapture ? <Hidden name="providerCapture" value={JSON.stringify(preview.data.providerCapture)} /> : <Hidden name="rows" value={JSON.stringify(preview.data.rows)} />}
            <Hidden name="fileDigest" value={preview.data.fileDigest} />
            <Hidden name="format" value={preview.data.format} />
            <Hidden name="digest" value={preview.digest} />
            <Submit primary>Apply these exact changes</Submit>
          </form>
        </Card>
      )}
      {review && (
        <Card title="Review exact intake version">
          <p>
            Run {review.id} · v{review.version} · source {review.data.namespace}
            . Review makes these inputs available to an earnings preview; it
            does not approve or pay payroll.
          </p>
          {review.data.rows.map((r) => (
            <p key={r.sourceId}>
              {r.sourceId} · {people.find((p) => p.id === r.personId)?.name} ·{' '}
              {r.day} · week {r.workweek} · {r.code} · {r.minutes} minutes ·{' '}
              {r.amountCents} cents · {r.settlement || 'no tip settlement'} ·{' '}
              {r.evidence}
            </p>
          ))}
          <form method="post" action={base + '/' + review.id + '/approve'}>
            <Hidden name="version" value={review.version} />
            <Hidden name="reviewToken" value={review.reviewToken} />
            <Submit primary>Approve exact intake version</Submit>
          </form>
        </Card>
      )}
      <Card title="Retained source versions">
        {!rows.length && <p>No intake recorded.</p>}
        {rows.map((row) => (
          <article key={row.id + ':' + row.version}>
            <h3>
              {row.id} · v{row.version}
            </h3>
            <p>
              {row.data.providerCapture && <span style={{overflowWrap: 'anywhere'}}>{String(row.data.providerCapture.provider)} · reviewed capture · digest {String(row.data.providerCapture.sourceDigest)} · </span>}
            {row.data.rows.length} rows · {row.data.namespace} ·{' '}
              {row.withdrawnBy
                ? 'Withdrawn'
                : row.approvedBy
                  ? 'Reviewed'
                  : 'Needs exact review'}{' '}
              · entered by {row.data.editorName}
            </p>
            {!row.approvedBy && !row.withdrawnBy && row.sourcesCurrent && (
              <p>
                <a href={base + '/' + row.id + '/review'}>
                  Review this exact intake
                </a>
              </p>
            )}
            {row.approvedBy && !row.withdrawnBy && (
              <form method="post" action={base + '/' + row.id + '/withdraw'}>
                <Hidden name="version" value={row.version} />
                <Submit>Withdraw source approval</Submit>
              </form>
            )}
          </article>
        ))}
      </Card>
    </div>
  )
}
