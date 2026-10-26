# New-hire reporting

The people API prepares employee hire and rehire reports for 51 mapped directories for an owner to
transfer to the selected official directory portal. It never sends a report
automatically. Onboarding completion is independent of reporting completion.

The native owner opens a person's **New-hire reporting** link, supplies the
required employee name, address, SSN, birth date, employer name, address, FEIN
and first day of employment, and reviews the exact encrypted version. The selected OCSS entry specifies the calendar deadline. The shorter ordinary
deadlines are Alabama and Maine seven days; Georgia and Vermont ten;
Massachusetts, Rhode Island and West Virginia fourteen; Iowa and Mississippi
fifteen; other mapped directories twenty. This implementation uses a calendar-date deadline and marks an unresolved report
overdue after that date. The date and repair owner remain visible after rejection.
There is no scheduler or automatic submission.

The canonical source inventory is `src/envelope/people/new-hire-directories.json`.
Its normalized source extracts came from the federal OCSS state-contact matrix
on October 26, 2026; the source URL, retrieval date, upstream digest and individual
update dates are retained. Email addresses and email contact lines are removed from the source extracts; official source URL, title, section and retrieval date are retained. Contact routes use agency websites or phone numbers. Typographic slash pairs in extracts are written with “and.” The matrix's non-magnetic-media deadlines do not prove electronic batch
schedules. Pennsylvania fields are resolved against 23 Pa.C.S. section 4392(b) through (d) and PA CareerLink instructions, including employer contact name and telephone and electronic state of hire. New Hampshire fields and recipient are resolved against Emp 308.02 and NHES instructions; WebTax is the official online destination. Its active state account is required for the selected portal channel, while the statute requires the account number only if any. Direct NHES portal retrieval returned HTTP 403; official published instructions establish the destination, without a live login or schema execution claim. Nationwide completion remains false. Maryland’s malformed OCSS deadline
cell is resolved by Labor and Employment section 8-626.1. Montana’s erroneous
Minnesota destination is resolved by its official DPHHS report form and portal.
Kentucky’s fields use KRS 405.435; Oregon uses its official DOJ portal. These
additional official source links are retained in the inventory. A registered multistate election never shrinks this denominator.

Run `node ./scripts/compliance/new-hire-coverage.mjs` to inspect the failing
nationwide coverage check. `--source file.json` audits a proposed replacement
inventory against the independent 51-directory denominator. It names removed directories and missing hire or rehire schema cases. It continues to fail after all 51 field mappings are present because complete authority transport evidence remains unproved. Declared cases alone never
prove delivery; the public-door journey executes both employment events for every mapped directory
and proves only the implemented transfer
and observed-response handling.

All routes below use the native owner's current session, same-origin POST and
company authority. Agent credentials cannot use these routes. Set `base` to
`/api/envelope/companies/{companyId}` and `person` to a current payroll person ID.
Identifiers are returned by the ordinary company and people routes.

| Route after base | Method | Behavior |
| --- | --- | --- |
| `/new-hire-coverage` | GET | All directories, source dates and explicit gaps |
| `/new-hire-elections` | POST | Record mapped `state`, at least two confirmed `workStates`, `version`, `effectiveFrom` and actual federal registration `confirmation` |
| `/new-hire-elections/{id}/review` | GET | Exact election and short-lived review token |
| `/new-hire-elections/{id}/approve` | POST | `version` and `reviewToken`; records human decision |
| `/people/{person}/new-hire-reports` | GET | Retained versions, deadlines, owner and response history |
| `/people/{person}/new-hire-reports` | POST | Prepare an employee report |
| `/people/{person}/new-hire-reports/{id}/review` | GET | Exact report fields and review token |
| `/people/{person}/new-hire-reports/{id}/approve` | POST | Approve exact `version` with `reviewToken` |
| `/people/{person}/new-hire-reports/{id}/transfer` | POST | Prepare approved fields for manual portal transfer; no submission claim |
| `/people/{person}/new-hire-reports/{id}/response` | POST | Record observed agency response |
| `/people/{person}/new-hire-reports/{id}/repair` | POST | Correct rejected fields; new review required |

Report input: `eventType` is `hire` or `rehire`; `hireDate` is the first day of
that employment; `state` is the reporting directory and `workState` is the actual state of hire.
Without an election they must match; an election must cover the actual work state.
Required common fields are `employeeFirstName`,
`employeeLastName`, `employeeAddress`, `employeeSsn` (nine digits),
`employerName`, `employerAddress`, and `employerFein`
(nine digits, matched against the current company's encrypted EIN). Each directory
adds only its mapped required fields: for example, birth date for Ohio, job title
and SOC for Indiana, and health coverage and starting wage for Maryland. Consult
`requiredFields` in the coverage response or select a directory in the report form.
Only mapped fields are retained. State of hire is included in transfer when the
directory lists it or a multistate election requires it.
`employeeMiddleName` and the approved `electionId` are optional. Employment
authority and source facts must be verified by the owner; input is not an identity
verification service. Rehire uses a new start date, never a new payroll identity.

The report ID derives from company-scoped person and start date. Identical input
replays the same obligation; conflicting input refuses. A rejected or unsubmitted report's replacement
uses the same input plus its exact current `version` and retains prior responses.
Portal transfer happens once per reviewed version. Source changes and inactive
restored approval show a held state; the owner prepares a new exact version and
reviews it again before any transfer. The owner records `version`,
`receiptId`, `response` (`accepted` or `rejected`), `reportingDate` and
`agencyResponse` from the real portal. An identical receipt replays; conflicting
receipt content refuses. This is human-attested evidence, not an authenticated
agency callback or independent verification of submission. No public unauthenticated
callback exists. An accepted report cannot be overwritten by an older rejection.

CT scope ruling, 26 October 2026: APPROVE WITH RIDERS for the conservative reporting default only. The configured native owner, using a current native session and current company authority, may prepare, review and approve an exact report version for manual transfer to the selected official directory portal; agent credentials cannot exercise these routes. Preparation and transfer do not establish filing. Material source, payload, election or authority changes require fresh exact review and approval. Schema fields only means necessary fields allowed by the selected official reporting schema, including every required field; necessary source, deadline, response and audit metadata remains in private custody. Manual portal transfer is an honest channel boundary where no usable authority API exists, while timely submission, rejection repair and evidenced reporting outcomes remain owed. Human-attested responses remain labeled and distinct from independently supported authority acknowledgements; a retained genuine portal receipt may support an acknowledgement without an API. Reports, source versions and response evidence inherit encryption, masking, attributed access and decision audit, statutory retention, legal holds and lawful eligible erasure under ENV-028, ENV-051, ENV-053 and ENV-054. No automatic outbound action, hold release, erasure or external deletion is authorized. Restored history conveys no active transfer authority; any needed renewed transfer requires current authority, reconciliation of prior submissions and uncertain outcomes, fresh preparation and exact approval. These owner-only routes do not narrow the product roles or scoped preparation duties in ENV-028 and ENV-052. Legal effect and timely filing are not proved by preparation, transfer or policy approval; authoritative deadlines and actual submission dates remain separately evidenced. This ruling supersedes the earlier pending policy approval label and changes no acceptance sentence, status or production-readiness claim.

Source resolution, 27 October 2026: the synchronized Gap and Open scope now report 51 mapped directories and remove the two resolved source questions. The ruling’s policy paragraph and all three original acceptance sentences are unchanged. The 102-case journey proves manual field transfer and human-attested responses, never the full official submission matrix. Electronic batch schedules and authentic agency acknowledgement remain unproved.
