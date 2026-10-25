# Reviewed leave ledger

The person page links to `/app/envelope/companies/:company/people/:person/leave`.
The same path under `/api/` returns JSON. Native human sessions and current
company/location/compensation grants apply to every request. Opening and entries
require `rates:propose`; exact review/approval requires `rates:approve`. Agent
bearers cannot use these doors. Values are encrypted in the existing append-only
workspace and every read/change/decision is attributed in the company audit.

POST the base path with `owner` (`willow` or `payroll`), `effectiveDate`,
`openingMinutes`, `hireDate`, `capMinutes`, `carryoverMinutes`, `policyEvidence`,
and `tiers` (array of `{years, earnedMinutes, workedMinutes}`). The tier at year 0
is mandatory. POST `/entries` with the current ledger `version`, `sourceId`,
consecutive `sourceVersion`, `day`, `operation`, and `evidence`:

- `use`: current `owner`, `minutes`, `code` (sick, pto, holiday, unpaid,
  termination), and a documented lawful `rateCents` for paid leave. This reserves
  minutes and previews money; unpaid absence never debits the paid bank. It does not claim wages paid or an HRIS receipt.
- `accrual`: payroll owner only; source ID/version/date must match a persisted
  work entry. Integer worked-minute ratios use hire-anniversary tiers and the
  balance cap. A source correction contributes only its reconciled difference.
- `carryover`: payroll owner only, January 1, at most once that year, using the
  reviewed carryover cap. This is a proposed human decision, never a timer.
- `transfer`: a different `owner` and `reconciledMinutes` exactly equal to the
  adopted balance. Prior source identities survive transfer. A previous owner's
  corrections require a separate explicitly sourced reconciliation adjustment.
- `adjustment`: positive `minutes`, `direction` credit/debit and reconciliation
  evidence. It is never generated automatically as a balancing plug.

GET `/review`, then POST `/approve` with that exact `version` and `reviewToken`.
The token is bound to the reviewing native session/current grant and expires in
10 minutes. A pending revision cannot feed a payroll preview. POST `/withdraw`
with its version withdraws an adopted revision. If a source changes while a ledger proposal awaits review, explicitly set `revisePending: true` when proposing the correction. This retains the pending entries in a new exact revision and is available only after an initial ledger has been reviewed; it cannot bypass opening approval. Replays, stale concurrent
versions, wrong owners and negative/over-cap balances refuse. New events cannot
be backdated across adopted entries; source corrections retain their original
identity. The bounded ledger refuses at 200 entries rather than truncating it.

Pay-settings previews include the reviewed leave amounts and original owner and
source references. Persisted earnings versions bind the leave revision and the
person's collection, so new leave invalidates an old approval. They remain held
until full gross-to-net calculation and an authorized rail exist. Statutory
rate/policy validation, automatic year jobs,
actual pay/stubs, consumption delivery and settlement correction are unfinished.
No Willow policy, employment document or enrollment is overwritten.

## Independent leave banks

The existing leave door accepts `bucket: sick`, `bucket: pto` or
`bucket: holiday` on opening, entries and decisions. Select the same bank with
`?bucket=sick` (or its other name) for exact review and the native page. The
leave page links each bank using the existing controls. Each bank has its own
opening balance, policy tiers, cap, carryover, owner, review and revision.
An entry may use its bank's pay code, unpaid absence or termination; another
paid code is refused. Termination is still a reviewed earnings reservation,
not a determination that a jurisdiction requires that bank's payout.

Omitting the bank preserves the existing `combined` ledger and its API.
A combined bank cannot coexist with separate banks, including concurrent
open attempts; existing combined history requires an explicit future reviewed
reconciliation rather than copying its balance into new banks. No migration
splits balances or creates leave authority automatically.

Willow leave handoff selects the matching code bank when present and otherwise
uses the legacy combined bank. An explicit `bucket` may select the destination,
but the same code and balance-owner checks apply. Source corrections advance
only that bank by the minute difference. A use source already recorded in
another bank requires reconciliation instead of a second reservation. Other
banks retain their independent balances and owners. Exact earnings previews
bind every current bank revision and identify each bank's source lines; an
unreviewed, changed or withdrawn bank prevents a preview. Pending bank proposals
also recheck the other banks before adoption. Actual paid consumption, remote
acknowledgements and settlement adjustments remain unavailable.

`tests/payroll-runtime.mjs` — `leaveJourney` proves independent sick, PTO and
holiday balances, matched Willow handoff and correction, code and owner
refusals, replay and cross-bank source refusal, legacy exclusion, anniversary
accrual, isolated carryover and owner transfer, plus exact held earnings and
source invalidation. The same journey captures review and completed bank screens
at 1440 and 390, with keyboard checks and visible control labels.
