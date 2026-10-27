import type { Actor } from '../access'
import type { Input } from '../records'
import { date, integer, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, choice } from './store'

/**
 * One recorded tip for one worker and day. Cash tips were already received by the
 * worker; paycheck tips are paid through payroll. Furnished funds are money the
 * worker actually gave the employer toward tax on tips. Tax treatment is not computed.
 */
export interface TipEntry {
  day: string
  amountCents: number
  settlement: 'cash' | 'paycheck'
  furnishedCents: number
  sourceItem?: string
  settlementEvidence?: string
  sourceRef: string
  owner: string
  ownerId: string
}
const cents = (value: unknown) => (value === undefined || value === '' || value === 0 || value === '0' ? 0 : integer(value))

export class Tips {
  constructor(public store: WorkspaceStore) {}
  async save(actor: Actor, personId: string, input: Input) {
    if (String(input.id).startsWith('tip-source-')) throw new PayrollError('source_intake_required', 409)
    const amountCents = integer(input.amountCents),
      furnishedCents = cents(input.furnishedCents)
    if (furnishedCents > amountCents) throw new PayrollError('invalid_tip_funds')
    const data: TipEntry = {
      day: date(input.day),
      amountCents,
      settlement: choice(input.settlement, ['cash', 'paycheck']) as TipEntry['settlement'],
      furnishedCents,
      sourceRef: text(input.sourceRef, 240),
      owner: actor.session.operator.displayName,
      ownerId: actor.session.operator.id,
    }
    return this.store.append(actor, 'tip', objectId(input.id), revision(input.version), data, personId, true)
  }
}
