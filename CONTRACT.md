# Envelope target product contract

Target edition: **20 October 2026**. Envelope is full-service US small-business payroll: calculate what each person is owed, pay them on time, remit the taxes and deductions, file the returns, and carry every exception through to an evidenced outcome. A US employer switching from Gusto, ADP RUN, Paychex Flex, QuickBooks Payroll, Warp, Rippling Payroll or OnPay must be able to complete that job here. The first buyer has 1–100 employees; that starting buyer does not cap the product's growth or its coverage of states, local taxes, industries or payment methods.

## Product target

| | |
| --- | --- |
| Category | Full-service US small-business payroll |
| Incumbents a buyer switches from | Gusto, ADP RUN, Paychex Flex, QuickBooks Payroll, Warp, Rippling Payroll, OnPay |
| Up-and-comers it must also beat | Warp |
| First buyer | Owner, office manager or bookkeeper of a US employer with 1–100 employees, hourly and tipped workers, remote staff and 1099 contractors, paying in USD; also accounting firms operating many client companies |

The primary journey: a US employer hires through Willow, brings in time and tips from Lanyard, registers its tax accounts, reviews and approves an exact run, pays people on payday, remits deposits and files returns, posts the Pantry journal, gives each worker a stub and follows up the firm's notices.

## How to read this contract

- This follows the RER contract standard. It is the destination, not a release promise: Core is what a buyer switching from the named incumbents uses in the first week, plus the push-further work; Agent surface and Later are reported separately.
- Done means every acceptance point passes through Envelope's own doors (product routes, documented API and MCP, provider sandboxes or official-schema edges, seeded runs) in a recorded Verify run.
- Real-world proof Envelope cannot produce in its own repository (a funded production payday, live agency receipts, a signed service operator, staffed hours, store listings, a human screen-reader pass) is in the Field proof register; it never blocks done.
- Door rules D-1 to D-7 are stated once below; a clause that lists them proves them at its own door.
- ACCEPTANCE.md and docs/CLAIMS.md are generated from this file. Rulings are in RULINGS.md, history in CHANGELOG.md, and sources, coverage lists and mechanism in docs/.

## Door rules

- **D-1.** Remittance-only hold. A missing or pending state or local withholding, SUI or local tax account number, or a missing agency grant, holds only that jurisdiction's deposit and filing. Employees still receive correct net pay on payday using official withholding tables and the applicable published new-employer SUI rate. Wage-payment law does not suspend wage deadlines while registration is pending. This rule governs every clause, agent, migration and acceptance journey; agency authority is distinct from human approval of wages or banking authority. Held remittances retain their own due dates, liability, penalty exposure and fault history.
- **D-2.** Typed tips and the statutory shortfall. Every tip entry is typed for its run as cash tips the worker already holds or paycheck tips Envelope pays (ENV-081). The typed-tip and statutory uncollected-tax path in ENV-082 is an explicit exception to zero/negative-net holds, never permission to delay wages.
- **D-3.** Separate outcome facts. Provider accepted, agency accepted, bank settled, employee received, recipient notified and human approved are separate facts. An upload, HTTP 200, generated file, timer expiry or model statement cannot stand for one of those outcomes. A builder may use Check, Gusto Embedded, Salsa, Zeal or a sponsor-bank arrangement, but must deliver the named outcomes, expose unsupported provider coverage as unfinished, and never replace payment or filing with a generated document labeled complete.
- **D-4.** Doors and edges. An acceptance journey uses actual application routes, documented API/MCP doors, the deployed Base runtime or supported mobile client. Fakes belong only at the external network/paid edge and follow a named provider's official request, event, error and acknowledgement schema. Record the provider, schema edition and scenarios; a fake response is test evidence, never a production receipt. Use a provider/agency sandbox where available. Where an agency lacks one, test its official file/portal schema, rejection and reconciliation flow at the edge. Do not make production payments for a test without the employer's exact authorization. Sensitive identifiers are synthetic only in tests.
- **D-5.** Exact authority. All clauses inherit ENV-028 and ENV-034's current human authority and ENV-035's uncertain-effect handling. Every pay run, money movement, signed filing, bank-detail change, garnishment setup and rate change binds its exact current version. A person who approves one approves that version in the product; an agent's call that makes one carries its money, commitment or sensitive class, and the company's policy decides what happens to it. One review can authorize a listed batch of exact items and its funding/deposit schedule; it cannot authorize unknown future items. An agent never records a person's approval. A revoked approver, changed evidence or changed payload invalidates pending authority.
- **D-6.** Screens and the shared fixture. Every browser journey runs at **1440 and 390 CSS pixels** with realistic US company, hourly/salaried/tipped employee and contractor records, English/Spanish where relevant, keyboard navigation, loaded, empty, held, failed and completed states. At minimum the shared business fixture includes California hourly/final pay, Pennsylvania local taxes, a NJ-to-PA move, Colorado remote work, an employee with two garnishments, a near-limit retirement contributor and a contractor with prior-year records. A clause that lists D-6 runs it on the screens its acceptance names; API, rail and filing doors carry no viewport sweep.
- **D-7.** Visible provider failure. A failed optional provider remains visible while unaffected payroll work continues; missing required security/runtime configuration refuses activation of the affected service.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | ENV-051 | not run |
| BASE-ACCESS-002 | Sessions | ENV-051 | not run |
| BASE-ACCESS-003 | Public endpoints | ENV-057 | not run |
| BASE-ACCESS-004 | Server-side authorisation | ENV-028 | not run |
| BASE-INPUT-001 | Validation | none | not run |
| BASE-INPUT-002 | HTML | none | not run |
| BASE-INPUT-003 | Uploads | ENV-057 | not run |
| BASE-SECRET-001 | No leakage | ENV-055 | not run |
| BASE-SECRET-002 | Startup | ENV-050 | not run |
| BASE-DATA-001 | Export and import | ENV-053 | not run |
| BASE-DATA-002 | Retention | ENV-054 | not run |
| BASE-DATA-003 | Erasure | ENV-054 | not run |
| BASE-DATA-004 | Outbound flows | ENV-055, ENV-073 | not run |
| BASE-DATA-005 | Independence | ENV-055 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ENV-054 | not run |
| BASE-PUBLIC-001 | Privacy | ENV-057 | not run |
| BASE-PUBLIC-002 | Origins | none | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | ENV-056 | not run |
| BASE-OPS-002 | Migrations | none | not run |
| BASE-OPS-003 | Idempotency | ENV-035 | not run |
| BASE-OPS-004 | Failure is visible | ENV-056 | not run |
| BASE-OPS-005 | Audit | ENV-028 | not run |
| BASE-ROLE-001 | Roles through every door | ENV-028 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | ENV-028 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | ENV-053 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | ENV-051 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | ENV-051 | not run |
| BASE-INSTALL-001 | Free self-host and removal | ENV-050 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | ENV-044 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | ENV-057, ENV-045 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | SURFACE-001 | not run |
| BASE-AGENT-002 | The seed's jobs are tools | SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-001, SURFACE-004 | not run |
| BASE-AGENT-004 | Business identity and short-lived tokens | ENV-052 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role | ENV-052, ENV-072 | not run |
| BASE-AGENT-006 | Every action declares its risk class | SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005 | not run |
| BASE-AGENT-007 | The company's policy decides | SURFACE-002, SURFACE-006 | not run |
| BASE-AGENT-008 | Truthful attribution | ENV-030, ENV-052, SURFACE-003, SURFACE-005 | not run |
| BASE-AGENT-009 | Every agent action is audited | SURFACE-006 | not run |
| BASE-AGENT-010 | Agents can follow changes | ENV-030 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | SURFACE-006 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | ENV-030 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-007 | not run |

## Published clauses

- `ENV-055`: *Tier:* Core · *Cites:* BASE-DATA-004, BASE-DATA-005, BASE-SECRET-001

### Implemented external data and owner independence

#### ENV-055 — Declared external data and owner independence

**Requirement.** Declare every external recipient Envelope actually calls, its purpose, fields, credentials and custody in installation settings and seed external-flow metadata before its first request. The complete recipient inventory is covered by ENV-073. Send only needed permitted fields; redact SSNs/bank accounts from logs, notifications and model requests unless a specifically authorized task demonstrably requires them. Disable optional AI without losing any implemented control; the complete non-agent payroll journey is covered by ENV-073.

**Acceptance.**
1. Exercise every implemented journey with a network, client-bundle and log recorder and planted sensitive values.
2. Inspect exact approved destinations and data, absence of sensitive values from unauthorized requests, client bundles and logs, and no undeclared or telemetry host contacted.
3. Remove the OpenAI key and continue every implemented non-agent control; notice processing is explicitly unavailable and cannot substitute a mock result.

## Target clauses

### Company, people and jurisdiction records

#### ENV-001 — Company and tax setup

*Tier:* Core · *Rules:* D-1, D-6

**Requirement.** Maintain legal entity, EIN, legal/DBA names, addresses, responsible contacts, work locations, bank authorizations, federal lookback/deposit schedule and reporting-agent elections. A jurisdiction register holds every required withholding, SUI, local, disability and PFML account, agency identifiers, effective rates, wage bases, deposit/return frequencies, registration status and source documents. Distinguish a known exemption from a missing account. A missing/pending state or local withholding/SUI account never blocks employee pay (D-1): pay correct net wages on payday and hold only that jurisdiction's deposit and filing as a deadline-dated liability. Other missing essential inputs or authority are evaluated against their actual lawful effect under ENV-007/034; an absent tax account number is never a wage hold. The jurisdiction register also contains mandatory state-fund compensation accounts and hour-based assessments under ENV-021, ENV-095, ENV-096 and ENV-098, including WA L&I account/TPA, assigned risk-class total/employee rates, employer-wide salaried-hours election and OR WBF applicability/hours method; a private-policy connection cannot substitute for these.

**Acceptance.**
1. Through setup and the company API, establish a multistate employer, enter monthly and semiweekly schedules and inspect the derived register.
2. Omit one mandatory local/SUI account, approve and pay the worker on payday with correct withholding and the published new-employer SUI rate, and show only that jurisdiction's unpaid deposit/filing liability, due date and penalty-exposure notice.
3. Add the agency-issued account/rate through ENV-002, review the true-up and release the remittance once, without holding or repeating the original wage payment.
4. Reload without losing the effective history.
5. Set up subject WA/OR workers, inspect the generated L&I/WBF requirements and rate/hours elections, and refuse full ready status when only a private workers-comp policy is supplied.
6. Retain the actual outstanding remittance/setup duty without holding lawful wages for an account/grant delay.

#### ENV-003 — Employee and contractor onboarding

*Tier:* Core · *Rules:* D-6

**Requirement.** Invite by email or SMS into a payroll-only profile. Employees complete signed federal W-4 including pre-2020 elections carried from migration, state certificates, identity/address and bank elections on their phone; contractors complete W-9 and authorized IRS TIN matching. Keep worker classification, employment dates, work/residence allocation, pay policy and documents effective-dated; mask SSNs and separate employer and employee edits. A mismatched contractor TIN has a protective payment hold pending a corrected match or the documented human-reviewed lawful backup-withholding alternative below; required withholding is surfaced, never silently ignored. Also offer admin-assisted payroll onboarding without any employee email, mobile number or portal account: enter elections and payment method from signed paper W-4/state certificates/direct-deposit authorization, attach the originals, identify the entering and reviewing people, and apply the same masking, bank verification and change protection. A paper-check election needs no bank account. A later verified portal invitation links to the existing person and preserves elections, history and custody; it never starts a duplicate worker or resets payroll setup. Include local withholding certificates in self-service and admin-paper onboarding: PA residency certification, Ohio IT-4 residence/school-district fields and applicable local exemptions, with signed evidence/effective dates. Where actual IRS triggering rules apply, currently 24% backup withholding allows payment of the remainder while the TIN case stays open; a generic mismatch alone cannot invent an IRS instruction. Paper entry, exact-version review and original download are separately grantable under ENV-028 (RL-3).

**Acceptance.**
1. Invite an employee and contractor through onboarding, complete/sign their forms without admin re-keying, verify payable status and masked admin reads.
2. Return a TIN mismatch from the official matching edge and prove the held payment, correction journey and retained source/result; a forwarded/expired invite cannot expose someone else's records.
3. Add a worker with no email or phone via the admin route, enter/attach signed paper federal and state elections, select paper check, review and pay.
4. Later invite the same worker, verify their identity and inspect preserved elections/history plus who entered/reviewed each field; neither unsigned paperwork nor a duplicate invitation creates payable authority.
5. Enter signed PA/Ohio certificates through paper and portal paths and inspect a district move.
6. For an IRS-notified incorrect contractor TIN, approve the lawful backup path on a $1,000 payment, pay $760 and retain $240 liability with 1099 withholding reporting; require human approval and official stop rules after correction.
7. A mere generic mismatch cannot fabricate that authority.

#### ENV-007 — Multi-state and remote workers

*Tier:* Core · *Rules:* D-6

**Requirement.** Resolve work-state, resident-state and local jurisdiction obligations using actual work allocations, reciprocity elections, convenience rules including New York, effective address changes and mid-period moves. Retain which rule, location and election produced each allocation; distinguish working across states from moving residence. Unknown location or contradictory source data becomes an assigned hold.

**Acceptance.**
1. Through the employee change API and payroll preview, move a worker from NJ to PA mid-quarter, add an out-of-state workday, a reciprocal election and a NY convenience scenario.
2. Match withholding/report allocations to applicable official rules and retain both historical locations without a manual balancing adjustment.

#### ENV-017 — New-hire and rehire reporting

*Tier:* Core · *Rules:* D-3, D-4, D-6 · *Register:* R-2

**Requirement.** Generate and submit the required hire/rehire report to each state directory within its applicable deadline, supporting multistate-employer elections, required employer/worker fields, duplicate detection and rejection repair. Report delivery status, agency response, reporting date and the responsible person; an HR onboarding completion never substitutes for a state report. Hire and rehire reporting covers all 50 state directories and DC in the ENV-097 gating set, with the federal OCSS state-contact directory and each directory's official deadlines/schema as the denominator; multistate elections do not erase the other directories' implementation obligations. Where no usable authority API exists, manual portal transfer of an exactly reviewed report version is an honest channel boundary, while timely submission, rejection repair and evidenced reporting outcomes remain owed; human-attested responses stay labeled apart from independently supported acknowledgements (RL-4).

**Acceptance.**
1. Create a hire, rehire and multistate election through the people API, advance the clock across their official deadlines and submit approved reports at the directory edge.
2. Inspect confirmations and an overdue/rejected report with a repair owner; replay the hire and callback without a duplicate submission.
3. Generate and execute the complete new-hire/rehire deadline/submission matrix; remove one directory or its schema case and require the completeness check to fail, with that directory named.

#### ENV-027 — Effective rules and compliance calendar

*Tier:* Core · *Rules:* D-5, D-6

**Requirement.** Maintain versioned federal, all-state/DC and local tax tables, FICA bases, unemployment rates/bases, PFML/disability rules, city minimum wages, exempt thresholds, final-pay and deposit/filing deadlines. Changes retain official source, publication/effective dates, affected people and a reviewable impact preview. A rate or pay-rate change applies only as an exact authorized version (D-5): a person approves it in the product, or an agent's call carries the money class the company's policy decides; if it is not authorized by its effective date, hold the proposed rate mutation and escalate under ENV-046. The service must secure an authorized replacement run or check at no less than the effective lawful minimum before the wage-payment deadline. An agent never records a person's approval, and an unauthorized proposal must never become an excuse to underpay or make payday late. The held object for an unauthorized minimum-wage increase is the proposed change, not permission to delay wages. Version WA L&I rate notices/class and salaried exposure methods, OR WBF rates/rounding/assumed hours, HI plan-share caps and tax-year/state FUTA reductions/add-ons/waivers as sourced effective rules. Distinguish DOL potential current-year FUTA forecasts from the November final determination and keep already-filed years reproducible.

**Acceptance.**
1. Introduce a January city wage increase and a retroactive SUI notice through rule administration, approve the exact changes and run before/after the effective boundary.
2. Affected pay and liabilities use the right edition, prior runs remain reproducible, and an unauthorized proposed mutation escalates with its deadline while an authorized (D-5) lawful original/replacement payment still reaches the worker by payday.
3. Delay approval past the effective date and use backup/service escalation to authorize a compliant revised/replacement payment before the legal payday.
4. Verify correct wages received, no automatic approval and the missed internal approval deadline retained.
5. Publish a changed L&I notice, OR WBF new-year rate and provisional-to-final FUTA/BCR change through rule administration.
6. Inspect exact impacted drafts, invalidated pending approvals, authorized application (D-5) and unchanged historical replay; absence of a current-year final notice remains explicit, never inferred from last year's rate.

#### ENV-031 — Industry and special-worker payroll

*Tier:* Core · *Rules:* D-6

**Requirement.** Support farms and agricultural/non-agricultural wage separation including Form 943 and H-2A treatment, nonprofits with applicable unemployment exemptions, churches/clergy and housing allowances, seasonal workers, owners and more-than-two-percent S-corporation shareholder benefit treatment. Each exemption is evidence-backed, effective-dated and reviewed; do not apply a blanket church exemption to every worker. Certified/prevailing-wage work is supported under ENV-104. Person-specific nonresident-alien and FICA/FUTA exemptions, including qualifying students and sole-proprietor family employment, inherit ENV-076's documented-basis and effective-date rules.

**Acceptance.**
1. Use company/payroll routes for farm and office workers, a nonprofit employee, a minister with housing allowance and an S-corporation owner.
2. Compare paycheck, taxable wage and 943/941 assignments to applicable official instructions through schema-based agency edges; change classification with review and show the amendment consequences.
3. Exercise the qualifying and nonqualifying worker comparisons in ENV-076 without applying a blanket industry or citizenship exemption.

#### ENV-032 — Multiple companies without crossed liabilities

*Tier:* Core

**Requirement.** An owner or firm can manage multiple EINs, locations, departments and jobs with separate bank accounts, tax registers, authorizations, runs and year-end forms, plus permitted consolidated labor reporting. A worker employed by two entities retains separate wages/withholding and applicable reviewed shared-paymaster/successor treatment. Entity switching never carries approval or salary visibility across clients. A retained funding reference, plan, identity check or restored approval is neither bank verification nor a debit mandate and grants no payment authority. Separate company identities, accounts, liabilities and history remain isolated. Authorized bookkeepers, payroll administrators and accountants receive separately scoped masked reads and funding-plan preparation under ENV-028; bank administration, export, transaction approval and release remain separate explicit powers (RL-5).

**Acceptance.**
1. Create two EINs with a shared worker and distinct funding accounts through the company API; preview/pay separate runs and inspect separate deposits/forms plus a permission-filtered combined report.
2. Attempt cross-entity payment, record and archive references and refuse them without writes.

### Earnings, calculation and run preparation

#### ENV-005 — Pay schedules and deadlines

*Tier:* Core · *Rules:* D-6

**Requirement.** Weekly, biweekly, semimonthly and monthly schedules coexist, with company-local period boundaries, US timezone/DST handling, pay dates, weekend/bank-holiday adjustment policy and explicit ACH processing cutoffs shown in Eastern and local time. Show available processing speed, funding deadline and consequences before scheduling; changing the date invalidates approval. Validate pay frequency against each worker's work-state rule, occupation and documented exception in the ENV-097 gating set, including New York manual-worker weekly-pay requirements. Block a schedule that violates an applicable rule unless an actual valid agency exception is recorded; a warning acknowledgement cannot waive the law. Derive offered paydays and funding/approval cutoffs from ENV-086's current employer/run speed eligibility. An eligibility transition updates the calendar in Eastern and employer-local time, bank-holiday adjustment and fees; an expired/past cutoff is unavailable even if the speed itself is eligible. Changing a selected speed or its material terms invalidates the affected pending run approval.

**Acceptance.**
1. In schedule settings and run preview, create each frequency and a Friday federal/bank-holiday payday moved earlier by the selected policy.
2. Inspect the corresponding approval/funding cutoff, a DST transition and a missed cutoff; no past deadline is displayed as available.
3. Try a biweekly schedule for a New York manual worker without an exception and require refusal with a weekly alternative.
4. Attach a valid official exception, apply its scope/dates and prove that another worker or expired exception cannot inherit it.
5. Move an employer through standard to granted two-day/next-day eligibility, inspect newly available dates and exact cutoffs on both schedule and run doors, and compare an eligible same-day versus after-cutoff run.
6. Cross a holiday and DST transition, revoke eligibility after review and require recalculated lawful dates plus reapproval, with no stale fast-pay promise.

#### ENV-006 — Explainable gross-to-net engine

*Tier:* Core · *Rules:* D-1, D-2

**Requirement.** Calculate hourly and exempt/nonexempt salary, multiple rates, FLSA regular-rate overtime including nondiscretionary bonuses/commissions, daily/double time where applicable, piece/per-class pay, tips, imputed income, taxable fringe benefits, pre/post-tax deductions and employer taxes. Calculation covers federal, all 50 states, DC and the large-local file in ENV-097, including PA EIT/LST, Ohio municipalities, NYC/Yonkers, Indiana counties, Michigan cities and Kentucky occupational taxes; any other location follows ENV-066's fail-closed rule. Support reviewed custom earning/deduction codes and recurring or one-time amounts with explicit taxability. Use decimal/currency-safe rounding, annual accumulators and effective tax tables; show every stub line's inputs, rule and rate. Missing state/local account numbers or TPA grants never alter correct calculation or delay net pay (D-1). Name approved California meal/rest-period premium codes separately from hours and calculate the legally required regular-rate treatment. ENV-082's tip-tax insufficiency is a statutory uncollected-tax outcome, never a zero/negative-net wage hold or employee debt created by the engine. Show wages, tips already held, paycheck tips, actual cash due and uncollected taxes separately; pay all cash lawfully due on payday, including an honest completed zero-cash statement when withholding uses all available wages.

**Acceptance.**
1. Submit the shared worker fixture through the public preview API and compare cent-level calculations against IRS Publication 15-T and each exercised jurisdiction's official tables.
2. The jurisdiction corpus covers 100% of the ENV-097 gating set's authorities, applicable rules, annual caps and effective-boundary cases; an implementation cannot define its own supported subset as complete.
3. Reproduce a historical check after a table update and exercise rounding, multiple rates, regular-rate bonus allocation and zero/negative-net checks: hold unlawful deductions, excessive garnishments or bad data, but explicitly exclude ENV-082's statutory uncollected tip-tax case, which stays approvable even at lawful zero cash net.
4. Pay a worker with a pending state/local account and compare published-table withholding/new-employer SUI to a registered control.
5. Add approved meal/rest premiums plus a nondiscretionary bonus and match official regular-rate calculations.
6. Preview the ENV-082 $2.13-by-20-hours tip-credit server and require an approvable run, correct withholding-order breakdown and payday completion without a fabricated negative payout or zero-dollar ACH.
7. An excessive unlawful garnishment still blocks.

#### ENV-076 — Nonresident aliens and person-specific tax exemptions

*Tier:* Core · *From:* ENV-006

**Requirement.** Apply the Publication 15-T nonresident-alien withholding adjustment and applicable FICA/FUTA exemptions by person, tax and effective date, including qualifying F-1/J-1 students and family employees of sole proprietors. Record the human-reviewed legal basis and supporting document; citizenship or a generic exemption checkbox is not enough. Treaty treatment and its required forms remain separate from immigration eligibility.

**Acceptance.**
1. Preview otherwise comparable resident/nonresident-alien checks using the tax-year Pub 15-T adjustment, a qualifying F-1/J-1 FICA exemption and an eligible sole-proprietor family employee.
2. Compare each tax separately to official IRS rules, retain the basis and refuse an unsupported or expired exemption without applying a blanket exemption.

#### ENV-077 — IRS lock-in letters bind withholding

*Tier:* Core · *From:* ENV-006

**Requirement.** A matched IRS Letter 2800C/2808C is a binding worker-specific withholding instruction from its required date; later W-4s cannot reduce withholding below it without IRS authority, while permitted higher withholding remains available. ENV-025 receives and matches the letter; this clause applies it in every calculation.

**Acceptance.**
1. Apply a dated 2800C, attempt a lower-withholding W-4, then apply a valid modification/higher election: inspect required amounts, effective dates and audit without unauthorized override.

#### ENV-078 — Washington L&I and Oregon WBF in every paycheck

*Tier:* Core · *From:* ENV-006

**Requirement.** Calculate ENV-095's Washington L&I by assigned hourly risk-class rates and employee/employer shares, with actual class-allocation hours or the employer's consistently elected 160-hour monthly salaried method. Calculate Oregon WBF separately under ENV-096's own actual/assumed-hour and employee-cent-rounding rule; no wage-percentage substitute or imported Washington 160-hour assumption is permitted.

**Acceptance.**
1. Preview WA hourly hours split across two risk classes, a full-month salaried employee under the 160-hour election and the OR fractional-hour/monthly cases from ENV-095 and ENV-096; compare exact employee deductions, employer costs, stubs and filing totals against the official independent rule calculation.

#### ENV-008 — Approved hours and earnings from connected sources

*Tier:* Core · *Rules:* D-4

**Requirement.** Import approved hours, paid/unpaid leave codes, tips, commissions and job allocations from Lanyard, Deputy, Homebase, When I Work, 7shifts, QuickBooks Time and Clockify, POS data from Toast, Square and Clover, and earnings from the named sibling sources. Map person, company, period, jurisdiction and earning code; preserve source IDs, approval, versions, totals and file/API provenance. Clockify supports a reviewed export path as well as authorized API intake. Never pay the same source item twice; changed/unapproved sources create differences needing review. No connected timekeeping product is required to pay hourly people.

**Acceptance.**
1. Connect Lanyard plus Toast, import an approved week through the actual run intake door and reconcile hours/tips and pay codes.
2. Repeat each named adapter with its official edge schema or reviewed provider export; replay, map an unknown worker, edit the source after import and revoke source approval.
3. Show the exact affected run differences without overwriting its frozen version.

#### ENV-079 — In-run grid and spreadsheet earnings

*Tier:* Core · *From:* ENV-008 · *Rules:* D-5, D-6

**Requirement.** Provide an editable in-run grid for approved manual hours, workweek allocation, cash/charged tips, bonuses, commissions, other one-off earnings and paycheck reimbursements, plus CSV, XLS and XLSX upload using a published downloadable template and explicit column mapping. A blank cell leaves the current value unchanged; numeric zero explicitly replaces it with zero. Preview create/change/unchanged/refused cells before applying; identify worker, run, source row, code and workweek. Allocate overtime/regular-rate earnings to actual workweeks, never average a biweekly total. Preserve editor/file digest, row identity, before/after values and approval provenance; repeated uploads replace the same run items rather than appending duplicate pay. File corrections expose a diff and invalidate affected approvals under ENV-034. Intake also preserves actual covered hours, partial hours, risk-class splits and the reviewed state-specific assumed-hours election required by ENV-095 and ENV-096.

**Acceptance.**
1. Through the run page, type hours and cash tips for three people, add a bonus/reimbursement and upload each published CSV/XLS/XLSX template with one changed row, one blank preserved value and one explicit zero.
2. Inspect the exact preview and applied changes.
3. Upload two workweeks with unequal overtime and a nondiscretionary bonus, match the independent regular-rate result to the cent, re-upload identically with no double pay, then correct a row and inspect provenance, delta and invalidated approval.
4. Import two WA risk-class hour allocations and OR partial hours without rounding them into wage or generic hours totals.

#### ENV-080 — California meal and rest premiums

*Tier:* Core · *From:* ENV-008

**Requirement.** Import approved California meal- and rest-period premium codes from Lanyard/authorized time tools separately from worked hours, with incident/workday, approver and source identity. ENV-006 calculates applicable regular-rate treatment; premium pay cannot fabricate worked hours.

**Acceptance.**
1. Import approved meal/rest premiums with ordinary hours and a nondiscretionary bonus.
2. Inspect separate codes, official regular-rate premium amounts and no duplicate hours/pay on replay.

#### ENV-081 — Typed tip settlement at every intake

*Tier:* Core · *From:* ENV-008 · *Rules:* D-2, D-5

**Requirement.** Every actual tip entry in manual grid, CSV/XLS/XLSX templates, POS adapters and Lanyard intake has a required per-run settlement type: 'cash tips the worker already holds' (including card tips already paid out) or 'paycheck tips Envelope pays'. Preserve the source tip identity, settlement proof/mapping and typed amount. Card versus cash tender does not determine whether payroll owes the money. Missing or ambiguous settlement data needs source review rather than a silent payout default; this input problem is separate from a valid tip-tax shortfall.

**Acceptance.**
1. Through the grid, each spreadsheet format, Toast and Lanyard, enter $600 card tips already handed to one server and $300 tips owed through another server's paycheck.
2. Verify the former adds taxable/reportable tips but no second $600 payout, and the latter pays $300 exactly once.
3. Replay imports, change only the settlement type and inspect the diff and invalidated approval.
4. Refuse an untyped tip row as ambiguous input without blocking a fully typed statutory-shortfall run.

#### ENV-009 — Tips, tip credits and tip reporting codes

*Tier:* Core · *Rules:* D-2, D-4

**Requirement.** Accept declared cash/charged tips and approved tip-pool distributions from Lanyard/POS, distinguish voluntary tips from mandatory service charges, apply permitted tip credits and minimum-wage top-ups, collect required tip records, and report Form 8846 credit inputs. Preserve both qualified-tip/overtime analysis and the amounts required on the filing year's W-2. For 2026, TP is total cash tips reported to the employer, TT is qualified overtime compensation and Box 14b carries Treasury Tipped Occupation Codes; do not label all TP amounts tax-deductible or stop ordinary payroll taxes on tips. Apply the per-run settlement types in ENV-081: already-held tips are taxable/reportable but excluded from new cash payout; paycheck tips are paid once. Freeze both types and amounts under ENV-034 and show the actual cash the worker receives.

**Acceptance.**
1. Through intake, preview and year-end routes, pay a server below minimum cash-plus-tips, an approved pool, service charges and bonus-related overtime.
2. Match the top-up and tax treatment to official rules; validate 8846 inputs, TP/TT and occupation codes against final IRS/SSA schemas, including a worker with multiple tipped occupations and a correction.
3. Run the $600 already-held/$300 paycheck-tip fixture through grid and Toast intake, replay and compare exact new cash, taxes and no duplicate pay.

#### ENV-082 — Tip-tax shortfall paid on payday

*Tier:* Core · *From:* ENV-009 · *Rules:* D-2, D-6

**Requirement.** When employee funds are insufficient for tip taxes, apply IRS Publication 15's order: taxes on regular wages/other compensation first, Social Security and Medicare on tips next, income tax on tips last. Collect from available wages and record employee-furnished funds if actually offered and received, retaining receipt, allocation and running balance; an offer/promise is not collected money and cannot authorize an automatic bank debit. Track the statutory collection window through the 10th of the month after the month the employer received the employee's tip report (Pub 15 section 13), separately from the employee's monthly reporting deadline. At the window's end report remaining uncollected employee Social Security/Medicare using ENV-014/016, while retaining the full employer share owed. Uncollected income tax/Additional Medicare follow their own official rules and are never mislabeled W-2 codes A/B. A shortfall never holds, reverses or claws back wages, becomes a fabricated negative check or demands employee funding as a condition of payday. Publish the shortfall and collection deadline on the stub, register and worker portal; an otherwise valid run remains human-approvable.

**Acceptance.**
1. In a jurisdiction allowing the federal $2.13 tip-credit cash wage, enter 20 hours ($42.60 wages), $600 already-held tips and an effective W-4 with insufficient wage funds for all tip taxes.
2. Inspect the Pub 15 ordering, cent-exact collected/uncollected SS/Medicare, full employer share and shortfall on the preview/stub/register; approve and complete on payday, paying all cash due and issuing a truthful zero-cash statement if none remains, with no artificial zero-dollar transfer.
3. Compare full-tip 941 lines 5b/5c (5d where applicable), negative line 9 (944 line 6) and W-2 box 12 A/B against an independently calculated official-rule fixture.
4. Receive a tip report January 31, record actual employee funds February 9 and compare reduced shortage to a no-funds control; advance past February 10 and verify the collection-window/reporting transition without reversing wages.
5. A mere promised contribution does not reduce the balance; an excessive garnishment still blocks.

#### ENV-083 — Form 8027 and allocated tips

*Tier:* Core · *From:* ENV-009 · *Rules:* D-4

**Requirement.** For qualifying large food/beverage establishments, determine the official more-than-10-employee typical-day test and prepare per-location Form 8027 gross receipts, charged tips, reported tips and allocations below 8% of applicable receipts or an IRS-approved lower rate. Support hours-worked where eligible, gross-receipts and good-faith allocation methods with their official eligibility rules. Allocated tips are separate statutory reporting records, not fictitious already-received or paycheck tip entries: no payout or ordinary payroll withholding is created solely by an allocation; report W-2 box 8.

**Acceptance.**
1. Use two qualifying restaurant locations, one below the allocation threshold and one above, test an approved lower rate and each eligible allocation method, and validate per-location 8027 and W-2 box 8 to final IRS schemas without adding allocated tips to cash payout, reported-tip withholding or TP a second time.

#### ENV-010 — Pre-run checks and understandable preview

*Tier:* Core · *Rules:* D-1, D-2, D-5, D-6

**Requirement.** Show every person's gross, taxes, deductions, net, employer cost, bank destinations masked, total cash requirement and delta from the prior comparable run. Flag missing/duplicated hours, changed rates/accounts, unusually large/zero/negative checks, wage/overtime problems, exceeded contribution limits, missing accounts as remittance-only exceptions and stale HR/time data. Each blocker names affected people, money, evidence, owner and remedy; warnings require recorded acknowledgement and statutory/authority blockers cannot be waived into an invalid payment. Manual grid edits and spreadsheet uploads have the same delta/blocker checks as connected intake; preview names exactly which nonblank cells will replace existing values and which source/version currently owns each item. Show wage-payment blockers separately from deposit/filing blockers. Registration/TPA warnings list the held amount, deadline, known/projected lateness, estimated or unknown penalty exposure and responsible next action before approval; they never disable an otherwise correct funded human-approved wage run. Acknowledging exposure is not a waiver of tax duties or wage-payment deadlines. Identify ENV-082 uncollected tip taxes as a disclosed statutory shortfall with collection deadline, not a negative-net blocker. Preview separately lists already-held tips, paycheck tips, available wages, withholding order, uncollected employee taxes and actual payday cash. Only genuine errors such as unlawful deductions/garnishments or bad source data retain the applicable hold; the statutory tip shortfall neither disables approval nor requires an employer to fund employee taxes.

