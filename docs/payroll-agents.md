# Sponsored payroll and notice work

Open **Agent credentials** in the company workspace. Any human whose current
ENV-028 grant contains every delegated company, location, field and action can
sponsor. This includes payroll admins and firm accountants; a role label alone
adds no power. The owner can restrict sponsorship to owners. Non-owners see and
revoke only their own credentials and access metadata. Owner sessions manage all
company credentials. Base sessions and agent bearers never substitute for one
another.

Fresh ten-minute app-local email proof in the same native session is required
before minting. Use `POST /auth/step-up` with `action: credentials:mint` and the
settings return path; complete the single-use confirmation in that browser.
Client `mfa:true`, a dev flag or a cookie timestamp is not proof. Linked MFA and
full payroll release are still ENV-051/034 work.

Choose a review date within 90 days (`reviewDate`, UTC end of day), and a first
secret lifetime of 1–24 hours (`hours`). Omitting the review date creates the
short-lived grant used by earlier clients. A secret appears once, in a no-store
response. Only a keyed digest is stored. `credentials.rotate` replaces that
digest and returns a new secret expiring within 24 hours and before the original
review date. Rotation cannot extend the grant, restore an expired/revoked bearer
or survive sponsor removal/current-scope changes. Rotate before expiry; an
expired secret requires fresh human issuance. Concurrent rotations have one
winner; old in-flight requests fail their repeated digest fence.

## Scope and human settings API

All routes use `/api/envelope/companies/:company`, a current human session and
same-origin POSTs. The equivalent native forms are under
`/app/envelope/companies/:company`.

- `GET /agents`: permitted declarations and latest 200 access events, no secrets.
- `POST /agents`: `{name,hours,reviewDate?,actions,fields,locations,providers?,models?}`.
  Returns `{id,token,expiresAt,secretExpiresAt,sponsorId}` once.
- `POST /agents/:id/revoke`: `{version}`, compare-and-swap revocation.
- `POST /agents/policy`: owner-only `{version,ownerOnly}` with audit.
- `GET /agents/access`: permitted attributed access metadata attachment.
- `GET /drafts`: existing owner-visible persisted uncalculated input proposals.
- `GET /providers`, `POST /providers`: owner declarations described in
  [payroll-notices.md](payroll-notices.md).

Delegation requires these current ENV-028 powers, plus every requested field and
location. `*` locations can be delegated only by a sponsor holding `*`.

| Agent action | Required sponsor powers |
| --- | --- |
| `records:read` | `records:read` |
| `drafts:prepare` | `records:read`, `rates:propose` and `compensation` field |
| `drafts:read` | `records:read` and `compensation` field |
| `notices:process` | `notices:read`, `notices:write` and `tax` field |
| `dispatch:execute` | `notices:read`, `notices:dispatch` and `tax` field |

Only `compensation` and `tax` fields are grantable. SSN/bank/approval powers are
never grantable. Providers must be enabled owner declarations: `openai` for
redacted notice processing with model `gpt-4.1-mini`, and `resend` for exact
human-approved correspondence. Empty lists grant nothing and never inherit a
runtime credential. No agent approves, changes bank details, pays wages or signs
or files a tax return.

## Stateless MCP endpoint

`POST /api/envelope/mcp` requires `Authorization: Bearer <secret>`, JSON-RPC 2.0
and JSON (64 KB maximum). Cross-origin browsers and cookie-only requests are
refused. The durable limit is 120 authenticated requests per minute per grant.
`initialize` uses protocol `2025-03-26`; `notifications/initialized` returns 202.
`tools/list` lists only permitted tools. `tools/call` takes `{name,arguments}`.

- `credentials.rotate`: `{}`; permitted only while this bearer, grant and sponsor
  remain current. Save the returned secret securely; never put it in a notice,
  model context, URL, log or screenshot.
- `records.list`: `{companyId}`, at most 100 scoped person IDs/names/location
  IDs/versions, with no private values or pay rates.
- `draft.prepare`: `{companyId,personId,minutes,periodStart,periodEnd,payDate,
  sourceRef,requestKey}`; minutes 1–44,640. Persists an immutable input proposal
  referencing a current person and latest reviewed rate effective at period
  start. Same key/inputs returns the same proposal; different inputs conflict.
- `draft.read`: `{companyId,draftId}`, scoped proposal/rate/source references and
  stale-person indication. An input proposal is **uncalculated, not approved**.
- `notice.process`: `{companyId,noticeId}`, actual encrypted source notice to
  declared OpenAI; redacted output is an **untrusted proposal**, never authority.
- `reply.dispatch`: `{companyId,replyId,version,digest}`, only an exact current
  unexpired human-approved notice reply, with current sponsor/approver/location/
  provider authority. It is not a payroll-payment or signed-filing tool.

Authenticated transport openings and permitted actions are attributed to grant
and sponsor. Authority and bearer digest are checked again in reads/writes and
before outbound work. The original AGENT-DRAFTS journey suspends a request after
its authenticated access event, revokes it via settings, and proves no write.
The SPONSORED-NOTICES journey covers current-scope non-owner sponsors, rotation,
injection confinement, human-only exact correspondence and durable unknowns.

Archive policy excludes active secret digests, company grants, provider
credentials, approval authority and review challenges. Historical IDs,
declarations, proposals, notices and dispatch evidence do not authorize restored
outbound work. Full populated restore proof remains ENV-053 work. Full calculated
payroll, official-schema forged-filing refusals and authorized rail/sandbox
proof remain outstanding; no production payroll readiness is claimed.
