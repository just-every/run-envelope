# Signed paper payroll intake

This native API increment retains signed paper elections for an existing worker,
including a worker with no digital contact or portal account. It does not make a
worker payable, calculate withholding, authenticate a taxpayer signature, verify
bank instructions, match a TIN or send money. Email invitations, SMS, portal
completion and linking remain unavailable in this increment.

Open a worker’s **Signed paper onboarding** link to record and review paper
elections in the native owner screen. Choose employee or contractor certificates,
upload the signed originals, transcribe their fields and inspect the exact version
before confirming review. A changed district or election requires a new signed
version. Every control has a visible label and supports keyboard access.

Use the ordinary company and people API to create the employer, location and
person. Do not create another person when updating elections. The native owner
session is required for every paper intake door; other payroll grants cannot
read the papers or approve them. All POST requests require the installation's
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
