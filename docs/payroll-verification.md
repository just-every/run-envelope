# Consented protected verification

Person pages link to `/app/envelope/companies/:company/people/:person/verification`;
the same `/api/` path returns JSON. This is the contract's protected-response
option. It has no external partner enrollment, outbound request or automatic
payroll-history export. Native identity alone grants no company payroll access.

## Protected-response policy

Only a linked worker can give explicit consent for a known native requester,
one lawful purpose (mortgage, rental or employment), an exact inclusive period of at most
366 days and selected hire date, employment status or period gross wages.
There is no legal-authority override, model approval or owner-created worker
consent. Only the company owner may link identities, review sources or release
a response. Consent lasts at most 30 days; the worker selects a restricted
history retention date within 90 days. Retrieval ends at consent expiry or
revocation, a changed worker/issuer identity or grant, a changed worker link,
a withdrawn approval, or changed source evidence. Retained evidence is private;
verification custody uses the explicit statutory-hold and lawful-release doors under ENV-054.
ct approved these protected-response defaults with riders on 23 October 2026.
The legal-authority handling default is adopted pending ct approval: deny by
default, require the linked worker’s current explicit consent and owner-only
exact source review and audited release. It grants no override or new exposure,
and enables no automatic destructive action or outbound submission. ENV-068
remains PARTIAL until ct approves this default.

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
  `fields` (hireDate, employmentStatus and grossWages), `expiresOn`, `retentionUntil`.
  API callers may supply an exact canonical UTC `expiresAt` instead of the date; `retentionUntil` also accepts a canonical UTC timestamp.
  The actual native worker session signs the immutable consent; a client actor,
  another worker or bearer cannot stand for it. Worker company access may be
  limited to `records:read` at their location with no compensation grant.
- Worker POST `/consents/:id/revoke`; POST `/consents/:id/corrections` with a
  `reason` records an owner source-review task and changes no wages.
- Owner POST `/disclosures`: `id`, previous `version`, `consentId`, optional
  earlier disclosure `corrects`. Optional `basis` is `worker-consent` (default)
  or `legal-authority`. Legal authority requires a documented `sourceAuthority`
  (source reference and scope) and `requesterEvidence` (identity and authority
  evidence). These encrypted fields join the exact owner review with the consent’s
  purpose, requester, period and fields. They confer no override and never reach
  the requester. The response contains only selected facts;
  employment comes from the real reviewed Willow hire-to-person link or reviewed Willow hire/termination source versions and
  wages from reviewed original register references for the complete exact period. Requesters receive only opaque source IDs and versions; the owner review retains original document references.
- Owner GET `/:kind/:id/review` and POST `/:kind/:id/approve` with its `version`
  and same-session `reviewToken`. Kinds: verification-worker, income-source,
  disclosure. POST to the same record ending in `/withdraw` withdraws an existing
  approval and immediately invalidates dependent retrieval. Tokens expire in ten minutes; no client approval flag works.
- Owner POST `/disclosure/:id/release` with `version`. It atomically rechecks
  consent, worker binding, exact reviewed payload, current issuer identity and
  sources. It returns one release ID and private random token, shown once in the
  native handover screen. Give them only to the named verified requester through
  an approved private channel. No delivery is claimed by minting a token.

The requester uses `/app/envelope/protected-response` while signed in as that
exact identity. API POST `/api/envelope/protected-response/read` takes `id` and
`token` in the body, never a URL. The token alone authorizes nothing. Retrieval,
current permission and source checks, an audit event and opened receipt share one D1
batch. POST `/api/envelope/protected-response/ack` records a separate explicit
acknowledgement. An old source response becomes unavailable after correction;
a fresh exact reviewed response links back to it without replacing its history.

The worker's verification screen shows scoped requests, requester identity,
selected periods and fields, the facts actually disclosed, linked corrections, releases, opened and acknowledged receipts and correction
tasks. Once the selected retention deadline passes, worker and ordinary owner disclosure views retain metadata and restrict response bodies and correction text; source payroll records retain their separate custody obligations. Every release and receipt is attributed; correction reasons, consents,
wage facts and response bodies are encrypted at rest. The token hash alone is
stored. All native controls have visible text labels; no icon-only controls
are introduced. Browser proof masks the one-time handover token.

## Boundaries and inherited custody

