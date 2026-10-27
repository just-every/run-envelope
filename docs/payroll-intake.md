# Native run earnings intake

Hours and earnings can be prepared without a connected timekeeping provider from
Pay settings. Download the published CSV, XLS or XLSX template, use a single
worksheet, and upload it for exact source review. Preparation retains an encrypted
version and its changes; it does not change an existing frozen run or authorize
payment. Approve the exact source version, then retain a new earnings run with
the same run ID and period. Any later input revision invalidates the earlier run.

The manual-entry section prepares up to three rows at a time using the same
validation and exact source review. Unused rows have a blank row ID.

The worksheet reader reads every row. It refuses the entire upload beyond 10,000
data rows, beyond 101 columns, for multiple worksheets or for formulas. Export
formula results as values first. Multipart uploads are limited to 2 MiB including
the form. Refusal never publishes a partial set of earnings. Empty worksheet rows
are skipped while the original worksheet row numbers remain in the differences.

## Template fields

| Field | Meaning |
| --- | --- |
| rowId | Stable source row identity; keep it on corrections. |
| personId | Current worker ID in the reviewed pay group. Names are not an identity join. |
| day | Actual work or earning date as ISO text, within the run period. |
| code | hours, tip, bonus, reimbursement, meal-premium, rest-premium or assessment. |
| minutes | Actual worked minutes, only for an hours row. |
| amountCents | Integer cents, including an explicit zero to clear a prior value. |
| settlement | Required for tips: cash means already held, including paid-out card tips; paycheck means still owed. |
| state | Two-letter state. Required for hours and assessment rows. |
| riskClass | WA risk class, retained without turning assessment hours into wages. |
| coveredMinutes | Actual assessment minutes, retained separately from worked minutes. |
| sourceRef | Stable source item reference; keep it on corrections. |

A blank cell preserves the previous value. Zero replaces it with zero. Rows absent
from a correction remain retained. Use an explicit zero to remove their amount.
A changed worker, earning code or source reference requires a new source identity
rather than silently retargeting an old row. Duplicate row or source identities,
unknown workers, dates outside the run and ambiguous tips refuse the preparation.
A source item already assigned to another native intake run cannot be assigned
again. Identical repeated data returns the existing intake version.

A custom header can be mapped explicitly using the optional column-mapping object,
for example `{"personId":"Employee ID","amountCents":"Amount in cents"}`. A field
not mapped uses its published header. Native JSON entry uses the same field names
and validation. It does not require an external provider.

## Public doors

All these routes are relative to the current company's pay-settings route under
`/api/envelope/companies/{companyId}/pay-settings`:

- `GET /earnings-template/{csv|xls|xlsx}` downloads a template.
- `POST /intake-preview` validates and returns the complete proposed rows and differences without writing them.
- `POST /intake` prepares the version for source review. Send multipart fields
  `id`, `version`, `groupId`, `periodStart`, `periodEnd`, optional `mapping` and
  `file`; or JSON with `rows` instead of the file.
- `GET /review/run-input/{id}` provides the current session-bound exact source review.
- `POST /run-input/{id}/approve` approves that version using its review token.
- `POST /run-input/{id}/withdraw` withdraws source approval.
- `POST /earnings-run` retains a frozen run with the same `id` and period.

The existing company, compensation and native source-review permissions apply.
Each retained version records its editor, time, raw-file SHA-256 digest, original
file name, row identities and before-and-after values. Source decisions record
the reviewer separately. Preparing data cannot supply its own approval token.
Concurrent source assignment is fenced inside the write. Payment release remains
unavailable without complete payroll calculation and an authorized payment rail.

## Current calculation boundary

Approved hours contribute regular hourly earnings at the reviewed effective rate.
An explicitly reviewed first-workweek date defines seven-day workweeks. With
complete native hourly inputs and a reviewed hours-worked bonus allocation, the
federal preview adds each week's extra half-time using rational arithmetic under
29 CFR 778.109 and 778.209. It never averages a two-week total. Partial workweeks
and mixed native work require reconciliation. Stricter work-state rules remain
unresolved. References: [regular rate](https://www.ecfr.gov/current/title-29/section-778.109)
and [bonus allocation](https://www.ecfr.gov/current/title-29/section-778.209).
Bonus amounts and paycheck tips contribute cash earnings; already-held tips do not
create another payout. Both tip settlement types remain in the reported-tip basis.
That basis is not a computed tax, a filed form or a payment receipt. Native tip
entry also refuses a repeated source reference under a different local ID.

Assessment allocations retain exact state, risk class and covered minutes without
adding worked time. Premiums stay separate and require the missing regular-rate
calculation; reimbursement tax exclusion requires substantiation. Exact run review
shows retained state rule details and every intake source row.

Still unimplemented: unrestricted bulk grid editing, named provider adapters and their
approved-source lifecycles, complete work-state overtime and regular-rate coverage,
meal and rest premium calculations, assumed-hours assessment elections, complete
tip-credit and minimum-wage treatment, tax collection ordering and shortfalls,
voluntary-funds collection windows, stubs, registers, year-end and allocation forms,
and authorized payday completion. No native upload establishes external provider
approval, legal filing effect or receipt of funds. Complete intake-specific
retention, erasure and recovery proof also remains owed.
