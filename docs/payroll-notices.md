# Declared notice processing and exact correspondence

These optional notice doors implement part of ENV-052/055, using the existing
company/location/field authority. They do not complete ENV-025/034/035/055/062
or the payroll engine. No notice text, model output or client approval flag can
approve, choose a new provider, change bank details, pay wages or sign a filing.

## Owner declarations and custody

Open **Agent credentials → Declare external providers**. Fresh app-local proof
and explicit consent are required to enable a declaration. `POST /providers`
accepts `{id,version,enabled,consent,secret?,sender?}`. Keys are encrypted with the
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

## Private originals and case history

`POST /notices/:id/files` accepts native multipart fields `file`, `version` (0
for a new file), and optional existing `id`. Supported originals are PDF (with
its `%PDF-` signature), UTF-8 HTML and UTF-8 text, up to 32,768 bytes each. A new
version requires the exact previous version. Filenames cannot contain paths.
Every version has its own encrypted bytes, SHA-256, author and time. Files are
never public assets, model inputs or inline PDF/HTML viewers. The authenticated
`GET /notices/:id/files/:fileId/:version` additionally requires current
`private:read` and `tax` scope for the notice location, records a sensitive read,
and returns an attachment with octet-stream, nosniff, sandbox and no-store.
Downloading an original does not make it safe to open in an active viewer.

`GET /notices/:id/case` reads immutable case versions. `POST` to the same path
with `version:0, action:"intake"` records the human-transcribed `kind`
(`sui-rate`, `irs-deposit`, `irs-lock-in`, `other`), `agency`, `ein`, `period`,
current human `ownerId`, UTC ISO `deadline`, and `reportedAmountCents`. The
original notice digest fixes provenance. A wrong EIN creates an identity-review
case; it never matches a foreign company or creates a zero liability. A reported
amount is distinct from an agency-supported remaining balance, initially unknown.

Subsequent events require the exact prior `version`, `action`, `fileId`,
`fileVersion` and a cited `note`. The file must belong to this same notice.

- `deposit-proof` records evidence without implying an accepted deposit.
- `ocr-correction` requires the correct company `ein` and corrected
  `reportedAmountCents`; previous transcription and identity mismatch remain in
  history.
- `claimed-abatement` records `claimedAbatementCents`; it never changes actual
  abatement or remaining liability.
- `agency-close` requires current `notices:approve`, fresh native proof,
  `confirm:true`, an independently verified original agency disposition,
  `remainingLiabilityCents` and `actualAbatementCents`. Actual abatement cannot
  exceed the recorded claim. A resolved case can retain a nonzero balance.
- `agency-reopen` cites the agency's new evidence and restores an open unknown
  balance. It preserves the original response deadline and breach history.
- `rate-applied` links an already reviewed, current, nonwithdrawn SUI rule by
  `reference`. That rule's `sourceRef` must be exactly
  `notice:<notice-id>:<original-notice-digest>`. The case does not itself approve
  or modify a rate.
- `correspondence` links an actual accepted dispatch intent ID in `reference`;
  provider acceptance alone never resolves the case.

Case data is encrypted, append-only, attributed and source-cited. The deadline
screen distinguishes an overdue open case from a resolved case whose missed
response deadline remains recorded. Notices never mutate pay, sign filings or
send money. Scanning/OCR automation, authorized inbound email/feed intake,
automated escalation delivery, IRS 2800C instruction implementation and complete
filing/payment integration remain unavailable. A recorded `irs-lock-in` is held
evidence, not an implemented withholding instruction.

## Installation-wide external declarations

The owner provider screen also lists actual Cloudflare hosting/private storage,
the explicitly selected native authentication mail adapter and any pinned linked
OIDC issuer/endpoints. It shows purpose, fields, credential names, custody and
unavailable/suppressed states. These declarations are in `seed.json`. Native
sign-in links intentionally carry authentication secrets only to the addressed
operator; no payroll record is included. Unimplemented bank/rail/agency/recordkeeper/
HR/time/POS/ledger/SMS/chat/push flows are not advertised as connected adapters.
All configured company provider keys, including a disabled provider's key, are
removed from notice model requests/output and correspondence. Unicode identifier
variants are normalized for redaction; original evidence is preserved encrypted.
