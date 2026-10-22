import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, choice } from './store'
import type { ProrationPolicy } from './proration'
import type { PayItems } from './pay-items'

/** Method selection is an exact human-reviewed group policy, never an agent default. */
export class PayPolicies {
  constructor(public store: WorkspaceStore, public pay: PayItems) {}
  async save(actor: Actor, input: Input) {
    const group = await this.pay.approvedGroup(actor, objectId(input.groupId))
    let minutes: unknown = input.weekMinutes ?? Array.from({length:7}, (_,i) => {
      const n = input['scheduledMinutes' + i]
      return typeof n === 'string' && /^\d+$/.test(n) ? Number(n) : n
    })
    if (typeof minutes === 'string') {
      try { minutes = JSON.parse(minutes) } catch { throw new PayrollError('invalid_week_schedule') }
    }
    if (!Array.isArray(minutes) || minutes.length !== 7 ||
        minutes.some((m) => !Number.isSafeInteger(m) || m < 0 || m > 1440) ||
        !minutes.some((m) => m > 0)) throw new PayrollError('invalid_week_schedule')
    const weekStartsOn = Number(input.weekStartsOn)
    if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6)
      throw new PayrollError('invalid_workweek_start')
    const data: ProrationPolicy = {
      name: text(input.name), groupId: group.id, groupName: group.data.name, groupVersion: group.version,
      effectiveDate: date(input.effectiveDate),
      method: choice(input.method, ['calendar-days', 'scheduled-workdays', 'scheduled-hours']) as ProrationPolicy['method'],
      weekMinutes: minutes as number[], weekStartsOn,
    }
    return this.store.append(actor, 'proration-policy', objectId(input.id), revision(input.version),
      data, undefined, true, {
        people: group.data.people.map((p) => ({ id: p.id, version: p.version })),
        objects: [{ kind: 'group', id: group.id, version: group.version, approved: true }],
      })
  }
}
