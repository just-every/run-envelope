import { fence, requireAction, auditStatement, type Actor } from '../access'
import { Records } from '../records'
import { Notices } from '../notices'
import { recordKey, unseal, date } from '../security'
import { PayItems } from '../workspace/pay-items'
import { RunApprovals } from '../workspace/run-approvals'
import { WorkspaceStore } from '../workspace/store'
import { FirmWork } from './work'

export const permits = (actor: Actor, action: string, field?: string) =>
  actor.grant.role === 'owner' || (actor.grant.actions.includes(action) && (!field || actor.grant.fields.includes(field)))

export async function registrationSummary(records: Records, actor: Actor, asOf: string) {
  requireAction(actor, 'records:read', undefined, 'tax')
  if (!actor.grant.locations.includes('*')) return []
  const f = fence(actor), event = crypto.randomUUID()
  const result = await records.env.DB.batch<Record<string, unknown>>([
    auditStatement(records.env, actor, event, 'firm.registrations.read', actor.company, actor.grant.version),
    records.statement(`SELECT j.code,j.version,j.effective_date AS effectiveDate,j.cipher FROM env_jurisdictions j
      WHERE j.company_id=? AND j.effective_date<=? AND j.version=(SELECT MAX(v.version) FROM env_jurisdictions v WHERE v.company_id=j.company_id AND v.code=j.code AND v.effective_date<=?)
      AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) ORDER BY j.code`, [actor.company, asOf, asOf, ...f.args, event]),
  ])
  const key = await recordKey(records.env.ENVELOPE_RECORD_KEY)
  return Promise.all(result[1].results.map(async row => {
    const data = JSON.parse(await unseal(key, JSON.stringify([actor.company, 'env_jurisdictions', row.code, row.version]), String(row.cipher)))
    return { code: String(row.code), version: Number(row.version), effectiveDate: String(row.effectiveDate), state: String(data.state), kind: String(data.kind), registration: String(data.registrationStatus), authority: String(data.authority) }
  }))
}

export async function firmDashboard(records: Records, query: URLSearchParams) {
  const day = date(query.get('day') || new Date().toISOString().slice(0, 10))
  const filter = { day, due: query.get('due') === 'today', company: query.get('company') || '', kind: query.get('kind') || '', owner: query.get('owner') || '' }
  const companies = await records.companies(), work = new FirmWork(records)
  const clients = await Promise.all(companies.filter(c => !filter.company || c.id === filter.company).map(async company => {
    const actor = await records.actor(company.id), store = new WorkspaceStore(records), pay = new PayItems(store)
    const fullLocations = actor.grant.locations.includes('*')
    const payroll = fullLocations && permits(actor, 'records:read', 'compensation') ? await pay.read(actor) : null
    const currentRuns = payroll?.runs.filter((r, i, all) => all.findIndex(x => x.id === r.id) === i) || []
    const statuses = payroll ? await new RunApprovals(store, pay).statuses(actor, currentRuns) : []
    const notices = permits(actor, 'notices:read', 'tax') ? await new Notices(records).list(actor) : []
    const registrations = fullLocations && permits(actor, 'records:read', 'tax') ? await registrationSummary(records, actor, day) : []
    const tasks = permits(actor, 'records:read') ? await work.list(actor) : []
    const filteredTasks = tasks.filter(t => (!filter.due || t.data.dueDate === day) && (!filter.kind || t.workKind === filter.kind) && (!filter.owner || t.assigneeId === filter.owner))
    return {
      ...company, canPrepare: fullLocations && permits(actor, 'rates:propose', 'compensation'), canApprove: fullLocations && permits(actor, 'pay:approve', 'compensation'),
      payrollVisible: Boolean(payroll), noticesVisible: permits(actor, 'notices:read', 'tax'), registrationsVisible: fullLocations && permits(actor, 'records:read', 'tax'),
      groups: payroll?.groups.filter((r, i, all) => all.findIndex(x => x.id === r.id) === i && r.approvedBy && !r.withdrawnBy && r.sourcesCurrent).map(r => ({ id: r.id, version: r.version, name: r.data.name })) || [],
      runs: currentRuns.filter(r => (!filter.due || r.data.payDate === day) && (!filter.kind || filter.kind === 'run')).map(r => {
        const status = statuses.find(s => s.runId === r.id && s.version === r.version)
        return { id: r.id, version: r.version, periodStart: r.data.periodStart, periodEnd: r.data.periodEnd, payDate: r.data.payDate, sourceStatus: r.sourceStatus, currentApprovals: status?.current ?? 0, requiredApprovals: status?.required ?? 1, held: r.data.holds.map(h => h.reason), payable: r.data.paymentReady }
      }),
      notices: notices.filter(n => (!filter.kind || filter.kind === 'notice') && (!filter.due || filteredTasks.some(t => t.sourceKind === 'notice' && t.sourceId === n.id))),
      registrations, work: filteredTasks,
    }
  }))
  return { filter, companies, clients: clients.filter(c => !filter.due || c.runs.length || c.notices.length || c.work.length) }
}
export type FirmDashboard = Awaited<ReturnType<typeof firmDashboard>>
