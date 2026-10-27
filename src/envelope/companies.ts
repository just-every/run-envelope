import { fence, requireAction } from './access'
import type { Actor } from './access'
import type { Records, Input } from './records'
import { PayrollError, integer, text } from './security'
import { requirePayrollProof } from './step-up'
import { WorkspaceStore, objectId, revision } from './workspace/store'
import type { EarningsRun } from './workspace/pay-items'
import type { IndustryCheck } from './industry/records'

interface FundingAccount { name: string; accountReference: string; lastFour: string; status: 'unverified'; paymentAuthority: false }
interface FundingPlan { runId: string; runVersion: number; accountId: string; accountVersion: number; paymentAuthority: false }

/** Company-local preparations only. No connected bank or payable instruction. */
export class CompanyPayroll {
  store: WorkspaceStore
  constructor(public records: Records) { this.store = new WorkspaceStore(records) }
  bankAuthority(actor: Actor) {
    if (actor.session.kind !== 'native' || actor.grant.role !== 'owner') throw new PayrollError('native_owner_required', 403)
    requireAction(actor, 'bank:edit', undefined, 'bank')
  }
  async accounts(actor: Actor) {
    this.bankAuthority(actor)
    const rows = await this.store.list<FundingAccount>(actor, 'company-funding')
    return rows.map(({ data, ...row }) => ({ ...row, data: { name: data.name, lastFour: data.lastFour, status: data.status, paymentAuthority: false } }))
  }
  async account(actor: Actor, input: Input) {
    this.bankAuthority(actor)
    await requirePayrollProof(this.records.env, actor)
    const lastFour = text(input.lastFour, 4)
    if (!/^\d{4}$/.test(lastFour)) throw new PayrollError('invalid_account_suffix')
    const data: FundingAccount = { name: text(input.name), accountReference: text(input.accountReference, 240), lastFour, status: 'unverified', paymentAuthority: false }
    return this.store.append(actor, 'company-funding', objectId(input.id), revision(input.version), data, undefined, false, { freshProof: true })
  }
  async plan(actor: Actor, input: Input) {
    this.bankAuthority(actor)
    await requirePayrollProof(this.records.env, actor)
    const runId = objectId(input.runId), accountId = objectId(input.accountId)
    const run = await this.store.find<EarningsRun>(actor, 'earnings-run', runId, undefined, true)
    const account = await this.store.find<FundingAccount>(actor, 'company-funding', accountId)
    if (run.version !== integer(input.runVersion) || account.version !== integer(input.accountVersion)) throw new PayrollError('funding_sources_changed', 409)
    const data: FundingPlan = { runId, runVersion: run.version, accountId, accountVersion: account.version, paymentAuthority: false }
    return this.store.append(actor, 'company-funding-plan', objectId(input.id), revision(input.version), data, undefined, true,
      { freshProof: true, objects: [{ kind: 'earnings-run', id: runId, version: run.version }, { kind: 'company-funding', id: accountId, version: account.version }] })
  }
  async plans(actor: Actor) {
    this.bankAuthority(actor)
    return this.store.list<FundingPlan>(actor, 'company-funding-plan', undefined, true)
  }
  async release(actor: Actor, id: string, input: Input): Promise<never> {
    this.bankAuthority(actor)
    const plan = await this.store.find<FundingPlan>(actor, 'company-funding-plan', id, undefined, true)
    if (plan.version !== integer(input.version) || !plan.sourcesCurrent) throw new PayrollError('funding_sources_changed', 409)
    // Loading all references in this company precedes even the unavailable rail response.
    await this.store.find(actor, 'earnings-run', plan.data.runId, undefined, true)
    await this.store.find(actor, 'company-funding', plan.data.accountId)
    throw new PayrollError('payment_rail_unavailable', 409)
  }
}

/** Consolidate permitted prepared checks; never pool tax bases or infer another employer's wages. */
export async function combinedLaborReport(records: Records) {
  const companies = await records.companies(), store = new WorkspaceStore(records), actors: Actor[] = []
  const rows: { companyId: string; companyName: string; personId: string; personName: string; runId: string; checkId: string; grossCents: number; netCents: number; employeeTaxCents: number; employerTaxCents: number }[] = []
  for (const company of companies) {
    const actor = await records.actor(company.id)
    if (actor.grant.role !== 'owner' && (!actor.grant.actions.includes('records:read') || !actor.grant.actions.includes('private:read') || !actor.grant.fields.includes('compensation') || !actor.grant.fields.includes('tax'))) continue
    actors.push(actor)
    const people = await records.people(actor)
    for (const person of people) {
      const checks = await store.list<IndustryCheck>(actor, 'industry-check', person.id, true)
      const approved = checks.filter(row => row.approvedBy)
      const latest = approved.filter((row, index) => approved.findIndex(other => other.id === row.id) === index)
      const eligible = latest.filter(row => !row.withdrawnBy && row.sourcesCurrent)
      const replaced = new Set(eligible.filter(row => row.data.corrects !== row.id).map(row => row.data.corrects).filter(Boolean))
      const active = eligible.filter(row => !replaced.has(row.id))
      if (new Set(active.map(row => row.data.runId)).size !== active.length) throw new PayrollError('ambiguous_prepared_checks', 409)
      for (const check of active) {
        const result = check.data.result
        rows.push({ companyId: company.id, companyName: company.name, personId: person.id, personName: person.name, runId: check.data.runId, checkId: check.id,
          grossCents: result.cashGrossCents, netCents: result.netCashCents,
          employeeTaxCents: Object.values(result.employeeTaxes).reduce((sum, value) => sum + value, 0), employerTaxCents: result.totalEmployerTaxCents })
      }
    }
  }
  // Repeat every company fence after assembling the complete report.
  for (const actor of actors) {
    const current = fence(actor)
    if (!await records.statement(`SELECT 1 WHERE ${current.sql}`, current.args).first()) throw new PayrollError('authority_changed', 409)
  }
  rows.sort((a, b) => a.companyId.localeCompare(b.companyId) || a.personId.localeCompare(b.personId) || a.checkId.localeCompare(b.checkId))
  return { basis: 'current-reviewed-federal-preparations', paymentStatus: 'not-paid', rows,
    totals: rows.reduce((total, row) => ({ grossCents: total.grossCents + row.grossCents, netCents: total.netCents + row.netCents, employeeTaxCents: total.employeeTaxCents + row.employeeTaxCents, employerTaxCents: total.employerTaxCents + row.employerTaxCents }), { grossCents: 0, netCents: 0, employeeTaxCents: 0, employerTaxCents: 0 }) }
}
