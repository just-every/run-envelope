# Accounting preparation

The company’s Accounting settings page prepares a private balanced worksheet from a retained earnings draft. It does not connect a ledger, calculate payroll, reconcile settled funds or post an external journal. Native review approves preparation only. ENV-023 remains partial.

The configured native installation owner needs a current session and company grant. Non-owner users and agent credentials receive no accounting authority. Current review tokens are bound to the exact version, native session and grant; expired, foreign-session and stale-source review is refused. Broader payroll roles remain owed.

## Mapping and repair

Open Accounting settings from the company page. Save a mapping for Pantry, QuickBooks Online, Xero, NetSuite or Sage Intacct, its HTTPS workspace link and a responsible repair owner. Links contain no embedded credentials, query or fragment. Named hosted ledgers use their expected domain; a self-hosted Pantry workspace may use its owner’s HTTPS domain. Links open with no referrer. No request goes to that destination during preparation.

Map wage expense, reimbursement expense, employer tax expense, net funding, tax funding and deduction liability. An incomplete mapping is retained with its repair owner and exact missing accounts; it cannot prepare a worksheet. No unmapped-account fallback is used. Mapping versions are append-only. A new mapping version invalidates affected pending preparation. Disconnecting preparation and entering a closed-through date both refuse new preparation for the affected period.

## Proposed allocation

Select the retained earnings run and its exact version, posting date and mapping reference. Enter proposed employee and employer tax allocations in cents. Allocate known wages and reimbursements separately by department, class, location and job. The page supports two allocations; the API accepts up to 100. Each component total must equal the corresponding retained run amount.

For this bounded worksheet, proposed net equals known gross cash minus entered employee taxes and the run’s after-tax deductions. Debits equal known wage and reimbursement expense plus entered employer tax expense. Credits equal proposed net, entered employee and employer taxes, and retained deductions. These equalities are accounting checks on proposed values; they do not establish correct withholding, lawful deductions, benefit treatment, paid wages, bank funding or remittance.

Preview computes without saving. Prepare retains an encrypted immutable revision with the source run, mapping, person-version pins, actor and time. Exact review shows account lines, dimensions, source versions, proposed amounts and repair ownership. Current run sources and mapping authority are checked again before accepting preparation review.

A correction requires a previously reviewed preparation for the same run and mapping identity, plus a reason. It retains the original, reverses its lines and appends the proposed replacement as a balanced correction worksheet. The full replacement and the correction lines are retained separately. No correction has been posted externally.

Reviewed and pending preparations remain visible after restart, with their repair owner and supplied ledger workspace link. The post route refuses external execution even after valid native review: finalized payroll and an authorized ledger adapter are required. There is no generated provider receipt or claim of exactly-once external posting.

## Public doors

All routes are beneath `/api/envelope/companies/{companyId}/accounting`; the native page uses the corresponding `/app/envelope/companies/{companyId}/accounting` route. GET of the accounting root returns connections and retained journal preparations, labeled with posting unavailable.

- POST `./connections`: append a mapping using `id`, expected `version`, `name`, `ledger`, `ledgerUrl`, `repairOwner`, `enabled`, optional `closedThrough` and `accounts` keyed by component.
- POST `./preview`: calculate a worksheet without retaining it.
- POST `./prepare`: retain an exact worksheet. Both worksheet routes accept `connectionId`, `runId`, `runVersion`, `postingDate`, `proposedEmployeeTaxCents`, `proposedEmployerTaxCents` and `splits`. Each split contains `amountCents`, `component` (wages or reimbursements), `department`, `class`, `location` and `job`. Preparation also takes `id`, expected `version` and optional `correctionOf` with `correctionReason`.
- GET `./journals/{id}/review`: current exact preparation review.
- POST `./journals/{id}/approve`: accept preparation using `version` and `reviewToken`.
- POST `./journals/{id}/post`: explicit refusal until finalized payroll and authorized adapters exist; no external effect or acceptance record is made.

The native forms supply the same fields through ordinary labeled account and dimension controls. Inputs and decisions use the existing private workspace store, encryption and attributed audit. Complete accounting-specific legal retention, held restrictions, eligible erasure, stale replay and inactive archive recovery still require their own populated transport proof. Existing cross-cutting clauses are not completed by the worksheet journey.

## Policy default and remaining work

Adopted conservative default pending CT approval: accounting preparation is restricted to the configured native installation owner with a current session and company grant. Mappings, proposed allocations and exact-version preparation reviews remain private and audited. Worksheet review conveys no payroll approval or external posting authority. No automated outbound ledger request, credential collection or provider acceptance is enabled. Broader scoped accounting roles, finalized payroll reconciliation and authorized ledger posting remain owed. This default changes no acceptance sentence.

All original ENV-023 outcomes remain owed: each ledger’s official request and response schema edge, exact finalized net and tax funding reconciliation, complete wages, benefits, liabilities and clearing mappings, provider-specific dimension identifiers, reviewed accepted corrections, closed-period and disconnect handling at the provider, and restart reconciliation of one external entry per approved version with its actual entry link. A configured workspace link is not an external entry receipt. No provider account or secret is needed or collected for this native preparation increment.