**Acceptance.**
1. Use the run review page and preview API with doubled hours, missing time, a changed rate and absent local account.
2. Inspect exact deltas and effect-specific holds: the absent local account holds its deposit/filing while approved worker pay proceeds on payday.
3. Resolve another calculation issue and recalculate; approval of the earlier preview is rejected.
4. Empty/loading/failed reads never look like zero-cost or completed payroll.
5. Approve a manually prepared run, preview a corrected spreadsheet, and prove that only the intended cells change and the original approval is unusable until the exact revised run is reviewed.
6. Preview a run with one missing tax account and one missing local grant, inspect exposure, approve/pay wages on payday and remit all other ready agencies; only the two affected remittances stay held, with their notices preserved after later activation.
7. Open the low-cash-wage server preview alongside an excessive-garnishment check: the typed-tip shortfall shows a warning with precise amount/deadline and remains approvable to payday completion, while the unlawful garnishment remains blocked.
8. Changing already-held tips to paycheck tips after approval rejects release until the revised cash requirement is human-approved.

#### ENV-012 — Off-cycle, correction and final pay

*Tier:* Core · *Rules:* D-5

**Requirement.** Run unlimited bonuses with applicable supplemental withholding, retro pay, gross-ups, manual checks, voids, legally permitted reversals, replacements and payroll adjustments without rewriting the settled original. Link corrections to affected deposits, returns, retirement and journals. Termination produces work-state final-pay deadlines and required accrued-vacation payout, including California same-day termination pay; missed ACH timing offers an authorized legal check/urgent path. Final-pay and paid-vacation rules are executed for every state and DC entry in the ENV-097 gating set, distinguishing discharge, resignation with/without required notice, worker class and documented lawful exceptions; California is one case, not the denominator.

**Acceptance.**
1. Through run and termination routes, issue a bonus, record a manual check, correct a settled check and terminate a California employee with accrued vacation.
2. Inspect the immediate deadline, payout, approved payment path, linked amendment and net year-to-date totals.
3. A reversal outside provider/legal limits refuses with a next action, and printing a check alone never marks it delivered.
4. Execute each final-pay rule/exception case in the ENV-097 gating set through the termination/final-run route with a controlled clock and inspect due date, payout and payment-path availability; any unmapped state rule fails this clause.

#### ENV-020 — Leave pay and payroll accruals

*Tier:* Core

**Requirement.** Pay PTO, holiday and state/local sick leave at the required rate using Willow's authoritative approved leave ledger, or maintain payroll-only accruals and balances when no HRIS is connected. Support accrual tiers, carryover/caps, paid/unpaid codes and required termination payout. Only one system owns a balance at a time; a source correction becomes a reconciled payroll/ledger adjustment.

**Acceptance.**
1. Import approved sick leave from Willow, preview/pay it, return consumption/balance and compare the pay stub.
2. Repeat without an HRIS using payroll accruals, an anniversary-tier change, year-end carryover and termination.
3. Replayed events or a switch of balance owner cannot double-accrue or double-deduct hours.

#### ENV-033 — Configurable pay items and reviewed bulk changes

*Tier:* Core · *Rules:* D-5, D-6

**Requirement.** Configure payroll groups, custom earnings and deduction codes, taxable treatment, recurring amounts and pay-rate effective dates. Preview bulk changes by person and first affected period with totals and eligibility, retaining approved versions and an undo/correction plan that never rewrites settled checks. A rate or deduction setup change is a person's decision in the product or, for an agent's call, the money class the company's policy decides; an agent never records a person's approval.

**Acceptance.**
1. Through payroll settings, add a taxable recurring allowance and nontaxable accountable reimbursement, prorate a mid-period salaried hire and preview a bulk rate change for one group.
2. Reject an invalid tax code or stale source version, apply only the human-reviewed set and inspect the correct first run and audit; undo before dispatch, and use a linked correction after settlement.

#### ENV-084 — Salaried proration by a chosen method

*Tier:* Core · *From:* ENV-033 · *Rules:* D-5, D-6

**Requirement.** Prorate salaried pay for hires, unpaid leave, rate changes and termination by a method a person chooses per company or pay group: calendar days, scheduled workdays or scheduled hours, versioned by effective date. An agent may propose a method; choosing one is a person's decision in the product or the money class the company's policy decides for an agent's call. Exempt proration follows FLSA salary-basis rules and the stricter work-state rule. A proportional amount applies only in the first and last week of employment. Unpaid-leave deductions apply only to whole scheduled workdays taken for permitted reasons, or to FMLA partial days. Any other reduction is a named hold. Non-exempt salaried pay prorates against hours worked and feeds ENV-006's regular rate. Round half-up once per worker per period. The stub shows the method, the counts and the rate. Termination meets ENV-012 final-pay deadlines. A later rate or date change becomes an ENV-012 linked retro adjustment. Prorated pay is payable only through ENV-034 exact approval and ENV-035 dispatch.

**Acceptance.**
1. A $10,000 monthly hire on 16 Jan 2026 previews $5,161.29 by calendar days and $5,000.00 by Monday-Friday workdays.
2. Each stub names its method.
3. An exempt employee's unpaid Saturday deducts nothing.
4. A personal partial day is held unless it is coded FMLA.
5. A mid-week California exempt termination pays a proportional final week on the same day.
6. A hire-date correction after settlement creates a linked adjustment.
7. Approving or releasing a calendar-day preview is refused, with zero external effects.

### Funding, payments and binding authority

#### ENV-004 — Verified direct deposit and protected bank changes

*Tier:* Core · *Rules:* D-5

**Requirement.** Split net pay among several verified accounts by amount/percentage with an explicit remainder account and effective date. Verify account details using Plaid Auth or approved provider verification/microdeposits; step-up identity, a disclosed cooling-off window and notice to the prior contact protect bank changes. The change binds its exact version under D-5; an agent's call that starts one carries the sensitive class and the gated account-holder step. Sensitive account changes cannot be authorized by a stolen notification link or an admin merely entering data, and the account holder's own step-up and verification is a gated step no agent credential performs. The default bank-change cooling-off window is 24 elapsed hours from completed verification, step-up and the change's authorization; dispatch to the changed destination is forbidden before all three requirements and that interval are satisfied. If the next run falls sooner, show a reviewed lawful check/alternate payday path without silently reverting to another account. Imported, unchanged previously used bank instructions follow ENV-100 verification and explicit carryover review; they are not mislabeled as newly changed accounts. New or edited imported instructions do incur the full 24-hour window.

**Acceptance.**
1. Through self-service, add two verified accounts, review their split and submit a change the day before payday.
2. Inspect the hold, step-up, old-contact notice and reviewed release/revised payday.
3. An unverified/replayed request cannot change an approved run's destination; ordinary verified accounts continue paying.
4. Use a controlled clock at 23 hours 59 minutes and at 24 hours after the approved/verified change: the first dispatch is held and the latter may proceed if otherwise authorized.
5. Exercise a near-payday change and an unchanged verified migration split, showing the former hold and latter eligible path without weakening identity verification.

#### ENV-011 — Approve, fund and pay on payday

*Tier:* Core · *Rules:* D-3, D-4, D-5 · *Register:* R-1

**Requirement.** Each run is released as one exact version, by a named approver in the product or by an agent's call under the company's policy (D-5), with configurable two-person thresholds and separation of preparer/approver where chosen. Originate the employer debit and worker ACH credits through authorized rails, offering standard/two-day, next-day and same-day processing subject to disclosed underwriting/cutoffs (ENV-086), and printable check stock/positive-pay handoff. Show funding, debit, credit, settlement and return status per payment. Closed-account/NSF returns expose actual codes, responsible owners and same-day correction/reissue action; reissue needs fresh review.

**Acceptance.**
1. Complete an approved run through the real public release route to provider sandbox or official schema edge, inspect matching employer debit and employee credits, settlement evidence and a paper check.
2. Return R02 and employer insufficient funds, repair and approve reissue without a second original payment.

#### ENV-085 — Over-limit funding by verified wire or prefund

*Tier:* Core · *From:* ENV-011 · *Rules:* D-3, D-5

**Requirement.** Show the actual employer/rail underwritten debit limit, run debit and excess before approval. An over-limit bonus/ordinary run offers the contracted rail's verified wire/prefund route, lawful destination instructions, deadline and received-funds evidence; changed fees/date/payload require fresh exact approval. Do not merely refuse payday or treat an uploaded wire receipt as settled funds. The service escalates before cutoff; wages still require real funding and human approval.

**Acceptance.**
1. Prepare a bonus above the provider limit, inspect limit/excess, select authorized wire/prefund, verify schema-edge bank/provider receipt and pay once by payday without submitting the over-limit ACH debit.
2. Reject unverified receipt/expired instructions and deduplicate funding callbacks, retaining any deadline risk and reviewed alternative.

#### ENV-086 — Rail speeds offered as granted

*Tier:* Core · *From:* ENV-011 · *Rules:* D-4, D-5, D-6

**Requirement.** Maintain a current, source-attributed employer/run eligibility decision for each contracted rail speed: standard, two-day, next-day and same-day. Read provider underwriting/account-standing/debit-history/age/amount/run-type decisions; expose eligible, pending, ineligible or suspended, the actual reason, allowed payday, fee and funding/approval cutoff before selection. An eligible permitted speed must be offered through both run review and the API, not merely described in documentation. No generic permanent standard-only fallback may hide a granted faster speed. Refresh eligibility before release; a revoked speed or changed fee/date/funding/cutoff invalidates affected pending approval and offers a truthful approved alternative. Provider eligibility cannot waive actual receipt, bank holidays, funding, human authority or payroll law. When the Gusto rail is used, exercise its documented four-day starting path, 15-day plus one successful standard debit two-day eligibility and independently granted next-day decision; other rails use their own official eligibility schema/rules. Same-day remains a tested granted/denied rail capability, not a promise every company/run qualifies.

**Acceptance.**
1. Through setup/run review and release API, feed the selected rail's official-schema eligibility events for standard, two-day, next-day and a qualifying same-day run.
2. For a Gusto-profile employer, day 14 or a failed debit does not unlock two-day; after day 15 and one settled successful standard debit, an affirmative eligibility response makes two-day selectable with its correct payday/cutoff.
3. An independently granted next-day decision offers next-day; a qualified same-day event offers same-day with its actual cutoff/fee.
4. Select each eligible speed, approve exact items and reconcile provider settlement/worker receipt for the promised payday at the network edge.
5. Denied, pending, revoked and out-of-order eligibility events cannot show a faster speed as available; suspension after approval refuses stale release, preserves deadlines and requires fresh review of a lawful alternative without duplicate effects.
6. Demonstrate actual granted options at 1440/390, not only a policy label.

#### ENV-013 — Contractor pay and information returns

*Tier:* Core · *Rules:* D-3, D-4

**Requirement.** Pay one-off and scheduled US contractors by approved ACH/check, track eligible NEC/MISC payment categories and year-to-date totals, manage W-9/TIN holds and backup-withholding cases, and file corrected/original 1099-NEC and 1099-MISC through IRS IRIS and required states with employee-equivalent portal delivery. Pantry AP payments stay in Pantry; shared payee identity and reviewed filing responsibility prevent duplicate reporting. An authorized admin can record contractor cash, check or other externally made payments for information-return reporting without originating another payment. Require paid date, payer/payee, amount, NEC/MISC category, evidence and explicit reporting ownership; reconcile Pantry/source IDs, already imported totals and duplicates. External historical payments change 1099 totals and audit, not bank instructions. Combined contractor annual forms after a Gusto switch inherit ENV-103's confirmed company/year-specific prior-provider year-end opt-out and filing ownership guard; a cancellation record alone is not authority for a duplicate original 1099.

**Acceptance.**
1. Pay a contractor, reconcile a second AP-paid amount as outside Envelope's filing ownership, then close the year through IRIS/state schema edges and retrieve the accepted form from the portal.
2. Exercise rejection/correction; no form is accepted without its corresponding acknowledgement.
3. Record a cash payment and outside check for a contractor, import the same evidence again and include the eligible amounts once on the January 1099.
4. Reconcile a Pantry-owned vendor amount as excluded from Envelope's filing ownership; observe no rail submission for any recorded historical payment.
5. Attempt the switched company's combined 1099 dispatch with missing, wrong-year and confirmed Gusto non-filing evidence.
6. Only the correct confirmed/approved case files once; already-filed prior evidence routes to reviewed correction, without holding current lawful contractor payments solely for annual filing coordination.

#### ENV-087 — International contractor payouts

*Tier:* Later · *From:* ENV-013 · *Rules:* D-3, D-4

**Requirement.** International contractors use a named licensed payment partner with disclosed countries, FX, fees, verification and payout states.

**Acceptance.**
1. Exercise a partner international payout/return; no payout is accepted without its corresponding acknowledgement.

#### ENV-034 — Approval binds an exact current transaction

*Tier:* Core · *Rules:* D-2, D-5, D-6

**Requirement.** An immutable run version binds payees, destinations, pay periods/dates, earnings, rules, deductions, tax obligations, debit totals, provider fees and the exact payment/filing items covered by human approval. Approval records actor, authority, time and reviewed content. Two-person policy cannot be satisfied twice by one person. Any material edit, source revision, revoked permission or provider recalculation invalidates affected pending approval before dispatch; a person's approval comes only from that person's signed-in session, so UI, API, MCP, copied tokens or background rules cannot record it for an agent. An authorized person may cancel a reviewed or submitted run before the provider's displayed irrevocability/cancellation deadline. Durably record the request and query/call the rail using its actual cancellation protocol. Show cancellation requested, confirmed canceled, too late and uncertain distinctly; only confirmed cancellation stops all cancellable run effects, and a new run needs fresh approval. A concurrency race with debit/filing dispatch is reconciled, never described as successful recall of an accepted irreversible effect. The immutable version also binds each tip's settlement type, actual employee-furnished tax funds, uncollected-tax computation and the state assessment rate/class/hours/election; a changed settlement type or a newly finalized FUTA rate is material and invalidates the affected pending approval.

**Acceptance.**
1. Through preview/approve/release routes, approve a run, change a pay rate, bank account, source hours, date and approver grant in separate cases, then attempt release concurrently with the edit.
2. Only the unchanged authorized version may reach the provider.
3. Attempt threshold bypass, self-second-approval, restored approval and agent approval and prove zero external effects.
4. Approve and submit a run, cancel before its rail deadline and require provider-confirmed cancellation with no later debit/credit/filing dispatch.
5. Race cancellation against the deadline/debit and lose the response; expose too-late/unknown status until reconciliation, without claiming funds recalled or resubmitting another payroll.
6. Approve a mixed cash/paycheck-tip run, then change only one tip's settlement flag or actual furnished funds and attempt release: the old approval cannot send the revised payout/taxes.
7. Change a WA risk class or publish the final FUTA year/state rate and require fresh approval of the affected items; unaffected approvals are retained.

#### ENV-035 — Real rails and uncertain effects reconciled safely

*Tier:* Core · *Cites:* BASE-OPS-003 · *Rules:* D-3, D-4

**Requirement.** Record durable intent and provider idempotency identity before any debit, credit, remittance or filing. Duplicate queues, concurrent release, crashes, duplicate/out-of-order callbacks and timeouts cannot create duplicate wages, tax deposits or signed filings. Query uncertain provider outcomes and retain unknown status with a named escalation; retry only with proof the action was not accepted or a provider-guaranteed idempotency key. Check's Payments API does not by itself cover all agency/garnishment remittances: explicit adapters/operations must close those gaps. Sponsor-bank/KYB, Nacha permissions, prefunding, debit-risk limits and agency enrollments remain required work. Debit-limit failures use ENV-085's genuine verified wire/prefund path. Durable intents reconcile partial/duplicate wires and attempted ACH before release; a limit refusal never silently substitutes another debit or disappears as a generic failed job.

**Acceptance.**
1. Use release, payment-status and filing APIs against official provider schemas; lose a response after acceptance, crash before local commit, replay events and deliver a return before an old success.
2. Restart and reconcile exactly one effect, visibly hold unresolved cases, and verify a schema/coverage matrix for all promised money/filing types.
3. No placeholder rail or generated receipt passes.
4. Race over-limit ACH refusal with confirmed prefunding, lose a callback and restart: reconcile received funds and release one current approved wage instruction; expose unused/double funding for reviewed refund without paying twice or claiming unreceived funds.

#### ENV-036 — Pay cards, urgent pay and reimbursement choice

*Tier:* Core · *Rules:* D-4

**Requirement.** Offer provider-issued payroll debit cards with lawful employee choice and fee disclosure, and eligible urgent off-cycle payouts using RTP/FedNow or the selected rail's actual instant-pay service, with an authorized check path where instant service is unavailable. Each advertised method requires a working named provider connection; disclose recipient eligibility before approval. Paycheck reimbursements carry tax classification and a Coaster/source ID; Coaster's own ACH remains its own payment unless the employer explicitly elects payroll and reconciles the handoff. Name Expensify as a reimbursement source alongside Coaster: ingest approved unpaid expenses through authorized supported API/documented export, map worker/tax treatment and original report/payment identity, and reconcile payroll-paid result. An expense paid directly by Expensify/Coaster or elsewhere cannot also become paycheck cash. Expense-export bank data never grants bank-election authority.

**Acceptance.**
1. Through payout settings and an off-cycle run, elect card pay without forcing it, inspect fees/consent, approve and reconcile a supported instant payout, and show unsupported-bank eligibility before committing.
2. Import the same reimbursement twice and a Coaster-already-paid item; only the elected unpaid item reaches one paycheck, with a balanced journal.
3. Import an approved unpaid Expensify reimbursement and an already-direct-paid item; elect payroll for the former and reconcile one paycheck/journal result to its report.
4. Re-import/update: no double payment, the paid item stays excluded and a stale source invalidates approval.

#### ENV-088 — Earned-wage access through a contracted partner

*Tier:* Later · *From:* ENV-036 · *Rules:* D-4

**Requirement.** Offer elected earned-wage access through a contracted partner, separately from employer payroll/instant settlement. Disclose the actual partner, employee consent, advance/fee terms and repayment method; only verified earned amounts are eligible. Reconcile advances and lawful authorized recoupment once against payday, deductions/limits and final pay, with a no-advance payroll path. Never label a loan/advance a settled wage; an agent never consents to employee borrowing for the employee, because the consent is the employee's own.

**Acceptance.**
1. At the official partner-schema edge request an employee-authorized eligible earned-wage advance, then pay the scheduled run and reconcile exactly one lawful recoupment.
2. Repeat the event, correct earned hours downward and terminate employment; unsupported/excess recoupment is held for human resolution, no double deduction occurs, and the ordinary no-advance paycheck still works.

### Taxes, deductions and proof of completion

#### ENV-002 — State and local registration agent

*Tier:* Core · *Rules:* D-1, D-3, D-4, D-5

**Requirement.** A new hire, move or work allocation in a new jurisdiction creates a cited registration task. Prepare withholding/SUI/local/PFML registrations, required authorizations and agency submissions; a person approves or signs them in the product, and for an agent's submission the company's policy decides (gated where the agency requires the employer's named signer); track queries and agency-issued identifiers/rates into ENV-001's register. An agent may carry follow-up through to issuance; each submission it makes carries the accounts and commitment classes. Pending/missing withholding or SUI numbers hold only that agency's deposit and filing, never net pay (D-1); retain withheld/employer amounts in a deadline-dated liability and escalate under ENV-046. Before approval show agency, tax/period, amount, due date, projected lateness where knowable and official penalty-exposure basis, with uncertainty explicit. On agency-confirmed issuance, review the assigned rate/effective-date true-up and obtain changed-amount/signature approval under ENV-034; release exactly one deposit intent and one filing intent per held jurisdiction/period obligation, including late-period returns. Legally distinct periods remain distinct obligations. Replayed issuance or model-generated accounts cannot release or duplicate remittance. Preserve provisional/issued rates, true-up, lateness and ENV-049 causation; wage corrections require actual legal necessity and an exact authorized version (D-5).

**Acceptance.**
1. Hire remotely in a new state through onboarding, review/sign its registration and submit to an official agency schema edge.
2. Exercise pending, request-for-information, rejected and issued outcomes, paying the worker on payday throughout missing-account cases.
3. Inspect correct withholding/new-employer SUI on preview/stub and the held liability, due date and preapproval exposure notice.
4. Attach the issued number/rate, approve the true-up and release exactly one deposit and filing per held period; replay issuance, restart and submit a model-generated number to prove no duplicate/fabricated release.
5. Historical rate/liability/lateness differences remain visible without re-paying net wages.

#### ENV-014 — Federal deposits and employment returns

*Tier:* Core · *Rules:* D-2, D-3, D-4, D-5 · *Register:* R-2

**Requirement.** Act under signed reporting-agent authority including Form 8655; calculate and remit scheduled federal deposits through EFTPS or authorized rail, including monthly/semiweekly lookback and next-day $100,000 rule. Prepare, human-approve, file and reconcile 941 with Schedule B, 940, assigned 944 and 941-X amendments; ENV-031 adds agricultural 943. Record liabilities separately from deposits and adjustments, agency deadlines, submission/acceptance/payment acknowledgements and correction responsibility. Apply an elected qualified-small-business research payroll-tax credit under ENV-067, including source Form 6765, Form 8974 attached to the applicable employment return, permitted deposit reductions and unused carryforward. An accepted credit is not a discretionary reduction of employee withholding. For tip shortfalls retain full reported tips on 941 lines 5b/5c and applicable 5d, and the negative uncollected-employee-SS/Medicare adjustment on line 9 (944 line 6), with supporting statement and actual collections; the employer share is still due.

**Acceptance.**
1. Through tax calendar, approval and filing routes, run a quarter crossing the next-day trigger, prepare 941/Schedule B and annual 940, and an assigned 944 company.
2. Match returns to register/deposits at the cent; inject rejected filing and failed deposit at official schemas, repair with reviewed amendments, and inspect EFTPS/IRS confirmations.
3. Missing/expired 8655 refuses submission.
4. File an approved 941 with its 8974 through the tax door using ENV-067's two-quarter credit fixture; compare the credit/deposit/return lines and acknowledgements and preserve the unused balance.
5. Through tax preparation/file/download doors close the ENV-082 insufficient-wage case: reconcile full tips, collected taxes, negative 941 line 9/944 line 6 and employer share with the W-2 A/B output to the cent.

#### ENV-089 — FUTA credit reduction on Schedule A

*Tier:* Core · *From:* ENV-014 · *Rules:* D-4, D-5

**Requirement.** Prepare year-and-state-specific FUTA credit reductions on Form 940 Schedule A and carry its total to line 11. Source final annual reductions and applicable benefit-cost-ratio (BCR) add-ons, other statutory add-ons and waivers from DOL's November determination, reconciled to that year's IRS Schedule A. Keep potential/forecast rates visibly provisional until final; do not treat a potential BCR add-on as due after an effective waiver or reuse another year's final rate. Credit reduction is employer liability attributed to Q4, with the additional deposit/payment deadline and $500 deposit-threshold treatment from that year's Form 940 instructions; never deduct it from workers. Show the increased cash requirement and exact filing/deposit items for human approval, with separate submission/acceptance/payment evidence. A late source change recalculates affected pending items and invalidates their earlier approval, preserving historical filed editions and amendment responsibility.

**Acceptance.**
1. For tax year 2025 use the official California 1.2% Schedule A reduction: three employees at $20,000 each, $21,000 combined FUTA-taxable wages, produce $252 additional FUTA on Schedule A/940 line 11 as Q4 liability.
2. Repeat with ten fully taxable $7,000 bases, producing $840 extra and a timely required Q4 deposit at the official date, never worker withholding.
3. Inject a DOL November potential-to-final source change with distinct BCR imposed/waived official-schema cases, assert the correct state/year combined rate, invalidated pending approval, one authorized payment/filing and retained prior-year reproduction; an as-yet-unpublished 2026 final notice cannot be labeled final on 20 October.

#### ENV-015 — State, local, paid-leave and disability filings

*Tier:* Core · *Rules:* D-1, D-3, D-4, D-5 · *Register:* R-2

**Requirement.** Remit withholding, SUI and required PFML/disability contributions, file wage detail, periodic returns and annual reconciliations for all active state/DC/local accounts. Cover CA SDI, NY PFL, NJ, WA, MA, CO FAMLI, OR, CT, MN and other applicable programs with effective rules and separate employer/employee shares. The register/calendar shows due, prepared, approved, submitted, agency accepted, paid, rejected, overdue and unresolved distinctly; human approval covers each signed filing/payment. Filing and remittance schema cases are required for every entry in the ENV-097 gating set, including Oregon statewide/TriMet/Lane transit taxes, Denver OPT, Portland Metro SHS, Multnomah PFA and WA Cares alongside PFML, and for ENV-099 long-tail entries once mapped; an unmapped location blocks under ENV-066. An absent adapter or unimplemented gating authority is a failing target entry rather than an excluded supported subset. The gating set expressly covers Kansas City/St. Louis earnings taxes and separate employer payroll taxes, Ohio school-district tax, Alabama occupational taxes, Colorado OPT jurisdictions, Wilmington wage tax, Newark employer payroll tax and West Virginia wage-linked municipal fees where its large-local file lists them. Pending agency numbers/grants hold only their liabilities/returns under ENV-002; wages and ready agencies proceed.

**Acceptance.**
1. Use the public tax workspace for a company spanning these programs and representative local returns, validate official agency schemas and reconcile their wage/amount totals to payroll.
2. Exercise a SUI rate amendment, agency rejection, partial payment and out-of-order receipt; each account/period retains its true state, evidence and repair deadline.
3. Acceptance requires 100% of the ENV-097 gating set's calculation and filing-schema cases: generate the source-derived matrix and run each applicable calculation, deposit/return schema and effective-boundary case through public payroll/tax doors; the check fails on any uncovered gating entry.
4. Exercise the added local tax systems against official rule/form schemas, including Kansas City, both St. Louis taxes, an Ohio school district, Birmingham and Greenwood Village.
5. Omit one account/grant, pay wages and ready agencies, then confirm authority and release one reviewed true-up deposit/filing per held obligation.

#### ENV-090 — State-fund and assessment reports and payments

*Tier:* Core · *From:* ENV-015 · *Rules:* D-3, D-4, D-6

**Requirement.** State payroll assessments and mandatory state-fund premiums are included even when an agency does not call them taxes: file/pay WA L&I quarterly hours/premiums (including required zero-hours reports), Oregon WBF on the combined payroll report, and the Ohio BWC, North Dakota WSI and Wyoming DWS reports/payments enumerated in ENV-021 and ENV-098. Retain period, class/hours/rate edition, employee/employer split, due date, reviewed authority, agency acceptance, paid amount and amendment history. ENV-002's remittance-only treatment applies to missing agency accounts/grants; it never delays the wage run.

**Acceptance.**
1. From the public tax workspace file the WA hourly/two-class plus 160-hour-month salaried cases, a zero-hours WA quarter and the OR WBF combined report, using official agency file/portal schemas at the edge.
2. Compare all hours, employee deductions, employer shares and liabilities to the payroll register at the cent; reject and correct one report, reconcile accepted receipts/payments without duplicate remittance.
3. Exercise Ohio, ND and WY payroll-report edges at their source-derived schedules, plus a documented lawful not-applicable case that cannot be selected by merely connecting a private policy.

#### ENV-016 — Year-end W-2, W-3 and corrections

*Tier:* Core · *Rules:* D-2, D-3, D-4 · *Register:* R-2

**Requirement.** Generate employee copies and SSA EFW2/W-3 totals using final year-specific rules, including 2026 TT/TP and Box 14b, employer/third-party sick pay, retirement/benefit codes and applicable successor treatment. Submit SSA and state wage files under approved authority, support electronic-delivery consent, paper delivery tracking, W-2c/EFW2C corrections and access after termination. Delivery consent and filing authority are separate. For uncollected employee Social Security and Medicare on tips use W-2 box 12 codes A and B respectively, with the matching quarterly/annual adjustment under ENV-014; boxes 4/6 contain actual collected tax, never an amount only owed. Keep uncollected income/Additional Medicare separate under current instructions. Report Form 8027 allocated tips in box 8 separately from wages/tips actually reported and TP; retain the allocation and source-location history without creating pay or ordinary withholding solely from allocation. Combined W-2 dispatch after a Gusto switch requires ENV-103's confirmed company/year prior-provider annual non-filing election, complete combined totals and human filing approval. Unconfirmed or conflicting opt-out holds the affected form submission with deadline/escalation, not wages; a previously filed original requires coordinated correction rather than another original.

**Acceptance.**
1. Close a mixed-worker year through year-end routes, reconcile W-3 to wages/taxes and quarters, validate EFW2 and each state file and process accepted/rejected acknowledgements.
2. Deliver consented electronic and required paper copies, correct overtime/tips via W-2c and inspect both original/correction histories.
3. A missing consent or SSA rejection remains an open obligation rather than a completed year-end.
4. Close the ENV-082 server year with and without actual timely furnished funds, compare W-2 codes A/B and boxes 4/6 with register collections and 941/944 adjustments, then correct one furnished-funds receipt through reviewed correction routes.
5. Validate the two-location 8027 allocation case's box 8 and electronic wage-file fields; allocated reporting alone cannot increase net pay, reported tips or tax withheld.
6. At year-end attempt combined W-2 filing with an unconfirmed Gusto opt-out, then confirm the correct company/year election and approve.
7. Assert zero dispatch before confirmation and one accepted submission after it, with payroll still payable throughout.
8. A prior-filed original or wrong-year evidence cannot release a duplicate original.

#### ENV-071 — SSA name and SSN verification for accurate wage reports

*Tier:* Later · *Rules:* D-4

**Requirement.** Offer authorized SSA SSNVS matching of hired/current employees' name/SSN records for wage-reporting accuracy before W-2 filing, with required employer/submitter registration, batch/result provenance, masked identifiers and owner-reviewed correction tasks. An agent may prepare/upload a scoped batch and reconcile responses under the employer's authorized wage-reporting mandate; changing a worker's identity is a sensitive call, and no call infers work authorization or decides employment. SSNVS is not used for pre-hire screening, not a replacement for I-9, and a mismatch alone does not stop wages or justify adverse action. Keep the filing deadline and permitted accurate filing/correction path explicit while a mismatch is resolved.

**Acceptance.**
1. Through year-end identity verification select hired employees, send an authorized official SSNVS-format batch and reconcile one match, name mismatch and agency-unavailable result.
2. Inspect masked source-linked cases, human-reviewed correction and later verification/W-2c if needed; a pre-hire record or foreign-company credential is refused, a mismatch never changes pay/employment automatically, and an unavailable lookup cannot fabricate a verified SSN or hide the year-end deadline.

#### ENV-018 — Garnishments, levies and remittances

*Tier:* Core · *Rules:* D-3, D-5

**Requirement.** Receive e-IWO child-support orders and agency/employee updates, IRS 668-W levies, state levies, creditor and applicable student-loan orders. A named human verifies and approves setup/changes, effective dates, payee and priority. Calculate disposable earnings, CCPA/state limits, exempt amounts, priority, arrears, allowed employer fees and stops; remit to the correct state unit/creditor with references and reconcile withholding to remittance. Manage issuing-agency employer duties beyond withholding: required termination/no-longer-employed replies, changed employment/pay frequency responses and state-required lump-sum/bonus reporting before payment when applicable. Track form, deadline, authorized response and agency confirmation, without treating termination as cancellation of arrears.

**Acceptance.**
1. Through deduction/order intake, process concurrent child support and creditor orders, then add a levy and changed dependent/exemption facts.
2. Match official limits/priority, inspect capped deductions and remaining arrears, approve/remit and retain unit acknowledgements.
3. Duplicate orders, stale changes and a rejected remittance cannot double-withhold or appear paid.
4. Terminate a worker with an active child-support order and prepare the official employer response; approve/send and inspect the acknowledgement.
5. Run a state-required lump-sum reporting scenario before a bonus, keep the pay hold/deadline visible, and verify an order/payee change cannot self-approve.

#### ENV-019 — Pre-tax deductions, retirement and state savings

*Tier:* Core · *Rules:* D-4

**Requirement.** Apply reviewed Section 125 health premiums, HSA/FSA, pretax/Roth 401(k), SIMPLE IRA, catch-up and employer-match rules, including annual limits, applicable age/income treatment and plan effective dates. Reconcile elections, per-run contributions, employer match, census and corrections with Guideline, Human Interest, Vestwell, Betterment at Work and Ubiquity. Determine and manage applicable auto-IRA registrations/exemptions and contributions for CalSavers, OregonSaves, Illinois Secure Choice and other mandated programs. Enrollment/plan advice belongs to Willow/recordkeepers; payroll must remit and prove acceptance.

**Acceptance.**
1. Through deductions and recordkeeper connections, change an election, cross an annual limit, process catch-up/match and a corrected prior run, then reconcile accepted contribution files/funds at each named provider's official edge.
2. Register a California employer without an exempt plan and process an opt-out; unapproved setup or rejected contributions remain held/open with due dates.

#### ENV-091 — Commuter, dependent-care and HRA reimbursement treatment

*Tier:* Core · *From:* ENV-019

**Requirement.** Include Section 132(f) transit/vanpool and qualified parking as separate monthly-limit categories, dependent-care FSA with its effective-year and filing-status limits, and applicable commuter-benefit ordinance participation including NYC, San Francisco, Seattle, DC and NJ. For 2026 the federal transit/vanpool exclusion and parking exclusion are each $340 monthly under Pub 15-B. Support payroll treatment/reconciliation of QSEHRA and ICHRA reimbursements from the benefits administrator: QSEHRA permitted benefit is reported with W-2 Box 12 FF; do not incorrectly report ICHRA as FF. Eligibility, substantiation, combined limits and required ACA reporting remain tied to the actual arrangement and official year-specific rules.

**Acceptance.**
1. Cross transit and parking monthly caps independently, apply a dependent-care election near its annual limit, and import QSEHRA/ICHRA administrator records.
2. Compare taxable excess, deductions, reimbursements and the year-end FF/other applicable fields to official IRS rules; the two arrangements cannot share an incorrect reporting code or double-reimburse a claim.

#### ENV-092 — 403(b), 457(b) and SEP contributions

*Tier:* Later · *From:* ENV-019 · *Rules:* D-4

**Requirement.** Name traditional/Roth 403(b), applicable governmental/nongovernmental 457(b), and SEP employer contributions with actual plan eligibility, annual/combined limits and catch-up rules, including 403(b) 15-years-of-service catch-up, age catch-up and 457(b) special catch-up ordering/exclusions. SEP employer contributions are not ordinary elective deferrals. Use official year-specific W-2 codes E for traditional 403(b), BB for Roth 403(b), G for applicable 457(b) and EE for designated Roth governmental 457(b); SEP reporting follows its actual arrangement, never an invented common code.

**Acceptance.**
1. Exercise a qualifying nonprofit's 403(b) 15-year/age catch-up ordering and traditional/Roth split, applicable 457(b) catch-up and SEP employer contribution.
2. Cross each annual/combined limit, reconcile provider receipt and compare E/BB/G/EE or appropriate SEP treatment to IRS instructions; custom codes cannot bypass limits or apply another plan's catch-up.

#### ENV-093 — Hawaii TDI and Prepaid Health Care employee shares

*Tier:* Core · *From:* ENV-019

**Requirement.** For Hawaii TDI and Prepaid Health Care, import the approved actual plan, premium/rate, eligibility and documented waiver from Willow/authorized benefits administrator or insurer. Cap TDI employee share at the lawful cost share, 0.5% of weekly wages and the official year's maximum weekly deduction; the employer may cover all cost. Cap the PHC employee share at the lesser of 50% of premium and 1.5% of monthly gross earnings, with required employer/dependent shares determined by the approved plan type; retain annually required HC-5 waiver evidence where applicable. A generic percentage deduction cannot evade these ceilings or substitute for a valid plan.

**Acceptance.**
1. Import approved HI TDI/PHC plans and premium evidence, preview low/high weekly wages and multiple pay periods in one month and compare cumulative lawful capped employee and employer shares to official DLIR rules.
2. Attempt an above-cap deduction, expired HC-5 waiver and missing plan: require correction/owned evidence without inventing coverage; inspect corrected stubs, remittance and year/effective-rule history.

#### ENV-094 — New York DBL plan contributions

*Tier:* Core · *From:* ENV-019 · *Rules:* D-4

**Requirement.** Beside Hawaii TDI, support New York DBL as an actual approved plan/carrier obligation, separate from NY PFL. For a statutory DBL plan the employer may pay all costs or collect up to 0.5% of wages, capped at $0.60 per week; retain weekly allocation across payroll frequencies and prevent contributions exceeding the actual plan premium/cost to be offset. Reconcile the actual carrier invoice, employer balance and any necessary capped collection/refund rather than routing DBL as tax-agency withholding. Pay the authorized private carrier or NYSIF as the insurer, or honor evidenced Board-approved self-insurance under its actual plan/custody rules. On an employee's documented multi-employer adjustment request, use verified supplied earnings to proportion contributions so their statutory-plan combined total does not exceed $0.60/week; do not browse another employer tenant. An enhanced plan exceeding statutory contributions requires the actual accepted plan, lawful agreement and human-reviewed legal basis; a custom deduction cannot bypass the cap. Carry plan, rates/elections, prior weekly/cumulative collection and recipient into a midyear switch.

**Acceptance.**
1. Through benefits setup/preview/remittance doors import a statutory NY DBL plan from the carrier/Willow source.
2. A $100 wage week collects at most $0.50; $200 at most $0.60; a biweekly run with two $200 weeks collects at most $1.20, while two same-week checks share one $0.60 cap.
3. If only $0.25 of actual attributable premium remains to be offset, collect no more than $0.25 and reconcile employer funding/carrier receipt, never a tax-agency deposit.
4. Record an employee request and verified $200/$100 concurrent weekly earnings: $0.40/$0.20 shares total $0.60, without disclosing another company's payroll.
5. Switch midweek with $0.40 already collected and cap the new statutory collection at the remaining $0.20.
6. An unsupported above-cap enhanced-plan election is refused until actual accepted-plan/agreement evidence is reviewed; keep DBL and PFL deductions/recipients separately inspectable.

#### ENV-069 — Unemployment claim response and agency follow-through

*Tier:* Core · *Rules:* D-4, D-6 · *Register:* R-2

**Requirement.** Receive and answer unemployment separation/wage requests through NASWA UI SIDES/E-Response or the responsible state's authorized portal, with employer/third-party mandate, agency deadline, payroll history and Willow-supplied reviewed separation facts. Prepare a cited response for an authorized human to approve/sign, attach permitted evidence, submit once, track acceptance/requests for more information and hand disputed/legal determinations to the named employer representative. This is payroll-linked SUI claim administration, not a new HRIS or legal adjudicator.

**Acceptance.**
1. Import an official SIDES separation request through the public claims door, match worker/payroll and approved Willow facts, review/sign and submit at the official state/provider schema edge.
2. Inspect timely receipt and follow-up, reject a mismatched EIN and replay request/callback without duplicate disclosure.
3. Missing separation evidence or a disputed assertion holds the draft for the human representative and escalates before the actual deadline.

#### ENV-021 — Workers compensation from actual payroll

*Tier:* Core · *Rules:* D-3, D-4

**Requirement.** Report approved/paid payroll per worker, work state and class code to NEXT, AP Intego, Pie and The Hartford pay-as-you-go channels; manage policy connection, exclusions and corrections with carrier evidence. Show estimated premium, provider acceptance, debit/settlement where applicable and payroll-audit exports separately; policy underwriting and coverage issuance remain the insurer's. In monopolistic states the state fund is the required carrier where the employer/worker is subject: include Washington L&I (ENV-095), Ohio BWC, North Dakota WSI and Wyoming DWS with official account/rate notices, class allocation, authorized report/payment channels and source-derived periodic payroll reporting/true-ups. Only a documented legally valid exemption, reciprocity determination or state-certified self-insurance arrangement can replace a mandatory fund; a private carrier connection alone cannot do so. Handle other officially required exposure units such as drywall area under the same coverage obligation instead of excluding them because a vendor does. Carrier underwriting, medical claims and coverage issuance remain with the fund/insurer, while payroll owns the complete calculation, reporting and remittance job.

**Acceptance.**
1. Connect each named provider using its official exchange/schema, allocate a worker across class codes, run payroll and reconcile the carrier report and response.
2. Correct wages and exercise a rejected class/policy, keeping the premium/report issue assigned without changing original net pay or claiming coverage from a successful upload.
3. Report Ohio BWC annual actual-payroll true-up, ND WSI payroll and WY DWS wage/class reporting at each official edge, with acknowledged amounts and a cited lawful applicability/exemption boundary; no private-carrier success can satisfy a required fund case.

#### ENV-095 — Washington L&I hourly premiums

*Tier:* Core · *From:* ENV-021 · *Rules:* D-4

**Requirement.** Washington uses hourly premiums by risk class, with the rate notice's total and permitted employee withholding split and employer remainder. Track actual class-allocation hours and eligible alternative exposure units; salaried staff use either actual hours or the employer-wide 160 hours/month election (480 for a full three-month quarter), consistently for all salaried staff under WAC 296-17-31021. Quarter reports include required zero hours.

**Acceptance.**
1. Through setup, preview and compensation/tax reporting doors use official WA notices for an hourly employee split across two classes and a salaried employee with the consistent 160/month election.
2. Assert employee withholding, employer remainder, 480 quarterly salaried hours and accepted quarterly report/payment to the cent; a mixed actual/160 salaried election is refused until consistently reviewed.
3. File a required zero-hours quarter.
4. A WA employer with only a connected private policy fails full activation; test state-certified self-insurance using actual official authority rather than a generic exemption switch.

#### ENV-096 — Oregon Workers' Benefit Fund assessment

*Tier:* Core · *From:* ENV-021 · *Rules:* D-4

**Requirement.** Oregon WBF is a separate assessment, not a private-policy premium: for 2026 total rate is 1.8 cents per hour/partial hour, employee half rounded each pay period to the nearest cent with half-cent upward, employer amount equal to retained employee total. Use actual hours; if not tracked, use a documented reasonable/contract method or the rule's flat 40 hours/week for weekly/biweekly and 173.33 hours/month for monthly/semimonthly pay, never WA's 160-hour rule. Retain the employer's assumption/method and report/remit with Oregon combined payroll.

**Acceptance.**
1. For OR 2026 test 10.5 and 10.6 actual hours in separate pay periods: employee/employer shares are $0.09/$0.09 and $0.10/$0.10 respectively.
2. A monthly 173.33-hour flat-method case yields $1.56 each, $3.12 total; inspect the combined report and prohibit a copied 160-hour WA default.

#### ENV-025 — Tax notices owned through resolution

*Tier:* Core · *Rules:* D-3, D-5, D-6

**Requirement.** Accept uploads, scans, dedicated authorized email and agency-feed notices; preserve original, extraction provenance, agency, EIN, period, deadline, owner and amounts. An agent classifies and matches notices to accounts, rates, filings/deposits and prior responses, drafts explanations or amendments and tracks correspondence/escalation to closure. Every rate change, signed response, filing and payment that follows carries its money, commitment or external class and the exact authority of D-5; a notice review approves none of them. Resolved means agency-supported disposition and remaining liability/penalty balance, not merely sent; retain claimed versus actually abated penalties separately. Treat matched IRS 2800C lock-in and authenticated modification/release as binding worker-specific withholding instructions (ENV-077), not speculative notices. Record required settings/effective dates, prepare its implementation before the deadline as an exact version under D-5, refuse incompatible lower-withholding W-4 changes and retain allowed higher elections. Escalate missing approval/identity facts urgently for a lawful reviewed paycheck; agent text never creates a lock-in. Closure reports remain unresolved until supported by agency disposition and actual remaining liability and penalty evidence; casework is separately grantable to authorized staff under ENV-028 (RL-6).

**Acceptance.**
1. Through notice intake, ingest an SUI rate letter and an IRS mismatched-deposit notice, review/apply the rate, attach deposit proof, approve a reply and process agency closure.
2. Inject an OCR error, wrong EIN, missed response and reopened case; the agent cites sources and escalates without changing pay or falsely reporting $0 owed.
3. Upload a genuine-format 2800C, match its worker, approve the effective instruction and apply it to the first required check.
4. Attempt a conflicting lower W-4, a permitted higher election and a valid IRS modification/release; inspect decisions and the immutable source/actor/date history.

#### ENV-066 — Coverage ledger and fail-closed location rule

*Tier:* Core · *Rules:* D-6 · *Register:* R-5

**Requirement.** Coverage is all 50 states and DC, independently of the implementation. Envelope keeps a versioned, exportable coverage ledger of every payroll tax authority it knows, drawn from official jurisdiction lists and published rules, each entry with source references, retrieved-at and effective dates, and its calculation and filing cases. Use Federation of Tax Administrators tax-agency links, NASWA/state workforce-agency links, federal OCSS State New Hire Reporting Contacts and Program Information, and DOL State Labor Offices to locate each responsible agency; directories locate authorities, while final rates/deadlines/content come from that authority's current statute/instructions. The local ledger draws on the PA DCED PSD/EIT/LST register (and Philadelphia's separate official wage-tax rules), Ohio DOR municipal list/The Finder reconciled against RITA, CCA and each self-administered city, Indiana DOR county rates, Michigan Treasury's city list and each city's rules, and Kentucky DOR/Business One Stop referrals plus DLG county/city/special-district and relevant school-district lists checked against each authority's occupational-tax ordinance. A missing statewide Kentucky rate file is not permission to omit a local authority. Local payroll coverage is a closed, dated, source-reconciled set. Each officially discovered tax/fee maps to an active golden/schema case or cited not-applicable/repealed/future determination with boundary tests. Unknown, unmapped or conflicting entries fail completeness. A work or resident location that matches no mapped ledger entry blocks payroll for that employee; it is never treated as zero tax, and later-discovered local wage taxes join as unmapped blockers rather than falling outside scope. Each entry is in the gating set (ENV-097 and ENV-098) or the tracked long tail (ENV-099). The source list, method and vintages are published in [docs/contract/large-local/](docs/contract/large-local/envelope-large-local.md).

