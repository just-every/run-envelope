# Effective company and jurisdiction records

Open **Company and tax setup** from a company at `/app/envelope`. Only that
company's payroll owner may read or append setup history. Authentication alone,
a Base admin role or another company's owner grant grants no setup access.

The setup form records legal/DBA names, address, responsible contact, federal
lookback dates and entered deposit schedule, bank-authorization and
reporting-agent evidence references, an effective date and source edition.
These are encrypted records of supplied evidence. They do not verify a bank,
confirm agency authority, derive a lawful schedule from payroll lookback totals
or establish a provider relationship.

Jurisdiction entries have stable codes (one per account or WA risk class),
state, tax/assessment kind, agency, effective rates/bases, deposit/return
frequency, status, source and hours method. `missing` and `pending` are distinct
from `exempt`; exemption requires an explicit legal basis. `issued-evidence`
requires an entered agency account. The encrypted account is masked after
saving; it is never echoed in API history. `evidence-recorded` authority needs
a document reference and is not independently confirmed agency authority.

Rates are stored as exact decimal strings: percentages for percentage taxes,
dollars per hour for hour assessments. No tax or hours calculation consumes
them yet. WA employee share cannot exceed the total entered rate. WA fund
entries require `actual` or `wa-160-month`; OR hour assessments require their
own `or-actual` or `or-assumed` method. Consistent employer-wide salaried
choices, applicability, official risk-class completeness and calculations
remain unfinished.

Every save appends a version. Supply the latest version (0 for a new series);
stale writes fail. `asOf=YYYY-MM-DD` selects the latest effective revision on
or before that date, preserving future and superseded source history. Reads
and saves have attributed audit entries and repeat session/grant checks inside
D1 statements. Company data is sealed with the installation's
`ENVELOPE_RECORD_KEY`; losing that key does not become permission to use a
session secret or a replacement key.

A location may now carry a structured `state` code (50 states/DC). Unknown
states remain visibly unresolved. WA and OR locations generate the L&I and
WBF requirements even when no register entry exists. Full ready status always
remains false: a private workers-comp policy or entered document reference
cannot activate payroll or substitute for a required state fund.

The register flags only jurisdiction deposit/filing restrictions for pending
accounts/authority. These flags are not calculated liabilities or payment
receipts. Official-table gross-to-net, due dates/exposure, agency issuance,
reviewed true-up and once-only remittance/wage execution remain unfinished.
A tax number by itself must never become a reason to withhold lawful wages.

## API

Paths start at `/api/envelope/companies/:company/setup`, with the same current
human session, company owner, Origin and 64 KB body rules as the records API.

- `GET /?asOf=YYYY-MM-DD`: effective profile, current jurisdiction revisions,
  complete setup history, source metadata, masked accounts and WA/OR requirements.
- `POST /profile`: `version`, `effectiveDate`, `legalName`, optional `dbaName`,
  `address`, `responsibleContact`, `depositSchedule`, `lookbackStart`,
  `lookbackEnd`, `reportingAgentElection` (`not-elected`, `pending`,
  `signed-evidence`), optional `reportingAgentEvidence`, `bankAuthorization`
  (`missing`, `pending`, `signed-evidence`) and optional `bankEvidence`.
- `POST /jurisdictions`: `code`, `version`, `effectiveDate`, `state`, `kind`
  (`withholding`, `sui`, `local`, `disability`, `pfml`, `state-fund`,
  `hour-assessment`), `agency`, `registrationStatus` (`missing`, `pending`,
  `issued-evidence`, `exempt`), conditional `account`/`exemptionBasis`, `rate`,
  `employeeRate`, `rateBasis` (`published-new-employer`, `agency-assigned`,
  `official-table`, `not-applicable`), `wageBaseCents`, `depositFrequency`,
  `returnFrequency`, `hoursMethod`, `authority` (`missing`, `pending`,
  `evidence-recorded`) and conditional `authorityEvidence`.

Both writes require `sourceTitle`, HTTPS `sourceUrl` and `sourceDate`. A source
URL is stored provenance; the app neither fetches it nor certifies it as an
agency receipt. Frequency choices are `monthly`, `semiweekly`, `quarterly`,
`annually`, `agency-assigned`; these record an entered agency schedule and do
not supply the complete ENV-005 payday/funding scheduler.
