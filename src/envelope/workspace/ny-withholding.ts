/** NYS-50-T-NYS (1/26), pp.14,16-19,22; ordinary regular wages only.
 * https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf
 * Method II uses the published period tables (including benefit recapture bands),
 * not an annual-table approximation. Method III annualizes net period wages.
 * For an eligible nonresident, caller allocates wages under IT-2104.1 BEFORE
 * calling; do not prorate the resulting withholding. No NYC/Yonkers calculation,
 * resident other-state withholding reduction, supplemental wages or exemption claim.
 */
export interface NyWithholdingInput {
  taxableWagesCents: number
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  payDate: string
  /** Explicit IT-2104 election; marital status alone does not choose the table. */
  filingStatus: 'single' | 'head-of-household' | 'married' | 'married-withhold-single'
  /** Signed allowances are accepted under IT-2104-I's negative-allowance instructions. */
  allowances: number
  /** Exact additional NYS withholding elected per pay period, IT-2104 line 3. */
  additionalCents: number
}
type Frequency = NyWithholdingInput['frequency']
/** Column 3 dollars; column 4 basis points; column 5 cents. */
type Row = readonly [subtractDollars: number, rateBasisPoints: number, baseCents: number]
const source = 'https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf'
const periods: Record<Frequency, number> = {weekly:52,biweekly:26,semimonthly:24,monthly:12}
// Page 14, tables B and C: published period allowances, already rounded by NYS.
const allowancesByPeriod: Record<Frequency, {single:number; married:number; exemption:number}> = {
  weekly:{single:14230,married:15290,exemption:1925},
  biweekly:{single:28460,married:30580,exemption:3850},
  semimonthly:{single:30835,married:33125,exemption:4165},
  monthly:{single:61670,married:66250,exemption:8330},
}
// First five lines are identical for both filing-status tables on pp.17 and 19.
const shared: Record<Frequency, readonly Row[]> = {
  weekly:[[0,390,0],[163,440,638],[225,515,908],[267,540,1127],[1551,590,8058]],
  biweekly:[[0,390,0],[327,440,1277],[450,515,1815],[535,540,2254],[3102,590,16115]],
  semimonthly:[[0,390,0],[354,440,1383],[488,515,1967],[579,540,2442],[3360,590,17458]],
  monthly:[[0,390,0],[708,440,2767],[975,515,3933],[1158,540,4883],[6721,590,34917]],
}
const single: Record<Frequency, readonly Row[]> = {
  weekly:[[1862,703,9890],[2070,753,11358],[3032,640,18602],[4142,1144,25710],[5104,735,36713]],
  biweekly:[[3723,703,19781],[4140,753,22715],[6063,640,37204],[8285,1144,51419],[10208,735,73427]],
  semimonthly:[[4033,703,21429],[4485,753,24608],[6569,640,40304],[8975,1144,55704],[11058,735,79546]],
  monthly:[[8067,703,42858],[8971,753,49217],[13138,640,80608],[17950,1144,111408],[22117,735,159092]],
}
const married: Record<Frequency, readonly Row[]> = {
  weekly:[[1862,657,9890],[2070,707,11260],[3032,801,18054],[4068,640,26362],[6215,1349,40104],[7177,735,53077],[20722,765,152633]],
  biweekly:[[3723,657,19781],[4140,707,22519],[6063,801,36108],[8137,640,52723],[12431,1349,80208],[14354,735,106154],[41444,765,305265]],
  semimonthly:[[4033,657,21429],[4485,707,24396],[6569,801,39117],[8815,640,57117],[13467,1349,86892],[15550,735,115000],[44898,765,330704]],
  monthly:[[8067,657,42858],[8971,707,48792],[13138,801,78233],[17629,640,114233],[26933,1349,173783],[31100,735,230000],[89796,765,661408]],
}
function reject(code: string): never { throw new Error(code) }
function safeNumber(value: bigint) {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) reject('ny_withholding_amount_out_of_range')
  return number
}
/** Exact half-cent-up rounding of a nonnegative rational cent amount.
 * Consistent with Method II worked examples, pp.16/18: round the product to
 * cents, then add the cent-denominated base. No wage/allowance dollar rounding.
 */
const roundCents = (numerator: bigint, denominator: bigint) =>
  (2n * numerator + denominator) / (2n * denominator)

