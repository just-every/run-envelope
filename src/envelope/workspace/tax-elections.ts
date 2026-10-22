import type { Actor } from '../access'
import { requireAction } from '../access'
import type { Input } from '../records'
import { date, text, PayrollError } from '../security'
import { WorkspaceStore, objectId, revision, choice } from './store'

export interface TaxElection {
  from: string
  through: string
  state: 'NJ' | 'NY'
  table: string
  filingStatus: string
  allowances: number
  additionalCents: number
  evidenceRef: string
  owner: string
  ownerId: string
}
const amount = (value: unknown, minimum: number, maximum: number) => {
  const n = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(n) || Number(n) < minimum || Number(n) > maximum)
    throw new PayrollError('invalid_withholding_input')
  return Number(n)
}
/** Native-human source recording is preparation, never taxpayer-signature or pay authority. */
export class TaxElections {
  constructor(public store: WorkspaceStore) {}
  async save(actor: Actor, personId: string, input: Input) {
    const person = await this.store.records.person(actor,personId)
    requireAction(actor,'private:write',person.locationId,'tax')
    const from = date(input.from), through = date(input.through)
    if (from > through) throw new PayrollError('invalid_effective_range')
    const state = choice(input.state,['NJ','NY']) as TaxElection['state']
    const data: TaxElection = {
      from,through,state,
      table: state === 'NJ' ? choice(input.table,['A','B','C','D','E']) : '',
      filingStatus: state === 'NY' ? choice(input.filingStatus,['single','head-of-household','married','married-withhold-single']) : '',
      allowances:amount(input.allowances,state === 'NJ' ? 0 : -10000,10000),
      additionalCents:amount(input.additionalCents,0,100000000),
      evidenceRef:text(input.evidenceRef,500),
      owner:actor.session.operator.displayName,ownerId:actor.session.operator.id,
    }
    return this.store.append(actor,'tax-election',objectId(input.id),revision(input.version),data,personId,true)
  }
}
