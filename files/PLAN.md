# CI runtime repair plan

Repository: just-every/run-envelope
Tag: sx-envelope-f104-shard-time-1
Product branch: cloud/sx-envelope-f104-shard-time-1
Starting candidate: a0be89405b7b9dd0f1b6035f74b611fca8a1e81c

1. Install fleet Git identity, decrypted-bundle authentication, coauthor cleanup hooks, push guard and checkout toolchain. Clone full history, start at the required candidate and merge current main. Preserve main's CONTRACT.md and ID-MAP.json whole, all tests and both Washington and Oregon integrations. Regenerate contract views for verification only, restore main's generated views, and regenerate source lock last.
2. Read verification.json and scripts/verify-ci.mjs, the actual plan consumed by Verify. Inspect completed baseline 42606279615 attempt 2 job metadata and attempt logs once. Report inaccessible logs honestly without repeated blocked downloads.
3. Balance isolated journeys across existing workers and consolidate lightweight workers to keep at most eight push shards. Keep each selected journey exactly once, keep hosted verification, retain all test code/assertions, and leave timeout-minutes unchanged. Avoid unrelated product changes except the required integration merge.
4. Run the touched command selections against the emitted native Worker, plus typecheck and source-lock check. Check journey coverage programmatically against the merged baseline. Count tests without introducing registrations. Use the system Chromium for local browser tests and close only owned processes.
5. Commit with fleet identity and hooks, inspect all candidate authors, committers and trailers, and push through cloud-push.py. After a save push merge any new main; never rebase published work. Preserve every substantive commit remotely.
6. Discover and poll exact-head Verify through REST with one watcher, at most one status query per 300 seconds per run and ten GitHub CLI invocations total. Hosted shard durations are the timing proof. Fix real failures if possible within scope; no empty CI-trigger commits, timeout increases, assertion removal or publication scan.
7. Write actual nonsecret report and receipts in this packet, publish explicitly selected regular files only to evidence/sx-envelope-f104-shard-time-1, and return exact product SHA, run IDs, counts and lane POST. Evidence transport never conveys product acceptance or READY by itself.

No clause work or status changes. The referenced external speed-tests-ci PLAN Appendix A was not shipped, so the checked-in plan and workflow are the applicable available shape.
