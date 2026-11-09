# Runtime shard repair report

Repository: just-every/run-envelope
Branch: cloud/sx-envelope-f104-shard-time-1
Candidate: fc8fa4f03b5f078b52e443751b12a3677102f01e
Original candidate: a0be89405b7b9dd0f1b6035f74b611fca8a1e81c
Merged main: ed99e6c214966b95a61b3b6f3696b3cc354dc331
Published merge save: 97207010ba85c1f10f03cc0dd30d23519b44b08a

## Finding

Baseline Verify 42606279615 attempt 2 cancelled runtime job 129160060814 after 736 seconds (12m16s). Its Run this shard step consumed 684 seconds before cancellation. Setup itself consumed approximately 49 seconds. Other shard jobs succeeded in 27–527 seconds. This is observed job-step timing, not a claim to have read per-test progress: log archive commands returned no data and the direct job log redirect was Forbidden; exact commands and sanitized transport error are in baseline-log-transport.txt. No further blocked blob-download retries were made.

The actual plan is verification.json, read by verificationPlan() in scripts/verify-app.mjs and the matrix entrypoint in scripts/verify-ci.mjs. The unshipped speed-tests-ci Appendix A was unavailable. The checked-in workflow remains unchanged, including its 12-minute timeout, Ubuntu version, toolchain pins, required aggregate and hosted-output path.

## Implementation

Move agent-docs and agent-decisions from runtime to verification, agent-capacity from runtime to new-hires, masked-resources from runtime to industry, and firm to claims. Move the former source and typecheck commands into verification. Remove those now-empty standalone source, typecheck and firm shards. Keep one disposable installation per original journey command: no journeys are combined into shared test state and no assertions or test code are changed by the CI repair commit.

Push shard count: 11 -> 8.
Effective non-build commands: 25 -> 25, with exact multiset equality.
Selected journey names: 36 -> 36, each exactly once.
Explicit Node test registrations: 7 -> 7 (separate inventory, not a claimed canonical whole-seed behavior count). No registrations added by this CI repair; the 200-test cap is unchanged.
Redundant per-worker build commands reduce as standalone workers are consolidated. Each browser shard still builds the emitted production Worker before its commands, and the one hosted shard retains all existing production-output checks.

The required integration merge preserves current main's Oregon WBF additions alongside the original candidate's Washington L&I additions. Conflicts were resolved by retaining both implementations, both preview parameters, both archive fixtures and refusal assertions, and both runtime selections. No migrations were added by either side. CONTRACT.md, docs/contract/ID-MAP.json, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to merged main. Contract regeneration and its check passed; generated views were restored from main. sources.lock.json was regenerated last for each commit and checked.

## Scope and custody

Clause status changes: none. No CLAIM, DEFAULT or GAP is submitted: this is a CI defect repair only. ENV-095 and every other clause retain main's existing judgment.

No publication scan ran, as the brief expressly excludes it; the fleet's landing process owns that scan. No PR is required by repository AGENTS.md, and no PR was created. Only the named product branch is used. All research, receipts and reports remain outside the product repository and will be explicitly selected for the report-only evidence ref.

## Validation status

The exact candidate's typecheck, emitted Worker build, plan coverage comparison, syntax checks on the merged harness files, reusable-workflow permission check, contract document check and source-lock check passed. The merged native Worker selection passed with exit 0: industry, calculation, NY DBL, extended retirement, Hawaii benefits, FUTA credit reduction, Oregon WBF and Washington L&I. The privacy recorder observed zero outbound requests; all 467 browser requests, 78 bundles and emitted logs passed its existing checks. The exact candidate was published through the push guard on its first attempt. The first REST discovery immediately after push returned no run yet. After the required interval, exact-head Verify 42631428360 was discovered in progress. The single watcher polls at least 300 seconds apart. Verify 42631428360 completed successfully on the exact pushed head fc8fa4f03b5f078b52e443751b12a3677102f01e. Workflow creation-to-last-update was 560 seconds (9m20s); all eight shards therefore completed below ten minutes. The final timing query confirmed runtime at 421 seconds (7m01s), the longest shard at 545 seconds (9m05s), mean 386.875 seconds, and longest/mean 1.4087. This meets the eight-shard, under-ten-minute and 1.5x-mean targets. This is product READY custody only; acceptance and landing remain the fleet gates' responsibility.

Hosted Verify: https://github.com/just-every/run-envelope/actions/runs/42631428360. No product blockers remain. The baseline log-download limitation is documented and does not prevent exact-SHA hosted verification. Individual timing receipts are in candidate-jobs.json and candidate-timings.json. Eight GitHub CLI invocations were used in total; no rerun was needed.

## Exact-head hosted shard results

| Shard | Wall time | Commands | Result |
| --- | --- | --- | --- |
| runtime | 7m01s | 6m21s | success |
| claims | 5m35s | 4m40s | success |
| verification | 5m04s | 4m22s | success |
| new-hires | 5m38s | 4m53s | success |
| archive | 9m05s | 8m20s | success |
| workspace | 3m28s | 2m52s | success |
| agent-door | 7m38s | 6m50s | success |
| industry | 8m06s | 7m19s | success |

Runtime before: cancelled at 12m16s. Runtime after: success at 7m01s, a 5m15s reduction relative to the cancellation boundary; actual original completion time was longer than the cancelled measurement. The final archive shard remains the longest at 9m05s, with 2m55s of headroom under the unchanged 12-minute job timeout. The entire Verify workflow completed in 9m20s.

All local checks and hosted Verify passed. The named product branch and exact head were independently confirmed by git ls-remote. The worktree is clean, and the local setup/test subreapers exited. Evidence is published separately from the product branch; the terminal EVIDENCE line identifies its ref and head. The fleet still owns publication scan, acceptance and landing.
