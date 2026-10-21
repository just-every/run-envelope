# Schedule proposals

Open `/app/envelope/workspace`, choose a company, then Pay schedules. The matching
API is `/api/envelope/companies/{company}/schedules` (GET history, POST revision).
The existing records/read, compensation, all-location and rate/proposal powers
are required. Nothing on this surface approves a run or offers a processing speed.

A proposal records `id`, prior `version`, `name`, `personId`, `frequency` (weekly,
biweekly, semimonthly or monthly), `timeZone`, local `periodStart`, `payDate`,
`holidayPolicy` (earlier, later, refuse), `workState` and `occupation`. Weekly and
biweekly periods contain 7/14 local dates, semimonthly anchors are 1/16, monthly
anchors are day 1. UTC boundary instants are derived from employer-local midnight;
a DST week can contain 167 or 169 elapsed hours. Federal Reserve holidays, not
federal-office Saturday observance, drive banking-day adjustment.

Only New York assigned-location frequency proposals are currently implemented.
Manual workers require weekly pay unless an official agency exception reference
is supplied for this exact worker and the entire period/payday. The fields are
`exceptionRef`, `exceptionPersonId`, `exceptionFrom`, `exceptionThrough`. A warning
flag cannot waive frequency law. Entered references still require actual agency
verification before use in payroll. Clerical monthly and unknown occupations
refuse. Other states and multiple work-state verification remain unimplemented.

GET returns `eligibility.status=not-connected`, no `availableSpeeds`, and null
funding deadline, approval cutoff and fees. An exact current authorized employer/run
provider connection is needed before standard/two-day/next-day/same-day options or
their Eastern/local cutoffs can be offered. Calendar dates are proposals only;
no stale or invented processing promise is displayed. New revisions preserve old
proposals. Actual exception verification, schedule approval/run binding, speed or
fee changes/revocation and reapproval are unfinished.
