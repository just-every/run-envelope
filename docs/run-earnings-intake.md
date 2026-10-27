# Run hours and earnings

Open **Payroll preparation**, then **Enter run hours or upload a spreadsheet**.
Use the same run ID when retaining the resulting earnings preview. Preparation
does not send money, calculate complete payroll taxes or establish payment.

## Enter and review

The native form accepts three manual source rows at a time. Reopen it to add or
correct more rows in the same run. CSV, XLS and XLSX templates are downloadable
from that screen. Use the column mapping fields when an uploaded header differs
from its template name. A workbook must contain one visible plain worksheet;
formulas, cell links, macros and error cells are refused. Uploads are bounded to
500 rows and 512,000 bytes.

Each row carries these fields:

| Field | Meaning |
| --- | --- |
| `sourceId` | Stable identity of the earning or allocation within its source name. |
| `personId` | Current payroll worker ID; names never join workers automatically. |
| `day` | Actual work or earning date, as an ISO date. |
| `workweek` | Actual recurring workweek start, as an ISO date. |
| `code` | Regular time, bonus, nondiscretionary bonus, commission, other earning, reimbursement, tip, meal premium, rest premium or a state assessment allocation. |
| `minutes` | Actual minutes, including fractional assessment minutes. Premiums and monetary earnings cannot create worked hours. |
| `amountCents` | Nonnegative integer cents. Regular time uses the reviewed effective rate instead of a supplied amount. |
| `settlement` | Required for tips: `cash` means already held; `paycheck` means owed as new cash. Other codes leave this blank. |
| `evidence` | Retained source approval or tip settlement evidence reference. |
| `state` | WA or OR for the corresponding assessment allocation. |
| `riskClass` | Required for each WA risk-class allocation. |

Keep the source name unchanged across corrections and formats. A blank patch
cell preserves the existing row value. Numeric zero replaces it with zero.
Omitting a row preserves it; to remove its monetary or hour contribution, set
that value explicitly to zero. A new row needs its worker, dates, code and
evidence. Unknown workers, ambiguous tips and inconsistent workweeks are refused
before a version is written. Resolve the worker mapping and resubmit.

Preview shows the affected row, worker, workweek, code and each cell's prior and
proposed values, with create, change and unchanged states. Applying requires the
same preview digest, current input version, native session and grant. Retained
versions include the editor identity, SHA-256 digest of the exact uploaded bytes,
source rows and format.
Identical row replay keeps the existing version and contributes no extra pay.
Changing the run's source name is refused. The same source identity cannot be
claimed by another run, including concurrent submissions.

A human with the existing exact-rate review permission separately reviews the
retained input version. Entry uses the existing rate-proposal permission and
compensation access. Review and entry can be granted to distinct people. Current
session, company and location authority are checked at every door; revocation
also closes template downloads. Source review is distinct from transaction
approval and supplies no payment or filing authority.

## Earnings preview

Retain an earnings preview using the same run ID, reviewed group, actual period
and pay date. Unreviewed, withdrawn or stale intake cannot feed it. A correction
or withdrawal invalidates affected prior transaction approval without changing
the prior immutable run. Adding intake after the original run was approved is
also material. Intake cannot be attached to a different retained run ID.

Already-held tips remain visible as reported tip inputs and add no second cash
payout. Paycheck tips add new cash once. Changing only settlement requires a new
source review and exact run review. Tax amounts and net pay remain unavailable;
the preparation total must not be presented as employee receipt or settlement.
An input refusal is distinct from the statutory uncollected-tip-tax outcome,
whose complete calculation and payday path remain unimplemented.

