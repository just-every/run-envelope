# Working on Envelope

## Launch for review

When asked to launch, run or review this app, run `rer dev` from the checkout
root and nothing else. It installs and sets up a fresh checkout; give it at
least 10 minutes. If a call times out, resume with the same command. Never run
install, setup, reset or deploy for a review, and never ask for an email, port,
password or answers file. Give the owner `RER_READY` and the private `RER_OPEN`
link in that chat, then ask nothing. Stop only this checkout's recorded process
by PID or Ctrl-C. If startup refuses, follow its named repair command.

Without rer, use `npx -y @runeditrun/rer cli install` or the installer at
https://runeditrun.com/install.sh.

## Scope and commands

Read CONTRACT.md and ACCEPTANCE.md before changing behavior. ct owns their
wording. This new seed contains only Base's technical foundation; every payroll
clause is missing. Do not add mock data, pretend features or provider fallbacks.
Brand and build rounds follow later; preserve Base's default theme and Lobby.

Pin the published `@runeditrun/rer` exactly at 0.2.76. There is no local CLI
copy. Public commands are `rer install`, `rer setup`, `rer dev`, `rer build`,
`rer verify`, `rer check`, `rer describe`, `rer export`, `rer import`,
`rer reset --yes` and `rer deploy`. For an owner installation use `rer install`,
then `rer setup --owner-email you@example.com` and `rer dev`; local mail is
silently suppressed and D1 state persists under `.wrangler/state`.

`src/base` and `src/modules` come from Base's foundation export; provenance is
in composition.lock.json and edition.json. Refresh Base through its exporter.
`node scripts/edition-authoring/cli.mjs lock` refreshes the source lock after
intentional edits. Keep native session checks, private settings and migrations.

The installed `/` is Base's Lobby. The static Run site entry is src/site/pages.ts,
and `/contract` uses Base's parser and renderer on root CONTRACT.md. Never
weaken validation. Run site deployment is gated by RUN_SITE_DEPLOY and remains
independent of Verify. Research and evidence belong outside this public repo.
Run only changed-area tests locally; Verify CI is the full wall. Never weaken a
test. Never print secrets, read ~/.env, or commit private settings or sign-in URLs.
