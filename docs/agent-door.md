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

Masked worker pages retain the standard class and return only worker identity,
location and version. Reading a retained hourly proposal or bonus preparation,
or a page of either preparation report, carries sensitive with kind
`compensation`. The measure is the number of permitted records returned on that
page, including zero for an empty page; pagination lookahead does not count.
These reads still require the existing native read action, compensation field,
credential ownership and location scope. Bonus reads retain their existing
company-wide location requirement. A company policy cannot add a field or role
permission that the sponsoring person lacks in the native UI.

Classification selects the actual authorized response without an access write.
The approval summary retains an opaque fingerprint of that selection, including
its contents, page cursor and native grant revision. Execution repeats current
authority and reads the response under the native access audit. A changed
selection refuses with `read_selection_changed`; pending approval refuses when
its retained selection has changed, even if the record count stays equal.
Retrieving an approved read rechecks the same selection rather than returning
retained compensation under a different decision. Equivalent JSON property order
keeps that selection identity. After the native access read and policy audit
finish, delivery selects the response again under the original authority and
policy fence. A correction or erasure after the access batch therefore refuses
the earlier response; a fresh call must obtain a new decision. Restart does not
reset these checks. Refusals require a fresh read and, when policy requires it, fresh approval.
The MCP door, its alias and the existing agent REST reads use this same path.
Successful REST GET and HEAD reads expose the same computed facts in
`x-envelope-classification`; HEAD returns no content. Refused reads have no
completed-selection header. Empty compensation pages still carry sensitive with
a count of zero. No extra selection is made to compute the REST header.

This increment adds no SSN, bank-number, tax-document or export tool and no
erasure or hold-release authority. Complete private-document custody and the
remaining destructive classifications remain owed by SURFACE-004. Calculation,
verified-bank, payment and provider holds remain in force. Reads send no outbound
request and introduce no automatic action, retry or destructive recovery.


## Native private reads and custody classification

The existing human-session doors keep their separate native permissions. A record
reading agent credential gains no SSN, bank, paper, export, erasure or hold-release
power. Class decisions and supplied approval claims cannot supply those powers.

Successful native SSN, bank-document and tax-document downloads carry
`x-envelope-classification`, with `sensitive`, a count of one and the selected
kind. Signed paper originals, retained tax-notice documents and IRS withholding
instruction originals use `tax-document`. The byte response stays an attachment
with private cache controls. Person detail reads count the permitted compensation
rows; an identity-only detail is standard. The identity register export is
standard, reports its actual returned worker count including zero, and contains
no private values or compensation.

An explicitly authorized native owner erasure request records `destructive` and
`sensitive` with the complete selected worker-record count. An eligible hold
release records the selected hold count in one aggregate audit event, alongside
the existing per-record custody events. Completed erasure records the actual
deleted count against its anonymous receipt. These classifications are returned with the native action response and share the
native audit transaction after the metadata migration; they survive restart. A
pre-upgrade installation keeps its original audit rows and returns response
classification without inventing historical metadata. Stale fingerprints, ineligible
holds, replayed releases and missing current human authority create no completed
classification. The audit download exposes these facts without retained values
or erased subject identifiers. No classification releases a hold, selects a
retention policy, performs an outbound action or supplies a human decision.

Private agent reads and exports, delegated destructive tools and full transport
coverage remain unavailable. Their eventual implementations inherit the same
classification and current-authority duties; this native increment does not
supply them. Existing provider, payment, calculation and statutory-custody
boundaries remain in force.

Native private-record delivery repeats current session and company authority
after decryption and checks that the exact selected record and worker still
exist unchanged. A correction or erasure while that read is suspended refuses
delivery; the caller must make a fresh read. Revocation likewise cancels the
pending read. A refused response contains neither private bytes nor a successful
classification header.
