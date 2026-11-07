# Envelope's shared company agent door

Envelope serves one Base door at `/mcp` and the alias `/api/envelope/mcp`.
The existing `/api/envelope/v1` agent REST routes invoke that same door and
retain their native REST vocabulary. It supports MCP 2026-07-28 and 2025-11-25. Use discovery and the canonical
OAuth metadata; send the negotiated protocol and method/name headers. Tools
have JSON input/output schemas, scopes, computed classes and contract citations.
Refusals use `code` and MCP `com.runeditrun/error` metadata.

Native credentials share one persistent capacity budget of 120 authenticated
requests per UTC minute across `/mcp`, `/api/envelope/mcp` and the existing v1
REST routes. Discovery advertises that same request rate and the MCP body limit.
The last slot may execute; the next attempt receives HTTP 429 and a positive
`Retry-After` in seconds until the next minute, before tool execution. Native
exhaustion uses `agent_rate_limited`; the shared guard uses `rate_limited`.
Invalid credentials remain authentication refusals. Restarting the Worker or
switching routes does not replenish capacity; independently issued credentials
have independent budgets. Public discovery does not consume a native slot. Concurrent requests through
these routes compete for the same final slot; at most one is admitted. A fresh
human sign-in does not replenish an existing agent budget. Revocation is checked
before capacity, so a revoked credential receives an authority refusal rather
than an invitation to wait for more capacity.
These installation protections are not daily business caps or provider spend
budgets, and do not authorize retries, effects or broader native access.

Signed Business tokens use the same advertised minute rate, counted persistently
per signed agent identity on both MCP routes. They require the existing trusted
issuer, current Business subject mapping and an explicitly bound native grant.
Refreshing a token or restarting the Worker does not reset its agent's capacity.
New token identifiers, client identifiers and company policy revisions do not
refill that same signed agent's minute budget. An expired signed token remains
unauthenticated even when the agent has exhausted its budget.
The existing v1 REST routes continue to accept native credentials.

Replacing an exhausted native bearer also preserves its grant's minute budget.
The bound signed agent can use the existing encrypted credential-rotation door;
under a held security policy it still needs exact human approval. The decrypted
replacement remains rate limited through both MCP routes and v1 REST, including
after restart; the old bearer is unauthenticated. Neither replacement nor resume
automatically performs refused payroll work.

Company business rules remain separate from capacity. A seed-scoped agent rule
can allow three outside recipients per UTC day and send the next call to the
class's fallback rule. Each generic correspondence message still needs its own
exact native human approval and an explicit invocation. A restrictive rule runs
before the provider request and dispatch reservation. Native reads remain usable
when only the outside-recipient allowance is exhausted.

Company Pause, installation Pause and an adopted signed Business Pause each
refuse current native and bound Business agent calls on their supported routes.
The controls survive restart; only a current authorized person's control or a
newer valid Business policy can resume access. Replaying an older signed policy
cannot resume agents. Native browser sessions remain usable while agents pause.
A resume does not replay refused business work. This proof covers the native
and paired adapter; it is not a live sibling Business installation receipt or
complete device and future-transport coverage.

The pinned Base door cannot register provider-cost estimates or enforce spend
reservations. Standalone spend-cap configuration is refused; paired policy state
reports caps as `not_enforced`. A saved cap supplies no spending guarantee.
Exhausted-cap refusal, no-cap provider spending and full per-agent money and
provider-spend usage remain unimplemented Base dependencies of BASE-AGENT-011.

This installation offers the CORE capabilities `tools`, `policy`, `pause`,
`audit`, `idempotency`, `resources` and `prompts`. It explicitly refuses events and
subscriptions. These are target capabilities, not implemented payroll outcomes.
The machine-readable registry and native journey are in `agent-surface.json`.

The installed public reference is `/docs/agents`. It groups the actual registry
by job and includes every offered tool's scope, possible classes, computed-class
tests, input and output schemas, resource templates, capacity limits and stable
refusal codes. It reads declarations only, without customer records, credentials,
company-policy answers or installation settings. GET and HEAD work signed out;
other methods return 405. An `Accept: application/json` request returns the same
public declarations. Both MCP paths generate their discovery instructions from
this catalogue and point to that reference.

