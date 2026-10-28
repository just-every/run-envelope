import type { Input, Records } from '../records'
import { WorkspaceStore } from '../workspace/store'
import { PayrollError } from '../security'
import { CommuterDependentCare } from './commuter-dependent-care'

export async function benefitsResponse(ui: boolean, post: boolean, parts: string[], value: Input, records: Records): Promise<Response | null> {
  if (ui || parts[0] !== 'companies' || parts[2] !== 'people' || parts[4] !== 'pretax-benefits') return null
  const actor = await records.actor(parts[1]), benefits = new CommuterDependentCare(new WorkspaceStore(records)), person = parts[3]
  const headers = {'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff'}
  let result: unknown, status = 200
  if (parts.length === 5 && !post) result = await benefits.list(actor, person)
  else if (parts.length === 6 && post && ['elections', 'accumulators'].includes(parts[5])) {
    result = parts[5] === 'elections' ? await benefits.saveElection(actor, person, value) : await benefits.saveAccumulator(actor, person, value)
    status = 201
  } else if (parts.length === 8 && ['elections', 'accumulators'].includes(parts[5])) {
    const kind = parts[5] === 'elections' ? 'pretax-election' : 'pretax-accumulator'
    if (parts[7] === 'review' && !post) result = await benefits.review(actor, person, kind, parts[6])
    else if (parts[7] === 'decision' && post) result = await benefits.decide(actor, person, kind, parts[6], value)
    else throw new PayrollError('not_found', 404)
  } else throw new PayrollError('not_found', 404)
  return Response.json(result, {status, headers})
}
