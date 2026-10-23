import type { FederalSource, FederalW4, PayPeriods, TaxYear } from './types'

// IRS Publication 15-T, section 1: column A, column C and column D.
// Dollar amounts are converted to integer cents before any arithmetic.
type Row = readonly [floorDollars: number, baseDollars: number, percent: number]
type Schedule = Record<'single' | 'married_joint' | 'head_household', readonly Row[]>
const schedules: Record<TaxYear, { standard: Schedule; step2: Schedule }> = {
  2025: {
    standard: {
      single: [[0,0,0],[6400,0,10],[18325,1192.5,12],[54875,5578.5,22],[109750,17651,24],[203700,40199,32],[256925,57231,35],[632750,188769.75,37]],
      married_joint: [[0,0,0],[17100,0,10],[40950,2385,12],[114050,11157,22],[223800,35302,24],[411700,80398,32],[518150,114462,35],[768700,202154.5,37]],
      head_household: [[0,0,0],[13900,0,10],[30900,1700,12],[78750,7442,22],[117250,15912,24],[211200,38460,32],[264400,55484,35],[640250,187031.5,37]],
    },
    step2: {
      single: [[0,0,0],[7500,0,10],[13463,596.25,12],[31738,2789.25,22],[59175,8825.5,24],[106150,20099.5,32],[132763,28615.5,35],[320675,94384.88,37]],
      married_joint: [[0,0,0],[15000,0,10],[26925,1192.5,12],[63475,5578.5,22],[118350,17651,24],[212300,40199,32],[265525,57231,35],[390800,101077.25,37]],
      head_household: [[0,0,0],[11250,0,10],[19750,850,12],[43675,3721,22],[62925,7956,24],[109900,19230,32],[136500,27742,35],[324425,93515.75,37]],
    },
  },
  2026: {
    standard: {
      single: [[0,0,0],[7500,0,10],[19900,1240,12],[57900,5800,22],[113200,17966,24],[209275,41024,32],[263725,58448,35],[648100,192979.25,37]],
      married_joint: [[0,0,0],[19300,0,10],[44100,2480,12],[120100,11600,22],[230700,35932,24],[422850,82048,32],[531750,116896,35],[788000,206583.5,37]],
      head_household: [[0,0,0],[15550,0,10],[33250,1770,12],[83000,7740,22],[121250,16155,24],[217300,39207,32],[271750,56631,35],[656150,191171,37]],
    },
    step2: {
      single: [[0,0,0],[8050,0,10],[14250,620,12],[33250,2900,22],[60900,8983,24],[108938,20512,32],[136163,29224,35],[328350,96489.63,37]],
      married_joint: [[0,0,0],[16100,0,10],[28500,1240,12],[66500,5800,22],[121800,17966,24],[217875,41024,32],[272325,58448,35],[400450,103291.75,37]],
      head_household: [[0,0,0],[12075,0,10],[20925,885,12],[45800,3870,22],[64925,8077.5,24],[112950,19603.5,32],[140175,28315.5,35],[332375,95585.5,37]],
    },
  },
}

const nraAdds: Record<TaxYear, Record<'modern' | 'legacy', Record<PayPeriods, number>>> = {
  2025: {
    modern: { 1:1500000,2:750000,4:375000,12:125000,24:62500,26:57690,52:28850,260:5770 },
    legacy: { 1:1070000,2:535000,4:267500,12:89170,24:44580,26:41150,52:20580,260:4120 },
  },
  2026: {
    modern: { 1:1610000,2:805000,4:402500,12:134170,24:67080,26:61920,52:30960,260:6190 },
    legacy: { 1:1180000,2:590000,4:295000,12:98330,24:49170,26:45380,52:22690,260:4540 },
  },
}

export function withholdingSource(year: TaxYear): FederalSource {
  return { id: `irs-p15t-${year}`, title: `IRS Publication 15-T (${year})`,
    url: year === 2025 ? 'https://www.irs.gov/pub/irs-prior/p15t--2025.pdf' : 'https://www.irs.gov/pub/irs-pdf/p15t.pdf',
    section: 'Worksheet 1A; annual automated percentage tables; nonresident Tables 1 and 2' }
}

