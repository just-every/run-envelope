type Frequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
type Table = 'A' | 'B' | 'C' | 'D' | 'E'
export interface NjWithholdingInput {
  taxableWagesCents: number
  frequency: Frequency
  payDate: string
  /** Resolved NJ-W4 table: line 3 election, otherwise A for boxes 1/3, B for 2/4/5. */
  table: Table
  allowances: number
  additionalCents: number
}
const source = {
  id: 'nj-wt-2025-09-percentage-2020-10-01-reviewed-2026-10-23',
  title: 'NJ-WT September 2025, pp.10,24-25; linked percentage rate tables, pp.1-4',
  url: 'https://www.nj.gov/treasury/taxation/pdf/current/njwt.pdf',
  tablesUrl: 'https://www.nj.gov/treasury/taxation/pdf/withholdingtables.pdf',
  retrievedAt: '2026-10-23',
  rateEffectiveFrom: '2020-10-01',
  effectiveFrom: '2026-01-01',
  effectiveThrough: '2026-12-31',
  rounding: 'Preserve wage cents; nearest tax cent as in NJ-WT examples; exact half-cent ties unresolved.',
} as const
// Printed per-period constants, not scaled annual rates or continuous reconstructed brackets.
const allowanceCents: Record<Frequency, number> = {
  weekly: 1920, biweekly: 3840, semimonthly: 4160, monthly: 8330,
}
type Schedule = { overDollars: number[]; baseCents: number[] }
const aBreaks: Record<Frequency, number[]> = {
  weekly: [0, 385, 673, 769, 1442, 9615, 19231],
  biweekly: [0, 769, 1346, 1538, 2885, 19231, 38462],
  semimonthly: [0, 833, 1458, 1667, 3125, 20833, 41667],
  monthly: [0, 1667, 2917, 3333, 6250, 41667, 83333],
}
const bBreaks: Record<Frequency, number[]> = {
  weekly: [0, 385, 962, 1346, 1538, 2885, 9615, 19231],
  biweekly: [0, 769, 1923, 2692, 3077, 5769, 19231, 38462],
  semimonthly: [0, 833, 2083, 2917, 3333, 6250, 20833, 41667],
  monthly: [0, 1667, 4167, 5833, 6667, 12500, 41667, 83333],
}
const cdBreaks: Record<Frequency, number[]> = {
  weekly: [0, 385, 769, 962, 1154, 2885, 9615, 19231],
  biweekly: [0, 769, 1538, 1923, 2308, 5769, 19231, 38462],
  semimonthly: [0, 833, 1667, 2083, 2500, 6250, 20833, 41667],
  monthly: [0, 1667, 3333, 4167, 5000, 12500, 41667, 83333],
}
const eBreaks: Record<Frequency, number[]> = {
  weekly: [0, 385, 673, 1923, 9615, 19231],
  biweekly: [0, 769, 1346, 3846, 19231, 38462],
  semimonthly: [0, 833, 1458, 4167, 20833, 41667],
  monthly: [0, 1667, 2917, 8333, 41667, 83333],
}
const rates: Record<Table, number[]> = {
  A: [15, 20, 39, 61, 70, 99, 118],
  B: [15, 20, 27, 39, 61, 70, 99, 118],
  C: [15, 23, 28, 35, 56, 66, 99, 118],
  D: [15, 27, 34, 43, 56, 65, 99, 118],
  E: [15, 20, 58, 65, 99, 118],
}
const bases: Record<Table, Record<Frequency, number[]>> = {
  A: {
    weekly: [0, 577, 1154, 1529, 5635, 62846, 158038],
    biweekly: [0, 1200, 2300, 3100, 11300, 125700, 316100],
    semimonthly: [0, 1300, 2500, 3300, 12200, 136200, 342400],
    monthly: [0, 2500, 5000, 6600, 24400, 272300, 684800],
  },
  B: {
    weekly: [0, 577, 1731, 2769, 3519, 11731, 58846, 154038],
    biweekly: [0, 1200, 3500, 5500, 7000, 23500, 117700, 308100],
    semimonthly: [0, 1250, 3750, 5999, 7625, 25419, 127500, 333800],
    monthly: [0, 2500, 7500, 12000, 15300, 50800, 255000, 667500],
  },
  C: {
    weekly: [0, 577, 1462, 2000, 2673, 12365, 56788, 151981],
    biweekly: [0, 1154, 2923, 4000, 5346, 24731, 113577, 303962],
    semimonthly: [0, 1250, 3167, 4333, 5792, 26792, 123042, 329292],
    monthly: [0, 2500, 6333, 8667, 11583, 53585, 246083, 658583],
  },
  D: {
    weekly: [0, 577, 1615, 2269, 3096, 12788, 56538, 151731],
    biweekly: [0, 1154, 3231, 4538, 6192, 25577, 113077, 303462],
    semimonthly: [0, 1250, 3500, 4917, 6708, 27708, 122500, 328750],
    monthly: [0, 2500, 7000, 9833, 13417, 55417, 245000, 657500],
  },
  E: {
    weekly: [0, 577, 1154, 8404, 58404, 153596],
    biweekly: [0, 1200, 2300, 16800, 116800, 307200],
    semimonthly: [0, 1300, 2500, 18200, 126500, 332800],
    monthly: [0, 2500, 5000, 36400, 253100, 665600],
  },
}
const breaks: Record<Table, Record<Frequency, number[]>> = {
  A: aBreaks, B: bBreaks, C: cdBreaks, D: cdBreaks, E: eBreaks,
}
const exactNonnegative = (n: number) => Number.isSafeInteger(n) && n >= 0
/** One ordinary regular-wage payment, after caller-resolved NJ taxability/sourcing.
 * No exemption, signed-custody validation, foreign-withholding reduction or net pay.
 * No defaults: table, allowances and additional amount must come from actual elections.
 */
