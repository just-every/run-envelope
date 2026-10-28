# New York disability contribution preparation

Envelope prepares statutory NY DBL contribution proposals through private native
company APIs. This is a bounded calculation facility. It does not authenticate
insurance coverage, collect deductions, fund the employer balance or remit money.
NY PFL remains a separate program. DBL recipients are explicitly a private
carrier or NYSIF; tax agencies are refused. Enhanced plans and Board-approved
self-insurance remain unsupported, even when an operator supplies a reference.

The conservative authority default is the configured installation owner with a
current native session and company grant. No agent or delegated staff authority
is implied. Exact source review authorizes preparation only. Broader scoped
benefit administration, complete source import and migration custody, legal plan
verification and provider operations remain owed by ENV-094 and the existing
cross-cutting contract clauses.

## Sources and arithmetic

The retained rule edition is WCL-209-2026-10, reviewed 28 October 2026. Official
references are [WCL section 209](https://www.nysenate.gov/legislation/laws/WKC/209),
the [WCB employer guide](https://www.wcb.ny.gov/content/main/DisabilityBenefits/employer-disability-benefits.jsp)
and [WCB employee guide](https://www.wcb.ny.gov/content/main/DisabilityBenefits/employee-disability-benefits.jsp).
The WCB guides distinguish DBL from PFL, describe an optional employee
contribution of one half of one percent of wages with a sixty-cent weekly cap,
and describe a requested proportionate adjustment for concurrent earnings over
120 dollars per week. Accepted enhanced plans require an agreement and a benefit
value basis; this implementation refuses them rather than applying a custom rate.
The WCB guides explicitly cite section 209. These statutory references do not
authenticate a supplied insurance plan.

All inputs and results use integer cents. Fractional cents are rounded down so
proposals never exceed a ceiling. Weekly wages of 100 and 200 dollars therefore
permit at most 50 and 60 cents. Two weeks at 200 dollars permit 120 cents.
Same-week split checks accumulate wages before rounding and share one weekly
cap. Prior supplied collections and existing preparations reduce the available
weekly amount. Verified supplied concurrent wages of 200 and 100 dollars give
40 and 20 cent proportionate ceilings. No foreign company record is queried to
obtain these wages. An employee request and a verified earnings reference are
required for this adjustment.

The supplied attributable premium, less its prior offset and all other current
preparations for that worker, also caps the proposal. The prior premium offset
must include the retained weekly collections. If only 25 cents remain, no more
than 25 cents is proposed. A midweek opening collection of 40 cents leaves at
most 20 cents of the statutory weekly ceiling. An employer-paid election
proposes zero. These amounts are proposed contributions, not collected funds,
refunds, an employer funding reconciliation or a carrier acknowledgement.

## Native API

All paths below are relative to `./api/envelope/companies/{companyId}`.

- `POST ./ny-dbl-plans` retains an immutable plan revision: `id`, expected
  `version`, `program` equal to `NY-DBL`, `type` equal to `statutory`, inclusive
  `effectiveFrom` and `effectiveThrough`, `employeeContributions`, `ruleEdition`,
  `recipient` with `kind`, `name` and `reference`, and `source` with `origin`,
  `reference` and source `version`. Origin is carrier, willow or migration.
- `GET ./ny-dbl-plans` reads plan history. `GET ./ny-dbl-plans/{id}/review`
  issues a session-bound exact-version review token.
  `POST ./ny-dbl-plans/{id}/approve` records `version` and `reviewToken`.
- `POST ./people/{personId}/ny-dbl/evidence` retains the worker's single opening
  evidence stream. Supply expected `version`, exact reviewed `planId` and
  `planVersion`, `source`, `premiumReference`, `attributablePremiumCents`,
  `priorPremiumOffsetCents` and `weeks`. Each nonoverlapping seven-day week has
  `from`, verified employer `wagesCents`, combined opening `priorCollectedCents`
  and either null `concurrent` or its `requestReference`,
  `verifiedEarningsReference` and supplied `otherWagesCents`. Weeks must lie
  within the plan period. No company identifier or foreign payroll lookup is
  accepted as concurrent evidence.
- `GET ./people/{personId}/ny-dbl/evidence/review` and
  `POST ./people/{personId}/ny-dbl/evidence/approve` provide the same exact review
  protocol. Material source changes require a new revision and review.
- `POST ./people/{personId}/ny-dbl/proposals` takes `id`, expected `version`,
  `evidenceVersion` and `checks`. Each weekly check fragment has a unique
  `reference`, `weekFrom` and `wagesCents`. A biweekly check supplies its two
  weekly fragments. References cannot enter another proposal for the worker.
  Identical replay returns the existing proposal. Corrections replace only the
  latest reservation of that proposal while retaining all earlier versions.
- `GET ./people/{personId}/ny-dbl` reads evidence and proposal history with
  current-source flags. The records and source references use existing private
  encryption, attributed audit, worker custody and erasure fences.
- `POST ./calculation-preview` accepts an optional `nyDbl` reference with
  `personId`, `proposalId` and exact `version`. The referenced weeks and wages
  must match this preview. Its separately inspectable DBL result preserves all
  unresolved jurisdiction and payroll holds. No proposed DBL amount is labeled
  a PFL amount or tax-agency liability.
- `POST ./people/{personId}/ny-dbl/remittance` refuses with
  `dbl_carrier_remittance_unavailable`. No carrier adapter or payment effect is
  fabricated.

The preparation write checks the source versions, current authority, privacy
hold and other preparations atomically. Existing reservations remain conservative
when sources become stale. Correct them explicitly; a changed source cannot
silently free a prior proposal or revive its authority. Reopening a source does
not establish the accuracy of supplied prior collections or premium evidence.

Genuine carrier or approved self-insurance evidence, complete authoritative
source import and migration custody, actual collection and refund, employer
funding and accepted carrier or NYSIF remittance remain unproved. Complete PFL
calculation and remittance are separate obligations. Prepared values prove
neither insurance coverage nor paid payroll or remittance.
