# Reviewed HR and job-source intake

Person pages link to `hris` and `earnings-sources` under
`/app/envelope/companies/:company/people/:person/`. The same `/api/` paths
accept/return JSON. Current company, location, compensation and native-session
checks apply. Import requires `rates:propose`, reads require `records:read` plus
compensation visibility, and exact review/decision requires `rates:approve`.
Source documents, I-9s, policies and enrollment details are never copied.

POST a source statement with `provider`, `sourcePersonId`, `sourceVersion`
(consecutive starting at 1), `version` (previous local revision, initially 0),
`sourceApprovedBy`, `sourceEvidence` and `export` (an object or JSON text).
HR statements also select `type`: hire, rate, location, leave, benefit or
termination. The external/local worker mapping is explicitly reviewed; names
and emails never join people automatically. Lodge is refused as a direct source.

The source product still owns its record. Source approval is evidence, not a
local approval. GET `/:id/review`, then POST `/:id/approve` with the returned
`version` and native-session-bound `reviewToken`. POST `/:id/withdraw` with
its version to withdraw approval. Replayed source revisions refuse without a
new input revision. Corrections retain the same source identity and advance
both revisions. The acknowledgement identifies human-review holds, source
changes and affected retained run IDs/periods. `reviewed-for-preview` never
means delivered, paid or accepted by the source product.

## Create a payroll person from a Willow hire

The company page links to `/app/envelope/companies/:company/hris-hires` (JSON
under `/api/`). POST a Willow statement with the same source/version/evidence
fields and `export: {schema: "envelope-willow-payroll@1", sourceId,
effectiveDate, values: {name, locationId}}`. The location must belong to this
company. No HR document, policy or I-9 is copied. Only Willow is admitted;
Lodge must hand its hire through Willow.

GET `/:id/review`, POST `/:id/approve` with the exact version and same-session
review token, then POST `/:id/apply` with `version`. Creation requires current
people-write and compensation authority as well as exact source approval. A
single D1 transaction binds the source worker to one payroll person and records
the acknowledgement. Replaying apply returns that same person without a second
record or audit. An unreviewed or stale hire creates nothing. Corrected source
versions retain their original person link. Import and approval alone never
rename or move the payroll record. An explicit `/:id/apply` on the newly reviewed
revision corrects the existing payroll name and company location, increments the
person version and records one attributed acknowledgement. The review displays
the server-captured person version; any intervening person change refuses the
application. Source replacement, withdrawal, loss of current authority and an
unknown company location also refuse. Replaying an applied revision returns the
same person without another write. The hire page shows the applied source revision
and offers the reviewed correction action.

This corrects the payroll-required hire profile, including a mistaken hire
location. It does not itself apply a later effective-dated relocation event or rewrite
historical work allocations. Existing retained previews become stale and need
fresh source and person review. No policy, benefit enrollment, payment or remote
acknowledgement is created.

Payroll previews bind the source hire version. Work before the reviewed hire
date becomes an explicit employment/date conflict; the source cannot authorize
underpayment or late wages. A changed source invalidates a retained preview and
needs fresh review. Payroll-only standalone records remain available without
an HRIS; a real linked hire uses this source door instead of re-keying an HR file.

## HR schemas

These are input/export adapters, not live connection or sandbox receipts:

- Willow: the Envelope-side `envelope-willow-payroll@1` contract has `sourceId`,
  `effectiveDate` and `values`. Rate uses hourly `rateCents`; location uses an
  existing payroll `locationId`; leave uses `minutes`, `rateCents`, and paid
  `code`; benefit uses `amountCents` and `code`; hire/termination need no copied
  employment document. This is a proposed integration door, not a claim that
  Willow currently emits it or that a remote change was acknowledged.
- BambooHR v1 employee fields: `id`, `payType: Hourly`, `payPer: Hour`,
  `payRate`, `payRateEffectiveDate`. Plain amounts, dollar-prefixed USD amounts and USD-suffixed text with zero decimal padding preserve exact cents; other currencies and nonzero fractional cents refuse review instead of silently rounding. The local event identity includes the
  employee and effective date, preserving separate future rate changes.
  Source: https://documentation.bamboohr.com/docs/list-of-field-names
- HiBob Employee data API 1.0.0 `SalaryEntry`: integer `id`, `effectiveDate`,
  `payPeriod: Hourly`, `base: {currency: USD, value}`. Source:
  https://apidocs.hibob.com/reference/get_people-id-salaries
- Rippling REST v2 `Compensation`: `id`, `worker_id`, `hourly_wage:
  {currency_type: USD, value}` and `salary_effective_date`. Worker ID must match
  the reviewed source person; the event identity includes its effective date.
  Null/redacted or other-currency values cannot become zero/default wages.
  Published schema inspected 23 October 2026:
  https://developer.rippling.com/documentation/rest-api/reference/schemas/compensation

