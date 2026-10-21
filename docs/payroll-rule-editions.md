# Rule editions and deadline duties

Payroll preparation → Rule editions and deadlines opens the native private door.
API: `/api/envelope/companies/{company}/rules`. Existing all-location compensation
read/propose/approve grants apply; native human sessions are required. GET lists
source history, candidate impacts and explicit duties. `?asOf=...Z` inspects an
edition boundary; it never changes the authority clock or sends anything.

POST an immutable proposal with `id`, prior `version`, `name`, `family`, `state`,
optional `locality`, inclusive `effectiveFrom`/`effectiveThrough`, `publishedDate`,
`sourceUrl`, `sourceTitle`, `sourceRef`, `edition`, `taxYear`, `determination`
(provisional/final), decimal `value`, `unit`, `ownerId`, distinct `backupId`,
`approvalDue` and `wageDeadline` (explicit UTC instants). Both duty identities must
be current active company approvers. Currently implemented source admission
requires an HTTPS government `.gov` URL with no embedded credentials or fragment;
other official domains await reviewed inventory support. A URL is a recorded
source reference, not independent verification of its contents.

GET `/review/{id}` then POST `/{id}/approve` with exact version and session-bound
`reviewToken`; POST `/{id}/withdraw` with exact version to withdraw it. No client
flag can supply human authority. A forecast remains provisional after review.
An overdue proposed mutation remains held with its original internal deadline,
accountable person and backup duty. A late approval never erases that missed
deadline. The duty to obtain a lawful named-human-approved original/replacement
payment by payday is separate and stays visible; no payment receipt is invented.

Specialized `details`:

- `wa-li`: `riskClass`, `totalRate`, `employeeRate`, `hoursMethod` (actual/wa-160-month).
- `or-wbf`: `totalRate`, `employeeRate`, `hoursMethod` (actual/assumed), `rounding`
  (nearest-cent-per-report).
- `hi-plan-share`: `planRef`, `weeklyCapCents`, `employeePercentCap`.
- `futa`: `reduction`, `bcr`, `addOn`, optional `waiverRef`; a final determination
  additionally requires `finalNoticeRef`.

These source fields are not the complete hour/share/reporting calculations. Retained earnings snapshots include the relevant recorded rule IDs/versions; changing an intersecting edition requires a new earnings preview while a nonintersecting prior-year snapshot stays current. This is not approval or dispatch invalidation for a payable run.
GET excludes provisional FUTA from active final editions and names each recorded
year missing an approved final notice. It never borrows last year's final rate.
Historical effective source editions remain inspectable after a new-year change.

Impacts currently use assigned work locations and period intersections to identify
candidate people and retained earnings drafts. Multi-state/history/locality and
actual calculated liability differences are explicitly incomplete. Pending pay
approvals, selective transactional invalidation, complete federal/51-state/local
coverage, duty delivery/support calendars, lawful replacement payroll, funded
worker receipt and true historical payroll replay remain unimplemented. ENV-027
is partial. ENV-006/034/046/066 inherit the calculation, approval, service and
coverage obligations; this input registry does not discharge them.