export function njWithholding(input: NjWithholdingInput) {
  if (!input || !exactNonnegative(input.taxableWagesCents) ||
      !exactNonnegative(input.allowances) || !exactNonnegative(input.additionalCents) ||
      !Object.hasOwn(allowanceCents, input.frequency) || !Object.hasOwn(bases, input.table))
    throw new Error('invalid_nj_regular_withholding_inputs')
  const { taxableWagesCents, frequency, payDate, table, allowances, additionalCents } = input
  if (typeof payDate !== 'string' || !/^2026-\d{2}-\d{2}$/.test(payDate) ||
      !Number.isFinite(Date.parse(payDate + 'T00:00:00Z')) ||
      new Date(payDate + 'T00:00:00Z').toISOString().slice(0, 10) !== payDate)
    throw new Error('nj_withholding_requires_valid_2026_pay_date')
  const allowance = BigInt(allowances) * BigInt(allowanceCents[frequency])
  const subject = BigInt(taxableWagesCents) > allowance ? BigInt(taxableWagesCents) - allowance : 0n
  // E monthly literally ends its second bracket at $2,916 and starts the next OVER $2,917.
  if (table === 'E' && frequency === 'monthly' && subject > 291600n && subject <= 291700n)
    throw new Error('nj_official_table_e_monthly_boundary_gap_unresolved')
  const schedule: Schedule = { overDollars: breaks[table][frequency], baseCents: bases[table][frequency] }
  const index = subject === 0n ? 0 : schedule.overDollars.findIndex((_, i, a) =>
    i === a.length - 1 || subject <= BigInt(a[i + 1]) * 100n)
  const excess = subject - BigInt(schedule.overDollars[index]) * 100n
  const numerator = BigInt(schedule.baseCents[index]) * 1000n + excess * BigInt(rates[table][index])
  // Examples establish nearest-cent results, but provide no exact-half-cent tie policy.
  if (numerator % 1000n === 500n) throw new Error('nj_exact_half_cent_rounding_unresolved')
  const regular = (numerator + 499n) / 1000n
  const total = regular + BigInt(additionalCents)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('nj_withholding_overflow')
  return {
    state: 'NJ' as const, source, taxableWagesCents, withholdingCents: Number(total),
    calculation: {
      payDate, frequency, table, allowances, allowancePerPeriodCents: allowanceCents[frequency],
      allowanceDeductionCents: allowance.toString(), wagesAfterAllowancesCents: Number(subject),
      bracketOverDollars: schedule.overDollars[index], baseCents: schedule.baseCents[index],
      ratePerThousand: rates[table][index], regularWithholdingCents: Number(regular), additionalCents,
      exactTaxCentsNumerator: numerator.toString(), exactTaxCentsDenominator: 1000,
    },
    explanation: 'NJ ordinary regular-wage table calculation only; wage cents are retained (whole-dollar wage rounding is optional under NJ-WT p.24). ' +
      'Uses the linked current rate tables exactly, including printed per-period constants and over/but-not-over boundaries. ' +
      'NJ-WT p.25 contains older weekly example constants; those do not replace the linked operative tables. ' +
      'Caller must establish NJ-specific taxable wages, actual NJ-W4 elections and source allocation, and resolve any required other-jurisdiction withholding reduction under NJ-WT p.10. ' +
      'No exemption, reciprocity, signed custody, supplemental-wage method, other tax, payment authority or net pay is established.',
  }
}
