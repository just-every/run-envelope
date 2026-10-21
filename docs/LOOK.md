# Envelope's look

The owner approved Envelope's app look on 20 October 2026: **app pick A**, the pay run as a fanned deck of
paychecks with the front check open and the run slip beside it, in the approved hero's world (pale aqua and white,
heavy rounded headings in forest and teal). This file names the tokens and components that carry it, so every pay
run, people, filing and settings screen is built from the same parts. Payroll itself is not built yet (CONTRACT.md:
every clause missing); the app home at `/app` shows the pick's composition in its empty state.

## Rules the look keeps

- **The pick's composition, not a dashboard skeleton.** One slim floating bar, a row of client chips, a two-line
  heading, one fanned deck with its open check, one run slip and the choices on the open check. Never a left rail,
  count tiles, an agent strip, a central table, a right exception panel or an activity log.
- **Colour has jobs.** Pale aqua alternating with white, never beige or cream. Forest then teal for the two heading
  lines. Done is done-green text with the one heavy check. **Red only on an exception. Coral only on a screen's one
  primary action** (`.btn--primary`), set in large bold type so white on coral meets WCAG AA for large text.
- **People are names.** No clay figures in the app (they belong to the homepage's hero, interlude and closing). A
  person is a name and a time, at most initials in a circle (`.avatar`); Dev Patel's one small red wrench on his
  avatar is the app's only clay-style accent.
- **Business chips** are solid pills in the business's colour with the name in white and the run's status. Never a
  category icon.
- **Figures** carry cents and tabular digits, and only the amount cells are tabular: labels and prose stay
  proportional. A figure that does not exist yet is a dash (`Amount` with no value).
- **Envelope speaks inline** in its tag (`.tag`), only when a person must read something, and always ends in a
  choice for a named person. It never approves, funds or sends.
- **Forms** have thin quiet borders (1 px, 3:1 against white) and a forest focus ring. Every `<select>` uses Base's
  two-gradient chevron (`src/base/select-style.ts`, in the root document's `pageStyle`): 14 px inside the right
  border with 40 px of end padding. Never an SVG data URI (the frames' CSP blocks it silently).
- **390 wide**: the bar, the chips as one row that scrolls sideways inside itself (never the page), the heading, the
  open check at full width with its tag and buttons stacked (48 px), the other checks as horizontal tabs in a vertical
  stack under it, the run slip last. Body text 14 px or more, nothing under 11 px.

## Files

| File | What it holds | Who links it |
| --- | --- | --- |
| `public/rer-theme.css` | Base's `--rer-*` tokens (literal values) and every `@font-face` | Every document: the app, Base's sign-in, confirmation, settings and `/setup`, the Lobby, the run site, the installer. The installer reads it with Base's theme grammar, so it holds only `:root { --rer-* }` and `@font-face`. |
| `public/look/tokens.css` | Envelope's tokens, aliasing the `--rer-*` values so each is written once | Through `look/envelope.css`; the run site links it directly. |
| `public/look/controls.css` | The page, lockup, cards, heading, buttons, links, fields and focus, shared with Base's frames | Through `look/envelope.css`. |
| `public/look/app.css` | The app's screen: bar, chips, pay run layout, deck, check, tag, slip, not-found | Through `look/envelope.css`. |
| `public/look/frames.css` | Base's documents in the look: frames, the Lobby, the run site's Run, contract and not-found pages | Through `look/envelope.css`. |
| `public/look/envelope.css` | The entry that imports the four above | `src/base/font-head.ts` (root document, `/setup`, auth pages), the edition identity's `fonts` (Lobby, Run pages), the dev entry for the dev sign-in and hand-off pages. |
| `public/brand/` | Mark 9 (`mark.svg`, full mark, 40 px and up), its favicons and `band.svg` (the Lobby's and Run pages' floor: a hand of blank paychecks) | — |
| `src/ui/` | The React components below | `/app` renders them once on the server (`page.server.tsx`); the root route hydrates the not-found page. |

## Tokens (`public/look/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--aqua` | `--rer-page` #e1faf9 | The ground. |
| `--ground` | aqua radial gradient | The app and frame page background. |
| `--paper` | `--rer-surface` #ffffff | Cards, the bar. |
| `--mint` / `--mint-band` | #e0f6f3 / #d6f1ea | A check's net pay box / the slip's net pay row. |
| `--sky` | #e9f4fe | Envelope's tag. |
| `--blush` | #fef0f0 | The one exception's pill and alerts. |
| `--wash` | #f5f9fa | Hovered outlined buttons, read-only fields. |
| `--ink` / `--body` / `--muted` | #1d2a44 / #3d4a5e / #627084 | Text: headings and figures / body / secondary. |
| `--hair` / `--field-line` | #dde5ea / #86939f | Rules / form and control borders (3:1). |
| `--lockup` | #08362f | The wordmark. |
| `--forest` / `--teal` | #126340 / #12a8a5 | Heading line one / line two (teal is for large type only). |
| `--teal-ink` | #0e6a66 | Links. |
| `--done` | #0b6c2a | The done check and done text. |
| `--red` | #d42c2c | Exceptions only. |
| `--coral` / `--coral-hover` | #f65457 / #ec4447 | The one primary action. |
| `--chip-goldenrod`, `--chip-forest`, `--chip-teal`, `--chip-slate`, `--chip-violet` | #b97f05, #126340, #0b939b, #2a5ba5, #6b3f99 | Business chips, assigned in this order (the homepage's Rosa's, Kessler, Brightside, Northpaw, Arch City). |
| `--terminal` / `--terminal-ink` | #13252e / #e8f2f2 | Command cards. |
| `--heading` | `'Nunito Display', Nunito, …` | Headings 900, the wordmark and card titles 800. |
| `--text` | `Inter, Arial, sans-serif` | Everything else; 16 px base. |
| `--mono` | `'SF Mono', Menlo, Consolas, monospace` | Commands. |
| `--card-shadow`, `--float-shadow`, `--deck-shadow` | soft teal shadows | Cards / the bar / the deck's checks. |
| `--radius-card`, `--radius-control` | 24 px, 12 px | Cards / fields. |

## Components (`src/ui`)

| Component | Classes | Notes |
| --- | --- | --- |
| `AppBar({ viewer, home })` | `.bar`, `.lockup`, `.bar-end`, `.bar-link`, `.person`, `.avatar`, `.person-name` | Mark 9 at 40 px (32 px at 390) and the wordmark with `data-rer-name` (Base appends Dev or Demo). Right side: what the person can open (Settings for the owner) and who they are. Search and Ask Envelope go here when they exist: a pill input like `.field input` with a search glyph, and `.bar-link`. |
| `ClientChips({ clients })` | `.chips`, `.chip`, `.chip--goldenrod…violet`, `.chip[aria-current]`, `.chip--none` | One chip per business: name and the run's status ("Open", "with Rosa", "Approved Tue 10:05 am ✓"). The open business has `aria-current` and a white ring. No businesses: one outlined chip that says so. |
| `Heading({ lead, then, meta })` | `.heading`, `.lead`, `.then`, `.heading-meta` | "Kessler, week of Oct 19." / "Pays Fri Oct 30." then one line of facts. |
| `Deck({ label, children })` | `.deck`, `.deck-fan` | The fanned checks behind the open one (offsets and turns from the 12ui conversion of the pick). |
| `Check({ … })` | `.check`, `.check-head`, `.check-name`, `.check-role`, `.check-cols`, `.check-col`, `.check-label`, `.check-line`, `.check-gross`, `.check-foot`, `.check-net` | Who, hours and pay, deductions and taxes, net pay in the mint box; the open check also takes the `Tag` and the choices. |
| `Tag({ children })` | `.tag` | Envelope's note beside mark 9's small cut (`/favicon-32.svg`), with a tail toward the figure it explains. |
| `Amount({ value })` | `.none` | A figure, or a dash with the text "none" for screen readers. |
| `RunSlip({ status, rows, when })` | `.slip`, `.slip-title`, `.slip-status`, `.slip-rows`, `.slip-net`, `.slip-total`, `.slip-when` | Gross pay, employee taxes, deductions, net pay (highlighted), employer taxes, total debit and its date; the debit equals net pay plus taxes plus deductions. |
| choices | `.choices`, `.btn`, `.btn--primary` | One coral primary, then outlined buttons. On the open check under the tag. |
| fields | `.field` (a label with `span` and `input`) | Thin border, forest focus ring; checkboxes in forest. |
| `NotFound()` | `.lost`, `.lost-card` | Any address the app does not have. |

## Still to build with the product (from the pick)

These are drawn in the pick and wait on the product's code. Build them from the parts above:

- **The populated deck**: one check per person in a stable order (salaried last, hourly by name); the other checks as
  horizontal tabs (name · role · amount, with the done check or a red tab) fanned to the right of the open check, a
  vertical stack under it at 390. Clicking a tab brings that check forward.
- **The exception**: on the affected check a blush pill with the wrong figure struck in red beside the right one
  ("~~92 h · $3,776.00~~ 46 h · $1,568.00"), red tabs on the affected checks, one red line in the slip
  ("1,104 h · $51,246.00 · $28,566.00 at stake") with a small tag, and Envelope's tag on the check ending in the
  person's choices (Keep batch 1 outlined, Compare batches, Ask the foreman) and the one coral "Send to Walt to
  approve". The tabs and the red line clear when the exception is resolved.
- **Client chips with real businesses** and their statuses; **search** and **Ask Envelope** in the bar.
- **The slip's live figures** from the run, with the debit date.
