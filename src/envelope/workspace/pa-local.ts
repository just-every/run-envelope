/** Narrow 2026 ordinary-cash preview: Pittsburgh City / Pittsburgh School District only. */
export const pittsburghSources = {
  edition: 'DCED official register, June 15, 2026; Pittsburgh 2026 LS-1',
  register: 'https://apps.dced.pa.gov/munstats-public/ReportToPdf.aspx?report=EitWithCollector_Dyn_Excel&paramList=O;2026',
  city: 'https://www.pittsburghpa.gov/City-Government/Finance-Budget/Taxes',
  employers: 'https://dced.pa.gov/local-government/local-income-tax-information/instructions-employers/',
  outsidePA: 'https://dced.pa.gov/local-government/local-income-tax-information/local-withholding-tax-faqs/',
  lst: 'https://dced.pa.gov/local-government/local-income-tax-information/local-services-tax/',
  ls2026: 'https://www.pittsburghpa.gov/files/assets/city/v/1/finance/documents/tax-forms/ls-2026-fillable.pdf',
  certificate: 'https://www.pittsburghpa.gov/files/assets/city/v/1/finance/documents/tax-forms/ls-tax-exemption-certificate-2026.pdf',
  regulations: 'https://www.pittsburghpa.gov/files/assets/city/v/1/finance/documents/tax-forms/9624_local_services_tax_regulations.pdf',
} as const

export interface PittsburghLocalInput {
  payDate: string
  periodStart: string
  periodEnd: string
  ordinaryCashOnly: boolean
  foreignTaxCreditClaim: boolean
  eitCentRounding: 'nearest-half-up' | 'unknown'
  eitRoundingEvidenceRef: string
  employerState: 'NJ' | 'PA' | 'unknown'
  courtesyWithholding: 'elected' | 'declined' | 'unknown'
  courtesyElectionRef: string
  source: {
    edition: string
    evidenceRef: string
    verifiedOn: string
    effectiveFrom: string
    effectiveThrough: string
    psd: string
    municipality: string
    schoolDistrict: string
    schoolDistrictId: string
    residentCityBps: number
    residentSchoolBps: number
    nonresidentBps: number
    lstAnnualCents: number
    lstSchoolCents: number
    lstLowIncomeCents: number
  } | null
  /** Split on residence/worksite changes, using already allocated PA-taxable cash cents. */
  days: {
    day: string
    sourceId: string
    ordinaryCashCents: number
    residentState: 'NJ' | 'PA' | 'unknown'
    residencePsd: string
    residenceSchoolDistrict: string
    residencyCertificationRef: string
    physicalWorkState: 'NJ' | 'PA' | 'unknown'
    workPsd: string
    site: 'home-office' | 'employer-worksite' | 'outside-PA' | 'unknown'
    physicalWorkEvidenceRef: string
  }[]
  lst: {
    payrollPeriodsPerYear: number
    principalEmployer: 'this' | 'other' | 'unknown'
    principalWorkPsd: string
    principalEmploymentEvidenceRef: string
    /** Before this payroll period, all PA employers/municipalities combined. */
    priorCollectedCents: number | null
    priorCollectionEvidenceRef: string
    /** Already collected within this period, all employers combined. */
    periodCollectedCents: number | null
    periodCollectionEvidenceRef: string
    employerPittsburghYtdCents: number | null
    ytdEvidenceRef: string
    midyearEntry: boolean
    /** Only periods missed because of an exemption, excluding current period. */
    exemptionCatchupPeriods: number | null
    catchupEvidenceRef: string
    restorationNoticeRef: string
    exemption: {
      year: number
      reason: 'low-income' | 'multiple-employers' | 'active-duty' | 'military-disability'
      certificateRef: string
      supportingEvidenceRef: string
      filedWithEmployer: boolean
      filedWithCity: boolean
      currentEligibility: boolean
      expectedPittsburghAnnualCents: number | null
      /** Multiple employers: current principal pay statement including period and LST. */
      principalPayStatementRef: string
      principalEmployeeStatementRef: string
      principalPeriodLstCents: number | null
    } | null
  } | null
}

export interface PittsburghLocalResult {
  eitCents: number | null
  /** Gross local liability before any unsupported foreign-tax credit. */
  eitLiabilityCents: number | null
  eitExact: { numerator: bigint; denominator: bigint } | null
  lstCents: number | null
  holds: { code: string; reason: string }[]
  detail: string[]
  provenance: { sources: typeof pittsburghSources; evidenceRef: string | null; verifiedOn: string | null }
}
const money = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const ref = (s: unknown) => typeof s === 'string' && s.trim().length > 0
const date = (s: string) => /^2026-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s

