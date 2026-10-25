# Local archive custody

The native `rer export` and `rer import` commands now preserve the populated
payroll database with versioned manifests and digests. Import authenticates every
encrypted record, validates declared relationships and checks retained claim
originals before publishing data into an empty installation. The archive retains
historical approvals as evidence. It excludes active company grants, sessions,
credentials, review tokens, provider secrets and dependency connections. Retained
agent and notice authority is expired; agent capability scopes are cleared.

The original record encryption key is required separately. The archive never
contains it. Use an existing directory outside the checkout owned by the current
user with permissions `0700`. Keep that directory and its backup away from public
files and shared storage. From the source checkout:

```sh
node ./scripts/portability/record-key.mjs backup --output /private/owner-recovery/envelope-record-key.txt --yes
pnpm exec rer export --output exports/payroll.rer
```

The key command creates a new owner-only file with permissions `0600`. It refuses
an existing destination and never prints the key. On an empty target checkout,
recover the original key before importing the archive:

```sh
node ./scripts/portability/record-key.mjs recover --input /private/owner-recovery/envelope-record-key.txt --yes
pnpm exec rer import --input /private/owner-recovery/payroll.rer --yes
```

Recovery uses the native checkout operation lock and private settings writer.
It refuses populated business data, symbolic links, shared files, invalid keys
and non-private custody paths. Import reads the saved private setting used by the
application; an ambient environment value cannot substitute another key. A wrong
key, damaged archive or nonempty destination refuses before business history is
published. A missing original key cannot be reconstructed from the archive.

This is a recovery foundation, not a completed operational restore. Provider
reconciliation using original accepted identifiers, operational adoption and renewed
exact authority, complete lawful erasure under ENV-054, and a complete
mixed-year history containing uncertain payments remain owed by
ENV-053. Imported company records have no active grants until explicit restricted
historical adoption. Do not
reintroduce old credentials or use database edits to bypass those missing doors.

`tests/archive-runtime.mjs` contains `archiveJourney`: native business fixtures,
real terminal backup and restore, private key recovery, original ciphertext and
approval-history comparison, rejection without publication, and prior-session
replay against the restored Worker. The source includes a working scoped agent, an enabled provider and a human-approved notice reply created through native email proof; restored bearer replay cannot dispatch it. `tests/archive-key-custody.mjs` exercises the
key commands with generated keys confined to the disposable test installation.

Native export now includes the exact migration SQL and implemented Envelope
source bytes in a checksummed source-edition payload. Import validates every
record and retains that payload as an inert private JSON document under
`.rer/archive-editions/`, named by its SHA-256 digest. It never extracts or runs
historical code, replaces the current checkout, or downloads a cited rule URL.
The encrypted business rows retain reviewed rule metadata and source links.
A missing current checkout rule file does not prevent custody of the historical
bytes. A damaged source record refuses before business publication.

Archives made before the source payload was introduced must be re-exported from
the original installation; import explicitly refuses a missing payload inventory.
Retained public source bytes cover the implemented catalog, not an unlicensed or
unimplemented tax catalog. The source document is retained before the final
database transaction; a later database commit failure may leave that verified
evidence document, while business publication remains atomic.

The archive journey creates twelve monthly prepared federal calculations for each
of two employers, their exact human decisions and linked W-4 corrections, plus a
third company with retained claim originals. All business records use native HTTP
doors. This annual prepared history does not establish wage settlement, accepted
filings, open unknown payments or completed operational recovery. The native notice
fixture additionally retains one acknowledged dispatch and one unknown dispatch
whose provider response is unavailable. Their original execution IDs and the
accepted acknowledgement survive custody; replay sends neither again. This
network-edge proof covers notices, with no claim of an unknown payment, provider
lookup or completed operational reconciliation.

After import, the original company creator or the configured current native owner
can sign in through fresh native email proof and finish setup. GET
`/api/envelope/recovery` lists only eligible, unadopted companies and declares the
readable history, paused operations and absence of provider lookup. POST that
route with the selected `companyId`, exact `companyName`, literal JSON
`consent: true` and `readableHistory: ["compensation", "tax"]`. A generic consent,
a different company name, missing fields or extra history fields refuses without a grant
or consent receipt. Current identity, eligibility, company name and fresh proof
are repeated inside the atomic grant write.

Adoption records `archive.history.adopted` and an immutable receipt naming the
company, native actor, compensation and tax history, exact read actions and UTC
time through its linked audit event. It stores no duplicate actor identity, so
lawful audit anonymization also removes that attribution from receipt reads. GET `/api/envelope/recovery/consents` returns the caller's own receipts only
while a current grant permits audit reads. Held company receipts stay hidden.
Imported receipts are historical evidence and cannot recreate a grant. GET
`/api/envelope/recovery/<companyId>/tax-history` returns the adopted company's
retained prepared-return totals, check references and correction lineage after
current native authority checks. It omits the employer EIN and form payloads;
the full return and download doors still require independent export permission.

The adopted grant is a viewer with compensation and tax history reads. It cannot
export independently, change records or banks, connect providers, approve or
release payroll, or dispatch notices. Each employer needs separate explicit
consent. The original creator retains only this bounded adoption eligibility;
an unrelated native identity gains no recovery access. A current native owner
must match the installation's configured owner identity. These ct-approved
23 October defaults keep history inactive, mutations paused and provider lookup
subject to separate consent. No operational recovery or provider lookup is
implemented by this door.

The importer also validates references inside encrypted federal calculations and
prepared returns: company, worker, exact source versions, historical approval,
original correction lineage and period must match retained records. Current
source withdrawal does not erase valid historical attribution. A transport-valid,
authenticated correction pointing to a missing original refuses before business
publication.

The native privacy door now supports explicit record-specific retention review,
UTC earliest-release gates and fresh-proof-confirmed release before a separate
worker erasure request. The demonstrated cascade removes private documentary
records and a work allocation with its source pin, invalidates export snapshots,
anonymizes action targets and retains Base's erasure journal. Unknown retention
stays statutory and unreleasable. A timer never releases or deletes records.
See [worker privacy](./payroll-privacy.md) for the exact API and remaining ENV-054
custody and state-coverage gaps. The conservative defaults were approved by ct
on 23 October; the remaining engineering is not an approval hold.

Keep the latest trusted erasure journal with recovery custody. For an older
archive, place a private copy of the later archive inside the target checkout and
supply its relative path with `rer import --journal exports/later-journal.rer`.
The native CLI requires that journal to be an owned private file inside the
checkout. A fresh empty installation cannot infer erasures that happened after
an old archive unless the owner supplies that later trusted journal. The journey
proves that the actual older archive then refuses without restoring the erased
worker or publishing any business rows.
