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
have independent budgets. Public discovery does not consume a native slot.
These installation protections are not daily business caps or provider spend
budgets, and do not authorize retries, effects or broader native access.

This installation offers the CORE capabilities `tools`, `policy`, `pause`,
`audit` and `idempotency`. It explicitly refuses resources, events, prompts and
subscriptions. These are target capabilities, not implemented payroll outcomes.
The machine-readable registry and native journey are in `agent-surface.json`.

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

Paired Business access tokens use the canonical `/mcp` audience even when sent
to `/api/envelope/mcp`. An unauthenticated MCP request receives the canonical
RFC 9728 `resource_metadata` challenge. Its metadata declares the installation's
trusted issuer, installed tool scopes and Authorization header transport. A
write attempted with only read scope returns HTTP 403 `insufficient_scope`
with the required tool scope in that same challenge. Query-string access tokens
are refused even when an otherwise valid Authorization header is also present.
An expired token is invalid at its exact expiry. A lifetime of 900 seconds is
admissible; 901 seconds is refused. These checks do not extend native grants.
Absent or nonpositive expiry and issuance beyond the permitted clock skew also
refuse. An empty token scope cannot inherit read or preparation authority from
the matching native grant; each refusal names the missing tool scope.

`tests/agent-token-runtime.mjs` — `tokenJourney`, selected as `agent-tokens`
in the push runtime shard, exercises these boundaries through both real MCP
routes under autonomous and held company policies. It uses disposable signing
material, the existing signed Business settings and policy receivers, and an
agent bound by the native credential issuance route. It independently compares
retained native business and credential state around refusals and checks
populated durable audit and captured diagnostics for bearer retention. The
owner obtains fresh native proof through real single-use email-link requests
and confirmation, with only the declared mail provider faked at its network
edge. The journey runs the emitted production Worker over isolated HTTPS and
adds no production authentication path. It also refuses signed tokens naming an
unknown sponsor, a changed email, a foreign Business or no consent without
changing native business records or credentials.

An adopted signed Business policy can withdraw a consent immediately. Both MCP
routes refuse its next read, preparation, discovery and saved-result replay;
a captured older policy cannot reinstate it. Unrelated consent remains usable.
The existing owner action at `/agents/api/agents/:id/revoke` withdraws the whole
recorded Business agent, including its consent-bearing tokens; it does not
revoke an independently issued native credential. Native preparation repeats
the current consent check in its storage transaction, so a withdrawal after
admission cannot leave a new payroll preparation.

The native owner's Sign-in settings expose the existing Business settings stop
action at `POST /auth/settings/business`. It requires the current owner session
and recent native identity proof, repeated atomically with the retained stop
and attributed audit. Signed-out requests, Business bearers, native members,
foreign origins and sessions revoked during the stop cannot unpair. A stop
also withdraws Business token authority, removes that issuer from resource
metadata and refuses later signed settings and policy delivery. An in-flight
Business preparation repeats the stop check before its native effect. Restart
preserves the withdrawal. Existing native data and grants remain; native
email-link sign-in still works. Local policy is initially unanswered unless
the owner had already configured it, and the owner must explicitly configure
that policy before native agent work can resume. Stopping updates neither
adds a grant nor issues a replacement Business token.

The same journey replaces the installation's existing public-key bindings at
Worker restart. A key outside that ring cannot authenticate or update signed
Business settings or policy. During an administrator-provisioned overlap, both
keys can read; the replacement can prepare one genuinely retained native draft
using the original credential and sponsor. After removing the old public key,
its fresh calls, saved-result replay and signed settings and policy refuse,
including after another restart. The replacement token and independently issued
native credential still work. No test private signing key enters a Worker
binding, and changing the ring neither issues nor widens a native grant. This
proves consumption of configured public keys, not production key issuance,
distribution or an automatic key-refresh service.

These are installed native lifecycle proofs. Actual sibling-seed execution,
the complete OAuth and native JWT issuer lifecycle and production signing-key
issuance and distribution, end-to-end
Business revocation delivery within 60 seconds, dedicated native consent
selection and the remaining role and transport matrix are still owed by
BASE-AGENT-004. Receiving a disposable signed revocation is not evidence of
delivery from the production Business service.

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
executor, resource catalogue, streaming event feed, specialist prompt catalogue,
full payroll week, funded payment or agency filing claim in this CORE subset.
The broader SURFACE clauses remain targets until those native jobs are delivered.

Native company activity accepts `?operation=<shared-operation-id>` for reconciliation
with the shared audit. Native credential and company-policy admission fingerprints
are retained with local calls, so stale credentials and pending authority cannot
survive rotation or a native policy change. These fingerprints grant no scope.

Native scope reduction (`envelope.credentials.restrict`) carries access, keeps the calling grant identity, and accepts only retained actions, fields and locations. Adding any power or naming another credential refuses without changing the grant. A reduction invalidates prior admissions; repeating the retained scope leaves its revision unchanged.

The additive core migrations are 0044_business_settings.sql, 0045_business_people.sql, 0046_agent_door.sql, 0047_business_agent_bindings.sql, 0048_agent_door_policy_attribution.sql and 0049_agent_operation_lookup.sql; main’s existing 0001–0043 migrations remain unchanged.