**Acceptance.**
1. Through the public compliance coverage/export and preview/filing/termination/stub doors generate the ledger from dated official source snapshots and reconcile every identifier in each named register.
2. The export lists every entry with authority, source URL, retrieved-at date, effective date, status (mapped, unmapped, not applicable) and case ids; each applicable mapped entry has a cent-level golden paycheck case and, where filing or remittance applies, an official-schema case, and each cited none or exemption has a cited rule and a refusal or applicability test.
3. An employee whose work or resident location has no mapped entry is held in the preview with the location and the reason, and the run refuses that employee with a next action (assign a location, or mark it unsupported); no paycheck shows zero tax for it.
4. Add a source-list entry/effective rule and require an unmapped blocker until its case passes; a cited no-tax state remains present with its applicability test, not dropped from the denominator.
5. Add a newly enacted official local tax: it appears as unmapped and blocks affected employees until mapped.
6. An unverified ordinance or unsupported adapter cannot pass as an empty/reduced denominator.
7. A refresh runs before a rule's effective date, and superseded source editions stay retrievable.
8. Generate/export the official-source union matrix through the compliance door and reconcile every source tax ID, district and boundary/period mapping.

#### ENV-097 — Gating coverage: federal, all states, DC and large locals

*Tier:* Core · *From:* ENV-066 · *Rules:* D-4

**Requirement.** ENV-006, ENV-012, ENV-015, ENV-017 and ENV-022 are judged against the gating set: federal; all 50 states and DC with every state-level entry (ENV-098); the large-local file, the versioned list of local income-tax jurisdictions that together cover at least 80% of US local-tax employee-jurisdiction pairs (688 at the October 2026 baseline, regenerated by the published script in [docs/contract/large-local/](docs/contract/large-local/envelope-large-local.md)); and the named employer-only local taxes listed beside it. Include Oregon statewide transit and TriMet/Lane payroll taxes, Portland Metro SHS, Multnomah PFA, Denver OPT, NYC/Yonkers and WA Cares alongside WA PFML, plus any other payroll tax imposed by the gating authorities. The set explicitly adds Kansas City Revenue Division earnings withholding; St. Louis Collector of Revenue earnings withholding AND employer payroll-expense tax; Ohio DOR school-district residence tax with the district-rate register and SD-100/SD-101 instructions, separate from municipalities; Alabama municipal/county occupational taxes from ALDOR local-jurisdiction information and each locality's ordinance, including Birmingham; Colorado city OPT ordinances, including Greenwood Village; Wilmington DE wage tax; Newark NJ employer payroll tax; and West Virginia municipal wage/service-fee ordinances, including Charleston/Huntington. ALDOR's administered local-tax list is not presumed exhaustive for self-administered occupational taxes. Each case retains work/residence boundary, employee/employer incidence, credits/exemptions and effective dates. Passing those five clauses never requires the long tail.

**Acceptance.**
1. Every entry in the large-local file has a golden case and, where filing applies, a schema case, with its work or residence boundary, incidence, credits and exemptions.
2. Execute all applicable golden, schema, deadline and statement-content cases; report total, passing and uncovered entries with source references.
3. Require cent-level golden paychecks and official deposit/return-schema cases for Kansas City, both St. Louis taxes, an Ohio school district, Birmingham, Greenwood Village, Wilmington, Newark and a West Virginia city fee.
4. Each named employer-only local tax has a case showing employer cost and no employee deduction.
5. A deliberately removed gating-set Ohio self-administered city, PA PSD, KY local authority, state new-hire directory or NY stub requirement must fail completeness; removing St. Louis or the Ohio school-district register fails completeness by name.
6. The export marks each entry gating or long tail and carries the large-local file's vintage (Census table, year, URL).
7. Rerunning the script on newer vintages yields a new file; added and removed entries show in the export, and an added entry is unmapped until cased.
8. A gating entry without a case fails this clause; an entry outside the gating set never does.

#### ENV-098 — State-level assessments, funds and programs in the gating set

*Tier:* Core · *From:* ENV-066 · *Rules:* D-4

**Requirement.** For every state/DC enumerate withholding or cited no-income-tax status, the workforce-agency SUI account, PFML/disability/long-term-care programs or a cited none determination, the state new-hire directory, final-pay/paid-vacation obligations and pay-frequency/pay-statement content rules, explicitly including NY WTPA. The same closed official-source rule applies at state level to every wage-linked or hour-linked payroll assessment, compulsory compensation fund, premium and required exposure unit, whether named a tax, fund, insurance premium or assessment and even if absent from a vendor tax catalog. State-fund/hour-based assessments belong in the same closed coverage denominator. Each state/DC entry must enumerate these or give a cited none/applicability determination. Named mandatory entries are WA L&I risk-class/hourly premiums, employee/employer shares, salaried actual-versus-160/month method and quarterly/zero-hours reporting; OR WBF hour/partial-hour rate, statutory rounding, employee/employer shares and combined report; Ohio BWC, ND WSI and WY DWS payroll-reporting obligations or cited legal not-applicability/self-insurance. Include Hawaii TDI/Prepaid Health Care plan-derived capped employee shares under ENV-093. For every state/DC also retain each tax year's final/provisional FUTA credit-reduction status, official final reduction/add-on/waiver sources and Schedule A/940 mapping under ENV-089; zero credit reduction is an evidenced year/state result, not an omitted state. The state disability denominator explicitly includes NY DBL beside Hawaii TDI (ENV-094). DBL carrier/NYSIF remittance is a separate recipient/schema case from tax-agency and NY PFL cases; a generic disability tax row alone cannot pass it. Unknown or removed entries fail completeness.

**Acceptance.**
1. For every state and DC the export shows withholding or cited no-income-tax status, SUI account, PFML/disability/long-term-care programs or cited none, new-hire directory, final-pay and paid-vacation rule, pay-frequency and stub-content rule including NY WTPA, and each tax year's FUTA credit-reduction status.
2. Generate/export the state-level official-source union, requiring the ENV-095 WA two-class hourly and 160/month salaried goldens, ENV-096 OR fractional-hour and own assumed-hours/rounding goldens, WA quarterly/zero-hours and OR combined-report schema cases, and OH/ND/WY report/applicability cases.
3. Delete WA L&I or OR WBF and completeness fails naming the missing entry, even if every vendor-listed tax passes.
4. Add a new official hour-based fund and require an unmapped failure.
5. Remove Hawaii employee-share caps or one state/year's FUTA final-status source and fail their entries.
6. Exercise the final/potential/waived-BCR Schedule A changes through ENV-089; no future year inherits a prior-year rate as final.
7. Generate/export the coverage matrix with separate NY DBL, NY PFL and Hawaii entries, and run ENV-094's $100/$200, biweekly/split-week, remaining-premium and documented multi-employer goldens, plus carrier/NYSIF remittance and legal enhanced/self-insured boundary cases.
8. Delete DBL or replace its recipient with a tax agency: completeness fails by name even if NY PFL passes.

#### ENV-099 — Long-tail local coverage, published

*Tier:* Core · *From:* ENV-066 · *Register:* R-5

**Requirement.** Local tax authorities outside the gating set are tracked in the ledger, and their coverage is published as a percentage of local-tax employee-jurisdiction pairs. At the October 2026 baseline the long tail is 20.00% of pairs: 3,171 further confirmed jurisdictions plus the unconfirmed and unmeasured pairs listed in [docs/contract/large-local/](docs/contract/large-local/envelope-large-local.md). This includes the remaining Ohio school districts, Alabama, Colorado and West Virginia localities and Kentucky special districts below the gating line. ENV-066's fail-closed rule applies to all of it. No licensed vendor catalogue is required; reconciling against one is field proof.

**Acceptance.**
1. The coverage page publishes pairs mapped, pairs unmapped and the long-tail percentage, computed by the published script from the ledger, with Census vintages.
2. Every long-tail entry shows mapped, unmapped or not applicable with source and date; a mapped entry has the same cases as a gating entry.
3. An employee in an unmapped long-tail jurisdiction is blocked per ENV-066 with a next action; the employer can request mapping, which is recorded.
4. Mapping an entry updates the published percentage; a test adds an entry and checks the percentage and the blocked employee.
5. Unconfirmed jurisdictions (tax or withholding duty not confirmed) are listed apart, counted in the denominator and never treated as zero tax.

#### ENV-037 — Filing-year schemas and authorization lifecycle

*Tier:* Core · *Rules:* D-3, D-4

**Requirement.** Version official tax tables, return/file schemas, agency enrollment, signatures, reporting-agent and payment permissions independently. Track expiry, revocation, credentials and testing/production approval for each agency/rail; Inkwell can hold signed 8655/debit documents. For 2026 reporting use final IRS W-2/W-3 and SSA EFW2/EFW2C layouts, including current authorization requirements, rather than a stale draft. Keep original payload, checksum, submitted edition, receipt and corrected/superseding relationship. For each ENV-001 account separately version the actual agency deposit/filing/read scope, required state/local POA or agent form, employer/agent signatures, portal TPA grant, provider legal identity and agency confirmation. Federal 8655/bank debit authority cannot substitute. Track required, prepared, signed, submitted, agency-confirmed, rejected and revoked/expired states. Uploads or employer clicks alone are not confirmation. Revocation fences that agency's future submissions and opens the ENV-002 repair/liability path without revoking wage-payment authority.

**Acceptance.**
1. Through agency settings and year-end API, prepare files spanning two tax years, validate each against its actual official specification, revoke filing authority before dispatch and prove refusal.
2. Rotate a provider credential and retry a rejected file with a new reviewed correction; prior accepted payload/history stays reproducible and a newer schema cannot silently rewrite it.
3. Revoke an Illinois or St. Louis grant while its deposit is queued: refuse only that remittance and pay wages.
4. Complete a fresh form/portal grant, ingest official-schema confirmation, review the current payload and submit once.
5. Old-provider approvals, expired grants and fabricated confirmations authorize nothing.

#### ENV-067 — Elected R&D payroll-tax credit and carryforward

*Tier:* Core · *Rules:* D-4

**Requirement.** Record a CPA/tax-adviser-computed qualified-small-business payroll credit with filed Form 6765 election/source return, tax year, election/eligibility date, prior Form 8974 use and remaining balance. Apply the official year-specific limits and ordering against eligible employer Social Security/Medicare taxes from the first permitted quarter; never offset employee withholding or unrelated liabilities. Prepare human-reviewed Form 8974 with 941 and applicable 943/944, permitted deposit reductions, credit-use history and quarterly/year carryforward. Import unused elected balances and supporting prior forms under ENV-100 and ENV-039; stop duplicate claims across providers and link corrections/amendments without silently consuming a credit twice. Determining the business's income-tax research credit remains with its CPA or R&D adviser; Envelope applies the elected payroll offset.

**Acceptance.**
1. Via the tax-credit setup/migration and public payroll/filing doors load a filed $120,000 election and its official eligibility date.
2. Use two quarters with independently derived allowable offsets of $40,000 and $30,000 after IRS caps/order: inspect remaining balances $80,000 then $50,000, unchanged employee taxes, matching deposit reductions and applicable 941 credit line/Form 8974.
3. Migrate the $80,000 balance between quarters and get the same $50,000 remainder; duplicate source election or missing filed 6765 cannot create a second/early claim.
4. Validate current IRS form schemas and retain accepted filing receipts plus correction history.

#### ENV-038 — Register-to-bank-to-agency-to-ledger reconciliation

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** For each run and period, reconcile gross/net, employer costs, employee deductions, funding/debits, tax liabilities/deposits, recordkeeper/garnishment remittances and clearing-account journals to the cent. Imports, refunds, returns, amendments and opening balances stay separately attributable. Unknown settlement or pending agency acceptance is an open item; closing a quarter requires explained, owned differences and no disguised write-off. An owner may reopen with a reason; changes produce corrected reports. A held jurisdiction liability is unpaid/open tax with its funding/clearing references, not missing worker pay or an unexplained payroll balance. Issued-rate true-up, deposit/return release and actual penalty reconcile to the original period. A tax-close blocker never blocks subsequent correctly calculated wage runs. Reconcile tips already held versus paid now, actual employee-furnished tax funds, statutory uncollected employee taxes and employer tax still due as separate attributed amounts; a correctly reported tip shortfall is not unpaid wages or a balancing plug. Include state-fund/hour-based assessment shares and Schedule A Q4 FUTA in agency and ledger reconciliation. Trace prior-provider outstanding-tax refunds to the employer bank, approved recollection and the agency receipt, separate from imported already-paid deposits. Refund receipt changes funding custody, never wage totals or the underlying tax expense a second time; a delayed refund retains its tax deadline and funding owner.

**Acceptance.**
1. Through reconciliation and close routes, match a settled run to bank/provider evidence, agency receipts and Pantry/QBO clearing entries.
2. Inject a one-cent mismatch, missing tax receipt, returned credit and prior-provider opening liability; close refuses unresolved critical differences, corrections require review, and the final reconciled totals drill to original evidence without a balancing plug.
3. Reconcile timely wages with one held tax liability, run the next payday while its tax period stays open, then confirm authority/rate and approve/release the remittance once; inspect unpaid-to-paid history, true-up and filing receipt, with no repeated worker credit or balancing plug.
4. Close the tipped-server, WA/OR assessment and CA credit-reduction periods through reconciliation doors.
5. Trace already-held tips to source, new tip cash to one payment, furnished funds to an actual receipt and remaining tip-tax shortfall to the correct 941/W-2 lines, with all employer liabilities intact.
6. Unreceived promised funds cannot balance the account; subsequent lawful payroll continues.
7. Reconcile ENV-102's $3,000 refund/recollection/deposit and $1,000 already-paid opening deposit through bank/agency/ledger doors.
8. Net funding and unpaid liability close exactly once with no duplicate tax expense or repeated debit after replay; an initiated-only refund remains open.

### Migration, connectors and product handoffs

#### ENV-023 — Balanced accounting sync

*Tier:* Core · *Rules:* D-3, D-4

**Requirement.** Post wages, employer taxes, deductions, benefits, liabilities, reimbursements, funding/clearing and corrections to Pantry, QuickBooks Online, Xero, NetSuite and Sage Intacct using reviewed account/dimension mappings by department, class, location and job. Preserve one posting identity per run/version, source/provider IDs and acceptance; locked periods and mapping failures require an owned repair, never silent fallback to an unmapped account. Pantry is the ledger and AP product. Mapping preparation, proposed allocations and exact-version worksheet review are separately grantable to authorized bookkeepers, payroll administrators and accountants under ENV-028; preparation review conveys no posting authority, and a future posting needs its own current authority and durable reconciliation under ENV-034 and ENV-035 (RL-7).

**Acceptance.**
1. Through ledger connections, preview/map and post one run to each named ledger's official API/schema edge.
2. Verify balanced entries, exact net/tax funding reconciliation and dimension splits; replay, disconnect, reject a closed period and post a reviewed correction.
3. One external entry per approved version survives restart, and the user sees unresolved posting with its ledger link.

#### ENV-026 — Reconciled mid-year switch from incumbents

*Tier:* Core · *Rules:* D-4

**Requirement.** Import people, current/former status, year-to-date and per-period wage/tax/deduction detail, employer shares, prior filings/deposits, account identifiers, deposit schedules and opening liabilities from Gusto, ADP RUN, Paychex Flex, QuickBooks Payroll and CSV. Preview mappings and unsupported fields, identify source totals and duplicates, perform a parallel calculation on the same frozen period/inputs, and require the owner to accept explained differences and cutover responsibilities. First-run and quarter/year-to-date reports combine both providers correctly without paying historical wages again. Record by quarter/form/agency which prior provider files completed periods and which chosen reporting agent files the joining/open quarter onward, with explicit exceptions and acknowledgements rather than assuming two parties both file.

**Acceptance.**
1. Use the migration door with each named provider's authentic redacted export or fixture built from its official export schema.
2. Preview, map, reconcile, repeat import idempotently and compare a same-input parallel register to the cent.
3. Reject an unexplained mismatch; after accepted cutover run new pay and show a combined 941, W-2 and opening liability tie-out with no duplicate bank instruction.

#### ENV-100 — Standing setup carried into the first run

*Tier:* Core · *From:* ENV-026 · *Rules:* D-4, D-5

**Requirement.** Carry forward the standing setup as well as history: current signed W-4/state elections; direct-deposit account references and amount/percentage splits; pay rates, schedules and recurring earnings/deductions; benefits/retirement elections and cumulative contributions; Envelope-owned PTO/sick balances; active garnishment orders, priority/payee and remaining arrears; contractor W-9s and year-to-date 1099 categories; and unused elected R&D payroll-credit balances. Use legally available authorized source records/tokens, reviewed paper evidence and provider-assisted transfer when needed; do not promise extraction of secrets a provider does not export. The employer/admin verifies missing fields from existing signed records so employees need not re-onboard. Validate unchanged previously used account instructions with the new rail and an explicit human carryover review: ENV-004's new-account/change cooling clock applies only to new/changed instructions, never merely the import timestamp. If an unchanged account cannot be verified, expose/resolve the specific hold before cutover.

**Acceptance.**
1. Import a Gusto-format complete standing setup and year-to-date fixture, then run first live-format payroll with no employee re-entry of W-4 or bank details: net pay uses the verified same account splits, child support carries its correct arrears/priority, a near-limit 401(k) contributor caps using combined year-to-date, PTO carries, and January contractor 1099 includes pre-switch pay once.
2. Verify unchanged instructions avoid a spurious change hold while a changed import is held.
3. Show the old-provider completed-quarter and new-agent open-quarter filing assignments, plus ENV-067 credit carryforward and no duplicate submissions.
4. Apply this standing-setup journey to every ENV-026/039 named source profile.

#### ENV-101 — Fresh state and local authority after a switch

*Tier:* Core · *From:* ENV-026 · *Rules:* D-1, D-4

**Requirement.** Imported account identifiers do not convey the former provider's authority. A switch generates fresh per-account state/local POA/TPA requirements for the actual new reporting party under ENV-105 and ENV-037, preserving old/new period responsibility and prior mandates as inactive history. Pending tax numbers/grants do not hold worker pay; ENV-002 retains correctly calculated, dated remittance liabilities and exposure.

**Acceptance.**
1. Switch an employer with California, Illinois, Florida and St. Louis accounts.
2. Inspect new-provider agency forms/portal grants independently of imported IDs/federal 8655, confirm each and make its first state/local remittance.
3. Leave one grant missing: wages and other agencies proceed, only its remittance is held/escalated, and tax activation cannot falsely show complete.

#### ENV-102 — Prior-provider outstanding-tax refund and recollection

*Tier:* Core · *From:* ENV-026 · *Rules:* D-3, D-4, D-5

**Requirement.** A Gusto exit checklist records the actual cancellation reason, effective date, outstanding-tax refund election/status, per-agency/period balance, last paid deposit and confirmed old/new filing assignments. Selecting Gusto's switching-provider path automatically requests its outstanding-tax refund/stops future filing; preserve the provider's actual confirmation rather than requiring a nonexistent extra manual choice. Match each refund to bank-received funds in the employer account, then obtain exact human approval for Envelope's collection and one remittance of that still-unpaid obligation. Refund initiated, employer received, Envelope funded, deposit submitted and agency paid are separate states; prior paid taxes are not collected again and a refund never becomes wages, revenue or a second tax expense. Pending/delayed refund exposes funding/deadline risk and the authorized prefund/escalation alternative; a screenshot cannot count as bank settlement.

**Acceptance.**
1. Through the Gusto migration/cutover and tax doors import a $3,000 current-quarter unpaid liability plus a $1,000 deposit already paid, a refund initiation and bank-confirmed $3,000 receipt.
2. Approve exactly one $3,000 employer debit and one $3,000 agency deposit, reconcile the paid $1,000 as opening payment and ensure replay/restart yields no second collection/deposit.
3. A pending refund cannot be labeled received; demonstrate a separately approved verified prefund alternative before the tax deadline.

#### ENV-103 — Prior-provider annual filing opt-out

*Tier:* Core · *From:* ENV-026 · *Rules:* D-3, D-5

**Requirement.** Require explicit confirmed Gusto year-end W-2 AND 1099 opt-out/non-filing election for the relevant company/tax year before Envelope releases combined annual forms. Confirmation may be the switching path's provider acknowledgement that future/annual filing is disabled; do not assume cancellation alone proves the year-end election. An absent/conflicting/revoked confirmation holds only the affected annual submission, keeps its filing deadline/escalation visible and never holds worker pay. Reconcile any form already filed with the prior party before deciding whether a correction, rather than a duplicate original, is required.

**Acceptance.**
1. Leave W-2/1099 opt-out unconfirmed and attempt combined annual filing: both affected dispatches are held with deadline/owner while wages continue.
2. Confirm the company/year-specific Gusto non-filing election, review and file each annual form once; conflicting prior-provider-filed evidence instead requires the reviewed correction path.
3. A different company's or year's cancellation confirmation cannot release these forms.

#### ENV-030 — Documented API, webhooks and agent tools

*Tier:* Core · *Cites:* BASE-AGENT-008, BASE-AGENT-010, BASE-AGENT-012 · *Rules:* D-5, D-6

**Requirement.** Provide versioned REST endpoints, a documented CLI for preparation/status, and MCP tools for company/payroll records, preview/draft runs, reports and permitted payment/filing status, plus signed run/payment/filing webhooks with delivery history. Document schemas, pagination, validation, permissions, idempotency, rate limits, change policy and sandbox use. Agents and sibling apps receive scoped credentials, never a human session; a preparation tool's call never records a person's approval. Crank owns cross-product orchestration, while payroll releases remain here. A conversational MCP client may present a current exact-run review and origin-bound step-up challenge to a separately authenticated human. Only the human's explicit gesture and successful passkey/MFA proof can issue the narrowly bound ENV-034 approval; ordinary model text, client confirmation, an agent credential or an earlier session is not that proof. Record human and presenting client separately.

**Acceptance.**
1. Use the published API documentation to create a bonus draft via MCP and CLI, preview it, read a permitted report and receive signed lifecycle events at a controlled receiver.
2. Attempt approval, foreign-client reads, excess scope and an expired/revoked token; refuse each.
3. Replay callbacks and recover a failed webhook without duplicate work or leaked compensation.
4. Prepare a bonus via a conversational MCP client, inspect the exact immutable review and approve using the distinct human step-up ceremony.
5. Contrast with a model-generated yes, spoofed human flag, stale challenge and agent token: each refuses approval and produces no dispatch authority.

