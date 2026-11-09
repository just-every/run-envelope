# sx-envelope-c-f104 — Washington L&I preparation

Repository: just-every/run-envelope
Product branch: cloud/sx-envelope-c-f104
Product head: a0be89405b7b9dd0f1b6035f74b611fca8a1e81c
Observed main: 2913789638d9f6da2cccb65ea318cc9b92f185e1
Claim: ENV-095 PARTIAL, acceptance 1 as selected native preparation; calculation and refusal portions of acceptance 2 also implemented. No DONE claim.

## Result and completed plan

PLAN.md records the complete plan. The implemented flow uses actual native company setup, exact notice and hours review, an employer-wide salaried election, immutable reporting preparation and the existing private calculation preview. Every new record is encrypted through the native workspace. Current owner, company and session authority applies before reads, preparation and replay.

Each retained assigned-rate notice binds the exact company and employer EIN, class, effective period, total hourly rate, permitted employee rate, original transcribed text, reference, edition and digest. The exact retained notice version must be reviewed. Hours bind each class allocation to that notice version. Salaried preparation uses either reviewed actual hours or 160 hours per complete month. All currently captured salaried evidence, including overlapping monthly and quarterly periods and workers omitted from an earlier selection, must use one consistent reviewed method.

A WA-specific source snapshot binds notice and hours versions and decisions, worker inventory and versions, and completed erasure history. Its SQL conditions recheck that snapshot atomically when saving or reviewing an election and when saving preparation. Reads and replay recheck freshness and current authority. A correction or new source requires fresh dependent review and preparation. The shared source helper is byte-identical to main.

The output is an unsigned, unfiled worksheet with per-worker and per-class hours, proposed employee shares, total premiums and employer remainders, plus immutable source editions and versions. The same current worksheet can be referenced from the Washington calculation-preview door for its exact period. Ordinary payroll deductions, federal results, net-pay authority, approvals, payments, filings and delivery state are unchanged.

## Independent public-door results

The synthetic employer-assigned notices specify total hourly dollar rates 1.50 and 2.25 and permitted employee rates 0.30 and 0.40. They model assigned-notice evidence rather than general state base rates. Genuine state-account, employer-notice authenticity and coverage authority are not claimed. Official method-source receipts are in official-sources.json.

- Hourly: 120 hours and 40 hours in the two classes give 270.00 total, 52.00 employee and 218.00 employer.
- Full salaried quarter: WAC 296-17-31021 gives 480 hours. At the first notice rate: 720.00 total, 144.00 employee and 576.00 employer.
- Initial combined worksheet: 990.00 total, 196.00 employee and 794.00 employer; class hours 600 and 40.
- A new actual-hours salaried worker invalidates the earlier selection. Mixed methods are refused. Corrected complete-roster review gives both salaries 480 hours.
- Corrected exact notice and hours sources produce 1786.00 total, 387.00 employee and 1399.00 employer; historical editions retain their original amounts.
- One complete month at the corrected rate: 160 hours, 256.00 total, 56.00 employee and 200.00 employer.
- Consistent actual salary with 10.5 and 10.6 class hours: 39.60 total, 7.39 employee and 32.21 employer.
- Every result remains unsigned and unfiled, with collected premiums unknown, account authority false, coverage not established, and payment unavailable.
- Lost-response replay after restart returns the one retained preparation. Missing or mismatched notice, stale version, inconsistent election, foreign company, non-owner, revoked session, held source and erased-source replay are refused without business effects or outbound requests.

## Acceptance and inherited-duty register

