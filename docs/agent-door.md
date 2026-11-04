# Envelope's shared company agent door

Envelope serves one Base door at `/mcp` and the alias `/api/envelope/mcp`.
The existing `/api/envelope/v1` agent REST routes invoke that same door and
retain their native REST vocabulary. It supports MCP 2026-07-28 and 2025-11-25. Use discovery and the canonical
OAuth metadata; send the negotiated protocol and method/name headers. Tools
have JSON input/output schemas, scopes, computed classes and contract citations.
Refusals use `code` and MCP `com.runeditrun/error` metadata.

This installation offers the CORE capabilities `tools`, `policy`, `pause`,
`audit`, `idempotency` and `prompts`. It explicitly refuses resources, events and
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

No resource template, event type or subscription is offered by this installed
subset. The reference says so explicitly and keeps the full
target tool table, remaining conformance probes and stranger-agent payroll week
unfinished. The page documents capacity protection separately from business
policy; it supplies no new scope, native human approval or provider authority.

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
Native access records retain the signed agent, sponsor, originating operation,
consent and named approvers alongside the original grant ID. For shared-door
correspondence, native extraction attribution is incorporated into the saved
reply as a separate attribution field **before** human review, encryption and hashing; dispatch preserves that preparer and separately records the actual sending
agent and sponsor in native activity and the outbound attribution header. It never appends unreviewed text after approval.

Installation, archive import, device clients and a person's own authentication
or payroll approval screens retain their own doors. There is no agent queue
executor, resource catalogue, streaming event feed, full payroll week, funded
payment or agency filing claim in this CORE subset.
The broader SURFACE clauses remain targets until those native jobs are delivered.

Native company activity accepts `?operation=<shared-operation-id>` for reconciliation
with the shared audit. Native credential and company-policy admission fingerprints
are retained with local calls, so stale credentials and pending authority cannot
survive rotation or a native policy change. These fingerprints grant no scope.

Native scope reduction (`envelope.credentials.restrict`) carries access, keeps the calling grant identity, and accepts only retained actions, fields and locations. Adding any power or naming another credential refuses without changing the grant. A reduction invalidates prior admissions; repeating the retained scope leaves its revision unchanged.

The additive core migrations are 0044_business_settings.sql, 0045_business_people.sql, 0046_agent_door.sql, 0047_business_agent_bindings.sql, 0048_agent_door_policy_attribution.sql and 0049_agent_operation_lookup.sql; main’s existing 0001–0043 migrations remain unchanged.