#### ENV-039 — Challenger imports and accountable exit

*Tier:* Core · *Rules:* D-4

**Requirement.** Add explicit Warp, Rippling Payroll and OnPay migration profiles at the same detail and reconciliation depth as ENV-026. When exports omit required details, identify each gap, retrieve authorized reports or guided owner-supplied documents, and hold cutover until reconciled; a generic CSV label cannot pretend a named migration is complete. Plan prior-provider cancellation, deposit/return responsibility, outstanding notices, future benefit remittances and year-end ownership, including a company closing or leaving Envelope. Every challenger profile inherits ENV-100's complete standing setup and first-pay-without-re-onboarding journey, including verified unchanged account splits and explicit old/new filing responsibility.

**Acceptance.**
1. Import a mid-quarter client from each challenger through the public migration page, with prior local taxes, retirement balances and one open notice.
2. Reconcile payroll/agency totals and approve the provider responsibility matrix; show a missing export field as blocked.
3. Export and hand off that client again, cancel future local runs and retain an assigned path for pending taxes/forms without replaying historical payments.
4. For Warp, Rippling and OnPay import standing elections, arrears, balances and recurring pay as well as the register; first payroll matches reviewed instructions without employee re-onboarding, and missing source documents stay visible until the admin resolves them.

#### ENV-040 — Effective-dated HRIS and leave handoff

*Tier:* Core · *Rules:* D-4, D-6

**Requirement.** Live-sync payroll-required hires, approved compensation/location changes, terminations, benefit deductions and leave with Willow and authorized BambooHR, Rippling HRIS and HiBob adapters. Return acknowledgement, effective payroll period, held/rejected reasons, leave consumption and restricted payroll results. Willow owns employment record, policy, I-9, documents, benefits enrollment and offboarding; Lodge hires enter through Willow, never directly from the ATS. Without an HRIS keep only the payroll-required profile.

**Acceptance.**
1. Through HR connections and payroll preview, apply a reviewed Willow hire, future rate change, leave and termination, then exercise each named external HRIS's official edge schema.
2. Conflict and replay a late event, inspect the owning record/product link and its affected run.
3. No payroll change bypasses human rate approval, overwrites source policy or admits a direct Lodge hire.

#### ENV-041 — Job earnings, labor actuals and separate finance products

*Tier:* Core · *Rules:* D-6

**Requirement.** Gauge, Plinth, Glove, Mallet, Strap and Orbit provide approved job, commission and per-service earnings with person/job/source identity and effective dates; Envelope calculates/payroll-taxes them and returns permitted labor actuals. Easel reads actual employer/compensation cost under field visibility to plan headcount; it cannot run pay. Coaster's reimbursement choice follows ENV-036; Purse's supplier/PO payments stay outside payroll.

**Acceptance.**
1. Through connections/API import one earning from each named source and return a reconciled restricted cost result.
2. Replay and correct a commission, revoke Easel salary visibility, and inspect links to the owning products.
3. A planning proposal, supplier bill or already-paid expense cannot become an approved payroll instruction.

#### ENV-042 — Connectors with visible health and repair

*Tier:* Core · *Rules:* D-4, D-7 · *Register:* R-9

**Requirement.** Each promised connector supports authorized setup, least-privilege access, identity/pay-code/account mapping, initial sync, incremental changes, last-success/lag, failures, source-version conflicts, credential rotation, disconnect and resumable repair. Preserve raw authorized source documents where needed and immutable derived provenance. Where a provider application or partner approval is not yet granted, the connection states the exact missing requirement, not a fabricated connected status. The named Expensify approved-expense handoff inherits this full connection lifecycle and ENV-036's payment-ownership controls.

**Acceptance.**
1. Through connection settings, attach one time, HRIS, ledger, recordkeeper and rail provider, then exercise the shared lifecycle for every named adapter in the contract using official schemas.
2. Expire credentials, reorder events, restart a partial import and disconnect in flight.
3. Inspect current/failed/unknown states, no duplicate effects, revoked future access and a recoverable owned backlog.
4. Exercise Expensify authorization/export mapping, paid-versus-unpaid state, version conflicts and disconnect without exposing bank data or duplicating a reimbursement.

#### ENV-043 — Benefits broker and regulatory data exchange

*Tier:* Core · *Rules:* D-3, D-4

**Requirement.** Accept payroll deductions/elections from Willow, Employee Navigator, carriers or authorized brokers; send eligible payroll/coverage/census and contribution records to recordkeepers including Ubiquity. Supply restricted ACA measurement/payroll-hour and benefit-cost exports to Willow or the buyer's ACA administrator and connect state auto-IRA programs under ENV-019. Benefits selection, enrollment policy, brokerage and health-plan/ACA administration remain their separate providers; Envelope retains payroll computation and remittance responsibility. For an applicable large employer, activation must name the contracted ACA administrator or Willow-connected filing partner responsible for IRS AIR 1094-C/1095-C submission and employee delivery. Envelope supplies complete permitted payroll-hours/cost data and tracks the partner's accepted submission/delivery or rejected/late obligation. Merely exporting a file is not ACA filing; HR/coverage decisions remain Willow/administrator-owned.

**Acceptance.**
1. Import an Employee Navigator election and Willow change, review the resulting paycheck and reconcile provider receipt of contributions/census.
2. Correct an election retroactively and export permitted ACA payroll hours; replay cannot double-deduct, and broker/employee access cannot see unrelated salary or receive a claim of insurance coverage from payroll alone.
3. Use an applicable-large-employer scenario spanning the 50-FTE determination with the named administrator, export the required payroll data and ingest official AIR/partner acceptance and employee-delivery status.
4. Reject a malformed return and inspect correction owner/deadline; export alone cannot mark filed, and no partner means an explicit unresolved filing obligation.

#### ENV-044 — Signature, communications and practice handoff

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-3, D-4

**Requirement.** Use Inkwell for signed reporting-agent/debit authorizations with exact document version, signer and revocation; carry approval/reminder links through configured email, SMS, Slack and Microsoft Teams without exposing salary, SSNs, bank numbers or tax documents in channel previews. Blotter receives authorized firm-work handoffs, client/deadline links and outcomes; it does not become the payroll app. Crank may schedule preparation and follow-up within scoped grants; its calls to sign or release funds carry the commitment and money classes, and a signature recorded for a person comes only from that person. Payday communications under ENV-022 use the same private email/push transport with actual stub publication status, while payroll cancellation and urgent case notifications include the current response/deadline clock and accountable service contact from ENV-065.

**Acceptance.**
1. Through settings, sign/revoke a 8655/debit document at Inkwell's official edge, deliver a redacted reminder in each channel and hand an overdue notice to Blotter.
2. Follow the link as authorized and unauthorized users; only the former sees private details.
3. Delivery failure, duplicate callbacks and a Crank attempt to record a person's approval cannot release payroll or mark a person as having read a reminder.
4. Publish, correct and revoke a stub link and inspect exactly scoped ready notices; interrupt an urgent support notification and verify that ENV-065's acknowledgement clock continues rather than resetting on a failed send.

### Employee, accountant and daily operations

#### ENV-022 — Employee and contractor pay portal

*Tier:* Core · *Rules:* D-2, D-6

**Requirement.** A mobile-first English/Spanish portal shows state-compliant itemized stubs, current/past pay history, W-2/1099/corrected-form downloads, W-4/state elections and protected bank changes. Include required rates, hours, deductions, employer identity, leave balances and jurisdiction fields; current/former workers retain authorized historical access. An employee can see only their own documents, and translations preserve amounts and legal meaning. Provide printable individual, per-run and worker/date-range bulk stubs, including a full year, for employees without portal access. Portal and printed stubs meet the state and DC content and language rules in the ENV-097 gating set, including NY WTPA, and expose the exemption certificates ENV-003 collects for the large-local jurisdictions in it. Authorized download/print and physical-handover recording are separate from portal access or proof of receipt. Send a redacted email/push notice when a stub is actually published for payday, with an authenticated link and no pay amount, SSN or bank details; workers without digital contact use the paper path. Portal/printable elections expose the same PA residency, Ohio IT-4 school-district and local exemption certificates as ENV-003, retaining signatures and effective changes without resetting other elections. Show the worker's already-held/paycheck tip amounts, actual cash due, each uncollected tip-tax amount, actual furnished funds and remaining collection deadline on their own preview, payday stub and portal. Explain that voluntarily furnished funds can reduce the shortfall before the deadline and that a shortfall does not hold wages; the portal cannot silently debit a bank or mark a promise received.

**Acceptance.**
1. Sign in as employee and contractor through the real portal at 1440/390, find this week's stub and last year's form in two taps from the signed-in home, change language and submit a tax/bank election.
2. Validate California statement fields and a terminated worker's access; foreign document IDs, download URLs and cached sessions cannot expose another person's data.
3. Pay the no-email worker from ENV-003, print one compliant stub, all stubs for its run and one worker's full year, and compare each selected record/content against state/DC rules including NY WTPA.
4. Publish a stub and inspect one deduplicated private payday email/push; an unpublished/failed run generates no false ready/paid notice, and links enforce worker identity.
5. Complete/upload signed PA residency and Ohio IT-4 district data as employee; compare the admin-paper path and an effective move on the stub.
6. Unsigned or foreign-worker forms cannot change another person's election.
7. As the low-wage server at 1440/390 in English/Spanish, inspect the preview, payday stub and shortfall/deadline, offer voluntary funds through a protected case and inspect the actual receipted reduction.
8. Another worker cannot view it, a mere offer leaves the balance unchanged, and no funds request disables payday or creates an unauthorized bank debit.

#### ENV-024 — Payroll, tax and labor reports

*Tier:* Core · *Rules:* D-2, D-3, D-6

**Requirement.** Provide payroll registers, tax liability/deposit/return history, labor cost by department/job/location, deduction/remittance, retirement census and workers-comp reports plus restricted exports for Easel/auditors. Reports distinguish earned, paid, pending, returned and amended amounts and show source/period/rule editions. Allow authorized download of the exact filed 941, 940, 8974, 943/944 where applicable, state/local returns, W-3 and correction copies with payload/version and agency acknowledgement. A prepared or rejected copy is labeled accordingly; filed copies remain available after switching providers. Registers distinguish actual reported tips already held, paycheck tips paid now, allocated-tip reporting, available wage withholding, collected/furnished employee tax amounts and remaining uncollected SS/Medicare/income-tax amounts with their deadlines. State-fund reports show covered/assumed hours, risk classes and employee/employer shares; tax downloads include Form 940 Schedule A and per-location 8027 with year, source and acknowledgement.

**Acceptance.**
1. Use Reports to drill from quarter totals to one check and download reconciled CSV/PDF; restrict compensation exports.
2. Download accepted 941/8974, 940, a state return and W-3 from Reports, match their versions/totals to stored receipts, and compare a rejected versus corrected/accepted copy.
3. A viewer without export rights cannot download them.
4. Download the low-wage server register and 941/W-2, the WA/OR hours/premium report, 2025 CA Schedule A/940 and two-location 8027.
5. Reconcile each line to actual cash/furnished-funds receipts and official golden calculations with no double tip payout, disguised collection or missing state-fund cost; prepared and accepted files stay distinct.

#### ENV-104 — Certified payroll reports

*Tier:* Later · *From:* ENV-024 · *Rules:* D-3

**Requirement.** Produce federal WH-347 and applicable state prevailing-wage reports from actual daily hours, classifications, rates, fringes, apprentice facts and payroll; the authorized person reviews/signs the statement of compliance.

**Acceptance.**
1. Generate WH-347/state certified output for a Davis-Bacon job with two classes and fringes.
2. Validate against official form schemas/instructions at the report boundary, and retain a reviewed signature/version without treating an unsigned report as submitted.

#### ENV-028 — Payroll roles and sensitive-data audit

*Tier:* Core · *Cites:* BASE-ACCESS-004, BASE-ROLE-001, BASE-AUDIT-001, BASE-OPS-005 · *Rules:* D-6

**Requirement.** Owner, payroll admin, preparer/approver, accountant, viewer, employee and contractor grants are scoped by company, location and sensitive fields; separate export, bank-edit and release privileges. Encrypt SSN/bank/tax documents, mask default views and record every sensitive access, rate/bank change, approval and payment with actor/time/version.

**Acceptance.**
1. Through settings grant a view-only accountant and a limited location approver, then try to read restricted compensation, export, edit bank details and approve/pay using UI and direct API.
2. Refuse outside scope, revoke access and old sessions immediately, and inspect the attributed effective rate change and sensitive-read audit without logging full SSNs or bank numbers.
3. ENV-028 inherits ENV-003 paper entry, exact-version human review and original-download permissions, separately grantable to authorized bookkeepers, payroll administrators and HR staff, with company, location and sensitive-field scope, configured separation of duties, immediate revocation and attributed access and decision audit.
4. These powers confer no other payroll authority and cannot release statutory holds.

#### ENV-029 — Accountant multi-client workspace

*Tier:* Core · *Rules:* D-6

**Requirement.** A firm sees permitted clients' run readiness, funding/filing deadlines, registrations, open notices and assigned work in one workspace, with client-granted preparation/approval rights and explicit client context at release. Filter and batch-prepare work, review each company's exact items, delegate or hand off to Blotter, and retain handover on staff removal. A firm's access never grants authority a client has not delegated.

**Acceptance.**
1. Sign in as a firm user with 20 realistic clients, filter today's due runs and notices, prepare/approve only authorized clients and follow a Blotter handoff.
2. Revoke one client's mandate and remove a staff member while work is pending; funds cannot move on stale grants, and open work returns to a named permitted owner.

#### ENV-068 — Controlled employment and income verification

*Tier:* Later · *Rules:* D-6

**Requirement.** Handle employee-initiated or legally authorized employment/income verification requests through a named verification partner such as The Work Number, or a reviewed protected response. Verify requester, lawful purpose/authority, selected period/fields and any required consent; link employment facts from Willow and wages from Envelope with provenance. Give the worker authorized visibility into requests/disclosures and a correction path, audit every release and enforce revocation/retention. Do not enroll all workers in an external database or send complete payroll history merely because a verifier integration is enabled.

**Acceptance.**
1. Through the verification-request route submit a worker-authorized mortgage-income request and an unauthorized broad employer-history request.
2. Review/send the permitted minimal version at a partner official-schema edge, inspect receipt and worker disclosure history, then correct a wage source and issue a linked correction.
3. A revoked/expired consent, forged requester or unrelated worker ID must expose no pay data and create no provider submission.

#### ENV-075 — File released verification data through the authority's channel

*Tier:* Later · *Rules:* D-3, D-4

**Requirement.** Where a legally authorized verification request under ENV-068 must be answered through the requesting authority's own channel, file the exact reviewed released statutory data there under current authorization. Filing remains separate from a protected response.

**Acceptance.**
1. Through the authority channel submit the exact reviewed released statutory data under current authorization, inspect its acknowledgement and refuse withdrawn or stale authority without submission.

#### ENV-045 — Native mobile payroll and accessible desktop

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001 · *Rules:* D-5, D-6 · *Register:* R-6, R-8

**Requirement.** Ship iOS and Android clients as well as the responsive web app, supporting employee documents/elections, preparer review, exact approval, funding/filing status and actionable push reminders under the same permission and step-up rules. Native signing, secure storage, device revocation and accessibility are delivery obligations; store distribution is field proof. Cached documents are encrypted and bounded by an explicit user setting; money movement, tax signature and bank changes require a fresh online authority check, with clear offline/pending states. Native clients meet corresponding platform accessibility semantics for the same workflows the web app proves under the Base bar. An unchanged recurring run can be approved from a redacted notification in one explicit approval action after the exact-run summary is shown and required step-up succeeds; no editable form must be re-entered. Step-up and the approval gesture remain distinct proofs, not an automatically approved run.

**Acceptance.**
1. Complete the shared run review/approve/status and employee stub/form journeys in native test builds on iOS/Android and web at 1440/390.
2. Lock/revoke the device, go offline after review and receive a redacted push; no cached approval dispatches, deleted/revoked documents are inaccessible, and native keyboard/screen-reader labels and focus meet the platform's accessibility semantics.
3. Open an unchanged recurring-run push/SMS link, inspect its exact review and complete step-up plus one explicit approval action; assert one bound approval with no re-entry, while a changed/stale version returns to full review.

#### ENV-046 — Persistent payroll follow-up and automation

*Tier:* Core · *Rules:* D-1, D-6 · *Register:* R-4

**Requirement.** Configure preparation schedules, recurring draft pay, deadline reminders, waiting-on-employee tasks, notice escalation and responsibility rules. Run them durably across restarts and timezone/DST changes; show what ran, failed, is awaiting review and the next due action. Reminders stop only when the actual obligation is complete or a person records a justified disposition; reminders to absent approvers escalate before funding/agency deadlines. Automatic preparation never automatically approves a future run. Default escalation reaches the designated backup approver eight support business hours before the earliest applicable ACH funding/approval cutoff or agency deadline, then the named payroll service duty contact four support business hours before it. Create an immediately escalated task if an obligation is first detected inside either threshold. Support business hours are 08:00–20:00 US Eastern, Monday–Friday excluding Federal Reserve banking holidays; actual agency/bank deadlines remain in their own official timezone. The backup still must personally review/approve; reminders never substitute for approval. Unchanged recurring runs use ENV-045's one-action reviewed approval. Eight-/four-hour escalation applies independently to held registration/TPA remittances, their actual agency deadlines and growing exposure even after wages are paid. A tax-account warning cannot become a paycheck hold. An unapproved effective minimum-wage change invokes staffed escalation to secure a human-approved lawful original/replacement payment by payday. Preparation and task disposition never approve a pay run, release money, submit a filing or authorize an outbound action; a disposition binds one identified obligation and cannot erase its legal deadline or fault history (RL-8).

**Acceptance.**
1. Set up a recurring draft and missing-hours reminder through automation settings, leave its approver absent, cross a holiday/cutoff and restart workers.
2. Inspect one draft, deduplicated reminders, timed escalation and retained obligation; resolve the hours and approve the current run, stopping only the appropriate reminders.
3. Failed delivery remains visible and does not imply receipt.
4. Use a controlled clock at cutoff minus eight and minus four support hours across a holiday/DST boundary: inspect the exact backup and service-duty escalations once each.
5. Detect a newly created run inside four hours and escalate immediately, then show that no absent approver or notification opens dispatch authority.
6. Pay a run with a missing tax account, advance to the deposit's eight-/four-support-hour thresholds and inspect both escalations.
7. Receive the account/grant, approve the rate true-up and release one remittance while retaining lateness/fault history.
8. Delay minimum-wage approval and prove a named-human-approved lawful replacement reaches the worker by payday.

#### ENV-047 — Employee pre-check and accountable payroll cases

*Tier:* Core · *Rules:* D-2, D-6 · *Register:* R-4

**Requirement.** Employees may review a preview of their own paycheck and submit a discrepancy before the cutoff without seeing others' pay or changing approved hours themselves. Employees/admins can open a pay, tax-form, missing deposit or migration case linked to worker/run/filing, assign an accountable owner and deadline, exchange protected evidence and track escalation/resolution. Changing a check from a case returns it to review. The installation has a named human escalation route for agency/rail cases agents cannot finish. The contracted service operator, human team, contact channels and response clocks are mandatory at employer activation under ENV-065, not left to the employer merely because the app is self-hosted. Urgent missing/failed-pay, tax-deposit or filing-deadline cases require human acknowledgement within one support business hour and an evidence-backed next-action update within four; ordinary payroll cases require acknowledgement within four support business hours (support business hours as in ENV-046). Acknowledgement by an automated message does not count. A worker can view an uncollected tip-tax shortfall before payday and open a protected voluntary-funds case with amount/deadline; payroll staff record actual receipt/allocation under ENV-082. No case, promised contribution or unresolved voluntary funding is a wage-payment prerequisite.

**Acceptance.**
1. Review a pending paycheck as employee, dispute overtime, inspect the assigned case as payroll admin, correct the source and reapprove.
2. Open a missing-deposit case and fail provider contact; inspect escalation and a still-open outcome.
3. Close with bank/agency evidence and notified worker, then reopen without losing the original correspondence or reviving a payment.
4. Open an urgent Thursday failed-deposit case and an ordinary paycheck query through the public case door, route each to the named service team and advance the clock.
5. Assert the one-hour/four-hour acknowledgement and urgent four-hour update bounds, escalated breach and unchanged deadline after a team handover; a bot response cannot stop the response clock.
6. Open the server's pre-payday shortfall case, offer funds, record actual receipt before the displayed statutory cutoff and inspect the reduced tax balance/stub and linked audit.
7. Repeat without funds and still complete the lawful wage run on payday, preserving required uncollected reporting and no automatic bank collection.

#### ENV-048 — Saved reports, dashboards and reproducible cost analysis

*Tier:* Core · *Rules:* D-6

**Requirement.** Owners/accountants can save filters/columns/groups for payroll, tax, deduction and labor reports, compose role-filtered dashboards, compare periods and permitted entities and schedule redacted report links. Drill every aggregate to its source with as-of time and corrected/original treatment; report exports enforce independent permissions. USD employer cost includes wages, employer taxes, benefits, payroll/rail charges and contractor fees, with estimates labeled separately from actuals.

**Acceptance.**
1. Through Reports create and share a job/location cost view, compare quarters/entities, schedule it, then correct a prior check.
2. Inspect the original as-of snapshot, corrected totals and drill-through matching ENV-038; an unauthorized viewer or email recipient cannot obtain the salary-bearing attachment or bypass export permission.

#### ENV-049 — Transparent operating costs and service exit

*Tier:* Core · *Rules:* D-1 · *Register:* R-3

**Requirement.** Before enabling a paid provider, expedited pay or plan, disclose known USD costs, variable/unknown charges, required contracts and cancellation steps. Per-run approval shows debit components and selected service fees. The owner can disconnect/cancel future services, archive/export records and hand off outstanding payroll obligations, with clear ownership of pending returns, year-end forms and unused funds/refunds; cancellation never claims to cancel an accepted bank or agency instruction. At activation name the legal service operator accountable to the employer for correcting Envelope/operator-caused payroll/filing errors. The operator must cover documented penalties and interest caused by its own calculation, processing or filing failure, and own recovery from a rail when the rail caused it; the employer is not bounced between providers or charged a corrective-service fee for that failure. State evidence, exclusions for employer-provided errors/late approvals, claim route and adjudication/payment deadlines before consent. Principal tax/wages actually owed remain the employer's liability; disputed causation stays visible and cannot stop urgent correction. A complete claim receives a written determination within ten business days and an accepted reimbursement is paid within five further business days. Before approving wages with held remittances, disclose each agency/period, amount, original due date, projected lateness where knowable and official penalty/interest basis or explicit uncertainty. Preserve receipt/submission dates and employer-versus-operator/rail/agency delay, evolving exposure, actual charge and reimbursement decision separately. Correct timely wages never excuse late taxes; a warning cannot waive wages, conceal a breach or shift operator-caused liability.

**Acceptance.**
1. Through provider setup and run review, compare standard and expedited costs, cancel future payroll and disconnect a paid service.
2. Inspect the confirmation, final bill/unknown provider charge, pending tax/benefit obligations and refund status; export and retain access to historical forms without silent continued scheduling or a false recall of settled pay.
3. Create an operator-caused late-deposit penalty and an employer-late-approval contrast through the case/claim route.
4. Inspect named payer, documented causation/terms, no error-correction fee, ten-business-day determination and five-day accepted reimbursement; disputed rail responsibility never leaves the employer without an operator-owned correction or fabricates a refunded penalty.
5. Compare employer-missing account/grant input with an operator-failed TPA submission for otherwise identical timely-paid runs.
6. Inspect preapproval exposure, retained dates and true-up/lateness, plus fault/claim outcomes, without erasing the liability or blaming the employee.

### Owned installation, custody and separate products

#### ENV-050 — Owner-run installation on Cloudflare through Base

*Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-SECRET-002 · *Rules:* D-1, D-7

**Requirement.** An installed Envelope is configured for USD and a US timezone, with provider-enrollment instructions for each required payroll provider. Worker payment requires an exact authorized run (D-5), a verified lawful payment route and funding authority; missing state/local tax numbers or agency grants hold only the affected remittance, not payday. Display remaining activation requirements separately, never as a global payroll lock. Fresh employer activation must satisfy ENV-065's bounded partner-led path: the installed employer signs customer-level authorizations, never enrolls as its own reporting agent, transmitter or ACH service operator solely to use Envelope.

**Acceptance.**
1. From Base's documented setup in a fresh owner account, configure USD, a US timezone and the required payroll providers from their enrollment instructions, sign in and complete a payroll draft and preview.
2. With a state or local tax account or agency grant missing, payroll workspace access continues and activation shows effect-specific holds, none of them a wage-payment hold.
3. From fresh setup follow employer activation to ENV-065's first funded sandbox run/date, checking named service entities and employer-only documents rather than an application to become a payroll intermediary.

#### ENV-065 — Partner-led employer activation and accountable service

*Tier:* Core · *Rules:* D-3, D-4 · *Register:* R-1, R-3, R-4

**Requirement.** Activate each employer through one actually contracted embedded rail or payroll service, with legal names and responsibilities of the service operator, originating bank/processor, reporting agent and federal/state/local filing transmitter shown in setup, run review and tax settings. Check, Gusto Embedded, Salsa or Zeal may supply the infrastructure; their brand is not proof of a particular legal authorization. The service operator arranges intermediary permissions and agency/rail onboarding. The employer supplies the documented employer-level KYB/identity, EIN/accounts, bank verification, funds, signed Form 8655 naming the reporting agent, debit authorizations through Inkwell and the per-agency state/local POA/TPA materials of ENV-105; no step asks a small employer to enroll as a reporting agent, e-file transmitter or payroll service/ODFI. Show a five-US-banking-day activation target from receipt of the complete employer-controlled package, including required state/local forms and portal actions, and the proposed first funded payday. Agency confirmations and remittance readiness count toward this same target rather than postponing its start. Instant verification and microdeposit paths both fit this target; waiting partner/agency work stays on the clock and a missed target is an accountable breach, not a reset. Legal/risk refusal remains visible with a specific reason and service-owned remedy, never a false activation. The selected actual legal entities and signed service agreement are required before production readiness can pass; no provider relationship is claimed to exist today. A named contracted human service team, not an unstaffed installation or the employer by default, owns failed-payment, filing and notice escalation. Its hours are 08:00–20:00 Eastern Monday–Friday excluding Federal Reserve holidays; scheduled paydays have active duty coverage through final processor cutoff. Urgent cases receive human acknowledgement within one support business hour, next-action evidence within four, updates at least every four until stabilized; ordinary cases within four. Breached clocks notify the backup service contact and remain visible. An immediately threatened statutory/payday deadline invokes duty contact at once, regardless of the ordinary support clock.

**Acceptance.**
1. From fresh Base setup use the real activation door with a new employer and official-schema provider sandbox: inspect actual configured legal reporting-agent/rail/operator identities, signed named 8655/debit mandates through Inkwell, KYB and both bank-verification paths.
2. Offer and complete a funded first payroll within five banking days on a simulated provider/bank clock; no employer reporting-agent/transmitter/originator-service enrollment appears.
3. Delay the partner beyond day five and require a visible breach with a named remediation owner.
4. Open a Thursday failed-deposit case through the public case door, confirm routing to the contracted human party, assert the one-hour acknowledgement/four-hour update clocks, duty escalation and non-resetting history.
5. A generic provider name with no legal agreement/authorization cannot pass production activation.

#### ENV-105 — Per-account state and local activation

*Tier:* Core · *From:* ENV-065 · *Rules:* D-1, D-3, D-4

**Requirement.** The employer-controlled package must include the authorization required for every active state/local account in ENV-001: an agency-specific POA/reporting-agent form signed through Inkwell and/or employer portal TPA grant, with agency confirmation tracked separately. Generate requirements from actual agency rules. Examples include Florida DR-835, Illinois DOR IL-8655 and IDES LE-10/UI-1M, California EDD e-Services/third-party authority, Texas TWC agent access, DC DOES unemployment POA, and St. Louis E-9 registration plus separately required third-party access. E-9 registration is not falsely treated as a generic authorization. Display required/prepared/signed/submitted/agency-confirmed/rejected/revoked by account/scope. The same five-banking-day target covers first funded pay AND confirmed access and first due deposit/filing for all active agencies; if not yet due, prove an authorized ready payload at its official schema edge and retain the real deadline. Start the clock when employer-controlled documents/portal actions are supplied, never when agency confirmations arrive. Agency/partner waiting remains on the clock: an unconfirmed grant at day five is an activation breach even if wages were paid. Missing accounts/grants hold only affected remittances, with exposure/escalation under ENV-002, never payday or other ready agencies. The same account-by-account activation clock includes subject state compensation funds and hour-based assessments under ENV-021, ENV-095, ENV-096 and ENV-098. A Washington employer needs L&I account/confirmed authority and risk-class rates plus a consistent salaried-hours election, or an officially proven lawful alternative; private workers-comp alone is insufficient. Oregon activation includes WBF applicability, its own hours method and combined-report authority.

**Acceptance.**
1. Activate the switched California/Illinois/Florida/St. Louis employer via the generated per-account checklist.
2. Sign form-based permissions in Inkwell, complete portal grants, inspect official-schema confirmations and make each first due state/local deposit with filing authority validated.
3. Assert the same five-day clock.
4. Repeat with one grant absent/rejected: wages arrive on payday and other agencies remit, only its deposit/filing stays deadline-dated/exposure-notified, day-five completion fails and the named service owns escalation.
5. Federal 8655 alone or an uploaded E-9 cannot make state/local activation green.
6. Activate subject WA and OR employers within the same five-banking-day clock, inspect state-fund/assessment requirements, and demonstrate authorized first due reports/payments or schema-valid not-yet-due readiness.
7. A private WA policy with no L&I account/authority or legal alternative cannot turn activation green; delayed authority retains the breach/remittance exposure while lawful wages proceed.

#### ENV-051 — Secure sign-in and revocable sessions

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-SIGNIN-001, BASE-SIGNIN-002 · *Rules:* D-6

**Requirement.** Beyond Base sign-in, provide a linked Auth/OIDC identity path with MFA and step-up for sensitive payroll operations. Never bootstrap an uninvited operator through social login. Revoking the linked identity or the current payroll grant ends that person's payroll access.

**Acceptance.**
1. Sign in through the linked Auth/OIDC identity with MFA; an uninvited social identity gets no operator account, no session is issued when Auth is unavailable, and revoking the linked identity or the payroll grant ends payroll access at once.
2. A bank-detail change and a payroll release each require fresh MFA step-up and refuse without it; a former worker's retained employee form access needs an explicit permitted identity.

#### ENV-052 — Agents act through scoped, sponsored credentials

*Tier:* Core · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-008 · *Rules:* D-5, D-6

**Requirement.** Grant each agent/integration an expiring, revocable company/action/field-scoped credential with a named sponsor, access log and permitted data/model providers. Distinguish read, prepare, propose and dispatch execution; a dispatch grant executes only an exact unexpired item, and no credential records a person's approval. Fresh step-up (app-local or ENV-051 linked MFA) is required before minting. Any person whose current ENV-028 grant holds every delegated company, location, field and action may sponsor, never beyond their own scope. The owner may restrict sponsorship. A grant lasts until a sponsor-chosen review date of at most 90 days. Its secrets expire within 24 hours and rotate only while grant, sponsor and scope are current. Model and data providers are allowed only when declared under ENV-055, with fields minimized and SSN/bank values redacted. Dispatch under ENV-034, rechecked at execution under ENV-035, is covered by ENV-072. A bank-detail change stays a gated step that needs the account holder's own step-up and verification (ENV-004), which no credential performs. Tool output and uploaded notices are untrusted evidence, not instructions that widen authority. Connected mail is covered by ENV-072.

**Acceptance.**
1. Issue an agent a single-company draft grant through settings, prepare a persisted reviewed-rate run draft via MCP, attempt another company, raw SSN export, self-approval and bank change through the actual record, private-custody and approval doors, then revoke during an in-flight preparation.
2. Every escalation is refused with no write, and prompt injection in a notice cannot invoke an ungranted provider or reveal payroll secrets.
3. A payroll admin and an accountant-firm operator with full scope each sponsor; a sponsor with narrower scope is refused wider scope.
4. Renew a 30-day grant across three rotations and end it at sponsor removal.
5. Process a real notice through a declared model provider whose text names an ungranted provider: no call, no secret.
6. Dispatch one human-approved item and refuse its edited twin.

#### ENV-072 — Agents prepare calculated runs and dispatch exact payroll effects

*Tier:* Core · *Cites:* BASE-AGENT-005 · *Rules:* D-5

**Requirement.** Tool output, uploaded notices and connected mail are untrusted evidence, not instructions that widen authority. An agent prepares calculated runs and refuses forged signed filings; a dispatch grant executes only the exact unexpired item whose version ENV-034 binds, with the money and commitment classes the company's policy decides, rechecked at execution under ENV-035.

**Acceptance.**
1. Issue an agent a single-company draft grant through settings, prepare a run via MCP, attempt another company, raw SSN export, self-approval, bank change and a forged signed filing, then revoke during execution.
2. Every escalation is refused, approved execution is rechecked, and prompt injection in a notice cannot invoke an ungranted provider or reveal payroll secrets.

#### ENV-053 — Complete archives and inactive restore

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001

**Requirement.** Envelope's archive also carries every schema/rule edition, run/version, historical approval attribution, provider reference, acknowledgement, notice/case, report and connector mapping, with versioned manifests and content digests, and validates integrity/relationships into an empty installation. Installation-local sessions, OAuth/API/bank/agency secrets, live signatures/mandates and agent grants do not transfer; historical signed documents remain evidence only. Restore pauses schedules, payments, filings and notices' outbound actions until fresh connection, authority and reconciliation prove what already happened.

**Acceptance.**
1. Through archive export/import doors, round-trip a populated mixed-company year including files, corrections, erased-record fences and open unknown payments; compare business data/digests.
2. Corrupt or nonempty imports write nothing.
3. Restored schedules/approvals cannot send money or filings, and reconnecting a provider reconciles accepted original IDs before any renewed exact approval.

