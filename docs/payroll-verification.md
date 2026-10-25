# Consented protected verification

Person pages link to `/app/envelope/companies/:company/people/:person/verification`;
the same `/api/` path returns JSON. This is the contract's protected-response
option. It has no external partner enrollment, outbound request or automatic
payroll-history export. Native identity alone grants no company payroll access.

## Approved protected-response policy

Only a linked worker can give explicit consent for a known native requester,
one lawful purpose (mortgage, rental or employment), an exact period of at most
366 days and selected hire date, employment status or period gross wages.
There is no legal-authority override, model approval or owner-created worker
consent. Only the company owner may link identities, review sources or release
a response. Consent lasts at most 30 days; the worker selects a restricted
history retention date within 90 days. Retrieval ends at consent expiry or
revocation, a changed worker/issuer identity or grant, a changed worker link,
a withdrawn approval, or changed source evidence. Retained evidence is private;
full statutory retention/erasure custody remains unfinished under ENV-054.
ct approved these protected-response defaults with riders on 23 October 2026.
The incomplete custody, legal-authority and former-worker journeys keep the
clause partial. Approval confers no legal-authority override.

## Public doors

- Owner POST `/worker`: `workerId`, previous `version`, `evidence`. This creates
  a proposed `verification-worker` record. Review it through the route below;
  it does not grant payroll powers to the worker.
- Owner POST `/income`: `id`, previous `version`, `from`, `through`, `grossCents`,
  original payroll `sourceRef`, reconciliation `evidence`. These are documented
  historical register facts, not a new payment or a fabricated rail receipt.
  Each version needs exact review; overlapping or incomplete periods refuse a
  precise gross-wage response.
- Linked worker POST `/consents`: `requesterId`, `purpose`, `from`, `through`,
  `fields` (hireDate/employmentStatus/grossWages), `expiresOn`, `retentionUntil`.
  API callers may supply an exact canonical UTC `expiresAt` instead of the date; `retentionUntil` also accepts a canonical UTC timestamp.
  The actual native worker session signs the immutable consent; a client actor,
  another worker or bearer cannot stand for it. Worker company access may be
  limited to `records:read` at their location with no compensation grant.
- Worker POST `/consents/:id/revoke`; POST `/consents/:id/corrections` with a
  `reason` records an owner source-review task and changes no wages.
- Owner POST `/disclosures`: `id`, previous `version`, `consentId`, optional
  earlier disclosure `corrects`. The response contains only selected facts;
  employment comes from the real reviewed Willow hire-to-person link or reviewed Willow hire/termination source versions and
  wages from reviewed original register references for the complete exact period. Requesters receive only opaque source IDs and versions; the owner review retains original document references.
- Owner GET `/:kind/:id/review` and POST `/:kind/:id/approve` with its `version`
  and same-session `reviewToken`. Kinds: verification-worker, income-source,
  disclosure. Tokens expire in ten minutes; no client approval flag works.
- Owner POST `/disclosure/:id/release` with `version`. It atomically rechecks
  consent, worker binding, exact reviewed payload, current issuer identity and
  sources. It returns one release ID and private random token, shown once in the
  native handover screen. Give them only to the named verified requester through
  an approved private channel. No delivery is claimed by minting a token.

The requester uses `/app/envelope/protected-response` while signed in as that
exact identity. API POST `/api/envelope/protected-response/read` takes `id` and
`token` in the body, never a URL. The token alone authorizes nothing. Retrieval,
current permission/source checks, an audit event and opened receipt share one D1
batch. POST `/api/envelope/protected-response/ack` records a separate explicit
acknowledgement. An old source response becomes unavailable after correction;
a fresh exact reviewed response links back to it without replacing its history.

The worker's verification screen shows scoped requests, requester identity,
selected periods/fields, the facts actually disclosed, linked corrections, releases, opened/acknowledged receipts and correction
tasks. Once the selected retention deadline passes, worker and ordinary owner disclosure views retain metadata and restrict response bodies and correction text; source payroll records retain their separate custody obligations. Every release and receipt is attributed; correction reasons, consents,
wage facts and response bodies are encrypted at rest. The token hash alone is
stored. All native controls have visible text labels; no icon-only controls
are introduced. Browser proof masks the one-time handover token.

## Remaining obligations

The protected route is not Work Number enrollment or a provider submission.
No live partner receipt is claimed. Full legal-authority handling, the full retained-data/erasure lifecycle and complete former-worker authority and language coverage remain unproved. Imported historical wage provenance needs
its original reviewed documents; an earnings-only preview cannot stand for it.
ENV-028/051/053/054/055 inherit the protected-response transport, workspace kinds
verification-worker/income-source/disclosure and the three verification tables
when their complete access, archive, erasure and external-flow journeys are built.

`tests/payroll-runtime.mjs` — `incomeVerificationJourney` now records a reviewed
Willow termination, signs the same worker out, confirms a single-use native
return link, and compares their complete restricted verification history before
and after sign-in. The link is a synthetic identity-edge fixture, not a live
mail receipt. A new consent and exact owner review return terminated status,
unchanged hire date and corrected gross wages with all original source versions.
The worker and requester screens are captured at 1440 and 390. Unrelated workers
remain refused. Complete former-worker language and authority coverage, full
statutory custody and legal-authority handling remain open.
