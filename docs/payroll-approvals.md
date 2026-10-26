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
the size of each payee's work and tip collections and of the approval-policy
collection, so an added work entry, an added tip or any policy change is material.

POST `/people/{person}/allocations/tip` records one tip: `id`, prior `version`,
`day`, `amountCents`, `settlement` (`cash`, already received by the worker, or
`paycheck`, paid through payroll) and `furnishedCents`, money the worker actually
gave the employer toward tax on tips (never more than the tip). Paycheck tips add
to the known debit; cash tips do not. A run binds every tip version, so changing
one tip's settlement type or furnished funds voids approval of the old version.
Tax on tips and any uncollected tax are not calculated (ENV-009).

## Two-person threshold

POST `/approval-policy` with `id`, prior `version`, `name` and
`secondApprovalAtCents`. Only the owner may propose, review
(`GET /review/approval-policy/{id}`) or approve and withdraw it. A run whose known
debit reaches the threshold needs two different people. With no current policy,
one person approves each run. Several current policies apply the lowest threshold.

## Approve

GET `/earnings-run/{id}/review` returns the latest version with a one-use review
token bound to this session, operator and grant version for ten minutes. POST
`/earnings-run/{id}/approve` with `version`, `reviewToken` and the distinct human proof described below records one approval
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

## Distinct human verification

The existing exact review now requires a separate explicit approval gesture and
fresh action proof. Its `humanProof` contains a five-minute challenge bound to
the current origin, session, operator version, company, grant, review token,
run version and content digest. POST approval additionally supplies
`gesture: "approve-exact-run"`, `humanChallenge` and `assertion`. Model text,
ordinary confirmation, a human flag and a session cookie alone cannot approve.
The same checks repeat inside the atomic approval write; successful proof is
consumed there. Earlier review-only decisions remain historical and do not count;
retain a new run version before obtaining fresh approval.

The native review uses WebAuthn with required user verification and presence.
The person presses **Approve this exact run version** and completes their
passkey verification. Registration uses POST `/passkeys/options` and
`/passkeys/register` under pay settings, requires current approval permission
and fresh Base email proof, and records an audit event. Registration verifies
the browser origin and relying-party identifier; it does not itself approve.
Authenticator public keys are pinned to the operator version. Individual key
management and recovery remain open; changing the operator version invalidates
its old keys. No authenticator secret is held by Envelope.

An API caller may instead submit `assertion: {idToken}` from the currently
linked Auth issuer. Verification uses the pinned signing keys and algorithms,
exact issuer and audience, the challenge as OIDC `nonce`, current token times,
a fresh `auth_time` and an `amr` containing `mfa`. Its subject must already map to
the authenticated human; a matching email alone cannot bind a new identity.
Provider disable, unlink or changed pin refuses. The approval transaction repeats
the identity and link checks. Browser acquisition of this provider proof remains
open; the native browser path uses a passkey. The committed journey supplies
signed OIDC Core ID-token schema fixtures at this boundary, not live receipts.

MCP `run.review` accepts `{companyId, runId}` with current `drafts:read`,
compensation access and all locations. It returns an exact-version reference
link, never an approval token or a human session. Opening it still requires a
separate human sign-in and current approval grant. The reference binds the
presenting credential and its version; rotation, revocation, expiry, sponsor
changes or a changed run invalidate it. Approval records `presentingClient`
separately from `approverId`, with `proofMethod` set to `passkey-uv` or
`oidc-mfa`. The native client is recorded as `native-envelope`. Presenting a
review never grants the preparer approval or release powers.

Passkeys, challenges and presentation links are installation-local and excluded
from archives. Retained run approvals preserve their proof method and attribution,
but their execution eligibility is cleared on export and import, including when
a later grant happens to reuse the old version number. Run-linked challenge and presentation rows participate in the
existing foreign-key custody graph. This does not prove all archive, erasure or
future transport cases. Genuine bonus preparation, complete calculation, payable
release, bank verification and rail cancellation remain outside this proof.