#### ENV-054 — Retention, lawful erasure and durable anonymized audit

*Tier:* Core · *Cites:* BASE-DATA-002, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-6

**Requirement.** Erasure reaches records, documents, search, caches, exports and AI derivatives. Payroll statutory retention and active legal holds are the retention category for payroll records: identify each retained field/document, legal basis, custodian and release date; restrict its access/use and show the request as held, never completed. Once a hold is lawfully released, complete the cascade; track external provider deletion requests separately and fence stale imports/replays.

**Acceptance.**
1. Through privacy routes erase an eligible worker and verify every dependent payroll record, document, search entry, cache, export and AI derivative is gone.
2. Repeat with a statutory payroll hold, inspect the exact retained set/reason and restricted access, release it and complete deletion.
3. Replay a stale source and restore an older archive with the erasure journal; neither resurrects eligible erased data.
4. Downloaded copies and already-filed agency records are explicitly outside local recall.

#### ENV-073 — Every external recipient declared and payroll independent of AI

*Tier:* Core · *Cites:* BASE-DATA-004

**Requirement.** Declare every external recipient, purpose, fields, credentials and custody in installation settings and seed external-flow metadata: bank/rail/account verification, tax/identity agencies, recordkeepers/carriers, connected HR/time/POS/ledgers, Inkwell, mail/SMS/chat/push and opted-in AI. Disable optional AI without losing calculation, approval, payment, filing and reconciliation controls; use deterministic official calculation/rule data. ENV-073 carries the complete external recipient inventory and the complete non-agent payroll journey from ENV-055 (RL-11).

**Acceptance.**
1. Exercise setup, payroll, portal, notice and connector journeys with a network recorder and planted sensitive values.
2. Inspect exact approved destinations/data and absence from unauthorized requests, client bundles and logs.
3. Remove AI credentials and continue the non-agent payroll journey; unconfigured external work remains explicitly unavailable and cannot substitute a mock result.

#### ENV-056 — Visible durable operations and recovery

*Tier:* Core · *Cites:* BASE-OPS-001, BASE-OPS-004 · *Rules:* D-7

**Requirement.** Expose health of schedulers and each provider beside the Base health of database, storage and queues; a successful local health check never claims the bank/agency is functioning. Durable jobs show current attempt, next action, deadline and failed/unknown state, with bounded known-safe retries and ENV-035's effect rules. Provide owner recovery/runbooks, reconciliation after downtime, backup validation and non-destructive upgrades; monitor capacity with the initial 100-employee employer and 20-client firm journey without claiming an unmeasured SLA. At a 100-employee employer, fresh exact gross-to-net preview/recalculation is p95 no more than 10 seconds end-to-end through the public API and page; a 20-client firm dashboard with 100 workers per client, five years of history and open exceptions is p95 no more than 3 seconds to useful interactive state at 1440/390. A saved quarter payroll/report drill-through is p95 no more than 5 seconds; measure 20 consecutive warmed measured journeys after five warmups at two concurrent users and report transport/provider time separately without subtracting it from the user-visible result. Cold start remains included when it occurs in a measured request. These are target bounds, not a claimed current SLA.

**Acceptance.**
1. Use health/status and job APIs, interrupt a release/filing queue and provider responses, restart and recover from backup.
2. Inspect no dropped obligations, preserved unknowns, explicit unhealthy dependencies, no repeated external effect and the next permitted human action.
3. Measure the fixed 10-second preview, 3-second dashboard and 5-second report bounds below and prior-release migration; do not infer provider delivery from a green health route.
4. Run that exact 100-worker/20-client dataset and measured sample through public preview/dashboard/report doors, assert p95 10s/3s/5s respectively and retain timings for failures/timeouts as failures.
5. Change one worker after review and time a fresh recalculation, not a stale cached response; provider delays remain visible in the measurement and job state.

#### ENV-057 — Safe private inputs, files and public doors

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-ACCESS-003, BASE-PUBLIC-001, BASE-ACCESSIBILITY-001 · *Rules:* D-6 · *Register:* R-6, R-7

**Requirement.** Keep notices, tax forms and attachment versions in private owner storage, downloadable only under a current payroll grant for that company. The public doors are exactly the Lobby, documentation and contract, setup, sign-in, invite and verified callback doors, and none of them exposes payroll data. The payroll journeys' human screen-reader pass and VPAT are register rows R-6 and R-7.

**Acceptance.**
1. Upload a notice, a tax form and a new attachment version through the payroll doors; each is held in private owner storage, a current payroll grant downloads it, and a download without that grant or from another company fails with no content.
2. Visit each declared public door signed out; none returns a private response or payroll data, and every other payroll route refuses.

#### ENV-058 — US-first complete payroll and honest product boundaries

*Tier:* Core · *Rules:* D-6

**Requirement.** USD, US employer/bank norms, all states/DC/local coverage under ENV-066, US timezones/DST and English/Spanish portal are the first-market defaults. Puerto Rico, Guam, USVI and non-US employee payroll are explicit later extensions; international contractor partner payouts are ENV-087. Keep every handoff in the boundaries section below linked to its owning product, with current connection status and outstanding requirements. Scope difficulty, missing partner access or an unbuilt sibling is recorded as missing engineering, not a reduction of Envelope's payroll job.

**Acceptance.**
1. Walk a US employer from Willow hire and Lanyard time/tips through tax registration, exact reviewed run, payment, deposits/returns, Pantry journal, employee stub and firm notice follow-up.
2. Inspect all sibling links/ownership, USD amounts, local deadlines and a disconnected provider's truthful setup state at 1440/390.
3. Reject a territory/non-US employee run with an explicit unsupported market, without misclassifying an included US remote worker or international contractor payout.

### Agent surface

**Specialist: Payroll administrator.** It keeps a company's payroll prepared, paid, remitted, filed and reconciled, and follows the notices, registrations and cases that payroll creates, acting for the person who sponsors it.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call; this section presets none.

**How Envelope computes each class.**
- *standard*: drafts, previews, intake, coverage reads, case notes, reconciliation proposals and masked reads; each can be withdrawn or corrected in the product.
- *money*: a run release, funding debit, wire or prefund, deposit, remittance, contractor or urgent payout, refund recollection, service cancellation, and any rate, pay-item, deduction, garnishment or proration change; facts are the amount in USD, the payee count and the counterparty, *known* for a destination or agency account already paid and *new* otherwise.
- *commitment*: a signed or submitted filing, report, registration, claim response, notice reply, authorization prepared for signature, statement of compliance or migration cutover; facts are the form, period, agency or recipient and any amount it carries.
- *external*: anything sent to someone outside the company (filings, replies, report links, verification disclosures, ledger postings, webhooks); facts are the recipient count and counterparty, *known* for an agency, provider or requester on record and *new* otherwise.
- *sensitive*: reads or exports of SSNs, bank numbers, tax documents or named compensation; facts are the record count and kind.
- *access*: staff, firm and agent grants; facts are the people and whether the grant widens or narrows.
- *security*: credential rotation, provider credentials, step-up and custody settings.
- *accounts*: a state or local registration or provider enrollment that creates an account at an outside agency or provider.
- *gated*: a step an outside service keeps for a person: the account holder's bank verification, a person's passkey or MFA step-up, a signature by the named signer at Inkwell, an agency portal grant in the employer's own agency account, provider KYB.
- *destructive*: erasure and the release of a statutory hold that leads to it; facts are the item count.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `envelope.company.update` | Company profile, jurisdiction register, schedules and entities | ENV-001, ENV-005, ENV-032 | standard or sensitive | none |
| `envelope.people.update` | Hires, onboarding, elections, locations and HRIS handoffs | ENV-003, ENV-007, ENV-031, ENV-040 | standard or sensitive (+ external) | `records.list` (read) |
| `envelope.bank.request_change` | Start a worker's bank change | ENV-004 | sensitive · gated | none |
| `envelope.rules.propose` | Propose rule editions, rates, pay items and proration methods | ENV-027, ENV-033, ENV-084 | standard or money | none |
| `envelope.earnings.import` | Hours, tips, premiums, leave and job earnings into a run | ENV-008, ENV-079, ENV-080, ENV-081, ENV-020, ENV-041 | standard | `draft.prepare` |
| `envelope.runs.prepare` | Calculate and preview a draft run, off-cycle or final pay | ENV-006, ENV-076, ENV-077, ENV-078, ENV-009, ENV-082, ENV-083, ENV-010, ENV-012, ENV-059 | standard | `draft.prepare`, `bonus.prepare`, `draft.read`, `bonus.read` |
| `envelope.runs.review_link` | Present an exact run for a person's review | ENV-034, ENV-029 | standard | `run.review` |
| `envelope.runs.release` | Release an exact run, its funding and payouts | ENV-011, ENV-034, ENV-035, ENV-085, ENV-086, ENV-036, ENV-013 | money (+ external) | none |
| `envelope.runs.cancel` | Ask the rail to cancel a submitted run | ENV-034 | money | none |
| `envelope.contractors.record_payment` | Record an outside contractor payment for 1099s | ENV-013 | standard | none |
| `envelope.deductions.update` | Garnishment orders, benefit and plan deductions | ENV-018, ENV-019, ENV-091, ENV-093, ENV-094, ENV-043 | money (+ sensitive) | none |
| `envelope.tax.register` | Prepare and submit state and local registrations | ENV-002, ENV-060 | accounts · commitment (+ gated) | none |
| `envelope.tax.file` | File returns, reports and remittances | ENV-014, ENV-089, ENV-015, ENV-090, ENV-016, ENV-017, ENV-021, ENV-095, ENV-096, ENV-067, ENV-060 | commitment · external (+ money) | none |
| `envelope.authorizations.prepare` | Prepare 8655, state POA and debit mandates for signing | ENV-037, ENV-105, ENV-044, ENV-065 | commitment · gated | none |
| `envelope.coverage.export` | Read the coverage ledger and request a mapping | ENV-066, ENV-097, ENV-098, ENV-099 | standard | none |
| `envelope.notices.process` | Intake, extract and match a notice or claim request | ENV-025, ENV-069, ENV-062 | standard or sensitive | `notice.process` |
| `envelope.notices.reply` | Send a notice reply or claim response | ENV-025, ENV-069, ENV-062 | commitment · external | `reply.dispatch` |
| `envelope.reconcile.run` | Reconcile a run or period and propose fixes | ENV-038, ENV-061 | standard | none |
| `envelope.ledger.post` | Post a payroll journal to the connected ledger | ENV-023 | external | none |
| `envelope.migration.import` | Import an incumbent's history and standing setup | ENV-026, ENV-039, ENV-100, ENV-101, ENV-102, ENV-064 | standard or sensitive | none |
| `envelope.migration.cutover` | Accept a cutover and filing responsibilities | ENV-026, ENV-103, ENV-064 | commitment | none |
| `envelope.reports.read` | Registers, saved views, dashboards and filed copies | ENV-024, ENV-048, ENV-029 | standard or sensitive | `reports.bonuses`, `reports.proposals` |
| `envelope.reports.schedule` | Schedule a redacted report link | ENV-048 | external | none |
| `envelope.cases.update` | Open, assign and resolve payroll cases | ENV-047 | standard | none |
| `envelope.automation.configure` | Preparation schedules, reminders and dispositions | ENV-046 | standard | none |
| `envelope.access.grant` | Staff, firm and agent grants | ENV-028, ENV-029, ENV-052, ENV-072 | access | none |
| `envelope.credentials.rotate` | Rotate the calling credential's secret | ENV-052 | security | `credentials.rotate` |
| `envelope.connectors.manage` | Connect, repair and disconnect providers | ENV-042, ENV-044 | security (+ external) | none |
| `envelope.privacy.erase` | Request erasure and release eligible holds | ENV-054 | destructive · sensitive | none |
| `envelope.archive.export` | Export a complete archive | ENV-053 | sensitive | none |
| `envelope.services.cancel` | Cancel future paid services and hand off obligations | ENV-049 | money | none |
| `envelope.activation.status` | Read activation, clocks and service contacts | ENV-065, ENV-105 | standard | none |
| `envelope.scenarios.estimate` | Estimate a hire, raise, move or schedule change | ENV-063 | standard | none |
| `envelope.operations.status` | Read health, jobs and timings | ENV-056 | standard | none |
| `envelope.paychecks.explain` | Explain a worker's own paycheck to that worker | ENV-070, ENV-106 | standard | none |

**Resources.** `envelope://companies/{company}`, `envelope://companies/{company}/people/{person}`, `envelope://companies/{company}/runs/{run}/versions/{version}`, `envelope://companies/{company}/filings/{filing}`, `envelope://companies/{company}/notices/{notice}`, `envelope://companies/{company}/cases/{case}`, `envelope://companies/{company}/coverage/{entry}`, `envelope://companies/{company}/reports/{report}`. **Events.** `run.prepared`, `run.approved`, `run.released`, `payment.settled`, `payment.returned`, `deposit.accepted`, `filing.submitted`, `filing.accepted`, `filing.rejected`, `registration.issued`, `notice.received`, `case.escalated`, `coverage.unmapped`, `approval.pending`, `approval.decided`, `review.flagged`, `policy.adopted`. **Prompts.** `prepare_run` (ENV-059), `keep_jurisdictions_whole` (ENV-060), `reconcile_run` (ENV-061), `answer_notice` (ENV-062), `estimate_change` (ENV-063), `carry_switch` (ENV-064), `explain_paycheck` (ENV-070).

