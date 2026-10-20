# Envelope

Small-business payroll.

100% free, open source alternative to Gusto, ADP RUN, Paychex Flex.

This is the Base technical foundation for a new seed. Payroll is not built yet.
[CONTRACT.md](CONTRACT.md) and [ACCEPTANCE.md](ACCEPTANCE.md) describe the target,
with every product clause marked missing. The shared Lobby is at `/`; the Run
site renders the root contract at `/contract`.

## Run locally

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
rer dev just-every/run-envelope
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-envelope`
does both steps. To start again: `cd run-envelope && rer dev`.

Runs on macOS, Linux or Windows with WSL2, with git. The installer brings Node
when it is missing, and rer brings pnpm. Local mail is silently suppressed.

Read [RUN-LOCALLY.md](RUN-LOCALLY.md), [OPERATIONS.md](OPERATIONS.md) and
[AGENTS.md](AGENTS.md). Node 22.20.0, pnpm 10.12.4 and `@runeditrun/rer` 0.2.73
are pinned. `rer check` validates the command and contract declarations;
`rer verify` runs the foundation's checks. No payroll functionality is implied.

## Run site

`rer build --site` builds `/`, `/run` and `/contract` from this checkout.
The independent Run site workflow deploys `run-envelope.com` only when repository
variable `RUN_SITE_DEPLOY=true`; it requires `CLOUDFLARE_ACCOUNT_ID` as a variable
and `CLOUDFLARE_API_TOKEN` as a secret. Keep deployment gated until configured.

MIT licensed. [Source](https://github.com/just-every/run-envelope).
