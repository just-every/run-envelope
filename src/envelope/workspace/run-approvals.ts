import { presentationFence } from '../review-presentation'
import { HumanProof } from '../human-proof'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { fence, auditStatement, type Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, integer, text } from '../security'
import { WorkspaceStore, currentSources, digest, objectId, revision, type Revision } from './store'
import type { EarningsRun, PayItems } from './pay-items'

/** Owner-set company policy: runs whose known debit reaches the threshold need two people. */
export interface ApprovalPolicy {
  name: string
  secondApprovalAtCents: number
}
export interface RunApproval {
  approverId: string
  approverName: string
  role: string
  grantVersion: number
  occurredAt: number
  contentDigest: string
  debitCents: number
  current: boolean
  presentingClient: string
  proofMethod: string
}
export interface RunApprovalStatus {
  runId: string
  version: number
  debitCents: number
  required: number
  current: number
  thresholdCents: number | null
  approvals: RunApproval[]
}

const kind = 'earnings-run'
// The calendar-day interim and every salary proration preview stay unapprovable
// (ct 22 Oct 2026); hourly runs carry no proration codes.
const prorationHeld = (run: EarningsRun) =>
  run.holds.some((h) => h.code?.startsWith('proration-'))
/** Tax obligations, fees and a rail do not exist yet: the known debit is gross cash. */
const debit = (run: EarningsRun) => run.grossCashCents
const contentDigest = (actor: Actor, row: Revision<EarningsRun>) =>
  digest(JSON.stringify([actor.company, kind, row.id, row.version, row.data]))
const destinationFence = (actor: Actor, run: EarningsRun) => ({
  sql: `NOT EXISTS(SELECT 1 FROM json_each(?) d WHERE COALESCE((SELECT pr.version FROM env_private_records pr
    WHERE pr.company_id=? AND pr.person_id=json_extract(d.value,'$.personId') AND pr.kind='bank'),0)!=json_extract(d.value,'$.bankVersion'))`,
  args: [JSON.stringify(run.destinations ?? []), actor.company],
})

