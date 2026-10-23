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

This is a recovery foundation, not a completed operational restore. Fresh owner
adoption, provider reconciliation using original accepted identifiers, renewed
exact authority, erasure fences, rule editions beyond the implemented catalog, and a complete
mixed-year history containing settled corrections and uncertain payments remain owed by
ENV-053. Restored company records currently have no active access grants. Do not
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
filings, open unknown payments or completed operational recovery.
