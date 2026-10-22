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
`unpaidDates` (legacy ISO dates, never salary deduction authority). Salary setup
also accepts `salaryType` (`exempt`, `nonexempt`, `unverified`) and `unpaidLeave`:
`[{day, minutes, reason, evidenceRef}]`. Reasons are `personal`, `sickness-plan`,
`fmla`, `other`. Only reviewed group members may be included. Invalid codes,
stale people and unreviewed/withdrawn groups refuse. Setup review lists every
person's terms; it is not payroll approval.

POST `/proration-policy` with `id`, prior `version`, `name`, `groupId`,
`effectiveDate`, `method` (`calendar-days`, `scheduled-workdays`,
`scheduled-hours`), `weekMinutes` (seven scheduled minute counts Sunday through
Saturday), and `weekStartsOn` (0 Sunday through 6 Saturday). The native settings
form creates the same proposal. Review/approve/withdraw follows the exact
session-bound setup ceremony. A proposed policy never selects a payable method.
An effective future revision retains earlier approved revisions for earlier dates.
Overlapping policies with the same effective date require review; no arbitrary
method wins. Policy revision/withdrawal invalidates dependent retained drafts.

POST `/preview` with `groupId`, `periodStart`, `periodEnd`, `payDate`, `frequency`
to calculate regular hourly/salaried earnings from effective approved setup.
Salary uses the chosen period basis and 52/26/24/12 annual periods, accumulating
exact rational cents and rounding half-up once per worker. Details retain method,
calendar/workday/hour denominator, rate, policy effective date and coded leave.
For $120,000 annual salary and a Jan 16 hire, January previews $5,161.29 by
calendar days and $5,000.00 by Monday-Friday workdays. A nonexempt salary uses
actual work minutes against scheduled period minutes and identifies the input
still owed to ENV-006's workweek regular-rate/overtime calculation.

Without a chosen method, `proration-policy-required` holds the interim calendar
preview. Unverified exemption has `proration-classification-review`. Untyped
unpaid dates never reduce salary. Unscheduled leave deducts nothing. Evidenced
whole scheduled personal/sickness-plan days and evidenced FMLA minutes can alter
the exempt preview; personal partial days, unsupported reasons and conflicting
work become `proration-leave-review`, preserving salary. These references are
not verified signed leave or plan custody. Every salary preview also has
`proration-preview-only`: stricter work-state law, full legal treatment and
payroll remain unfinished. Mid-period salary changes require named review.
No computed preview authorizes a deduction or money movement. Governing source:
[29 CFR 541.602](https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.602).

POST `/earnings-run` with the same fields plus `id`/prior `version` retains an
immutable draft with exact setup/work sources. GET the settings to reload it.
New or withdrawn setup and period-relevant recorded rules mark affected group drafts `changed-repreview-required`;
the stored original is preserved. POST `/{kind}/{id}/withdraw` with exact version
to undo approved setup for future preparation. Withdrawal cannot rewrite settled
checks. True post-settlement corrections, lawful deduction limits, complete tax
calculation and actual payable runs await their implementations and an authorized
ENV-011/035/065 rail. There is deliberately no route accepting a claimed settlement.

POST `/earnings-run/{id}/approve` or `/earnings-run/{id}/release` explicitly
refuses with `proration_preview_not_payable` (409) and makes no decision or
external request. This refusal covers the real retained earnings draft; it is
not an approval/dispatch implementation. There is no client-supplied completion,
settlement or receipt field that grants authority.
