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
their own codes and supplied amounts, without creating worked hours; complete
official regular-rate premium calculation remains unimplemented.

## Current boundaries

This is native manual and spreadsheet preparation. It does not connect to
Lanyard, Toast or the other contracted time and POS providers, validate their
official schemas or establish source approval at a provider. Source names and
evidence references are reviewed declarations. Complete provider intake,
approved tip pools, minimum-wage top-ups, tax ordering and voluntary funds,
collection windows, statutory shortfall payday completion, filing schemas and
year-end forms remain owed. No supported statutory shortfall is claimed from
the current general gross-to-net hold. Reimbursement substantiation and complete
assessment calculations also remain unproved. Existing encrypted custody and
archive foundations do not establish the complete intake-specific retention,
erasure and restore matrix.