Each class proof names its fixture step in `agent-surface.json` and its check in
`src/modules/agent-door/conformance/journey.mjs`. The `<policy>` placeholder is
`autonomous` or `held`. The hosted journey checks real computed classes for those
steps, then `tests/agent-door/docs.mjs` compares the reference with authenticated
full-scope discovery under both policies. It also refuses an omitted tool, class
or proof mapping. `tests/agent-docs-runtime.mjs`, invoked by `tests/runtime.mjs`
in push Verify, checks the public page on a populated installation, escaping,
private-value exclusion, keyboard access and responsive browser proof.

Specialist prompts list the installed worker, hourly, bonus, native review, notice
correspondence, reconciliation and credential jobs through `prompts / list`.
`prompts / get` returns the same instructions shown in the generated reference.
These instructions use the existing tools, preserve calculation and provider holds,
and supply no human approval or additional authority. Prompt arguments never enter
the instructions. Both MCP aliases require a current authenticated caller,
answered policy and Pause admission before retrieving a job. The native journey
checks unanswered setup, Pause, resume and revoked-bearer refusal, and compares
retained payroll records and grants before and after job retrieval.

The hosted agent-door shard also runs `tests/agent-door/failures.mjs` against
its own disposable production installation. Every probe first passes the real
shared checker, then injects one fault into that verifier and requires the named
assertion to fail. Nineteen probes cover a missing output schema, native effects
before approval, while blocked and before setup, wrong computed classes and
facts, agent arguments claiming an internal or confirmed action, an agent substituted for a signed-in person, accepted
wrong-audience identity, a duplicate effect on retry and changed masked worker
identity against the native person door. The native effects use genuine,
authorized preparation or person routes; no product authorization or shared
Base source is replaced. Disposition-independent probes run under autonomous
and held policies. Installed fixture expectations retain risk measures, data
kinds, counterparty facts and scope direction where those facts are static;
report measures remain dependent on the full retained selection. This proves failure detection for the installed subset,
not completion of every target role, tool or payroll job.

The installed masked-worker resource is listed in the reference. No event type
or subscription is offered. The reference keeps the full
target tool table, remaining conformance probes and stranger-agent payroll week
unfinished. The page documents capacity protection separately from business
policy; it supplies no new scope, native human approval or provider authority.

| Tool | Class | Native job |
| --- | --- | --- |
| `envelope.records.list` | standard | Scoped masked worker page |
| `envelope.draft.prepare` | standard | Uncalculated hourly-input proposal |
| `envelope.draft.read` | sensitive | This grant's retained hourly proposal |
| `envelope.bonus.prepare` | standard | Uncalculated bonus earnings preparation |
| `envelope.bonus.read` | sensitive | This grant's retained bonus preparation |
| `envelope.reports.proposals` | sensitive | This grant's hourly preparation report |
| `envelope.reports.bonuses` | sensitive | This grant's bonus preparation report |
| `envelope.runs.review_link` | standard | Separate native human review handoff |
| `envelope.notices.process` | sensitive, external | Redacted notice extraction at OpenAI |
| `envelope.notices.reply` | commitment, external | Exact human-reviewed Resend correspondence |
| `envelope.jobs.status` | standard | This agent and sponsor's retained delivery status |
| `envelope.credentials.rotate` | security | Replace this native grant's bearer |
| `envelope.workspace.snapshot` | standard | Counts and digest of visible native state |

Credential rotation accepts `publicKey: {kty:"RSA",n,e:"AQAB"}` for an RSA key
of at least 2048 bits. The caller keeps its private key. The shared result
contains `encryptedToken` with `algorithm: RSA-OAEP-256`; decrypt it locally.
Plaintext bearers never enter the shared outcome, approval or audit stores.
The old bearer stops immediately and the decrypted replacement retains only
the original native scope and expiry.

