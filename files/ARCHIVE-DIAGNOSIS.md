# Actual archive diagnosis and result

The WBF native journey and the existing calculation and rule-edition journeys
pass. The first full archive attempt without CI=true was refused by the CLI's
existing original-caller rule. The following CI=true attempt reached its
corrupted-person archive import and failed the existing assertion at
./tests/archive-runtime.mjs:266, "staged business relationships are checked beyond
transport checksums". The import itself refused, but the expected
archive_relationship_invalid code was absent from the captured output. The
original assertion did not include the actual CLI diagnostic.

No validation rule or assertion was weakened. The assertion now includes the
actual captured CLI output on failure. The full journey is being rerun with a
30-minute hard limit because it spans multiple screens and repeated public CLI
archive operations. Main at 2913789638d9f6da2cccb65ea318cc9b92f185e1 is being run in
a separate detached worktree on the same VM, with only the same diagnostic text
added and its source lock regenerated. Neither baseline change is a product
commit. Actual results and any cause established by comparison will be appended
before evidence publication.

The diagnostic rerun hit an independent local transport interruption during
initial fixture setup: POST to the native locations route returned 500 with
"Network connection lost" from Miniflare's ProxyWorker. This preceded the WBF
fixture and the relationship check. An overlapping local artifact rebuild was
still running; that rebuild is complete. The unchanged diagnostic command is
being run again with builds serialized. No product workaround or retry was added.

By 10:21 UTC, both main and the serialized candidate had advanced beyond the
original unrelated-person assertion and into subsequent foreign-funding and
correction probes. That original failure did not reproduce. No product archive
validation or existing assertion was changed to obtain this result. Its original
CLI diagnostic was not retained by the earlier assertion, so its cause remains
unestablished. The full runs are still pending.

The serialized candidate passed every earlier corrupted-import refusal but
failed the valid restore at ./tests/archive-runtime.mjs:301 (exit 1 versus 0);
that older assertion also omitted the CLI output. Main passed valid restore and
read-only adoption, then reached the 30-minute hard limit during later existing
archive checks without another assertion failure. All test processes exited.
The valid-restore assertion now includes its captured CLI diagnostic, and a
failed run retains its private generated fixture for direct one-command
reproduction. Success still deletes that fixture. No archive assertion or
validation was relaxed. The candidate is being run alone after rebuilding, with
no overlapping build or baseline command.

The isolated run passed actual CLI restore, exact ciphertext and WBF-history
checks, former-session WBF refusals and fresh read-only history adoption. It then
failed the pre-existing unrelated-consent error-code assertion at
./tests/archive-runtime.mjs:362. Import refused; its expected
archive_relationship_invalid code was absent. The fixture is now retained at a
private temporary path, and that one public CLI import is being reproduced
directly with its original input and environment. The required WBF restore
probe printed OR-WBF-ARCHIVE passed before this later failure.

Direct reproduction of the exact unrelated-consent input returned exit 4 with:
"The portability module refused or failed the archive operation
(archive_relationship_invalid)." Its expected refusal therefore reproduces
correctly. The CLI also reported cleaning up an unfinished earlier staged import.
No archive validation code changed. The remaining valid consent restore,
nonempty-target refusal and protected record-key recovery checks are being
completed directly against the retained fixture, without rebuilding it.

The retained fixture's valid consent-history restore then completed with exit 0,
using the actual public CLI and original encrypted archive. The remaining
assertions compare all three exact consent records, zero restored sessions and
grants, nonempty-target refusal, and refusal to replace an occupied record key
without changing any business or identity table. No business archive-code fix
was needed for the previously observed failures.

Final completion result: exit 0. ARCHIVE-COMPLETION.json records three exact
consent receipts, zero restored grants and sessions, nonempty refusal exit 4
with target_not_empty and unchanged business history, and occupied-key refusal
exit 1 with record_key_target_not_empty and unchanged key. The direct reproduction
and completion script made no product source edits. The final product test
retains all existing assertions, adds captured CLI diagnostics, and again deletes
its temporary fixture unconditionally. The full isolated archive command itself
remains recorded as exit 1, not as a successful whole-suite run.
