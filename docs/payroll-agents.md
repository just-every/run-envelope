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
or net-pay calculation; complete bonus payroll, payroll reports, payment status,
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

## Signed native proposal lifecycle

The native owner can explicitly subscribe to `run.proposal.created`. This is a
persisted, uncalculated input proposal event, never a calculated payroll, payment,
filing or provider receipt. Payment and filing lifecycle families are unavailable.
No compensation, person name, bank data, tax value or source text leaves this door.

The installation administrator pins one exact `ENVELOPE_WEBHOOK_URL` in private
runtime configuration. There is no caller-selected URL. HTTPS is required;
local-mode loopback receivers may use HTTP. Credentials, query and fragment in
that URL are refused, redirects are never followed and sends time out in ten
seconds. Configuring a URL does not establish receiver health or consent.

The following native settings API routes use the existing authenticated session
and same-origin POST rules, under `/api/envelope/companies/:company`:

- `POST /webhooks` with `{consent:true}` requires the configured native owner and
  fresh app-local identity proof. It records explicit consent to the pinned
  destination and returns `{id,secret,destination,eventTypes,payment,filing}`.
  Store the once-visible signing secret in the receiver's secret manager. It is
  encrypted at rest and never returned by history. It is not an agent credential.
- `GET /webhooks` returns up to 100 subscriptions and jobs and 200 latest attempt
  records, ordered by immutable job ID and descending attempt time respectively.
  This is a bounded operational view, not a complete historical export. Each job
  includes its stable event ID, status, current attempt and permitted next action.
- `POST /webhooks/:subscription/revoke` with `{}` stops future sends. Changing
  the owner's grant or identity version also invalidates its old consent.
- `POST /webhooks/:job/deliver` with `{consent:true}` explicitly attempts one
  event. A delivered event is a no-op unless `replay:true` is also explicit.
  Current native owner, company, session, subscription and custody are checked
  again before sending. Held custody forbids outbound delivery even to the owner.
- `POST /webhooks/:job/recover` with `{}` converts a sending lease older than
  30 seconds to unknown after an interrupted sender. It sends nothing. Inspect
  the receiver before explicitly replaying. No automatic retry or destructive
  recovery occurs; a maximum of five total attempts bounds each obligation.
- `GET /operations` is an owner-only health and job summary. It probes the
  database, exposes failed and unknown jobs and expired leases, and explicitly
  distinguishes configured dependencies from verified delivery. Storage is not
  probed; no automatic sender exists; payment and filing are unavailable.
  A healthy database never certifies a bank, agency or receiver.

The durable outbox is written atomically with native proposal creation, shared
across REST, CLI and MCP. Repeated preparation keys create no duplicate event.
Subscription starts with future proposals; historical proposals are not backfilled.
A send carries JSON `{id,type,companyId,proposalId,occurredAt,status}` where status
is `uncalculated-proposal`. The headers are `Envelope-Event-Id`,
`Envelope-Timestamp` (Unix seconds) and `Envelope-Signature` (`v1=` followed by
lowercase hexadecimal HMAC SHA-256). Verify HMAC over the exact UTF-8 body prefixed
by the timestamp and a dot, using the returned secret as UTF-8 bytes. Compare
signatures in constant time, reject timestamps outside five minutes and commit
receiver deduplication by event ID atomically with receiver business work. Every
attempt and replay uses the same event ID; timestamp and signature may change.
Acknowledge only after durable acceptance. Sender delivery history cannot promise
exactly-once work in an arbitrary receiver.

A 2xx acknowledges delivery. A 4xx is failed. A redirect, server failure, timeout
or lost acknowledgement is unknown: the receiver may already have accepted it.
Neither response bodies nor receiver diagnostics are retained. Concurrent senders
claim one durable attempt; restart preserves pending, failed and unknown jobs.
Restored subscriptions are inactive and signing secrets are excluded from archives;
restoring history confers no outbound authority. Complete backup and prior-release
migration proof remains ENV-053 and ENV-056 work.

ct approved owner-only reference events on 26 October 2026 at 10:11Z. The retained conservative restrictions are: only the configured native owner
may consent, inspect or explicitly send reference-only proposal events to an
administrator-pinned destination. There is no automatic outbound action and no
new agent power. ENV-028, ENV-034, ENV-035, ENV-051, ENV-053, ENV-054 and ENV-055
inherit current authority and custody on these doors. Full run lifecycle families,
complete bonus payroll and complete report tools remain unproved. The native exact
earnings-run ceremony now uses a separately authenticated human and passkey
verification, with a signed OIDC MFA assertion alternative at the API boundary;
see [payroll-approvals.md](payroll-approvals.md). This does not complete ENV-051.

