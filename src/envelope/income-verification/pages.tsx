import { verificationText, type VerificationLanguage } from './text'
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
import type {
  WorkerBinding,
  IncomeSource,
  ProtectedDisclosure,
  VerificationRequests,
} from './requests'
import type { ProtectedResponses } from '../disclosures/protected'
export interface VerificationView {
  history: Awaited<ReturnType<VerificationRequests['history']>>
  bindings: Revision<WorkerBinding>[]
  income: Revision<IncomeSource>[]
  disclosures: Revision<ProtectedDisclosure>[]
}
const Details = ({
  value,
  language = 'en',
}: { value: unknown; language?: VerificationLanguage }): import('react').ReactNode =>
  Array.isArray(value) ? (
    <ol className="evidence-text">
      {value.map((v, i) => (
        <li key={i}><Details value={v} language={language} /></li>
      ))}
    </ol>
  ) : value && typeof value === 'object' ? (
    <dl className="evidence-text">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          <dt>{verificationText(language)(k)}</dt>
          <dd><Details value={v} language={language} /></dd>
        </div>
      ))}
    </dl>
  ) : verificationText(language)(String(value ?? 'none'))
export function verificationPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  person: Person,
  result: VerificationView,
  self = false,
  review?: Revision & { reviewToken: string },
  issued?: Awaited<ReturnType<ProtectedResponses['release']>>,
  language: VerificationLanguage = 'en',
) {
  const t = verificationText(language)
  const base =
      companyPath(actor.company) + '/people/' + person.id + '/verification',
    current = result.bindings[0]
  return page(
    session,
    person.name + ' · ' + t('Verification'),
    companies,
    actor.company,
    <div lang={language}>
      <p><a href="?lang=en" lang="en">English</a> · <a href="?lang=es" lang="es">Español</a></p>
      <Card title={t("Selected facts, explicit worker consent")}>
        <p>{t("A named requester receives only the selected period and fields after exact owner review. Every retrieval rechecks consent, expiry, worker identity and source versions. There is no automatic external enrollment or outbound submission.")}</p>
        <p>
          <a href={companyPath(actor.company) + '/people/' + person.id}>{t("Person and rates")}</a>{' '}
          ·{' '}
          <a href="https://github.com/just-every/run-willow">{t("Willow employment provenance")}</a>
        </p>
        <p>{t("Approved policy: explicit worker consent, owner-only review and release, no legal-authority override. Expired responses become unavailable; retained history is restricted.")}</p>
      </Card>
      {issued && (
        <Card title={t("Protected response prepared for handover")}>
          <p>{t("Release ID:")}<code data-release-id="true">{issued.id}</code>. Named
            requester: {issued.requesterId}. Give these details to that verified
            person through your approved private channel.
          </p>
          <p>
            Token (shown once):{' '}
            <code className="evidence-text" data-release-token="true">
              {issued.token}
            </code>
          </p>
          <p>
            <a href="/app/envelope/protected-response">{t("Requester opens a protected response")}</a>
            . Expiry: {new Date(issued.expiresAt).toISOString()}. No delivery or
            acknowledgement is claimed.
          </p>
        </Card>
      )}
      {review && (
        <Card title={t("Review exact protected record")}>
          <p>
            {review.kind} · version {review.version}. Review the worker,
            requester, selected fields, period and provenance before deciding.
          </p>
          <Details value={review.data} />
          <form
            method="post"
            action={base + '/' + review.kind + '/' + review.id + '/approve'}
          >
            <Hidden name="lang" value={language} />
            <Hidden name="version" value={review.version} />
            <Hidden name="reviewToken" value={review.reviewToken} />
            <Submit primary>{t("Approve this exact protected record")}</Submit>
          </form>
        </Card>
      )}
      {!self && (
        <>
          <Card title={t("Verified worker link")}>
            {current && (
              <p>
                Native worker identity: {current.data.workerId}. Version{' '}
                {current.version};{' '}
                {current.approvedBy && !current.withdrawnBy
                  ? 'reviewed'
                  : 'review required'}
                .
              </p>
            )}
            {current && !current.approvedBy && (
              <a
                className="btn"
                href={base + '/verification-worker/' + current.id + '/review'}
              >{t("Review worker identity link")}</a>
            )}
            <form className="field" method="post" action={base + '/worker'}>
              <Hidden name="lang" value={language} />
              <Hidden name="version" value={current?.version ?? 0} />
              <Field
                name="workerId"
                label={t("Verified native worker identity ID")}
              />
              <Field
                name="evidence"
                label={t("Worker identity-link evidence")}
                maxLength={500}
              />
              <Submit>{t("Propose verified worker link")}</Submit>
            </form>
          </Card>
          <Card title={t("Historical payroll register sources")}>
            <p>{t("Import only documented historical wages. A reviewed source register is evidence; it does not initiate or certify a new payment.")}</p>
            {result.income.map((r) => (
              <article key={r.id + ':' + r.version}>
                <h3>
                  {r.data.from}–{r.data.through} · $
                  {(r.data.grossCents / 100).toFixed(2)}
                </h3>
                <p className="evidence-text">
                  {r.data.sourceRef} v{r.version};{' '}
                  {r.approvedBy && !r.withdrawnBy
                    ? 'reviewed'
                    : 'review required'}
                  .
                </p>
                {!r.approvedBy && (
                  <a href={base + '/income-source/' + r.id + '/review'}>{t("Review source register")}</a>
                )}
              </article>
            ))}
            <form className="field" method="post" action={base + '/income'}>
              <Field name="id" label={t("Register source ID")} />
              <Field
                name="version"
                label={t("Previous register version (0 for new)")}
                type="number"
                value={0}
              />
              <Field name="from" label={t("Wage period starts")} type="date" />
              <Field name="through" label={t("Wage period ends")} type="date" />
              <Field
                name="grossCents"
                label={t("Documented gross wages in cents")}
                type="number"
              />
              <Field
                name="sourceRef"
                label={t("Original payroll register reference")}
              />
              <Field
                name="evidence"
                label={t("Wage source reconciliation evidence")}
                maxLength={500}
              />
              <Submit>{t("Propose historical wage source")}</Submit>
            </form>
          </Card>
        </>
      )}
      {self && (
        <Card title={t("Authorize one verification request")}>
          <form className="field" method="post" action={base + '/consents'}>
            <Hidden name="lang" value={language} />
            <Field name="requesterId" label={t("Verified requester identity ID")} />
            <Select
              name="purpose"
              label={t("Lawful purpose")}
              choices={['mortgage', 'rental', 'employment']}
              labels={['mortgage', 'rental', 'employment'].map(t)}
            />
            <Field name="from" label={t("Selected period starts")} type="date" />
            <Field name="through" label={t("Selected period ends")} type="date" />
            <fieldset>
              <legend>{t("Only these fields may be disclosed")}</legend>
              {['hireDate', 'employmentStatus', 'grossWages'].map((f) => (
                <label className="field" key={f}>
                  <span>
                    <input name="fields" type="checkbox" value={f} />
                    {f === 'hireDate'
                      ? t('Hire date')
                      : f === 'employmentStatus'
                        ? t('Employment status')
                        : t('Gross wages in the selected period')}
                  </span>
                </label>
              ))}
            </fieldset>
            <Field
              name="expiresOn"
              label={t("Consent expires (within 30 days)")}
              type="date"
            />
            <Field
              name="retentionUntil"
              label={t("Restricted history retention date (within 90 days)")}
              type="date"
            />
            <Submit primary>{t("Consent to these exact fields and period")}</Submit>
          </form>
        </Card>
      )}
      <Card title={t("Requests and disclosure history")}>
        {!result.history.consents.length && (
          <p>{t("No worker-authorized requests.")}</p>
        )}
        {result.history.consents.map((c) => (
          <article key={c.id}>
            <h3>
              {t(c.purpose)} · {c.from}–{c.through}
            </h3>
            <p>
              {t('Request')} {c.id}. {t('Requester')} {c.requesterId}. {t('Fields')}:{' '}
              {c.fields.map(t).join(', ')}.{' '}
              {c.revokedAt
                ? t('Revoked')
                : c.expiresAt <= Date.now()
                  ? t('Expired')
                  : t('Consent active')}
              . {t('Restricted retention until')} {c.retentionUntil}.
            </p>
            {self && !c.revokedAt && (
              <form
                method="post"
                action={base + '/consents/' + c.id + '/revoke'}
              >
                <Hidden name="lang" value={language} />
                <Submit>{t("Revoke this consent")}</Submit>
              </form>
            )}
            {self && (
              <form
                className="field"
                method="post"
                action={base + '/consents/' + c.id + '/corrections'}
              >
                <Hidden name="lang" value={language} />
                <Field
                  name="reason"
                  label={t('Correction requested for') + ' ' + c.id}
                  maxLength={2000}
                />
                <Submit>{t("Ask owner to correct the source")}</Submit>
              </form>
            )}
          </article>
        ))}
        {result.history.releases.map((r, i) => (
          <article key={i}>
            <p>
              {t('Response')} {String(r.disclosureId)} v{String(r.disclosureVersion)} ·
              {t('Requester')} {String(r.requesterId)} · {t('released')}{' '}
              {new Date(Number(r.issuedAt)).toISOString()} ·{' '}
              {r.openedAt ? t('opened') : t('not opened')} ·{' '}
              {r.acknowledgedAt
                ? t('requester acknowledged')
                : t('no acknowledgement')}
              .
            </p>
            <p>
              {t(r.retentionStatus)}.{' '}
              {r.corrects ? t('Linked correction of') + ' ' + r.corrects : ''}
            </p>
            {r.response && <Details value={r.response} language={language} />}
          </article>
        ))}
        {result.history.corrections.map((r) => (
          <p key={r.id}>
            {t('Correction request')} {r.id}: {t(r.reason)}. {t('Owner source review required')}.
          </p>
        ))}
      </Card>
      {!self && (
        <>
          <Card title={t("Prepare a minimal protected response")}>
            <form
              className="field"
              method="post"
              action={base + '/disclosures'}
            >
              <Field name="id" label={t("Protected response ID")} />
              <Hidden name="lang" value={language} />
              <Hidden name="version" value={0} />
              <Field
                name="consentId"
                label={t("Current worker consent request ID")}
              />
              <Field
                name="corrects"
                label={t("Earlier response ID being corrected (optional)")}
                required={false}
              />
              <Submit primary={!review}>{t("Prepare selected facts for exact review")}</Submit>
            </form>
          </Card>
          <Card title={t("Protected response versions")}>
            {result.disclosures.map((r) => (
              <article key={r.id + ':' + r.version}>
                <h3>
                  {r.id} v{r.version}
                </h3>
                <Details value={r.data} />
                {!r.approvedBy ? (
                  <a
                    className="btn"
                    href={base + '/disclosure/' + r.id + '/review'}
                  >{t("Review exact protected response")}</a>
                ) : (
                  <form
                    method="post"
                    action={base + '/disclosure/' + r.id + '/release'}
                  >
                    <Hidden name="lang" value={language} />
              <Hidden name="version" value={r.version} />
                    <Submit>{t("Release reviewed protected response")}</Submit>
                  </form>
                )}
              </article>
            ))}
          </Card>
        </>
      )}
    </div>,
  )
}
export function protectedResponsePage(
  session: Session,
  result?: Awaited<ReturnType<ProtectedResponses['retrieve']>>,
  values?: { id: string; token: string },
  language: VerificationLanguage = 'en',
) {
  const t = verificationText(language)
  return page(
    session,
    t('Protected verification response'),
    [],
    undefined,
    <div lang={language}><Card
      title={
        result ? t('Selected reviewed facts') : t('Open your protected response')
      }
    >
      {result ? (
        <>
          <Details value={result} language={language} />
          {values && !('acknowledged' in result) && (
            <form method="post" action="/app/envelope/protected-response/ack">
              <Hidden name="lang" value={language} />
              <Hidden name="id" value={values.id} />
              <Hidden name="token" value={values.token} />
              <Submit primary>{t("Acknowledge receipt of these facts")}</Submit>
            </form>
          )}
        </>
      ) : (
        <form
          className="field"
          method="post"
          action="/app/envelope/protected-response/read"
        >
          <Hidden name="lang" value={language} />
          <Field name="id" label={t("Protected release ID")} />
          <Field name="token" label={t("Private response token")} type="password" />
          <Submit primary>{t("Open selected reviewed facts")}</Submit>
        </form>
      )}
      <p><a href="/app/envelope/protected-response?lang=en" lang="en">English</a> · <a href="/app/envelope/protected-response?lang=es" lang="es">Español</a></p>
      <p lang={language}>{t("This response is bound to the named requester. A token alone gives no access; revocation, expiry or changed sources refuse retrieval.")}</p>
    </Card></div>,
  )
}
