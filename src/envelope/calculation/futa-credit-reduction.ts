import type { Actor } from '../access'
import { fence } from '../access'
import type { Input } from '../records'
import { date, integer, PayrollError, recordKey, text, unseal } from '../security'
import { WorkspaceStore, digest, objectId, revision, type Revision } from '../workspace/store'
import { collectionPins } from '../workspace/review-inputs'

/** Reviewed, bounded source edition. No inference for another jurisdiction or year. */
const edition = {
  id: 'CA-2025-final-2025-11-10', taxYear: 2025, state: 'CA', determination: 'final',
  wageBaseCents: 700000, reductionBasisPoints: 120, appliedBcrBasisPoints: 0, appliedOtherAddOnBasisPoints: 0,
  bcrDisposition: 'waived', potentialBcrBasisPoints: 340,
  sources: [
    { authority: 'IRS', edition: '2025 Schedule A (Form 940)',
      url: 'https://www.irs.gov/pub/irs-prior/f940sa--2025.pdf',
      sha256: '725880341c4703e2e678adf9d75439a5276eeb653be091010e5a1f4758a4b465',
      retainedExcerpt: 'Credit reduction states for 2025. The credit reduction rate for California is 0.012 (1.2%). The FUTA wage base for all states is $7,000. Enter the total here and on Form 940, line 11.' },
    { authority: 'DOL', edition: 'Final 2025 FUTA Credit Reductions', publishedDate: '2025-11-10',
      url: 'https://oui.doleta.gov/unemploy/docs/final_credit_states_2025.xlsx',
      sha256: 'b93fd8762d53bb06e089461645a385ba49b43d5d13efa5bc2a79caef3272b6d4',
      retainedExcerpt: 'Updated: November 10, 2025. California applied for a waiver of the fifth year (BCR) add-on and was determined to be eligible for the waiver, therefore employers in California are subject to a 1.2% credit reduction.' },
    { authority: 'IRS', edition: '2025 Instructions for Form 940',
      url: 'https://www.irs.gov/pub/irs-prior/i940--2025.pdf',
      sha256: 'e2085d60827d25e899ef486e640a9dc7845ff72e4becac58992b6c23d18fbc61',
      retainedExcerpt: 'The FUTA tax applies to the first $7,000 you pay to each employee during a calendar year. In years when there are credit reduction states, you must include liabilities owed for credit reduction with your fourth quarter deposit.' },
  ],
} as const
interface Source { edition: typeof edition; reference: string }
interface WageItem { reference: string; paidOn: string; wagesCents: number }
interface Wages { taxYear: number; state: string; workerReference: string; completeYear: true; allWagesSubjectToSui: true; items: WageItem[] }
interface Selection { personId: string; version: number }
interface Preparation {
  fingerprint: string; taxYear: number; state: string; sourceVersion: number; workers: Selection[]
  result: { taxYear: number; state: string; quarter: 4; status: string; coverage: 'selected-reviewed-wages'; unsigned: true; unfiled: true
    sourceEdition: typeof edition; sourceVersion: number; sourceReference: string
    rows: { personId: string; evidenceVersion: number; annualWagesCents: number; taxableWagesCents: number }[]
    taxableWagesCents: number; grossFutaBeforeCreditsCents: number; additionalEmployerLiabilityCents: number
    scheduleA: { state: string; reductionRate: string; taxableWagesCents: number; creditReductionCents: number }
    form940: { line11Cents: number }; employeeWithholdingCents: 0; paidLiabilityCents: null
    payrollApproval: null; filing: string; payment: string; paymentReady: false; holds: string[] }
}
const fail = (code: string, status = 400): never => { throw new PayrollError(code, status) }
const keys = (input: Input, allowed: string[]) => {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) fail('unsupported_futa_input')
}
const year = (value: unknown) => {
  const n = integer(value)
  if (n !== 2025) fail('futa_year_unsupported', 409)
  return n
}
const sourceId = 'futa-source-2025-CA'
const preparationId = 'futa-preparation-2025-CA'
const wageId = (person: string) => objectId(person + '-2025')
const noHold = (actor: Actor) => ({ sql: "NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND status='held')", args: [actor.company] })
const reviewed = (row: Revision<unknown>, version: number) => {
  if (row.version !== version || !row.sourcesCurrent || !row.approvedBy || row.withdrawnBy) fail('futa_current_reviewed_evidence_required', 409)
}
const latest = <T>(rows: Revision<T>[]) => rows.filter((r, i) => rows.findIndex(other => other.id === r.id) === i)

