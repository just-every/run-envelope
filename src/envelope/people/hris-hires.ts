import type { Actor } from '../access'
import { fence, auditStatement } from '../access'
import type { Input } from '../records'
import { text, integer, PayrollError } from '../security'
import {
  WorkspaceStore,
  digest,
  revision,
  currentSources,
} from '../workspace/store'
import { approved } from '../leave/ledger'
import { object, hrisFacts } from '../connectors/hris/adapters'
import type { SourceEvent } from '../intake/sources'

/** Only payroll-required fields cross the reviewed Willow-to-payroll hire door. */
export class HrisHires {
  constructor(public store: WorkspaceStore) {}
  async read(actor: Actor) {
    const sources = await this.store.list<SourceEvent>(
        actor,
        'hris-hire',
        undefined,
        true,
      ),
      f = fence(actor)
    const links = await this.store.records
      .statement(
        `SELECT source_id AS sourceId,person_id AS personId FROM env_hris_people WHERE company_id=? AND ${f.sql}`,
        [actor.company, ...f.args],
      )
      .all<{ sourceId: string; personId: string }>()
    return sources.map((r) => ({
      ...r,
      personId:
        links.results.find((l) => l.sourceId === r.id)?.personId ?? null,
    }))
  }
  async save(actor: Actor, input: Input) {
    await this.store.authority(actor, 'rates:propose', undefined, true)
    if (input.provider !== 'willow')
      throw new PayrollError('hires_must_arrive_through_willow', 403)
    const raw = object(input.export),
      normalized = hrisFacts('willow', 'hire', raw),
      values = object(raw.values),
      sourcePersonId = text(input.sourcePersonId)
    const locationId = text(values.locationId),
      name = text(values.name)
    if (
      !(await this.store.records.locations(actor)).some(
        (l) => l.id === locationId,
      )
    )
      throw new PayrollError('unknown_payroll_location')
    const id =
      'hire-' +
      (await digest(JSON.stringify(['willow', sourcePersonId]))).slice(0, 40)
    const prior = (
        await this.store.list<SourceEvent>(
          actor,
          'hris-hire',
          undefined,
          true,
          false,
        )
      ).find((r) => r.id === id),
      sourceVersion = integer(input.sourceVersion)
    if (prior?.data.sourceVersion === sourceVersion)
      throw new PayrollError('source_already_recorded', 409)
    if (
      sourceVersion !== (prior?.data.sourceVersion ?? 0) + 1 ||
      revision(input.version) !== (prior?.version ?? 0)
    )
      throw new PayrollError('source_version_conflict', 409)
    const data: SourceEvent = {
      ...normalized,
      values: { name, locationId },
      provider: 'willow',
      sourcePersonId,
      sourceVersion,
      type: 'hire',
      sourceEvidence: text(input.sourceEvidence, 500),
      sourceApprovedBy: text(input.sourceApprovedBy),
      ownerUrl: 'https://github.com/just-every/run-willow',
    }
    return this.store.append(
      actor,
      'hris-hire',
      id,
      prior?.version ?? 0,
      data,
      undefined,
      true,
    )
  }
  async apply(actor: Actor, id: string, input: Input) {
    const source = await this.store.find<SourceEvent>(
      actor,
      'hris-hire',
      id,
      undefined,
      true,
    )
    approved(source)
    if (integer(input.version) !== source.version)
      throw new PayrollError('source_version_conflict', 409)
    await this.store.authority(actor, 'records:write', undefined, true)
    const sourceKey = await digest(
        JSON.stringify([source.data.provider, source.data.sourcePersonId]),
      ),
      f = fence(actor)
    const mapped = async () =>
      this.store.records
        .statement(
          `SELECT p.id,p.name,p.location_id AS locationId,p.version FROM env_hris_people h JOIN env_people p ON p.company_id=h.company_id AND p.id=h.person_id WHERE h.company_id=? AND h.source_key=? AND ${f.sql}`,
          [actor.company, sourceKey, ...f.args],
        )
        .first<{
          id: string
          name: string
          locationId: string
          version: number
        }>()
    const existing = await mapped()
    if (existing) return { ...existing, created: false }
    const personId = crypto.randomUUID(),
      event = crypto.randomUUID(),
      locationId = String(source.data.values.locationId),
      name = String(source.data.values.name)
    const result = await this.store.records.env.DB.batch([
      this.store.records.statement(
        `INSERT INTO env_hris_people(company_id,source_key,source_id,person_id,change_id) SELECT ?,?,?,?,? WHERE ${f.sql}
        AND EXISTS(SELECT 1 FROM env_locations WHERE company_id=? AND id=?)
        AND EXISTS(SELECT 1 FROM env_workspace_versions v WHERE v.company_id=? AND v.kind='hris-hire' AND v.object_id=? AND v.version=?
          AND v.version=(SELECT MAX(version) FROM env_workspace_versions nv WHERE nv.company_id=v.company_id AND nv.kind=v.kind AND nv.object_id=v.object_id)
          AND ${currentSources('v')}
          AND EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='approved')
          AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions d WHERE d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='withdrawn'))
        AND NOT EXISTS(SELECT 1 FROM env_hris_people WHERE company_id=? AND source_key=?) RETURNING person_id`,
        [
          actor.company,
          sourceKey,
          id,
          personId,
          event,
          ...f.args,
          actor.company,
          locationId,
          actor.company,
          id,
          source.version,
          actor.company,
          sourceKey,
        ],
      ),
      this.store.records.statement(
        `INSERT INTO env_people(company_id,id,location_id,name,change_id) SELECT company_id,person_id,?,?,? FROM env_hris_people WHERE company_id=? AND change_id=?`,
        [locationId, name, event, actor.company, event],
      ),
      auditStatement(
        this.store.records.env,
        actor,
        event,
        'hris.hire-applied',
        personId,
        1,
        'EXISTS(SELECT 1 FROM env_hris_people WHERE company_id=? AND change_id=?)',
        [actor.company, event],
      ),
    ])
    const person = await mapped()
    if (!person) throw new PayrollError('source_or_authority_changed', 409)
    return { ...person, created: result[0].results.length === 1 }
  }
}
