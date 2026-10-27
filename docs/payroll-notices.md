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
agency feeds, dedicated incoming email, complete IRS lock-in handling or payroll payment.

The approved conservative casework policy permits only the configured native
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
  the link stale. Linking alone does not apply a rate. The regular-wage preview below can calculate a bounded employer liability. Existing rule administration remains the human review door.
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
The same conservative native-owner restriction applies. These are bounded legacy and current-form
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
cases need additional implementation and authoritative review. For `settingsFormat:current`, retain `filingStatus`, `multipleJobs`, annual
`dependentCreditCents`, `otherIncomeCents`, `deductionsCents` and per-check
`minimumAdditionalCents`. The current settings are retained as an exact
Publication 15-T W-4 arrangement; no credit, deduction or adjustment is inferred
from model text.

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


## Reviewed notice application in regular-wage previews

The existing industry check door now applies a selected SUI notice to ordinary
single-state business employee wages retained in the selected earnings run.
The case version after linking and the exact final rule version both require
human review. The rule must retain `details.wageBaseCents`, an official
`details.wageBaseSourceUrl` and `details.wageBaseReference`. The check requires
`suiNoticeId`, explicit `suiYearToDateWagesCents` and `suiYearToDateEvidence` for
that worker and employer in that tax year. A known applicable notice cannot be
bypassed by omitting its selection. Ambiguous cases, missing wage basis, changed
sources, unreviewed rules, special taxability and mixed-state work refuse.

The taxable amount is the smaller of current retained wages and the positive
remaining annual wage base. Decimal rate arithmetic rounds once to cents. The
check retains the original digest, case and rule versions, source, prior wages,
taxable wages and employer liability separately from federal taxes. SUI adds no
employee deduction and produces no payment. Prior wages remain human-supplied
register evidence; complete reconciliation and SUI legal coverage are unproved.

A due retained IRS instruction is also checked at the regular-wage preview door.
Pending implementation blocks that preview. For a reviewed legacy or current-form instruction,
Publication 15-T calculates its amount independently of the retained W-4; the
higher amount is used for this check. Thus a current-form election cannot lower
the calculated lock-in amount and a higher election remains available.
An approved release removes this calculation constraint; a pending release does
not. Changed identity refuses. The check retains the selected settings, both
compared amounts, exact instruction version, effective date and decision. New
instruction, notice or rule versions invalidate affected check authority even
after check approval; a stale check cannot prepare a return. These checks
cover ordinary resident business employee cash wages only; special taxability
refuses. Complete source-format validation, all effective-date cases, actual first
required payment and independent IRS authenticity remain unproved.

The bounded calculation records remain distinct from the casework policy ruling.
They authorize no payroll payment, filing, external send, destruction or hold
release, and ENV-025 remains PARTIAL.


Current-form paper entry accepts the exact reviewed filing status and multiple
jobs arrangement with no increase to allowed credits or deductions, no decrease
to required other income, and no decrease to additional withholding. This
monotone comparison proves a compatible higher election without guessing future
wages. An alternate status or multiple-jobs arrangement requires an unavailable
complete amount comparison and refuses entry. Regular-wage previews compare
actual amounts on the check date and retain the higher amount. The journey
records a synthetic current-format original through native upload, independently
asserts every retained setting, rejects each decreasing field through the paper
door, calculates on the specified effective date and honors a higher election.
It does not prove timely human implementation or actual first-check payment.

Official current-form arrangement and higher-election guidance:
https://www.irs.gov/businesses/small-businesses-self-employed/withholding-compliance-questions-and-answers
(2020 Form W-4 questions 1–3; consulted 27 October 2026). The retained source is
human-authenticated, not independently authenticated by the application.


The current-form journey also retains and reviews an immediate-on-receipt
modification, recalculates its withholding floor and proves that an unapproved
release preserves that floor. Only exact human approval of the retained release
permits the ordinary lower election to determine the calculated check. The
original, modification and release remain separate attributed encrypted versions;
no source PDF or decision is overwritten. These synthetic format cases do not
establish every IRS letter variant, source authenticity or legal effect.

Instruction versions pin the private SSN revision, with atomic checks on creation and review decisions. Restoring an old SSN value does not restore review authority. Every effective pending modification remains a hold even beneath a later pending release. Linked SUI evidence retains its exact approved rule dependency; edited or withdrawn rules refuse evidence appends, while reopening clears the link.

## CT casework ruling, 27 October 2026

CT scope ruling, 27 October 2026: APPROVE WITH RIDERS for conservative notice casework only. The configured native installation owner, using a current native session and current company authority, may retain case facts and originals and review exact source-bound case decisions. No automatic outbound action, payroll mutation, hold release, destruction or external deletion is authorized. A notice review does not approve a rate, signed response, filing or payment; each consequential action retains its separately authorized exact human approval. Source, worker identity, instruction, linked rule or current authority changes invalidate affected pending review even after evidence append or restoration of an earlier identity value. A pending release cannot override an unresolved stricter instruction. Closure reports remain unresolved until supported by agency disposition and actual remaining liability and penalty evidence; unknown balances stay unknown, claimed abatement stays distinct from actual abatement, and reopening preserves earlier evidence. Owner-only casework is too narrow for day-one payroll teams: ENV-028 must provide authorized bookkeepers, payroll administrators and accountants separately scoped case intake, investigation, exact review and original access by company, location and sensitive fields, with immediate revocation, distinct attribution and configured separation of duties. Delegation grants no consequential authority beyond its explicit scope. Existing generic correspondence keeps its separate authority; agent credentials gain no authority over these case records. Statutory custody, lawful eligible erasure and inactive restore remain owed under ENV-051, ENV-053 and ENV-054. This ruling supersedes the pending casework-policy label, preserves every original outcome and acceptance sentence, changes no status, and accepts no implementation completion or production readiness.

## Saved-check source safety

An unapproved correction cannot move a previously reviewed applicable SUI notice outside payday and silently remove its liability. Checks pin the worker private SSN revision before calculation and at append, and recheck it for review, approval and return preparation. Changing the identity and restoring its former value does not revive check authority. Checks from older versions without the required instruction, notice, rule and private-identity pins remain historical evidence and require a fresh calculation before review or return preparation.
