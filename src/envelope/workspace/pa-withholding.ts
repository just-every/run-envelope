type Allocation = {
  day: string
  earnedCents: number
  physicalWorkState: string
  residentState: string
  stateWageBases: { state: string; basisCents: number; role: string }[]
  electionId: string | null
}

const source = {
  id: 'pa-employer-withholding-2026-reviewed-2026-10-23',
  title: 'Pennsylvania Department of Revenue: Employer Withholding, 3.07%',
  url: 'https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/employer-withholding',
  effectiveFrom: '2026-01-01',
  effectiveThrough: '2026-12-31',
  retrievedAt: '2026-10-23',
} as const
const compensationSource =
  'https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/gross-compensation'

const validDate = (value: string) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
const validCents = (value: number) => Number.isSafeInteger(value) && value >= 0
const validState = (value: string) => typeof value === 'string' && /^[A-Z]{2}$/.test(value)

/**
 * Ordinary PA-taxable cash compensation only, not complete payroll or taxability.
 * The effective interval bounds this implementation's coverage, not the law's enactment.
 * Caller supplies one person's current sourced rows for ONE actual payroll period;
 * same-day rows are additive. Without source IDs this function cannot deduplicate
 * source records: the caller must select current revisions once, before calling.
 */
export function paWithholding(allocations: Allocation[], from: string, through: string, payDate: string) {
  if (!validDate(from) || !validDate(through) || !validDate(payDate) || from > through || !Array.isArray(allocations))
    throw new Error('invalid_pa_withholding_period')
  const holds = new Set<string>()
  const lines: { day: string; taxableWagesCents: number; sourceRole: string }[] = []
  let wages = 0n
  if (payDate < source.effectiveFrom || payDate > source.effectiveThrough)
    holds.add('The PA withholding source edition covers 2026 only.')
  if (!allocations.length) holds.add('No sourced work allocations in the payroll period.')

  for (const row of allocations) {
    if (!row || !validDate(row.day) || row.day < from || row.day > through ||
        !validCents(row.earnedCents) || !validState(row.residentState) ||
        !validState(row.physicalWorkState) || !Array.isArray(row.stateWageBases) ||
        !(row.electionId === null ||
          (typeof row.electionId === 'string' && row.electionId.trim().length > 0)))
      throw new Error('invalid_pa_withholding_allocation')
    const baseStates = new Set<string>()
    for (const base of row.stateWageBases) {
      if (!base || !validState(base.state) || !validCents(base.basisCents) ||
          base.basisCents !== row.earnedCents || typeof base.role !== 'string' ||
          !base.role.trim() || baseStates.has(base.state))
        throw new Error('invalid_pa_withholding_wage_base')
      baseStates.add(base.state)
    }
    const resident = row.residentState === 'PA'
    const physical = row.physicalWorkState === 'PA'
    if (!resident && !physical) {
      if (baseStates.has('PA'))
        holds.add('A PA wage base conflicts with the recorded residence and physical work state.')
      continue
    }
    let role = resident ? 'PA resident compensation' : 'PA physical-work compensation'
    if (resident && !baseStates.has('PA'))
      holds.add('PA resident wage-base provenance is missing.')
    if (resident && (!['PA', 'NJ'].includes(row.physicalWorkState) ||
        [...baseStates].some((state) => !['PA', 'NJ'].includes(state))))
      holds.add('Foreign-source taxation, including NY convenience sourcing and any resident credit, remains unresolved.')
    if (!resident) {
      if (row.residentState !== 'NJ')
        holds.add('Nonresident PA withholding outside the NJ/PA scenario is not implemented.')
      if (row.electionId) {
        role += '; proposed reciprocal exemption, signed custody unverified'
        holds.add('Recorded reciprocity is provisional: verify signed REV-419EX custody and required NJ withholding before applying a PA exemption.')
      } else if (!baseStates.has('PA'))
        holds.add('PA physical-work wage-base provenance is missing.')
      if ([...baseStates].some((state) => !['PA', 'NJ'].includes(state)))
        holds.add('Additional foreign-source taxation remains unresolved.')
    }
    wages += BigInt(row.earnedCents)
    if (wages > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('pa_withholding_wages_overflow')
    lines.push({ day: row.day, taxableWagesCents: row.earnedCents, sourceRole: role })
  }
  // 3.07% = 307/10000. Round the aggregate payroll-period tax once, half up.
  const withholding = Number((wages * 307n + 5000n) / 10000n)
  const unresolved = holds.size > 0
  return {
    state: 'PA' as const,
    payDate,
    from, through,
    source,
    taxableWagesCents: Number(wages),
    withholdingCents: unresolved ? null : withholding,
    reportWagesCents: Number(wages),
    determination: unresolved ? 'unresolved' as const : 'calculated-preview' as const,
    holds: [...holds],
    lines,
    explanation:
      'State-only earnings allocation preview: PA ordinary taxable compensation at 3.07%, aggregated and rounded once for one payroll period. ' +
      'PA resident wages remain in the PA base independently of an NJ-165 election concerning NJ withholding. ' +
      'Taxable/report wages are candidate pre-exemption amounts when unresolved, not a completed W-2 or return. ' +
      'The caller must supply the actual pay date, complete income and PA-specific benefit/exclusion treatment, current signed data, and all source allocations. ' +
      'Federal wage exclusions do not establish PA exclusions; reimbursements, fringe benefits, retirement contributions, deferred compensation and special statutory exemptions require separate PA taxability treatment: ' +
      compensationSource + '. Local EIT/LST, foreign credits, federal taxes, other assessments, deductions, full payroll and net pay remain uncomputed.',
  }
}