The current preparation report is available through MCP `reports.proposals`,
`GET /api/envelope/v1/companies/:company/reports/proposals` and
`node scripts/envelope-cli.mjs report COMPANY_ID [AFTER]`. It requires the current
`drafts:read` action and compensation field and includes only proposals made by
that same credential in its current company and locations. Another credential
cannot retrieve them, even with the same sponsor. It returns
`{kind,proposals,limit,next,payroll,payment,filing}`. Each proposal carries its ID,
retained person version and rate reference, minutes, period, payday and stale
indication. `kind` is `run-input-proposals`; `payroll` is `uncalculated`; payment
and filing remain `unavailable`. This is a report of actual persisted preparation
inputs, never a payroll register, net-pay report or provider status. Pagination
uses the same `limit` and `after` rules as records. Every transport repeats current
sponsor, grant, field, location, bearer and custody checks and records attribution.

## Bonus-only earnings preparation

A conversational client can use MCP `bonus.prepare` with
`{companyId,personId,amountCents,periodStart,periodEnd,payDate,sourceRef,requestKey}`.
The equivalent REST door is `POST /api/envelope/v1/companies/COMPANY_ID/bonus-runs`,
with the company omitted from the JSON body. The CLI uses the same installation
origin and sponsored bearer as the preparation commands above:

```sh
node scripts/envelope-cli.mjs bonus COMPANY_ID < bonus.json
node scripts/envelope-cli.mjs bonus-status COMPANY_ID RUN_ID
```

Example `bonus.json`:

```json
{
  "personId": "PERSON_ID",
  "amountCents": 25000,
  "periodStart": "2026-12-01",
  "periodEnd": "2026-12-07",
  "payDate": "2026-12-11",
  "sourceRef": "synthetic-envelope-915",
  "requestKey": "synthetic-envelope-916"
}
```

`drafts:prepare`, the compensation field and all-location scope are required.
The amount is an integer from 1 to 100,000,000 cents, the period covers at most
31 calendar dates and payday cannot precede its end. Unknown fields, including
human, confirmation and approval flags, refuse with 400. The existing private
JSON size, shared rate limit, date validation and credential rules apply.
Idempotency is scoped to the company, credential and request key across REST,
MCP and CLI: identical inputs return the original version; changed inputs
return 409. Concurrent identical requests retain one native version. Rotation
retains the credential identity; another credential has its own key space.

Preparation returns `{id,version,status,approval,dispatch}` with version 1,
status `uncalculated-earnings-run`, approval `requires-separate-human-proof`
and dispatch `unavailable`. It writes a genuine encrypted, immutable native
bonus-only earnings run, a worker-version custody pin, rule-collection pins
and a separately attributed credential event atomically. The sponsor is the
record's sponsoring operator; `bonusPreparation.credentialId` and the access
history identify the actual preparation client. No human decision is recorded.

MCP `bonus.read` with `{companyId,runId}`, REST
`GET /api/envelope/v1/companies/COMPANY_ID/bonus-runs/:id` and CLI `bonus-status`
require `drafts:read`, compensation and all locations. They return the exact
retained `preview`, `sourcesCurrent` and the preparation status fields.
HEAD repeats authorization and returns no body. Only the preparing credential
can read this compensation or present its review. Current sponsor, grant,
secret, company and held-custody fences apply to every request, including
repeated checks after compensation decryption. The existing preparation report still covers hourly input proposals.
MCP `reports.bonuses`, REST
`GET /api/envelope/v1/companies/COMPANY_ID/reports/bonus-runs` and CLI
`node scripts/envelope-cli.mjs bonus-report COMPANY_ID [AFTER]` return a separate
current scoped report of actual retained bonus earnings. It requires the same
read authority and returns `{kind,bonuses,limit,next,payroll,payment,filing}`.
The kind is `bonus-earnings-preparations`; each row names the immutable run ID
and version, worker ID, amount in cents, period, payday, current-source flag
and uncalculated status. Pagination uses `limit` from 1 to 100 and the last
returned ID as `after`, ordered by ascending immutable run ID. A different
credential sees no bonus rows, and revocation during report assembly returns
no compensation. Payroll remains `uncalculated`; payment and filing remain
`unavailable`. A compensation input report is never a paid payroll register.

