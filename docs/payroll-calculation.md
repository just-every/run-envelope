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

The ordinary withholding corpus has one independently calculated fixture for each
of the 50 states and DC. These are bounded component methods, with explicit
certificate elections and source dates. An unproved election, period, source
boundary or other program does not become zero tax. For example, NJ requires its
table and allowances; IL requires basic and additional allowances; AZ requires a
nonzero A-4 percentage. The coverage door lists all 51 case identifiers and their
source references. Ohio and Vermont use identified official federal processing
references whose original state-table reconciliation remains unproved.

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

## Retained component methods

The nine no-wage-income-tax determinations are Alaska, Florida, Nevada,
New Hampshire, South Dakota, Tennessee, Texas, Washington and Wyoming. Other
payroll programs remain required there. The remaining state and DC methods are
also components: all 51 complete-state determinations remain unproved. The
journey refuses a corpus where a component lacks an independent golden case.

Each state keeps its own period constants and rounding. Colorado follows DR 1098
in cents. Iowa follows the 2026 formula's period deductions and separately rounded
allowance. Idaho uses its July period thresholds. Kansas uses the published
period tables rather than scaling annual thresholds. North Carolina and Missouri
use their specified whole-dollar methods. California uses the expressly permitted
annual Method B. Wisconsin retains fractional cents through its deduction phaseout.

The retained Idaho edition starts July 23, and Utah's starts June 1. Earlier
proposed checks for those states remain unmapped. Oregon's 2026 formula gives an
$8,750 federal subtraction cap while FAQ 3 still says $8,500: checks in the
conflicting interval remain held pending source clarification. No interpretation
or reduced scope is invented. Its low-base applicability is also held where the
retained table supplies no applicable row. Other Oregon programs remain separate.

The `2025-01` edition supports retained federal historical calculations. Historical
state tables remain unmapped; 2026 state component coverage and SUI assumptions
never carry into 2025. The result carries the requested coverage edition.

The program inventory retains the January 2026 DOL reference wage bases and base
new-employer rates for all 51 states, with conditional bases and rate years. It
never applies them as an assigned employer rate. Industry factors, surcharges,
non-UI taxes and current state-law determinations remain required. The export
explicitly retains WA L&I, OR WBF, NY DBL and PFL, Hawaii capped plan shares and
OH, ND and WY compensation obligations rather than omitting them behind an
income-tax-only denominator. This inventory is unfinished calculation work.

The result includes the federal worksheet, annual adjusted wages, selected bracket,
rate, credits and rounding rule. State components retain their bracket or rate
basis. Inputs assume an ordinary resident corporate employee with ordinary cash
wages; no family, visa, agricultural or other special exemption is inferred.
Georgia uses the retained September guide for proposed checks from October 28.
Mississippi requires the actual certificate exemption amount. Nebraska currently
requires zero allowances; nonzero elections need the minimum-withholding rules.
Every supported component is exercised by one of 51 independent cent-level
golden cases within the public-door calculation journey. These cases do not
prove complete jurisdiction calculation, legal compliance or actual payday.

Oklahoma retains the actual printed period thresholds and rounded exemption
constants. New Mexico currently retains only its weekly percentage table and
refuses to substitute that table for another pay frequency. A regular-wage tax
election exceeding cash wages returns a named hold and an unavailable net.
That refusal is distinct from the lawful statutory tip-tax shortage.

Montana retains its actual period formula. Page 16 requires rounding up while
some examples use nearest-dollar rounding. The component is held whenever those
readings differ for the proposed amount; no interpretation silently chooses a tax.
The complete-period schema requires the proposed payment on or after its end.

West Virginia uses its March 2026 printed period schedules and whole-dollar
rounding. One-job and two-job tables require an explicit certificate election;
marital status never silently selects the lower schedule.

Louisiana follows R-1306 for the actual L-4 standard-deduction election, including
its two independent worked examples and the 3.09% withholding cushion. Rhode
Island currently maps only its weekly percentage table with zero RI-W4 allowances;
other periods and allowance cases remain held.

Hawaii follows Booklet A Part 1, which expressly permits annualized calculation.
Its regular HW-4 allowances, extra lump-sum allowance and published annual bracket
bases are retained, with the official weekly worked example.

Connecticut follows TPG-211 steps 1 through 16 for explicit CT-W4 codes A, B, C,
D and F, including personal exemptions, the 2% phase-out add-back, tax recapture,
personal tax credits and additional or reduced withholding. Supplemental
compensation remains separately unmapped; no generic exemption is inferred.

Maine follows its revised August 2026 percentage method below the published
standard-deduction phaseout threshold, including the state’s whole-dollar
rounding. High-income phaseout and surcharge cases remain held.

Maryland retains the first state withholding bracket, its printed per-period
standard deduction and MW507 exemption constants. The withholding rate is 4.75%,
rather than the lower income-tax-return rates. County withholding and higher
state brackets remain unmapped, and no complete Maryland net is returned.

Arkansas follows its 2026 computer formula, annual whole-dollar gross-tax rounding
and AR4EC credits. Step 2 and its worked example disagree on the upper limit for
the midrange method; the disputed interval remains held. Its independent monthly
worked example is exercised through the same preview API.

Massachusetts uses Circular M’s printed period exemption factors and credits,
not annual factors divided approximately. Its explicit prior retirement-deduction
accumulator caps current actual FICA and other qualifying retirement deductions
at the remaining $2,000 allowance. The 2026 annualized 4% surtax is included;
supplemental wages and PFML remain separately unmapped.

Ohio’s retained component uses the official September 23 NFC processing formula
and the state’s August effective-date announcement. Reconciliation to the original
state table remains unproved. The date gate uses the payroll period end, so paying
an older period later cannot select a newer rule. Ohio municipalities, school
districts and other state programs remain separately unmapped.

Vermont’s retained component uses the official June 9 NFC processing formula
with an explicit state certificate and no inferred federal-election fallback.
The current state publication is identified, but original state-table
reconciliation remains unproved. Earlier state editions remain unmapped.
The 51 ordinary component cases do not establish complete-state or complete
program coverage: the complete-state count remains zero.