export class FutaCreditReduction {
  constructor(public store: WorkspaceStore) {}
  async scope(actor: Actor, person?: string) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.operator.email.trim().toLowerCase() !== this.store.records.env.OWNER_EMAIL.trim().toLowerCase()) fail('native_futa_owner_required', 403)
    await this.store.authority(actor, 'records:read', person, true)
    const f = fence(actor), h = noHold(actor)
    if (!await this.store.records.statement(`SELECT 1 WHERE ${f.sql} AND ${h.sql}`, [...f.args, ...h.args]).first()) fail('futa_source_held_or_authority_changed', 409)
  }
  async sources(actor: Actor) {
    await this.scope(actor)
    const rows = await this.store.list<Source>(actor, 'futa-source', undefined, true)
    await this.scope(actor)
    return rows
  }
  async saveSource(actor: Actor, input: Input) {
    await this.scope(actor)
    keys(input, ['version', 'taxYear', 'state', 'determination', 'sourceEdition', 'reference'])
    year(input.taxYear)
    if (input.state !== 'CA') fail('futa_jurisdiction_unsupported', 409)
    if (input.determination !== 'final' || input.sourceEdition !== edition.id) fail('futa_final_source_edition_required', 409)
    return this.store.append(actor, 'futa-source', sourceId, revision(input.version),
      { edition, reference: text(input.reference, 500) }, undefined, true, { condition: noHold(actor) })
  }
  async reviewSource(actor: Actor) { await this.scope(actor); return this.store.review(actor, 'futa-source', sourceId, undefined, noHold(actor)) }
  async approveSource(actor: Actor, input: Input) { await this.scope(actor); return this.store.decide(actor, 'futa-source', sourceId, input, undefined, false, noHold(actor)) }
  async wages(actor: Actor, person: string, taxYear: unknown) {
    year(taxYear); await this.scope(actor, person)
    const rows = await this.store.list<Wages>(actor, 'futa-wages', person, true)
    await this.scope(actor, person)
    return rows
  }
  async saveWages(actor: Actor, person: string, taxYear: unknown, input: Input) {
    year(taxYear); await this.scope(actor, person)
    keys(input, ['version', 'taxYear', 'state', 'workerReference', 'completeYear', 'allWagesSubjectToSui', 'items'])
    year(input.taxYear)
    if (input.state !== 'CA') fail('futa_jurisdiction_unsupported', 409)
    if (input.completeYear !== true || input.allWagesSubjectToSui !== true) fail('futa_complete_california_sui_wages_required', 409)
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 108) fail('futa_wage_evidence_required')
    const items = (input.items as Input[]).map(item => {
      keys(item, ['reference', 'paidOn', 'wagesCents'])
      const paidOn = date(item.paidOn)
      if (!paidOn.startsWith('2025-')) fail('futa_wage_year_mismatch', 409)
      if (!Number.isSafeInteger(item.wagesCents) || Number(item.wagesCents) < 0 || Number(item.wagesCents) > 1000000000) fail('invalid_futa_wages')
      return { reference: text(item.reference, 240), paidOn, wagesCents: Number(item.wagesCents) }
    }).sort((a, b) => a.reference.localeCompare(b.reference))
    if (new Set(items.map(i => i.reference)).size !== items.length) fail('futa_duplicate_wage_source', 409)
    const workerReference = text(input.workerReference, 240)
    const claims = await Promise.all([
      digest(JSON.stringify(['futa-worker', 2025, workerReference])),
      ...items.map(item => digest(JSON.stringify(['futa-wage-source', 2025, item.reference]))),
    ])
    return this.store.append<Wages>(actor, 'futa-wages', wageId(person), revision(input.version),
      { taxYear: 2025, state: 'CA', workerReference, completeYear: true, allWagesSubjectToSui: true, items }, person, true,
      { condition: noHold(actor), exclusiveSourceIds: claims })
  }
  async reviewWages(actor: Actor, person: string, taxYear: unknown) {
    year(taxYear); await this.scope(actor, person)
    return this.store.review(actor, 'futa-wages', wageId(person), person, noHold(actor))
  }
  async approveWages(actor: Actor, person: string, taxYear: unknown, input: Input) {
    year(taxYear); await this.scope(actor, person)
    return this.store.decide(actor, 'futa-wages', wageId(person), input, person, false, noHold(actor))
  }
  async inputs(actor: Actor, workers: Selection[], sourceVersion: number) {
    const source = await this.store.find<Source>(actor, 'futa-source', sourceId, undefined, true)
    reviewed(source, sourceVersion)
    const wages: Revision<Wages>[] = []
    for (const selection of workers) {
      await this.scope(actor, selection.personId)
      const row = await this.store.find<Wages>(actor, 'futa-wages', wageId(selection.personId), selection.personId, true)
      reviewed(row, selection.version)
      wages.push(row)
    }
    return { source, wages }
  }
  async uniqueEin(actor: Actor) {
    // Multiple company records for one EIN cannot establish separate annual bases.
    // Compare locally without returning any other company's identity or EIN.
    const rows = (await this.store.records.statement('SELECT id,ein_cipher FROM env_companies').all<{ id: string; ein_cipher: string }>()).results
    const key = await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY)
    const own = rows.find(r => r.id === actor.company)!
    const ein = await unseal(key, JSON.stringify([own.id, 'ein']), own.ein_cipher)
    for (const row of rows.filter(r => r.id !== own.id)) {
      if (await unseal(key, JSON.stringify([row.id, 'ein']), row.ein_cipher) === ein) fail('futa_duplicate_ein_company', 409)
    }
  }
  async prepare(actor: Actor, taxYear: unknown, input: Input) {
    year(taxYear); await this.scope(actor)
    keys(input, ['version', 'taxYear', 'state', 'sourceVersion', 'workers'])
    year(input.taxYear)
    if (input.state !== 'CA') fail('futa_jurisdiction_unsupported', 409)
    if (!Array.isArray(input.workers) || !input.workers.length || input.workers.length > 100) fail('futa_workers_required')
    const workers = (input.workers as Input[]).map(w => {
      keys(w, ['personId', 'version'])
      return { personId: objectId(w.personId), version: integer(w.version) }
    }).sort((a, b) => a.personId.localeCompare(b.personId))
    if (new Set(workers.map(w => w.personId)).size !== workers.length) fail('futa_duplicate_worker', 409)
    await this.uniqueEin(actor)
    const sourceVersion = integer(input.sourceVersion), { source, wages } = await this.inputs(actor, workers, sourceVersion)
    // One canonical company-year preparation replaces its preceding version;
    // a second identifier cannot claim another annual base or liability.
    const fingerprint = await digest(JSON.stringify({ sourceVersion, workers }))
    const prior = latest(await this.store.list<Preparation>(actor, 'futa-preparation', undefined, true, false)).find(r => r.id === preparationId)
    if (prior?.data.fingerprint === fingerprint && prior.sourcesCurrent) {
      await this.scope(actor)
      return { id: preparationId, kind: 'futa-preparation', version: prior.version, replayed: true, result: prior.data.result }
    }
    const rows = wages.map(row => {
      const annualWagesCents = row.data.items.reduce((n, item) => n + item.wagesCents, 0)
      return { personId: row.personId!, evidenceVersion: row.version, annualWagesCents, taxableWagesCents: Math.min(annualWagesCents, edition.wageBaseCents) }
    })
    const taxableWagesCents = rows.reduce((n, row) => n + row.taxableWagesCents, 0)
    const additionalEmployerLiabilityCents = Math.floor((taxableWagesCents * edition.reductionBasisPoints + 5000) / 10000)
    const result: Preparation['result'] = {
      taxYear: 2025, state: 'CA', quarter: 4, status: 'preparation-only', coverage: 'selected-reviewed-wages', unsigned: true, unfiled: true,
      sourceEdition: source.data.edition, sourceVersion, sourceReference: source.data.reference, rows, taxableWagesCents,
      grossFutaBeforeCreditsCents: Math.floor((taxableWagesCents * 600 + 5000) / 10000), additionalEmployerLiabilityCents,
      scheduleA: { state: 'CA', reductionRate: '0.012', taxableWagesCents, creditReductionCents: additionalEmployerLiabilityCents },
      form940: { line11Cents: additionalEmployerLiabilityCents }, employeeWithholdingCents: 0, paidLiabilityCents: null,
      payrollApproval: null, filing: 'unavailable', payment: 'unavailable', paymentReady: false,
      holds: ['Unsigned and unfiled preparation; no payable or submission authority.',
        'Deposit thresholds, deadlines, complete state and year coverage, and final payroll reconciliation remain unproved.'],
    }
    const reviewSets = await collectionPins(this.store, actor, workers.map(w => ({ kind: 'futa-wages', personId: w.personId, exceptId: '' })))
    const saved = await this.store.append<Preparation>(actor, 'futa-preparation', preparationId, revision(input.version),
      { fingerprint, taxYear: 2025, state: 'CA', sourceVersion, workers, result }, undefined, true,
      { condition: noHold(actor), reviewSets,
        people: wages.map(w => ({ id: w.personId!, version: w.personVersion! })),
        objects: [{ kind: 'futa-source', id: sourceId, version: sourceVersion, approved: true },
          ...wages.map(w => ({ kind: 'futa-wages' as const, id: w.id, version: w.version, approved: true }))] })
    return { ...saved, result }
  }
  async preparations(actor: Actor, taxYear: unknown) {
    year(taxYear); await this.scope(actor)
    const rows = await this.store.list<Preparation>(actor, 'futa-preparation', undefined, true)
    for (const row of rows) for (const worker of row.data.workers) await this.scope(actor, worker.personId)
    await this.scope(actor)
    return rows.map(row => ({ ...row, current: row.version === rows[0]?.version && !!row.sourcesCurrent, unsigned: true, unfiled: true }))
  }
  async reviewPreparation(actor: Actor, taxYear: unknown) {
    year(taxYear); await this.scope(actor)
    const row = await this.store.find<Preparation>(actor, 'futa-preparation', preparationId, undefined, true)
    if (!row.sourcesCurrent) fail('futa_preparation_stale', 409)
    await this.inputs(actor, row.data.workers, row.data.sourceVersion)
    return this.store.review(actor, 'futa-preparation', preparationId, undefined, noHold(actor))
  }
}