Every mutation requires `idempotency_key`. Keep `requestKey` for the native
hourly/bonus preparation key too. Replaying the same key cannot repeat an effect;
changed arguments conflict. Overlapping admissions may refuse with `decision_busy`
or `call_in_progress` and no effect from that attempt. Reconcile the completed
operation before repeating a request. Record mutations expose native revision preconditions
and exact native targets and summaries. A preparation cannot approve wages, pay
people, remit tax, file returns, create an outside account or satisfy a human's
step-up. Native review and exact-version authority remain separate from company
policy approval. There is no invented Undo, provider cost registration or spend
reservation. Unknown provider outcomes remain held in the native dispatch ledger.

For an explicitly requested background delivery, call `envelope.notices.reply`
with `background: true` and the exact previously human-approved reply. The MCP
call returns a durable `jobId` and the initial `pending` outcome without waiting
for Resend. Read `envelope.jobs.status` with `companyId` and `jobId` to observe
`pending`, `accepted`, `rejected` or `unknown`. Provider acceptance still means
delivery is unconfirmed. Both MCP routes support this ordinary tool; the Tasks
extension is unnecessary. A native transport without a background executor
refuses the option before creating a dispatch.

The same mutation key always returns its first outcome, including an initial
pending handle; status is the separate current observation. Status never sends,
retries or supplies authority. It requires current company, location, tax-field,
dispatch, policy, Pause, sponsor and agent admission. Another person's credential
or a different agent sees the same `job_not_found` as an absent handle. The
existing dispatch ledger retains the originating agent and sponsor. Interrupted
pending work becomes uncertain after the provider timeout; no process restart or
archive restore retries it. A human must reconcile uncertain delivery. Native
credential rotation immediately retires the old bearer; a still-authorized
paired Business client can recover the original encrypted delivery after a lost
response, using its original idempotency key and RSA recipient key.

Business access uses the installation's existing issuer, installation identity,
canonical origin and public key ring. Signed Business settings bind owner/team
subjects to current native operator IDs; token email never selects authority.
Unknown, inactive and changed-email identities refuse. Native grants still govern
company, location, field, action, provider, expiry and current sponsor version.
An agent cannot rotate a Business token or widen its grant by rotating a native
bearer. A locally promoted administrator gains no Business approval role. An active
installation teammate without a current payroll company grant is inadmissible
as a payroll sponsor.

A person first issues a grant through the existing native, recent-proof-protected
`POST /api/envelope/companies/:company/agents` lifecycle. Include
`businessAgentId` to bind that exact Business agent to the issued native grant.
The binding does not create an operator, grant a company role, extend expiry or
skip provider consent. Without a matching live grant, Business calls refuse.
Local credentials retain their original native ID and narrow scope. Recognizable
invalid Business credentials never become local credentials.

The shared signed policy receiver is `/api/rer/agent-policy`. Native people use
`/agents`, its approval/review pages and person JSON doors. Standalone owners
configure the shared policy there; paired installations use Business. The native
company's existing class restrictions and Pause remain additional restrictions,
including at native SQL effects. Neither policy supplies missing native authority.

For the installed bonus-preparation tool, a shared autonomous answer prepares an
uncalculated earnings run. Review also prepares it and returns the linked review
handle. Approval returns `input_required`, a pending handle, expiry and URL-mode
elicitation when the modern MCP client advertises URL elicitation support. It
retains the server's target, amount, summary and class facts without preparing a
run. The named person signs in separately and approves the saved policy revision
and summary. Retrying the same call returns the completed result and approval
receipt; it cannot prepare a second run. A changed shared policy revision also invalidates a waiting approval,
even when its document has the same contents. Changed arguments cannot reuse that
approval: use a fresh key and obtain a fresh exact approval. Rejection and expiry
return `approval_rejected` and `approval_expired` without preparation. Blocked
returns `policy_blocked` with its class, rule and policy revision. A changed
shared policy applies to the next call and is recorded in its audit.