The bounded federal weekly overtime component follows
[29 CFR 778.109](https://www.ecfr.gov/current/title-29/section-778.109),
[778.110](https://www.ecfr.gov/current/title-29/section-778.110) and
[778.209](https://www.ecfr.gov/current/title-29/section-778.209). For a reviewed
nonexempt hourly worker with complete ordinary workweeks, regular time and an
explicit nondiscretionary bonus or commission are assigned to each actual week.
The preview adds half the week's regular rate for hours above forty, rounded to
cents per week. It never averages hours across a two-week period. Incomplete
weeks, mixed time sources, unclassified bonuses, tipped overtime and premium
cases retain a named review hold rather than substituting a partial result.
Complete state rules and gross-to-net treatment remain held.

State assessment allocations retain their fractional minutes and separate risk
classes. They do not create ordinary wage hours. Meal and rest premiums retain
their own codes and incident day. For the bounded California calculation, enter
60 premium minutes, zero supplied cents and state CA. One meal and one rest
premium may be reviewed per worker per workday; duplicate active codes on that
day are refused. Premium minutes do not enter worked hours. With complete
ordinary nonexempt workweeks, the premium uses straight earnings plus explicitly
allocated nondiscretionary bonuses and commissions divided by worked hours.
The amount is rounded to cents for each premium. An explicit zero removes the
premium contribution after fresh review. The basis follows the official
[California meal-period guidance](https://www.dir.ca.gov/dlse/FAQ_MealPeriods.htm)
and [rest-period guidance](https://www.dir.ca.gov/dlse/FAQ_RestPeriods.htm).
Incomplete weeks, unsupported remuneration, tipped work, other locations and
mixed time sources retain a named hold. Complete California daily overtime,
special wage orders and broader jurisdiction treatment remain unproved. Legacy
zero-minute supplied premium amounts remain reviewed declarations, not a computed
regular-rate result.

## Current boundaries

This is native preparation with bounded reviewed Lanyard and Toast captures.
It does not establish authenticated source synchronization or provider approval.
Source names and evidence references are reviewed declarations. Complete provider intake,
approved tip pools, minimum-wage top-ups, tax ordering and voluntary funds,
collection windows, statutory shortfall payday completion, filing schemas and
year-end forms remain owed. No supported statutory shortfall is claimed from
the current general gross-to-net hold. Reimbursement substantiation and complete
assessment calculations also remain unproved. Existing encrypted custody and
archive foundations do not establish the complete intake-specific retention,
erasure and restore matrix.

## Reviewed provider captures

The optional `providerCapture` field on the existing intake form and its preview
and apply API accepts JSON containing `provider` (`lanyard`, `toast`, `deputy`, `when-i-work`, `clockify`, `square`, `homebase`, `7shifts`, `quickbooks-time` or `clover`),
`account` (the stable source workplace identifier), `payload`, `mappings` and
`evidence` (the reviewed source reference). Applying uses that same capture and
the exact preview digest. The source namespace is derived from provider and
account. Keep the account identity unchanged; it is a reviewed declaration, not
a verified external tenant. Raw source content, its computed SHA-256 digest and
reviewed mappings remain in encrypted version history. Native source review is
still required before the input can enter an earnings preview.

Lanyard uses the exported batch shape produced by its current
[payroll implementation](https://github.com/just-every/run-lanyard/blob/main/src/lanyard/domain/payroll.ts)
and payroll input lines. Supply `id`, `revision`, `status`, `exportedBy`,
`exportedAt` and `lines`. The supported subset is ordinary worked minutes, `meal premium` and
`rest premium` units, and `tips` input amounts in `costCents`. Each line retains
its positive integer `revision`; meal and rest units map to the separate native
California premium codes without creating worked hours. Map each `timeId` or `payInputId` to
`sourcePersonId` (the exact `payrollId`), native `personId`, local `day` and
actual `workweek`. Tip mappings additionally require `settlement` as `cash` or
`paycheck`. The source lineage (or input identity) and earning code form the permanent row
claim across batches; changing batch identity cannot duplicate a source.
Signed corrections, segmented duplicate identities and other earning codes
require additional implementation; they are refused, never treated as ordinary
replacement hours or silently discarded. Imported status is retained evidence
from the supplied capture; it is not verified against a running Lanyard tenant.

Toast uses the array returned by the published
[Labor time entries endpoint](https://doc.toasttab.com/openapi/labor/operation/timeEntriesGet/).
Each supported closed entry supplies `guid`, `employeeReference.guid`,
`inDate`, `outDate`, `businessDate`, `deleted: false`, `autoClockedOut: false`,
`regularHours`, `overtimeHours`, `declaredCashTips` and `nonCashTips`. Map each
entry GUID to exact `sourcePersonId`, native `personId`, local `day`, actual
`workweek` and `settlements` with explicit values for both tip fields. The
reviewed day must match the source business date. Dollar tip amounts convert to
integer cents; source worked hours remain separate from monetary tips. Tender
does not determine settlement. Service charges, withheld tips and rounding
losses require further treatment and are refused when nonzero. An omitted
previously active source row is refused; submit an explicit zero correction.

Reviewed capture imports have no outbound connection or automatic revocation
feed. Withdraw the local source approval when its external approval changes;
affected earnings require fresh review and earlier frozen versions remain
unchanged. The Lanyard and Toast tests execute a reviewed five-day source workweek.
Clockify and Square tests execute bounded time-entry cases. These do not prove
authenticated provider approval, every official schema field or actual payment. Complete
adapter coverage, source-specific custody proof and full jurisdiction calculation remain
open. No provider relationship, settlement or agency outcome is fabricated.

Clockify accepts a reviewed array of locked `REGULAR` entries from the current
[TimeEntryDtoImplV1 schema](https://docs.clockify.me/). Each entry includes
`id`, `userId`, `workspaceId`, `isLocked`, `type` and `timeInterval` with
`start`, `end` and numeric-seconds `duration` as a string. The duration must
match the closed interval. Other duration encodings and nonregular entry types
require source review rather than guessed conversion. The workspace must match
`account`; map each entry identity to exact source and native worker identifiers,
local day and actual workweek. A locked entry is not authenticated employer
approval; native exact review remains mandatory.

Square accepts a reviewed array of closed
[Timecard objects](https://developer.squareup.com/reference/square/objects/Timecard)
using API version 2026-09-16. Each supplies `id`, `version`, `location_id`,
`team_member_id`, `start_at`, `end_at`, `status`, `breaks` and
`declared_cash_tip_money` in USD cents. Closed, nonoverlapping
[break intervals](https://developer.squareup.com/reference/square/objects/Break)
marked unpaid are deducted; paid breaks remain worked time. Open, overlapping
or out-of-shift breaks refuse the entire capture. The source location must
match `account`; mappings retain worker identity, local day, actual workweek
and explicit declared-tip settlement. Other POS earnings and tender types
remain unimplemented. Source wages do not override the native reviewed rate.

Deputy accepts a reviewed array of the official
[Timesheet resource](https://developer.deputy.com/docs/timesheet). The bounded
ordinary-time subset requires positive `Id` and `Employee` integers, `Date`,
Unix-second `StartTime` and `EndTime`, `TotalTime` in hours, `TimeApproved` and
`PayRuleApproved`, and an attributed `TimeApprover`. Discarded, in-progress,
leave and validation-flagged entries are refused. Map the string form of each
source ID to the exact string form of the source employee ID, native worker,
local day and actual workweek. Source date and reviewed local day must agree.
Total paid hours cannot exceed the closed interval; rates remain separately
reviewed native payroll inputs. Other pay-return codes remain unimplemented.

When I Work accepts a reviewed array of the `Time` schema in the official
[API documentation](https://apidocs.wheniwork.com/external/index.html).
Positive `id`, `user_id` and matching `account_id` identify each approved entry.
`start_time`, `end_time` and `length` retain the closed interval and paid hours.
`is_approved` must be true with no alert or payroll-period split; materially
different `rounded_length` requires review. Optional `cash_tips` decimal dollar
strings convert to integer cents only with explicit settlement mapping. Each
source ID maps to native worker, local day and actual workweek. Complete
rounding policies, split-period handling and other earnings remain unproved.

The intake journey inventories original and corrected versions from each
implemented capture family through native privacy routes. An explicit worker
hold restricts a previously authorized staff intake read; the current owner may
inspect held history with attributed audit. Stored captures are encrypted.
This bounded inventory and held-read proof does not establish complete statutory
retention classification, eligible erasure, source replay fencing, shared-run
erasure or inactive archive restore. Those remain explicit completion gaps.

Homebase accepts a reviewed array of approved, closed timecards from the official
[timecard and labor schemas](https://app.joinhomebase.com/api/public/swagger_doc.json).
Positive `id` and `user_id` values identify each entry. `clock_in`, `clock_out`
and `timebreaks` retain actual intervals; only unpaid breaks reduce worked time.
`labor.paid_hours` and the sum of `regular_hours` and `weekly_overtime` must
independently reconcile to those intervals. Native payroll recalculates weekly
overtime rather than trusting a source wage amount. `cash_tips` and `credit_tips`
are dollar amounts, each requiring its own explicit `settlements` mapping.
Nonzero break penalties, leave and unsupported daily or seventh-day overtime
are refused rather than discarded or converted into worked hours. Homebase
documents that individual timecard labor cannot supply complete leave totals;
this adapter does not claim leave coverage from those records.

7shifts accepts a complete reviewed `time_punches` response with `data` and
`meta.cursor.next: null`, following its official
[payroll integration guide](https://developers.7shifts.com/docs/read-time-punch-data)
and [time punch schema](https://developers.7shifts.com/reference/gettimepunches).
Each positive `id` and `user_id` maps explicitly; `company_id` must match the
declared source account. Punches must be approved, undeleted and closed without
automatic clock-out. Paid breaks remain worked time; unpaid, closed,
nonoverlapping break intervals are subtracted. `tips` uses integer cents, as
specified by the [tip update guide](https://developers.7shifts.com/docs/update-time-punch-data),
and requires explicit settlement. An outstanding next-page cursor is refused;
the current path does not fetch additional pages or synchronize webhooks.

QuickBooks Time accepts a complete reviewed response using the official
[timesheet, user and job-code schemas](https://tsheetsteam.github.io/api_docs/).
Supply `results.timesheets` keyed by timesheet ID, `more: false` and
`supplemental_data.users` and `supplemental_data.jobcodes`. Each regular closed
timesheet must retain `id`, `user_id`, `jobcode_id`, `start`, `end`, `duration`
in seconds, `date` and `on_the_clock: false`. Its job code must be regular time;
its active user's `approved_to` date must cover the actual source day. A lock
flag is never evidence of approval. The source day must match the reviewed day,
and duration must reconcile to the interval. Manual time and leave codes remain
unimplemented; they are refused. Account identity remains a reviewed declaration.

Clover accepts a reviewed `elements` array of
[employee shift objects](https://docs.clover.com/dev/reference/employeecreateshift)
with `id`, `employee.id`, closed millisecond `inTime` and `outTime`, and integer
`cashTipsCollected` in merchant currency units. The capture must explicitly
declare `currency: USD`. An overridden interval requires its corresponding
`overrideInEmployee` or `overrideOutEmployee` attribution. Source employee
mapping and explicit tip settlement are mandatory; `serverBanking` does not
decide whether payroll owes the money. Clover shifts carry no manager-approval
field here; native exact human review remains required. Break policy, payment
tip allocation, service charges and authenticated merchant approval remain
unproved and cannot be inferred from this shift capture.

The existing intake journey imports five-day reviewed workweeks from these four
additional sources. It asserts 37.5 and 40 actual hours for two workers, $600
already held and $300 owed through payroll where tips exist, exact corrections,
unchanged frozen history, replay, refusal of unknown workers and unsafe source
states, local withdrawal and settlement-only changes. All ten named adapters
now have a bounded capture path; this does not complete every provider code,
jurisdiction, custody duty or the statutory tip-tax shortfall path.