**Not tools, and why.** ENV-050 (the owner's installation), ENV-055 and ENV-073 (declared recipients are installation facts), ENV-057 (public doors and file custody are installation facts), ENV-058 (the market boundary is an installation fact), ENV-030 (the API and MCP door is the door itself), ENV-051 (sign-in is a person's own screen), ENV-022 (the worker portal is the worker's own screen) and ENV-045 (native clients run on a device).

**Limits.** Capacity limits only: request rate, body and upload sizes, and archive size, documented on `/docs/agents`. Thresholds on money moved, recipients and items, and provider spend caps, are the company's policy.

**Handoffs.** Listens for Willow `hire.approved` and `leave.approved`, Lanyard `timesheet.approved`, Pantry `period.locked` and Blotter `work.assigned`. Emits `run.released`, `payment.settled`, `filing.accepted` and `coverage.unmapped` for the Bookkeeper (Pantry), HR (Willow) and practice (Blotter) specialists.

#### SURFACE-001 — The registry equals this table and the Base harness passes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-013

**Requirement.** Envelope serves the Base MCP door at `/mcp` with the tools, resources, events and prompts in this section, each tool calling the same server action as the payroll UI. The existing `/api/envelope/mcp` tools move onto that door under their table names.

**Acceptance.**
1. `tools/list` names exactly the tools in the table, each with its declared classes in `_meta`, and their Core clause ids plus the not-a-tool reasons cover every Core clause.
2. The Base conformance harness runs BASE-AGENT-001 to BASE-AGENT-013 on Envelope's seeded company under the all-autonomous and the held policies, and passes.
3. On the shared fixture, each tool and its UI action give the same record state and audit event type.
4. `resources/templates/list` names the resources above, and a person read as a viewer returns exactly the masked fields the viewer sees in the UI.
5. The existing `/api/envelope/mcp` tools answer at `/mcp` under their table names, and the old path stays an alias.
6. `/docs/agents` lists every tool, class, resource, event type and prompt in this section.

#### SURFACE-002 — Money calls carry their amount and counterparty

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Every call that moves money or changes what the company pays carries the money class with facts the server computes from the run, the destinations and the agency accounts on record.

**Acceptance.**
1. A run release carries money with the run's total debit in USD and its payee count; a destination never paid before makes the counterparty new, and paid destinations are known.
2. A deposit or remittance carries money with its amount and agency; the first payment to a newly issued account is new.
3. A rate, pay-item, deduction, garnishment or proration change carries money with the per-period amount it changes.
4. An argument or record text claiming a payment is internal, small or already approved leaves the computed class and facts unchanged.
5. Under "money autonomous up to $500, approval up to $10,000, blocked above", a $400 off-cycle payout runs, a $6,000 bonus run waits with no effect and a $20,000 run is refused.

#### SURFACE-003 — Filings, authorizations and correspondence carry commitment and external

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Every filing, signed authorization and outside message carries the commitment or external class, and every one an agent completes is attributed to the agent acting for its sponsor.

**Acceptance.**
1. Filing a return, report, new-hire report or claim response carries commitment · external with form, period and agency.
2. Preparing an 8655, state POA or debit mandate for signature carries commitment, and gated where the signature belongs to a named signer at Inkwell.
3. Sending a notice reply, a report link or a verification disclosure carries external with recipient count and counterparty.
4. Posting a journal to the connected ledger carries external with a known counterparty.
5. A filing or reply an agent completes reads "<agent> for <person>" in the filing record, the activity view and exports; after a person approves an agent's prepared filing, the record shows the person as approver and the agent as preparer.

#### SURFACE-004 — Sensitive reads and destructive erasure

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-006

**Requirement.** Reads and exports of regulated payroll data carry the sensitive class, and erasure carries destructive, with facts computed from the records touched.

**Acceptance.**
1. Reading or exporting SSNs, bank numbers, tax documents or named compensation carries sensitive with record count and kind; a masked read is standard.
2. A grant for a viewer role cannot read what that viewer cannot see in the UI, whatever the policy decides for the class.
3. An erasure request and the release of an eligible hold carry destructive · sensitive with the item count.

#### SURFACE-005 — Registrations and gated steps

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Registrations carry the accounts class, and steps an outside service keeps for a person are gated before they run, so they go to the named person instead of stalling an agent mid-task.

**Acceptance.**
1. A state or local registration submission carries accounts · commitment with its agency.
2. A bank-account verification, a person's step-up and an agency portal grant are gated with provider and step; the tool returns the step for the named person, and no agent call completes it.
3. A provider answer that requires a person (KYB or a signature) makes the call gated before any effect.

#### SURFACE-006 — Access, security, policy setup, Pause and audit

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-011

**Requirement.** Grants and credentials carry access and security, the company answers every Envelope class before agents act, and every agent call is audited with its classes and decision.

**Acceptance.**
1. Granting, widening or narrowing staff, firm or agent access carries access with direction and people count; an agent widening its own grant returns `self_escalation`.
2. Rotating a credential, changing step-up or replacing a provider credential carries security.
3. Before setup is answered, an agent call returns `policy_unset` with the setup link, and setup lists every class Envelope uses with no answer pre-selected.
4. Pause agents stops the next payroll call within 60 seconds.
5. The Agents page's counts by class and decision equal the audit rows for the seeded week.

#### SURFACE-007 — A payroll week under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-013 · *Rules:* D-1

**Requirement.** A stranger agent runs a seeded payroll week through MCP alone, for a named sponsor with the payroll-admin role, under two company policies.

**Acceptance.**
1. Given only the seed URL, the agent connects through MCP for the sponsor and lists the payroll tools.
2. Under the all-autonomous policy it imports the week's hours and typed tips, prepares and releases the run, remits the deposits, files the new-hire report and answers an SUI notice with no person involved: nothing waits for approval, nothing is refused by policy and the review feed is empty.
3. Under the held policy (standard reviewed, every other class approved by the test person), the same week waits at each money, commitment, external and sensitive call, and each runs once approved.
4. Under the held policy with money blocked, release and deposits return `policy_blocked` and the rest of the week completes.
5. In both runs every run, deposit and filing record names "<agent> for <person>", and any approval names the test person.
6. A missing local account in the week holds only that remittance under both policies.

## Push further

### Agents carrying payroll through to evidence

#### ENV-059 — Prepare every run and explain every changed paycheck

*Tier:* Core · *Rules:* D-1, D-2, D-5, D-6

**Requirement.** A scoped agent gathers approved time, tips, commissions, effective HR changes, prior pay and deductions; prepares a versioned draft, cites each person's delta and groups blockers by owner/deadline/money. It requests missing inputs through approved channels and updates the draft only from reviewed source versions. The run's release binds the exact resulting version under D-5; agent confidence never substitutes for source approval or a tax rule. Measure a fixed versioned 50-run corpus: 10 salary, 10 hourly, 10 tipped, 10 multistate/local, five retro/off-cycle and five contractor/mixed-worker runs with approved source inputs, effective changes and missing-account/discrepancy variants. At least 40/50 reach exact approval-ready review without payroll-admin typing, manual reconciliation or drafting; every person's delta has a cent-exact cited bridge and all 50 contain zero unsupported/uncited factual claims. Count every run and every person's decision. Missing facts stay assigned/unknown, never fabricated or excluded. A remittance-only exception leaves an otherwise correct wage run approval-ready with its exposure disclosed. This measures preparation work saved; it never counts an agent's step as a person's approval. For typed tips the agent reads settlement status and statutory shortfall facts, explains actual payday cash versus tips already held and the collection/reporting deadline, and preserves the approvable shortfall path. It cannot reclassify already-held tips into new pay, invent funds received or hold wages for employee tax insufficiency.

**Acceptance.**
1. Trigger the scheduled agent through the automation API for the shared employer, inspect a cited explanation such as overtime plus a Willow rate change, and resolve a missing input.
2. The draft recalculates once, unsupported claims stay unknown, and under the held policy an attempted release before approval sends nothing.
3. Change source data after review and show reapproval required at 1440/390.
4. Drive all 50 frozen cases through scheduled/public preparation and inspect reviews at 1440/390: at least 40 are approval-ready without admin entry, all delta amounts reconcile and every factual claim cites valid evidence.
5. Pending-account variants pay wages on time once the run is approved and hold only tax remittance.
6. A deliberately missing source becomes an honest unresolved item and cannot disappear from the denominator.
7. Include already-held/paycheck-tip, voluntary-funds and insufficient-wage cases in the frozen ten tipped runs.
8. Compare cited cash/tax bridges and approval readiness to ENV-082; a shortfall is disclosed without a false blocker or duplicated payout, and a promised contribution remains uncollected.

#### ENV-060 — Keep every jurisdiction whole before its deadline

*Tier:* Core · *Rules:* D-1, D-4, D-5 · *Register:* R-10

**Requirement.** A compliance agent reads approved people/location changes, the jurisdiction register, official rate publications, agency notices and deadline calendars; proposes required accounts, registrations, reviewed rate/minimum-wage updates and deposits/returns, follows submissions until agency issuance/acceptance and escalates waiting agency work before remittance deadlines while preserving timely worker pay. Rates, signatures and money carry their classes under D-5, and no agent invents a rule, exemption or registration. Measure preparation/follow-through on a fixed versioned 60-case official-schema registration corpus: one baseline for each of the 50 states and DC, plus nine local/reciprocity/move cases from the ENV-097 gating set. At least 80% must reach confirmed completion at the official-schema agency edge without owner clerical data re-entry or manual correspondence drafting, excluding only the approvals/signatures the company's policy and the agencies require; count those decisions separately and never remove slow/rejected cases from the denominator. Zero fabricated identifiers/closures are permitted. A fixed 365-day employer fixture spanning monthly/semiweekly/next-day deposits and quarterly/annual filings must have zero missed official due dates when supplied facts and exact approvals arrive before the documented cutoffs; late owner/agency inputs remain explicitly measured breaches/holds, not relabeled on-time outcomes. Missing registration or agency TPA authority holds only the remittance, with correct published-table/new-employer-rate calculation, timely wages and dated exposure. Registration/year fixtures measure wage timeliness separately from issuance and deposit/return acceptance; delay cannot be relabeled successful tax completion or cause late wages.

**Acceptance.**
1. Through the hire/move and agent task doors create Colorado and local-tax obligations, introduce a future rate change and hold an agency response.
2. Inspect cited proposals, exact approval, issued account/accepted filing and timed escalation; missing state/local agency authority holds only that deposit/filing, while correct withholding and worker pay still proceed on payday.
3. A generated confirmation cannot satisfy the register or calendar.
4. Import the frozen 60-case corpus through hire/move/registration doors, replay pending/rejected and issued agency responses, measure the full 60-case denominator and require at least 48 completed without extra owner clerical work, with every approval counted.
5. Drive the 365-day deadline fixture through public payroll/tax jobs and assert zero late deposits/filings for its timely-input path; a delayed approval/outage variant must surface/escalate the actual missed deadline rather than manufacturing success.
6. Use pending-account/grant variants in the fixed corpus/year fixture: wages arrive by payday while tax liabilities remain open/escalated.
7. After confirmed issuance and true-up approval, replay callbacks and prove one deposit/filing per held obligation, retaining actual missed tax deadlines.

#### ENV-061 — Prove each run to the cent and chase the cause

*Tier:* Core · *Rules:* D-2, D-3, D-5, D-6

**Requirement.** A reconciliation agent joins immutable payroll, source imports, bank/rail transactions, agency/recordkeeper/carrier acknowledgements and ledger entries, identifies root causes and prepares corrective proposals. It follows missing confirmations and unresolved balances to evidence, with an accountable human escalation. Additional debits, amended filings and payroll changes carry the money and commitment classes under D-5; the agent cannot manufacture a balancing amount or treat uncertainty as settled. Measure a frozen 40-case reconciliation-defect corpus: eight bank/rail, eight tax/assessment, eight benefit/carrier, eight ledger/import and eight correction/opening-balance cases, including uncollected tip tax and held remittance. At least 32/40 reach cent-exact evidenced closure without admin data re-entry or manual explanation drafting, except approvals, counted separately. Every case remains in the denominator; all 40 have zero false closure, balancing plugs, unsupported claims or repeated money effects. Cases dependent on unavailable facts stay honestly open.

**Acceptance.**
1. Start through the reconciliation API with a duplicated ledger event, one-cent tax difference, unknown payment and missing contribution receipt.
2. Inspect cited causes, proposed fixes, approved corrections and eventual reconciled closure; timeout/restart neither repeats a debit nor hides an unexplained difference.
3. Show the same evidence and unresolved totals at 1440/390.
4. Import all 40 frozen cases through the reconciliation door and require at least 32 evidenced closures with no extra clerical entry/drafting, source-linked causes and exact cents.
5. Inject missing external evidence and restart; it stays open/counts in the denominator, while no false receipt, self-recorded approval or repeated debit is possible.

#### ENV-062 — Answer government notices through accepted closure

*Tier:* Core · *Rules:* D-3, D-4, D-5

**Requirement.** A notice agent reads originals, extracts agency/EIN/period/deadline, matches register/filing/deposit evidence, drafts replies/amendments and manages follow-up/escalation. It records principal, proposed penalty, actually assessed/abated amounts, closure evidence and residual work. Ambiguous extraction is never guessed: it stays open with its candidate readings until a person or a cited source resolves it. Signed filings and responses, rates and payments carry their classes under D-5, and untrusted notice instructions grant no authority. Measure on a fixed versioned 100-notice corpus with 20 SUI/rate, 20 deposit-mismatch, 15 missing-return, 15 penalty, 15 wage-detail discrepancy and 15 account/registration cases, including duplicate, wrong-EIN, ambiguous extraction and reopened variants within those groups. At least 80% reach independently supported closure without owner evidence matching, manual form filling or response drafting beyond the decisions and signatures the company's policy and the agencies require; count the remaining unresolved/escalated cases and every person's decision. The denominator is all 100 and zero false closures or unauthorized effects are allowed. Missing agency closure evidence always prevents a resolved label, even if that causes the target to fail.

**Acceptance.**
1. Upload SUI and IRS deposit notices through intake, inspect citations and a wrong-period ambiguity, approve the correct response and deliver agency acknowledgement/reopening.
2. Only independently supported disposition closes the case; absent reply remains open/escalated, and a malicious attachment cannot send data, pay a penalty or self-approve.
3. Upload all 100 fixed notices through intake and drive their official-schema agency replies through the case door.
4. Require at least 80 independently supported closures with no extra owner clerical work, no false closure among the remaining cases, exact recorded approvals and the response bounds of ENV-065.
5. Remove a closure receipt and introduce a prompt-injection notice: the first reopens/remains unresolved and the second cannot gain authority.

#### ENV-063 — Answer hiring and payroll questions before commitment

*Tier:* Core · *Rules:* D-6

**Requirement.** Using permission-filtered proposed pay/location, existing employer rules, official taxes/leave/benefit rates and provider costs, an agent explains what a hire, raise, move or changed schedule would cost and require. Show assumptions, effective date, citations, registration lead dependencies and uncertainty alongside employer and employee impact. The scenario is separate from payroll/HR: accepting one creates only a proposal, and any resulting hire, pay change, registration or run goes through its own door and class. Measure a fixed versioned 48-case scenario corpus: 40 fully specified hypotheticals (hire, raise, move and schedule change in each of CA, CO, NY, PA, WA, OR, TX, NJ, OH and MA) plus eight labeled missing-input/unsupported-source/permission cases. Every fully specified estimate must equal an ENV-006 preview of the identical frozen hypothetical, employer/worker inputs, rule edition, dates and provider fees to the cent for all gross/net/tax/deduction/employer-cost lines; both include the same registration dependencies. Every assumption cites an authorized fact/rule or an explicit human-supplied scenario value. Incomplete cases must expose the missing fact/unknown and cannot output a fabricated precise total. All 48 have zero uncited assumptions, unauthorized disclosures or live mutations; count all cases and every person's decision. This is a target measurement, not a claim of achieved agent accuracy.

**Acceptance.**
1. Ask through the scenario route what a Colorado remote hire costs, compare two pay/benefit options and inspect cited tax/PFML/registration/cutoff assumptions.
2. Vary an input and get a reproducible changed estimate; a user without salary access cannot infer a coworker's pay, and accepting a scenario creates only a reviewed proposal with no money, filing or employment change.
3. Drive all 48 frozen cases through the public scenario route and the independent exact hypothetical-preview door without writing live payroll/HR.
4. Assert 40/40 complete estimates match every corresponding ENV-006 cent and source edition, with zero uncited assumptions across the full corpus; all eight incomplete/permission cases retain explicit unknown/refusal and no invented total.
5. Repeat dates/rule changes deterministically, inspect results at 1440/390 and require zero pay, filing, registration or employment effects until separately made through the proper door.

#### ENV-064 — Carry the switch to a clean first quarter

*Tier:* Core · *Rules:* D-4, D-5

**Requirement.** A migration agent reads authorized exports from all seven named providers, maps wage/tax/deduction histories and open obligations, explains mismatches and guides the parallel run, cutover and first combined quarter/year-end reconciliation. It follows missing source reports and prior-provider notices until the agreed owner closes them. Mapping, cutover, exact new runs and filing responsibility carry their classes under D-5, with cutover and filing responsibility as commitment; imported approvals/consents never become live power. The agent explicitly carries ENV-100 standing elections, verified account splits, recurring pay, leave, active orders/arrears and R&D credit carryforward into its first-run proof rather than merely matching historical totals. Measure a fixed 21-case migration corpus: three mid-quarter standing-setup variants from each of Gusto, ADP RUN, Paychex Flex, QuickBooks Payroll, Warp, Rippling Payroll and OnPay. Variants cover tipped hourly/POS, salaried/benefit near-limit and multistate/local/open-liability employers, using documented exports and source mappings. At least 17/21 reach approved reconciled cutover and an accepted first combined-quarter filing without payroll-admin re-keying of source fields or manual mapping/correspondence drafting; every person's review or decision is separately counted. All 21 have zero historical wage re-payments and zero silently omitted standing setup/open obligations. Missing export facts remain an explicit case failure/owned gap, not fabricated data or an excluded provider. The fixed Gusto migration cases include refund custody/recollection and confirmed W-2/1099 non-filing elections from ENV-102 and ENV-103. The agent follows actual bank/provider evidence and deadlines; it cannot assert an opt-out or count an initiated refund as available money, and recollection and filing carry the money and commitment classes under D-5.

**Acceptance.**
1. Invoke the migration agent through the public import route with a midyear provider register, local taxes, retirement contributions and an unresolved notice.
2. Resolve a cited missing field, reject an unexplained parallel difference, approve a reconciled cutover and inspect combined 941/W-2 and paid liabilities.
3. Repeat a source import and restart the agent: historical wages never re-pay and the old provider's remaining responsibility stays visible.
4. In the migration-agent journey use the complete standing-setup fixture and prove a correct first run without worker re-onboarding, plus the near-limit retirement, child-support arrears and pre-switch contractor amount cases from ENV-100.
5. Drive all 21 cases through authorized import, agent preparation, parallel payroll, reviewed cutover and first-quarter filing doors using each actual export schema; count at least 17 accepted cutovers/quarter outcomes without admin re-keying, inspect standing setup and every person's decision for every case, and prove zero historical re-payments under replay/restart.
6. An unexported bank mandate or unresolved prior liability remains an explicit failed/owned item rather than reducing the denominator.
7. Use ENV-102's pending/received refund and ENV-103's unconfirmed/confirmed annual-election variants in the three fixed Gusto corpus cases.
8. Inspect cited source events, one approved recollection/deposit and no annual original dispatch until the correct opt-out is confirmed; absent evidence remains a counted open failure rather than a fabricated successful cutover.

#### ENV-070 — Explain a worker's own paycheck with citations

*Tier:* Core · *Rules:* D-2, D-6

**Requirement.** An employee-facing scoped agent compares only that worker's current/prior stubs and permitted effective pay, hours, elections, taxes and deductions, explaining why net pay changed with line-level source citations and a cent-exact bridge. Distinguish a known rule/change from a missing or disputed input, offer a protected case draft under ENV-047 and preserve English/Spanish access. It acts for the worker and never beyond the worker's role: it cannot reveal another worker's compensation, offer an unsupported tax-adviser conclusion, edit elections/pay or approve a correction. The employee decides whether to send a case, and any resulting change goes through payroll's own doors and classes. For tip workers explain only their own already-held/paycheck tips, actual cash due, tax-withholding order, uncollected amount and deadline, citing the stub/register and official rule; distinguish volunteered versus actually receipted funds. Offer a protected case without collecting funds, authorizing a debit or claiming to provide individual tax advice.

**Acceptance.**
1. Sign in as employee at 1440/390 and ask why a check differs after overtime, a reviewed rate change and a retirement election.
2. Reconcile every explanation amount to the actual stub delta and linked source; ask in Spanish, remove one source and require an explicit unknown rather than an invented cause.
3. Attempt to ask about a coworker and embed instructions in a pay memo: no foreign data or mutation is permitted, and submitting the reviewed case creates one assigned obligation without changing pay.
4. Ask the low-cash-wage server why the stub shows little/zero new cash and a tip-tax shortfall before the cutoff.
5. Require a cent-exact cited explanation in English/Spanish at 1440/390, the correct voluntary-funds deadline and no claim that $600 already-held tips will be paid again.
6. A missing receipt remains unknown/uncollected and submitting a case changes no pay or bank authority.

#### ENV-106 — Worker paycheck questions measured on a fixed corpus

*Tier:* Core · *From:* ENV-070 · *Rules:* D-6

**Requirement.** Measure ENV-070 on a fixed 60-question worker corpus, 30 English and 30 Spanish: six topic groups (hours/overtime, rate/bonus change, benefits, tax/location/election change, typed-tip shortfall and correction/returned pay), five cases per language in each. Each group/language has four fully sourced answerable cases and one labeled missing/disputed/foreign-data or hostile-input case. At least 48/60 (24 in each language) must answer with complete cent-exact cited bridges and no payroll-admin explanation drafting. The remaining 12 require explicit unknown/refusal or a protected case proposal rather than an invented answer; they remain in the denominator. All 60 allow zero unsupported factual claims, foreign-data disclosures, unintended case sends, pay/election changes or money effects, including prompt injection. Count every outcome and any case decision the employee makes; never score a refusal as an answered bridge.

**Acceptance.**
1. Run all 60 frozen questions as their actual worker identities through the English/Spanish portal/agent door at 1440/390.
2. Require at least 48 cent-exact fully cited bridges, at least 24 per language, without admin drafting; compare every explanation amount/source to that worker's permitted register/stubs.
3. The 12 missing/hostile/foreign variants must remain honest unknown/refusals or unsent case drafts, with zero foreign-data exposure or unsupported claims in any response.
4. Revoke access and replay memo-injected requests: no mutation, unauthorized send or stale foreign record is returned.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | A funded production payday through the contracted rail: an employer-authorized funded run, its settled debit and confirmed employee receipt; sandbox success never claims live payday delivery | ENV-011, ENV-065 | not run | | |
| R-2 | Live agency access and real authorized submissions with agency acknowledgements: EFTPS deposits and IRS returns, SSA wage files, state and local returns, new-hire reports and UI claim responses | ENV-014, ENV-015, ENV-016, ENV-017, ENV-069 | not run | | |
| R-3 | A signed service agreement naming the actual legal service operator, originating bank or processor, reporting agent and filing transmitter, with its penalty and claim terms | ENV-065, ENV-049 | not run | | |
| R-4 | A staffed human service team on 08:00–20:00 Eastern weekdays with payday duty coverage through final processor cutoff, meeting the case clocks with real people | ENV-065, ENV-046, ENV-047 | not run | | |
| R-5 | Reconcile the coverage ledger against a licensed vendor tax catalogue (Symmetry Payroll Point/Tax Engine or similar) and add any official taxes it lists beyond the ledger | ENV-066, ENV-099 | not run | | |
| R-6 | A human screen-reader pass with VoiceOver or NVDA over the public, operator and portal journeys and the native clients | ENV-057, ENV-045 | not run | | |
| R-7 | A VPAT for the web app | ENV-057 | not run | | |
| R-8 | App Store and Google Play listings for the iOS and Android clients | ENV-045 | not run | | |
| R-9 | Provider applications and partner approvals granted for the named connectors (rails, recordkeepers, carriers, ledgers, HRIS, time and POS sources) | ENV-042 | not run | | |
| R-10 | Real agency confirmation of the ENV-060 registration corpus: accounts issued by the 50 states, DC and the gating local authorities | ENV-060 | not run | | |

## Boundaries

- Money movement, reporting-agent enrollment, tax engines, agency portals, provider applications, native clients and partner agreements are engineering obligations. Envelope remains its own product; shared code does not merge payroll with HR, time, accounting or practice management.
- **People and time:** [Willow](https://github.com/just-every/run-willow) owns employment records, HR onboarding/offboarding checklists, I-9, documents, leave policy/ledger and benefit enrollment; ENV-040 is the effective-dated acknowledgement handoff. [Lodge](https://github.com/just-every/run-lodge) sends hires through Willow. [Lanyard](https://github.com/just-every/run-lanyard) owns schedules, clock-ins, breaks, time approval and shift tip-pool calculations; ENV-008/009 own importing approved allocations, regular-rate premiums, withholding and payment. External BambooHR/Rippling/HiBob and named time providers are equivalent connections, not a reason to recreate their full product.
- **Finance:** [Pantry](https://github.com/just-every/run-pantry) owns ledger and AP; ENV-023 posts payroll journals/liabilities and ENV-013 shares payee identity and explicit 1099 ownership so AP-paid vendors stay Pantry's. [Easel](https://github.com/just-every/run-easel) owns headcount/compensation planning and reads permitted labor actuals; it cannot run pay. [Coaster](https://github.com/just-every/run-coaster) owns expense approval and its ACH; only an explicit company choice sends an unpaid reimbursement through ENV-036. [Purse](https://github.com/just-every/run-purse) owns suppliers/POs; Envelope pays people.
- **Practice, identity and automation:** [Blotter](https://github.com/just-every/run-blotter) owns firm client work/deadlines/billing; ENV-029/044 link to actual payroll operations here. [Auth](https://github.com/just-every/run-auth) authenticates, Envelope grants payroll roles. [Inkwell](https://github.com/just-every/run-inkwell) holds document signatures under ENV-037/044; a signature is not general payroll approval. [Crank](https://github.com/just-every/run-crank) orchestrates within scoped grants; ENV-030/052 enforce exact payroll authority.
- **Earnings sources:** [Gauge](https://github.com/just-every/run-gauge), [Plinth](https://github.com/just-every/run-plinth), [Glove](https://github.com/just-every/run-glove), [Mallet](https://github.com/just-every/run-mallet), [Strap](https://github.com/just-every/run-strap) and [Orbit](https://github.com/just-every/run-orbit) retain their job, commission and per-service records. ENV-041 imports approved earnings and returns restricted labor cost; it does not rebuild those products.
- **Regulated partners:** sponsor banks/ACH processors or embedded rails execute money movement, authorized reporting-agent/agency channels accept filings, recordkeepers receive retirement funds and carriers underwrite insurance. Envelope still owns setup, approval, deadlines, proof, reconciliation and exception completion. No broad bank charter, lending, tax-adviser opinion or insurance brokerage is implied by payroll software. Missing provider applications, production permission or unsupported rail coverage remain explicit unfinished obligations.
- **Separate employment models:** PEO co-employment goes to Justworks/TriNet or an equivalent separate service; overseas EOR goes to Deel/Remote. Benefits brokerage stays with a licensed broker/Willow-connected partner. US payroll for the employer's own workers remains complete; territories/non-US employee payroll are later markets, not silent omissions within the promised 50-state/DC/local target.

## Homepage claims

| # | Section | Claim | Clauses |
| --- | --- | --- | --- |
| 1 | 01 Hero | Turns hours, tips and salaries into every paycheck (gross to net for hourly, salaried and tipped staff) | ENV-006, ENV-008, ENV-009 |
| 2 | 01 Hero | Moves net pay and taxes on payday | ENV-011, ENV-035 |
| 3 | 01 Hero | Files every federal, state and local return | ENV-014, ENV-015 |
| 4 | 01 Hero | W-2s and 1099s | ENV-016, ENV-013 |
| 5 | 01 Hero | One bookkeeper runs four clients' payrolls (58 people) in one workspace | ENV-029, ENV-032 |
| 6 | 01 Hero, 07 | A contractor's TIN mismatch blocks payment until the W-9 is corrected and matched | ENV-013 |
| 7 | 01 Hero, 07, 13 | A new bank account is held, confirmed on the person's verified phone and approved before pay goes to it | ENV-004, ENV-034 |
| 8 | 01 Hero, 03, 04 | Child support and a creditor order withheld in priority order within the federal limit, then remitted | ENV-018 |
| 9 | 01 Hero, 08 | A remote move registers the new state's accounts (Colorado withholding, unemployment, FAMLI, Denver OPT) before payday | ENV-002, ENV-007, ENV-015, ENV-060 |
| 10 | 02 | Weekly, biweekly, semimonthly and monthly schedules side by side with an approval cutoff | ENV-005, ENV-011 |
| 11 | 02, 04, 05 | Each business owner approves their own run; the bookkeeper approves filings | ENV-028, ENV-034 |
| 12 | 02, 06 | Journals posted to QuickBooks Online and Xero | ENV-023 |
| 13 | 03 | Tipped minimum-wage top-up (Ohio $11.00 minimum, $5.50 tipped) | ENV-009, ENV-006 |
| 14 | 03, 09 | FLSA overtime at 1.5× over 40 hours | ENV-006 |
| 15 | 03 | A Saturday payday moved to Friday | ENV-005 |
| 16 | 03, 08 | One month's salary split between two states by workdays | ENV-007 |
| 17 | 03 | Every stub line linked to its rule and rate | ENV-006, ENV-070 |
| 18 | 04 | Hours and tips imported from Toast overnight | ENV-008, ENV-009, ENV-081 |
| 19 | 04 | The agent prepares the run and writes one plain line for every change since the last run | ENV-059, ENV-010 |
| 20 | 04 | Ohio new-hire report filed for a new hire | ENV-017 |
| 21 | 04 | A rate change carried from its effective date | ENV-033 |
| 22 | 04 | Stubs in Spanish | ENV-022 |
| 23 | 05 | A duplicated timesheet import is stopped before approval, with the people and the money at stake, and re-previewed after the fix | ENV-008, ENV-010, ENV-079 |
| 24 | 06 | Each run proven to the cent: register, bank debit, tax deposits, 401(k) remittance and ledger agree | ENV-038, ENV-061 |
| 25 | 06 | Bank funding of net pay, taxes and 401(k) | ENV-011 |
| 26 | 06 | EFTPS, Ohio and Columbus deposits accepted | ENV-014, ENV-015 |
| 27 | 06 | 401(k) contributions remitted to Guideline | ENV-019 |
| 28 | 08 | A jurisdiction register of every tax account with its dates | ENV-001 |
| 29 | 08 | Address change made in the employee portal | ENV-022 |
| 30 | 10 | Q3 Form 941 for four businesses filed and accepted by the IRS | ENV-014 |
| 31 | 10 | Ohio unemployment wage reports filed and accepted | ENV-015 |
| 32 | 11 | An IRS failure-to-deposit notice matched to the deposit, reply drafted, signed by the owner and closed with $0.00 owed | ENV-025, ENV-062, ENV-014 |
| 33 | 12 | A mid-quarter switch from Paychex Flex: year-to-date import and its last payroll rerun line by line to the cent | ENV-026, ENV-064 |
| 34 | 12 | The reporting-agent authorization (Form 8655) signed by the owner | ENV-037, ENV-014 |
| 35 | 12 | Planned Gusto and ADP RUN data migration | ENV-026 |
| 36 | 13 | Fri Nov 13: four runs, 60 people paid, the new client's first run | ENV-005, ENV-011, ENV-026 |
| 37 | 01 Hero, 13 | 100% free, open source alternative to Gusto, ADP RUN and Paychex Flex | ENV-026 |
| 38 | 12, 01 Run Envelope | One line starts Envelope on your computer (`npx -y @runeditrun/rer dev just-every/run-envelope`) | ENV-050 |

## Retired clauses

| ID | Now | Reason |
| --- | --- | --- |
| ENV-074 | moved to Base BASE-ACCESSIBILITY-001 | Its bar (accessibility-tree names, roles, states and live-region announcements at 1440 and 390) is Base's one accessibility bar, which ENV-057 and ENV-045 cite; its human screen-reader pass is register row R-6. |

## Status

Judged from the code and tests at commit `a503b84bab248aa332df3c17fd0f76f809946654` (27 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 1 | 0 | 0 | 1 |
| Target and push further | 4 | 36 | 71 | 111 |
| All | 5 | 36 | 71 | 112 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `ENV-055` | Declared external data and owner independence | published | done | Acceptance point 1: `tests/runtime.mjs` — the complete implemented journey sweep (payrollJourney, missingKeyJourney, allocationJourney, scheduleJourney, payItemsJourney, rulesJourney, approvalJourney, sponsoredJourney, identityJourney, leaveJourney, sourceIntakeJourney, incomeVerificationJourney, firmJourney, industryJourney, claimsJourney, newHireJourney, paperOnboardingJourney and archiveJourney), with `tests/privacy-recorder.mjs` — startRecordedWorker and browser observation, records every Worker and browser destination and rejects undeclared requests; existing provider-edge assertions prove exact minimized OpenAI and human-approved Resend payloads. Acceptance point 2: `tests/privacy-recorder.mjs` — finishPrivacyRecording and workerLog, invoked for every sweep group, inspect planted SSN, bank and credential values learned at public inputs across emitted client assets, request URLs and headers, external bodies, browser console and Worker logs; no telemetry destination is permitted. Acceptance point 3: `tests/payroll-runtime.mjs` — sponsoredJourney removes the actual stored OpenAI credential through owner settings, restarts the Worker, refuses re-enabling without a new key and refuses processing without fabricated analysis while exact human correspondence approval still works; the remaining implemented non-agent journeys run without AI credentials. Native journey screens at 1440 and 390. |  |
| `ENV-001` | Company and tax setup | target | partial | Acceptance points 1/4/5 (partial except history reload): `tests/payroll-runtime.mjs` — payrollJourney / COMPANY-SETUP, invoked by `tests/runtime.mjs`, proves native company setup, entered monthly/semiweekly schedules, encrypted effective profile/jurisdiction source history, masked entered account, stale/cross-company/exemption refusals, pending-account remittance-only register restrictions and WA/OR requirement derivation at 1440/390. Point 4: reloaded as-of history preserves provisional and entered assigned rates. Product schema: `docs/payroll-setup.md`. | Still unproved: complete applicable jurisdiction/risk-class coverage and source documents; lawful lookback/schedule derivation; WA/OR worker applicability and consistent elections/calculations; official withholding/new-employer SUI and correct payday wages; actual deadline-dated liabilities, penalty exposure and retained duties; ENV-002 confirmed issuance, reviewed true-up and once-only deposit/filing without repeated wages. Entered issued-evidence is not agency confirmation, and register restrictions are not calculated liabilities or payment receipts. Full wage/remittance proof additionally needs the owner-authorized ENV-011/065 rail/company; no such agreement or funded authorization is established by this run. |
| `ENV-003` | Employee and contractor onboarding | target | partial | `tests/payroll-runtime.mjs` — paperOnboardingJourney / PAPER-ONBOARDING, invoked by `tests/runtime.mjs` in the new-hires push shard: no-contact native person, encrypted signed paper W-4 and retained pre-2020 election, W-9, PA residency and Ohio IT-4 transcriptions, paper-check selection without bank account, exact human review and withdrawal, masked TIN reads, audited original download, attributed immutable district history, worker custody inventory and unsigned, stale, expired-review, wrong-session, non-owner and cross-company refusals. The recorded paper screens are captured at 1440 and 390. Keyboard upload and recording are exercised at 1440; keyboard exact review and withdrawal are exercised at 390. Each acceptance point requires an assertion at one test width. These captures do not prove every interaction at both widths, legal signature validity, delegated staff access, invitation linking or payment. Schema: `docs/paper-onboarding.md`. Additional bounded delegation evidence: `tests/payroll-runtime.mjs` — paperOnboardingJourney / PAPER-ONBOARDING exercises independently granted bookkeeper entry, payroll-administrator exact review and HR original downloads, masked retained versions, byte-exact federal and state originals, distinct entering and reviewing identities, attributed action and version audit, configured different-person review, policy-change invalidation, wrong-field and wrong-location refusals, foreign-company refusal, changed-version review refusal, revoked and re-granted old-session and token refusal, held staff refusal and audited native owner retrieval. Delegated entry, review, original-history and grant screens are captured at 1440 and 390 with visible control labels. This bounded increment does not discharge the full session, custody, invitation, legal or payment matrix retained in the CT Gap. | Still unproved: separately scoped staff paper entry, review and original downloads with distinct attribution, configured separation of duties and current revocation; authorized email and SMS invitation delivery, expired and forwarded invitation refusal and verified later linking to the same worker without duplicate setup or lost elections, history or custody; mobile self-service completion and taxpayer signatures; complete effective classification, employment, work and residence allocation and pay-policy setup; all required state and local certificates; legal sufficiency and authenticity of paper signatures and certificates, applicable effective-date and retention rules and complete original-document custody; bank authorization, verification and change protection; official IRS TIN matching with retained source and result, correction and lawful protective holds; payable eligibility and actual reviewed paper-check payment; IRS-notified lawful 24% backup withholding with named-human approval, official stop rules, $760 net payment, $240 liability and 1099 withholding reporting, without inventing authority from a generic mismatch; and paper-specific session and agent refusals, full audit attribution, statutory holds, eligible erasure, inactive archive restore and stale replay fencing. SMS remains unavailable. No authorized matching account or funded payment rail is established by this increment. Paper review confers no payable authority. Policy approval, provider boundaries, prepared records and attested originals supply none of the missing legal, carrier or payment proof. |
| `ENV-007` | Multi-state and remote workers | target | partial | Acceptance points 1/2 (partial): `tests/payroll-runtime.mjs` — allocationJourney / LOCATION-ALLOCATIONS, invoked by `tests/runtime.mjs`: native residence entry, employee change API, NJ-to-PA history, out-of-state earnings, scoped NJ-165 references, NY convenience/necessity/unknown cases, cent-preserving wage bases, sourced explanations, assigned contradictory/local holds, encrypted reload and stale/cross-company refusals at 1440/390. The same journey previews ordinary cash withholding for an actual pay period from official tables: NJ-WT tables A and B (published examples $4.21, $11.84 and $4.76), NYS-50-T-NYS (weekly single example $8.01, plus an immutable additional-withholding election), PA 3.07% rounded once per period with PA report wages, the NJ-to-PA move month allocated without a balancing plug, a NY convenience day holding PA withholding rather than guessing a resident credit, and Pittsburgh EIT/LST with the all-employer LST cap and a blank prior balance held, at 1440/390. Schema: `docs/payroll-allocations.md`. | Still unproved: obligation resolution and withholding beyond ordinary NJ/PA/NY cash wages and Pittsburgh; resident credits (a NY convenience day holds PA withholding); verified election custody; all-state/local coverage; complete taxability, report files and a true payroll preview with net pay, without balancing adjustments. PA EIT/LST outside Pittsburgh remains unresolved; computed amounts are previews, not reporting output or payments. The ENV-097 gating set's retained editions are not supplied, and full ENV-006 calculation remains engineering work. ENV-028/034 inherit current authority on future calculation/report/release doors. |
| `ENV-017` | New-hire and rehire reporting | target | partial | `tests/new-hire-runtime.mjs` — newHireJourney, invoked by `tests/runtime.mjs`: 102 mapped-directory hire and rehire cases, independent Pennsylvania missing-contact-name refusal and reviewed transferred-name assertion, New Hampshire overlength-name preparation and repair refusals with unchanged reviewed names in transfer, registered multistate election record, exact native-owner review, source-specific calendar deadlines and overdue state, portal transfer without a submission claim, observed rejection and reviewed repair, accepted confirmation history, hire and receipt replay, conflicting receipt and changed-election refusal, foreign-company refusal; empty, overdue, rejected, accepted and review screens at 1440 and 390. The coverage command names a removed Ohio directory and removed rehire schema case. Schema and limits: `docs/payroll-new-hire-reporting.md`. | ENV-017 remains PARTIAL. Required employee report fields and ordinary calendar deadlines are mapped for 51 directories; confirmation is human-attested evidence, not independent agency verification. Still unproved: complete official portal request and acknowledgement schema validation and full 51-directory execution; electronic batch schedules; authentic replay-safe agency callbacks; complete privacy and archive transport proof; authorized live submission receipts. Nationwide completeness intentionally fails. Generating an inventory and detecting a removed case do not execute the complete official deadline and submission matrix. Native overdue and rejected repair states and local replay refusals do not prove timely authoritative submission, independently supported acknowledgement or authentic replay-safe agency callbacks. Remaining custody proof covers report fields, retained versions, source and response evidence, review and approval records, transfer history, audited reads, held restrictions, inactive restore and lawful erasure with stale replay and older archive fencing. Policy approval supplies none of this missing evidence. |
| `ENV-027` | Effective rules and compliance calendar | target | partial | Acceptance points 1/2 (source/review/duty portion), 5 and 6 (source portion): `tests/payroll-runtime.mjs` — rulesJourney / RULE-EDITIONS, invoked by `tests/runtime.mjs`: native sourced rule proposals/exact named decisions, January effective-source boundary and historical editions, retained late internal deadline/backup duty, candidate people/drafts, date-scoped earnings-source invalidation with an unchanged prior-year snapshot, WA L&I/OR WBF/retro SUI source editions, and provisional FUTA excluded until a final-notice-backed reviewed version at 1440/390. Point 6 (pending approvals): approvalJourney / RUN-APPROVALS in `tests/payroll-approvals.mjs` publishes a revised WA L&I risk class and then a final CA FUTA edition; each voids only the pending run approvals for its own state, and the other run's approval is retained. Schema: `docs/payroll-rule-editions.md`. | Still unproved: complete federal/all-state/DC/local inventory and actual before/after pay/liabilities; complete multi-state/local/historical impact, pending-approval invalidation for OR WBF and a provisional-to-final FUTA change, full L&I/WBF/HI/FUTA calculations and original-run replay; delivered service escalation and human-approved lawful original/replacement wages received by payday while retaining missed internal deadlines. Sources and candidate impacts are not applied tax rules or payment receipts. Full coverage needs the ENV-097 and ENV-098 gating set's retained editions; wage receipt/service proof needs owner-authorized ENV-011/065 rail/company and contracted human coverage. ENV-006/034/046/066 inherit calculation, approval, duty and coverage obligations. |
| `ENV-031` | Industry and special-worker payroll | target | done | Point 1: `tests/industry-runtime.mjs`, industryJourney, creates retained farm and office earnings, H-2A, nonprofit, minister housing, seasonal and S-corporation worker classifications through company routes with exact human review, effective evidence and cent-exact federal checks. Point 2: `tests/industry-forms-journey.mjs`, industryFormsJourney, proves protected reviewed 941 and 943 exports against independent official AcroForm schemas, classification changes, preserved originals and reviewed 941-X and 943-X consequences; `tests/fixtures/irs-forms/f941-2026.json` and the three companion official field trees are the schema edges. Point 3: industryJourney proves resident and nonresident, qualifying and nonqualifying student and sole-proprietor family comparisons, expired evidence refusal and no blanket industry exemption. Both journeys inspect the built pages at 1440 and 390; `docs/industry-forms.md` documents the actual official export boundary. |  |
| `ENV-032` | Multiple companies without crossed liabilities | target | partial | Acceptance point 1 (partial): `tests/multi-company-runtime.mjs` — multiCompanyJourney / MULTI-COMPANY, loaded in the industry push shard by `tests/runtime.mjs`, creates two EINs with the same synthetic worker represented by distinct employer records, distinct encrypted unverified funding references and exact source-bound plans; independently asserts separate federal withholding, net preparations and prepared 941 forms, correction replacement and company, location and sensitive-field filtered combined labor totals. Same-ID corrections retain the prior approved wages while pending, then count the newly approved revision exactly once with its corrected employer tax; distinct-ID corrections also replace their approved predecessor. Existing company and return screens are captured at 1440 and 390. These are unpaid preparations, not deposits, paid runs or filed forms. Acceptance point 2 (partial): the same journey asserts no-write refusals for foreign workers, runs, accounts, funding plans and form selections, stale account or run versions, unproved identity, unavailable release and revoked sessions. `tests/archive-runtime.mjs` — archiveJourney, with foreignFundingArchive in `tests/archive-relationships.mjs`, round-trips retained funding history and refuses independently checksummed and authenticated foreign-employer run and account references before publishing any rows. Schema and limits: `docs/multiple-companies.md`. | Still unproved: separately scoped staff funding preparation and bank administration with current revocation, distinct attribution and configured separation of duties; verified distinct bank accounts and debit mandates; actual separately funded payroll payments, deposits, complete tax registers and year-end forms; reviewed shared-paymaster and successor treatment; the complete permission-filtered consolidated report and cross-company payment, record and archive refusal matrix; and complete funding-specific statutory custody, eligible erasure, inactive restore and uncertain-effect reconciliation. No owner-authorized funded rail or employer agreement is established here. Federal check and form preparations, masked references and policy approval do not prove bank verification, payment, deposit or filing. Every original acceptance outcome remains owed; no scope is carved out. |
| `ENV-005` | Pay schedules and deadlines | target | partial | Acceptance points 1/2 (calendar portion), 3 and 4 (reference scoping only): `tests/payroll-runtime.mjs` — scheduleJourney / PAY-CALENDARS, invoked by `tests/runtime.mjs`: native proposals for four frequencies, Friday bank-holiday earlier policy, 167/169-hour DST weeks, NY manual biweekly refusal, exact-worker/date exception references, stale revisions and no disconnected processing offers at 1440/390. Schema: `docs/payroll-schedules.md`. | Still unproved: actual verified agency exceptions and every worker/state/occupation frequency rule; payable schedule/run binding and material date-change approval invalidation; actual current ENV-086 standard/two-day/next-day/same-day eligibility, Eastern/local approval/funding cutoffs, fees, elapsed-cutoff exclusion, grant/revocation transitions and reapproval. Calendar settings are proposals only. Full current rail proof requires owner-signed ENV-011/065 provider/company authority; no authorized employer/run speed connection is established. All-state frequency inventory under ENV-098 remains unsupplied. |
| `ENV-006` | Explainable gross-to-net engine | target | partial | `tests/calculation-runtime.mjs` — calculationJourney, invoked by `tests/runtime.mjs` in push Verify: authenticated hypothetical preview, dated federal amounts and caps, 51 independently calculated ordinary jurisdiction withholding cases with Ohio and Vermont processing-reference boundaries, weighted multiple-rate overtime, approved California meal and rest premiums with a production bonus, ordered federal tip-tax shortage, named unmapped coverage holds, unsafe deduction refusal and retained 2025 federal replay, unchanged replay after Worker restart, all-state SUI reference inventory, explicit assessment gaps and native staff and revocation refusals. API: `docs/payroll-calculation.md`. | Still unproved: complete gross-to-net calculation and cent-level official goldens for federal, all 50 states, DC and every ENV-097 gating authority, including every ENV-098 program, annual cap and effective boundary; complete earning and deduction taxability, original state-table reconciliation for the retained Ohio and Vermont processing references, all current state certificates and withholding elections, daily and special-rule overtime, historical checks after a table update, reviewed custom codes, pending-account pay and assigned or new-employer SUI controls; actual human approval, complete stub and register, lawful cash or zero-cash payday completion and official reporting of tip-tax shortfalls. The current owner-only door is a stateless hypothetical calculation with no payment authority; complete payroll preparation and delegated authority remain owed. Complete net remains unavailable while any location or program is unmapped. The 688-entry large-local file remains engineering work; Symmetry reconciliation is field proof R-5 and never a licensing hold. |
| `ENV-076` | Nonresident aliens and person-specific tax exemptions | target | missing |  | No implementation exists; the complete explainable gross-to-net engine behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-077` | IRS lock-in letters bind withholding | target | missing |  | No implementation exists; the complete explainable gross-to-net engine behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-078` | Washington L&I and Oregon WBF in every paycheck | target | missing |  | No implementation exists; the complete explainable gross-to-net engine behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-008` | Approved hours and earnings from connected sources | target | partial | `tests/run-intake.mjs` — runIntakeCases, loaded by sourceIntakeJourney in `tests/payroll-runtime.mjs` and the push workspace shard: bounded provider cases import reviewed Lanyard exported batches and Toast Labor time-entry captures through the run door with explicit source-worker and workweek mapping, retained source digest, identical replay, duplicate-run and unknown-worker refusals, stale preview refusal, immutable prior run and local approval withdrawal; all ten named adapters execute bounded five-day reviewed workweeks (Deputy, When I Work, Clockify, Square, Homebase, 7shifts, QuickBooks Time and Clover with replay, corrections, frozen prior earnings and local withdrawal, and incomplete-page and missing-identity refusals without version writes). Selected refusal screens are captured at 1440 and 390. `tests/lanyard-exports.mjs` — lanyardExportCases, invoked by runIntakeCases: signed original and correction batches reconcile separate job allocations, worked minutes, employer-entered PTO, source sick and holiday pay, explicitly mapped premium additions and held tips; the native preview form applies the exact correction with screens at 1440 and 390; changed, repeated and orphan exports refuse without writes; both original and corrected earnings remain retained; batch replay and a second-run claim cannot duplicate pay; native source withdrawal refuses another earnings version; linked correction records may have lower per-record revisions, and renewed premium decisions reconcile without a timesheet edit while stale decisions refuse. `tests/clockify-leave.mjs` — clockifyLeaveCases, invoked by runIntakeCases: explicit paid and unpaid mappings for locked Clockify non-work entries, exact native-declared cents, changed source project mapping and job allocation, correction and frozen prior earnings, replay, duplicate-run and untyped or unpaid-money refusals without writes. The signed and non-work captures are included in eligible erasure and remapped source replay refusal. The Toast portion of runIntakeCases also refuses stale job mappings, applies a job-only difference with fresh review, retains the original job assignment and changes no hours or money. `tests/payroll-runtime.mjs` — sourceIntakeJourney also binds all six sibling earnings to one run, retains a corrected commission on that same run and refuses a second run without writes. `tests/archive-runtime.mjs` — archiveJourney, with `tests/intake-custody.mjs`, `tests/archive-erasure.mjs` and `tests/archive-adoption.mjs`, retains original and corrected Lanyard and Toast captures, restricts held reads, erases eligible captures and refuses remapped replay; a real older archive is refused with the later journal, while retained captures and exact signed history round-trip without preparation or approval authority. These are official-schema human-reviewed captures, not authenticated source synchronization. Product boundary: `docs/run-earnings-intake.md`. | Still unproved: complete source coverage for all ten named adapters including complete leave and job allocations beyond the bounded Clockify, Lanyard and Toast cases, service wages already paid or needing reconciliation and every promised earning code; signed Lanyard corrections cover ordinary time, employer-entered PTO and tips, source sick and non-work holiday pay, explicitly mapped source premium additions, and meal and rest premium units, while classified overtime adjustments and remaining source earning families remain unproved; authenticated connected source approval and revocation and complete source mapping and reconciliation; complete source-specific custody, statutory retention, eligible erasure and inactive archive restore. No live connection or payment is claimed. |
| `ENV-079` | In-run grid and spreadsheet earnings | target | partial | `tests/run-intake.mjs` — runIntakeCases: three-worker native manual entry; downloadable CSV, XLS and XLSX templates with explicit column mapping; changed, blank-preserved and explicit-zero cells; source identity, file digest, editor and distinct review attribution; identical replay and concurrent duplicate-source refusal; immutable prior earnings after correction; independent two-workweek federal overtime component with a nondiscretionary bonus; separate fractional WA risk classes and OR assessment minutes. `tests/payroll-approvals.mjs` — approvalJourney refuses release after adding intake to an already approved run and after a subsequent correction. `tests/earnings-intake.mjs` — earningsIntakeJourney: native manual entry for three people, CSV/XLS/XLSX uploads, blank versus explicit zero, unchanged replay, before-and-after correction, two WA risk classes and OR partial assessment minutes kept apart from wage hours, and a $2,295 two-workweek gross without averaging, with screens at 1440 and 390. API and boundaries: `docs/payroll-intake.md`. | Still unproved: complete worked-time and leave intake, all required one-off earning treatment, regular-rate and jurisdiction overtime calculations, and assessment elections and downstream calculations; complete refused-cell repair presentation. The native federal weekly overtime component covers only reviewed nonexempt ordinary complete workweeks with explicit nondiscretionary bonuses or commissions. Tipped and premium overtime and mixed or incomplete remuneration remain held. |
| `ENV-080` | California meal and rest premiums | target | partial | `tests/run-intake.mjs` — runIntakeCases independently checks bounded California meal and rest premium units with 40 worked hours and an $80 nondiscretionary bonus: $12 per premium, $504 total earnings, no fabricated hours, identical replay, duplicate-day refusal and an exact corrected $492 version while retaining $504 history. | Still unproved: complete official meal and rest premium treatment beyond the bounded ordinary California case, including regular-rate treatment in a calculated run (ENV-006). |
| `ENV-081` | Typed tip settlement at every intake | target | partial | `tests/payroll-approvals.mjs` — approvalJourney / RUN-APPROVALS: bounded native manual and mapped CSV tip intake with exact preview and apply, stable source identity, replay without another revision and encrypted retained corrections; the $600 already-held and $300 paycheck-tip fixture changes gross cash earnings by only $300, and changing only settlement invalidates the earlier exact approval without overwriting its frozen run. `tests/run-intake.mjs` — runIntakeCases retains $600 held and $300 paycheck-tip totals from Lanyard, Toast, Homebase, 7shifts and Clover captures with settlement-only diffs. `tests/earnings-intake.mjs` — earningsIntakeJourney refuses an ambiguous tip. Schema and limits: `docs/tip-intake.md`. | Still unproved: a valid statutory tip-shortfall payday path (ENV-082), so a fully typed shortfall run is not yet shown unblocked; complete payroll calculation. No live connection or payment is claimed. |
| `ENV-009` | Tips, tip credits and tip reporting codes | target | partial | `tests/payroll-approvals.mjs` — approvalJourney / RUN-APPROVALS proves the bounded native intake and earnings-preparation portion only: $600 already held and $300 owed remain separate, identical source replay adds no tip, held money is excluded from new gross cash earnings, settlement corrections require a new run and fresh approval, and release refuses with no calculated taxes or payment rail. `tests/earnings-intake.mjs` — earningsIntakeJourney: the native manual grid and all three spreadsheet formats retain $600 already-held tips and $300 paycheck tips with a $900 reported-tip basis and only $300 new tip cash; review screens at 1440 and 390. Boundaries: `docs/tip-intake.md`, `docs/payroll-intake.md`. | Still unproved: approved Lanyard and POS pools, voluntary-tip and mandatory-service-charge treatment, lawful tip credits and minimum-wage top-ups, bonus overtime, Form 8846 inputs, final 2026 W-2 TP and TT and Box 14b occupation schemas with multiple occupations and corrections; complete grid and Toast intake and actual once-only payday payment. Ordinary payroll tax on tips remains owed. Complete source-specific custody, holds, erasure and inactive restore remain unproved. Complete gross-to-net and an owner-authorized funded rail are not established; no employee receipt, live payday, legal filing effect or agency acknowledgement is claimed. |
| `ENV-082` | Tip-tax shortfall paid on payday | target | partial | `tests/run-intake.mjs` — runIntakeCases, invoked by sourceIntakeJourney in `tests/payroll-runtime.mjs`, asserts an independent $42.60 wage and $600 held-tip federal fixture: regular-wage-first ordering, cent-exact collected and uncollected Social Security and Medicare, unchanged full employer shares, zero net cash, provisional 941 lines 5b, 5c and 9, 944 line 6 and W-2 A and B; a $300 paycheck-tip control; January 31 report receipt, February 9 employer-attested actual funds, promise, repeated-receipt and concurrent over-allocation refusal and the February 10 collection boundary; and a $6,000 held-tip high-YTD Additional Medicare control. These are source-bound API calculation preparations, not paid payroll, final filing schemas, stubs or portal delivery. Product semantics: `docs/tip-tax-previews.md`. | Still unproved: Publication 15 ordering, cent-exact collected and uncollected employee taxes and full employer share in a complete calculated run; truthful zero-cash payday completion without a transfer; stub, register and portal visibility; final 941 and 944 and W-2 A and B schema execution and year-end corrections; complete jurisdiction and person-specific collection treatment and independent received-funds verification; excessive-garnishment refusal in a calculated run. The existing uncalculated-tip hold remains; this increment does not establish the approvable statutory-shortfall path. Native federal preparations cover ordinary reviewed resident employees at Texas workplaces in 2026 only. Full payment proof additionally requires the owner-authorized rail and company under ENV-011, ENV-035 and ENV-065, not established here. |
| `ENV-083` | Form 8027 and allocated tips | target | missing |  | No implementation exists: per-location 8027 eligibility, allocation thresholds, approved lower rates, allocation methods, final schemas and W-2 box 8 without duplicated cash, withholding or TP remain to be built and proven. |
| `ENV-010` | Pre-run checks and understandable preview | target | missing |  | No implementation exists; the complete pre-run checks and understandable preview behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-012` | Off-cycle, correction and final pay | target | missing |  | No implementation exists; the complete off-cycle, correction and final pay behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-020` | Leave pay and payroll accruals | target | partial | `tests/payroll-runtime.mjs` — leaveJourney / LEAVE-LEDGER, through `tests/runtime.mjs`: point 1 (partial), reviewed Willow sick-leave reservation and cent-exact earnings preview with original owner/source; point 2 (partial), standalone work-derived accrual before/on hire anniversary, cap/carryover, unpaid absence without paid-bank depletion, stale-proposal recovery and termination amount; point 3, replay, old-owner and unreconciled-transfer refusals, preserved source identities and difference-only work corrections. Independent sick, PTO and holiday banks: `tests/payroll-runtime.mjs` — leaveJourney proves isolated policy, accrual, carryover and owner transfer, matched Willow leave correction, replay and cross-bank source refusal, exact preview bindings and legacy-bank exclusion. Native opening, review and completed screens at 1440 and 390. `tests/payroll-runtime.mjs` — sourceIntakeJourney also proves approved Willow leave handoff, replay and difference-only source correction in the real preview. `tests/payroll-runtime.mjs` — leaveJourney additionally proves selected California accrual policy floors, long-day cap protection, cumulative fractional work accrual, difference-only correction, replay and unused year-boundary carryover, with opening, review and completed screens at 1440 and 390. API: `docs/payroll-leave.md`. | Still owed: complete lawful state and local rate and policy coverage (the selected California one-per-30 accrual method now validates the balance floor and carryover only), actual paid run and pay stub, returned HRIS consumption/balance receipt and reconciled payroll/ledger correction after settlement. Payroll calculation (ENV-006), stubs (ENV-022) and the owner-authorized ENV-011/035/065 rail remain prerequisites. The current ledger reserves leave for preview; it never labels it paid. |
| `ENV-033` | Configurable pay items and reviewed bulk changes | target | partial | Acceptance points 1/2 (partial): `tests/payroll-runtime.mjs` — payItemsJourney / REVIEWED-PAY-ITEMS, invoked by `tests/runtime.mjs`: native group/item/bulk review, taxable allowance/accountable-plan distinction, invalid-code/stale-source refusals, withdrawal and immutable earnings; per-person first scheduled period/base-earnings before/after/delta/totals, application of only the reviewed rates, and refusal after a new work-source ID changes a pending comparison at 1440/390. Undo before dispatch: approvalJourney / RUN-APPROVALS in `tests/payroll-approvals.mjs` approves an exact hourly run through ENV-034 and proves that withdrawing its reviewed rate setup voids the approval before release. Schema: `docs/payroll-pay-items.md`. | Still unproved: complete custom earning/deduction taxability; recurring substantiation/one-time consumption; full tax/net/payment-eligibility bulk diffs (first-period base-earnings comparisons are implemented); a linked correction after settlement; complete first payable run and ENV-035 dispatch. Actual settlement/correction proof requires owner-authorized ENV-011/035/065 rail/company. No settlement flag or generated receipt exists. |
| `ENV-084` | Salaried proration by a chosen method | target | partial | `tests/payroll-runtime.mjs` — payItemsJourney / REVIEWED-PAY-ITEMS proves effective human-chosen calendar/workday/hour policies, Jan 16 calendar $5,161.29 / workday $5,000.00, named method/count/rate detail, unpaid Saturday unchanged, personal partial-day hold versus coded FMLA preview, retained earlier methods/original earnings and explicit approve/release refusals with no decisions at 1440/390. The same journey prorates a mid-week California exempt discharge (13 of 22 March workdays, $5,909.09) and holds final-pay-deadline because wages are due that day under Labor Code §201(a); an unknown separation type is held (final-pay-separation-review). Schema: `docs/payroll-pay-items.md`. | Calendar-day salary proration previews stay under the named proration hold (RL-9): never approved, payable or dispatched, and no deduction is authorized. Still unproved: verified leave/plan custody and stricter work-state exempt rules; same-day final payment under ENV-012 (the proportional final week and the California deadline are computed and held; other states are held for a person); linked post-settlement rate/date corrections. ENV-034 exact approval exists for hourly runs; salary previews stay unapprovable under the interim hold. |
| `ENV-004` | Verified direct deposit and protected bank changes | target | missing |  | No implementation exists; the complete verified direct deposit and protected bank changes behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-011` | Approve, fund and pay on payday | target | missing |  | No implementation exists; the complete approve, fund and pay on payday behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-085` | Over-limit funding by verified wire or prefund | target | missing |  | No implementation exists; the complete approve, fund and pay on payday behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-086` | Rail speeds offered as granted | target | missing |  | No implementation exists; the complete approve, fund and pay on payday behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-013` | Contractor pay and information returns | target | missing |  | No implementation exists; the complete contractor pay and information returns behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-087` | International contractor payouts | target | missing |  | No implementation exists; the complete contractor pay and information returns behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-034` | Approval binds an exact current transaction | target | partial | Acceptance points 2 and 6 (proven at run level) and 1 and 5 (partial): `tests/payroll-approvals.mjs` — approvalJourney / RUN-APPROVALS, invoked by `tests/runtime.mjs`: an owner-only two-person threshold through exact review; immutable run versions binding payees, bank-record versions, period and pay date, earnings, deductions, rule editions and known debit; each approval records approver, role, grant version, native session, time and content digest. Point 2: threshold bypass (one approval above the threshold, client approval fields), self-second-approval, a copied review, a restored identical version and MCP/bearer agent approval are refused with zero approvals, audit or outbound messages, and no agent tool can approve or release. Point 6: a revised WA risk class voids only the WA run's approval while the CA run's approval is retained; a final CA FUTA edition then voids the CA run, whose new version needs fresh approval. Point 1 (partial): pay-rate, edited and newly added source hours, bank, pay-date and approver-grant changes each void a current approval before release, and so does withdrawing the reviewed rate setup; a release or an approval racing an edit never survives the edit, and the audit door names each approver and exact version. Point 5 (binding): in a mixed cash/paycheck-tip run, changing one tip's settlement type or its employee-furnished funds voids the approval, and the revised payout ($230.00 to $200.00) is a new version that needs fresh approval, at 1440/390. Schema: `docs/payroll-approvals.md`. `tests/payroll-approvals.mjs` — approvalJourney / RUN-APPROVALS proves current exact earnings-run approval with WebAuthn user verification through a virtual authenticator, a separate human session following an MCP reference link, distinct human and presenting-credential attribution, signed OIDC Core ID-token MFA schema assertions, and model text, confirmation, spoofed human flag, stale challenge, foreign origin, wrong audience, old authentication, foreign subject, revoked link and agent approval refusals without dispatch. Existing review and refusal screens run at 1440 and 390; every control has visible words. This is an uncalculated native earnings run, not a bonus payroll or payment receipt. | Salary proration previews stay unapprovable under ENV-084's interim hold. Still unproved: delivery of only the unchanged authorized version to a provider when release races an edit; cancellation through the rail's own protocol before its deadline, with requested, confirmed, too-late and unknown states and race reconciliation; tax on tips and the uncollected-tax computation (ENV-082, ENV-006); provider recalculation. Rail delivery and cancellation proof require the owner-authorized ENV-011/035/065 rail and its sandbox. |
| `ENV-035` | Real rails and uncertain effects reconciled safely | target | missing |  | No implementation exists; the complete real rails and uncertain effects reconciled safely behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-036` | Pay cards, urgent pay and reimbursement choice | target | missing |  | No implementation exists; the complete pay cards, urgent pay and reimbursement choice behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-088` | Earned-wage access through a contracted partner | target | missing |  | No implementation exists; the complete pay cards, urgent pay and reimbursement choice behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-002` | State and local registration agent | target | missing |  | No implementation exists; the complete state and local registration agent behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-014` | Federal deposits and employment returns | target | missing |  | No implementation exists; the complete federal deposits and employment returns behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-089` | FUTA credit reduction on Schedule A | target | missing |  | No implementation exists; the complete federal deposits and employment returns behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-015` | State, local, paid-leave and disability filings | target | missing |  | No implementation exists; the complete state, local, paid-leave and disability filings behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-090` | State-fund and assessment reports and payments | target | missing |  | No implementation exists; the complete state, local, paid-leave and disability filings behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-016` | Year-end W-2, W-3 and corrections | target | missing |  | No implementation exists; the complete year-end w-2, w-3 and corrections behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-071` | SSA name and SSN verification for accurate wage reports | target | missing |  | No implementation exists; the complete ssa name and ssn verification for accurate wage reports behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-018` | Garnishments, levies and remittances | target | missing |  | No implementation exists; the complete garnishments, levies and remittances behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-019` | Pre-tax deductions, retirement and state savings | target | partial | `tests/retirement-benefits-runtime.mjs` retirementBenefitsJourney: native exact-version election review and held contribution previews; independent 2025 and 2026 combined traditional and Roth limits, other-plan prior contributions, age and income catch-up, employer match and annual caps; corrected sources invalidate pending preparation; replay, restart, foreign-company, agent, non-owner, changed authority and erased-worker refusals. `docs/retirement-preparation.md` defines the bounded public doors and source editions. | Still unproved: Section 125, HSA and FSA, SIMPLE IRA, complete eligibility and effective-plan coverage; corrected settled payroll; contribution and census synchronization and accepted files and funds at Guideline, Human Interest, Vestwell, Betterment at Work and Ubiquity; mandated auto-IRA registration, exemption and contribution outcomes including California opt-out. Native proposals establish neither collected deductions nor provider acceptance. Owner-authorized rail, employer tenant and provider access are not established; official-schema reconciliation remains implementation work. The standing conservative default restricts these new preparation doors to the current native owner; scoped staff and agent preparation and provider boundaries remain owed pending applicable scope approval. |
| `ENV-091` | Commuter, dependent-care and HRA reimbursement treatment | target | missing |  | No implementation exists; the complete benefits, retirement and state savings behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-092` | 403(b), 457(b) and SEP contributions | target | partial | Bounded calculation and reporting-data portions of acceptance points 1 and 2: `tests/extended-retirement-runtime.mjs` — extendedRetirementJourney, registered in the industry push shard by `tests/runtime.mjs` and `verification.json`, exercises real private company and worker benefit setup, exact native human review and retained proposals; independent 2025 and 2026 IRS-derived limits, qualified 403(b) service-before-age catch-up and traditional and Roth splits, shared elective and annual-addition limits, governmental and nongovernmental 457(b) combined employer and employee ceilings, age and special catch-up exclusions, SEP employer-only limits, and prepared E, BB, G and EE fields only for applicable arrangements. It checks over-limit and custom-code refusals without changed records, stale review and changed-source invalidation, replay, restart, encryption, attributed audit, foreign-company and non-owner refusals, current-session revocation and bounded local retention classification, explicit release, erasure and stale-source recapture refusal. The existing company calculation-preview door retains jurisdiction holds, ordinary taxes and zero actual deductions while exposing the separate held proposal. The same journey binds preparation to the actual approving session and company grant revision, refuses revoked or expired review authority even from a current separate session, requires fresh reviewed source after authority changes, and freezes new setup, review, approval and both preview doors while a privacy request is held without changing its retained inventory. `tests/archive-runtime.mjs` — archiveJourney, with `tests/extended-retirement-runtime.mjs` — extendedRetirementArchiveFixture and `tests/archive-adoption.mjs` — archiveAdoption, checks actual native export and restore of exact encrypted retirement sources, employer proposals and approval provenance; old credentials and newly adopted history access cannot reactivate preparation. Scope and retained official sources: `docs/extended-retirement.md`. | Still unproved: complete independently established actual-plan eligibility, effective-plan coverage and benefit-specific source custody, scoped staff delegation and the complete benefit-specific statutory retention, erasure and inactive-restore matrix; accepted provider contribution receipts and funds, corrected settled payroll and complete deduction, pay-stub and year-end integration at each applicable recordkeeper. Owner-authorized rail and company access and recordkeeper access are not established; existing calculation, catalog, rail and filing-authority holds remain unchanged. The interim conservative default restricts these preparation routes to the configured native owner; broader scoped authority and provider boundaries remain owed. Prepared reporting fields are neither delivered W-2 forms nor provider acceptance. Proposed SEP employer contributions never establish employee elective deductions. Neither original acceptance sentence is proved as a complete outcome; no obligation is carved out. |
| `ENV-093` | Hawaii TDI and Prepaid Health Care employee shares | target | partial | `tests/hi-benefits-runtime.mjs` hiBenefitsJourney through the private company evidence and calculation APIs: independently worked 2026 DLIR weekly and monthly goldens, half-cost and wage ceilings, split weeks and multiple monthly periods, prior collections, plan-specific dependent allocation, owner-paid premiums, missing evidence and expired HC-5 refusals, exact source corrections, stale review, replay, encrypted restart, scoped and revoked access, and eligible erasure with stale capture refusal. `docs/hawaii-plan-shares.md` describes the held evidence boundary. | Native reviewed evidence and proposed 2026 shares only. Still unproved: actual approved-plan authenticity and complete eligibility; authorized Willow, benefits administrator and insurer synchronization; complete source and migration custody; corrected paid stubs, actual deductions and refunds, employer funding and accepted insurer remittance; full year and effective-rule history. Existing carrier, calculation catalog and owner-authorized company and payment-rail holds remain unchanged. Native evidence review does not establish plan approval or coverage. Conservative interim default: configured native owner only, with no automatic outbound, destructive or payment action; scoped delegation and provider boundaries remain owed under the standing scope policy. |
| `ENV-094` | New York DBL plan contributions | target | partial | `tests/ny-dbl-runtime.mjs` — nyDblJourney, loaded by `tests/runtime.mjs` in the industry push shard: native source-bound statutory plan and worker premium preparation with exact human source review; independent WCB-derived $100 and $200 weekly goldens of 50 and 60 cents, two-week 120 cents, same-week split checks sharing 60 cents across restart, remaining attributable premium capped at 25 cents, supplied documented concurrent $200 and $100 earnings yielding 40 and 20 cent proposals without foreign tenant reads, and a migrated 40 cent opening collection leaving at most 20 cents. The same journey proves source correction history and stale-review refusal, replay without duplicate reservation, employer-paid zero proposals, unsupported enhanced plans and tax-agency recipients refused without writes, separately identified DBL results in the held native calculation preview, current-owner and revoked-session refusals, encrypted source references, attributed decisions, and eligible local erasure of the new worker evidence and proposal graph with stale replay refused. Product schema and statutory sources: `docs/ny-dbl.md`. | Still unproved: genuine approved plan and carrier or Board-approved self-insurance evidence; complete authoritative carrier or Willow source import and migration custody for plans, elections, premiums, prior weekly and cumulative collections and recipients; source authenticity and legal sufficiency of supplied concurrent earnings and employee requests; actual capped collection and refund, corrected paid stubs, employer funding and accepted private-carrier or NYSIF remittance with invoice and balance reconciliation; lawful accepted enhanced-plan and agreement support; complete separate PFL calculation and recipient outcomes; and complete statutory holds, inactive archive restore, older-archive and source-replay custody. Owner-authorized rail and company access and carrier access are not established. Interim conservative default: configured native installation owner with current company authority may review supplied evidence and prepare only; no delegated or agent authority, outbound action, collection, funding or remittance is authorized. The standing CT scope policy of 27 October permits this conservative interim floor and supplies no completion evidence; scoped delegation and the provider boundaries remain unproved. Proposed contributions establish neither collected funds nor insurance coverage. Every original acceptance outcome remains owed; no scope is carved out. |
| `ENV-069` | Unemployment claim response and agency follow-through | target | done | `tests/claims-runtime.mjs` claimsJourney: native request import, worker and reviewed payroll match, original completed Willow evidence, employer mandate, exact native human signing proof, original portal preview, once-only transfer and reviewed timely official-schema confirmation; wrong EIN and claimant refuse, request and confirmation replay do not duplicate; missing and disputed facts hold with named before-deadline escalation. `tests/claims-browser.mjs` claimsBrowser: real separation and earnings forms, new agency questions through their own signature and confirmation, immutable earlier responses, empty and held states at 1440 and 390. `tests/claims-portal-edge.mjs` sidesSubmissionEdge and `tests/fixtures/sides/adf-guide-source.json`: named official separation, earnings and Additional Fact-Finding artifacts at the permitted agency edge. |  |
| `ENV-021` | Workers compensation from actual payroll | target | missing |  | No implementation exists; the complete workers compensation from actual payroll behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-095` | Washington L&I hourly premiums | target | missing |  | No implementation exists; the complete workers compensation from actual payroll behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-096` | Oregon Workers' Benefit Fund assessment | target | missing |  | No implementation exists; the complete workers compensation from actual payroll behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-025` | Tax notices owned through resolution | target | partial | Bounded portions of acceptance points 1 and 2: `tests/tax-notice-runtime.mjs` — taxNoticeJourney / TAX-NOTICE-CASES, loaded by the claims push shard in `verification.json`, proves native PDF upload and byte-exact retrieval, checked extraction and immutable OCR correction history, exact human review, deposit evidence, wrong EIN and period refusals, conflicting replay refusal, explicit unknown and nonzero reported balances, separate proposed and assessed or abated penalties, overdue named-human follow-up, reopening with prior evidence retained, exact separately reviewed SUI rule linkage and changed-source invalidation even after evidence append, refusal to append against edited or withdrawn rules, and current owner access refusals. Selected case screens are captured at 1440 and 390; native upload runs at 1440. `tests/payroll-runtime.mjs` — sponsoredJourney / SPONSORED-NOTICES proves the server-bound exact-original citation and existing untrusted model and exact correspondence boundaries. Schema and honest limits: `docs/payroll-notices.md`. The same journey proves synthetic legacy-format 2800C source custody and worker matching, exact named-human instruction review, conflicting lower retained W-4 refusal, compatible higher retained legacy elections, and reviewed modification or release with immutable source, actor and date history. It refuses agent, mixed-authentication, non-owner and signed-out access to the new records and originals. The same journey additionally proves capped and exhausted-base ordinary single-state SUI calculation from retained run wages, no employee deduction, exact source linkage, explicit employer liability and stale-rule refusal, and refuses stale approved checks at return preparation; due unapproved legacy IRS instructions refuse calculation, the binding legacy amount overrides a lower current-form election, and a higher current-form amount remains selected in regular-wage preview. The same journey records current-form settings through native upload, independently asserts filing status, multiple jobs and every monetary setting, refuses decreasing paper elections and calculates $128.02 required withholding on the stated effective date while honoring a $148.02 higher election; current-form modification recalculates the floor to $122.25, a pending release preserves it and exact release permits $78.08, with all retained instruction source versions encrypted and attributed. These are calculated previews, never actual payment, source authenticity or complete IRS format proof. The same taxNoticeJourney independently refuses an unapproved SUI date correction that would omit liability, identity-stale saved check review and return preparation, and a pre-upgrade approved check without collection pins after new IRS instructions; restoring old SSN bytes does not revive authority. It also proves linked-rule evidence fences and private-identity instruction review fences, including pending stricter instructions beneath a pending release. | Still unproved: separately scoped staff casework and original access with current revocation, distinct attribution and configured separation of duties; automatic extraction and agent classification, account and prior-response matching and cited investigation; dedicated authorized email and agency-feed intake; complete SUI taxability and jurisdiction coverage, independently reconciled prior wages and actual tax payment beyond the bounded ordinary single-state calculated liability; an end-to-end signed agency reply and independently supported closure with actual remaining liability and penalty outcomes; delivered escalation after missed responses; independent IRS source authenticity and legal effect; complete IRS source-format validation and W-4 amount comparisons beyond the bounded regular-wage legacy and current-form previews, alternate filing-status or multiple-jobs paper elections, all supported taxability cases and actual first-required-check payment; complete modification and release formats and effective cases beyond any retained legacy subset; and case-specific encryption, audited reads and decisions, statutory retention, restricted held access, eligible erasure, inactive restore and stale replay fencing. Retained PDFs, human-reported dispositions and synthetic legacy instructions do not prove legal authenticity, lawful withholding implementation or agency acceptance. Every original acceptance sentence remains unproved as a complete outcome; no scope is carved out. |
| `ENV-066` | Coverage ledger and fail-closed location rule | target | missing |  | No implementation exists; the complete externally enumerated nationwide payroll coverage behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-097` | Gating coverage: federal, all states, DC and large locals | target | missing |  | No implementation exists; the complete externally enumerated nationwide payroll coverage behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-098` | State-level assessments, funds and programs in the gating set | target | missing |  | No implementation exists; the complete externally enumerated nationwide payroll coverage behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-099` | Long-tail local coverage, published | target | missing |  | No implementation exists; the complete externally enumerated nationwide payroll coverage behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-037` | Filing-year schemas and authorization lifecycle | target | missing |  | No implementation exists; the complete filing-year schemas and authorization lifecycle behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-067` | Elected R&D payroll-tax credit and carryforward | target | missing |  | No implementation exists; the complete elected r&d payroll-tax credit and carryforward behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-038` | Register-to-bank-to-agency-to-ledger reconciliation | target | missing |  | No implementation exists; the complete register-to-bank-to-agency-to-ledger reconciliation behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-023` | Balanced accounting sync | target | missing | `tests/accounting-runtime.mjs` — accountingJourney, invoked by `tests/runtime.mjs` in the industry push shard: native mapping and proposed previews for all five named ledgers; independently asserted balanced cent amounts, separate wage, reimbursement and deduction components, department, class, location and job allocations; retained missing-account repair ownership without fallback; direct refusal of mismatched splits, excessive allocations, stale run versions, disconnected mappings and closed periods; session-bound and expired review refusal, exact preparation review, retained original and balanced reversal plus replacement correction; unchanged journal and decision after restart, concurrent revision refusal without inherited review; source and mapping invalidation, foreign-company and non-owner no-write refusal, encrypted storage, attributed audit and zero payroll approval. Empty, preview, exact review, reviewed unresolved, correction and stale-mapping screens at 1440 and 390; keyboard mapping and worksheet submission and exact review at 1440. These are native preparation assertions, not official provider-schema or posting proof. API and boundaries: `docs/accounting-preparation.md`. | Still unproved: separately scoped staff accounting preparation, review and worksheet access with current revocation, distinct attribution and configured separation of duties; posting an approved payroll run at the official API or schema edge for Pantry, QuickBooks Online, Xero, NetSuite and Sage Intacct; actual calculated net pay, employer taxes, benefits, deductions, liabilities, reimbursements and funding or clearing reconciliation; complete provider account and dimension mappings; provider replay, disconnect, rejection and closed-period outcomes with owned repairs; an accepted reviewed correction; and durable uncertain-intent reconciliation across restart with exactly one accepted external entry per approved run version and its actual provider entry link. Complete accounting-specific encryption, audited access, statutory retention, held access, eligible erasure and inactive restore remain unproved. Native draft allocations and worksheet review do not prove finalized payroll, settled funding, provider schema acceptance or posting. No authorized provider connection, credential, submission or live receipt is established by this ruling. Every original acceptance outcome remains owed; no scope is carved out. |
| `ENV-026` | Reconciled mid-year switch from incumbents | target | missing |  | No implementation exists; the complete reconciled mid-year switch from incumbents behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-100` | Standing setup carried into the first run | target | missing |  | No implementation exists; the complete reconciled mid-year switch from incumbents behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-101` | Fresh state and local authority after a switch | target | missing |  | No implementation exists; the complete reconciled mid-year switch from incumbents behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-102` | Prior-provider outstanding-tax refund and recollection | target | missing |  | No implementation exists; the complete reconciled mid-year switch from incumbents behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-103` | Prior-provider annual filing opt-out | target | missing |  | No implementation exists; the complete reconciled mid-year switch from incumbents behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-030` | Documented API, webhooks and agent tools | target | partial | Acceptance point 1 (partial): `tests/payroll-runtime.mjs` — payrollJourney / AGENT-DRAFTS, invoked by `tests/runtime.mjs`, follows `docs/payroll-agents.md` through the real versioned REST API and `scripts/envelope-cli.mjs` to prepare and read a persisted hourly input proposal, compare its retained person and reviewed-rate references with MCP, replay the same key without another proposal, and traverse every currently permitted record page. Point 2 (partial): the same journey proves foreign-company and foreign-credential reads, excess scope, forged approval input, ambiguous human-cookie authentication, expired and revoked credentials refuse without business writes; suspended authenticated requests on both REST and MCP lose authority after native revocation. Existing credential and proposal screens are exercised at 1440 and 390 with keyboard navigation. These are uncalculated inputs, not bonus payroll or payment evidence. Partial report point: payrollJourney / AGENT-DRAFTS in `tests/payroll-runtime.mjs` proves current scoped preparation-report pagination across REST, CLI and MCP, cross-credential isolation and revoked-report refusal; this is not a payroll register. Partial lifecycle point: `tests/payroll-runtime.mjs` — payrollJourney / LIFECYCLE-DELIVERY, invoked by `tests/runtime.mjs`, proves atomic native proposal event creation, HMAC verification at a real controlled HTTP receiver, explicit consent, encrypted signing-secret custody, native owner and company refusals, durable rejected and unknown delivery across Worker restart, stable event replay with receiver deduplication, concurrent attempt exclusion, bounded retry and revoked-subscription refusal without compensation disclosure. Its interrupted-claim fixture exercises public lease recovery without sending. `tests/archive-runtime.mjs` — archiveJourney and `tests/archive-authority.mjs` prove real export and import exclude signing keys and leave subscription history inactive. `tests/payroll-approvals.mjs` — approvalJourney / RUN-APPROVALS proves current exact earnings-run approval with WebAuthn user verification through a virtual authenticator, a separate human session following an MCP reference link, distinct human and presenting-credential attribution, signed OIDC Core ID-token MFA schema assertions, and model text, confirmation, spoofed human flag, stale challenge, foreign origin, wrong audience, old authentication, foreign subject, revoked link and agent approval refusals without dispatch. Existing review and refusal screens run at 1440 and 390; every control has visible words. This is an uncalculated native earnings run, not a bonus payroll or payment receipt. `tests/payroll-approvals.mjs` — approvalJourney / BONUS-PREPARATION proves actual encrypted immutable bonus-only earnings creation through CLI and conversational MCP, exact retained preview, current scoped bonus-report pagination through CLI and MCP, shared idempotency, invalid and spoofed inputs without a new run, foreign-credential and excess-scope refusal, expired and revoked bearer refusal, suspended REST and MCP preparation revocation without a write, native bonus custody inventory and held preview and report refusal, and separate human passkey approval with distinct presenting-credential attribution. The native review and approved states run at 1440 and 390; calculated bonus tax, net pay and release remain unavailable. | Still owed: complete bonus payroll calculation and exact tax and net-pay preview through the documented CLI and conversational MCP client; the complete contracted record and report tools and permitted payment and filing status; calculated-run, payment and filing lifecycle families; complete conversational calculated-bonus preparation and its end-to-end human approval. Native bonus-only earnings preparation and its separate human approval are proven; supplemental withholding and overtime remain uncalculated, and no bonus lifecycle event is emitted. The native exact earnings-run ceremony is proven, but interactive linked-provider MFA acquisition, individual passkey management and complete future transport custody remain open. Signed delivery covers native uncalculated proposal creation only. Payment and filing effects and events are unavailable because ENV-006, ENV-011 and ENV-035 are unimplemented. Complete callback and current-authority and custody proof must extend across every future transport under ENV-028, ENV-034, ENV-035, ENV-051, ENV-053, ENV-054 and ENV-055. |
| `ENV-039` | Challenger imports and accountable exit | target | missing |  | No implementation exists; the complete challenger imports and accountable exit behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-040` | Effective-dated HRIS and leave handoff | target | partial | `tests/payroll-runtime.mjs` — sourceIntakeJourney / SOURCE-INTAKE through `tests/runtime.mjs`: point 1 (partial), a real source-linked payroll person from a native reviewed Willow hire, once-only replay, an effective hire-period preview and source-correction invalidation; explicit exact-reviewed hire-profile and mistaken-location correction on the original person, applied-revision acknowledgement, no duplicate records or audit on replay, and refusal before review or on stale source and person versions; reviewed hourly rates and version-pinned leave reservation/correction in payroll preview; official BambooHR employee, HiBob SalaryEntry and Rippling Compensation USD hourly schemas. Point 2, future rates, late same-date conflict, replay, source identity mapping and affected retained run IDs/periods; owning-product links at 1440/390. Point 3 (partial), no local rate use before exact human review, no policy/I-9 copy and direct Lodge refusal. Additional matched-bank handoff proof: `tests/payroll-runtime.mjs` — leaveJourney, source correction changes only sick minutes, invalidates the retained earnings version and preserves PTO and holiday balances. `tests/payroll-runtime.mjs` — sourceIntakeJourney additionally proves exact-reviewed Willow effective location application, future-date refusal, captured source and person version refusal, one application acknowledgement under replay and concurrent first application, and native reviewed, applied and failed screens at 1440 and 390. Current profile changes preserve historical work allocations. `tests/payroll-runtime.mjs` — sourceIntakeJourney additionally proves exact-period reviewed Willow after-tax benefit amounts in held previews, replay, replacement correction, source invalidation and same-code conflict, plus reviewed California termination deadlines from historical actual-work allocations despite a different current profile, timely and late held previews, corrected-separation invalidation and unsupported work-state refusal, at 1440 and 390. API and schemas: `docs/payroll-sources.md`. | Still owed: live authorized sync/lifecycle and all event types for every named HRIS, complete location handoff for the other named adapters and historical allocation integration, complete benefit-deduction application beyond the exact-period after-tax held preview, complete final-pay handoff beyond reviewed California deadline previews, restricted actual payroll/leave-result return and remote acknowledgements. Willow leave handoff reserves minutes for a separately reviewed preview; it does not claim paid consumption. The versioned Willow input is an Envelope-side contract, not a remote implementation or receipt. |
| `ENV-041` | Job earnings, labor actuals and separate finance products | target | partial | `tests/payroll-runtime.mjs` — sourceIntakeJourney / SOURCE-INTAKE through `tests/runtime.mjs`: point 1 (partial), one identified approved job/commission earning from each of Gauge, Plinth, Glove, Mallet, Strap and Orbit enters the real preview after exact review. Point 2, commission replacement correction/replay, retained-run invalidation and compensation-field removal denying both old and fresh sessions; source ownership links at 1440/390. Point 3, Easel/Purse/Coaster, planning proposals and already-paid expenses cannot become payroll instructions. API: `docs/payroll-sources.md`. | Still owed: complete payroll tax calculation and reconciled restricted labor actuals/result return. The labor-actuals door checks current compensation permission then refuses unavailable; no preview is called actual cost. Sibling inputs use the documented Envelope-side contract and do not claim remote sibling delivery or live sync. Coaster reimbursement and Purse supplier ownership remain separate. |
| `ENV-042` | Connectors with visible health and repair | target | missing |  | No implementation exists; the complete connectors with visible health and repair behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-043` | Benefits broker and regulatory data exchange | target | missing |  | No implementation exists; the complete benefits broker and regulatory data exchange behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-044` | Signature, communications and practice handoff | target | missing |  | No implementation exists; the complete signature, communications and practice handoff behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-022` | Employee and contractor pay portal | target | missing |  | No implementation exists; the complete employee and contractor pay portal behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-024` | Payroll, tax and labor reports | target | missing |  | No implementation exists; the complete payroll, tax, labor and certified reports behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-104` | Certified payroll reports | target | missing |  | No implementation exists; the complete payroll, tax, labor and certified reports behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-028` | Payroll roles and sensitive-data audit | target | partial | Acceptance point 1 (partial): `tests/payroll-runtime.mjs` — PAYROLL-RECORDS / payrollJourney, invoked by `tests/runtime.mjs`, proves native settings grants plus company/location/field, compensation-read, record-export and bank-document refusals through UI/API. `tests/payroll-approvals.mjs` — RUN-APPROVALS / approvalJourney proves settings-issued exact-run approval independently of export, bank-edit and release, and zero-effect direct refusals of those ungranted powers. Point 2 (partial): payrollJourney proves revoke/re-grant old-session refusal, exact named rate-ledger decisions and attributed sensitive-read audit without private values; approvalJourney proves attributed exact-version run and setup review audits, human run approval audit and invalidation after grant changes. `tests/payroll-runtime.mjs` — PAYROLL-CUSTODY-UNAVAILABLE / missingKeyJourney proves absent-key UI/API no-write refusal. Changed grant/review screens and existing records run at 1440/390; controls have visible words. | Current proof covers company/location/field record grants, independent record export, bank-document custody and exact earnings-run approval powers, encrypted private text, masked reads, attributed review/decision audit and old-session revocation. Real calculated payroll compensation/export, verified bank-detail changes, location-limited run approval, release/payment and their audit remain unproved, as do full private-document lifecycles and all later tool/transport doors. The earnings run is not a payable gross-to-net run. Full bank/payment outcomes need owner-authorized ENV-011/035/065 rail/company access, which is not supplied; rate-ledger decisions are not applied to paychecks. ENV-004, ENV-011, ENV-022, ENV-024, ENV-030, ENV-034 and ENV-051–053 inherit the remaining current-authority/audit obligations; missing doors and 404s do not prove them. |
| `ENV-029` | Accountant multi-client workspace | target | done | `tests/firm-runtime.mjs`, firmJourney: 20 native-session clients, scoped readiness, due-run and notice filters, authorized batch preparation and exact client approval; native Blotter handoff variant, recipient acknowledgement, revoked mandate and removed-staff reassignment to the named permitted owner with stale-session release refusal. `tests/firm-fixture.mjs` supplies realistic retained client records; `docs/firm-work.md` describes the public doors and native handoff. Committed journey also runs outside push Verify on the landing candidate, with desktop and mobile screens. |  |
| `ENV-068` | Controlled employment and income verification | target | partial | `tests/payroll-runtime.mjs` — incomeVerificationJourney through `tests/runtime.mjs`: worker-authorized mortgage request and broad, foreign and forged refusals without disclosure writes; selected protected facts from reviewed Willow employment and original wage versions, exact owner review and release, requester-bound retrieval and separate receipt, worker-visible facts and linked source correction. Consent revocation and actual expiry, changed identity versions, grants, worker links and source revisions refuse stale retrieval. Single-use native former-worker return preserves own history, provenance and terminated status without employment restoration or wider authority; a different reviewed identity inherits no history. The consent-bound legal-authority path reviews requester evidence, source authority, lawful purpose and selected period and fields; missing consent, evidence and requester self-release refuse. Exact statutory inventory includes every verification row, field, source revision and receipt, legal basis, custodian and UTC gate. Held JSON, HTML, reviews and protected reads refuse ordinary users while owner reads are audited; stale selections, early release, shortened gates and stale proof refuse. Explicit eligible erasure removes derivatives and anonymizes attribution, refuses old reads, acknowledgements and source replay. `tests/archive-runtime.mjs` — verificationArchiveCheckpoint exports exact encrypted history with inactive authority, checks post-erasure absence, and refuses a real older archive with the later journal without publishing business or identity rows. Owner, worker and requester screens, English and Spanish empty, loaded, held, failed and completed states and keyboard actions at 1440 and 390; token masked. `tests/payroll-runtime.mjs` — incomeVerificationJourney additionally proves a second request and changed field set refuse existing consent, fresh consent names the exact request, worker withdrawal before release refuses release with an attributed audit and no release row, and owner custody shows its UTC gate and server clock source at 1440 and 390. API: `docs/payroll-verification.md`. | Remaining: filing the released statutory data through the authority’s own channel is unimplemented and tracked separately as ENV-075. ENV-068 remains PARTIAL as approved by ct; no authority-channel submission or external partner receipt is claimed. The protected response claims no external partner submission. ENV-028, ENV-051, ENV-053, ENV-054 and ENV-055 inherit these transports and custody obligations. |
| `ENV-075` | File released verification data through the authority's channel | target | missing |  | Authority-channel filing and acknowledgement remain unimplemented. No completed filing journey is claimed. |
| `ENV-045` | Native mobile payroll and accessible desktop | target | missing |  | No implementation exists; the complete native mobile payroll and accessible desktop behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-046` | Persistent payroll follow-up and automation | target | partial | `tests/automation-runtime.mjs` — automationJourney, invoked by `tests/runtime.mjs`: native settings and keyboard submission, immutable weekly earnings drafts without approval or release authority, deduplicated reminder and backup and service tasks, concurrent processing and restart retention, exact eight- and four-support-hour thresholds over Veterans Day and the November DST transition, immediate escalation after late detection, unavailable delivery without receipt, and one attributed justified disposition leaving other obligations open. Current owner and company authority and non-owner refusals are exercised. Settings, company navigation, empty, waiting, escalated, disposition and refused screens run at 1440 and 390. Product doors and limits: `docs/payroll-automation.md`. Bounded delegation increment: automationJourney in `tests/automation-runtime.mjs` proves explicit native staff preparation and inspection, separate justified-disposition permission, configuration remaining owner-only, distinct configuration, draft, processing, inspection and disposition attribution, denial without company-wide location or compensation access, foreign-company refusal and immediate grant revocation without writes or approval. The current company-wide operation refuses location-limited grants; usable location-limited and agent preparation remains unproved. Selected screens are captured at 1440 and 390; interactions are asserted once. | Still unproved: durable background scheduling and operational lease recovery; delegated preparation, inspection and justified disposition with current company, location and sensitive-field restrictions and immediate revocation; prepared, failed, awaiting-review and next-action monitoring; delivered, failed and unknown notification outcomes; automatic cessation tied to resolved hours and approval of the current exact run; authoritative recurring deadlines across timezone changes; paid wages with independently held tax-account deposit clocks, received account and grant, reviewed rate true-up and one remittance retaining lateness and fault history; staffed minimum-wage escalation and a named-human-approved lawful original or replacement payment received by payday; and complete automation-specific protected custody, retention, held restrictions, lawful erasure, inactive restore and stale replay fencing. Authorized rail execution, actual receipt and contracted staffed coverage remain unproved. Private tasks and unavailable delivery are not payment, filing, notification or staffing evidence. No obligation is carved by this ruling. |
| `ENV-047` | Employee pre-check and accountable payroll cases | target | missing |  | No implementation exists; the complete employee pre-check and accountable payroll cases behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-048` | Saved reports, dashboards and reproducible cost analysis | target | missing |  | No implementation exists; the complete saved reports, dashboards and reproducible cost analysis behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-049` | Transparent operating costs and service exit | target | missing |  | No implementation exists; the complete transparent operating costs and service exit behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-050` | Owner-run installation on Cloudflare through Base | target | missing |  | No implementation exists; the complete owner-run installation on cloudflare through base behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-065` | Partner-led employer activation and accountable service | target | missing |  | No implementation exists; the complete partner-led employer activation and accountable service behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-105` | Per-account state and local activation | target | missing |  | No implementation exists; the complete partner-led employer activation and accountable service behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-051` | Secure sign-in and revocable sessions | target | partial | Acceptance point 1 (partial): `tests/payroll-runtime.mjs` — PAYROLL-SIGNIN / identityJourney, invoked by `tests/runtime.mjs`, uses the emitted Worker over real HTTPS, Base native invitations/confirmation/sign-out and signed linked Auth/OIDC callbacks. It proves unknown identities are not created, invitation/magic expiry and replay refusal, no payroll grant from identity alone, direct private/download refusal after sign-out, grant change, operator removal/reactivation and provider disable; OIDC PKCE/client assertion, unknown/unverified identity, nonce and token-expiry checks. payrollJourney / PAYROLL-IDENTITY also proves sponsor removal/reinstatement and existing grant revocation. Point 2 (partial): identityJourney proves rejected/uncertain Resend acceptance and unavailable Auth create no session, public sign-in limits, the Base seven-day fixed maximum/no silent renewal, same-session single-use public app-local step-up with no new cookie/session, and signed MFA/client flags alone refusing bank custody. payrollJourney proves expired app-local proof and unavailable-mail refusal before bank custody/credential minting. Sign-in/invitation/private-record/linked-sign-in screens run at 1440/390. Network-edge schemas and limits: `docs/payroll-records.md`. `tests/payroll-approvals.mjs` — approvalJourney / RUN-APPROVALS proves current exact earnings-run approval with WebAuthn user verification through a virtual authenticator, a separate human session following an MCP reference link, distinct human and presenting-credential attribution, signed OIDC Core ID-token MFA schema assertions, and model text, confirmation, spoofed human flag, stale challenge, foreign origin, wrong audience, old authentication, foreign subject, revoked link and agent approval refusals without dispatch. Existing review and refusal screens run at 1440 and 390; every control has visible words. This is an uncalculated native earnings run, not a bonus payroll or payment receipt. | Still unproved: interactive linked-provider MFA acquisition, individual passkey management and recovery, retained former-worker form identity, full private-document lifecycles/transports, and step-up before actual verified bank-detail changes and payroll release. The ten-minute Base app-local email proof still protects documentary bank custody and credential minting; a generic signed provider MFA claim does not replace it. Exact earnings-run approval separately requires the action-bound passkey or pinned OIDC MFA assertion described in the evidence. The linked OIDC/mail proofs use official-schema network edges, not live account receipts. Authorized bank/payment completion needs owner-authorized ENV-011/035/065 rail/company access, not supplied. This does not complete ENV-004/011/022/030/034/051 or certify a payment destination. Current-grant/session fences must extend to every later private document, handler, download and transport. |
| `ENV-052` | Agents act through scoped, sponsored credentials | target | done | Acceptance point 1: `tests/payroll-runtime.mjs` — payrollJourney / AGENT-DRAFTS, invoked by `tests/runtime.mjs`, proves native issuance, persisted reviewed-rate MCP input proposals, company, location, field and action denials and revocation of a suspended authenticated request before its write. Actual private-custody door: the same payrollJourney posts kind bank with a working scoped bearer, both alone and alongside the owner cookie; both refuse with human_session_required, every private row and ciphertext stays identical, and the no-write snapshot includes record versions and audit events. Point 2: the same journey proves expiry, sponsor removal, replay and attribution. ct 22 Oct additions: `tests/payroll-runtime.mjs` — sponsoredJourney / SPONSORED-NOTICES, invoked by `tests/runtime.mjs`, proves payroll-admin and firm-accountant settings sponsorship; narrower company/location/field/action refusal; 30-day review across three digest rotations, old-secret expiry/removal and owner restriction; actual saved CP161-style notice through declared OpenAI with injected ungranted-provider instructions inert and private values absent; exact fresh human-reviewed Resend correspondence, edited-twin/expiry/withdrawal/changed-provider/current-approver refusals, concurrent once-only execution and unknown state after restart. Settings, issuance, provider, notice, proposal, review, approved, edited and result states run at 1440/390 with secrets masked. Protocols and provider schemas: `docs/payroll-agents.md`, `docs/payroll-notices.md`. |  |
| `ENV-072` | Agents prepare calculated runs and dispatch exact payroll effects | target | missing |  | No implementation; depends on ENV-006, ENV-011, ENV-014, ENV-037, ENV-034, ENV-035 and ENV-065. |
| `ENV-053` | Complete archives and inactive restore | target | partial | Point 1 (partial): `tests/archive-runtime.mjs` — archiveJourney round-trips two native employers with twelve monthly prepared federal calculations each and linked W-4 correction history, a third native claims company, payroll sources, original claim attachments, notices and historical human approvals through real CLI export and import; compares every archived row and ciphertext digest and authenticates encrypted originals and relationships. Point 2: archiveJourney proves corrupt, wrong-key and nonempty imports publish no business or identity rows. Point 3 (partial): archiveJourney proves sessions, grants, provider credentials and review tokens do not transfer, actual native email-confirmed agent and notice authority is expired, and prior-session reads and writes plus the previously usable agent bearer fail against the restored Worker without an outbound request. `tests/archive-key-custody.mjs` — archiveKeyCustody proves separate native private key backup and recovery, no key output or archive leakage, and populated-key replacement refusal. Prepared year and correction corpus: `tests/archive-year-fixture.mjs` — archiveYearFixture creates the monthly runs and exact human-reviewed calculations through native HTTP, with cumulative source wages, preserved original checks and linked corrected withholding. The same helper retains original and corrected prepared 941 returns. `tests/archive-relationships.mjs` — unrelatedCorrectionArchive reseals a correction with a missing original and valid transport checksums; archiveJourney proves import refuses without publishing business rows. This is prepared history, not settled wages. Implemented edition custody: archiveJourney and `tests/archive-editions.mjs` — archiveEditions compare every packaged schema and implemented rule source byte and digest, reject internally damaged editions through the actual CLI without publishing rows or a source payload, and restore the exact inert payload after removing a current target rule source. Erasure fence: `tests/archive-erasure.mjs` — archiveErasure explicitly erases only an unused worker through the native privacy door, holds a payroll-dependent worker, refuses agent, stale-version and replay requests, and retains an anonymous action target; archiveJourney restores the real earlier archive with the later native journal and proves erased-row refusal without business publication. ENV-054 inherits this journal requirement for future erasure cascades. Restricted adoption: `tests/archive-adoption.mjs` — archiveAdoption uses a fresh native email proof and setup, explicit per-company owner consent and an audited viewer grant; restored history is readable at 1440 and 390, while mutation, bank custody, provider changes, release, export, adoption replay and another restored employer refuse. Operations: `docs/archive-recovery.md`. `tests/archive-adoption.mjs` — archiveAdoption also proves exact named compensation and tax consent, atomic generic or widened consent refusals, immutable own receipts, current native owner adoption of another creator company, original creator continuity after native role demotion and exact retained annual calculation reads and source-linked prepared tax totals without EINs or form payloads, and unrelated identity refusal. `tests/archive-runtime.mjs` — archiveJourney proves a further export and restore preserves the exact consent receipts without grants or sessions; a checksummed receipt with unrelated audit attribution refuses without business publication. `tests/archive-authority.mjs` — archiveAuthority additionally dispatches two exactly human-approved native notice replies at the Resend schema edge, retaining accepted and unknown states, original execution IDs, the accepted provider acknowledgement and replay deduplication through archiveJourney. Unknown notice custody is not proof of an unknown payment or operational provider reconciliation. `migrations/core/0032_archive_adoption_consent.sql` retains the receipt as evidence only. | Still unproved: a complete mixed-company year containing open unknown payments; operational adoption beyond the restricted historical grant; paused schedules and every payment, filing and notice effect after reconnection; accepted-original-ID provider reconciliation before renewed exact approval. Imported grants remain absent and historical consent receipts confer no authority. Recovery is a local data-custody foundation, not operational activation. ENV-028, ENV-051 and ENV-054 inherit current authority and custody on the consent transport. |
| `ENV-054` | Retention, lawful erasure and durable anonymized audit | target | partial | Point 1 (partial): `tests/archive-erasure.mjs` — archiveErasure erases mixed native prepared payroll and claim graphs, including all versions of claim originals, private documents, source pins, rate proposals, agent drafts, firm work and firm history; verifies absent public reads and files within five minutes and anonymous action targets. `tests/archive-runtime.mjs` — archiveJourney checks the actual exported rows. Point 2 (partial): archiveErasure inventories exact fields, keys, basis, custodian and UTC gates; refuses unclassified and early release, gate shortening, changed contents and replay; requires explicit selections, fresh native proof and separate erasure. Native accountant reads across company, person, document, export and workspace routes plus an issued agent bearer refuse held data; native owner access is audited. `tests/payroll-runtime.mjs` — incomeVerificationJourney checks an already-issued protected response while held and after erasure, removes consent and disclosure derivatives and anonymizes worker actor attribution without changing independent identities. Point 3: archiveErasure refuses retired worker, allocation and claim source replay; archiveJourney refuses the real older archive with the later erasure journal without publication. Point 4: archiveErasure proves the explicit local-recall boundary and privacy loaded, empty, held, failed and completed screens at 1440 and 390, keyboard record expansion, labeled controls and durable anonymous completion history. Additional bounded custody proof: `tests/archive-erasure.mjs` — archiveErasure inventories both revisions of separate sick, PTO and holiday banks, a Willow benefit source and a Gauge earning source, plus their review challenges. Native ordinary leaf reads succeed before a request and refuse while held; exact reviewed erasure removes the leave, intake and private attachment reads and refuses retired source replay under a replacement worker. New review challenges invalidate an older erasure fingerprint. `tests/archive-runtime.mjs` — archiveJourney inspects the actual exported leave and intake versions and derivative rows. API: `docs/payroll-privacy.md`. `tests/payroll-runtime.mjs` — incomeVerificationJourney additionally inventories the original mapped Willow hire link and every source revision, restricts its held review, removes its mapping and source versions on eligible erasure, denies its old review and omits it from the hire collection, and refuses replay of the original hire source without restoring the mapping. Additional native matrix: `tests/archive-erasure.mjs` — archiveErasure and `tests/archive-fixture.mjs` — archiveFixture enumerate nine supported HRIS cases and all six earning adapters with two source revisions, a mapped Willow hire and correction, connected Willow leave, shared downstream run custody with an unaffected coworker, worker-associated notice analysis and both reply versions with review, approval and dispatch records, retained notice PDFs and deposit evidence, and both versions of federal and state paper originals. They assert exact inventory membership, positive byte reads and refused private transports, held access, explicit release and separate erasure, anonymous targets and retired source refusal. `tests/archive-runtime.mjs` — archiveJourney checks actual exported private and notice derivatives and refuses the older archive with the later journal. archiveErasure also checks the separately attributed provider-request log through requested, submitted, unknown, rejected, retried and confirmation-reported history; local erasure preserves the unresolved request and every outcome remains owner-attested and externally unverified. Selected privacy and custody screens are captured at 1440 and 390. No new test registration is added. | Still unproved: notices shared by multiple workers and the complete private-custody transport matrix beyond the exercised notice, paper, source, leave and shared-run cases, including reporting source, response and transfer-authority custody and withholding-instruction originals; every supported adapter event and earning-shape permutation; official-schema provider deletion requests, authentic receipts and independently supported external completion. The separate manual provider-request log records owner-attested outcomes only, sends no request and never verifies external deletion. ENV-028, ENV-051, ENV-053 and ENV-068 inherit custody on their transports. |
| `ENV-073` | Every external recipient declared and payroll independent of AI | target | partial | Implemented installation declarations: `src/envelope/installation-data.tsx` renders recipient purpose, permitted fields, destinations and credential custody from `seed.json` in native owner setup and sign-in settings; `docs/payroll-external-data.md` documents configured transports and unavailable future connections. `tests/runtime.mjs` proves first-run declarations at 1440 and 390. `tests/payroll-runtime.mjs` — identityJourney proves owner-only settings at both widths and native Resend, SendGrid and Cloudflare sign-in, exact intended recipients, rejected and uncertain delivery invalidating links, missing credentials sending nothing and no alternate transport. `tests/privacy-recorder.mjs` — startRecordedWorker and finishPrivacyRecording inspect declared destinations, exact native credential routing, planted sensitive inputs, browser requests and console, client assets and Worker logs. sponsoredJourney proves exact human correspondence after removing the actual OpenAI key. `seed.json` also declares ten unavailable recipient families, with named services, prospective minimum fields, custody and missing authority; native setup and sign-in settings show no authorized destination for them. `tests/payroll-runtime.mjs` — sponsoredJourney calls `tests/industry-runtime.mjs` — payrollWithoutAiJourney after removing the same company’s stored OpenAI key and restarting the Worker: exact federal regular-wage taxes and net cash, human check and run approvals, prepared Form 941 totals and downloaded fields, source invalidation, immutable linked correction and replay-safe reviewed BambooHR rate recalculation remain available; release refuses with no writes or provider call. These existing controls are inspected at 1440 and 390 with the privacy recorder. | Full operational recipient inventory still needs each future connector’s exact authorized destinations and custody. Complete deterministic payroll calculation across jurisdictions, payment, actual filing, reconciliation, worker portal and connector journeys with AI removed remain owed. Existing federal preparation and unavailable-family declarations do not establish those full outcomes. Calculation and connector engineering remain this seed’s work; funded pay additionally needs owner-authorized ENV-011, ENV-035 and ENV-065 rail and company access. |
| `ENV-056` | Visible durable operations and recovery | target | partial | Partial operational points: `tests/payroll-runtime.mjs` — payrollJourney / LIFECYCLE-DELIVERY proves owner-only operations health, explicit unavailable payment and filing dependencies, retained failed and unknown proposal delivery jobs across restart, current attempt and next action, interrupted-claim lease recovery, deduplicated replay and bounded concurrent attempts. `tests/archive-runtime.mjs` — archiveJourney proves inactive restored webhook subscriptions and excluded signing keys through the real archive doors. No timing bound or provider recovery is claimed. `tests/payroll-runtime.mjs` — payrollJourney / LIFECYCLE-DELIVERY additionally proves read-only D1 storage and queue probes, unavailable storage and queue fault states without losing retained unknown work, malformed custody-key and absent-receiver states, explicit absent scheduler and rail dependencies, empty-queue non-readiness, and recovery lease visibility without inventing a payroll deadline. Provider configuration never establishes delivery. `tests/archive-runtime.mjs` — archiveJourney / ARCHIVE-UPGRADE populates the immediately prior schema through native business routes, applies the current migration through Wrangler and repeats it, comparing every populated business and identity table byte for byte, including unknown notice obligations, ciphertext and human decisions. This is a schema-upgrade proof, not a historical application-binary or payroll-provider upgrade. Additional local dependency evidence: `tests/payroll-runtime.mjs` — payrollJourney, LIFECYCLE-DELIVERY, exercises explicit current-native-owner diagnostics through the company POST door, isolated D1 write, read and delete, authenticated encrypted round trip, bounded attributed retained-ciphertext inspection, corruption and valid-format wrong-key detection, write and cleanup failures, timeout, current-authority refusals before and after probes, held-content exclusion, restart and sentinel cleanup, unchanged business and unknown outbox state, and no outbound request. Read-only health never claims content validation. Isolated diagnostic schema: `migrations/core/0040_operation_sentinels.sql`. Runbook: `docs/payroll-operations.md`. | Still owed: complete storage and backup content validation, actual provider health and scheduler execution; real release and filing obligations, interrupted provider execution and reconciliation without repeated external effects; complete backup and prior-release migration proof; the exact 100-worker and 20-client measured preview, dashboard and report journeys with all contracted samples and p95 bounds. Current health and durable job proof covers native proposal webhook delivery only, never a bank or agency. |
| `ENV-057` | Safe private inputs, files and public doors | target | partial | Point 1, native claim files: `tests/claims-browser.mjs` — safeInputsBrowser, invoked by claimsJourney in `tests/claims-runtime.mjs`, uploads hostile HTML and PDF originals through the real claim import API, proves no script or remote image executes, byte-exact sandboxed binary downloads, malformed JSON and UTF-8 refusals, unsupported type, invalid base64, digest mismatch, per-file and request size limits, write-free rejected imports and immutable file identity. It refuses signed-out, ungranted-member and foreign-company downloads. claimsJourney additionally refuses current artifacts, signed packets and historical packet URLs after native sign-out. Point 2, partial: safeInputsBrowser checks signed-out Lobby, sign-in, setup redirect and invalid confirmation at 1440 and 390: no payroll values, response cookie, visitor cookie or third-party request before interaction; labeled email control, keyboard focus and zero automated WCAG findings on those public documents; the native sign-in limit returns 429 without sending mail for an unknown identity. Base accessibility journey on payroll screens (BASE-ACCESSIBILITY-001), partial: safeInputsBrowser records operator accessibility findings, accessibility trees and keyboard-operated retained-evidence downloads at both widths. This is not a complete WCAG AA pass.  Added native assertions in safeInputsBrowser prove hostile tax and bank text remains a plain attachment, current-session and company fences, stale private-version refusal, sign-out revocation, escaped hostile notice text and write-free malformed JSON, invalid UTF-8, unsupported type and oversized refusals on seven real import and document routes. Valid invitation and email-confirmation previews remain signed out, private-data-free and cookie-free with labeled keyboard focus and zero automated findings at both widths. claimsJourney also proves existing current and historical signed packets return only to the current company owner, refusing signed-out, ungranted and foreign-company requests. A one-off browser inspection of all seven built public documents at both widths found no visitor cookies, browser storage, third-party requests, payroll fixture values or horizontal overflow; documentation, contract, run and not-found documents had no automated findings. Linked-provider public-door assertions in `tests/payroll-runtime.mjs` — identityJourney prove signed-out linked sign-in has no cookies, browser storage, third-party request or private record before interaction at both widths, while verified and refused callbacks are non-cacheable and contain no private payroll text; initiating verification does not issue a native session. Download semantics: `docs/private-inputs.md`.  Additional structured-input proof: `tests/claims-browser.mjs` — safeInputsBrowser retains hostile Willow hire, HR change, job earning and industry classification text as inert data at both widths; preserves original source and classification revisions after correction and refuses stale revisions; rejects malformed structured exports without creating private versions, replies or releases. Interaction proof: `tests/claims-browser.mjs` — claimsBrowser audits claims empty, loaded, held, prepared, signed, handoff, confirmed, follow-up and failed screens at both widths, checks focus and keyboard checkbox state, submits the native import by keyboard and records accessibility findings for every screen. Remaining findings are retained explicitly. Further native structured-input evidence: `tests/payroll-runtime.mjs` — sponsoredJourney retains hostile notice-reply text as plain text, refuses stale edits and dispatches only the separately human-approved exact version; incomeVerificationJourney keeps hostile source evidence private, renders it inertly for the owner and excludes it from requester facts. `tests/archive-runtime.mjs` — archiveJourney with `tests/archive-fixture.mjs` and `tests/archive-adoption.mjs` — archiveAdoption retains hostile person text through the actual CLI export and restore, checks inert native rendering and current restricted authority at both widths. The protected source review and restored company screen also assert labels, keyboard entry, viewport fit and structural automated accessibility; existing evidence wrapping keeps long text readable without changing colours. Additional native boundary proof: `tests/archive-erasure.mjs` — archiveErasure rejects null, array, malformed JSON and numeric structured exports on the HRIS and earning doors without changing retained revisions. At 1440 and 390 it renders hostile leave policy and entry evidence, Willow benefit text and Gauge job evidence as literal text in the exact review screens, with no injected image, script effect or remote request, and checks keyboard focus and viewport fit. Bounded point 1 completion: `tests/payroll-runtime.mjs` — paperOnboardingJourney, invoked by `tests/runtime.mjs` in push Verify, downloads retained federal and state signed tax originals and a distinct binary replacement through native document and API GET and HEAD doors under separately scoped paper-download permission; checks byte-exact versions, non-cacheable inert attachments, current company and location and field authority, signed-out and foreign-company refusals, revoked sessions and grants, and renewed grants that never revive old sessions, with unchanged retained data after refusals and keyboard downloads at 1440 and 390. Point 2 finite route proof: `tests/claims-browser.mjs` — safeInputsBrowser with `tests/payroll-doors.mjs` visits every emitted Run site document, including documentation and contract, native public documents and callback refusals, records cookies, browser storage and requests, and refuses signed-out GET, HEAD and POST across the installed native dispatcher inventory and populated private links without changing payroll or native identity rows. `tests/privacy-recorder.mjs` checks recorded channels and emitted client assets. Existing identityJourney proves verified linked callbacks. Additional retained-form and route proof in those same journeys uses distinct federal and state originals and binary replacements, including keyboard downloads of each replacement at both widths and write-free mutation refusals on retained-original download doors. safeInputsBrowser recursively reads the populated native documents, adds emitted links and form actions to the signed-out inventory, and refuses malformed JSON roots, invalid UTF-8, duplicate scalar form values and unsupported content through every offered native mutation without changing retained business or identity rows. The unchanged Base accessibility remainder below is not certified by these privacy assertions. | Base journeys still owed on Envelope's doors: exhaustive structured-input boundary proof beyond the exercised native HRIS, earnings, classification, archive, notice-reply, protected-response and populated-form boundary cases; complete keyboard interaction and contrast verification across every changed public and operator journey in loaded, empty, held, failed and completed states. At both widths, `.chip--goldenrod > b` and `.chip--goldenrod > small` remain at 3.44:1, and `.chip--teal > b` and `.chip--teal > small` remain at 3.70:1, against the required 4.5:1; the built homepage retains 29 contrast findings per width. Those visual corrections belong to br and remain open. Scripted accessibility-tree announcements remain owed under BASE-ACCESSIBILITY-001, and the human screen-reader pass is register row R-6. Automated checks do not certify the full Base accessibility bar. |
| `ENV-058` | US-first complete payroll and honest product boundaries | target | missing |  | No implementation exists; the complete us-first complete payroll and honest product boundaries behavior and its public-door acceptance journey remain to be built and proven. |
| `SURFACE-001` | The registry equals this table and the Base harness passes | target | missing |  | New Agent surface clause, not yet built. Today `/api/envelope/mcp` speaks protocol 2025-03-26 with eleven tools (`credentials.rotate`, `notice.process`, `reply.dispatch`, `bonus.prepare`, `bonus.read`, `run.review`, `records.list`, `draft.prepare`, `draft.read`, `reports.bonuses`, `reports.proposals`) and no risk classes, company policy or Base harness. |
| `SURFACE-002` | Money calls carry their amount and counterparty | target | missing |  | New Agent surface clause, not yet built. Today `/api/envelope/mcp` speaks protocol 2025-03-26 with eleven tools (`credentials.rotate`, `notice.process`, `reply.dispatch`, `bonus.prepare`, `bonus.read`, `run.review`, `records.list`, `draft.prepare`, `draft.read`, `reports.bonuses`, `reports.proposals`) and no risk classes, company policy or Base harness. |
| `SURFACE-003` | Filings, authorizations and correspondence carry commitment and external | target | missing |  | New Agent surface clause, not yet built. Today `/api/envelope/mcp` speaks protocol 2025-03-26 with eleven tools (`credentials.rotate`, `notice.process`, `reply.dispatch`, `bonus.prepare`, `bonus.read`, `run.review`, `records.list`, `draft.prepare`, `draft.read`, `reports.bonuses`, `reports.proposals`) and no risk classes, company policy or Base harness. |
| `SURFACE-004` | Sensitive reads and destructive erasure | target | missing |  | New Agent surface clause, not yet built. Today `/api/envelope/mcp` speaks protocol 2025-03-26 with eleven tools (`credentials.rotate`, `notice.process`, `reply.dispatch`, `bonus.prepare`, `bonus.read`, `run.review`, `records.list`, `draft.prepare`, `draft.read`, `reports.bonuses`, `reports.proposals`) and no risk classes, company policy or Base harness. |
| `SURFACE-005` | Registrations and gated steps | target | missing |  | New Agent surface clause, not yet built. Today `/api/envelope/mcp` speaks protocol 2025-03-26 with eleven tools (`credentials.rotate`, `notice.process`, `reply.dispatch`, `bonus.prepare`, `bonus.read`, `run.review`, `records.list`, `draft.prepare`, `draft.read`, `reports.bonuses`, `reports.proposals`) and no risk classes, company policy or Base harness. |
| `SURFACE-006` | Access, security, policy setup, Pause and audit | target | partial | `tests/agent-policy-runtime.mjs` — agentPolicyJourney, invoked by `tests/runtime.mjs` in the push runtime shard: native company setup starts with every class unanswered; MCP, REST and CLI refuse unset and blocked policies without preparation or secret changes; supported hourly and bonus preparation, compensation reads, reports, separate human review presentation and credential rotation remain within current sponsor and grant powers. Public Settings proves incomplete-answer and non-owner refusals, company isolation, durable Pause across restart, stopped next calls within 60 seconds and suspended authenticated calls fenced even after resume. Attributed class and decision totals over seven fixed UTC dates equal retained audit rows and the Agents page; selected setup, paused and activity screens are captured at 1440 and 390. Existing preparation, approval and sponsored-notice journeys explicitly configure company policy and retain their authority assertions. Native policy semantics and limits: `docs/payroll-agents.md`. | Still unproved: complete staff, firm and agent access mutation classification with direction, people count and self-escalation refusal; all step-up and provider credential changes carrying security; complete remaining tools and future transports; full seeded-week policy outcomes and Base conformance. The bounded policy may restrict existing authority only: native company owners configure it, while scoped delegated policy administration and complete provider boundaries remain owed under the conservative owner-only floor. Review and approval policy choices remain safe holds, never exact human payroll approval, consent or a widened grant. Existing exact human approval, owner-only explicit reference sends, no automatic outbound action, no automated retry or destructive recovery, and every account, rail and company hold remain unchanged. |
| `SURFACE-007` | A payroll week under two company policies | target | missing |  | New Agent surface clause, not yet built. Today `/api/envelope/mcp` speaks protocol 2025-03-26 with eleven tools (`credentials.rotate`, `notice.process`, `reply.dispatch`, `bonus.prepare`, `bonus.read`, `run.review`, `records.list`, `draft.prepare`, `draft.read`, `reports.bonuses`, `reports.proposals`) and no risk classes, company policy or Base harness. |
| `ENV-059` | Prepare every run and explain every changed paycheck | push-further | missing |  | No implementation exists; the complete prepare every run and explain every changed paycheck behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-060` | Keep every jurisdiction whole before its deadline | push-further | missing |  | No implementation exists; the complete keep every jurisdiction whole before its deadline behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-061` | Prove each run to the cent and chase the cause | push-further | missing |  | No implementation exists; the complete prove each run to the cent and chase the cause behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. |
| `ENV-062` | Answer government notices through accepted closure | push-further | missing |  | No implementation exists; the complete answer government notices through accepted closure behavior and its public-door acceptance journey remain to be built and proven. |
| `ENV-063` | Answer hiring and payroll questions before commitment | push-further | missing |  | No implementation exists; the complete answer hiring and payroll questions before commitment behavior and its public-door acceptance journey remain to be built and proven. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-064` | Carry the switch to a clean first quarter | push-further | missing |  | No implementation exists; the complete carry the switch to a clean first quarter behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-070` | Explain a worker's own paycheck with citations | push-further | missing |  | No implementation exists; the complete explain a worker's own paycheck with citations behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
| `ENV-106` | Worker paycheck questions measured on a fixed corpus | push-further | missing |  | No implementation exists; the complete explain a worker's own paycheck with citations behavior and its public-door acceptance journey remain to be built and proven. Round 3 additions and their acceptance cases are also unimplemented. Buyer review 4 additions and acceptance remain unimplemented. |