The protected route is not Work Number enrollment or a provider submission.
No live partner receipt is claimed. Imported historical wage provenance needs
its original reviewed documents; an earnings-only preview cannot stand for it.
ENV-028, ENV-051, ENV-053, ENV-054 and ENV-055 inherit the protected-response
transport, the verification-worker, income-source and disclosure workspace kinds,
and the three verification tables on their later journeys.

`tests/payroll-runtime.mjs` — `incomeVerificationJourney` now records a reviewed
Willow termination, signs the same worker out, confirms a single-use native
return link, and compares their complete restricted verification history before
and after sign-in. The link is a synthetic identity-edge fixture, not a live
mail receipt. A new consent and exact owner review return terminated status,
unchanged hire date and corrected gross wages with all original source versions.
The worker and requester screens are captured at 1440 and 390. Unrelated workers
remain refused. This existing continuity proof is preserved by the later authority
and custody additions.

## Current requester identity and former workers

Consent pins the requester identity version as well as the worker identity and
current grant. Deactivating and reactivating either identity, changing a worker
grant or reviewing a different worker link cannot revive an earlier response.
A different linked identity cannot inherit the original worker's consent,
disclosure or correction history. A fresh native sign-in preserves the same worker and authorized history, but a
new request needs current explicit consent and exact owner review. Existing
consents migrated without a requester version are unavailable for release or
retrieval; workers must give fresh consent.

Worker and requester documents accept `?lang=en` or `?lang=es`. Native forms
retain that language through consent, revocation, correction and receipt.
Fields, periods, identifiers and source values keep the same meaning and
permissions in either language; language never grants access.

The native privacy door inventories each verification consent, released version,
receipt and correction with exact keys and fields, legal basis, custodian and a
UTC release gate. Unclassified records remain statutory. Held ordinary reads
and protected retrieval refuse; owner retained reads are audited. Release needs
an exact current selection, elapsed gate and fresh native proof, then erasure
is a separate explicit action. The verification journey proves changed-source
selection refusal, no shortened gate, stale-proof refusal and removal of local
verification derivatives with anonymized worker attribution. An old release
cannot be opened or acknowledged after erasure. Downloaded copies and filed
agency records remain outside local recall. No external deletion is sent.

## Verification transport proof

The existing `incomeVerificationJourney` in `tests/payroll-runtime.mjs` exercises
the legal-authority request through the same real disclosure door: no consent,
missing authority evidence and requester self-release refuse; the exact owner
review releases only the consented facts. The worker sees the request basis and
receipt. A corrected wage source invalidates the old response and a new exact
review produces a linked correction. Consent revocation also invalidates that
legal-authority response. No additional authority is enabled.

Custody covers the verification history JSON and native HTML, owner reviews of
worker links, wage sources and disclosure versions, protected retrieval and
receipt acknowledgement, and the native archive CLI. While held, all ordinary
worker and requester transports refuse, owner retained reads remain audited,
and protected responses remain unavailable. After explicit eligible erasure,
old history and review doors, source replay, response tokens and acknowledgements
refuse. The exact retained inventory includes every consent, response, receipt,
correction and source revision with its fields, legal basis, custodian and UTC
gate. Existing early-release and stale-proof refusals remain required.

`verificationArchiveCheckpoint` in `tests/archive-runtime.mjs`, called inside
that same native journey, exports the actual pre-erasure verification records
and inspects exact encrypted rows with inactive authorization. After erasure,
the real current export contains no erased verification rows. Importing the old
archive with the later erasure journal refuses at the erasure fence and publishes
no business or identity rows in a separately migrated target. Recovery keys in
this test belong only to the disposable synthetic installation.

English and Spanish owner, worker and requester documents retain the same
permissions and language through native forms. The journey asserts Spanish
empty history, loaded facts, held history, failed retrieval and acknowledged
completion with keyboard actions and screenshots at 1440 and 390. Controls on
these screens have visible words; none is icon-only. The local-recall boundary
and separate explicit release and erasure remain unchanged.

The period bound is also checked before proposing or releasing a retained consent
and before protected retrieval or acknowledgement writes a receipt. Older requests
cannot bypass the current bound. Statutory retained metadata remains subject to
the same restricted history and explicit custody review.

## Request-specific consent

Worker consent names `requestId`, the exact initial disclosure identifier, and one selected field set. A second request or changed fields requires fresh worker consent. A linked correction retains the same consent and request lineage; it cannot use another request’s consent. The worker may revoke before release. A release attempted after withdrawal is refused and attributed as `verification.release-refused-withdrawn`, with no response token, release row or outbound submission. Custody screens name the server clock and render release gates in UTC.