export function pittsburghLocal(input: PittsburghLocalInput): PittsburghLocalResult {
  const s = input.source, l = input.lst
  const out: PittsburghLocalResult = { eitCents: null, eitLiabilityCents: null, eitExact: null, lstCents: null,
    holds: [], detail: [], provenance: { sources: pittsburghSources,
      evidenceRef: s?.evidenceRef ?? null, verifiedOn: s?.verifiedOn ?? null } }
  const hold = (code: string, reason: string) => out.holds.push({ code, reason })
  if (!date(input.payDate) || !date(input.periodStart) || !date(input.periodEnd) ||
      input.periodStart > input.periodEnd || input.payDate < input.periodEnd ||
      !input.ordinaryCashOnly || !input.days.length) {
    hold('pa-local-input-review', 'Only certified 2026 ordinary cash payroll periods are supported.'); return out
  }
  if (!s || !ref(s.evidenceRef) || !ref(s.edition) || !date(s.verifiedOn) || s.verifiedOn > new Date().toISOString().slice(0,10) ||
      !date(s.effectiveFrom) || !date(s.effectiveThrough) || s.effectiveFrom > input.periodStart ||
      s.effectiveThrough < input.payDate || s.psd !== '700102' || s.municipality !== 'PITTSBURGH CITY' ||
      s.schoolDistrict !== 'PITTSBURGH S D' || s.schoolDistrictId !== '027451' ||
      s.residentCityBps !== 100 || s.residentSchoolBps !== 200 || s.nonresidentBps !== 100 ||
      s.lstAnnualCents !== 5200 || s.lstSchoolCents !== 0 || s.lstLowIncomeCents !== 1200000) {
    hold('pa-local-source-required', 'Current effective certified Pittsburgh DCED row and source provenance are required.'); return out
  }
  let eit = 0n, liability = 0n, eitKnown = true, physicalPittsburgh = false
  const seen = new Set<string>()
  for (const d of input.days) {
    if (!date(d.day) || d.day < input.periodStart || d.day > input.periodEnd || !ref(d.sourceId) || seen.has(d.sourceId) ||
        !money(d.ordinaryCashCents) || !ref(d.residencyCertificationRef) || !ref(d.physicalWorkEvidenceRef)) {
      hold('pa-local-day-certification-required', 'Each allocated source needs unique identity and dated residency, physical work and ordinary-cash proof.'); return out
    }
    seen.add(d.sourceId)
    const resident = d.residentState === 'PA' && d.residencePsd === '700102' && d.residenceSchoolDistrict === 'PITTSBURGH S D'
    const nj = d.residentState === 'NJ' && d.residencePsd === '880000'
    const inCity = d.physicalWorkState === 'PA' && d.workPsd === '700102' &&
      (d.site === 'home-office' || d.site === 'employer-worksite')
    const outside = d.physicalWorkState === 'NJ' && d.workPsd === '880000' && d.site === 'outside-PA'
    if ((!resident && !nj) || (!inCity && !outside)) {
      hold('pa-local-jurisdiction-review', `${d.day}: jurisdiction outside verified Pittsburgh/NJ scenario.`); return out
    }
    physicalPittsburgh ||= inCity
    const tax = BigInt(d.ordinaryCashCents) * BigInt(resident ? 300 : inCity ? 100 : 0)
    liability += tax
    if (resident && outside) {
      if (input.employerState !== 'NJ' || input.courtesyWithholding === 'unknown' || !ref(input.courtesyElectionRef)) {
        eitKnown = false; hold('pa-eit-courtesy-election-required', `${d.day}: NJ physical work requires documented NJ-employer courtesy election; PA-employer out-of-state scope needs separate determination.`)
      } else if (input.courtesyWithholding === 'elected') eit += tax
      else out.detail.push(`${d.day}: courtesy EIT declined; resident quarterly estimated-payment responsibility remains.`)
    } else eit += tax
  }
  const rounded = (n: bigint) => Number((n + 5000n) / 10000n)
  const scopeKnown = eitKnown && !input.foreignTaxCreditClaim
  const roundingKnown = (eit % 10000n === 0n && liability % 10000n === 0n) ||
    (input.eitCentRounding === 'nearest-half-up' && ref(input.eitRoundingEvidenceRef))
  if (roundingKnown) out.eitLiabilityCents = rounded(liability)
  else { eitKnown = false; hold('pa-eit-rounding-determination-required', 'Fractional-cent EIT requires a documented cent-rounding determination; exact fraction preserved.') }
  if (input.foreignTaxCreditClaim) { eitKnown = false; hold('pa-eit-credit-review', 'Foreign/NY tax credits are outside this verified withholding scope.') }
  out.eitExact = scopeKnown ? { numerator: eit, denominator: 10000n } : null
  if (eitKnown) out.eitCents = rounded(eit)
  out.detail.push('EIT: Pittsburgh resident 3% (1% city + 2% school), NJ resident Pittsburgh work 1%; aggregate exact cents × basis points, round once. State reciprocity does not exempt local EIT.')
  if (!l || !ref(l.principalEmploymentEvidenceRef) || l.principalEmployer === 'unknown' ||
      !money(l.priorCollectedCents) || !money(l.periodCollectedCents) ||
      !ref(l.priorCollectionEvidenceRef) || !ref(l.periodCollectionEvidenceRef)) {
    hold('pa-lst-principal-and-prior-proof-required', 'Principal worksite/employer and all-employer prior/current-period LST proof are required.'); return out
  }
  if (l.priorCollectedCents + l.periodCollectedCents > 5200) {
    hold('pa-lst-overcollection-review', 'Certified all-employer LST exceeds Pittsburgh annual cap; review refund/correction.'); return out
  }
  if (!physicalPittsburgh && l.principalWorkPsd === '880000') { out.lstCents = 0; return out }
  if (!money(l.payrollPeriodsPerYear) || l.payrollPeriodsPerYear < 1 ||
      !money(l.employerPittsburghYtdCents) || !ref(l.ytdEvidenceRef)) {
    hold('pa-lst-payroll-proof-required', 'Established annual payroll count and Pittsburgh YTD earnings proof required.'); return out
  }
  const c = l.exemption
  if (c && (c.year !== 2026 || !['low-income', 'multiple-employers', 'active-duty', 'military-disability'].includes(c.reason) ||
      !ref(c.certificateRef) || !ref(c.supportingEvidenceRef) ||
      !c.filedWithEmployer || !c.filedWithCity)) {
    hold('pa-lst-exemption-certificate-required', 'Annual signed exemption, supporting documents and employer/city filing proof required.'); return out
  }
  if (l.principalEmployer === 'other') {
    if (c?.reason === 'multiple-employers' && c.currentEligibility && ref(c.principalPayStatementRef) &&
        ref(c.principalEmployeeStatementRef) && money(c.principalPeriodLstCents) && c.principalPeriodLstCents > 0 &&
        c.principalPeriodLstCents <= l.periodCollectedCents) out.lstCents = 0
    else hold('pa-lst-multiple-employer-proof-required', 'Current principal-employer pay statement with LST/period and employee statement required.')
    return out
  }
  if (!physicalPittsburgh || l.principalWorkPsd !== '700102') {
    hold('pa-lst-principal-jurisdiction-review', 'Principal LST situs/physical work is outside verified Pittsburgh scope.'); return out
  }
  let restore = false
  if (c) {
    if (c.reason === 'multiple-employers') {
      hold('pa-lst-principal-conflict', 'Multiple-employer exemption conflicts with this employer being principal.'); return out
    }
    restore = !c.currentEligibility || ref(l.restorationNoticeRef) ||
      (c.reason === 'low-income' && l.employerPittsburghYtdCents >= s.lstLowIncomeCents)
    if (!restore) {
      if (c.reason !== 'low-income' || (money(c.expectedPittsburghAnnualCents) && c.expectedPittsburghAnnualCents < s.lstLowIncomeCents)) out.lstCents = 0
      else hold('pa-lst-low-income-certification-review', 'Certified expected Pittsburgh income must be below $12,000.')
      return out
    }
  }
  if (l.midyearEntry) {
    hold('pa-lst-midyear-determination-required', 'City legacy midyear recovery examples conflict with ordinary period installments; obtain a current collector determination.'); return out
  }
  if (!money(l.exemptionCatchupPeriods) || (l.exemptionCatchupPeriods > 0 && (!restore || !ref(l.catchupEvidenceRef)))) {
    hold('pa-lst-catchup-proof-required', 'Certify missed exemption installments and restoration basis; no invented arrears.'); return out
  }
  const installment = 5200n / BigInt(l.payrollPeriodsPerYear)
  const due = installment * BigInt(restore ? l.exemptionCatchupPeriods + 1 : 1) - BigInt(l.periodCollectedCents)
  const cap = 5200n - BigInt(l.priorCollectedCents) - BigInt(l.periodCollectedCents)
  out.lstCents = Number(due <= 0n || cap <= 0n ? 0n : due < cap ? due : cap)
  out.detail.push(`LST PGH: floor(5200 / ${l.payrollPeriodsPerYear}) = ${installment} cents per period; all-employer annual cap 5200 cents; no year-end rounding top-up.`)
  return out
}
