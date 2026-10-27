# Signed paper payroll intake

This native API increment retains signed paper elections for an existing worker,
including a worker with no digital contact or portal account. It does not make a
worker payable, calculate withholding, authenticate a taxpayer signature, verify
bank instructions, match a TIN or send money. Email invitations, SMS, portal
completion and linking remain unavailable in this increment.

Open a worker’s **Signed paper onboarding** link to record and review paper
elections in the native paper screen. Choose employee or contractor certificates,
upload the signed originals, transcribe their fields and inspect the exact version
before confirming review. A changed district or election requires a new signed
version. Every control has a visible label and supports keyboard access.

Use the ordinary company and people API to create the employer, location and
person. Do not create another person when updating elections. A current native human session and current company grant are required. In Payroll grants, the owner may independently assign `paper:entry`, `paper:review` and `paper:download`, alongside `records:read` and both `tax` and `ssn` field access at the worker’s location. Role labels confer no authority. A review permission does not grant original downloads; a download permission does not grant entry or review. No rate approval, compensation, bank, export, portal, payment or filing permission is implied. All POST requests require the installation's
Origin and existing session cookie. Bearer credentials are refused.

The native screen uses the same path with the `/app/envelope` prefix. The API base path is
`/api/envelope/companies/<companyId>/people/<personId>/paper-onboarding`.

- `GET` returns all immutable versions, newest first, with masked TIN, original
  attachment metadata, entering identity and exact-version review attribution. Every field in one
  immutable version shares its entering identity and exact human decision.
  It never returns original PDF bytes or an unmasked TIN.
- `POST` appends one version. Send `version: 0` initially and the current version
  thereafter. A stale version returns 409. Updates retain the original worker.
- `GET` at the `review` child returns an exact version and a short-lived review
  token bound to the current human session and grant. Original bytes remain
  behind the separate download door.
- `POST` at `approve` accepts `version` and `reviewToken`. An edited version or
  token from another session cannot approve. `POST` at `withdraw` accepts the
  reviewed `version`; it removes that version's review authority.
- `GET` at `original/<version>/federal` or `original/<version>/state` downloads
  the selected retained original as an attachment with an attributed audit.

The JSON POST body contains `attestTranscription: true`, `workerType` (`employee` or
`contractor`), `hiredOn`, nine-digit `tin`, `address`, `paymentMethod: paper-check`,
`federal` and `state`. No contact or bank account is required. No bank method is
accepted without the future bank verification implementation.

Each form has `form`, ISO `effectiveFrom`, `fields`, and `original`. The original
contains `signed: true`, `signedBy`, ISO `signedOn` and a base64 `pdf` (at most
512,000 encoded characters). A pre-2020 election must retain a signature from before 2020. PDF framing is validated; this is a human attestation about retained
paper, not cryptographic verification of a legal signature. The original must
contain the complete signed certificate; structured fields are its transcription.
The bounded request limit is 1,100,000 bytes. All records and originals are encrypted
under the dedicated installation record key and remain in the existing worker
custody inventory. No outbound service receives these forms.

Supported federal transcriptions:

- `W-4`: `filingStatus` (`single`, `married`, `head-of-household`), `multipleJobs`
  (`yes` or `no`), `dependentCreditCents`, `otherIncomeCents`, `deductionsCents`,
  `additionalCents`, and `exempt` (`yes` or `no`).
- `W-4-pre2020`: `filingStatus` (`single`, `married`, `married-withhold-single`),
  `allowances`, `additionalCents`, and `exempt`. Retains migrated paper elections;
  it does not invite a worker to make a new election on an obsolete form.
- `W-9`: contractor `taxClassification` and `exemptPayeeCode`. A W-9 alone grants
  neither verified TIN status nor lawful backup-withholding authority.

Supported state transcriptions:

- `PA-residency`: `residenceAddress`, six-digit `residencePsd`, `workAddress`,
  six-digit `workPsd`, `localExemption` (`none` or `claimed`), and
  `exemptionEvidence` when claimed.
- `OH-IT-4`: `residenceAddress`, `schoolDistrictName`, four-digit
  `schoolDistrictNumber`, `allowances`, `additionalCents`, `localExemption`, and
  `exemptionEvidence` when claimed.

Employees require a supported state certificate; contractors can use `state:
null`. The native screen accepts bounded multipart PDF uploads; the JSON API accepts
base64 originals. Other state certificates remain unimplemented. A district move appends a
new signed version and requires another review. Every response keeps `payable:
false`; `paperworkReviewed` means only that this source version was reviewed,
not that a wage run or contractor payment is authorized. No receipt of payment,
IRS matching or 1099 withholding report is generated.


The company’s Payroll grants screen also configures paper review separation. When
required, the entering person cannot review or confirm their own version, including
the owner. Changing the policy invalidates pending review tokens. Each review is
bound to the exact version, current policy, current grant and current native
session. Grant changes revoke existing sessions; re-granting requires fresh sign-in
and review. Current statutory holds deny all delegated paper doors while native
owner custody remains restricted and audited. No hold release is implied. The
policy and paper history are retained as encrypted workspace versions; restored
history supplies no session, grant or active review token. Paper-specific complete
archive and erasure proof remains unproved.

CT scope ruling, 27 October 2026: APPROVE WITH RIDERS for the current paper-intake increment only. The configured native installation owner, acting through a current native session and current company authority, may enter signed paper elections, review an exact retained version and download its originals. Owner-only clerical handling is too narrow for day-one use by the contracted employer and accounting-firm teams. ENV-028 must provide separately grantable paper entry, exact-version human review and original-download permissions for authorized bookkeepers, payroll administrators and HR staff, scoped by company, location and sensitive fields, with immediate revocation and attributed access and decision audit. Configured separation of duties requires distinct authorized people. Those delegated permissions confer no bank-edit, export, payment, filing, portal-account or approval power beyond their explicit scope. Paper entry and review retain the signed originals, effective dates, field provenance and entering and reviewing identities; changed sources, payloads or current authority invalidate affected pending review. Unsigned evidence and duplicate invitations cannot create payable authority. Any later verified portal invitation must link to the existing worker and preserve elections, history and custody. Payroll transaction approval and uncertain effects remain governed by ENV-034 and ENV-035; current sessions, statutory custody and inactive restore remain governed by ENV-051, ENV-053 and ENV-054, and external disclosure remains governed by ENV-055 and ENV-073. Held records retain their existing restricted and audited custody; delegated access cannot release a hold. Agent credentials gain no paper authority from this ruling. No automatic portal activation, outbound action, payment, filing, erasure, hold release or external deletion is authorized. Legal sufficiency of paper and signatures, invitation carrier operation, actual delivery and all original onboarding and payment outcomes remain separately evidenced. This ruling accepts no implementation, completion or production readiness and preserves every original acceptance sentence and the current PARTIAL row.
