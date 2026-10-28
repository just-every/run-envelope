# Dated payroll calculation preview

The native company API exposes `POST /api/envelope/companies/{companyId}/calculation-preview`
and `GET /api/envelope/companies/{companyId}/calculation-coverage`. The current native
company owner may request a hypothetical calculation. A preview reads no employee
record, retains no supplied personal data, creates no approval and sends no money.
Current company authority is checked again before returning the calculation.
Bearer credentials cannot use this door.

Supply an explicit `2026-01` edition, actual `payDate`, `from`, `through`,
`frequency`, `workState`, `residentState`, `locality`, `remuneration`, `w4`,
`stateElection`, `yearToDate`, `tips` and `deductions`. Frequencies are weekly,
biweekly, semimonthly and monthly. Dates and all cent amounts must be valid;
missing accumulators never mean zero. The edition is a calculation identifier,
not a claim that every jurisdiction is mapped.

Remuneration is either an explicitly exempt salary with `cashCents`, or hourly
`weeks`. Each complete workweek supplies `from`, dated `days` with ordered
`segments` of `hoursHundredths` and `rateCents`, a `productionBonusCents` amount
allocated to that earned week and approved `premiums`. Each California premium
names its day, `meal` or `rest` kind, approver and unique source identifier.
Premiums do not create worked hours. Flat-sum bonuses, alternative workweeks,
special wage orders, piece work, pre-tax benefits and imputed income are not
accepted by this remuneration schema.

The modern W-4 supplies `version: "2020_or_later"`, `filingStatus` (`single`,
`married_joint` or `head_household`), `step2Checked`, `step3AnnualCreditsCents`,
`step4aOtherIncomeCents`, `step4bDeductionsCents` and
`step4cExtraWithholdingCents`. Retained pre-2020 ordinary elections use the
existing federal formula's explicit legacy schema. No generic exemption or
IRS lock-in override is accepted here. This door does not replace the separate
retained worker classification and binding IRS-instruction doors.

`yearToDate` requires `socialSecurityWagesCents`, `medicareWagesCents`,
`futaWagesCents` and `suiWagesCents`. `tips` requires `heldCents`, `paycheckCents`
and `furnishedCents`. Furnished funds in this hypothetical are an input, never
a receipt, debit authorization or collection claim. Actual received funds remain
in the existing retained tip-funds door. Deductions require a kind, cent amount
and authorization reference. The aggregate federal ordinary-creditor ceiling
is checked, but a ceiling never establishes a valid order, stronger state
protection or lawful voluntary deduction. Those deductions remain held.

## Calculation and source boundaries

Federal periodic withholding uses the retained IRS Publication 15-T 2026 tables,
including the actual W-4 steps and separate Social Security, Medicare,
Additional Medicare and FUTA lines. FUTA uses the gross 6% without an invented
credit for state tax payment. This preview does not establish final annual
FUTA credit reductions or filed Form 940 amounts.

Ordinary state withholding components initially cover Pennsylvania, New Jersey,
New York, Illinois and Arizona, with cited no-wage-income-tax determinations for
Texas, Washington and New Hampshire. State elections are explicit: NJ table,
allowances and additional cents; NY filing status, allowances and additional
cents; IL basic allowances, additional allowances and additional cents; AZ
nonzero elected basis points and additional cents. The remaining listed states
return an unmapped amount, never a fabricated zero. Other state programs and
local authorities remain distinct obligations even in a no-income-tax state.

The coverage response always lists all 50 states and DC. It reports component
coverage separately from complete-state coverage, which remains zero. A work
or residence mismatch, unknown state, local authority or unproved state program
returns a named employee hold with reason and next action. The complete net
is `null` while any such hold remains. Component federal amounts are explicitly
federal only. The Texas 2.7% SUI floor on the first $9,000 is displayed only as a
review input: the greater NAICS-specific new-employer rate or assigned current
rate remains required. Missing account numbers do not change any calculated
amount and this API does not infer an assigned rate from registration status.

The tip component preserves IRS Publication 15's ordering: regular wage taxes,
then tip Social Security and Medicare, then tip income tax. Already-held tips
never become a second cash payment. A statutory tip-tax shortfall creates no
negative-net deduction hold and no employee debt. Other genuine source or
coverage holds remain. No result is human-approvable, payable, a completed
zero-cash statement or a zero-dollar bank instruction through this door.

Sources are dated and cited in each result. Current source material used for
this increment includes [IRS Publication 15-T 2026](https://www.irs.gov/publications/p15t),
[California 2026 Method B](https://edd.ca.gov/siteassets/files/pdf_pub_ctr/26methb.pdf),
[Illinois IL-700-T 2026](https://tax.illinois.gov/forms/withholding/currentyear/il-700-t-withholding-guide-tables.html),
[Texas unemployment rates](https://www.twc.texas.gov/programs/unemployment-tax/tax-rates)
and [DOL state unemployment provisions, January 2026](https://oui.doleta.gov/unemploy/content/sigpros/2020-2029/January2026.pdf).
The latter is an inventory source, not a substitute for an assigned employer rate.
The licensed vendor reconciliation remains field proof R-5 and does not gate
calculation engineering or completion.
