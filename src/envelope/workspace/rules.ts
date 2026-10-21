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
  digest,
} from './store'
import type { EarningsRun } from './pay-items'

export const ruleFamilies = [
  'tax-table',
  'fica-base',
  'sui',
  'pfml',
  'disability',
  'city-minimum-wage',
  'exempt-threshold',
  'final-pay-deadline',
  'deposit-deadline',
  'filing-deadline',
  'wa-li',
  'or-wbf',
  'hi-plan-share',
  'futa',
] as const
export interface PayrollRule {
  name: string
  family: string
  state: string
  locality: string
  effectiveFrom: string
  effectiveThrough: string
  publishedDate: string
  sourceUrl: string
  sourceTitle: string
  sourceRef: string
  edition: string
  taxYear: number
  determination: string
  value: string
  unit: string
  details: Record<string, string>
  ownerId: string
  backupId: string
  approvalDue: string
  wageDeadline: string
}
export function instant(v: unknown) {
  const s = text(v, 40)
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s) ||
    !Number.isFinite(Date.parse(s))
  )
    throw new PayrollError('invalid_deadline')
  date(s.slice(0, 10))
  const canonical = s.includes('.') ? s : s.replace('Z', '.000Z')
  if (new Date(s).toISOString() !== canonical) throw new PayrollError('invalid_deadline')
  return canonical
}
const latest = <T>(rows: Revision<T>[]) =>
  rows.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
