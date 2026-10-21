# Work, residence and jurisdiction previews

The current payroll allocation surface is available to a native human session at
`/app/envelope/companies/{company}/people/{person}/allocations` and the matching
`/api/envelope/companies/{company}/people/{person}/allocations` API. Existing
company, location, record and compensation grants apply. Agent credentials do
not authorize these doors. Every response is private and uncached.

POST `residence`, `work` or `election` under that path to append a revision. Each
request supplies an `id` and the current `version` (zero for a new ID). Residence
uses inclusive `from`/`through`, `state`, `locality`, `evidence`. Review responsibility is assigned to the authenticated recording human; client-supplied `owner` names cannot assign or impersonate another person.
Work uses `day`, physical `state`/`locality`, actual `minutes`, `earnedCents`,
`officeState`, `nyReason`, optional necessity `evidence`, `sourceRef`.
Election uses inclusive dates, `residentState`, `workState`, `form` (NJ-165 or
REV-419EX), signed certificate custody `evidence`. Review responsibility is assigned to the authenticated recording human; client-supplied `owner` names cannot assign or impersonate another person. Entered references
are evidence records, not electronic signature verification or an agency receipt.
For a move, revise the earlier residence's end date and add the new residence;
working in another state does not change residence. Old revisions remain encrypted.

GET the path with `?from=YYYY-MM-DD&through=YYYY-MM-DD` for a current-source
preview. The result includes physical work, effective residence, wage bases,
localities, election/version references, official rule editions and assigned
unresolved work. A base can apply to both resident and source states; do not sum
bases as tax liabilities. Earnings cents are retained exactly, without a balancing
entry. This is not a tax calculation, paycheck, reporting file or release approval.

NJ/PA reciprocal wage withholding and New York assigned-office convenience versus
documented employer necessity have explicit source references. PA EIT/LST remains
unresolved: NJ/PA reciprocity never waives local taxes. Missing/overlapping residence,
more than 24 hours on one day, unresolved NY necessity and unimplemented states
remain assigned holds. Local tax tables, resident credits, complete reporting,
all-state coverage and actual gross-to-net payroll are still unimplemented.
Missing tax account numbers are not consulted here and cannot create wage holds.
