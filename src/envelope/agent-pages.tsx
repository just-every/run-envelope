import type { Session } from '../modules/operator-auth/index.mjs'
import type { Actor } from './access'
import type { Company } from './records'
import { agentActions } from './agents'
import { page, Card, Field, Hidden, Submit, companyPath } from './pages'

export function agentsPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  locations: { id: string; name: string }[],
  grants: Record<string, unknown>[],
  access: Record<string, unknown>[],
) {
  const base = companyPath(actor.company) + '/agents'
  return page(
    session,
    'Agent credentials',
    companies,
    actor.company,
    <>
      <Card title="Named sponsorship">
        <p>
          Each credential acts only for this company under your current owner grant, expires
          within 24 hours and stops immediately on revocation or sponsor removal. No model or
          data provider is allowed. Agents cannot approve, change bank instructions or send
          payments and filings.
        </p>
        <form method="post" action="/auth/step-up">
          <Hidden name="action" value="credentials:mint" />
          <Hidden name="returnTo" value={base} />
          <Submit>Send sensitive-change confirmation</Submit>
        </form>
      </Card>
      <Card title="Issue a scoped credential">
        <form className="field" method="post" action={base}>
          <Field name="name" label="Agent or integration name" />
          <Field name="hours" label="Expires in hours (1–24)" type="number" value={1} />
          <fieldset>
            <legend>Permitted actions</legend>
            {agentActions.map((a) => (
              <label className="field" key={a}>
                <span>
                  <input type="checkbox" name="actions" value={a} /> {a}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Permitted locations</legend>
            <label className="field">
              <span>
                <input type="checkbox" name="locations" value="*" /> All company locations
              </span>
            </label>
            {locations.map((l) => (
              <label className="field" key={l.id}>
                <span>
                  <input type="checkbox" name="locations" value={l.id} /> {l.name}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>
              <input type="checkbox" name="fields" value="compensation" /> Reviewed
              compensation for draft preparation and reading
            </span>
          </label>
          <Submit primary>Issue sponsored credential</Submit>
        </form>
      </Card>
      <Card title="Current and historical credentials">
        {grants.length ? (
          grants.map((g) => (
            <div key={String(g.id)}>
              <p>
                {String(g.name)} · sponsor {String(g.sponsorId)} ·{' '}
                {JSON.parse(String(g.actions)).join(', ')} · fields{' '}
                {JSON.parse(String(g.fields)).join(', ') || 'none'} · locations{' '}
                {JSON.parse(String(g.locations)).join(', ')} · providers/models: none · expires{' '}
                {new Date(Number(g.expiresAt)).toISOString()} ·{' '}
                {g.revokedAt
                  ? 'Revoked'
                  : Number(g.expiresAt) <= Date.now()
                    ? 'Expired'
                    : 'Subject to current sponsor authority'}
              </p>
              {!g.revokedAt && (
                <form method="post" action={`${base}/${g.id}/revoke`}>
                  <Hidden name="version" value={Number(g.version)} />
                  <Submit>Revoke {String(g.name)}</Submit>
                </form>
              )}
            </div>
          ))
        ) : (
          <p>No sponsored credentials.</p>
        )}
        <p>
          <a href={companyPath(actor.company) + '/drafts'}>
            Inspect persisted run input proposals
          </a>
        </p>
      </Card>
      <Card title="Recent permitted agent access">
        {access.length ? (
          access.map((a, i) => (
            <p key={i}>
              {String(a.action)} · credential {String(a.credentialId)} · sponsor{' '}
              {String(a.sponsorId)} · target {String(a.targetId)} ·{' '}
              {new Date(Number(a.occurredAt)).toISOString()}
            </p>
          ))
        ) : (
          <p>No permitted tool access recorded.</p>
        )}
      </Card>
    </>,
  )
}
export function issuedAgentPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  issued: { id: string; token: string; expiresAt: number },
) {
  return page(
    session,
    'Credential issued',
    companies,
    actor.company,
    <Card title="Save this credential securely">
      <p>
        This secret is displayed once. Keep it out of URLs, logs, screenshots and model
        instructions. It expires {new Date(issued.expiresAt).toISOString()}.
      </p>
      <label className="field">
        <span>One-time credential</span>
        <textarea readOnly value={issued.token} aria-label="One-time credential" />
      </label>
      <p>
        Use the Authorization Bearer header at /api/envelope/mcp. Credential ID: {issued.id}.
      </p>
      <a className="btn" href={companyPath(actor.company) + '/agents'}>
        Return to credentials
      </a>
    </Card>,
  )
}
export function draftsPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  drafts: Record<string, unknown>[],
) {
  return page(
    session,
    'Run input proposals',
    companies,
    actor.company,
    <Card title="Uncalculated proposals">
      <p>
        These are persisted proposed inputs with a reviewed rate reference. Withholding, net
        pay, bulk review, exact human payroll approval and dispatch remain unavailable. No
        proposal authorizes pay.
      </p>
      {drafts.length ? (
        drafts.map((d) => (
          <div key={String(d.id)}>
            <h3>{String(d.personName)}</h3>
            <p>
              {String(d.periodStart)} to {String(d.periodEnd)} · proposed payday{' '}
              {String(d.payDate)} · {String(d.minutes)} minutes · person version{' '}
              {String(d.personVersion)} · reviewed rate {String(d.rateId)} · source{' '}
              {String(d.sourceRef)} · credential {String(d.credentialId)} · proposal{' '}
              {String(d.id)}
            </p>
          </div>
        ))
      ) : (
        <p>No proposed run inputs.</p>
      )}
    </Card>,
  )
}