Only exact reviewed effective hourly rates feed hourly previews. Same-date
conflicts and unreviewed corrections stay held. A reviewed termination excludes
subsequent workdays from the provisional earnings and retains a final-pay
handoff hold. Later location and benefit changes need their own reviewed allocation
and deduction implementation; this door never changes HR policy or enrollment.

For reviewed Willow leave only, POST `/:id/leave-handoff` with the current
`ledgerVersion` to propose the source leave in an existing Willow-owned leave
ledger. The matching sick, PTO or holiday bank is selected when present; otherwise the legacy combined ledger is used. An explicit `bucket` remains subject to the same code and owner checks. That ledger needs its own exact review. Source versions are pinned in
the ledger and retained payroll preview; a correction reserves only the minutes
difference. Replay cannot reserve it twice. This is a reservation, not a returned
paid-consumption receipt.

## Job earnings

Gauge, Plinth, Glove, Mallet, Strap and Orbit accept the Envelope-side statement
`envelope-job-earning@1`: `sourceId`, `effectiveDate`, `status: approved`,
`currency: USD`, `paymentState: unpaid`, `amountCents`, `jobId`, `approvedBy`,
and `earningType` (job, commission or per-service). This documents Envelope's
intake contract; it does not manufacture a sibling's remote API or receipt.
A source correction replaces its earlier amount in the selected period, never
adds a second earning. Each source record has independent identity and review.

Easel is a cost reader/planner and cannot submit earnings. Purse supplier bills,
Coaster reimbursement choices, planning proposals and already-paid expenses
cannot become payroll instructions. Owners and currently permitted compensation
readers can inspect source history; removing visibility denies a fresh session
and grant changes invalidate old sessions immediately.

`GET /api/envelope/companies/:company/labor-actuals` applies current compensation
permissions and refuses `reconciled_labor_actuals_unavailable` until a real payroll
close exists. It never relabels an earnings preview as actual cost. Complete
payroll tax calculation, actual payroll/leave-result return, live connection
lifecycle, all named external event types and reconciled labor actuals remain
unfinished. ENV-028/034/042/051/053/054/055 inherit these source doors, encrypted
workspace kinds, the source-to-person mapping table and approval dependencies when their full workflows are built.

## Explicit effective location handoff

A reviewed Willow location event captures the current payroll person version. POST its `/:id/location-handoff` with the exact source `version` to apply the current payroll profile location once the effective UTC date has arrived. The native source history also offers this explicit action. Both the old and destination locations require current compensation and record-write authority. A future, unreviewed, withdrawn, replaced or person-stale source refuses without a profile change or application acknowledgement. Replays retain one local applied-revision acknowledgement; concurrent applications cannot increment the person twice. Source and person revisions remain retained, and previous person-bound previews require fresh review. Historical actual-work allocations remain unchanged. This is a local profile handoff, not remote delivery or a payroll result receipt. Other HRIS location adapters, benefits, final pay and the shared connection lifecycle remain unfinished.

## Exact-period benefit deduction preview

A Willow benefit statement can additionally supply `taxTreatment: after-tax`,
`periodStart` and `periodEnd` inside `values`. All three are required together;
the effective date cannot follow the period end. The exact human-reviewed
source amount feeds only the matching period's held earnings preview, once.
It appears in the after-tax deduction total with its code, original source and
revision. A pending or withdrawn revision contributes no amount. Corrections
replace the previous amount and invalidate retained previews. Two source
identities for the same benefit code and period contribute neither amount and
retain a named reconciliation hold, including when one was withdrawn.

This bounded preview neither changes enrollment nor establishes lawful
deduction limits, pretax treatment, contribution delivery or a payroll result.
It does not consume an election across runs or claim a remote acknowledgement.
`tests/payroll-runtime.mjs` — `sourceIntakeJourney` proves review gating, replay,
replacement correction, retained-preview invalidation, same-code conflict and
native source screens at 1440 and 390. Complete benefit application, final pay,
external location adapters and restricted actual-result return remain open.

## Reviewed termination deadline handoff

A Willow termination statement may include `values.separation` as `discharge`,
`quit-with-notice` or `quit-without-notice`. Its effective date remains the last
employment day. Exact local review is required before the held payroll preview
uses the reason and date in the existing final-pay deadline calculation.
California discharge and timely-notice cases retain the last-day deadline;
the existing conservative date-only quit rule retains its 72-hour boundary.
A missing reason, conflicting termination sources or an unsupported work-state
deadline remains held for review. No earnings preview is a paid final check,
leave payout determination or remote result.

`tests/payroll-runtime.mjs` — `sourceIntakeJourney` proves unreviewed refusal,
a source-linked California immediate deadline, timely versus late preview,
retained-run invalidation and a reviewed corrected separation reason, with
native source screens at 1440 and 390. Complete final-pay handoff and actual
payment remain open.
