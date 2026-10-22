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
  policy: Record<string, unknown>,
  providers: {id:string;enabled:number}[],
) {
  const base = companyPath(actor.company) + '/agents'
  const labels: Record<string, string> = {
    'records:read': 'View person records',
    'drafts:prepare': 'Prepare run inputs',
    'drafts:read': 'Read run inputs',
    'notices:process': 'Process notice with declared model',
    'dispatch:execute': 'Dispatch exact human-approved notice reply',
  }
  return page(
    session,
    'Agent credentials',
    companies,
    actor.company,
    <>
      <Card title="Named sponsorship">
        <p>
          Each grant stays within your current company, location, field and action powers.
          Choose a review date within 90 days; each secret lasts at most 24 hours and may
          rotate only while the grant and sponsor remain current. Only declared providers
          may process notice text or dispatch an exact human-approved reply.
          Agents never approve or change bank details. Payroll payments and filings remain unavailable.
        </p>
        <form method="post" action="/auth/step-up">
          <Hidden name="action" value="credentials:mint" />
          <Hidden name="returnTo" value={base} />
          <Submit>Send sensitive-change confirmation</Submit>
        </form>
      </Card>
      {actor.grant.role === 'owner' && <Card title="Sponsorship policy">
        <form method="post" action={base+'/policy'}>
          <Hidden name="version" value={Number(policy.version)} />
          <label className="field"><span>Who may sponsor</span><select name="ownerOnly" defaultValue={String(Boolean(policy.ownerOnly))}>
            <option value="false">Any person with every delegated power</option><option value="true">Company owners only</option>
          </select></label>
          <Submit>Save sponsorship policy</Submit>
        </form>
        <a href={companyPath(actor.company)+'/providers'}>Declare external providers</a>
      </Card>}
      <Card title="Issue a scoped credential">
        <form className="field" method="post" action={base}>
          <Field name="name" label="Agent or integration name" />
          <Field name="hours" label="Expires in hours (1–24)" type="number" value={1} />
          <Field name="reviewDate" label="Grant review date (within 90 days)" type="date" required={false} />
          <fieldset>
            <legend>Permitted actions</legend>
            {agentActions.map((a) => (
              <label className="field" key={a}>
                <span>
                  <input type="checkbox" name="actions" value={a} /> {labels[a]}
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
          <label className="field"><span><input type="checkbox" name="fields" value="tax" /> Tax notice text and replies</span></label>
          <fieldset><legend>Declared providers</legend>
            {providers.filter(p => p.enabled).map(p => <label className="field" key={p.id}><span><input type="checkbox" name="providers" value={p.id} /> {p.id === 'openai' ? 'OpenAI: redacted notice text' : 'Resend: exact approved reply'}</span></label>)}
          </fieldset>
          {providers.some(p => p.id==='openai' && p.enabled) && <label className="field"><span><input type="checkbox" name="models" value="gpt-4.1-mini" /> gpt-4.1-mini for notice proposals</span></label>}
          <Submit primary>Issue sponsored credential</Submit>
        </form>
      </Card>
      <Card title="Current and historical credentials">
        {grants.length ? (
          grants.map((g) => (
            <div key={String(g.id)}>
              <p>
                {String(g.name)} · sponsor {String(g.sponsorName)} ·{' '}
                {JSON.parse(String(g.actions))
                  .map((a: string) => labels[a])
                  .join(', ')}{' '}
                · fields {JSON.parse(String(g.fields)).join(', ') || 'none'} · locations{' '}
                {JSON.parse(String(g.locations))
                  .map((id: string) =>
                    id === '*'
                      ? 'All company locations'
                      : (locations.find((l) => l.id === id)?.name ?? 'Unavailable location'),
                  )
                  .join(', ')}{' '}
                · providers {JSON.parse(String(g.providers)).join(', ') || 'none'} · models {JSON.parse(String(g.models)).join(', ') || 'none'} · review due{' '}
                {new Date(Number(g.expiresAt)).toISOString()} · secret expires {new Date(Number(g.secretExpiresAt)).toISOString()} ·{' '}
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
      <p>
        <a className="btn" href={`/api/envelope/companies/${actor.company}/agents/access`}>
          Download attributed agent access
        </a>
      </p>
    </>,
  )
}
export function issuedAgentPage(
  session: Session,
  companies: Company[],
  actor: Actor,
  issued: { id: string; token: string; expiresAt: number; secretExpiresAt: number },
) {
  return page(
    session,
    'Credential issued',
    companies,
    actor.company,
    <Card title="Save this credential securely">
      <p>
        This secret is displayed once. Keep it out of URLs, logs, screenshots and model
        instructions. This secret expires {new Date(issued.secretExpiresAt).toISOString()}; grant review is due {new Date(issued.expiresAt).toISOString()}.
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
