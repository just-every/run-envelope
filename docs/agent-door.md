# Envelope's shared company agent door

Envelope serves one Base door at `/mcp` and the alias `/api/envelope/mcp`.
The existing `/api/envelope/v1` agent REST routes invoke that same door and
retain their native REST vocabulary. It supports MCP 2026-07-28 and 2025-11-25. Use discovery and the canonical
OAuth metadata; send the negotiated protocol and method/name headers. Tools
have JSON input/output schemas, scopes, computed classes and contract citations.
Refusals use `code` and MCP `com.runeditrun/error` metadata.

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

The shared signed policy receiver is `/api/rer/agent-policy`. Native people use
`/agents`, its approval/review pages and person JSON doors. Standalone owners
configure the shared policy there; paired installations use Business. The native
company's existing class restrictions and Pause remain additional restrictions,
including at native SQL effects. Neither policy supplies missing native authority.
Native access records retain the signed agent, sponsor, originating operation,
consent and named approvers alongside the original grant ID. For generic notice
correspondence, a successful extraction retains its exact agent and sponsor as
preparer. The human selects the exact retained proposal, or explicitly chooses
native human preparation; a later extraction cannot relabel that choice. The API
requires `analysisId` containing that retained proposal ID or `human`. Native reply
preparation requires an explicit sending identity and a
named human reviewer. The selectable identity is a current native grant, or its
explicit Business binding; its configured name must match the actual calling
identity. Sender, recipient, preparer, sending agent and sponsor, human reviewer,
message and provider version are encrypted and digested together before review.
The reviewed message includes the preparer, sending identity and human reviewer
as separate attribution lines. The separately authenticated designated person
must still perform exact native approval with fresh proof. Shared policy approval
never substitutes for that ceremony, and an agent cannot approve through it.

The external recipient count is one: this door accepts one validated mailbox,
never a recipient list. A destination is **known** only when retained
provider-accepted correspondence in the same company and the reviewing person's
permitted locations contains that exact mailbox. The immutable review retains
the earlier reply version, digest and provider receipt as destination evidence;
acceptance is not delivery. Without that evidence the destination is **new**.
Model output, internal-recipient claims and confirmation text cannot alter these
facts. The facts stay bound to the reviewed version, including on completed
idempotent replay.

Changed recipient, payload, provider or sending identity requires another saved
version and fresh exact review. Changed grant, sponsor or designated reviewer
authority prevents execution under the old review. Dispatch uses only the pinned
sender and attribution, never an unreviewed footer or identity header. The native
notice record, Agents activity and permission-filtered agent access download
preserve preparer, actual sending agent and sponsor, and the separate native human
approval. Each effect is linked by its execution identity to its exact reply
version, including a separately reviewed replacement after a definite rejection.
The access download contains attribution, not reply text or addresses.
Accepted and unknown dispatches retain one durable intent across fresh admission,
replay and restart; an unknown effect is held for human reconciliation without an
automated retry. Archives retain this evidence but no active credential, provider,
review session or sending authority. Historical replies without the new identity
pins require fresh preparation and exact approval before any new effect.

This slice changes no RL-6 casework authority and no RL-13 reference-event
consent. Returns, reports, new-hire and claim submissions, signed mandates,
report links, verification disclosures, ledger posting, other transports and full
payroll-week and Base conformance remain owed by SURFACE-003 and its inheritors.

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
