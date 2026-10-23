# Payroll records and access

Open `/app/envelope` from the app's **Settings** link. Identity settings remain
at `/auth/settings/identity`. This is the first persistent payroll-record
foundation. It does not calculate or pay payroll, change a verified bank
destination, file a return, or establish a provider relationship.

The installation owner creates a company and locations, invites operators with
Base, then assigns explicit company/location/action/field grants. Base's admin
or member role grants no payroll access. The company creator holds the initial
owner grant. Owner transfer is not exposed by this records API. Other role names
are labels: choose their explicit permissions, including independent export,
bank-edit, approval and release powers. Employee/contractor labels do not imply
a person-level filter; own-person payroll portal grants remain unfinished.

Changing/revoking a grant ends that person's existing installation sessions. A
fresh sign-in does not restore a revoked company grant. Session/operator/grant
versions, expiry, revocation and linked identity-provider state are checked again
inside each database statement. Private responses use no-store; public documents
and assets contain no payroll data. Unknown payroll effect routes remain 404s.
A 404 is not evidence that an implemented payment door enforces authority.

## Private custody setup

Setup now generates and preserves a dedicated `ENVELOPE_RECORD_KEY` in private
settings, using Base's managed-secret mechanism. Deployment declares that Worker
secret explicitly. It contains a base64-encoded random 32-byte key;
never put it in `wrangler.jsonc`, Git, URLs, screenshots or logs. It must be
independent of the session secret. An absent or malformed key refuses private
custody; there is no development or session-secret fallback.

AES-256-GCM seals EINs and private SSN, bank-document and tax-document text with a
fresh nonce and company/person/kind authenticated context. Default responses
return masks, kind and version, never ciphertext or full private values. A full
read needs both private-read and the exact field grant, and creates an actor,
time and record-version audit event. Downloads are inert plain-text attachments.
Bank-document storage also requires bank-edit permission and fresh app-local email proof; it records documentary
custody, not a verified destination, approved bank change or debit authorization.
The current text-only door accepts at most 16,000 characters; PDF/binary files
and their document lifecycle are not implemented.

Keep the key outside data archives and back it up securely with the owner. Key
rotation/re-encryption and operational recovery are not implemented. Changing or
losing the key makes existing ciphertext unreadable and is not a migration. If
the key is missing after data was created, restore its backup before rerunning
setup; generating a replacement cannot recover existing records.

The Base archive includes durable payroll tables automatically. Active payroll
grants and review challenges are explicitly excluded; the key stays outside the
archive, with only its required configuration name declared. Restored companies
therefore have no payroll authority. Fresh owner-authorized re-enrollment and a
complete populated payroll archive/recovery journey remain ENV-053 work; do not
claim the current foundation provides a complete payroll recovery procedure.

## Rate review

A rate proposal fixes person/version, hourly cents, effective date and proposer.
The review document names the human and exact proposal. Its ten-minute review
token is bound to that session and current grant version. Approval consumes the
review once and advances the person version atomically with the decision/audit.
Concurrent replay, an intervening approved rate, grant change or revoked session
cannot apply stale authority. The read API returns the historical proposals and
named decisions; there is no wage calculation or claim of applied paycheck rates.
Fresh proof now guards bank-document storage and credential issuance; see
[Sponsored payroll preparation](payroll-agents.md). Settings expose independent **Approve exact earnings runs** and **Request payroll
release (held)** permissions. Exact run approval still needs compensation access
and all locations; a location-limited grant cannot review a whole-company run.
Opening a run review records `run.reviewed`; opening an exact setup review records
`workspace.<kind>.reviewed`, in the same transaction as its session-bound review.
The audit names actor, time, target and version without amounts, private contents
or review tokens. Approval alone grants no export, bank-edit or release power.
Actual verified bank changes and payable dispatch remain obligations of
ENV-004/011/030/034/051/052.
[Effective setup records](payroll-setup.md) documents the company register.

## HTTP API

All paths below start with `/api/envelope/companies`. Use a current native/OIDC
session cookie, or the existing key-gated local dev session. This API does not
accept bearer-agent tokens or caller-supplied actor/role flags. POSTs require the
configured same Origin and JSON or native form bodies (maximum 64,000 bytes).
IDs are server-generated. Responses are JSON unless specified.

