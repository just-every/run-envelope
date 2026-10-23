# Payroll archives and owner privacy requests

## Native backup and inactive restore

Use the public native commands from the installation checkout:

```
rer export --output exports/payroll.rer
rer import --input exports/payroll.rer --yes
```

Import requires an empty installation. The versioned Base archive authenticates
its manifest, rows, content digests and relationships before atomic publication.
Supported payroll tables are discovered automatically, including encrypted
company/person/setup inputs, rules and editions, run versions and source pins,
historical decisions and approvals, agent attribution/access history, notices,
all original file versions, correspondence intents/receipts, case history,
privacy receipts and erasure fences. Adding a product table does not silently
omit it. Unknown/rejected/accepted effect states and original provider IDs remain
business evidence; acceptance is never relabeled as delivery.

Installation-local sessions, authentication tokens/challenges, OAuth/provider
links and signing keys, company grants, agent grants/secrets/policies and notice
provider credentials do not transfer. Agent attribution has a separate immutable
history table so past preparation/access can survive without a live grant.
Historical approval content and attribution remain evidence. Notice approvals
are expired and revoked in both exported and imported snapshots.

Every restored company has `restored=1`. Native mutations and agent execution
are fenced; no schedule, payment, filing or notice action is automatically
reactivated. Open **Restored archive custody** (or `/app/envelope/restored`) after a fresh
native sign-in. The original company owner can explicitly adopt historical read
custody with fresh sensitive-action proof and consent; source sessions and grants
are never reused. `POST /api/envelope/restored/:company/adopt {confirm:true}`
records this new read custody and keeps `restored=1`. Private originals and
accepted/unknown original references can then be inspected without any outbound
request. All mutations remain refused. No unpause door exists yet. Provider
reconnection, accepted-original-ID reconciliation and renewed exact approval
must be implemented before restored companies can resume operations. Do not
remove the flag manually or treat re-entering a key as reconciliation. These
restore activation obligations are incomplete.

Private ciphertext needs the original independent `ENVELOPE_RECORD_KEY`, which
is named in required configuration but never included in an archive. Retain it
securely outside the backup. Losing it makes private records unrecoverable; an
archive is not a key recovery mechanism. Restored operator identities recover
through native sign-in, never copied sessions.

## Explicit local erasure and retention

Open **Company records → Privacy and retention** as the company owner. The
same native ten-minute sensitive-action proof is required for a privacy action.
There is no automatic product-data deletion, scheduled hold expiry or implicit
external deletion request.

Under `/api/envelope/companies/:company/privacy`:

- `GET` shows the latest 100 requests and each held request's current retained
  field/reference inventory.
- `POST {personId,confirm:true}` requests eligible local erasure. A person with
  no payroll-history references or active legal hold is deleted with private
  SSN/bank/tax records in one transaction. Subject-targeted audit/access records
  become anonymous, an opaque anti-resurrection fence and Base erasure journal
  commit with the cascade, and staged transfer copies are invalidated. A replay
  returns the existing completion receipt.
- `POST /holds {personId,basis,custodian,releaseDate,confirm:true}` records an
  actual statutory/legal hold before a request. Its review/release date never
  starts deletion automatically. A held request shows the exact retained fields,
  legal basis, custodian and review/release date; it is never called complete.
- `POST /release {personId,evidence,confirm:true}` records the owner's verified
  lawful release and explicitly requests the eligible cascade. Anonymous
  immutable hold/release provenance survives the deletion.

While held, ordinary person reads, private downloads, register exports and agent
record/preparation doors cannot reveal the held worker. The owner remains the
records custodian. This is a conservative default pending policy review, not a
new exception to future payroll duties. Shared payroll reports and future
custodian-purpose controls still require integrated coverage.

Existing rate/run/source history is held for category-specific retention review,
with its exact references named. Its lawful shared-record anonymization/release
cascade is not implemented. Workers associated with that history cannot be
claimed erased. Notice files are not yet linked to workers; file/search/cache/
export/AI-derivative worker attribution and external provider deletion-request
tracking remain incomplete. Local completion does not recall downloaded copies
or already-filed agency records.

For recovery with a trusted later erasure journal, retain a later archive from
the same installation and use:

```
rer import --input exports/older.rer --journal exports/after-erasure.rer --yes
```

The native journal refuses an older archive containing erased rows or predating
an anonymization checkpoint. An older backup without its later trusted journal
cannot know about a future erasure. Future source adapters must also fence the
same erased identity before creating any new native record; opaque-ID database
fences alone do not prove a complete HRIS source-replay journey.
