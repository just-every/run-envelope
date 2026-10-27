import type { Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, text, date } from '../security'
import { WorkspaceStore, objectId, revision, choice } from '../workspace/store'
import { PayItems, type EarningsRun } from '../workspace/pay-items'

export const ledgers = ['Pantry', 'QuickBooks Online', 'Xero', 'NetSuite', 'Sage Intacct'] as const
export const components = ['wages', 'reimbursements', 'employer-tax', 'net-funding', 'tax-funding', 'deductions'] as const
export type Component = typeof components[number]
export interface Connection {
  name: string
  ledger: string
  ledgerUrl: string
  repairOwner: string
  enabled: boolean
  closedThrough: string
  accounts: Record<Component, string>
}
export interface Dimension { department: string; class: string; location: string; job: string }
export interface Line { component: Component; account: string; debitCents: number; creditCents: number; dimensions: Dimension }
export interface Journal {
  connectionId: string
  connectionVersion: number
  runId: string
  runVersion: number
  postingDate: string
  repairOwner: string
  ledgerUrl: string
  lines: Line[]
  grossCashCents: number
  proposedEmployeeTaxCents: number
  proposedEmployerTaxCents: number
  proposedNetCents: number
  deductionCents: number
  totalDebitCents: number
  totalCreditCents: number
  correctionOf: string
  correctionReason: string
  correctionLines: Line[]
  postingState: 'unavailable'
  payrollFinalized: false
}
const cents = (value: unknown) => {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 100000000) throw new PayrollError('invalid_accounting_amount')
  return Number(n)
}
const parse = (value: unknown): Input => {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { throw new PayrollError('invalid_accounting_input') } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PayrollError('invalid_accounting_input')
  return value as Input
}
export class Journals {
  constructor(public store: WorkspaceStore) {}
  owner(actor: Actor) {
    if (actor.session.kind !== 'native' || actor.grant.role !== 'owner' || actor.session.operator.email.toLowerCase() !== this.store.records.env.OWNER_EMAIL.toLowerCase()) throw new PayrollError('native_owner_required', 403)
  }
  async connections(actor: Actor) {
    this.owner(actor)
    const rows = await this.store.list<Connection>(actor, 'ledger-connection', undefined, true)
    return rows.filter((r, i) => rows.findIndex(x => x.id === r.id) === i)
  }
  async saveConnection(actor: Actor, input: Input) {
    this.owner(actor)
    const accounts = input.accounts === undefined ? Object.fromEntries(components.map(c => [c, input['account-' + c]])) : parse(input.accounts), mapped = {} as Connection['accounts']
    for (const component of components) {
      mapped[component] = accounts[component] === undefined || accounts[component] === '' ? '' : text(accounts[component], 80)
    }
    let url: URL
    try { url = new URL(text(input.ledgerUrl, 500)) } catch { throw new PayrollError('invalid_ledger_link') }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new PayrollError('invalid_ledger_link')
    const ledger = choice(input.ledger, ledgers), host = url.hostname.toLowerCase()
    const allowed = ledger === 'QuickBooks Online' ? host === 'qbo.intuit.com' : ledger === 'Xero' ? host === 'go.xero.com' : ledger === 'NetSuite' ? host === 'system.netsuite.com' || host.endsWith('.app.netsuite.com') : ledger === 'Sage Intacct' ? host === 'www.intacct.com' || host.endsWith('.intacct.com') : true
    if (!allowed) throw new PayrollError('invalid_ledger_link')
    const data: Connection = { name: text(input.name), ledger, ledgerUrl: url.href, repairOwner: text(input.repairOwner), enabled: choice(String(input.enabled), ['true', 'false']) === 'true', closedThrough: input.closedThrough ? date(input.closedThrough) : '', accounts: mapped }
    return this.store.append(actor, 'ledger-connection', objectId(input.id), revision(input.version), data, undefined, true)
  }
  async rows(actor: Actor) {
    this.owner(actor)
    const rows = await this.store.list<Journal>(actor, 'ledger-journal', undefined, true)
    return Promise.all(rows.map(async row => {
      let blockedReason: string | null = null
      try { const latest = await this.current(actor, row.id); if (latest.version !== row.version || !row.sourcesCurrent) blockedReason = 'journal_sources_changed' }
      catch (error) { if (!(error instanceof PayrollError)) throw error; blockedReason = error.code }
      return { ...row, preparationCurrent: !blockedReason, blockedReason }
    }))
  }
  async prepare(actor: Actor, input: Input, persist: boolean) {
    this.owner(actor)
    const connection = await this.store.find<Connection>(actor, 'ledger-connection', objectId(input.connectionId), undefined, true)
    if (!connection.data.enabled) throw new PayrollError('ledger_disconnected', 409)
    if (components.some(c => !connection.data.accounts[c])) throw new PayrollError('account_mapping_required', 409)
    const postingDate = date(input.postingDate)
    if (postingDate <= connection.data.closedThrough) throw new PayrollError('ledger_period_closed', 409)
    const run = await this.store.find<EarningsRun>(actor, 'earnings-run', objectId(input.runId), undefined, true)
    if (run.version !== revision(input.runVersion)) throw new PayrollError('run_version_superseded', 409)
    const sources = await new PayItems(this.store).sourceCheck(actor, run)
    if (!run.sourcesCurrent || !sources.setup || !sources.rules) throw new PayrollError('run_sources_changed', 409)
    const gross = cents(run.data.grossCashCents), employeeTax = cents(input.proposedEmployeeTaxCents), employerTax = cents(input.proposedEmployerTaxCents), deductions = cents(run.data.afterTaxDeductionCents)
    const net = gross - employeeTax - deductions
    if (net < 0 || gross === 0) throw new PayrollError('accounting_allocation_exceeds_cash', 409)
    let splits: unknown = input.splits ?? [0, 1].filter(i => input['split-' + i + '-amountCents']).map(i => Object.fromEntries(['amountCents', 'department', 'class', 'location', 'job', 'component'].map(k => [k, input['split-' + i + '-' + k]])))
    if (typeof splits === 'string') { try { splits = JSON.parse(splits) } catch { throw new PayrollError('invalid_dimension_splits') } }
    if (!Array.isArray(splits) || !splits.length || splits.length > 100) throw new PayrollError('invalid_dimension_splits')
    const allocations = splits.map(raw => {
      const s = parse(raw), dimensions = {} as Dimension
      for (const key of ['department', 'class', 'location', 'job'] as const) dimensions[key] = text(s[key], 80)
      const amountCents = cents(s.amountCents)
      if (!amountCents) throw new PayrollError('invalid_dimension_splits')
      const component = choice(s.component ?? 'wages', ['wages', 'reimbursements']) as 'wages' | 'reimbursements'
      return { amountCents, dimensions, component }
    })
    if (allocations.filter(s => s.component === 'wages').reduce((sum, s) => sum + s.amountCents, 0) !== run.data.taxableCashCents || allocations.filter(s => s.component === 'reimbursements').reduce((sum, s) => sum + s.amountCents, 0) !== run.data.reimbursementCents) throw new PayrollError('dimension_split_mismatch', 409)
    const lines: Line[] = allocations.map(s => ({ component: s.component, account: connection.data.accounts[s.component], debitCents: s.amountCents, creditCents: 0, dimensions: s.dimensions }))
    const empty = { department: '', class: '', location: '', job: '' }
    for (const [component, debitCents, creditCents] of [['employer-tax', employerTax, 0], ['net-funding', 0, net], ['tax-funding', 0, employeeTax + employerTax], ['deductions', 0, deductions]] as [Component, number, number][]) {
      if (debitCents || creditCents) lines.push({ component, account: connection.data.accounts[component], debitCents, creditCents, dimensions: empty })
    }
    const correctionOf = input.correctionOf ? objectId(input.correctionOf) : '', correctionReason = correctionOf ? text(input.correctionReason, 500) : ''
    const deps: { kind: 'ledger-connection' | 'earnings-run' | 'ledger-journal'; id: string; version: number }[] = [{ kind: 'ledger-connection', id: connection.id, version: connection.version }, { kind: 'earnings-run', id: run.id, version: run.version }]
    let correctionLines: Line[] = []
    if (correctionOf) {
      const old = await this.store.find<Journal>(actor, 'ledger-journal', correctionOf, undefined, true)
      if (!old.approvedBy || old.withdrawnBy || old.data.connectionId !== connection.id || old.data.runId !== run.id || correctionOf === input.id) throw new PayrollError('invalid_accounting_correction', 409)
      deps.push({ kind: 'ledger-journal', id: old.id, version: old.version })
      correctionLines = [...old.data.lines.map(line => ({ ...line, debitCents: line.creditCents, creditCents: line.debitCents })), ...lines]
    }
    const totalDebitCents = lines.reduce((sum, line) => sum + line.debitCents, 0), totalCreditCents = lines.reduce((sum, line) => sum + line.creditCents, 0)
    if (totalDebitCents !== totalCreditCents) throw new PayrollError('unbalanced_journal', 409)
    const data: Journal = { connectionId: connection.id, connectionVersion: connection.version, runId: run.id, runVersion: run.version, postingDate, repairOwner: connection.data.repairOwner, ledgerUrl: connection.data.ledgerUrl, lines, grossCashCents: gross, proposedEmployeeTaxCents: employeeTax, proposedEmployerTaxCents: employerTax, proposedNetCents: net, deductionCents: deductions, totalDebitCents, totalCreditCents, correctionOf, correctionReason, correctionLines, postingState: 'unavailable', payrollFinalized: false }
    if (!persist) return data
    return this.store.append(actor, 'ledger-journal', objectId(input.id), revision(input.version), data, undefined, true, { objects: deps, people: await Promise.all(run.data.people.map(async p => ({ id: p.id, version: (await this.store.records.person(actor, p.id)).version }))) })
  }
  async current(actor: Actor, id: string) {
    this.owner(actor)
    const row = await this.store.find<Journal>(actor, 'ledger-journal', id, undefined, true)
    if (!row.sourcesCurrent || row.withdrawnBy) throw new PayrollError('journal_sources_changed', 409)
    const connection = await this.store.find<Connection>(actor, 'ledger-connection', row.data.connectionId, undefined, true)
    if (!connection.data.enabled) throw new PayrollError('ledger_disconnected', 409)
    if (row.data.postingDate <= connection.data.closedThrough) throw new PayrollError('ledger_period_closed', 409)
    const run = await this.store.find<EarningsRun>(actor, 'earnings-run', row.data.runId, undefined, true)
    const check = await new PayItems(this.store).sourceCheck(actor, run)
    if (run.version !== row.data.runVersion || !run.sourcesCurrent || !check.setup || !check.rules) throw new PayrollError('run_sources_changed', 409)
    return row
  }
  async review(actor: Actor, id: string) { await this.current(actor, id); return this.store.review<Journal>(actor, 'ledger-journal', id) }
  async decide(actor: Actor, id: string, input: Input) { await this.current(actor, id); return this.store.decide(actor, 'ledger-journal', id, input) }
  async post(actor: Actor, id: string, input: Input) {
    this.owner(actor)
    const row = await this.current(actor, id)
    if (row.version !== revision(input.version) || !row.sourcesCurrent || row.withdrawnBy) throw new PayrollError('journal_sources_changed', 409)
    if (!row.approvedBy) throw new PayrollError('journal_review_required', 409)
    const connection = await this.store.find<Connection>(actor, 'ledger-connection', row.data.connectionId, undefined, true)
    if (!connection.data.enabled) throw new PayrollError('ledger_disconnected', 409)
    if (row.data.postingDate <= connection.data.closedThrough) throw new PayrollError('ledger_period_closed', 409)
    throw new PayrollError('finalized_payroll_and_ledger_adapter_required', 409)
  }
}
