# Sponsored payroll preparation

Open **Agent credentials** in company settings. The current company owner can
issue a named credential after fresh app-local email confirmation in the same
browser. The sponsor is that person, never a client-supplied actor. A credential
expires in 1–24 hours. Its secret appears once in the no-store response; only a
keyed digest is stored separately from its historical declaration. Keep the
secret out of URLs, logs, screenshots, notices and model context.

The conservative initial policy is owner-only sponsorship with no model or data
provider permissions. It is a partial ENV-052 implementation, pending policy
approval and the remaining run/approval/dispatch work. No model is called by
these tools. The maximum lifetime is not a claim that such a credential can
approve or execute payroll. Future ENV-030/034/035/055 doors must preserve
current sponsor, field/action/company/provider authority and exact human
approval; this implementation does not satisfy those future doors.

Permitted actions are `records:read`, `drafts:prepare`, `drafts:read`. Scope is one
company and explicit location IDs (or `*` for that company's locations).
`compensation` is required to prepare/read drafts. SSN, bank, approval, release,
filing, provider and model scopes are refused. Empty provider/model allowlists
never inherit installation credentials. Credential revocation, expiry,
sponsor deactivation/version change or company grant change immediately ends
access; it does not require restarting the service.

## Human settings API

Use a current company-owner session and the records API's Origin rules:

- `GET /api/envelope/companies/:company/agents`: scope declarations (no secret)
  and the latest 200 permitted-access metadata events.
- `POST` to the same path: `{name, hours, actions, fields, locations}`; optional
  `providers` and `models` must be empty. Returns `{id, token, expiresAt,
  sponsorId}` once. Fresh Base app-local proof is checked again at the write.
- `POST /api/envelope/companies/:company/agents/:id/revoke`: `{version}`;
  revokes the exact current version. Old secrets never revive.
- `GET /api/envelope/companies/:company/agents/access`: private JSON attachment
  with credential, sponsor, action, target and time, without secret values.
- `GET /api/envelope/companies/:company/drafts`: owner-visible persisted input
  proposals. The same records render at the company's **Run input proposals**.

The existing Base `POST /auth/step-up` with action `credentials:mint` sends the
confirmation. Its link completes through `/auth/confirm` only in the session
that requested it. The ten-minute proof may also come from a genuine native
email-link sign-in, matching Base's semantics. Provider identity, a dev-session
flag, a cookie timestamp or client `mfa:true` alone is not payroll proof. Bank
**document storage** now requires this fresh proof too; that does not implement
ENV-004 bank verification, new-bank cooling, human bank-change approval or
ENV-011 release. Linked OIDC MFA and former-worker form journeys remain unproved.

## Stateless MCP endpoint

`POST /api/envelope/mcp` uses `Authorization: Bearer <secret>`, JSON and JSON-RPC
2.0. It accepts no cookie identity or cross-origin browser request. The request
body limit is 64 KB, and each credential has a durable limit of 120 authenticated
requests per minute. There are no SSE or public payroll transports.

`initialize` negotiates protocol `2025-03-26`; `notifications/initialized` returns
202. `tools/list` returns only permitted tool descriptions and JSON schemas.
`tools/call` takes `{name, arguments}`:

- `records.list`: `{companyId}` returns up to 100 currently scoped person
  IDs/names/location IDs/versions, with no private values or pay rates.
- `draft.prepare`: `{companyId, personId, minutes, periodStart, periodEnd,
  payDate, sourceRef, requestKey}` persists one immutable proposed input against
  a real current person/version and the latest human-reviewed rate effective
  by period start. `minutes` is 1–44,640. Invalid periods, foreign locations,
  absent reviewed rates or extra approval/provider fields are refused. Reusing
  a request key with the same inputs returns the same proposal; different inputs
  conflict without changing it.
- `draft.read`: `{companyId, draftId}` returns an in-scope proposal with its
  person/version, reviewed rate/cents, minutes, source and period references.
  A changed person version is exposed as stale.

A proposal is explicitly **uncalculated and not approved**. It does not compute
withholding, make an approval-ready payroll, authorize a bank/filing instruction
or dispatch anything. Reading its version or possessing the credential is not
human approval. Unknown escalation tools are refused. Text in `sourceRef` is
inert stored provenance, not an instruction to invoke a model/provider.

Every authenticated transport opening is logged before its body is consumed;
permitted record/draft actions are separately attributed. Authority is checked
again inside each read/write statement. The integration journey suspends a
request after its authenticated opening appears in the public access log,
revokes the credential through settings, then finishes the body and proves no
draft is written. This proves in-flight **preparation** revocation; approved
outbound dispatch and official-schema forged-filing behavior remain unfinished.

Archive policy excludes the secret-digest table. Historical credential IDs,
scopes, access attribution and input proposals may remain as evidence; restored
company grants and usable credential secrets do not transfer. A populated
restore/re-enrollment proof is still ENV-053 work.
