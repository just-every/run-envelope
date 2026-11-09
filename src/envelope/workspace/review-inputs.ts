import type { Actor } from '../access'
import { fence } from '../access'
import { PayrollError } from '../security'
import type { Kind, WorkspaceStore } from './store'

export interface ReviewInputSet {
  kind: Kind | 'private-ssn'
  personId: string
  exceptId: string
  versions: number
  decisions: number
}
const counts = (company: string, kind: string, person: string, except: string) => {
  const where = `cv.company_id=${company} AND cv.kind=${kind} AND cv.person_id IS NULLIF(${person},'') AND cv.object_id!=${except}`
  return {
    versions: `(CASE WHEN ${kind}='private-ssn' THEN COALESCE((SELECT version FROM env_private_records WHERE company_id=${company} AND person_id=${person} AND kind='ssn'),0) ELSE (SELECT COUNT(*) FROM env_workspace_versions cv WHERE ${where}) END)`,
    decisions: `(CASE WHEN ${kind}='private-ssn' THEN 0 ELSE (SELECT COUNT(*) FROM env_workspace_decisions cd JOIN env_workspace_versions cv ON cv.company_id=cd.company_id AND cv.kind=cd.kind AND cv.object_id=cd.object_id AND cv.version=cd.version WHERE ${where}) END)`,
  }
}
/** Collection changes matter to a pending comparison, not to an already adopted rate. */
export function currentReviewInputs(alias: string, kinds?: readonly string[]) {
  const c = counts(`${alias}.company_id`, 'ri.source_kind', 'ri.source_person_id', 'ri.except_id')
  return `NOT EXISTS(SELECT 1 FROM env_workspace_review_inputs ri WHERE ri.company_id=${alias}.company_id AND ri.kind=${alias}.kind AND ri.object_id=${alias}.object_id AND ri.version=${alias}.version ${kinds ? `AND ri.source_kind IN (${kinds.map(kind=>`'${kind}'`).join(',')})` : ''} AND (${c.versions}!=ri.versions OR ${c.decisions}!=ri.decisions))`
}
export function reviewInputFence(company: string, sets: ReviewInputSet[]) {
  const c = counts('?', "json_extract(pin.value,'$.kind')", "json_extract(pin.value,'$.personId')", "json_extract(pin.value,'$.exceptId')")
  return {
    sql: `NOT EXISTS(SELECT 1 FROM json_each(?) pin WHERE ${c.versions}!=json_extract(pin.value,'$.versions') OR ${c.decisions}!=json_extract(pin.value,'$.decisions'))`,
    args: [JSON.stringify(sets), company, company, company],
  }
}
export async function reviewInputSets(store: WorkspaceStore, actor: Actor, proposalId: string, people: string[]) {
  return collectionPins(store, actor, [
    {kind:'schedule',personId:'',exceptId:''},
    {kind:'pay-change',personId:'',exceptId:proposalId},
    {kind:'proration-policy',personId:'',exceptId:''},
    ...people.map((personId) => ({kind:'work' as Kind,personId,exceptId:''})),
  ])
}
/** Pins the current size of each named collection, so a newly added ID is material too. */
export async function collectionPins(store: WorkspaceStore, actor: Actor, specs: {kind: ReviewInputSet['kind']; personId: string; exceptId: string}[]) {
  const f = fence(actor), c = counts('?', "json_extract(pin.value,'$.kind')", "json_extract(pin.value,'$.personId')", "json_extract(pin.value,'$.exceptId')")
  const result = await store.records.statement(
    `SELECT json_extract(pin.value,'$.kind') AS kind,json_extract(pin.value,'$.personId') AS personId,json_extract(pin.value,'$.exceptId') AS exceptId,${c.versions} AS versions,${c.decisions} AS decisions FROM json_each(?) pin WHERE ${f.sql}`,
    [actor.company,actor.company,actor.company,JSON.stringify(specs),...f.args],
  ).all<ReviewInputSet>()
  if (result.results.length !== specs.length) throw new PayrollError('authority_changed',409)
  return result.results
}
