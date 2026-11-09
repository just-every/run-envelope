# Shard assignment changes

| Shard | Baseline wall time | Final assignment |
| --- | --- | --- |
| runtime | 12m16s | records,approvals,sponsored,identity; agent-policy |
| workspace | 4m41s | allocations,schedules,pay-items,rules,leave,source-intake,intake |
| verification | 3m16s | pnpm run check --profile first-party; pnpm run typecheck; pnpm run test:typecheck; income-verification; agent-docs; agent-decisions |
| industry | 4m29s | industry,calculation,ny-dbl,extended-retirement,hi-benefits,futa-credit,or-wbf,wa-li; retirement; multi-company; accounting; masked-resources |
| claims | 4m11s | claims; tax-notices; firm |
| archive | 8m47s | archive |
| new-hires | 3m14s | new-hires; paper-onboarding; automation; agent-capacity |
| agent-door | 8m08s | pnpm run typecheck; node tests/agent-door/failures.mjs; agent-replay |

Runtime baseline was cancelled at its job limit, so its elapsed time is a lower bound on the full original workload. The final job durations must come from exact-SHA hosted Verify; local timing does not establish hosted timing.
