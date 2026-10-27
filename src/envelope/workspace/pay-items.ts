import type { BonusPreparation } from '../bonus-runs'
import { SourceIntake, reviewedRate, currentEvents } from '../intake/sources'
import type { RunInput } from '../intake/run-input'
import { LeaveLedger } from '../leave/ledger'
import type { Actor } from '../access'
import type { Input } from '../records'
import { date, text, integer, PayrollError } from '../security'
import {
  WorkspaceStore,
  objectId,
  revision,
  choice,
  optional,
  type Revision,
  type Sources,
  type Kind,
  digest,
} from './store'
import { addDays } from './schedules'
import type { WorkDay } from './allocations'
import { payChangeDiff } from './pay-change-diff'
import { reviewInputSets, collectionPins } from './review-inputs'
import { salaryDay, type ProrationPolicy, type SalarySetup } from './proration'
import { finalPayCheck, separations, type Separation } from './final-pay'
import type { TipEntry } from './tips'
import { periodRules, ruleFingerprint, type PayrollRule } from './rules'

export interface Group {
  name: string
  people: { id: string; version: number; name: string }[]
}
export interface PayItem {
  name: string
  groupId: string
  groupVersion: number
  amountCents: number
  taxCode: string
  effectiveDate: string
  recurring: boolean
  evidenceRef: string
  returnExcessBy: string
}
export interface PayChange {
  diff?: Awaited<ReturnType<typeof payChangeDiff>>['diff']
  name: string
  groupId: string
  groupVersion: number
  effectiveDate: string
  items: {
    personId: string
    personVersion: number
    personName: string
    rateCents: number
    basis: string
    employmentFrom: string
    employmentThrough: string
    unpaidDates: string[]
    salaryType: SalarySetup['salaryType']
    unpaidLeave: SalarySetup['unpaidLeave']
    separation?: Separation
  }[]
}
export interface EarningsRun {
  bonusPreparation?: BonusPreparation
  periodStart: string
  periodEnd: string
  payDate: string
  frequency: string
  groupId: string
  people: {
    id: string
    name: string
    earningsCents: number
    taxableCashCents: number
    reimbursementCents: number
    afterTaxDeductionCents: number
    /** Already received by the worker: wages for tax, never paid again. */
    cashTipsCents: number
    paycheckTipsCents: number
    tipFundsCents: number
    details: string[]
  }[]
  holds: { personId: string; code?: string; reason: string }[]
  /** Bank record version bound per payee; 0 means no account is on file. */
  destinations: { personId: string; bankVersion: number }[]
  grossCashCents: number
  taxableCashCents: number
  reimbursementCents: number
  afterTaxDeductionCents: number
  taxAmounts: null
  netPay: null
  paymentReady: false
  setupFingerprint: string
  locationStates: string[]
  ruleFingerprint: string
  ruleSources: {
    id: string
    version: number
    name: string
    determination: string
    approved: boolean
  }[]
}
const latest = <T>(rows: Revision<T>[]) =>
  rows.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
const effective = (r: Revision<{ effectiveDate: string }>, day: string) =>
  r.approvedBy && !r.withdrawnBy && r.sourcesCurrent && r.data.effectiveDate <= day
const money = (n: bigint, d: bigint) => Number((n + d / 2n) / d)
const fingerprint = (
  groupId: string,
  changes: Revision<PayChange>[],
  items: Revision<PayItem>[],
  policies: Revision<ProrationPolicy>[] = [],
) =>
  digest(
    JSON.stringify(
      [...changes, ...items, ...policies]
        .filter((r) => r.data.groupId === groupId)
        .map((r) => [
          r.kind,
          r.id,
          r.version,
          r.approvedBy,
          r.withdrawnBy,
          r.sourcesCurrent,
        ])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ),
  )
const list = (v: unknown): unknown[] =>
  Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