- `GET /`: list currently granted companies (legal name and masked EIN suffix).
- `POST /`: installation owner creates `{name, ein}` (`12-3456789` format).
- `GET /:company`: granted company, permitted locations and people.
- `POST /:company/locations`: company owner creates `{name, state?}` (50-state/DC code).
- `GET /:company/grants`: company owner inspects current grant versions.
- `POST /:company/grants`: `{operatorId, version, role, locations, fields, actions}`;
  version 0 creates, a current positive version replaces. Existing invited/active
  identities only. `{operatorId, version, revoke:true}` revokes. Location IDs or
  `*`; fields `compensation`, `ssn`, `bank`, `tax`; action choices are shown in
  settings. Stale versions fail without a write. Company owner grants are not
  changed through this door.
- `POST /:company/people`: `{name, locationId}` creates a payroll record.
- `GET /:company/people/:person`: permitted record, masked private-record metadata
  and rate history only when compensation is granted. Foreign/ungranted locations
  return no record.
- `POST /:company/people/:person/private`: `{kind, value, version}` stores encrypted
  private text; kind `ssn`, `bank`, or `tax`. New record version 0; replacements
  require the current private-record version. No raw value is echoed.
- `GET /:company/people/:person/private/:kind`: permitted full text attachment,
  with an attributed sensitive-read event.
- `POST /:company/people/:person/rates`: `{version, hourlyCents, effectiveDate}`
  prepares an immutable proposal at the current person version.
- `GET /:company/rates/:proposal`: permitted exact human review and reviewToken.
- `POST /:company/rates/:proposal/approve`: `{reviewToken}` records the exact
  human rate decision once. No amount/date replacement is accepted here.
- `GET /:company/export`: independently permitted CSV identity/location register,
  without compensation or private text. Each exported record is audited; CSV
  formula-leading names are quoted and escaped. This is not a payroll archive.
- `GET /:company/audit`: company-wide audit grant only, latest 200 attributed
  metadata events as a JSON attachment. No SSN, bank value, rate amount or document
  contents enter the audit. Location-limited audit access is not yet exposed.

The existing `tests/runtime.mjs` journey calls `payrollJourney` in
`tests/payroll-runtime.mjs` against the actual emitted Worker and migrated D1.
Only synthetic identity sessions are fixture setup; payroll behavior is exercised
through HTTP and native forms. Its 1440/390 browser captures are test artifacts,
not shipped product files. None of this evidence proves real payroll, tax,
provider, bank-change or sandbox outcomes.

## Native and linked sign-in

Base admits only an invited or existing active identity. Requesting an email
sign-in link for an unknown address returns the same accepted answer, sends
nothing and creates no operator or session. Invitations and sign-in links require
an explicit confirmation, expire, and cannot be replayed. A successful identity
receives no payroll company access until the owner grants it separately.

Native cookies and their stored sessions have Base's fixed maximum of seven
days; activity does not slide that expiry. Sign-out, identity removal, grant
changes and linked-provider disable end old access, including direct private
attachments. Reactivation never revives an old session. Linked OIDC sessions are
also bound to the current provider pin and admission generation. Payroll still
checks its own company, location, action and field grant independently.

Production mail must report accepted provider submission before its link can
remain usable. Rejected or uncertain submission revokes that link and creates no
session; provider acceptance does not prove mailbox delivery. Missing mail/Auth
never selects a different authentication route or bootstraps an unknown person.
Base's sign-in limits are five requests per normalized address and 30 per client
IP in a 15-minute fixed window, with separate confirmation/invitation scopes.

Bank-document custody and credential minting require Base's fresh ten-minute
same-session app-local email proof. Completing a step-up link sets no new session
cookie and a different session cannot consume it. Client MFA flags and even a
signed provider MFA claim do not replace that app-local proof. Trusted linked
MFA for sensitive payroll operations, optional passkeys, retained former-worker
forms and step-up on actual bank changes/payroll release remain unfinished.

`tests/payroll-runtime.mjs` — `identityJourney` / PAYROLL-SIGNIN uses the actual
emitted production Worker over loopback HTTPS. Only the external Resend
`POST /emails` JSON acceptance/rejection/uncertain responses and Auth's OpenID
Connect Core 1.0 discovery, JWKS and authorization-code token response are faked.
The Auth edge signs ES256 ID tokens, checks S256 PKCE and the app's
`private_key_jwt` signature, and declares `oidc-provider@1.0.0`. These are
network-edge handling proofs, not live Auth, mail delivery or payroll receipts.
The fixture's self-signed TLS exception is confined to its loopback origin.