This shared decision is permission to attempt preparation under the native
company floor. Native review, approval and blocked restrictions still refuse execution under
shared autonomous, review and approval policies before a pending action opens,
and native Pause also prevents an already pending action from executing. Shared
approval never supplies native payroll approval, tax or net calculation, payment
readiness or dispatch authority. The emitted-Worker journey
`tests/agent-policy-decisions-runtime.mjs` exercises this bounded bonus path,
including named-person browser decisions, restart and a controlled expiry clock.
The existing native v1 bonus route has the same four decisions: approval returns
its pending handle with `approval_required`; the named person approves through
the same browser door before the integration retry returns its single preparation.
Other tools and classes, thresholds, daily caps, multi-class decisions, complete
setup and upgrade behavior, signed-policy rejection, delegated policy
administration and full transport parity remain separate unproved obligations.

Native access records retain the signed agent, sponsor, originating operation,
consent and named approvers alongside the original grant ID. For shared-door
correspondence, native extraction attribution is incorporated into the saved
reply as a separate attribution field **before** human review, encryption and hashing; dispatch preserves that preparer and separately records the actual sending
agent and sponsor in native activity and the outbound attribution header. It never appends unreviewed text after approval.

Installation, archive import, device clients and a person's own authentication
or payroll approval screens retain their own doors. There is no automatic agent
queue executor, full resource catalogue, streaming event feed,
full payroll week, funded payment or agency filing claim in this CORE subset.
The broader SURFACE clauses remain targets until those native jobs are delivered.

Native company activity accepts `?operation=<shared-operation-id>` for reconciliation
with the shared audit. Native credential and company-policy admission fingerprints
are retained with local calls, so stale credentials and pending authority cannot
survive rotation or a native policy change. These fingerprints grant no scope.

Native scope reduction (`envelope.credentials.restrict`) carries access, keeps the calling grant identity, and accepts only retained actions, fields and locations. Adding any power or naming another credential refuses without changing the grant. A reduction invalidates prior admissions; repeating the retained scope leaves its revision unchanged.

The additive core migrations are 0044_business_settings.sql, 0045_business_people.sql, 0046_agent_door.sql, 0047_business_agent_bindings.sql, 0048_agent_door_policy_attribution.sql and 0049_agent_operation_lookup.sql; main’s existing 0001–0043 migrations remain unchanged.

A native agent bearer at the existing person administration doors receives
`self_escalation` when it tries to promote its sponsoring installation role,
widen its sponsor's company grant, or change native or shared policy or Pause.
The same refusal applies with an attached owner cookie and under autonomous,
approval and blocked access policies. The refusal records the actual sponsor,
grant and computed access direction without changing any authority or policy.
It supplies no person session, provider authority or Business token capability.

Worker names, retained preparation sources and imported notice text remain
untrusted data. Claims of owner access or an internal recipient in that data or
in extra arguments do not change a tool's computed classes or permitted scope.
Grant scope reductions and sponsor changes are rechecked by both MCP routes,
the existing REST adapter and the CLI before any retained result is returned.
Grant budgets, complete role parity and remaining data families are still owed;
no provider spend enforcement is claimed.

The masked worker resource template is
`envelope://companies/{company}/people/{person}`. Both MCP paths list it through
`resources/templates/list`. A successful `envelope.records.list` returns resource
links only for that returned page, preserving its native pagination. Read each
link with `resources/read`; the JSON contains exactly `id`, `name`, `locationId`
and `version`, matching the native viewer identity register. Customer names are
untrusted data, marked on each resource content. Compensation and private SSN,
bank and tax values are absent even when a credential has wider field access.

A masked read carries standard and requires current `records:read`, the matching
company and location, live sponsor and client grants, and no held company data.
The native company policy and Pause restrict classification and delivery in
addition to the shared policy. Review records a review; approval withholds content
until the native person door approves and the client retries with `requestState`.
Neither supplies missing native authority. A changed identity projection refuses
an old operation, including after restart or an approved retry; request a fresh
read and any required review. Native decision facts retain only the projection
digest for that operation. Missing, foreign and inaccessible records share
`resource_unavailable`; a changed delivered projection may give `resource_changed`.
Restored history supplies no session, credential, consent or resource authority.
Revocation from the shared Agents page also fences an already suspended read;
a native credential cannot bypass that client revocation.
The final delivery query checks the current identity and authority together;
an identity edit after the native read also invalidates an approved retry.
Company, run, filing, notice, case, coverage and report resource families remain
unavailable, as do sensitive resource reads and file exports.
