import { fence, auditStatement, requireAction, type Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, text, integer } from '../security'
import {
  WorkspaceStore,
  digest,
  revision,
  choice,
  type Kind,
  type Revision,
  currentSources,
} from '../workspace/store'
import {
  hrisFacts,
  hrisProviders,
  hrisTypes,
  object,
} from '../connectors/hris/adapters'
import { earningFacts, earningProviders } from '../connectors/siblings/earnings'
import { latest, approved, LeaveLedger, leaveBucket } from '../leave/ledger'
import type { EarningsRun } from '../workspace/pay-items'

export interface SourceEvent {
  provider: string
  sourceId: string
  sourceVersion: number
  type: string
  effectiveDate: string
  values: Input
  schema: string
  sourceEvidence: string
  sourceApprovedBy: string
  ownerUrl: string
  sourcePersonId: string
}
export class SourceIntake {
  constructor(public store: WorkspaceStore) {}
  async read(
    actor: Actor,
    personId: string,
    kind: 'hris-event' | 'source-earning',
  ) {
    const rows = await this.store.list<SourceEvent>(actor, kind, personId, true)
    const runs = await this.store.list<EarningsRun>(
      actor,
      'earnings-run',
      undefined,
      true,
      false,
    )
    const f=fence(actor)
    const applications=await this.store.records.statement(
      `SELECT target_id AS id,version FROM env_audit WHERE company_id=? AND action='hris.location-applied' AND ${f.sql}`,
      [actor.company,...f.args],
    ).all<{id:string;version:number}>()
    return rows.map((row) => ({
      appliedVersion: applications.results.some(a=>a.id===row.id && a.version===row.version)?row.version:null,
      ...row,
      acknowledgement: row.withdrawnBy
        ? 'withdrawn'
        : !row.sourcesCurrent
          ? 'source-changed'
          : row.approvedBy
            ? 'reviewed-for-preview'
            : 'held-for-human-review',
      affectedRuns: latest(runs)
        .filter(
          (r) =>
            r.data.people.some((p) => p.id === personId) &&
            row.data.effectiveDate <= r.data.periodEnd,
        )
        .map((r) => ({
          id: r.id,
          version: r.version,
          periodStart: r.data.periodStart,
          periodEnd: r.data.periodEnd,
        })),
      delivered: false,
    }))
  }
  async save(
    actor: Actor,
    personId: string,
    kind: 'hris-event' | 'source-earning',
    input: Input,
  ) {
    await this.store.authority(actor, 'rates:propose', personId, true)
    const provider = choice(
      input.provider,
      kind === 'hris-event' ? hrisProviders : earningProviders,
    )
    const type =
      kind === 'hris-event' ? choice(input.type, hrisTypes) : 'earning'
    const raw = object(input.export),
      sourcePersonId = text(input.sourcePersonId)
    if (
      kind === 'source-earning' &&
      text(raw.approvedBy) !== text(input.sourceApprovedBy)
    )
      throw new PayrollError('source_approver_conflict', 409)
    // The owner reviews the local/source identity mapping; names/emails are never an automatic join.
    if (provider === 'rippling' && text(raw.worker_id) !== sourcePersonId)
      throw new PayrollError('source_person_mapping_conflict', 409)
    const normalized: {
      sourceId: string
      effectiveDate: string
      values: Input
      schema: string
    } =
      kind === 'hris-event'
        ? hrisFacts(provider, type, raw)
        : earningFacts(provider, raw)
    const id =
      'source-' +
      (
        await digest(
          JSON.stringify([provider, sourcePersonId, normalized.sourceId, type]),
        )
      ).slice(0, 40)
    const rows = await this.store.list<SourceEvent>(
        actor,
        kind,
        personId,
        true,
        false,
      ),
      prior = rows.find((r) => r.id === id)
    const sourceVersion = integer(input.sourceVersion)
    if (prior?.data.sourceVersion === sourceVersion)
      throw new PayrollError('source_already_recorded', 409)
    if (
      sourceVersion !== (prior?.data.sourceVersion ?? 0) + 1 ||
      revision(input.version) !== (prior?.version ?? 0)
    )
      throw new PayrollError('source_version_conflict', 409)
    if (kind === 'hris-event' && type === 'location') {
      const locations = await this.store.records.locations(actor)
      if (!locations.some((l) => l.id === normalized.values.locationId))
        throw new PayrollError('unknown_payroll_location')
      normalized.values.personVersion = (await this.store.records.person(actor, personId)).version
    }
    const data: SourceEvent = {
      provider,
      sourcePersonId,
      type,
      sourceVersion,
      ...normalized,
      sourceEvidence: text(input.sourceEvidence, 500),
      sourceApprovedBy: text(input.sourceApprovedBy),
      ownerUrl:
        kind === 'source-earning' || provider === 'willow'
          ? 'https://github.com/' + 'just-every/run-' + provider
          : provider === 'bamboohr'
            ? 'https://www.bamboohr.com'
            : 'https://www.hibob.com',
    }
    return this.store.append(
      actor,
      kind,
      id,
      prior?.version ?? 0,
      data,
      personId,
      true,
    )
  }
  async location(actor: Actor, personId: string, id: string, input: Input) {
    const source = await this.store.find<SourceEvent>(actor, 'hris-event', id, personId, true)
    if (source.data.type !== 'location' || source.data.provider !== 'willow')
      throw new PayrollError('reviewed_willow_location_required', 409)
    if (integer(input.version) !== source.version)
      throw new PayrollError('source_version_conflict', 409)
    const person = await this.store.authority(actor, 'records:write', personId, true)
    const locationId = text(source.data.values.locationId)
    requireAction(actor, 'records:write', locationId, 'compensation')
    const f = fence(actor), event = crypto.randomUUID()
    const applied = () => this.store.records.statement(
      `SELECT 1 FROM env_audit WHERE company_id=? AND action='hris.location-applied' AND target_id=? AND version=? AND ${f.sql}`,
      [actor.company, id, source.version, ...f.args],
    ).first()
    if (await applied()) return {id, version:source.version, applied:true, delivered:false}
    approved(source)
    if (source.data.effectiveDate > new Date().toISOString().slice(0,10))
      throw new PayrollError('location_not_effective', 409)
    const result = await this.store.records.env.DB.batch([
      this.store.records.statement(
        `UPDATE env_people SET location_id=?,version=version+1,change_id=? WHERE company_id=? AND id=? AND version=? AND ${f.sql}
         AND EXISTS(SELECT 1 FROM env_locations WHERE company_id=? AND id=?)
         AND NOT EXISTS(SELECT 1 FROM env_audit WHERE company_id=? AND action='hris.location-applied' AND target_id=? AND version=?)
         AND EXISTS(SELECT 1 FROM env_workspace_versions v WHERE v.company_id=? AND v.kind='hris-event' AND v.object_id=? AND v.version=? AND v.person_id=env_people.id
          AND v.version=(SELECT MAX(version) FROM env_workspace_versions nv WHERE nv.company_id=v.company_id AND nv.kind=v.kind AND nv.object_id=v.object_id)
          AND ${currentSources('v')}
          AND EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='approved')
          AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='withdrawn')) RETURNING id`,
        [locationId,event,actor.company,person!.id,integer(source.data.values.personVersion),...f.args,actor.company,locationId,actor.company,id,source.version,actor.company,id,source.version],
      ),
      auditStatement(this.store.records.env,actor,event,'hris.location-applied',id,source.version,
        'EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND change_id=?)', [actor.company,personId,event]),
    ])
    if (!result[0].results.length && !(await applied())) throw new PayrollError('source_or_person_changed',409)
    return {id, version:source.version, applied:true, delivered:false}
  }
  async leave(actor: Actor, personId: string, id: string, input: Input) {
    const event = await this.store.find<SourceEvent>(
      actor,
      'hris-event',
      id,
      personId,
      true,
    )
    approved(event)
    if (event.data.provider !== 'willow' || event.data.type !== 'leave')
      throw new PayrollError('willow_leave_source_required', 409)
    const ledger = new LeaveLedger(this.store),
      accounts = latest(await ledger.read(actor, personId, false)),
      bucket = leaveBucket(input.bucket ?? (accounts.some(r => r.data.bucket === event.data.values.code) ? event.data.values.code : 'combined')),
      account = accounts.find(r => (r.data.bucket ?? 'combined') === bucket)
    if (!account || account.data.owner !== 'willow')
      throw new PayrollError('willow_owns_leave_balance', 409)
    return ledger.record(
      actor,
      personId,
      {
        bucket,
        version: integer(input.ledgerVersion),
        revisePending: input.revisePending,
        sourceId: event.id,
        sourceVersion: event.data.sourceVersion,
        day: event.data.effectiveDate,
        operation: 'use',
        owner: 'willow',
        minutes: event.data.values.minutes,
        code: event.data.values.code,
        rateCents: event.data.values.rateCents,
        evidence: event.data.sourceEvidence,
      },
      {
        kind: 'hris-event',
        id: event.id,
        version: event.version,
        approved: true,
      },
    )
  }
  async timeline(
    actor: Actor,
    personId: string,
    kind: 'hris-event' | 'source-earning',
  ) {
    const events = latest(
      await this.store.list<SourceEvent>(actor, kind, personId, true, false),
    )
    if (kind !== 'hris-event') return events
    const link = await this.store.records
      .statement(
        'SELECT source_id AS sourceId FROM env_hris_people WHERE company_id=? AND person_id=?',
        [actor.company, personId],
      )
      .first<{ sourceId: string }>()
    if (!link) return events
    const hires = await this.store.list<SourceEvent>(
      actor,
      'hris-hire',
      undefined,
      true,
      false,
    )
    return [...events, ...latest(hires).filter((r) => r.id === link.sourceId)]
  }
}
export function currentEvents(rows: Revision<SourceEvent>[], day: string) {
  return rows.filter((r) => r.data.effectiveDate <= day)
}
/** Conflicts are explicit holds, including a late correction replacing a reviewed version. */
export function reviewedRate(rows: Revision<SourceEvent>[], day: string) {
  const rates = currentEvents(rows, day)
    .filter((r) => r.data.type === 'rate')
    .sort((a, b) => b.data.effectiveDate.localeCompare(a.data.effectiveDate))
  const row = rates[0]
  if (!row) return { row: undefined, hold: undefined }
  const hold =
    rates[1]?.data.effectiveDate === row.data.effectiveDate
      ? 'Conflicting HRIS rates require withdrawal or a corrected source.'
      : !row.approvedBy || row.withdrawnBy || !row.sourcesCurrent
        ? 'Current exact HRIS rate review required; no source proposal authorizes pay.'
        : undefined
  return { row: hold ? undefined : row, hold }
}
export const sourceKinds: Kind[] = ['hris-event', 'source-earning']
