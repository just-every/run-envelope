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

## Versioned preparation REST API and CLI

The supported preparation API is `/api/envelope/v1`. Use the installation's
HTTPS origin and a sponsored bearer in `Authorization`; never send a human
cookie. Browser requests must be same-origin. The same 120 requests per minute
per credential applies across REST and MCP together. Responses are private and
`no-store`. All reads, including HEAD, repeat current grant, sponsor, field,
location, expiry, secret and custody checks. Revocation takes effect on the next
fenced database operation, including an already opened request. A draft can be
read only by the credential that prepared it; the owner's native proposal view
remains separately authorized. Rotating a secret retains its credential ID.

| Method and path below `/api/envelope/v1` | Input | Result and permission |
| --- | --- | --- |
| `GET /companies/:company/records` | Optional `limit` (1–100, default 100), `after` (last returned person ID) | `{records:[{id,name,locationId,version}],limit,next}`; `records:read` |
| `POST /companies/:company/drafts` | JSON `{personId,minutes,periodStart,periodEnd,payDate,sourceRef,requestKey}` | `{id,status,approval,dispatch}`; `drafts:prepare` and compensation field |
| `GET /companies/:company/drafts/:id` | No body or query | `{id,personId,personName,personVersion,rateId,hourlyCents,minutes,periodStart,periodEnd,payDate,sourceRef,stale,status,approval,dispatch}`; `drafts:read` and compensation field |

Record pages are ordered by ascending immutable person ID. Pass `next` as
`after` until `next` is null. This is a live authorized listing, not a snapshot:
concurrent inserts before the cursor require restarting the listing; revoked
locations disappear immediately. MCP `records.list` accepts the same optional
`limit` and `after` arguments. Unknown or repeated query parameters are refused.

Draft dates are real `YYYY-MM-DD` dates, period start must not exceed period end,
and payday must be on or after period end. Minutes are integral 1–44,640.
References are nonempty bounded strings: source 240 characters and request key
120. Unknown input fields, including human or approval flags, are refused.
The worker must be within the current location scope and have a reviewed rate
at period start. The immutable proposal ID binds the retained person version,
rate ID, dates, minutes and source. It is an hourly input proposal with no tax
or net-pay calculation; bonus preparation, payroll reports, payment status,
filing status and lifecycle webhooks are still unimplemented ENV-030 work.
A missing family is never reported as a completed effect.

Idempotency is durable and shared across both transports. Reusing the same
`requestKey` under the same company and credential with exactly the same inputs
returns the original proposal. Changed inputs return 409. After an interrupted
request, retry with the same key; a new key intentionally creates another input
proposal. Preparation always returns 201, including a successful replay.
Preparation never grants approval or dispatch authority.

Errors are `{error:code}` with 400 for invalid input, 401 for missing or invalid
bearer, 403 for denied or revoked authority, 409 for changed sources or conflicting
idempotency, 413 for input over 64,000 bytes, 415 for a non-JSON POST, 429 for
rate limiting and 503 for unavailable required configuration. Scope checks precede
record lookup. No retry can renew an expired grant. Wait for the next minute
before retrying a 429; use bounded backoff for an unavailable installation and
retain the same preparation key. Other refusals require correction or human
reissuance. No cookies, provider credentials or human approval tokens are returned.

Run the CLI from an installed checkout with Node 22.20.0. Provision
`ENVELOPE_ORIGIN` and `ENVELOPE_TOKEN` through your secret manager; the CLI accepts
no credential argument and prints no request headers. Do not put the bearer in
shell history. The installation origin must use HTTPS; HTTP is allowed only for
loopback sandbox installations. Redirects are refused and requests time out after
30 seconds. Output is JSON on stdout; failures have a nonzero exit code and a
redacted diagnostic on stderr. Treat successful output as private payroll data.

```sh
node scripts/envelope-cli.mjs records COMPANY_ID
node scripts/envelope-cli.mjs records COMPANY_ID LAST_PERSON_ID
node scripts/envelope-cli.mjs prepare COMPANY_ID < draft.json
node scripts/envelope-cli.mjs status COMPANY_ID DRAFT_ID
```

Example `draft.json`, using IDs returned by the installation's records endpoint:

```json
{
  "personId": "PERSON_ID",
  "minutes": 480,
  "periodStart": "2026-12-01",
  "periodEnd": "2026-12-07",
  "payDate": "2026-12-11",
  "sourceRef": "synthetic-envelope-820",
  "requestKey": "synthetic-envelope-821"
}
```

For a local sandbox, follow the documented Base setup, create synthetic company
and person records, review the effective rate as a human, then issue a short-lived
credential in Agent credentials after fresh native proof. Use that installation's
loopback origin. No provider connection or funded account is needed for this
hourly preparation journey; it performs no payment, filing or external delivery.
Do not use a production worker's identifiers in sandbox fixtures.

Within v1, new optional response fields may be added; clients must ignore them.
Required input or meaning changes require another major REST path and documented
migration. MCP pagination now orders records by ID rather than display name;
clients must use the returned cursor rather than assuming alphabetical order.
The scoped credential isolation applies immediately to all transports. Future
report, lifecycle, callback, download and execution doors inherit ENV-028,
ENV-034, ENV-035, ENV-051, ENV-053, ENV-054 and ENV-055 obligations. Nothing in
this preparation interface is a passkey or MFA payroll-approval ceremony.
