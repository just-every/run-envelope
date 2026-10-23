# SIDES E-Response artifact boundary

Envelope's portal boundary prepares a private response packet for an authorized human to transfer into SIDES E-Response. It transcribes documented portal fields and imports confirmation evidence. It sends no network request, performs no browser automation and defines no fictional SIDES JSON endpoint. Preparing, signing, printing or downloading a packet never means that an agency received it.

The module is `src/envelope/claims/portal.ts`; its input and output types are in the adjacent `portal-types.ts`. The route and records layer must enforce current owner authority, match the claimant to the company's payroll person using the private identifier, retain evidence privately, bind approvals to exact versions and prevent replay. Passing a reviewer or signer name in arbitrary client input cannot establish authority. These pure functions normalize artifacts; they are not an authentication boundary.

## Official sources

The implementation uses two publicly available, Maryland agency-hosted NASWA guides. The downloaded PDFs do not state a revision date. The schema identifier therefore records the inspection date, not an invented publication edition.

| Guide | Downloaded source SHA-256 |
| --- | --- |
| [Separation Information E-Response Users Guide](https://labor.maryland.gov/employment/ui-sides_separationinformationeresponseuserguide.pdf) | `56b48b267f89631d02f93e88f6a96182d704498abbf39b46bf5eaa5c9c068743` |
| [Earnings Verification E-Response Users Guide](https://labor.maryland.gov/employment/ui-sides_earningsverificationeresponseuserguide.pdf) | `c5fca8cb7d07f3428932c5a1666709911010e78f06181562ca78f0708533365e` |

Source metadata and screenshots are under `./tests/fixtures/sides`. They show official example screens, not requests or receipts from an employer account. `portalFieldSchema` exposes local field keys, visible question labels, exchange applicability and source PDF page ordinals. Local keys are not claimed to be official XML element names, hidden HTML controls, a complete Central Broker schema or a wire protocol.

The separation guide shows company State, FEIN and SEIN; request Name, SSN, Claim Number, Request date, Due date and Response Status; employment and separation questions; wages and payments; relevant documentation; preparer details; response review; and confirmation. Reason-specific questions vary. The list of reasons preserves the guide's literal “Still Employer, Hours Reduced” wording, including its apparent typo; it is not a claim about the current portal's hidden option values.

The earnings guide specifies Sunday-through-Saturday earnings regardless of the payroll frequency. It shows work and payment questions, salary and pay-period information, payment-type selection, daily hours, earnings and date paid, a summary and additional information. Hours are entered as hours and minutes, not decimal fractions. Payment dates or allocated dates may also be required by the state. A payroll-period gross amount cannot be divided into artificial daily or weekly earnings merely to fill this form.

The current [Maryland employer reporting page](https://labor.maryland.gov/unemployment-insurance/employer-agent/reporting-systems.shtml) describes BEACON, E-Response and the state-provided request PIN. [NASWA](https://www.naswa.org/uisides) distinguishes E-Response from Central Broker integration. Actual portal use needs the employer's or representative's legitimate state access and mandate. This artifact boundary does not collect the portal PIN, create an account, claim integration certification or bypass enrollment.

## Request transcription

`parsePortalRequest(input)` accepts a local transcription of an original official request or its portal screen:

- `exchange`: `separation` or `earnings`.
- `requestId`: the displayed claim number, with `issuedOn` representing the displayed Request date; no unobserved global GUID is invented.
- `agency`, `state`, `employerEin`, `stateEmployerId`, `claimantName` and the full `claimantIdentifier`. An SSN with hyphens is normalized to nine digits and remains private.
- `dueOn`, `deadlineAt`, `timeZone` and optional `deadlineBasis`.
- `sourceRef` and `sourceSha256`, pointing to the privately retained original artifact.
- Optional transcribed `claimantStatedReason`, `responseStatus` and `requestedWeeks`, with Saturday week-ending dates.

Dates use ISO date strings. Instants use UTC ISO strings. The exact time in `deadlineAt` must fall on `dueOn` in the supplied IANA timezone. The guide demonstrates an agency due date, not a universal national filing time. Unless `deadlineBasis` explicitly identifies an agency-specified instant supported by the retained source, the instant is labeled an internal cutoff on the agency due date. Never manufacture a legal deadline time from a date-only notice. Original dates stay retained; an internal cutoff must not replace the agency's due date.

The normalized `requestIdentity` includes state, EIN, state employer ID, exchange, displayed claim number and Request date. Separate requests on the same claim therefore do not collapse into one. Replaying the same request should resolve to its existing case in the records layer; a changed source digest or changed facts needs explicit correction handling. The only supported transfer URL is `https://uisides.org/`; arbitrary request URLs cannot turn a packet into a new outbound destination.

## Cited response preparation and signature

`preparePortalResponse(input)` is asynchronous. It takes the parsed request, company legal identity, matched local worker, actual payroll-evidence references, reviewed Willow separation facts, portal answers, preparer and optional attachments. For a separation response, Willow facts must identify their source artifact and version and digest, source approver and approval time, local reviewer and review time, effective date, separation date, last worked date, original HR reason, explicitly human-selected `portalReason` category and factual narrative. A free-text HR reason is retained as evidence; it is not automatically translated into an official separation category. The boundary refuses missing Willow evidence and conflicting last-worked dates or reasons. A claimant-stated reason conflicting with the proposed employer reason remains for the named representative; it cannot silently become an approved factual assertion.

Each answer contains `field`, `value` and one or more `citations` naming the supplied payroll record ID, Willow artifact ID or permitted attachment ID. Unknown citations are refused. Additional questions genuinely present in the request may use a key beginning `agency-question:` plus the exact `question` and a `questionSourceRef` matching the original request. This records an actual agency question rather than inventing a generic answer for every possible separation reason.

Common separation answers are `employerReason`, `jobTitle`, `firstDayOfWork`, `lastDayWorked`, `seasonal`, `compensationAfterSeparation`, `pensionOr401k` and `workersCompensation`. Last worked date and employer reason must cite the reviewed Willow artifact. Known yes or no fields take exactly `Yes` or `No`; dates take ISO dates. Conditional compensation categories, incidents, warnings and other questions still need their actual request prompts and cited answers where applicable.

Common earnings answers are `workedOrReceivedPayments`, `stillWorking`, `regularRate`, `payFrequency`, `payPeriodStart` and `payPeriodEarnings`. Values are reviewed literal answers for human entry, with all units and actual daily breakdowns included when needed. The boundary does not derive workday allocations from payment dates, convert a preview into a paid wage record or resolve disputes about eligibility.

Every payroll citation includes kind, record ID, version, source reference, covered dates and gross cents. The caller must select genuine reviewed historical payroll evidence for the requested period. A preview or an unreviewed imported assertion cannot become a paid-payroll fact merely by being passed to this function. Preparer details follow the visible Employer or TPA, Name, Job Title, Phone, Email and Fax fields.

Attachments contain only private file references and metadata, not downloaded content. Supported types follow the agency's published E-Response attachment description: PDF, plain text, CSV, RTF and TIFF. The boundary caps ten attachments and a conservative five million bytes total. The caller must verify file bytes, type and digest, and include only permitted, relevant evidence. The [Pennsylvania agency guide](https://www.pa.gov/agencies/dli/programs-services/unemployment/for-employers/sides/respond-to-claims-sides) documents the attachment types, ten-file maximum and five-MB combined limit. A metadata parser cannot sanitize or authorize an actual file by itself.

The output contains `schemaVersion`, `requestIdentity`, `responseDigest`, `fields`, `packetHtml`, `transferStatus: 'prepared-not-submitted'` and source editions. Its digest binds normalized request, company, worker, source versions, factual evidence, all answers, preparer and attachment digests. The HTML is escaped, contains no scripts or remote resources, has a restrictive content policy, is printable and masks SSN to the last four digits. It is an Envelope preparation packet, not a counterfeit agency form or receipt.

First prepare without `approvedSignature` to review the exact digest. After native human approval, prepare again with the persisted `{signerId, signerName, signedAt, responseDigest, statement}`. A changed digest refuses the signature. The caller must recheck the signer, current mandate, current evidence, expiry and exact case revision before permitting transfer. The pure boundary cannot distinguish a trusted persisted signature object from a forged raw HTTP field on its own.

## Human transfer, confirmation and follow-up

The authorized human opens the official portal, selects the matching request, enters the exact reviewed answers and minimal permitted attachments, inspects the official View Response output and selects Submit. The official guide explicitly distinguishes viewing the response from submitting it. The prepared packet does not complete unobserved dynamic questions automatically; the human must reconcile them against the approved source facts. Material changes require a fresh exact approval in Envelope.

`parsePortalConfirmation(input, request, packet)` matches employer identifiers, request identity and exact response digest. It records the actual confirmation number, transcribed submission time, original source reference and source digest. With no reviewed original artifact it returns `reported-unverified` and `responseAccepted: false`, even if someone typed a confirmation number. To recognize reviewed agency confirmation, the caller supplies `evidenceReview` from its authorized review of the retained original, matching the artifact digest and the guide's explicit acceptance message. The result is `agency-confirmation-reviewed`, meaning response receipt was evidenced; it does not determine benefit eligibility, employer liability or closure of every claim issue.

Confirmation metadata is a local transcription, not a signed callback or independently authenticated agency API event. Retain the original downloadable response and confirmation evidence privately; the guide warns that portal records disappear after 35 days and that the confirmation is not emailed. Never use a generated packet, a browser click, an HTTP success or a human statement alone as acceptance evidence. The parser exposes both cutoff-relative timing and agency-date-relative timing so an internal cutoff is not confused with the legal due date.

`parsePortalFollowUp(input, request)` records scoped official correspondence, its source digest, agency reference, received instant, exact questions, new due date and cutoff and named owner. It returns `needs-human-response`, preserving an overdue-at-receipt flag rather than rejecting late correspondence or pretending the original confirmation closed the case. The public guides do not document a JSON callback contract, so this is explicitly a correspondence transcription, not a fabricated SIDES callback parser. A new response needs the same fact review and exact signature process; the records layer owns versioning, once-only dispatch reconciliation and escalation before the actual agency deadline.

## Proof boundary

Account-free journeys can exercise the real application doors using synthetic identifiers and official portal-field artifacts at the allowed agency schema edge. Source screenshots under `./tests/fixtures/sides` ground the field mappings and separation between review, submission and confirmation. They do not prove a live employer enrollment or submission. If an applicable agency sandbox is available, the contract's sandbox convention still applies. Production readiness separately needs authorized state access and real submission evidence; no successful local parser changes that requirement.

## Public employer workflow

The company’s Unemployment claims page retains the original request and assigns a current native human employer representative before matching evidence. Evidence review matches the private worker identifier, native reviewed wage records, original Willow manifest, employee records and completion audit, and an effective employer mandate. The Willow export fixture was produced by native completed joiner and leaver workflows at Willow commit `10dc2cae`; it is retained in `tests/fixtures/sides/willow-native-capture.json`. Actual last day worked stays distinct from the employment end date. Missing facts and disputed assertions remain assigned holds; resolving a dispute requires retained original evidence.

The representative reviews the exact answers and evidence, confirms signing access using the native email proof route, and signs that response only. Before recording one human handoff, the representative uploads the original agency View Response and confirms that every question, answer and attachment matches the signed packet. Typed receipt metadata alone stays unverified. Explicit human review of the original acceptance confirmation records receipt, separately from benefit eligibility and independent live agency verification. New agency inquiries run through the same preparation, signature, preview and confirmation sequence with their own deadlines; earlier signed packets and confirmations remain available as immutable evidence. See `docs/claims-follow-up.md`.

`claimsJourney` in `tests/claims-runtime.mjs` covers separation and requested-week earnings, wrong employer and claimant refusals, missing and disputed evidence, exact signature proof, stale payroll refusal, one handoff, retained confirmations, replay and an answered follow-up. `claimsBrowser` in `tests/claims-browser.mjs` exercises the same forms at 1440 and 390 pixels, including empty, held, prepared, signed, handoff, confirmed and follow-up states. `tests/claims-portal-edge.mjs` supplies only the documented agency artifact boundary; no fixture is installed in the application or represented as a live agency receipt.
