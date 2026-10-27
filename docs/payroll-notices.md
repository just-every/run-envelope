# Declared notice processing and exact correspondence

These optional notice doors use the existing company, location and field
authority. Their scoped credential and implemented privacy boundaries are covered
by ENV-052 and ENV-055. They do not complete ENV-025, ENV-034, ENV-035, ENV-062
or the payroll engine. No notice text, model output or client approval flag can
approve, choose a new provider, change bank details, pay wages or sign a filing.

## Owner declarations and custody

Open **Agent credentials → Declare external providers**. Fresh app-local proof
and explicit consent are required to enable a declaration. `POST /providers`
accepts `{id,version,enabled,consent,secret?,sender?,removeCredential?}`.
An owner with fresh proof may set `removeCredential:true` only with the provider
disabled and no replacement secret. This clears its encrypted credential, bumps
the declaration version and records the existing declaration audit. Re-enabling
requires a new credential and explicit consent. Keys are encrypted with the
independent payroll record key, never returned, placed in the DOM, logged or
exported. Omitting a replacement key retains the existing ciphertext. Version
checks prevent concurrent setting overwrite. Disable rather than silently fall
back when a key/account is absent. Owner-only setup changes are audited.

| Declaration | Destination and schema | Minimum data and purpose |
| --- | --- | --- |
| `openai`, model `gpt-4.1-mini` | `https://api.openai.com/v1/responses`; OpenAI Responses API, structured JSON output (`text.format`, 22 Oct 2026) | Redacted notice text only, summary and proposed reply; `store:false`, no tools, no payroll records. OpenAI API retention terms still apply; this is not a zero-retention claim. |
| `resend` | `https://api.resend.com/emails`; Resend Send Email API (22 Oct 2026), `from`, `to`, `subject`, `text`, `Idempotency-Key` | Exact human-approved sender, recipient, subject and redacted reply; no attachments, tracking, payroll records or raw identifiers. Provider processing and delivery custody follow the owner's Resend terms. |

These fixed recipients/purposes/fields are also in `seed.json` external-flow
metadata and the installation's company settings. Credentials go only in the
appropriate provider's authorization header. Redirects are refused. SSN formats,
long numeric account identifiers, labeled identifiers and bearer-like strings
are redacted before model requests, before reply storage and from model output.
No SSN/bank task is authorized by these flows. Originals remain encrypted private
evidence; default notice screens redact them. Disabling optional AI preserves
deterministic records/settings and correspondence approval. Calculation/payment/
filing/reconciliation independence remains unproved until those full doors exist.

## Public human doors

Use a current native human session and same-origin POSTs under
`/api/envelope/companies/:company`. `notices:read`/`write`/`approve` powers require
the `tax` field and the notice's current location. Company owners have their
normal full scope. Native forms use the corresponding `/app/envelope` paths.

- `GET /notices`, `POST /notices` with `{reference,locationId,body}`: record actual
  source text (12,000 characters maximum), immutable encrypted original/digest.
- `GET /notices/:id`: permitted source, untrusted model proposals, exact latest
  reply versions, approval and provider-result states.
- `POST /notices/:id/replies`: `{id?,version?,to,subject,body}`. The human verifies
  the recipient independently. The declared sender, provider version, original
  notice digest and exact message determine the reply digest. Editing appends a
  new unapproved version; source notice and prior reply snapshots stay immutable.
- `GET /notice-replies/:id/review`: current exact content/version/digest and a
  ten-minute session/operator/grant-bound review token.
- `POST /notice-replies/:id/approve`: `{version,digest,reviewToken,minutes?}`.
  Requires fresh app-local human proof and current approval scope. Approval lasts
  1–60 minutes (default 10). Agent headers are refused even with a human cookie.
- `POST /notice-replies/:id/withdraw`: `{version}`. A current approver can withdraw
  an undispatched exact approval. A send already started/unknown/accepted cannot
  be recalled by pretending its approval was withdrawn.

## Agent processing and dispatch

The scoped MCP `notice.process` sends only the recorded redacted notice to the
fixed declared model. Text naming another provider is inert evidence. The
response must contain only the structured summary/proposed-reply strings.
Tool calls, malformed output and provider failures produce no invented result.
The model proposal has no approval, signature or recipient authority.

MCP `reply.dispatch` requires the reply ID, version and digest. The atomic
execution claim rechecks the latest immutable item, unexpired exact human
approval, active approver identity and ENV-028 version/scope, current sponsor and
bearer, location and declared Resend version. A final preflight repeats those
checks. Edits/revocation before execution win; an already-started external effect
cannot be recalled. Edits to a pending/unknown/accepted send are refused. Different
content or an edited twin never inherits an approval. Credentials cannot approve.