const decimal = (v: unknown, max = 100) => {
  const s = text(v, 24)
  if (!/^\d+(\.\d{1,6})?$/.test(s) || Number(s) > max)
    throw new PayrollError('invalid_rule_value')
  return s
}
export function officialSource(v: unknown) {
  let url: URL
  try {
    url = new URL(text(v, 1000))
  } catch {
    throw new PayrollError('invalid_official_source')
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.gov') ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new PayrollError('invalid_official_source')
  return url.href
}

export function periodRules(
  history: Revision<PayrollRule>[],
  states: string[],
  from: string,
  through: string,
) {
  return history
    .filter(
      (r) =>
        (r.data.state === 'US' || states.includes(r.data.state)) &&
        r.data.effectiveFrom <= through &&
        r.data.effectiveThrough >= from,
    )
    .sort((a, b) => b.version - a.version)
    .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
}
export const ruleFingerprint = (
  history: Revision<PayrollRule>[],
  states: string[],
  from: string,
  through: string,
) =>
  digest(
    JSON.stringify(
      periodRules(history, states, from, through)
        .map((r) => [r.id, r.version, r.approvedBy, r.withdrawnBy])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ),
  )

export class Rules {
  constructor(public store: WorkspaceStore) {}
  async save(actor: Actor, input: Input) {
    await this.store.authority(actor, 'rates:propose', undefined, true)
    const family = choice(input.family, ruleFamilies),
      state = choice(input.state, [
        'US',
        ...'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
          ' ',
        ),
      ]),
      locality = optional(input.locality),
      effectiveFrom = date(input.effectiveFrom),
      effectiveThrough = date(input.effectiveThrough),
      taxYear = integer(input.taxYear)
    if (effectiveFrom > effectiveThrough || taxYear < 2020 || taxYear > 2100)
      throw new PayrollError('invalid_rule_period')
    const determination = choice(input.determination, ['provisional', 'final']),
      details: Record<string, string> = {}
    let supplied: unknown = input.details ?? {}
    if (typeof supplied === 'string') {
      try {
        supplied = JSON.parse(supplied)
      } catch {
        throw new PayrollError('invalid_rule_details')
      }
    }
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))
      throw new PayrollError('invalid_rule_details')
    const d = supplied as Input
    if (family === 'wa-li') {
      if (state !== 'WA') throw new PayrollError('rule_jurisdiction_conflict')
      details.riskClass = text(d.riskClass, 80)
      details.totalRate = decimal(d.totalRate)
      details.employeeRate = decimal(d.employeeRate)
      details.hoursMethod = choice(d.hoursMethod, ['actual', 'wa-160-month'])
      if (Number(details.employeeRate) > Number(details.totalRate))
        throw new PayrollError('employee_rate_exceeds_total')
    } else if (family === 'or-wbf') {
      if (state !== 'OR') throw new PayrollError('rule_jurisdiction_conflict')
      details.totalRate = decimal(d.totalRate)
      details.employeeRate = decimal(d.employeeRate)
      details.hoursMethod = choice(d.hoursMethod, ['actual', 'assumed'])
      details.rounding = choice(d.rounding, ['nearest-cent-per-report'])
      if (Number(details.employeeRate) > Number(details.totalRate))
        throw new PayrollError('employee_rate_exceeds_total')
    } else if (family === 'hi-plan-share') {
      if (state !== 'HI') throw new PayrollError('rule_jurisdiction_conflict')
      details.planRef = text(d.planRef, 240)
      details.weeklyCapCents = String(integer(d.weeklyCapCents))
      details.employeePercentCap = decimal(d.employeePercentCap)
    } else if (family === 'futa') {
      details.reduction = decimal(d.reduction)
      details.bcr = decimal(d.bcr)
      details.addOn = decimal(d.addOn)
      details.waiverRef = optional(d.waiverRef, 240)
      if (determination === 'final' && !d.finalNoticeRef)
        throw new PayrollError('final_futa_notice_required')
      details.finalNoticeRef = optional(d.finalNoticeRef, 240)
    }
    const ownerId = objectId(input.ownerId),
      backupId = objectId(input.backupId)
    for (const id of [ownerId, backupId]) {
      const found = await this.store.records
        .statement(
          `SELECT g.operator_id FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=? AND g.operator_id=? AND g.revoked_at IS NULL AND o.status='active' AND (g.role='owner' OR EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='rates:approve'))`,
          [actor.company, id],
        )
        .first()
      if (!found) throw new PayrollError('current_human_duty_owner_required')
    }
    if (ownerId === backupId) throw new PayrollError('distinct_backup_required')
    const approvalDue = instant(input.approvalDue),
      wageDeadline = instant(input.wageDeadline)
    if (approvalDue >= wageDeadline)
      throw new PayrollError('approval_must_precede_wage_deadline')
    const data: PayrollRule = {
      name: text(input.name),
      family,
      state,
      locality,
      effectiveFrom,
      effectiveThrough,
      publishedDate: date(input.publishedDate),
      sourceUrl: officialSource(input.sourceUrl),
      sourceTitle: text(input.sourceTitle, 240),
      sourceRef: text(input.sourceRef, 500),
      edition: text(input.edition),
      taxYear,
      determination,
      value: decimal(input.value, 100000000),
      unit: choice(input.unit, [
        'USD/hour',
        'USD/year',
        'cents/hour',
        'percent',
        'USD/week',
        'calendar-rule',
      ]),
      details,
      ownerId,
      backupId,
      approvalDue,
      wageDeadline,
    }
    if (family === 'city-minimum-wage' && !locality)
      throw new PayrollError('city_rule_locality_required')
    return this.store.append(
      actor,
      'rule',
      objectId(input.id),
      revision(input.version),
      data,
      undefined,
      true,
    )
  }
  async read(actor: Actor, asOf = new Date().toISOString()) {
    instant(asOf)
    const history = await this.store.list<PayrollRule>(actor, 'rule', undefined, true),
      runs = await this.store.list<EarningsRun>(actor, 'earnings-run', undefined, true),
      people = await this.store.records.people(actor)
    const states = await this.store.records
      .statement('SELECT id,state_code AS state FROM env_locations WHERE company_id=?', [
        actor.company,
      ])
      .all<{ id: string; state: string }>()
    const impacts = []
    for (const row of latest(history)) {
      const rule = row.data,
        affected = people.filter(
          (p) =>
            rule.state === 'US' ||
            states.results.some((l) => l.id === p.locationId && l.state === rule.state),
        )
      // Locality and historical/multi-state exposure require the full calculation
      // engine. These are candidate impacts, never a completeness claim.
      const drafts = latest(runs).filter(
        (r) =>
          r.data.periodStart <= rule.effectiveThrough &&
          r.data.periodEnd >= rule.effectiveFrom &&
          r.data.people.some((p) => affected.some((a) => a.id === p.id)),
      )
      impacts.push({
        id: row.id,
        version: row.version,
        people: affected.map((p) => ({ id: p.id, name: p.name })),
        drafts: drafts.map((d) => ({
          id: d.id,
          version: d.version,
          periodStart: d.data.periodStart,
          periodEnd: d.data.periodEnd,
        })),
        scope: 'candidate-impact-only',
        localityUnresolved: Boolean(rule.locality),
        historicalLocationCoverage: 'unproved',
      })
    }
    const obligations = latest(history).map((r) => {
      const approvedAt = r.approvedAt ?? null,
        rule = r.data,
        late = Date.parse(rule.approvalDue) <= (approvedAt ?? Date.parse(asOf))
      return {
        id: r.id,
        version: r.version,
        ownerId: rule.ownerId,
        backupId: rule.backupId,
        approvalDue: rule.approvalDue,
        wageDeadline: rule.wageDeadline,
        missedInternalApprovalDeadline: late,
        proposedMutation:
          !r.approvedBy || r.withdrawnBy
            ? 'held-pending-human-decision'
            : 'human-reviewed',
        escalation: !r.approvedBy && late ? 'backup-action-required' : 'none',
        wageDuty:
          'Named human must secure a lawful approved original/replacement payment by the wage deadline. Holding this proposal never permits underpayment or late wages.',
        paymentReceipt: null,
      }
    })
    const today = asOf.slice(0, 10),
      active = history
        .filter(
          (r) =>
            r.approvedBy &&
            !r.withdrawnBy &&
            r.data.determination === 'final' &&
            r.data.effectiveFrom <= today &&
            r.data.effectiveThrough >= today,
        )
        .sort(
          (a, b) =>
            b.data.effectiveFrom.localeCompare(a.data.effectiveFrom) ||
            b.version - a.version,
        )
        .filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i)
    const futaYears = [
      ...new Set([
        Number(asOf.slice(0, 4)),
        ...history.filter((r) => r.data.family === 'futa').map((r) => r.data.taxYear),
      ]),
    ]
    const missingFinalFuta = futaYears.filter(
      (year) =>
        !latest(history).some(
          (r) =>
            r.data.family === 'futa' &&
            r.data.taxYear === year &&
            r.data.determination === 'final' &&
            r.approvedBy &&
            !r.withdrawnBy,
        ),
    )
    const duties = (
      await this.store.records
        .statement(
          `SELECT g.operator_id AS id,o.display_name AS name FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=? AND g.revoked_at IS NULL AND o.status='active' AND (g.role='owner' OR EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='rates:approve'))`,
          [actor.company],
        )
        .all<{ id: string; name: string }>()
    ).results
    return {
      asOf,
      history,
      duties,
      active,
      impacts,
      obligations,
      missingFinalFuta,
      coverage: 'incomplete',
      calculationApplied: false,
      explanation:
        'Recorded source editions and candidate impacts are not a complete federal/state/DC/local rule inventory or calculated liabilities. Prior-year FUTA rates never supply a missing current-year final notice.',
    }
  }
}