Call MCP `run.review` with the returned run ID to present a five-minute native
review link. The link grants no authority: the human signs in separately, sees
the exact amount, period, source, masked destination version and unresolved
calculation, then uses the existing explicit passkey approval ceremony.
The approval records the human and presenting credential separately. A changed
worker, bank record or rule collection requires fresh preparation and review;
revoking the credential invalidates its pending presentation. Ordinary text,
confirmation and bearer credentials never approve. An approved earnings version
still cannot dispatch payroll.

This is bonus earnings preparation, not a complete bonus payroll preview.
Supplemental withholding, regular-rate overtime adjustments, complete state and
local taxes, net pay and fees remain uncalculated. The regular-wage industry
calculator refuses bonus runs instead of misclassifying them. No payment,
filing, provider receipt or bonus lifecycle event is fabricated. Existing
proposal webhooks cover hourly proposals only. Complete bonus payroll,
calculated-run events, permitted payment and filing status and their lifecycle
families remain ENV-030 work. Native encrypted history, inactive recovery,
current authority and statutory custody remain obligations under ENV-028,
ENV-034, ENV-035, ENV-051, ENV-053, ENV-054 and ENV-055 on this transport.

## Company class policy and Pause

Open Settings, choose the company and open Agent credentials. A current native
company owner explicitly answers standard, money, commitment, external,
sensitive, destructive, accounts, access and security. A new company has no
answers selected. Sponsored credentials can be issued before policy setup, but
no tool executes until every class has an answer. Discovery still works.

Each class can allow calls within existing authority, hold for human review,
hold for human approval or block calls. Review and approval are safe holds:
this native increment does not implement a policy approval queue. They do not
supply a human payroll decision, a grant, provider consent or outbound authority.
The existing exact human approval and owner-only explicit reference-event
consent remain separate. No automatic outbound action or retry is introduced.

The native settings routes below the company's agents path are
`POST /class-policy` with the current `version` and an answer for each class,
and `POST /pause` with the current `version` and explicit boolean `paused`.
Only a current native company owner can change them. Stale versions and
incomplete answers refuse without a configuration change. Saving answers keeps
an existing Pause in effect. Every change records the human actor separately
from the agent call history.

The current native hourly preparation and masked record reads carry standard;
compensation reads and reports carry sensitive; bonus earnings preparation
carries money; credential rotation carries security. Presenting a human review
link carries standard and grants no human authority. Notice processing carries
sensitive and external, and exact approved reply dispatch carries commitment
and external. Classes are server declarations, never caller-supplied authority.
This is a bounded classification of the installed tools, not complete Base
conformance or the promised full payroll tool registry.

An unanswered company returns `policy_unset` and a `setupLink` to its own
settings. A blocked class returns `policy_blocked`. A review or approval hold
returns `policy_review_required` or `policy_approval_required`. Pause returns
`agents_paused`. MCP includes the link in its error data; REST includes it in
the JSON error. CLI commands fail with the same HTTP refusal, policy code and validated setup
link and print no credential. Credential rotation is also held; the old secret changes only on
an allowed rotation.

Pause is persisted in D1 and checked before every fenced payroll read or write.
It has no cache interval: the next execution is held immediately, including an
already authenticated call waiting for its body. Changing policy, pausing or
resuming increments its version, so a suspended call cannot regain authority
when someone resumes agents. Restart does not clear Pause. Previously committed
work and existing human approvals are not undone by Pause.

The Agents page reports class and decision totals for a selected UTC date range
(default: the latest seven dates; maximum: 32 dates). Totals include all matching
audited tool calls; the attributed detail view shows the latest 200. Calls with
multiple classes count once in each class. Company owners see their company's
history; other sponsors see only their own. Each authenticated tool attempt is recorded before execution and finalized once;
an interrupted execution stays pending. Its row records the credential, sponsor, tool, transport, server classes, policy
version and decision, without input payloads or private compensation. Invalid
bearers and discovery are outside these tool totals. Full seeded-week Base
outcomes and classification of every staff, firm, provider and security change
remain outstanding SURFACE-006 work. Active class-policy configuration is
excluded from portable archives; restored history supplies no policy authority.
