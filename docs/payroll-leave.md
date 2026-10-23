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
  minutes and previews money; it does not claim wages paid or an HRIS receipt.
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
with its version withdraws an adopted revision. Replays, stale concurrent
versions, wrong owners and negative/over-cap balances refuse. New events cannot
be backdated across adopted entries; source corrections retain their original
identity. The bounded ledger refuses at 200 entries rather than truncating it.

Pay-settings previews include the reviewed leave amounts and original owner and
source references. Persisted earnings versions bind the leave revision and the
person's collection, so new leave invalidates an old approval. They remain held
until full gross-to-net calculation and an authorized rail exist. Statutory
rate/policy validation, multiple independent leave buckets, automatic year jobs,
actual pay/stubs, consumption delivery and settlement correction are unfinished.
No Willow policy, employment document or enrollment is overwritten.