export class RunApprovals {
  constructor(
    public store: WorkspaceStore,
    public pay: PayItems,
  ) {}
  async savePolicy(actor: Actor, input: Input) {
    if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
    const secondApprovalAtCents = integer(input.secondApprovalAtCents)
    if (secondApprovalAtCents < 1) throw new PayrollError('invalid_approval_threshold')
    const data: ApprovalPolicy = { name: text(input.name), secondApprovalAtCents }
    return this.store.append(actor, 'approval-policy', objectId(input.id), revision(input.version), data, undefined, true)
  }
  async threshold(actor: Actor) {
    const rows = await this.store.list<ApprovalPolicy>(actor, 'approval-policy', undefined, true, false)
    const current = rows
      .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
      .filter((r) => r.approvedBy && !r.withdrawnBy && r.sourcesCurrent)
    // Several current policies never relax each other: the lowest threshold binds.
    return current.length ? Math.min(...current.map((r) => r.data.secondApprovalAtCents)) : null
  }
  async statuses(actor: Actor, runs: Revision<EarningsRun>[]) {
    const f = fence(actor),
      thresholdCents = await this.threshold(actor)
    const rows = (
      await this.store.records
        .statement(
          `SELECT a.run_id AS runId,a.version,a.approver_id AS approverId,o.display_name AS approverName,a.role,a.grant_version AS grantVersion,
          a.presenting_client AS presentingClient,a.proof_method AS proofMethod,a.occurred_at AS occurredAt,a.content_digest AS contentDigest,a.debit_cents AS debitCents,
          EXISTS(SELECT 1 FROM env_grants g JOIN oa_operators go ON go.id=g.operator_id WHERE g.company_id=a.company_id AND g.operator_id=a.approver_id
            AND g.version=a.grant_version AND g.revoked_at IS NULL AND go.status='active'
            AND (g.role='owner' OR EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='pay:approve'))) AS grantCurrent
          FROM env_run_approvals a JOIN oa_operators o ON o.id=a.approver_id WHERE a.company_id=? AND ${f.sql} ORDER BY a.occurred_at`,
          [actor.company, ...f.args],
        )
        .all<RunApproval & { runId: string; version: number; grantCurrent: number }>()
    ).results
    return Promise.all(
      runs.map(async (run): Promise<RunApprovalStatus> => {
        const exact = await contentDigest(actor, run)
        const approvals = rows
          .filter((a) => a.runId === run.id && a.version === run.version)
          .map(({ runId: _r, version: _v, grantCurrent, ...a }) => ({
            ...a,
            current: Boolean(grantCurrent) && ['passkey-uv','oidc-mfa'].includes(a.proofMethod) && a.contentDigest === exact,
          }))
        const known = debit(run.data)
        return {
          runId: run.id,
          version: run.version,
          debitCents: known,
          thresholdCents,
          required: thresholdCents !== null && known >= thresholdCents ? 2 : 1,
          current: approvals.filter((a) => a.current).length,
          approvals,
        }
      }),
    )
  }
  /** The latest exact version, refused unless every binding is still current. */
  async current(actor: Actor, id: string, version?: unknown) {
    const row = await this.store.find<EarningsRun>(actor, kind, objectId(id), undefined, true)
    if (prorationHeld(row.data)) throw new PayrollError('proration_preview_not_payable', 409)
    // A client version is parsed only after the run itself is known to be approvable.
    if (version !== undefined && row.version !== integer(version))
      throw new PayrollError('run_version_superseded', 409)
    const check = await this.pay.sourceCheck(actor, row)
    if (!check.setup) throw new PayrollError('run_sources_changed', 409)
    if (!check.rules) throw new PayrollError('run_rules_changed', 409)
    const d = destinationFence(actor, row.data)
    if (!(await this.store.records.statement(`SELECT 1 AS same WHERE ${d.sql}`, d.args).first()))
      throw new PayrollError('run_destination_changed', 409)
    const [status] = await this.statuses(actor, [row])
    return { row, status, exact: await contentDigest(actor, row) }
  }
  async review(actor: Actor, id: string, presentation?: string) {
    await this.store.authority(actor, 'pay:approve', undefined, true)
    const { row, status } = await this.current(actor, id)
    if (status.approvals.some((a) => a.approverId === actor.session.operator.id))
      throw new PayrollError('second_approver_must_differ', 409)
    const presentationHash=presentation ? await digest(presentation) : ''
    const presenter=await presentationFence(this.store.records.env,presentationHash,actor.company,row.id,row.version)
    const token = crypto.randomUUID() + crypto.randomUUID(),
      f = fence(actor),
      event = crypto.randomUUID()
    const result = await this.store.records.env.DB.batch([
      this.store.records.statement(
        `INSERT INTO env_workspace_reviews(token_hash,company_id,kind,object_id,version,session_id,operator_id,grant_version,expires_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE ${f.sql} AND (SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind=? AND object_id=?)=? RETURNING token_hash`,
        [await digest(token), actor.company, kind, row.id, row.version, actor.session.id, actor.session.operator.id,
          actor.grant.version, Date.now() + 600000, ...f.args, actor.company, kind, row.id, row.version],
      ),
      auditStatement(this.store.records.env, actor, event, 'run.reviewed', row.id, row.version,
        'EXISTS(SELECT 1 FROM env_workspace_reviews WHERE token_hash=? AND session_id=?)',
        [await digest(token), actor.session.id]),
    ])
    if (!result[0].results.length) throw new PayrollError('review_stale', 409)
    const humanProof = await new HumanProof(this.store).options(actor, token, row.id, row.version, await contentDigest(actor,row),presentationHash,presenter.client)
    return { ...row, reviewToken: token, approval: status, humanProof }
  }
  async approve(actor: Actor, id: string, input: Input) {
    await this.store.authority(actor, 'pay:approve', undefined, true)
    const { row, status, exact } = await this.current(actor, id, input.version ?? null)
    const approver = actor.session.operator.id
    if (status.approvals.some((a) => a.approverId === approver))
      throw new PayrollError('second_approver_must_differ', 409)
    const hash = await digest(text(input.reviewToken, 100)),
      f = fence(actor),
      d = destinationFence(actor, row.data),
      event = crypto.randomUUID(),
      now = Date.now()
    if (!await this.store.records.statement(`SELECT 1 AS valid FROM env_workspace_reviews WHERE token_hash=? AND company_id=? AND kind=? AND object_id=? AND version=? AND session_id=? AND operator_id=? AND grant_version=? AND expires_at>?`,
      [hash,actor.company,kind,row.id,row.version,actor.session.id,approver,actor.grant.version,now]).first())
      throw new PayrollError('review_stale',409)
    if (input.gesture !== 'approve-exact-run' || !input.humanChallenge || !input.assertion)
      throw new PayrollError('human_step_up_required',403)
    const proof=await new HumanProof(this.store).verify(actor, String(input.humanChallenge), input.assertion as AuthenticationResponseJSON, hash,row.id,row.version,exact)
    const humanChallenge=await new HumanProof(this.store).challenge(actor,proof.id,'approve')
    const presenter=await presentationFence(this.store.records.env,String(humanChallenge.presentation_hash),actor.company,row.id,row.version)
    // Every binding is repeated inside the write: latest version, pinned sources and
    // collections, bank versions, one session-bound review and one row per person.
    const result = await this.store.records.env.DB.batch<Record<string, unknown>>([
      this.store.records.statement(
        `INSERT INTO env_run_approvals(company_id,kind,run_id,version,approver_id,role,grant_version,session_id,content_digest,debit_cents,occurred_at,change_id,presenting_client,proof_method)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql}
        AND (SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind=? AND object_id=?)=?
        AND EXISTS(SELECT 1 FROM env_workspace_versions v WHERE v.company_id=? AND v.kind=? AND v.object_id=? AND v.version=? AND ${currentSources('v')})
        AND ${d.sql}
        AND EXISTS(SELECT 1 FROM env_workspace_reviews WHERE token_hash=? AND company_id=? AND kind=? AND object_id=? AND version=? AND session_id=? AND operator_id=? AND grant_version=? AND expires_at>?)
        AND NOT EXISTS(SELECT 1 FROM env_run_approvals WHERE company_id=? AND run_id=? AND version=? AND approver_id=?)
        AND EXISTS(SELECT 1 FROM env_human_challenges h WHERE h.id=? AND h.session_id=? AND h.operator_id=? AND h.company_id=? AND h.grant_version=? AND h.review_hash=? AND h.run_id=? AND h.run_version=? AND h.content_digest=? AND h.consumed_at IS NULL AND h.expires_at>?)
        AND ${proof.sql} AND ${presenter.sql}
        RETURNING approver_id`,
        [actor.company, kind, row.id, row.version, approver, actor.grant.role, actor.grant.version, actor.session.id,
          exact, debit(row.data), now, event, presenter.client, proof.method, ...f.args,
          actor.company, kind, row.id, row.version,
          actor.company, kind, row.id, row.version,
          ...d.args,
          hash, actor.company, kind, row.id, row.version, actor.session.id, approver, actor.grant.version, now,
          actor.company, row.id, row.version, approver,
          proof.id,actor.session.id,approver,actor.company,actor.grant.version,hash,row.id,row.version,exact,now,
          ...proof.args,...presenter.args],
      ),
      this.store.records.statement('UPDATE env_human_challenges SET consumed_at=? WHERE id=? AND EXISTS(SELECT 1 FROM env_run_approvals WHERE change_id=?)',[now,proof.id,event]),
      this.store.records.statement('UPDATE env_passkeys SET counter=? WHERE credential_id=? AND EXISTS(SELECT 1 FROM env_run_approvals WHERE change_id=?)',['nextCounter' in proof ? proof.nextCounter : 0,'credentialId' in proof ? proof.credentialId : '',event]),
      auditStatement(this.store.records.env, actor, event, 'run.approved', row.id, row.version,
        'EXISTS(SELECT 1 FROM env_run_approvals WHERE change_id=?)', [event]),
    ])
    if (!result[0].results.length) throw new PayrollError('review_stale', 409)
    return { id: row.id, version: row.version, approverId: approver, contentDigest: exact,
      required: status.required, current: status.current + 1 }
  }
  /**
   * Rechecks the exact approved version. Even a fully authorized version is refused
   * today: ENV-006 tax obligations and an authorized ENV-011/035 rail do not exist,
   * so release records nothing and contacts no provider.
   */
  async release(actor: Actor, id: string, input: Input) {
    await this.store.authority(actor, 'pay:release', undefined, true)
    const { status } = await this.current(actor, id, input.version ?? null)
    if (status.current < status.required)
      throw new PayrollError(
        status.approvals.some((a) => !a.current)
          ? 'approval_authority_changed'
          : status.current
            ? 'second_approval_required'
            : 'approval_required',
        409,
      )
    throw new PayrollError('run_not_payable', 409)
  }
}
