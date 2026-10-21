import type { Records, Input } from './records'
import { fence, auditStatement, type Actor } from './access'
import { PayrollError, text, date, integer, recordKey, seal, unseal } from './security'

export const states =
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' ',
  )
export const taxKinds = [
  'withholding',
  'sui',
  'local',
  'disability',
  'pfml',
  'state-fund',
  'hour-assessment',
] as const
export const frequencies = [
  'monthly',
  'semiweekly',
  'quarterly',
  'annually',
  'agency-assigned',
] as const
const choice = (value: unknown, choices: readonly string[]) => {
  const v = text(value)
  if (!choices.includes(v)) throw new PayrollError('invalid_choice')
  return v
}
const revision = (v: unknown) => (v === 0 || v === '0' ? 0 : integer(v))
const optional = (v: unknown, max = 120) => (v === undefined || v === '' ? '' : text(v, max))
const decimal = (v: unknown, max: number) => {
  const s = text(v, 30)
  if (!/^\d+(\.\d{1,6})?$/.test(s) || Number(s) > max)
    throw new PayrollError('invalid_decimal')
  return s
}
function source(input: Input) {
  const sourceUrl = text(input.sourceUrl, 1000)
  let url: URL
  try {
    url = new URL(sourceUrl)
  } catch {
    throw new PayrollError('invalid_source_url')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new PayrollError('invalid_source_url')
  return {
    sourceUrl: url.href,
    sourceTitle: text(input.sourceTitle, 240),
    sourceDate: date(input.sourceDate),
  }
}
function owner(actor: Actor) {
  if (actor.grant.role !== 'owner') throw new PayrollError('owner_required', 403)
}
export class CompanySetup {
  constructor(public records: Records) {}
  async append(
    actor: Actor,
    table: 'env_company_setup' | 'env_jurisdictions',
    code: string,
    input: Input,
    payload: Input,
  ) {
    owner(actor)
    const version = revision(input.version),
      effectiveDate = date(input.effectiveDate),
      f = fence(actor)
    const id = crypto.randomUUID(),
      timestamp = Date.now()
    const key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    const cipher = await seal(
      key,
      JSON.stringify([actor.company, table, code, version + 1]),
      JSON.stringify(payload),
    )
    const coded = table === 'env_jurisdictions'
    const result = await this.records.env.DB.batch([
      this.records.statement(
        `INSERT INTO ${table}(company_id,${coded ? 'code,' : ''}version,effective_date,cipher,created_by,created_at,change_id)
    SELECT ?,${coded ? '?,' : ''}?,?,?,?,?,? WHERE ${f.sql}
    AND COALESCE((SELECT MAX(version) FROM ${table} WHERE company_id=? ${coded ? 'AND code=?' : ''}),0)=? RETURNING version`,
        [
          actor.company,
          ...(coded ? [code] : []),
          version + 1,
          effectiveDate,
          cipher,
          actor.session.operator.id,
          timestamp,
          id,
          ...f.args,
          actor.company,
          ...(coded ? [code] : []),
          version,
        ],
      ),
      auditStatement(
        this.records.env,
        actor,
        id,
        coded ? 'jurisdiction.recorded' : 'company.setup.recorded',
        code || actor.company,
        version + 1,
        `EXISTS(SELECT 1 FROM ${table} WHERE change_id=?)`,
        [id],
      ),
    ])
    if (!result[0].results.length) throw new PayrollError('setup_or_authority_changed', 409)
    return { version: version + 1, effectiveDate }
  }
  async saveProfile(actor: Actor, input: Input) {
    owner(actor)
    const payload = {
      legalName: text(input.legalName),
      dbaName: optional(input.dbaName),
      address: text(input.address, 500),
      responsibleContact: text(input.responsibleContact, 240),
      depositSchedule: choice(input.depositSchedule, frequencies),
      lookbackStart: date(input.lookbackStart),
      lookbackEnd: date(input.lookbackEnd),
      reportingAgentElection: choice(input.reportingAgentElection, [
        'not-elected',
        'pending',
        'signed-evidence',
      ]),
      reportingAgentEvidence: optional(input.reportingAgentEvidence, 500),
      bankAuthorization: choice(input.bankAuthorization, [
        'missing',
        'pending',
        'signed-evidence',
      ]),
      bankEvidence: optional(input.bankEvidence, 500),
      ...source(input),
    }
    if (payload.lookbackStart > payload.lookbackEnd)
      throw new PayrollError('invalid_lookback_period')
    if (
      (payload.bankAuthorization === 'signed-evidence' && !payload.bankEvidence) ||
      (payload.reportingAgentElection === 'signed-evidence' && !payload.reportingAgentEvidence)
    )
      throw new PayrollError('authorization_evidence_required')
    return this.append(actor, 'env_company_setup', '', input, payload)
  }
  async saveJurisdiction(actor: Actor, input: Input) {
    owner(actor)
    const code = text(input.code, 80)
    if (!/^[A-Z0-9][A-Z0-9-]{1,79}$/.test(code))
      throw new PayrollError('invalid_jurisdiction_code')
    const kind = choice(input.kind, taxKinds),
      state = choice(input.state, states)
    const registrationStatus = choice(input.registrationStatus, [
      'missing',
      'pending',
      'issued-evidence',
      'exempt',
    ])
    const exemptionBasis = optional(input.exemptionBasis, 1000),
      account = optional(input.account, 160)
    if (registrationStatus === 'exempt' && !exemptionBasis)
      throw new PayrollError('exemption_basis_required')
    if (registrationStatus === 'issued-evidence' && !account)
      throw new PayrollError('agency_account_required')
    if (registrationStatus !== 'issued-evidence' && account)
      throw new PayrollError('account_status_conflict')
    const payload = {
      state,
      kind,
      agency: text(input.agency, 240),
      registrationStatus,
      account,
      exemptionBasis,
      rate: decimal(input.rate, 100),
      rateBasis: choice(input.rateBasis, [
        'published-new-employer',
        'agency-assigned',
        'official-table',
        'not-applicable',
      ]),
      wageBaseCents:
        input.wageBaseCents === 0 || input.wageBaseCents === '0'
          ? 0
          : integer(input.wageBaseCents),
      depositFrequency: choice(input.depositFrequency, frequencies),
      returnFrequency: choice(input.returnFrequency, frequencies),
      employeeRate: decimal(input.employeeRate ?? '0', 100),
      hoursMethod: choice(input.hoursMethod, [
        'not-applicable',
        'actual',
        'wa-160-month',
        'or-actual',
        'or-assumed',
      ]),
      authority: choice(input.authority, ['missing', 'pending', 'evidence-recorded']),
      authorityEvidence: optional(input.authorityEvidence, 500),
      ...source(input),
    }
    if (payload.authority === 'evidence-recorded' && !payload.authorityEvidence)
      throw new PayrollError('authorization_evidence_required')
    if (Number(payload.employeeRate) > Number(payload.rate))
      throw new PayrollError('employee_rate_exceeds_total')
    if (
      state === 'WA' &&
      kind === 'state-fund' &&
      !['actual', 'wa-160-month'].includes(payload.hoursMethod)
    )
      throw new PayrollError('wa_hours_election_required')
    if (
      state === 'OR' &&
      kind === 'hour-assessment' &&
      !['or-actual', 'or-assumed'].includes(payload.hoursMethod)
    )
      throw new PayrollError('or_hours_method_required')
    return this.append(actor, 'env_jurisdictions', code, input, payload)
  }
  async read(actor: Actor, asOf: string) {
    owner(actor)
    date(asOf)
    const f = fence(actor),
      event = crypto.randomUUID(),
      key = await recordKey(this.records.env.ENVELOPE_RECORD_KEY)
    const result = await this.records.env.DB.batch<Record<string, unknown>>([
      auditStatement(
        this.records.env,
        actor,
        event,
        'company.setup.read',
        actor.company,
        actor.grant.version,
      ),
      this.records.statement(
        `SELECT version,effective_date AS effectiveDate,cipher,created_by AS createdBy,created_at AS createdAt FROM env_company_setup
    WHERE company_id=? AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) AND ${f.sql} ORDER BY effective_date DESC,version DESC`,
        [actor.company, event, ...f.args],
      ),
      this.records.statement(
        `SELECT code,version,effective_date AS effectiveDate,cipher,created_by AS createdBy,created_at AS createdAt FROM env_jurisdictions
    WHERE company_id=? AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) AND ${f.sql} ORDER BY effective_date DESC,version DESC`,
        [actor.company, event, ...f.args],
      ),
      this.records.statement(
        `SELECT DISTINCT state_code AS state FROM env_locations WHERE company_id=? AND ${f.sql}`,
        [actor.company, ...f.args],
      ),
    ])
    if (!result[0].meta.changes) throw new PayrollError('authority_changed', 409)
    const decode = async (rows: Record<string, unknown>[], table: string) =>
      Promise.all(
        rows.map(async ({ cipher, ...row }) => {
          const payload = JSON.parse(
            await unseal(
              key,
              JSON.stringify([actor.company, table, row.code ?? '', row.version]),
              String(cipher),
            ),
          )
          if ('account' in payload) {
            payload.accountMasked = payload.account
              ? '••••' + String(payload.account).slice(-4)
              : ''
            delete payload.account
          }
          return { ...row, ...payload }
        }),
      )
    const profiles = await decode(result[1].results, 'env_company_setup'),
      history = await decode(result[2].results, 'env_jurisdictions')
    const current = history.filter(
      (r, i, all) =>
        r.effectiveDate <= asOf &&
        all.findIndex((x) => x.code === r.code && x.effectiveDate <= asOf) === i,
    )
    const requirements: {
      state: string
      kind: string
      code: string
      reason: string
      recorded: boolean
    }[] = []
    for (const state of result[3].results.map((r) => r.state)) {
      if (state === 'WA')
        requirements.push({
          state,
          kind: 'state-fund',
          code: 'WA-LI',
          reason:
            'WA L&I account, confirmed TPA scope, risk-class total/employee rates and one employer-wide salaried-hours election; private policy does not substitute.',
          recorded: current.some((r) => r.state === state && r.kind === 'state-fund'),
        })
      if (state === 'OR')
        requirements.push({
          state,
          kind: 'hour-assessment',
          code: 'OR-WBF',
          reason: 'OR WBF applicability, its own hours method and combined-report authority.',
          recorded: current.some((r) => r.state === state && r.kind === 'hour-assessment'),
        })
    }
    return {
      asOf,
      profile: profiles.find((r) => r.effectiveDate <= asOf) ?? null,
      profiles,
      jurisdictions: current,
      history,
      requirements,
      unknownLocationStates: result[3].results.some((r) => !r.state),
      remittanceHolds: current
        .filter(
          (r) =>
            r.registrationStatus === 'missing' ||
            r.registrationStatus === 'pending' ||
            r.authority !== 'evidence-recorded',
        )
        .map((r) => ({
          code: r.code,
          scope: 'jurisdiction-deposit-and-filing',
          reason:
            r.registrationStatus === 'missing' || r.registrationStatus === 'pending'
              ? 'account-pending'
              : 'authority-unconfirmed',
        })),
      // This register never claims tax calculation, agency confirmation or payment readiness.
      ready: false,
      readinessReason:
        'Agency confirmation, complete official coverage, calculation and authorized payroll/remittance proof remain required. Account/grant delays alone must not hold lawful wages.',
    }
  }
}
