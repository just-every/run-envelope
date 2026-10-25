# Worker privacy and local retention

The native privacy API is under the company and person routes:

- `GET /api/envelope/companies/{company}/people/{person}/privacy` returns the structured retained set, field names, record keys, content-bound fingerprint, legal basis, custodian and earliest UTC release gate. It returns no private field values. Only the configured native owner with a current company owner grant can read it; every successful inventory read is audited.
- `POST` to the same path ending in `/retain` records an explicit legal classification. Supply the current `fingerprint`, an exact array of selected `records` IDs, `legalBasis`, `custodian`, `earliestReleaseAt` and `consent: true`. The instant must use UTC with milliseconds. Unclassified dependencies default to statutory retention with no releasable gate. An established gate can be extended but cannot be shortened through reclassification.
- `POST` ending in `/release` requires the same current fingerprint, exact record selection, an explicit release basis and consent. A fresh native sensitive-action proof is required. Each selected record must already have a classified, elapsed gate; the release is attributed and audited. Time alone never releases a hold. Changed record contents require a new review and release.
- `POST /api/envelope/companies/{company}/people/{person}/erase` requires the current person `version`, `consent: true`, fresh native sensitive-action proof and, for dependent records, the reviewed `fingerprint` and the exact array of all dependent `records` IDs. Every dependency must have an explicit current release. A released record remains present until this separate destructive gesture.

The same privacy routes are available as native forms from the worker screen's **Privacy and retention** link. The retained record families expand by keyboard or pointer to show every selected key, field, custodian, legal basis and UTC gate.

- `POST /api/envelope/companies/{company}/people/{person}/privacy/request` persists a held request. Supply the current `fingerprint` and explicit `consent: true`; fresh native proof is required. Repeating the request does not duplicate it.
- `GET /api/envelope/companies/{company}/privacy-requests` returns owner-only audited request history. The native page uses the same path beneath the app prefix. A completed request keeps an opaque receipt, timestamps and deletion count, with no worker identifier. A refused review remains held and the native form explains that no action completed.

While an explicit request is held, company reads and use are paused for other identities, including sponsored agents and previously issued protected responses. The configured native owner retains audited custody. This conservative company fence protects shared payroll derivatives; grants are not silently removed or expanded. A release does not reopen these transports before the separate erasure completes.

The local inventory follows company-scoped person references, SQL relationships, encrypted workspace references, derivative source pins and mapped hire sources. All versions of a selected workspace object join the inventory, including an initial claim request recorded before a native worker was attached. Firm work follows its source reference; embedded claim originals disappear with their owning encrypted versions. Deletion, journal tombstones, source replay fences and action-target anonymization commit together. The permanent audit removes erased worker attribution while keeping independent administrative actors and shared native identities intact. Agent action targets are anonymized too; a denied read cannot recreate an erased claim target in the audit. A concurrent product edit, changed authority, failed constraint or still-held record rolls the transaction back. Existing export snapshots are invalidated. A redaction checkpoint prevents an older archive from restoring the previous action targets when a later journal is supplied. Source IDs retired by erasure cannot be reused through the workspace intake door; mapped hire identities are also fenced.

There is no automatic payroll erasure, hold release or external destructive request. Downloaded copies and already-filed agency records are outside local recall. External provider deletion is a separate authorized obligation and this API sends no request.

ENV-054 remains partial. Native archive proof now includes mixed prepared payroll, claim originals and versions, documentary records, work allocations, rates, agent drafts and firm history; held native accountant and agent reads; and loaded, empty, held, failed and completed request screens at both required widths. The protected-response journey covers held and erased disclosure retrieval plus anonymized worker audit attribution. Exhaustive graph and restriction proof for every remaining notice, leave, intake and private-custody family remains owed. A separately tracked external-provider deletion-request lifecycle also remains to be built and proven. The wider custody obligation remains with ENV-028, ENV-051, ENV-053, ENV-054 and ENV-068 as their transports use these records.

## Bounded custody coverage

The native archive journey now seeds separate sick, PTO and holiday accounts,
with an opening review and later adjustment in each bank. It also seeds two
revisions each of a Willow benefit input and a Gauge earning input. The inventory
must name both encrypted revisions of all five objects. The same worker holds
SSN, bank and tax attachments and a work allocation.

`tests/archive-erasure.mjs` (`archiveErasure`) checks ordinary reads before the
request, refusal on every corresponding leaf transport while held, explicit
classification and release, absence after erasure, and refused intake replay
under a new worker. `tests/archive-runtime.mjs` (`archiveJourney`) inspects the
actual exported revisions and derivative rows and supplies the older-archive
resurrection probe. The existing legal-basis, UTC-gate, stale-fingerprint and
anonymous-audit assertions apply to this mixed retained set.

This is bounded proof, not exhaustive custody certification. Remaining work
includes mapping worker-bearing notice bodies and their analysis, reply, review,
approval and dispatch records; mapped hire sources and every supported HRIS event
and earning adapter; connected leave handoffs and their shared run derivatives;
and the full private-document transport inventory. Notices currently have no
explicit worker association, so a company notice must not be assumed to belong
to an erasure scope merely because the worker belongs to that company. Separate
external-provider deletion requests and their evidence remain unimplemented;
local completion never claims external deletion.
