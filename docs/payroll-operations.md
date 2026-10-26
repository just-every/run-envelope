# Native operations and recovery

The configured native owner with a current owner grant can read
`GET /api/envelope/companies/COMPANY_ID/operations`. The endpoint is read-only;
it neither sends a provider request nor retries a job. All responses are private.
A final current-session and company-grant check follows the probes. If sign-in
or authority storage is unavailable, authentication can fail before diagnostics
are available; use the installation's owner-controlled hosting diagnostics.

`checkedAt` is the UTC epoch time at probe start. `checks` reports each local
probe's state and elapsed milliseconds. Each read waits at most two seconds;
a timed-out underlying D1 read may still finish, but it cannot mutate data.
Database reachability is a `SELECT`; storage checks read the company's encrypted
private-record inventory, and queue checks read the durable proposal outbox.
These checks do not validate write capacity, every ciphertext, backup integrity
or remote provider health. Record custody checks key format and importability,
not whether every stored ciphertext authenticates with that key. No private
record value, credential or underlying database error is returned.

A failed queue probe returns `jobs: null`, never zero obligations. An available
queue reports pending, sending, failed and unknown counts plus expired leases.
Storage or queue failure names the next action: restore dependency access and
inspect retained obligations before any explicit send. An empty queue still
returns `attention-required`, because payment and filing remain unavailable.
`providers` enumerates the declared recipient families. Configuration is not a
network probe, delivery receipt, settlement or agency acknowledgement. Every
provider entry says `delivery: "not established"`. No health read makes an
outbound request or claims a provider is healthy. There is no automatic sender
or scheduler; explicit native-owner consent remains required for every send.

Read `GET /api/envelope/companies/COMPANY_ID/webhooks` to inspect subscriptions,
jobs and attempt history. A sending job exposes `leaseExpiresAt` as its start
time plus 30 seconds. This is an execution lease, not a payroll deadline:
`deadline` is null for reference-only proposal events. A lease expiry does not
prove delivery failed and never authorizes automatic resubmission.

After downtime:

1. Restore database access and the separately held record key. Inspect health
   and jobs before sending anything. Preserve the original event and job IDs.
2. If a sending claim's lease has expired, explicitly POST an empty JSON object
   to `/api/envelope/companies/COMPANY_ID/webhooks/JOB_ID/recover`. This records
   an unknown outcome; it sends nothing. An unexpired claim refuses recovery.
3. Inspect the receiver's record of the original event. Unknown means its effect
   may already exist. Only the permitted owner can explicitly POST
   `{"consent":true}` to the same job's `deliver` door. The receiver must
   deduplicate by the stable event ID. Explicit replay after delivery also needs
   `"replay":true`. At five attempts the owner must investigate; no automatic
   retry circumvents this bound. Revoked subscriptions cannot send.
4. For backup custody, follow [archive recovery](./archive-recovery.md). Restore
   into an empty installation, with the original key and latest trusted erasure
   journal. Imported authority remains inactive. Do not edit the database to
   restore approval or credentials. Historical adoption grants only the exact
   restricted reads documented there.

The archive journey also starts with the immediately prior migration schema,
creates retained business and authority records through native routes, then
applies the current migration with Wrangler while the Worker is stopped.
It compares every populated business and identity table before and after,
including ciphertext, human decisions and an unknown notice dispatch. A second
migration application must preserve those same rows. This tests schema upgrade
and idempotent restart; it does not execute a historical application binary.

This is native proposal-webhook recovery. Complete backup validation across
uncertain payroll effects, prior-release migration, scheduler execution,
release and filing recovery, and the contracted scale and timing journeys
remain unproved under ENV-056. No bank or agency delivery is inferred.