One durable intent per exact reply version precedes the network call, with a
stable idempotency key. Concurrent callers/restarts return its stored state and
never automatically resend. Resend acceptance records the provider's ID;
**provider accepted is not delivered**, and no notice closes automatically.
Definite client rejection is visible as rejected. Timeout, server error, malformed
success or a crash leaves unknown/pending, held for human reconciliation using
the provider console and recorded intent. Automatic query/reconciliation and
signed agency filing remain unfinished; operators must not create a replacement
send until they have independently reconciled an unknown original.

## Proof boundary and references

`tests/payroll-runtime.mjs` **sponsoredJourney / SPONSORED-NOTICES**, invoked by
`tests/runtime.mjs`, walks actual forms, APIs, MCP and persisted Worker/D1 state
at 1440/390. Only the named external HTTP edge is faked, using the above request,
error and acknowledgement schemas; every other outbound destination is refused.
The source is a synthetic CP161-style business-tax balance-due notice, not an
unknown `notice.execute` probe. It is not an agency receipt or a live provider
sandbox run. Only synthetic credentials/identifiers are used.

- OpenAI Responses: https://platform.openai.com/docs/api-reference/responses/create
- Structured output: https://platform.openai.com/docs/guides/structured-outputs
- Resend send: https://resend.com/docs/api-reference/emails/send-email
- Resend idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys
- IRS CP161 notice context: https://www.irs.gov/individuals/understanding-your-cp161-notice

## Privacy recording across implemented controls

`tests/privacy-recorder.mjs` observes the emitted Worker outbound edge, browser
requests and console output, structured Worker logs and emitted client assets.
Planted private values are learned from actual private-record and provider
submissions. Provider credentials may appear only in the appropriate declared
recipient's authorization header; existing edge assertions verify that header
and the exact permitted payload. An undeclared request remains a failure even
when application code catches its network error.

The default `tests/runtime.mjs` sweep retains Verify's separate installations
for authority, workspace, firm, industry, claims and archive journeys. It runs
the existing native screens at both widths. The sponsored journey removes the
stored OpenAI key, restarts the Worker and checks unavailable processing without
an invented analysis while human correspondence review remains available. All
other implemented non-agent controls run without an AI credential. Full future
payroll independence and complete external declarations remain ENV-073; see
[installed data boundaries](./payroll-external-data.md).

## Verified tax notice cases

The notice review screen links to **Manage notice evidence and deadlines**. This
bounded ENV-025 increment retains original PDFs, unverified OCR text, checked
facts, corrections, deposit proof and reported agency responses. It supports
SUI rate letters and IRS deposit mismatches. It does not implement automatic OCR,
agency feeds, dedicated incoming email, complete IRS lock-in handling or payroll changes.

The current conservative policy is pending CT review: only the configured native
installation owner with a current company session may use case routes or download
their originals. Existing generic notice and correspondence permissions keep their
existing scope. No case action sends data, pays money, signs a filing, releases a
hold or deletes evidence. This bounded access policy does not complete the
product's separately scoped staff permissions.

All routes below are beneath an existing notice at
`/api/envelope/companies/:company/notices/:notice/case`; native forms use the
corresponding app route. An agent bearer cannot use these native-human doors.

- `GET` returns retained versions with original digests and quotations, explicit
  amounts, attributed decisions, current source state and follow-up. PDF bytes
  are omitted from this view. An absent residual or assessed amount is unknown,
  never zero. The agency deadline and assigned person survive closure reports.
- `POST` records checked facts. Required fields are `version`, `type` (`sui-rate`
  or `deposit-mismatch`), `agency`, `employerEin`, `periodStart`, `periodEnd`,
  `dueOn`, `principalCents`, `proposedPenaltyCents` and `verifiedExtraction:true`.
  First entry additionally requires `pdf` (base64), `quote` and `rawExtraction`.
  Subsequent corrections require `correctionReason` and cannot replace the
  original PDF or raw extraction. SUI facts also require `state`, `ratePercent`
  and `effectiveFrom`. The EIN must match the company's private identifier.
- `GET /review` and `POST /approve` review the exact retained version using the
  existing session-bound, grant-bound, expiring human review token. Changed
  facts or evidence cannot inherit a prior review. This reviews the record only.
- `POST /evidence` retains `kind` (`deposit`, `agency-response` or `reopening`),
  `reference`, `pdf`, `quote`, `version`, `employerEin` and the exact case period.
  A deposit requires explicit `amountCents`. An agency response requires
  `reviewedAgencyEvidence:true`, `residualCents`, `assessedPenaltyCents` and
  `abatedPenaltyCents`; proposed penalties remain separate. Identical replay
  returns the existing version; changed content or disposition under the same
  reference refuses. Different evidence appends an unreviewed version.
