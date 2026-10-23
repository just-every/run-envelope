import type { Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, text, integer } from '../security'
import {
  WorkspaceStore,
  digest,
  revision,
  choice,
  type Kind,
  type Revision,
} from '../workspace/store'
import {
  hrisFacts,
  hrisProviders,
  hrisTypes,
  object,
} from '../connectors/hris/adapters'
import { earningFacts, earningProviders } from '../connectors/siblings/earnings'
import { latest, approved, LeaveLedger } from '../leave/ledger'
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
    return rows.map((row) => ({
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
          ? 'https://github.com/just-every/run-' + provider
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
      account = (await ledger.read(actor, personId))[0]
    if (!account || account.data.owner !== 'willow')
      throw new PayrollError('willow_owns_leave_balance', 409)
    return ledger.record(
      actor,
      personId,
      {
        version: integer(input.ledgerVersion),
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
    return latest(
      await this.store.list<SourceEvent>(actor, kind, personId, true, false),
    )
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