/** A retained run is current only while its setup, sources and period rules are unchanged. */
export async function runCurrency(
  run: Revision<EarningsRun>,
  changes: Revision<PayChange>[],
  items: Revision<PayItem>[],
  policies: Revision<ProrationPolicy>[],
  rules: Revision<PayrollRule>[],
) {
  if (run.data.bonusPreparation) return {setup:Boolean(run.sourcesCurrent),rules:Boolean(run.sourcesCurrent)}
  return {
    setup:
      Boolean(run.sourcesCurrent) &&
      run.data.setupFingerprint ===
        (await fingerprint(run.data.groupId, changes, items, policies)),
    rules:
      run.data.ruleFingerprint ===
      (await ruleFingerprint(
        rules,
        run.data.locationStates,
        run.data.periodStart,
        run.data.periodEnd,
      )),
  }
}
export class PayItems {
  constructor(public store: WorkspaceStore) {}
  async sourceCheck(actor: Actor, run: Revision<EarningsRun>) {
    const [changes, items, policies, rules] = await Promise.all([
      this.store.list<PayChange>(actor, 'pay-change', undefined, true, false),
      this.store.list<PayItem>(actor, 'pay-item', undefined, true, false),
      this.store.list<ProrationPolicy>(actor, 'proration-policy', undefined, true, false),
      this.store.list<PayrollRule>(actor, 'rule', undefined, true, false),
    ])
    return runCurrency(run, changes, items, policies, rules)
  }
  async group(actor: Actor, input: Input) {
    const ids = list(input.people).map((v) => text(v))
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
      throw new PayrollError('invalid_group_members')
    const people = await Promise.all(
      ids.map((id) => this.store.records.person(actor, id)),
    )
    return this.store.append(
      actor,
      'group',
      objectId(input.id),
      revision(input.version),
      {
        name: text(input.name),
        people: people.map((p) => ({ id: p.id, version: p.version, name: p.name })),
      },
      undefined,
      true,
      { people: people.map((p) => ({ id: p.id, version: p.version })) },
    )
  }
  async approvedGroup(actor: Actor, id: string) {
    const row = await this.store.find<Group>(actor, 'group', id, undefined, true)
    if (!row.approvedBy || row.withdrawnBy || !row.sourcesCurrent)
      throw new PayrollError('group_requires_current_human_approval', 409)
    return row
  }
  async item(actor: Actor, input: Input) {
    const group = await this.approvedGroup(actor, objectId(input.groupId)),
      taxCode = choice(input.taxCode, [
        'w2-cash-earning',
        'accountable-reimbursement',
        'after-tax-deduction',
      ]),
      effectiveDate = date(input.effectiveDate)
    const amountCents = integer(input.amountCents),
      evidenceRef = optional(input.evidenceRef, 500),
      returnExcessBy =
        taxCode === 'accountable-reimbursement' ? date(input.returnExcessBy) : ''
    if (
      taxCode === 'accountable-reimbursement' &&
      (!evidenceRef || returnExcessBy < effectiveDate)
    )
      throw new PayrollError('accountable_plan_evidence_required')
    const data: PayItem = {
      name: text(input.name),
      groupId: group.id,
      groupVersion: group.version,
      amountCents,
      taxCode,
      effectiveDate,
      recurring: input.recurring === true || input.recurring === 'true',
      evidenceRef,
      returnExcessBy,
    }
    return this.store.append(
      actor,
      'pay-item',
      objectId(input.id),
      revision(input.version),
      data,
      undefined,
      true,
      {
        people: group.data.people.map((p) => ({ id: p.id, version: p.version })),
        objects: [
          { kind: 'group', id: group.id, version: group.version, approved: true },
        ],
      },
    )
  }
  async change(actor: Actor, input: Input) {
    const group = await this.approvedGroup(actor, objectId(input.groupId)),
      effectiveDate = date(input.effectiveDate)
    let raw: unknown = input.items
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        throw new PayrollError('invalid_pay_change')
      }
    }
    if (!Array.isArray(raw) || !raw.length || raw.length > 100)
      throw new PayrollError('invalid_pay_change')
    const seen = new Set<string>(),
      items: PayChange['items'] = []
    for (const value of raw) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new PayrollError('invalid_pay_change')
      const item = value as Input,
        personId = objectId(item.personId),
        person = await this.store.records.person(actor, personId)
      if (!group.data.people.some((p) => p.id === personId) || seen.has(personId))
        throw new PayrollError('person_outside_reviewed_group')
      if (integer(item.personVersion) !== person.version)
        throw new PayrollError('person_source_stale', 409)
      const employmentFrom = date(item.employmentFrom),
        employmentThrough = date(item.employmentThrough),
        unpaidDates = list(item.unpaidDates).map(date)
      if (
        employmentFrom > employmentThrough ||
        unpaidDates.length > 366 ||
        new Set(unpaidDates).size !== unpaidDates.length
      )
        throw new PayrollError('invalid_employment_period')
      let leave: unknown = item.unpaidLeave ?? []
      if (typeof leave === 'string') {
        try { leave = JSON.parse(leave) } catch { throw new PayrollError('invalid_unpaid_leave') }
      }
      if (!Array.isArray(leave) || leave.length > 366) throw new PayrollError('invalid_unpaid_leave')
      const unpaidLeave: SalarySetup['unpaidLeave'] = leave.map((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PayrollError('invalid_unpaid_leave')
        const l = raw as Input, minutes = integer(l.minutes)
        if (minutes > 1440) throw new PayrollError('invalid_unpaid_leave')
        return { day: date(l.day), minutes,
          reason: choice(l.reason, ['personal', 'sickness-plan', 'fmla', 'other']) as SalarySetup['unpaidLeave'][number]['reason'],
          evidenceRef: optional(l.evidenceRef, 500) }
      })
      if (new Set(unpaidLeave.map((l) => l.day)).size !== unpaidLeave.length)
        throw new PayrollError('duplicate_leave_date')
      items.push({
        personId,
        personVersion: person.version,
        personName: person.name,
        rateCents: integer(item.rateCents),
        basis: choice(item.basis, ['hourly', 'annual-salary']),
        employmentFrom,
        employmentThrough,
        unpaidDates,
        unpaidLeave,
        salaryType: choice(item.salaryType ?? 'unverified', ['exempt', 'nonexempt', 'unverified']) as SalarySetup['salaryType'],
        separation: choice(item.separation || 'none', separations) as Separation,
      })
      seen.add(personId)
    }
    const data: PayChange = {
      name: text(input.name),
      groupId: group.id,
      groupVersion: group.version,
      effectiveDate,
      items,
    }
    const proposalId = objectId(input.id)
    const reviewSets = await reviewInputSets(this.store, actor, proposalId, items.map((p) => p.personId))
    const comparison = await payChangeDiff(this.store, actor, data, proposalId)
    data.diff = comparison.diff
    return this.store.append(
      actor,
      'pay-change',
      proposalId,
      revision(input.version),
      data,
      undefined,
      true,
      {
        reviewSets,
        people: items.map((p) => ({ id: p.personId, version: p.personVersion })),
        objects: [
          { kind: 'group', id: group.id, version: group.version, approved: true },
        ],
      },
    )
  }
  async read(actor: Actor) {
    await this.store.authority(actor, 'records:read', undefined, true)
    const groups = await this.store.list<Group>(actor, 'group', undefined, true),
      items = await this.store.list<PayItem>(actor, 'pay-item', undefined, true),
      changes = await this.store.list<PayChange>(actor, 'pay-change', undefined, true),
      runs = await this.store.list<EarningsRun>(actor, 'earnings-run', undefined, true)
    const rules = await this.store.list<PayrollRule>(
      actor,
      'rule',
      undefined,
      true,
      false,
    )
    const policies = await this.store.list<ProrationPolicy>(actor, 'proration-policy', undefined, true)
    return {
      groups,
      items,
      changes,
      policies,
      runs: await Promise.all(
        runs.map(async (r) => {
          const current = await runCurrency(r, changes, items, policies, rules)
          return {
            ...r,
            sourceStatus:
              current.setup && current.rules ? 'current' : 'changed-repreview-required',
          }
        }),
      ),
    }
  }
  async preview(actor: Actor, input: Input, persist?: false): Promise<EarningsRun>
  async preview(
    actor: Actor,
    input: Input,
    persist: true,
  ): Promise<{ id: string; kind: Kind; version: number; preview: EarningsRun }>
  async preview(actor: Actor, input: Input, persist = false) {
    const group = await this.approvedGroup(actor, objectId(input.groupId)),
      periodStart = date(input.periodStart),
      periodEnd = date(input.periodEnd),
      payDate = date(input.payDate),
      frequency = choice(input.frequency, [
        'weekly',
        'biweekly',
        'semimonthly',
        'monthly',
      ])
    const days = (Date.parse(periodEnd) - Date.parse(periodStart)) / 86400000 + 1
    if (days < 1 || days > 31 || payDate < periodEnd)
      throw new PayrollError('invalid_pay_period')
    const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[frequency]!
    const allChanges = await this.store.list<PayChange>(
        actor,
        'pay-change',
        undefined,
        true,
        false,
      ),
      allItems = await this.store.list<PayItem>(actor, 'pay-item', undefined, true, false)
    const allPolicies = await this.store.list<ProrationPolicy>(actor, 'proration-policy', undefined, true, false)
    const policies = allPolicies.filter((p) => p.data.groupId === group.id)
    const changes = latest(allChanges).filter((c) => c.data.groupId === group.id),
      items = latest(allItems).filter((i) => i.data.groupId === group.id)
    const people: EarningsRun['people'] = [],
      holds: EarningsRun['holds'] = [],
      objects: NonNullable<Sources['objects']> = [
        { kind: 'group', id: group.id, version: group.version, approved: true },
      ]
    const runInputId = input.intakeRunId || input.id
    const runInput = runInputId ? (await this.store.list<RunInput>(actor,'run-intake',undefined,true,false)).find(r=>r.id===runInputId) : undefined
    if(runInput && runInput.data.rows.some(r=>!group.data.people.some(p=>p.id===r.personId) || r.day<periodStart || r.day>periodEnd))
      throw new PayrollError('intake_outside_run_scope',409)
    if(persist && input.intakeRunId && input.intakeRunId!==input.id)throw new PayrollError('intake_run_identity_conflict',409)
    if(runInput)objects.push({kind:'run-intake',id:runInput.id,version:runInput.version,approved:true})
    if(runInput){
      if(!runInput.approvedBy || runInput.withdrawnBy || !runInput.sourcesCurrent)throw new PayrollError('intake_review_required',409)
    }
    const assigned = (
      await this.store.records
        .statement(
          'SELECT p.id,l.state_code AS state FROM env_people p JOIN env_locations l ON l.company_id=p.company_id AND l.id=p.location_id WHERE p.company_id=?',
          [actor.company],
        )
        .all<{ id: string; state: string }>()
    ).results
    for (const member of group.data.people) {
      const intake = new SourceIntake(this.store), hr = await intake.timeline(actor, member.id, 'hris-event')
      const sourceEarnings = await intake.timeline(actor, member.id, 'source-earning')
      const inputLines=runInput?.data.rows.filter(r=>r.personId===member.id) ?? []
      const intakeWeeks=new Map<string,{microMinutes:bigint;straightNumerator:bigint;nonexempt:boolean}>()
      for(const hire of hr.filter(r=>r.kind==='hris-hire')) objects.push({kind:hire.kind,id:hire.id,version:hire.version,approved:true})
      const firstHire=hr.filter(r=>r.data.type==='hire' && r.approvedBy && !r.withdrawnBy && r.sourcesCurrent).sort((a,b)=>a.data.effectiveDate.localeCompare(b.data.effectiveDate))[0]
      const work = latest(
        await this.store.list<WorkDay>(actor, 'work', member.id, true, false),
      ).filter((w) => w.data.day >= periodStart && w.data.day <= periodEnd)
      let numerator = 0n,
        denominator = 1n,
        earnings = 0
      const details: string[] = []
      // Integer rational accumulation avoids daily salary-rounding drift.
      const add = (n: bigint, d: bigint) => {
        numerator = numerator * d + n * denominator
        denominator *= d
        const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a)
        const g = gcd(numerator, denominator)
        numerator /= g
        denominator /= g
      }
      const used = new Map<string, Revision<PayChange>>()
      for (let day = periodStart; day <= periodEnd; day = addDays(day, 1)) {
        const candidates = changes
          .filter(
            (c) =>
              c.data.effectiveDate <= day &&
              c.data.items.some((p) => p.personId === member.id),
          )
          .sort(
            (a, b) =>
              b.data.effectiveDate.localeCompare(a.data.effectiveDate) ||
              b.createdAt - a.createdAt,
          )
        const current = candidates[0]
        if (!current || !effective(current, day)) {
          holds.push({
            personId: member.id,
            reason: `${day}: no current human-approved effective pay setup; proposed changes cannot authorize underpayment or late wages.`,
          })
          continue
        }
        if (
          candidates.length > 1 &&
          candidates[1].data.effectiveDate === current.data.effectiveDate
        ) {
          holds.push({
            personId: member.id,
            reason: `${day}: contradictory effective pay setups require named review.`,
          })
          continue
        }
        used.set(current.id, current)
        if(firstHire && day<firstHire.data.effectiveDate) {
          if(work.some(w=>w.data.day===day && w.data.minutes>0)) holds.push({personId:member.id,reason:'Worked hours precede the reviewed Willow hire. Resolve the employment/date conflict; it cannot authorize underpayment or late wages.'})
          continue
        }
        if(firstHire) {
          const detail=`Willow employment source ${firstHire.data.sourceId} v${firstHire.data.sourceVersion}, effective ${firstHire.data.effectiveDate}`
          if(!details.includes(detail))details.push(detail)
        }
        const sourceRate = reviewedRate(hr, day)
        if (sourceRate.hold) {
          if (!holds.some((h)=>h.personId===member.id && h.reason===sourceRate.hold)) holds.push({personId:member.id,reason:sourceRate.hold})
        }
        let setup = current.data.items.find((p) => p.personId === member.id)!
        if (sourceRate.row && setup.basis === 'hourly') {
          setup = {...setup,rateCents:Number(sourceRate.row.data.values.rateCents)}
          objects.push({kind:'hris-event',id:sourceRate.row.id,version:sourceRate.row.version,approved:true})
          const detail=`${sourceRate.row.data.provider} reviewed rate ${setup.rateCents} cents, source ${sourceRate.row.data.sourceId} v${sourceRate.row.data.sourceVersion}, effective ${sourceRate.row.data.effectiveDate}`
          if (!details.includes(detail)) details.push(detail)
        }
        const events=currentEvents(hr,day).filter((r)=>r.data.type!=='rate')
        for (const event of events) {
          const reason= !event.approvedBy || event.withdrawnBy || !event.sourcesCurrent ? 'HRIS '+event.data.type+' requires current exact human review.' : ['location','leave','benefit','termination'].includes(event.data.type) ? 'HRIS '+event.data.type+' requires its separately reviewed allocation, leave, deduction or final-pay handoff.' : undefined
          if(reason && !holds.some((h)=>h.personId===member.id && h.reason===reason)) holds.push({personId:member.id,reason})
          objects.push({kind:event.kind,id:event.id,version:event.version})
        }
        const employment=events.filter((r)=>['hire','termination'].includes(r.data.type)).sort((a,b)=>b.data.effectiveDate.localeCompare(a.data.effectiveDate))[0]
        if (employment?.approvedBy && !employment.withdrawnBy && employment.sourcesCurrent && employment.data.type==='termination' && employment.data.effectiveDate<day) continue

        if (setup.basis === 'annual-salary') {
          const applicable = latest(policies.filter((p) => p.data.effectiveDate <= day))
            .sort((a, b) => b.data.effectiveDate.localeCompare(a.data.effectiveDate) || b.createdAt - a.createdAt)
          const proposed = applicable[0]
          const policy = proposed && effective(proposed, day) &&
            !(applicable[1]?.data.effectiveDate === proposed.data.effectiveDate) ? proposed : undefined
          if (!holds.some((h) => h.personId === member.id && h.code === 'proration-preview-only'))
            holds.push({personId: member.id, code: 'proration-preview-only',
              reason: 'Salary proration is preview-only. Stricter work-state rules, final-pay deadlines and complete payroll calculation require review; no salary preview can be approved, paid or dispatched.'})
          if (policy) {
            // Pin the current policy timeline, including future revisions. The
            // chosen older effective entry stays in the immutable payload; a
            // later edit to that timeline must force a fresh preview.
            const timeline = policies.find((p) => p.id === policy.id)!
            objects.push({kind: 'proration-policy', id: timeline.id, version: timeline.version,
              approved: timeline.version === policy.version})
          }
          const calculated = salaryDay({ day, periodStart, periodEnd, periods,
            setup: {...setup, salaryType: setup.salaryType ?? 'unverified', unpaidLeave: setup.unpaidLeave ?? []},
            policy: policy?.data, workedMinutes: work.filter((w) => w.data.day === day).reduce((n, w) => n + w.data.minutes, 0) })
          add(calculated.numerator, calculated.denominator)
          if (calculated.detail) details.push(calculated.detail)
          for (const hold of calculated.holds)
            if (!holds.some((h) => h.personId === member.id && h.code === hold.code && h.reason === hold.reason))
              holds.push({ personId: member.id, ...hold })
          if (setup.salaryType === 'nonexempt')
            for (const w of work.filter((w) => w.data.day === day))
              objects.push({kind: 'work', id: w.id, version: w.version})
          if (current.data.effectiveDate > periodStart && current.data.effectiveDate !== setup.employmentFrom)
            holds.push({personId: member.id, code: 'proration-rate-change-review',
              reason: 'Effective salary change within the period requires salary-basis and stricter work-state review before any reduction.'})
        } else {
          if (day < setup.employmentFrom || day > setup.employmentThrough || setup.unpaidDates.includes(day)) continue
          const entries = work.filter((w) => w.data.day === day)
          const entered=inputLines.filter(r=>r.code==='regular' && r.day===day)
          if(entries.length && entered.length)throw new PayrollError('intake_work_source_conflict',409)
          const minutes = entries.reduce((s, w) => s + w.data.minutes, 0)+entered.reduce((s,r)=>s+r.minutes,0)
          if (minutes > 1440) {
            holds.push({
              personId: member.id,
              reason: `${day}: contradictory work minutes.`,
            })
            continue
          }
          // Hourly regular earnings only: overtime and premium coverage remain a hold.
          add(BigInt(Math.round(minutes*1000000)) * BigInt(setup.rateCents), 60000000n)
          for(const row of entered){
            const week=intakeWeeks.get(row.workweek) ?? {microMinutes:0n,straightNumerator:0n,nonexempt:true}
            const micro=BigInt(Math.round(row.minutes*1000000))
            week.microMinutes+=micro;week.straightNumerator+=micro*BigInt(setup.rateCents)
            week.nonexempt=week.nonexempt && setup.salaryType==='nonexempt'
            intakeWeeks.set(row.workweek,week)
          }
          for (const w of entries)
            objects.push({ kind: 'work', id: w.id, version: w.version })
        }
      }
      earnings = money(numerator, denominator)
      if (!Number.isSafeInteger(earnings) || earnings > 100000000)
        throw new PayrollError('earnings_out_of_range')
      let taxable = earnings,
        reimbursement = 0,
        deductions = 0
      // Each tip's settlement type and furnished funds are part of the exact version.
      const tips = latest(await this.store.list<TipEntry>(actor, 'tip', member.id, true, false))
        .filter((t) => t.data.day >= periodStart && t.data.day <= periodEnd)
      const tipped = { cash: 0, paycheck: 0, funds: 0 }
      for(const line of inputLines){
        details.push(`Run intake ${runInput!.id} v${runInput!.version}, source ${runInput!.data.namespace} row ${line.sourceId}, ${line.day}, workweek ${line.workweek}, ${line.code}: ${line.minutes} minutes, ${line.amountCents} cents, ${line.settlement || 'no tip settlement'}, ${line.state} ${line.riskClass}, job ${line.job || 'unassigned'}; evidence ${line.evidence}`)
        if(line.code==='tip')tipped[line.settlement as 'cash'|'paycheck']+=line.amountCents
        else if(line.code==='reimbursement'){
          reimbursement+=line.amountCents
          if(line.amountCents)holds.push({personId:member.id,reason:'Run reimbursement requires substantiation and return-of-excess review before tax exclusion.'})
        } else if(['bonus','nondiscretionary-bonus','commission','other-earning','service-charge','paid-leave','meal-premium','rest-premium'].includes(line.code)){
          earnings+=line.amountCents;taxable+=line.amountCents
          if(line.code==='paid-leave' && (line.minutes || line.amountCents))
            holds.push({personId:member.id,reason:'Reviewed paid-leave amount retained separately from worked time; statutory leave rate, balance ownership and consumption require reconciliation before payroll payment.'})
        }
      }
      // 29 CFR 778.109, 778.110 and 778.209: allocate remuneration to its
      // actual workweek and add the half-time component to straight-time pay.
      // This bounded component never claims complete state or tipped overtime.
      for(const [weekStart,week] of intakeWeeks){
        const overtime=week.microMinutes>2400000000n?week.microMinutes-2400000000n:0n
        if(!overtime)continue
        const scoped=inputLines.filter(r=>r.workweek===weekStart)
        const unsupported=!week.nonexempt || periodStart>weekStart || periodEnd<addDays(weekStart,6) || work.some(w=>w.data.day>=weekStart && w.data.day<=addDays(weekStart,6)) || scoped.some(r=>(r.code==='tip' && r.amountCents>0) || ['bonus','other-earning','meal-premium','rest-premium'].includes(r.code)) || tips.some(t=>t.data.amountCents>0 && t.data.day>=weekStart && t.data.day<=addDays(weekStart,6)) || sourceEarnings.some(e=>e.data.effectiveDate>=weekStart&&e.data.effectiveDate<=addDays(weekStart,6)) || items.some(i=>i.data.taxCode!=='accountable-reimbursement'&&i.data.taxCode!=='after-tax-deduction')
        if(unsupported){holds.push({personId:member.id,reason:`${weekStart}: complete workweek remuneration, nonexempt classification and tipped or premium overtime require review; no partial regular-rate result is substituted.`});continue}
        const allocated=scoped.filter(r=>['nondiscretionary-bonus','commission','service-charge'].includes(r.code)).reduce((sum,r)=>sum+BigInt(r.amountCents),0n)
        const premium=money((week.straightNumerator+allocated*60000000n)*overtime,60000000n*2n*week.microMinutes)
        earnings+=premium;taxable+=premium
        details.push(`Federal weekly overtime component for ${weekStart}: ${Number(week.microMinutes)/60000000} hours, ${Number(overtime)/60000000} overtime hours, ${Number(allocated)} cents allocated remuneration, ${premium} cents additional half-time. Complete jurisdiction and tax calculation remains held.`)
      }
      // California DLSE meal and rest guidance: one additional hour at the
      // workweek regular rate, including allocated nondiscretionary remuneration.
      // Premium units are never included in the worked-time numerator or hours.
      for (const line of inputLines.filter(r=>['meal-premium','rest-premium'].includes(r.code) && r.minutes)) {
        const week=intakeWeeks.get(line.workweek), scoped=inputLines.filter(r=>r.workweek===line.workweek)
        const unsupported=!week || !week.nonexempt || !week.microMinutes ||
          assigned.find(p=>p.id===member.id)?.state!=='CA' || line.state!=='CA' ||
          periodStart>line.workweek || periodEnd<addDays(line.workweek,6) ||
          work.some(w=>w.data.day>=line.workweek && w.data.day<=addDays(line.workweek,6)) ||
          scoped.some(r=>(r.code==='tip' && r.amountCents>0) || ['bonus','other-earning','paid-leave','unpaid-leave'].includes(r.code)) || tips.some(t=>t.data.amountCents>0) || sourceEarnings.length || items.length
        if(unsupported){holds.push({personId:member.id,reason:`${line.day}: complete California premium regular-rate remuneration requires review; no partial premium amount is substituted.`});continue}
        const allocated=scoped.filter(r=>['nondiscretionary-bonus','commission','service-charge'].includes(r.code)).reduce((n,r)=>n+BigInt(r.amountCents),0n)
        const premium=money((week.straightNumerator+allocated*60000000n)*BigInt(line.minutes)*1000000n,60000000n*week.microMinutes)
        earnings+=premium;taxable+=premium
        details.push(`California ${line.code} ${line.day}, source ${line.sourceId}: ${line.minutes} premium minutes, ${premium} cents at the workweek regular rate; zero additional worked hours.`)
      }
      for (const t of tips) {
        tipped[t.data.settlement] += t.data.amountCents
        tipped.funds += t.data.furnishedCents
        objects.push({ kind: 'tip', id: t.id, version: t.version })
        details.push(`Tip ${t.data.day} v${t.version}: $${(t.data.amountCents / 100).toFixed(2)} ${t.data.settlement}` +
          `, employee-furnished funds $${(t.data.furnishedCents / 100).toFixed(2)}`)
      }
      for (const earning of sourceEarnings.filter((r)=>r.data.effectiveDate>=periodStart && r.data.effectiveDate<=periodEnd)) {
        if (!earning.approvedBy || earning.withdrawnBy || !earning.sourcesCurrent) {
          holds.push({personId:member.id,reason:'Source earning requires current exact human review: '+earning.data.sourceId})
          continue
        }
        const amount=Number(earning.data.values.amountCents)
        earnings+=amount;taxable+=amount
        details.push(`${earning.data.provider} ${earning.data.values.earningType}: ${amount} cents, job ${earning.data.values.jobId}, source ${earning.data.sourceId} v${earning.data.sourceVersion}`)
        objects.push({kind:'source-earning',id:earning.id,version:earning.version,approved:true})
      }
      const leave = await new LeaveLedger(this.store).preview(actor, member.id, periodStart, periodEnd)
      taxable += leave.amountCents
      for (const row of leave.rows) objects.push({ kind: 'leave-account', id: row.id, version: row.version, approved: true })
      if (leave.rows.length) {
        for (const line of leave.lines)
          details.push(`Leave bank ${line.bucket}: ${line.code} ${line.day}: ${line.minutes} minutes, ${line.amountCents} cents; ${line.owner} source ${line.sourceId} v${line.sourceVersion}. Reserved only; no payment or consumption receipt.`)
      }
      taxable += tipped.paycheck
      if (tips.length || inputLines.some(r=>r.code==='tip'))
        holds.push({ personId: member.id, code:'tip-tax-calculation-unavailable',
          reason: 'Tax on tips, the employee-furnished funds applied and any uncollected tax are not calculated (ENV-009).' })
      // A reviewed source can describe one exact period's after-tax deduction.
      // No enrollment, pretax treatment, remittance or paid result is inferred.
      const benefits = latest(hr).filter(r => r.data.type === 'benefit'
        && r.data.effectiveDate <= periodEnd
        && r.data.values.periodStart === periodStart && r.data.values.periodEnd === periodEnd)
      for (const benefit of benefits) {
        const peers = benefits.filter(r => r.data.values.code === benefit.data.values.code)
        if (peers.length !== 1) {
          if (!holds.some(h => h.personId === member.id && h.code === 'hris-benefit-conflict'))
            holds.push({personId: member.id, code: 'hris-benefit-conflict', reason: 'Conflicting HRIS benefit deductions require source reconciliation; no conflicting amount is applied.'})
          continue
        }
        if (!effective(benefit, periodEnd) || benefit.data.values.taxTreatment !== 'after-tax') continue
        deductions += Number(benefit.data.values.amountCents)
        objects.push({kind: 'hris-event', id: benefit.id, version: benefit.version, approved: true})
        details.push(`Willow after-tax benefit ${benefit.data.values.code}: ${benefit.data.values.amountCents} cents for ${periodStart} through ${periodEnd}; source ${benefit.data.sourceId} v${benefit.data.sourceVersion}. Preview only; no contribution receipt.`)
      }
      for (const c of used.values()) {
        objects.push({ kind: 'pay-change', id: c.id, version: c.version, approved: true })
        details.push(`${c.data.name} v${c.version}, effective ${c.data.effectiveDate}`)
      }
      const endings = latest(hr).filter(r => r.data.type === 'termination'
        && r.data.effectiveDate >= periodStart && r.data.effectiveDate <= periodEnd)
      if (endings.length > 1) {
        holds.push({personId: member.id, code: 'hris-final-pay-conflict', reason: 'Conflicting HRIS termination sources require exact employment and final-pay reconciliation.'})
      } else if (endings.length === 1 && effective(endings[0], periodEnd)) {
        const ending = endings[0]
        const finalStates = [...new Set(work.filter(w => w.data.day === ending.data.effectiveDate).map(w => w.data.state))]
        const final = finalPayCheck({state: finalStates.length === 1 ? finalStates[0] : 'unresolved actual-work state',
          separation: (ending.data.values.separation ?? 'none') as Separation,
          lastDay: ending.data.effectiveDate, periodStart, periodEnd, payDate})
        details.push(`Final-pay work-state basis: ${finalStates.join(', ') || 'missing'} on ${ending.data.effectiveDate}; historical allocations are retained.`)
        details.push(`Willow final-pay source ${ending.data.sourceId} v${ending.data.sourceVersion}; no paid result or remote acknowledgement.`)
        details.push(...final.details)
        for (const hold of final.holds) holds.push({personId: member.id, ...hold})
        objects.push({kind: 'hris-event', id: ending.id, version: ending.version, approved: true})
      }
      // Employment ending inside the period is final pay with its own work-state deadline.
      const last = [...used.values()].sort((x, y) => y.data.effectiveDate.localeCompare(x.data.effectiveDate))[0]
      const terms = last?.data.items.find((p) => p.personId === member.id)
      if (terms) {
        const final = finalPayCheck({ state: assigned.find((p) => p.id === member.id)?.state ?? '',
          separation: terms.separation ?? 'none', lastDay: terms.employmentThrough, periodStart, periodEnd, payDate })
        details.push(...final.details)
        for (const hold of final.holds) holds.push({ personId: member.id, ...hold })
      }
      for (const item of items) {
        if (!effective(item, payDate)) {
          if (item.data.effectiveDate <= payDate)
            holds.push({
              personId: member.id,
              reason: `${item.data.name}: current exact human approval required.`,
            })
          continue
        }
        if (!item.data.recurring) {
          holds.push({
            personId: member.id,
            reason: `${item.data.name}: one-time assignment/consumption is not implemented.`,
          })
          continue
        }
        if (item.data.taxCode === 'accountable-reimbursement') {
          // A standing recurring setup is insufficient for per-run substantiation.
          holds.push({
            personId: member.id,
            reason: `${item.data.name}: verify this period's substantiation and return of excess before tax exclusion.`,
          })
          reimbursement += item.data.amountCents
        } else if (item.data.taxCode === 'after-tax-deduction')
          deductions += item.data.amountCents
        else taxable += item.data.amountCents
        details.push(
          `${item.data.name} v${item.version}: ${item.data.amountCents} cents, ${item.data.taxCode}`,
        )
        objects.push({
          kind: 'pay-item',
          id: item.id,
          version: item.version,
          approved: true,
        })
      }
      holds.push({
        personId: member.id,
        code:'payroll-calculation-unavailable',
        reason:
          'Gross-to-net, overtime/premiums, legal deduction limits and complete jurisdiction tax treatment are not implemented, so this version cannot be released, paid or dispatched as payroll.',
      })
      people.push({
        id: member.id,
        name: member.name,
        earningsCents: earnings,
        taxableCashCents: taxable,
        reimbursementCents: reimbursement,
        afterTaxDeductionCents: deductions,
        cashTipsCents: tipped.cash,
        paycheckTipsCents: tipped.paycheck,
        tipFundsCents: tipped.funds,
        details,
      })
    }
    const sum = (
      field: 'taxableCashCents' | 'reimbursementCents' | 'afterTaxDeductionCents',
    ) => people.reduce((s, p) => s + p[field], 0)
    const locationStates = [
      ...new Set(
        assigned
          .filter((p) => group.data.people.some((m) => m.id === p.id))
          .map((p) => p.state),
      ),
    ]
    const rules = await this.store.list<PayrollRule>(
      actor,
      'rule',
      undefined,
      true,
      false,
    )
    const selectedRules = periodRules(rules, locationStates, periodStart, periodEnd)
    // Versions only: the run binds which bank record it would pay, never the account.
    const banks = (
      await this.store.records
        .statement(
          "SELECT person_id AS personId,version FROM env_private_records WHERE company_id=? AND kind='bank'",
          [actor.company],
        )
        .all<{ personId: string; version: number }>()
    ).results
    const destinations = group.data.people.map((p) => ({
      personId: p.id,
      bankVersion: banks.find((b) => b.personId === p.id)?.version ?? 0,
    }))

    const result: EarningsRun = {
      periodStart,
      periodEnd,
      payDate,
      frequency,
      groupId: group.id,
      people,
      holds,
      destinations,
      grossCashCents: sum('taxableCashCents') + sum('reimbursementCents'),
      taxableCashCents: sum('taxableCashCents'),
      reimbursementCents: sum('reimbursementCents'),
      afterTaxDeductionCents: sum('afterTaxDeductionCents'),
      taxAmounts: null,
      netPay: null,
      paymentReady: false,
      setupFingerprint: await fingerprint(group.id, allChanges, allItems, allPolicies),
      locationStates,
      ruleFingerprint: await ruleFingerprint(
        rules,
        locationStates,
        periodStart,
        periodEnd,
      ),
      ruleSources: selectedRules.map((r) => ({
        id: r.id,
        version: r.version,
        name: r.data.name,
        determination: r.data.determination,
        approved: Boolean(r.approvedBy && !r.withdrawnBy),
      })),
    }
    if (!persist) return result
    if (objects.some((o) => objects.some((p) => p.kind === o.kind && p.id === o.id && p.version !== o.version)))
      throw new PayrollError('conflicting_period_source_versions', 409)
    const unique = objects.filter(
      (o, i, a) => a.findIndex((x) => x.kind === o.kind && x.id === o.id) === i,
    )
    return {
      ...(await this.store.append(
        actor,
        'earnings-run',
        objectId(input.id),
        revision(input.version),
        result,
        undefined,
        true,
        {
          people: group.data.people.map((p) => ({ id: p.id, version: p.version })),
          objects: unique,
          // New work IDs for a payee and any approval-policy change are material.
          reviewSets: await collectionPins(this.store, actor, [
            ...group.data.people.flatMap((p) => (['work', 'tip', 'leave-account', 'hris-event', 'source-earning'] as Kind[]).map((kind) => ({ kind, personId: p.id, exceptId: '' }))),
            { kind: 'approval-policy', personId: '', exceptId: '' },
          ]),
        },
      )),
      preview: result,
    }
  }
}