- `POST /link-rate` accepts `version`, `ruleId` and `ruleVersion` only after exact
  case review and separate rule review. The final SUI rule must match state,
  percentage and effective date, with `sourceRef` exactly
  `notice:<notice id>:<original PDF sha256>`. A source edit or withdrawal makes
  the link stale. Linking is not application of a rate to calculated wages or
  liabilities. Existing rule administration remains the human review door.
- `GET /original/:version/:index` downloads the exact retained PDF, with private
  no-store headers and current authority. Index zero is the notice original;
  later indexes are evidence in recorded order. Native multipart uploads are
  limited to 384 KB per PDF. Small JSON inputs use the existing request limit.

An agency response is **closure reported**, never independently verified or
resolved. Its residual balance can be nonzero and remains explicitly reported.
A reopened case returns the current balance to unknown while preserving the
previous response and its amounts. Missing response evidence never manufactures
closure. Overdue status is computed from the retained agency date and keeps an
urgent named-human follow-up, including after a reported closure. No background
carrier escalation or staffed service response is claimed.

Model processing now attaches a server-generated citation to the exact retained
notice digest. That citation identifies its input; it does not verify the model's
claims or change the approval and dispatch boundaries above.

`tests/tax-notice-runtime.mjs` **taxNoticeJourney / TAX-NOTICE-CASES**, loaded by
the claims push shard in `verification.json`, exercises native upload, APIs,
immutable PDFs and extraction, wrong employer and period refusal, corrections,
exact review, replay, unknown and nonzero balances, overdue follow-up, reopening,
reviewed SUI links and current native-owner access. Selected case screens are
captured at 1440 and 390; the upload interaction runs at 1440. The existing
**sponsoredJourney / SPONSORED-NOTICES** also checks the exact input citation.
Synthetic source PDFs and reported responses are not live agency receipts or
legal authenticity proof. Full notice resolution, custody, restore and legal
retention proof remain owed by ENV-025 and its existing cross-cutting clauses.

## Retained IRS withholding instructions

The worker's signed-paper screen links to **IRS withholding instructions** at
`/api/envelope/companies/:company/people/:person/withholding-instructions`.
The same conservative native-owner restriction applies. These are bounded legacy
instruction records, not a complete withholding engine or legal-authenticity
service. A PDF, model response or unchecked attestation cannot self-approve.

`POST` requires the retained PDF and quotation, employer EIN, worker SSN,
`kind` (`2800C`, `modification` or `release`), `letterOn`, `receivedOn`,
`effectiveFrom`, `authenticated:true`, `authenticationMethod` (`agency-portal`
or `verified-agency-correspondence`) and `authenticationReference`. The employer
must match; the worker identifier must match the existing encrypted private SSN.
The caller must independently check that agency source, rather than trust text
inside the attachment. The application retains this human report; it does not
independently authenticate the IRS. Only an identifier digest is retained in
structured instruction metadata, and neither that digest nor PDF bytes are
returned by the history route.

Legacy settings require `filingStatus`, `maximumAllowances` and
`minimumAdditionalCents`. The supported 2800C date is 60 calendar days after its
letter date. A modification or release is recorded effective on receipt and
requires an earlier approved instruction. Other formats or unusual effective-date
cases need additional implementation and authoritative review. Current-form
W-4 amount comparisons remain unavailable.

`GET /review` and `POST /approve` require an exact current human review token.
Originals and source, actor and date history are retained by version at
`GET /original/:version`. New sources never inherit approval. A changed worker
identity cannot silently remove the instruction or authenticate a replacement.
Historical source custody remains distinct from money or filing authority.

The existing paper-election door checks applicable reviewed legacy instructions.
It refuses an exemption, a different status, more allowances or reduced required
additional withholding. A retained compatible legacy election with fewer
allowances or more additional withholding is accepted. A pending implementation
or modification holds affected entry for a human; an unapproved release keeps
the prior approved restriction. Only the exact approved release removes this
entry restriction. Collection pins reject entry if an instruction or its decision
changes concurrently. Elections effective before an instruction are historical
records; the future payroll engine must still apply the binding instruction when
due. These entry guards do not prove a current-form taxpayer election, a lawful
paycheck, the first required check or cent-level withholding. Paper review still
confers no payable authority.

Official source for the bounded legacy rules:
https://www.irs.gov/individuals/understanding-your-letter-2800c
(reviewed 20 July 2026; consulted 27 October 2026). It specifies the lock-in date,
disregard of a decreasing W-4, permitted increases, and immediate modification
on receipt of Letter 2808C. A synthetic matching-format PDF and a human-reported
source check in a journey do not establish actual IRS authenticity or legal effect.