export function nyWithholding(input: NyWithholdingInput) {
  if (!input || typeof input !== 'object') reject('ny_withholding_election_required')
  const {taxableWagesCents,frequency,payDate,filingStatus,allowances,additionalCents} = input
  if (!Object.hasOwn(periods,frequency)) reject('ny_withholding_frequency_unsupported')
  if (typeof payDate !== 'string' || !/^2026-\d\d-\d\d$/.test(payDate) ||
      !Number.isFinite(Date.parse(payDate + 'T00:00:00Z')) ||
      new Date(payDate + 'T00:00:00Z').toISOString().slice(0,10) !== payDate)
    reject('ny_withholding_edition_unsupported')
  if (!['single','head-of-household','married','married-withhold-single'].includes(filingStatus) ||
      !Number.isSafeInteger(allowances) || !Number.isSafeInteger(additionalCents) || additionalCents < 0)
    reject('ny_withholding_election_required')
  if (!Number.isSafeInteger(taxableWagesCents) || taxableWagesCents < 0)
    reject('ny_withholding_wages_invalid')
  const status = filingStatus === 'married' ? 'married' : 'single'
  const deduction = BigInt(allowancesByPeriod[frequency][status])
  const exemption = BigInt(allowances) * BigInt(allowancesByPeriod[frequency].exemption)
  const adjusted = BigInt(taxableWagesCents) - deduction - exemption
  const net = adjusted > 0n ? adjusted : 0n
  const annualized = net * BigInt(periods[frequency])
  const topThreshold = BigInt(status === 'single' ? 1077550 : 2155350) * 100n
  let method: 'II' | 'III' = 'II', line = 1, subtract = 0n, base = 0n, rate = 390
  if (annualized >= topThreshold) {
    method = 'III'
    // Page 22's three full-net-wage rates; no marginal deduction/base.
    if (annualized >= 25000000n * 100n) { rate = 1170; line = 3 }
    else if (annualized >= 5000000n * 100n) { rate = 1110; line = 2 }
    else { rate = 1045; line = 1 }
  } else {
    const rows = [...shared[frequency],...(status === 'single' ? single : married)[frequency]]
    for (let i = rows.length - 1; i >= 0; i--) {
      if (net >= BigInt(rows[i][0]) * 100n) {
        subtract = BigInt(rows[i][0]) * 100n
        rate = rows[i][1]; base = BigInt(rows[i][2]); line = i + 1
        break
      }
    }
    // The annualized Method III threshold in the p.16/18 instructions controls
    // the few-cent differences from rounded period-table transition labels.
  }
  const productNumerator = (net - subtract) * BigInt(rate)
  const ordinary = roundCents(productNumerator,10000n) + base
  const withholding = ordinary + BigInt(additionalCents)
  return {
    state: 'NY' as const, source, taxableWagesCents,
    withholdingCents: safeNumber(withholding),
    calculation: {
      edition:'2026',method,tableStatus:status,frequency,payDate,periodsPerYear:periods[frequency],
      tablePage:method === 'III' ? 22 : status === 'single' ? 17 : 19,tableLine:line,
      deductionAllowanceCents:safeNumber(deduction),exemptionAllowanceCents:safeNumber(exemption),
      allowances,netWagesAfterAllowancesCents:safeNumber(net),annualizedNetWagesCents:annualized.toString(),
      subtractCents:safeNumber(subtract),rateBasisPoints:rate,baseCents:safeNumber(base),
      productNumeratorCents:productNumerator.toString(),productDenominator:'10000',
      ordinaryWithholdingCents:safeNumber(ordinary),additionalCents,
      rounding:'Nearest cent, half-cent up, on the rate product; add the published base and elected additional cents.',
    },
    explanation:`NYS-50-T-NYS (1/26), Method ${method}, ${status}, ${frequency}, line ${line}; ` +
      'subtract published period deduction and elected allowance amounts from already allocated NY taxable regular wages. ' +
      (method === 'III' ? 'Annualized net wages choose the full-net-wage top rate. ' : 'Use the published period table, including its recapture bands. ') +
      'Round the exact rate product to cents, add the published base, then add IT-2104 line 3. ' +
      'This result excludes NYC/Yonkers, supplemental wages, and any resident reduction for required other-state withholding.',
  }
}