| Item | Public door and proof |
| --- | --- |
| Acceptance 1, selected native preparation | PASS locally: tests/wa-li-runtime.mjs, waLiJourney, lines 56–158 and 208–242. Actual notice setup and exact review, class-hour setup, retained reporting data and private calculation preview; independent hourly, monthly and quarterly goldens. Genuine state-account authority remains outside this native proof. |
| Acceptance 2, calculation and mixed-method refusal portions | PASS locally: waLiJourney, lines 126–219. Exact employee and employer cent amounts, 480 hours, complete roster correction and overlapping-period conflicts. Accepted quarterly report and payment remain UNMET-EXTERNAL. |
| Acceptance 3 | UNMET-EXTERNAL: actual required zero-hours filing remains owed. No filing authority or accepted submission is claimed. |
| Acceptance 4 | UNMET: complete activation and genuine state-certified self-insurance remain owed under ENV-021. Preparation records no account authority or established coverage and refuses activation, pay and file actions. |
| Source corrections and historical reporting | PASS locally: waLiJourney, lines 180–219. Corrected notice makes old review and preparation stale; exact corrected sources require fresh review; historical rates and amounts are preserved. |
| Native session authority and replay | PASS locally: waLiJourney, lines 152–157 and 248–264. Current and revoked native sessions, foreign company, non-owner and bearer refusals, plus one retained effect after discarded response and restart. |
| Privacy, holds and erasure | PASS locally: waLiJourney, lines 266–285. Real worker inventory includes hours and worker-bearing worksheets; holds refuse reads and replay; eligible erasure removes derivatives and preserves erased-source fences while separately retained employer notices survive. |
| Archive custody and inactive restore | tests/archive-runtime.mjs, archiveJourney with waLiArchiveFixture: native encrypted rows asserted at line 161; prior-session restored read and preparation replay refused at lines 317–325; complete ciphertext and authority assertions remain intact. This exact registered journey passed initial push job 129096683520 on b0346ee6273edf79dd8f3983e58e1ade50c427a7. Final-head Verify 42606279615 is the current gate; its conclusion is pending at this receipt. |
| Existing payroll and effect authority | PASS locally: waLiJourney, lines 48–53, 70–90, 142–151 and 284–285. No payroll approval, payment, filing or collection is created, ordinary deductions and federal results remain unchanged, and outbound requests remain zero. |
| Existing protected responses | PASS on main and after the final repair: incomeVerificationJourney, tests/payroll-runtime.mjs. Unreviewed release is 409, exact approved disclosure works, and the full consent, revocation, erasure, archive and browser journey passes without assertion changes. |

All new proof is loaded by tests/runtime.mjs and the existing push verification commands in verification.json. No workflow, Base pin, test assertion or test registration was removed, weakened, skipped or moved behind a condition.

## Verification repair

Initial exact-head Verify 42598416358 failed job 129096683450 on b0346ee6273edf79dd8f3983e58e1ade50c427a7. The income-verification command reproduced the real nonzero result: 503 payroll_unavailable instead of 409 at tests/payroll-runtime.mjs:4571. A local diagnostic established SQLITE_ERROR. VERIFY_REPRODUCED.json records the exact head, job, command, test, exit and quoted failure. The same full command passed on observed main 2913789638d9f6da2cccb65ea318cc9b92f185e1 on this cloud runner.

A flat conditional did not remove the failure. The final repair restores the shared source helper exactly and keeps company-wide source freshness inside WA preparation. During implementation its change epoch was replaced with completed erasure history, because the general privacy epoch also advances when preparation itself is written. All source versions, decisions, worker inventory and erasure conditions remain checked atomically. The final WA journey and the full income-verification command both pass. No authorization check or test assertion was weakened. Temporary diagnostics touched only ignored built output or files outside the product checkout and were removed by the normal rebuild.

An initial local archive invocation omitted CI=true and was refused by the existing export guard. A subsequent local Node 24 run failed an existing unrelated correction-import diagnostic assertion before the new restored-authority checks. Initial exact-head CI nevertheless passed the full archive shard. Redundant diagnostic repetitions and a temporary isolated archive probe were stopped once that CI proof arrived. These local observations are retained honestly; they are not claimed as successful archive runs or as evidence from the final SHA.

## DONE-RIDERS

