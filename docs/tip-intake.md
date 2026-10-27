# Mapped tip intake

This native intake prepares earnings records. It does not calculate tip taxes,
produce tax forms, establish legal tip-credit treatment or pay a worker.

Use the company's existing native session and compensation permissions. Entry
requires the existing rates proposal permission; history requires compensation
read access. The selected person must belong to the company and permitted
location. An agent credential cannot use these native routes.

For the selected company and person, use these paths beneath
`/api/envelope/companies/{companyId}/people/{personId}/allocations`:

- `GET tip-template` downloads `tip-intake.csv`.
- `POST tip-intake` previews or applies one selected source item.
- `GET tip-intake` reads retained tip versions and correction provenance.

Paths in this list are suffixes of the common path above. The CSV template's
columns are `sourceItem`, `day`, `amountCents`, `settlement`, `furnishedCents`
and `settlementEvidence`. Amounts are integer cents. Settlement is `cash` for
money already held, including card tips already handed to the worker, or
`paycheck` for money owed through payroll. Tender does not select settlement.
This door accepts declared tip inputs only; service-charge classification and
calculation remain unimplemented.

A preview request has this shape:

```json
{
  "format": "csv",
  "mode": "preview",
  "version": 0,
  "sourceRef": "synthetic-envelope-1",
  "row": 1,
  "csv": "Item,Day,Cents,Settlement,Funds,Evidence\r\nsynthetic-envelope-2,2026-03-02,60000,cash,0,synthetic-envelope-3\r\n",
  "mapping": {
    "sourceItem": "Item",
    "day": "Day",
    "amountCents": "Cents",
    "settlement": "Settlement",
    "furnishedCents": "Funds",
    "settlementEvidence": "Evidence"
  }
}
```

Every mapped column must exist exactly once, and each field maps to a distinct
column. Row numbers start at one after the header. Quoted commas, escaped quotes
and quoted newlines are parsed; malformed, oversized and ragged CSV is refused.
There are at most 500 data rows. This increment applies one selected item at a
time, atomically; it does not offer a batch-apply operation.

For manual entry, use `format: "manual"` and put the six canonical fields in
`values` instead of sending a CSV, mapping and row. There is no new grid screen
in this increment. XLS and XLSX are explicitly unsupported.

Keep `sourceRef` stable for the source collection and `sourceItem` stable for the
original item, including corrections and format changes. Their company-scoped
identity deliberately excludes the worker: assigning that same identity to a
different worker cannot create another tip. A changed source namespace denotes
a different source; this API does not recognize duplicate real-world receipts
under invented identities. Connected provider identities and duplicate payment
reconciliation remain unfinished.

The preview returns `create`, `change` or `unchanged`, the retained `before` and
proposed `after` values, selected row, mapping, file digest and `previewDigest`.
A blank preserves the existing field; zero replaces a numeric field with zero.
New items need every field and explicit settlement evidence. Missing settlement
is refused as ambiguous. Unsupported settlement labels are refused. Evidence
is a retained human input, not independently verified settlement or approval.
Only actual funds received belong in `furnishedCents`; no tax collection or
promised-contribution handling is implemented here.

Apply by resending the request with `mode: "apply"` and its exact
`previewDigest`. Corrections must use the current retained version. A stale
version or changed preview refuses. An unchanged apply writes no revision.
A correction retains the file digest, selected row, mapping, entering operator,
before values and settlement evidence in encrypted history. Raw tip entry cannot
revise these imported identities. Existing run source fences invalidate affected
approvals and preserve immutable earlier run versions. Re-preview and obtain
fresh exact human approval of the revised run.

The earnings preview separates tips already held from paycheck tips. The former
are excluded from new gross cash earnings; the latter are added once per retained
source item. Taxable tip reporting, minimum-wage top-ups, withholding, statutory
shortfall treatment, actual payday payment and year-end forms remain unimplemented.
The existing calculation hold remains, and release sends nothing. No tax, payment,
provider connection or filing receipt is manufactured by intake.

Evidence: `tests/payroll-approvals.mjs`, `approvalJourney` (RUN-APPROVALS), invoked
by the runtime push shard, exercises mapped intake, the downloaded template,
replay across formats, foreign-worker identity refusal, blanks and zero,
provenance, immutable runs and settlement-change approval invalidation. Selected
existing run-review screens are captured at 1440 and 390; this does not prove a
new grid or spreadsheet-upload screen.
