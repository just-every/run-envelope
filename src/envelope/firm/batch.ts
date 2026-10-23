import type { Records, Input } from '../records'
import { date, text, PayrollError } from '../security'
import { WorkspaceStore, digest, objectId } from '../workspace/store'
import { PayItems, type Group, type EarningsRun } from '../workspace/pay-items'

export async function prepareBatch(records: Records, input: Input) {
  const selections = input.selections
  if (!Array.isArray(selections) || !selections.length || selections.length > 100) throw new PayrollError('select_preparation_items')
  const requestKey = objectId(input.requestKey), periodStart = date(input.periodStart), periodEnd = date(input.periodEnd), payDate = date(input.payDate), frequency = text(input.frequency)
  const items = selections.map(value => {
    const parts = text(value, 250).split(':')
    if (parts.length !== 3 || !/^[1-9]\d*$/.test(parts[2])) throw new PayrollError('invalid_preparation_selection')
    return { companyId: objectId(parts[0]), groupId: objectId(parts[1]), groupVersion: Number(parts[2]) }
  })
  if (new Set(selections).size !== selections.length) throw new PayrollError('duplicate_preparation_selection')
  const outcomes = []
  for (const item of items) {
    try {
      const actor = await records.actor(item.companyId), store = new WorkspaceStore(records), pay = new PayItems(store)
      await store.authority(actor, 'rates:propose', undefined, true)
      const group = await store.find<Group>(actor, 'group', item.groupId, undefined, true)
      if (group.version !== item.groupVersion || !group.approvedBy || group.withdrawnBy || !group.sourcesCurrent) throw new PayrollError('group_changed_review_again', 409)
      const id = 'firm-' + (await digest(JSON.stringify([records.session.operator.id, requestKey, item.companyId, item.groupId]))).slice(0, 48)
      const existing = (await store.list<EarningsRun>(actor, 'earnings-run', undefined, true)).find(r => r.id === id)
      if (existing) {
        const same = existing.version === 1 && existing.data.groupId === item.groupId && existing.data.periodStart === periodStart && existing.data.periodEnd === periodEnd && existing.data.payDate === payDate && existing.data.frequency === frequency
        const pin = await records.statement(`SELECT source_version FROM env_workspace_dependencies WHERE company_id=? AND kind='earnings-run' AND object_id=? AND version=1 AND source_kind='group' AND source_id=?`, [actor.company, id, item.groupId]).first<{ source_version: number }>()
        if (!same || pin?.source_version !== item.groupVersion) throw new PayrollError('preparation_key_reused', 409)
        outcomes.push({ ...item, id, version: existing.version, state: 'already-prepared' as const })
      } else {
        const saved = await pay.preview(actor, { id, version: 0, groupId: item.groupId, periodStart, periodEnd, payDate, frequency }, true)
        outcomes.push({ ...item, id: saved.id, version: saved.version, state: 'prepared' as const })
      }
    } catch (error) {
      if (!(error instanceof PayrollError)) throw error
      outcomes.push({ ...item, state: 'refused' as const, error: error.code })
    }
  }
  return { outcomes }
}
export type BatchResult = Awaited<ReturnType<typeof prepareBatch>>
