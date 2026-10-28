# Extended retirement preparation

Envelope retains native, encrypted plan and election evidence for employee
403(b), governmental 457(b), nongovernmental 457(b) and employer SEP proposals.
The configured installation owner uses a current native session and company
authority. This is an interim owner-only preparation boundary. It grants no
provider, bank, filing, payment or agent authority. Broader scoped delegation
and complete custody remain owed.

The private API starts at
`/api/envelope/companies/:company/people/:person/benefits/extended-retirement`.
GET returns retained setups and proposals; POST appends an immutable setup with
an expected version. GET `./review/:id` returns an exact-version review token;
POST `./decision/:id` approves that version, or explicitly withdraws it.
POST `./preview` prepares a contribution proposal against an explicitly selected
setup and version. Each proposal has its own identifier and expected version.
Repeated saves refuse rather than create another effect. A proposal never
updates a contribution accumulator. Opening registers must reflect independently
reconciled actual contributions, never previous proposals.

Every setup requires an eligible employee, employer type, effective dates in
one supported tax year, annual includible compensation, age at year end,
prior-year FICA wages, explicit plan permissions, and references to the plan,
election, eligibility, opening register and aggregation determination. These
are human-reviewed records; they do not authenticate a plan or establish legal
eligibility. Custom codes and unknown fields are refused. Unsupported years,
self-employed SEP calculations, Roth SEP arrangements and salary-reduction SEPs
are unavailable.

The retained 2025 edition uses IRS Notice 2024-80: $23,500 elective deferrals,
$70,000 annual additions, $350,000 compensation and $7,500 ordinary age catch-up.
The 2026 edition uses Notice 2025-67: $24,500, $72,000, $360,000 and $8,000.
Both editions use the $11,250 catch-up for ages 60 through 63. For 2026,
prior-year FICA wages above $150,000 require age catch-up to be Roth; when the
plan cannot accept Roth, that age catch-up is unavailable. This requirement
does not turn service catch-up or special 457(b) catch-up into age catch-up.
Each retained setup and result includes its tax year, rule values and source
links. No runtime source fetch or external request is needed to calculate.

## 403(b)

The reviewed employer is a public school, qualifying nonprofit or church.
Service catch-up additionally requires the plan to permit it and at least
15 verified years with a qualifying educational, hospital, home health,
health and welfare or church organization. Its annual capacity is the least
of $3,000, unused $15,000 lifetime capacity, and $5,000 times service years
less the qualifying employer's prior-year elective deferrals. Publication 571
is the source for that register and the ordering: ordinary elective capacity,
then service catch-up, then age catch-up.

Opening `electiveCents` includes the participant's shared elective deferrals
across applicable plans, excluding age catch-up and including service catch-up.
`planElectiveCents` identifies the portion subject to this compensation and
addition register. `serviceCents` and `ageCents` separately identify current-year
catch-ups already used. `annualAdditionsCents` includes employer contributions
and all required aggregated additions, including controlled-business plans and
SEPs where Publication 571 requires them. Age catch-up is excluded from that
addition register. A reviewer must reconcile the aggregation reference; a
blank or omitted accumulator never means zero.

Traditional and Roth employee requests share the elective ceiling. Non-age
employee amounts and employer contributions share the lesser of annual
additions and includible compensation. Ordinary and service employee amounts
produce prepared E and BB fields according to their traditional and Roth split;
age catch-up keeps the same arrangement's code. Age catch-up can also apply
when the combined annual-additions ceiling is reached before the elective
ceiling. Only employee deferrals above the applicable non-age limit are
reclassified; employer contributions remain annual additions. In 2026, an
eligible age-55 employee contributing $20,000 alongside $60,000 from the
employer has $12,000 ordinary deferrals and $8,000 age catch-up, leaving $72,000
annual additions. Prior age catch-up remains separate from the non-age opening
register, and its remaining capacity and any Roth requirement still apply.
See [the section 414(v) catch-up regulation](https://www.irs.gov/pub/irs-regs/td9072.pdf).

## 457(b)

Employer and employee contributions share the applicable 457(b) ceiling,
separate from the 403(b) elective ceiling. Opening `contributionsCents` includes
all applicable employer and employee contributions, including current-year
catch-ups. `ageCents` and `specialCents` identify those catch-ups within it.

The setup explicitly selects ordinary, age or special catch-up treatment.
Only a governmental plan may use age catch-up or designated Roth. Special
catch-up requires plan permission and a year within the three years before
its stated normal retirement age. Its extra capacity is the lesser of the
basic limit and verified unused prior eligible deferrals. Age and special
catch-ups cannot combine in one year. Includible compensation also caps the
proposal. Prior-year FICA wages and Roth availability govern the 2026 age
catch-up rule. The reviewer chooses the applicable mode and reconciles its
unused-deferral source; the application does not invent unused years.

Traditional employee amounts and employer contributions produce prepared G.
Only designated Roth governmental employee amounts produce EE. A nongovernmental
arrangement cannot acquire Roth or age catch-up by using another reporting code.

## SEP

For the supported employee arrangement, employer SEP contributions are limited
to 25% of capped annual compensation and the annual defined-contribution limit.
Opening `employerCents` records prior SEP employer contributions;
`annualAdditionsCents` includes all required aggregated additions. Employee
traditional or Roth elective requests refuse. The result contains an employer
proposal, zero employee deduction and no ordinary Box 12 code. The employer
contribution must never enter the existing after-tax deduction list.

## Payroll and honest boundaries

The company `./calculation-preview` API accepts an optional
`extendedRetirement` selection with `personId`, `setupId`, `setupVersion` and
`request`. It reads current reviewed evidence through the same private door.
The result retains the existing jurisdiction holds and adds a retirement
integration hold. Ordinary wages and taxes are unchanged: the separate proposed
amounts establish neither payroll tax treatment nor an employee deduction.
Prepared reporting fields are not delivered W-2 forms or provider acceptance.

A corrected setup invalidates earlier pending preparations even before the new
version is approved. Old review tokens cannot approve a corrected version.
Proposals pin their source version and worker record. History stays visible as
history, with changed sources explicitly marked. Revoked sessions and foreign
company or worker references cannot retrieve the private evidence. Records
use the existing encrypted workspace, access audit, worker dependency inventory
and erased-source fences; complete benefit-specific hold, erasure and inactive
archive restore proof remains owed. No automatic hold release, erasure or
outbound action is introduced.

Still owed: independently established actual-plan eligibility and complete
custody, accepted provider contribution receipts and funds, corrected paid
payroll, complete pay-stub and year-end integration, and authorized recordkeeper
and rail access. Native evidence review supplies none of those outcomes.

Sources: [2025 limits](https://www.irs.gov/pub/irs-drop/n-24-80.pdf),
[2026 limits and Roth catch-up threshold](https://www.irs.gov/pub/irs-drop/n-25-67.pdf),
[Publication 571](https://www.irs.gov/publications/p571),
[457(b) plans](https://www.irs.gov/retirement-plans/irc-457b-deferred-compensation-plans),
[SEP rules](https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-seps),
[2025 W-2 instructions](https://www.irs.gov/pub/irs-prior/iw2w3--2025.pdf), and
[2026 W-2 instructions](https://www.irs.gov/pub/irs-prior/iw2w3--2026.pdf).
