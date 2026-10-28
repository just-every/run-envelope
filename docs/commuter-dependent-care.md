# Reviewed commuter and dependent-care proposals

Envelope can prepare salary-reduction deductions for combined transit and vanpool,
qualified parking, and dependent care. This is a private native-owner API increment.
It does not collect deductions, pay benefits, reimburse claims, or remit funds.
Administrator eligibility and substantiation, statutory plan compliance, commuter
ordinance participation and complete payroll and year-end outcomes remain unproved.

The federal arithmetic follows IRS Publication 15-B for
[2025](https://www.irs.gov/pub/irs-prior/p15b--2025.pdf) and
[2026](https://www.irs.gov/pub/irs-prior/p15b--2026.pdf), under “Dependent Care
Assistance” and “Qualified Transportation Benefits.” The years remain separate:

| Year | Combined transit and vanpool, monthly | Parking, monthly | Dependent care, annual | Married filing separately, annual |
| --- | ---: | ---: | ---: | ---: |
| 2025 | $325 | $325 | $5,000 | $2,500 |
| 2026 | $340 | $340 | $7,500 | $3,750 |

Dependent care is also limited by the employee's earned income and, where married,
the spouse's earned income. Other excluded household benefits reduce the available
ceiling. Special deemed earnings for a student or incapacitated spouse are not
implemented; supply supported actual earned income or retain the hold. Preparation
does not establish a married separate filer's eligibility for an exclusion.

The configured installation owner needs a current native session and current
company authority. Agent credentials and delegated staff cannot use these doors.
This conservative interim restriction does not discharge the product's scoped-role
duties. Versions and human reviews use the existing encrypted payroll workspace,
attributed audit, exact review tokens, statutory custody and erasure fences.

## Company setup doors

For an existing company and worker, the base path is
`/api/envelope/companies/{company}/people/{person}/pretax-benefits`.

- GET the base path to inspect retained election and accumulator versions.
- POST `elections` with `category` (`transit`, `parking`, or `dependent-care`),
  `taxYear`, expected `version` (zero initially), `electedOn`, `effectiveFrom`,
  `effectiveThrough`, `electedCents` and `evidenceReference`. An election must be
  made on or before its effective start. The elected ceiling is monthly for
  commuter benefits and annual for dependent care.
- Dependent-care elections also require `dependentCare` with `filingStatus`,
  `employeeEarnedIncomeCents`, `spouseEarnedIncomeCents` for married filers, and
  `otherExcludedCents`. Supported filing statuses are `single`, `married-joint`,
  `married-separate`, `head-household` and `qualifying-survivor`.
- POST `accumulators` with the category, year, expected version, `through`,
  `evidenceReference` and `entries`. Each entry contains a distinct `sourceId`,
  date of benefit provision, total `benefitCents`, actual prior `excludedCents`
  and prior salary `deductionCents`. Include employer-provided benefits too.
  An explicit empty register is required when there are no prior benefits.
- GET `elections/{id}/review` or `accumulators/{id}/review`, inspect the returned
  exact version, then POST its `decision` with `version` and `reviewToken`.
  Transit, parking and dependent care each require their own review. To withdraw
  an approved source, POST its `decision` with `version` and `withdraw: true`.

Corrections append a new immutable version and require fresh review. An old review
token cannot approve a replacement. Existing historical versions remain evidence.
No client-supplied reviewer identity, approval flag or computed exclusion is used.

## Calculation preview

POST the existing company `calculation-preview` door with its ordinary calculation
input and a `benefits` selection containing `personId`, the current payroll
`sourceId`, and `requests`. Each request names `category`, `amountCents`,
`electionVersion` and `accumulatorVersion`. The actual retained reviewed sources
are loaded server-side; omitted, withdrawn or superseded sources refuse.

The pay date selects the benefit month and tax year. Prior entries from that month
share its commuter ceiling; dependent care uses the entire tax year. There is no
unused monthly allowance carryover. Employer and employee benefits share the
exclusion. Amounts beyond the remaining exclusion stay taxable and appear as
proposed after-tax deductions. Amounts beyond the remaining elected deduction
are refused. An accumulated source cannot be proposed again.

The response includes source citations, reviewed version identifiers, the proposed
deduction, its pretax and after-tax portions, taxable excess and remaining allowance.
It applies the proposed federal exclusion to income-tax, Social Security, Medicare
and FUTA wages, retaining the ordinary wage-base limits. Dependent care also
returns the proposed year-to-date Box 10 benefit amount, including taxable excess.
Previously excluded amounts above a corrected limit produce an explicit correction
hold; no earlier payroll or reporting is silently rewritten.

Preview is repeatable across restart and never advances an accumulator. A completed
payroll's actual benefit and deduction amounts must be imported explicitly before
preparing a later period. The source reference distinguishes an already included
payment from a new proposal, including separate checks on the same day.

State conformity, local rules, deduction legality and actual eligibility remain
explicit holds; there is no complete net-pay or payment-ready result. Combining
these proposals with reported tips is refused until that taxability is mapped.
QSEHRA and ICHRA administrator imports, substantiated reimbursements, duplicate
claim prevention, FF versus ICHRA reporting and required ACA reporting remain owed.
This door assigns neither arrangement a reporting code and creates no claim receipt.
