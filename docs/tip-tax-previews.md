# Federal tip-tax preparations

These native API doors retain calculation snapshots for reviewed ordinary resident
employees at Texas workplaces in 2026. They do not make an earnings run payable,
complete payroll, create a bank transfer, issue a stub, export a final filing
schema or establish agency acceptance. State and local calculation, tip-credit
eligibility and minimum-wage top-ups remain separately unproved.

The company and person industry API has two additional resources:

- POST `./tip-tax-previews`: `id`, `version`, exact `runId` and `runVersion`,
  `reportReceivedOn`, `reportEvidence`, `socialSecurityBeforeCents`,
  `medicareBeforeCents` and `yearToDateEvidence`. GET returns retained versions.
- POST `./tip-tax-funds`: the same run and report basis, a unique `id`,
  `amountCents`, `status` equal to `received` and a `receiptRef`. This requires the
  current company owner. Receipt identity is claimed once across the company.
  The current receipt collection is fenced atomically against concurrent writes.
  A promise, excess amount, stale run or receipt after the collection window
  refuses. The server records the receipt date and human attribution. These are
  employer attestations, not independently verified bank receipts. No debit or
  automatic collection is authorized.

For example the resource prefix is
`/api/envelope/companies/{companyId}/people/{personId}/industry`.
The calculation reads a currently reviewed effective classification and W-4,
current source-bound earnings, and separately typed already-held and paycheck
tips. After-tax deductions, unreceipted legacy furnished funds, reimbursements,
unsupported special classifications, unresolved source holds and monthly tips
below $20 refuse this bounded preparation. Existing payroll holds remain intact.
No general tax exemption or legal-deduction eligibility is inferred.

## Ordering and retained facts

IRS Publication 15 section 6 places regular wage taxes first, tip Social Security
and Medicare next, and tip income tax last. The aggregate method computes income
tax on wages plus tips using the reviewed W-4 and subtracts regular-wage income
tax. This preparation supports neither an elected supplemental flat rate nor
separately accumulated supplemental wages over the statutory million-dollar
threshold. Full employer Social Security and Medicare remain owed regardless of
employee collection. Additional Medicare and income-tax shortages never become
W-2 box 12 A or B.

The collection window ends on the tenth day of the month following receipt of
the employee report, distinct from the employee's own monthly reporting deadline.
Snapshots retain the report evidence, server date, deadline, open or closed
collection state, receipt references, actual furnished amount, used and unused
balance, calculation order and collected and uncollected amounts. A later receipt
produces a new snapshot; it never rewrites the earlier wage preparation. Actual
collection and any unused-funds disposition still require operational custody
and reconciliation proof.

Adopted calculation convention pending CT review: a partially collected tip FICA
group allocates proportionally to the Social Security obligation, rounds that
share to cents, then assigns the residual to Medicare and Additional Medicare.
This is a disclosed convention, not a claim that IRS specifies that cent-allocation
algorithm. Owner-only recording of received funds adds no banking authority.
This pending policy and all remaining legal and provider boundaries keep ENV-009
PARTIAL.

The returned reporting basis includes full tip wages and both shares on 941 line
5b, all Medicare wages and both shares on 5c, Additional Medicare on 5d, the
negative uncollected Social Security, Medicare and Additional Medicare adjustment
on 941 line 9 and 944 line 6, and
W-2 box 12 A and B. Before the window closes these remain provisional. This is
not final-schema validation, a filed return, a qualified-tip deduction claim,
Form 8846, Form 8027 or W-2 TP, TT, occupation or allocated-tip reporting.

Sources: [IRS Publication 15, sections 6 and 13](https://www.irs.gov/publications/p15),
[IRS Publication 15-T](https://www.irs.gov/publications/p15t),
[IRS Additional Medicare employer FAQ](https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax), and
[26 CFR 31.3102-3](https://www.ecfr.gov/current/title-26/section-31.3102-3).
The supported calculation and its refusal boundaries are exercised through native
HTTP in `tests/run-intake.mjs`, runIntakeCases, within the existing source intake
journey and push workspace shard. Intake screens use the existing design and
visible-word controls; their selected browser captures cover 1440 and 390.
