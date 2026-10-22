# Run approvals

Run approval uses the native session doors under
`/app/envelope/companies/{company}/pay-settings` and the matching
`/api/envelope/companies/{company}/pay-settings` API. Approving needs the owner
role or a grant holding `pay:approve`; releasing needs the owner role or
`pay:release`; both need the compensation field and every location. Agent
credentials never reach these doors (`human_session_required`), and no MCP tool
can approve or release a run (`agent_tool_denied`).

## What a run version binds

POST `/earnings-run` retains an immutable earnings-run version (see
[payroll-pay-items.md](payroll-pay-items.md)). Each version binds the period, pay
date and frequency, every payee and person version, earnings, reimbursements,
after-tax deductions, the approved setup it used, the period's rule editions, the
known debit and `destinations`: each payee's bank-record version (0 when no
account is on file). Bank details never enter the run. The version also pins
the size of each payee's work collection and of the approval-policy collection,
so an added work entry or any policy change is material.

## Two-person threshold

POST `/approval-policy` with `id`, prior `version`, `name` and
`secondApprovalAtCents`. Only the owner may propose, review
(`GET /review/approval-policy/{id}`) or approve and withdraw it. A run whose known
debit reaches the threshold needs two different people. With no current policy,
one person approves each run. Several current policies apply the lowest threshold.

## Approve

GET `/earnings-run/{id}/review` returns the latest version with a one-use review
token bound to this session, operator and grant version for ten minutes. POST
`/earnings-run/{id}/approve` with `version` and `reviewToken` records one approval
row: approver, role, grant version, session, time, content digest and known debit,
plus one `run.approved` audit event. The write repeats every binding: latest
version, pinned sources and collections, bank-record versions and the review.
The same person can never approve the same version twice
(`second_approver_must_differ`), and another person's review token is refused
(`review_stale`).

## Release

POST `/earnings-run/{id}/release` with `version` checks, in order:

| Refusal | Cause |
| --- | --- |
| `proration_preview_not_payable` | Salary proration preview (ENV-033 interim hold) |
| `run_version_superseded` | A later version exists, for example a changed pay date |
| `run_sources_changed` | Setup, rate, work entry or person changed or was withdrawn |
| `run_rules_changed` | A rule edition for the run's states and period changed |
| `run_destination_changed` | A payee's bank record changed |
| `approval_authority_changed` | An approver's grant changed or was revoked |
| `approval_required` / `second_approval_required` | Too few current approvals |
| `run_not_payable` | Every binding holds, but nothing is payable yet |

A version that passes every binding is still refused: ENV-006 tax obligations,
net pay and provider fees and an owner-authorized ENV-011/035/065 payment rail
do not exist. Release therefore records nothing and contacts no provider. A
restored version with identical content needs fresh approval. Approval is a human
decision on an exact version, never payment authority. Rail delivery,
cancellation before the rail's deadline and race reconciliation remain ENV-034
and ENV-035 work.