export function validCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
export function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('industry_calculation_overflow')
  return Number(value)
}
export function roundRatio(numerator: bigint, denominator: bigint): number {
  if (numerator < 0n || denominator <= 0n) throw new Error('invalid_industry_rounding')
  return safeNumber((numerator + denominator / 2n) / denominator)
}

export function validateW4(w4: FederalW4): void {
  if (!w4 || typeof w4 !== 'object') throw new Error('missing_federal_w4')
  if (w4.version === '2020_or_later') {
    if (!['single','married_joint','head_household'].includes(w4.filingStatus) ||
        typeof w4.step2Checked !== 'boolean' ||
        ![w4.step3AnnualCreditsCents,w4.step4aOtherIncomeCents,w4.step4bDeductionsCents,w4.step4cExtraWithholdingCents].every(validCents))
      throw new Error('invalid_modern_federal_w4')
  } else if (w4.version === '2019_or_earlier') {
    if (!['single','married_joint'].includes(w4.filingStatus) || !validCents(w4.allowances) ||
        !validCents(w4.extraWithholdingCents) || w4.firstPaidBefore2020 !== true)
      throw new Error('invalid_legacy_federal_w4')
  } else throw new Error('unsupported_federal_w4')
  if ('exempt' in w4 || 'treaty' in w4 || 'lockIn' in w4)
    throw new Error('separate_documented_withholding_authority_required')
}

/** Regular periodic cash wages only; no supplemental flat-rate election or treaty inference. */
export function federalIncomeTax(input: {
  taxYear: TaxYear; taxableWagesCents: number; periodsPerYear: PayPeriods;
  w4: FederalW4; nonresidentAdjustment: boolean
}) {
  const { taxYear, taxableWagesCents, periodsPerYear, w4 } = input
  validateW4(w4)
  if (![2025,2026].includes(taxYear) || !validCents(taxableWagesCents) ||
      ![1,2,4,12,24,26,52,260].includes(periodsPerYear) || typeof input.nonresidentAdjustment !== 'boolean')
    throw new Error('invalid_federal_withholding_input')
  if (input.nonresidentAdjustment && w4.filingStatus !== 'single')
    throw new Error('nonresident_w4_requires_single_status')
  const modern = w4.version === '2020_or_later'
  const nonresidentAdjustmentCents = input.nonresidentAdjustment ? nraAdds[taxYear][modern ? 'modern' : 'legacy'][periodsPerYear] : 0
  let annual = (BigInt(taxableWagesCents) + BigInt(nonresidentAdjustmentCents)) * BigInt(periodsPerYear)
  if (modern) {
    const adjustment = w4.step2Checked ? 0 : w4.filingStatus === 'married_joint' ? 1290000 : 860000
    annual += BigInt(w4.step4aOtherIncomeCents) - BigInt(w4.step4bDeductionsCents) - BigInt(adjustment)
  } else annual -= BigInt(w4.allowances) * 430000n
  if (annual < 0n) annual = 0n
  const table = schedules[taxYear][modern && w4.step2Checked ? 'step2' : 'standard'][w4.filingStatus]
  const row = [...table].reverse().find(([floor]) => annual >= BigInt(Math.round(floor * 100)))!
  // Keep hundredths of a cent through annualization, credits and division.
  const annualTaxHundredths = BigInt(Math.round(row[1] * 100)) * 100n +
    (annual - BigInt(Math.round(row[0] * 100))) * BigInt(row[2])
  const afterCredits = annualTaxHundredths - (modern ? BigInt(w4.step3AnnualCreditsCents) * 100n : 0n)
  const extra = modern ? w4.step4cExtraWithholdingCents : w4.extraWithholdingCents
  return {
    incomeTaxCents: safeNumber(BigInt(roundRatio(afterCredits > 0n ? afterCredits : 0n, BigInt(periodsPerYear) * 100n)) + BigInt(extra)),
    adjustedAnnualWagesCents: safeNumber(annual), nonresidentAdjustmentCents,
    sourceId: withholdingSource(taxYear).id,
  }
}
