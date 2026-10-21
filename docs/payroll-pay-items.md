# Reviewed pay setup and retained earnings

Use Payroll preparation → Pay items and reviewed changes, or
`/app/envelope/companies/{company}/pay-settings`. The equivalent API begins
`/api/envelope/companies/{company}/pay-settings`. Native human sessions and
existing company-wide compensation/read/propose/approve powers are required.
Agent bearer credentials are refused. No run-release, settlement or correction
receipt can be created by a client flag.

POST `/group` with `id`, prior `version`, `name`, and `people` (existing person
IDs). GET `/review/group/{id}` to inspect the immutable proposal and obtain a
short-lived session-bound `reviewToken`. POST `/group/{id}/approve` with that token
and exact `version`. Pay item and pay change review/approve paths follow the same
shape. An updated person or source revision invalidates the decision transaction;
a review token never approves another version, session, grant or company.

POST `/pay-item` with `id`, `version`, `name`, `groupId`, `amountCents`,
`effectiveDate`, `recurring`, `taxCode`. Implemented setup codes are
`w2-cash-earning`, `accountable-reimbursement`, `after-tax-deduction`.
Accountable-plan setup additionally needs `evidenceRef` and `returnExcessBy`.
A recurring reimbursement still requires each period's substantiation and return
of excess; its exclusion is unresolved until those are verified. These are
reviewed configuration categories, not complete federal/state/local tax rules.
IRS reference: https://www.irs.gov/publications/p463 .

POST `/pay-change` with `id`, `version`, `name`, `groupId`, `effectiveDate`, and
`items`. Each item contains `personId`, current `personVersion`, `rateCents`,
`basis` (`hourly` or `annual-salary`), `employmentFrom`, `employmentThrough`, and
`unpaidDates` (ISO dates). Only reviewed group members may be included. Invalid
codes, stale people and unreviewed/withdrawn groups refuse. The exact native
review lists every person's proposed terms; it is a setup decision, not a payroll
approval.

POST `/preview` with `groupId`, `periodStart`, `periodEnd`, `payDate`, `frequency`
to calculate regular hourly/salaried earnings from effective approved setup.
Hourly minutes come from persisted work inputs. Salary preview uses calendar-day
proration within the chosen period and 52/26/24/12 annual periods, accumulating
integer rational cents and rounding once per worker. Actual exempt/nonexempt,
leave, holiday, overtime and jurisdiction compliance remain unresolved; no preview
can be approved as payroll. Proposed proration is not permission for an unlawful
salary deduction. A later clause must verify the employment policy and legal basis.

POST `/earnings-run` with the same fields plus `id`/prior `version` retains an
immutable draft with exact setup/work sources. GET the settings to reload it.
New or withdrawn setup marks affected group drafts `changed-repreview-required`;
the stored original is preserved. POST `/{kind}/{id}/withdraw` with exact version
to undo approved setup for future preparation. Withdrawal cannot rewrite settled
checks. True post-settlement corrections, lawful deduction limits, complete tax
calculation and actual payable runs await their implementations and an authorized
ENV-011/035/065 rail. There is deliberately no route accepting a claimed settlement.
