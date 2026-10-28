# Native 401(k) contribution preparation

This increment prepares held proposals for reviewed traditional and designated Roth 401(k) elections. It moves no money and records no collected contribution, recordkeeper acceptance, coverage determination or corrected settled payroll.

The current door requires the configured native installation owner and current company authority. This conservative interim default does not establish delegated staff or agent preparation. Every private read is audited; versions use the existing encrypted workspace, worker custody inventory and lawful erasure fences.

## Public doors

Use the company person's retirement endpoint under `./src/envelope/http.ts`:

- GET `/api/envelope/companies/{companyId}/people/{personId}/retirement` reads retained elections and proposals.
- POST to that endpoint records `{version, election}`. Version is the current revision, initially zero. One person has one versioned election register; all earlier versions remain retained evidence.
- GET the `review` child reads the exact pending election with a session-bound review token.
- POST the `approve` child with `{version, reviewToken}` approves that exact revision. `{withdraw:true, version}` withdraws it.
- POST the `preview` child with `{version, electionVersion, sourceRef, payroll}` prepares a retained contribution proposal. Payroll has the same dated input shape as the company calculation-preview door. Repeating a capture with the same person and source reference refuses without another version. A correction supplies the current proposal version and a `correctionReason`, including when a captured date changes. The replacement reports employee and employer-match differences and retains the original version.

The election requires its tax year, inclusive effective dates, birth date, explicit eligibility, plan support for Roth and catch-up, prior-year sponsor FICA wages, fixed per-period traditional and Roth elected cents, one match tier, prior accumulators and references for the plan, election and eligibility evidence. The prior register includes traditional and Roth deferrals here, other-plan deferrals, already used catch-up, this plan's annual additions including employer contributions and forfeitures, this plan's compensation, the last included date and its source reference. An explicit zero is required when no amount exists. The prior register must precede the proposed period. A proposal never updates it as though contributions had been collected.

Plan support is bounded to fixed per-period elections and one per-period match tier: a match rate applied to elective contributions up to an elected percentage of eligible compensation, optionally including catch-up. Annual true-ups, multiple tiers, nondiscrimination results, special pay, automatic enrollment and unreviewed plan terms are not inferred. Traditional requests use regular room first, followed by Roth requests; catch-up then uses only the elected and permitted character. An over-limit amount remains unallocated and held. High earners' traditional requests are never silently converted to Roth.

The proposal carries its source edition, election revision, reviewer attribution, unchanged original history and separate proposed federal income-tax and FICA wage bases. Traditional deferrals reduce the proposed federal income-tax base; Roth deferrals do not, and neither reduces FICA wages. The accompanying ordinary payroll estimate has not applied these deductions and retains all jurisdiction holds. No complete net pay or new payable authority is returned.

A material election, prior register, evidence or worker correction invalidates affected pending proposals. A new exact review and an explicitly versioned replacement proposal are required. Withdrawal and inactive reviewer authority also prevent fresh preparation. Neither correcting a proposal nor retaining an approval authorizes a refund, collection or provider retry.

## Retained official sources

The 2025 edition uses [IRS Notice 2024-80](https://www.irs.gov/pub/irs-drop/n-24-80.pdf); the 2026 edition uses [IRS Notice 2025-67](https://www.irs.gov/pub/irs-drop/n-25-67.pdf). The calculation also cites [IRS Publication 560](https://www.irs.gov/publications/p560) and the [IRS catch-up explanation](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-catch-up-contributions). Editions remain separate across restart.

Combined traditional and Roth elective deferrals include the explicit other-plan amount. Catch-up eligibility uses age at calendar year end and reviewed plan permission. The enhanced age range is 60 through 63; 2026 sponsor wages above the prior-year threshold require elected Roth catch-up. Employer match uses the remaining annual compensation cap and annual additions room; catch-up is excluded from annual additions. Where available catch-up permits it, regular deferrals are reclassified without changing elected amounts or tax character so that the permitted match also fits. A tier that excludes catch-up is recalculated on the remaining regular deferrals. Exhausted or unavailable catch-up never creates extra room. Existing excesses require correction, rather than treating a negative remaining balance as permission.

## Remaining ENV-019 work

Section 125, HSA and FSA, SIMPLE IRA, complete eligibility and effective-plan coverage, corrected settled payroll, census synchronization, accepted contribution files and funds for Guideline, Human Interest, Vestwell, Betterment at Work and Ubiquity, and mandated auto-IRA registration, exemption, contribution and California opt-out outcomes remain owed. No owner-authorized payment rail, employer tenant or provider access is established here. Official-schema provider reconciliation and broader native preparation remain implementation work; absent access does not prove them. ENV-091 through ENV-094 keep their separate contracted arrangements.