| Row | Assessment |
| --- | --- |
| 1 | PARTIAL: the selected native outcomes pass; paid payroll, accepted quarterly reporting and payment, zero-hours filing and complete coverage authority remain owed. |
| 2 | PASS locally: independent nonempty amount goldens and allowed and unsafe public-door paths with unchanged state. |
| 3 | PENDING final-head Verify 42606279615; all journeys are registered. Initial industry and archive jobs passed on their explicitly named earlier head. |
| 4 | PASS for relevant local source identity: final WA proof uses the final source; the repaired disclosure helper and tests match those exercised by the passing full verification journey. Later WA-only snapshot changes do not alter the disclosure implementation. |
| 5 | INSPECTED: ENV-095 retains its ENV-021 origin and its own hours and shares duties. No receiving acceptance wording was changed. |
| 6 | MECHANICAL PASS: contract generation and check pass; all 126 Status rows and judgment cells remain untouched. The source row remains missing for independent lander judgment. |
| 7 | PASS: no acceptance sentence, coverage map, ID map or contract judgment changed. |
| 8 | PASS locally for this slice: exact owner correction succeeds; foreign, non-owner, revoked, held and stale attempts fail without effects. Complete delegation remains owed. |
| 9 | PASS boundary: no collected premiums, genuine coverage, state-account authority, accepted report or payment is inferred. |
| 10 | PARTIAL floor: configured native owner only under the standing conservative preparation rule. No new delegation, provider, money or outbound authority. |
| 11 | PENDING guarded lander: no cloud landing, scan completion, exact-main equality or candidate Run site success is claimed. |

## Mechanics and custody

Build, typecheck, WA runtime, the repaired full verification runtime, first-party check and source integrity pass locally. Contract generation writes zero changed views and its check passes. ACCEPTANCE.md and docs/CLAIMS.md were restored from origin/main and are not committed. No migration was added, so migration-ledger checking is not applicable. Updated origin/main was merged and was already up to date. The source lock was regenerated last and checked. The checkout and every changed source match the committed product head. No new screen or control was created; the existing harness captures setup and verification at 1440 and 390.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node src/base/contract-docs.mjs write then check exit=0; ledger=none exit=0.

All candidate author and committer identities and trailers passed the fleet policy before each product push. The product head was pushed through cloud-push.py; no default branch, published history or PR was changed. Full history is available. The evidence packet is separate from the product tree and conveys no READY, acceptance or landing authority.

Publication scan: commit=a0be89405b7b9dd0f1b6035f74b611fca8a1e81c; complete=unestablished; historyScanned=unestablished; findings=unestablished. Cloud branch publication does not run the Mac-only scan. The maintained lander must establish the exact-SHA scan, branch Verify, guarded landing and resulting Run site. Baseline main Verify 42437532604 and Run site 42437532472 succeeded. Baseline Nightly 42558285666 failed and is outside this target.

## Counts and remaining work

No status or count was changed in CONTRACT.md. Target-only counts remain 5 DONE, 44 PARTIAL, 76 MISSING, total 125; all-source counts remain 6 DONE, 44 PARTIAL, 76 MISSING, total 126. Proposed plan row: ENV-095 MISSING to PARTIAL, with target-only counts 5 DONE, 45 PARTIAL, 75 MISSING if independently accepted. No other plan row is proposed.

DEFAULT ENV-095: Current-native-owner exact reviewed preparation under the standing conservative preparation floor; no new delegation, account, coverage, payment, filing or outbound power.

GAP ENV-095: Actual deductions and paid stubs, accepted quarterly reports and payments, required zero-hours filing, complete alternative exposure units and applicability, genuine state-certified self-insurance and full activation remain owed. ENV-021 still needs authorized employer, state-fund and rail accounts that are not held. Complete catalog, employer and rail, provider and mandate, exact-human-approval, sponsor and grant, CT, device, visual-correction, RL-101 and feeder holds remain unchanged. Partial assumed months and ambiguous assumed class splits are refused.

CLAIM ENV-095 PARTIAL points=1 tests=tests/wa-li-runtime.mjs#waLiJourney; tests/archive-runtime.mjs#archiveJourney

## Transfer and latest CI observation

The product push succeeded. A later exact-run REST read returned HTTP 401 Bad credentials. Final Verify status is therefore unestablished; the last successful observation for run 42606279615 on the exact final head was in_progress. Only the fleet launcher and the same decrypted credential bundle are used for recovery. Evidence publication is being retried with bounded fleet backoff; no other credential is sought.
