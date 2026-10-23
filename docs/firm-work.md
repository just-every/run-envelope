# Client payroll work

Open **Client payroll work** from company settings. The workspace includes only companies that have granted the signed-in person current payroll access. A client grants each firm staff member explicitly; a firm role label confers no additional powers. The existing client grant is that person's mandate, and changing it invalidates old sessions and pending approval authority.

The workspace shows retained run versions and their current approval state, permitted tax notices, effective registration status and sourced work deadlines. It does not expose registration account numbers. Salary fields and notice fields keep their separate permissions. Missing calculation, bank funding cutoffs or filing information remain unavailable; a deadline is a human-recorded source fact, never a generated provider confirmation.

Use the date, client and work filters to find due work. Select reviewed client groups and a pay period to prepare several drafts. Each item checks current company authority independently and reports its own prepared or refused outcome. A repeated preparation key returns the same draft; changing its period or source group cannot reuse that key. Open each exact version in its named client to approve it. Preparation never approves, releases funds or files a return.

## Assignments and handovers

Assign a run, funding task, notice response, registration or filing task from its source in the workspace. The assignment pins the actual company, source and version, records the deadline with its time zone and source reference, and names a responsible person and backup. Recipients must already have sufficient current client permission. Records are encrypted and every assignment change retains its attributed history.

On removal of a client grant or staff identity, pending work moves atomically to its permitted backup or the current client owner. Historical approval attribution stays with the original approver; it never transfers to the successor. An installation cannot remove its last eligible client owner while that client's work remains owned here. A revoked staff session cannot use an old source link, approve a run or request release.

## Human handoff to Blotter

The client owner declares the practice's HTTPS Blotter origin in **Practice handoff settings**. An authorized person creates or updates the real client job and discussion in Blotter using their own native sign-in, then records its job link, receiving person and handoff reference in Envelope. The supported Blotter door is `/app?job=<job-id>`. No Envelope credential is sent to Blotter, and neither application inherits the other's payroll access.

The handoff remains pending until the named receiving person acknowledges it in Envelope. This records human receipt of work, not automatic delivery, completed payroll, agency acceptance or remote job completion. Removing the recipient preserves the handover and returns ownership to a permitted person. Share the client, deadline and protected source link; salary, identity documents and bank values remain behind Envelope's own sign-in and client grants.

The native Blotter job and discussion shapes follow its `POST /api/blotter/jobs` and `POST /api/blotter/jobs/:id/threads` doors, inspected at commit `8bc06fa6bf6e775277e7b6189fcc615a226db377`. This integration performs no unattended Blotter mutation and does not use its agent credentials.

## Application doors

- `GET /api/envelope/firm`: current permitted client summaries. Filters: `day`, `due=today`, `company`, `kind` and `owner`.
- `POST /api/envelope/firm/prepare`: `requestKey`, selected `selections` in the form `company-id:group-id:version`, `periodStart`, `periodEnd`, `payDate` and `frequency`.
- `GET` and `POST /api/envelope/companies/:company/firm-work`: scoped assignments and source-bound creation.
- `GET /api/envelope/companies/:company/firm-work/:id`: assignment and retained human handover history.
- `POST` to an assignment's `delegate`, `handoff` or `acknowledge` suffix: exact-version actions, checked against current client authority.
- `GET` and `POST /api/envelope/companies/:company/firm-settings`: the declared Blotter origin; only the client owner can change it.

The native pages use the corresponding paths under `/app/envelope`. Every mutation requires a native human session, current grants and the same-origin check.
