import { PayrollError, date } from '../security'
import { agencyFormMap, agencyFormSources } from './agency-form-map'

export { agencyFormMap, agencyFormSources } from './agency-form-map'
export interface AgencyCompany {
  ein: string
  legalName: string
  tradeName?: string
  address: { street: string; city: string; state: string; postalCode: string }
}
/** Cash payroll aggregates. Taxes include both shares except FIT and Additional Medicare. */
export interface AgencyTotals {
  incomeTaxWagesCents: number
  incomeTaxWithheldCents: number
  socialSecurityWagesCents: number
  socialSecurityTaxCents: number
  medicareWagesCents: number
  medicareTaxCents: number
  additionalMedicareWagesCents: number
  additionalMedicareTaxCents: number
}
interface Period {
  form: '941' | '943'
  taxYear: number
  quarter?: 1 | 2 | 3 | 4
  company: AgencyCompany
}
export interface AgencyReturnInput extends Period {
  totals: AgencyTotals
  employeeCount: number
  depositsCents: number
  seasonal?: boolean
  /** Actual monthly liability, not deposits; three months for 941, twelve for 943. */
  monthlyLiabilityCents?: number[]
}
export type CorrectionCertification =
  | 'adjust-repaid' | 'adjust-employer-only' | 'adjust-not-withheld'
  | 'claim-repaid' | 'claim-consent' | 'claim-employer-only' | 'claim-not-withheld'
export interface AgencyCorrectionInput extends Period {
  original: AgencyTotals
  corrected: AgencyTotals
  discoveredOn: string
  reason: string
  process: 'adjustment' | 'claim'
  w2FiledOrWillFile: true
  /** These attest to the full printed certification, including prior-year statements. */
  certifications: CorrectionCertification[]
  /** Prior-year withholding corrections must reflect reporting errors, not uncollected tax. */
  priorYearWithholdingAdministrativeError?: true
}
type SourceKey = keyof typeof agencyFormSources
type Fields = Record<string, string>
type Pair = readonly string[]
type CorrectionRow = { corrected: Pair; original: Pair; difference: Pair; taxCorrection?: Pair }
export interface AgencyFormExport {
  format: 'xfdf'
  mediaType: 'application/xfdf'
  filingStatus: 'prepared-not-submitted'
  officialPdfUrl: string
  edition: string
  sourceSha256: string
  fields: Fields
  xml: string
  requiredManualSteps: string[]
}
const page = (n: number) => `topmostSubform[0].Page${n}[0].`
function fail(code = 'invalid_agency_form_input'): never { throw new PayrollError(code) }
function cents(n: number, signed = false) {
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1_000_000_000_000 || (!signed && n < 0)) fail()
  return n
}
function label(s: string, max = 120) {
  if (typeof s !== 'string' || !s.trim() || s.length > max) fail()
  // XML 1.0 fifth edition character repertoire, including rejection of lone surrogates.
  for (const c of s) {
    const n = c.codePointAt(0)!
    if (!(n === 9 || n === 10 || n === 13 || n >= 32 && n <= 0xd7ff || n >= 0xe000 && n <= 0xfffd || n >= 0x10000 && n <= 0x10ffff)) fail()
  }
  return s.trim()
}
function money(fields: Fields, pair: Pair, amount: number) {
  cents(amount, true)
  fields[pair[0]] = `${amount < 0 ? '-' : ''}${Math.floor(Math.abs(amount) / 100)}`
  fields[pair[1]] = String(Math.abs(amount) % 100).padStart(2, '0')
}
/** Exact integer round-half-away-from-zero; a basis-point rate acts on cent amounts. */
function tax(base: number, basisPoints: number) {
  const product = BigInt(base) * BigInt(basisPoints)
  return Number(product < 0n ? -((-product + 5000n) / 10000n) : (product + 5000n) / 10000n)
}
function amounts(t: AgencyTotals) {
  for (const key of ['incomeTaxWagesCents', 'incomeTaxWithheldCents', 'socialSecurityWagesCents', 'socialSecurityTaxCents', 'medicareWagesCents', 'medicareTaxCents', 'additionalMedicareWagesCents', 'additionalMedicareTaxCents'] as const) cents(t[key])
  if (t.additionalMedicareWagesCents > t.medicareWagesCents) fail()
  if (t.socialSecurityWagesCents === 0 && t.socialSecurityTaxCents !== 0 || t.medicareWagesCents === 0 && t.medicareTaxCents !== 0 || t.additionalMedicareWagesCents === 0 && t.additionalMedicareTaxCents !== 0) fail('tax_without_taxable_wages')
  const ss = tax(t.socialSecurityWagesCents, 1240)
  const med = tax(t.medicareWagesCents, 290)
  const additional = tax(t.additionalMedicareWagesCents, 90)
  const fica = ss + med + additional
  // The printed percentage lines use aggregate bases; line 7 (943 line 10) reconciles
  // taxes actually rounded and collected per paycheck, including Additional Medicare.
  const fractions = t.socialSecurityTaxCents + t.medicareTaxCents + t.additionalMedicareTaxCents - fica
  return { ss, med, additional, fica, fractions, before: fica + t.incomeTaxWithheldCents, total: fica + t.incomeTaxWithheldCents + fractions }
}
function originalKey(i: Period): SourceKey {
  if (i.form === '943' && i.taxYear === 2026) fail('final_2026_form_943_not_released')
  if (i.form === '941' && i.taxYear === 2026 && [1, 2, 3, 4].includes(i.quarter!)) return 'f941-2026'
  if (i.form === '943' && i.taxYear === 2025 && i.quarter === undefined) return 'f943-2025'
  return fail('unsupported_agency_form_edition')
}
function entity(fields: Fields, i: Period, key: SourceKey) {
  if (!/^\d{2}-?\d{7}$/.test(i.company.ein)) fail('invalid_employer_ein')
  const ein = i.company.ein.replace('-', '')
  const m = agencyFormMap[key]
  fields[m.EIN_first2_last7[0]] = ein.slice(0, 2)
  fields[m.EIN_first2_last7[1]] = ein.slice(2)
  fields[m.legalName[0]] = label(i.company.legalName)
  const prefix = m.legalName[0].slice(0, m.legalName[0].lastIndexOf('.') + 1)
  const padded = key === 'f943x-2026'
  const field = (n: number) => `${prefix}f1_${padded ? String(n).padStart(2, '0') : n}[0]`
  if (i.company.tradeName) fields[field(4)] = label(i.company.tradeName)
  fields[field(5)] = label(i.company.address.street)
  fields[field(6)] = label(i.company.address.city)
  if (!/^[A-Z]{2}$/.test(i.company.address.state) || !/^\d{5}(-\d{4})?$/.test(i.company.address.postalCode)) fail('invalid_employer_address')
  fields[field(7)] = i.company.address.state
  fields[field(8)] = i.company.address.postalCode
  const correction = key.includes('x-')
  for (let n = 2; n <= (correction ? 5 : 2); n++) {
    const p = page(n)
    fields[`${p}Name_ReadOrder[0].f1_${padded ? '03' : '3'}[0]`] = fields[m.legalName[0]]
    const group = key === 'f941x-2026' ? 'EIN_ReadOrder' : 'EIN_Number'
    fields[`${p}${group}[0].f1_${padded ? '01' : '1'}[0]`] = ein.slice(0, 2)
    fields[`${p}${group}[0].f1_${padded ? '02' : '2'}[0]`] = ein.slice(2)
    if (correction) {
      fields[`${p}f1_12[0]`] = String(i.taxYear)
      if (i.form === '941') fields[`${p}f2_1[0]`] = String(i.quarter)
    }
  }
}
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
function exportData(key: SourceKey, fields: Fields, requiredManualSteps: string[]): AgencyFormExport {
  // XFDF represents a hierarchical AcroForm name by nested field elements.
  interface Node { value?: string; children: Map<string, Node> }
  const root: Node = { children: new Map() }
  for (const [name, value] of Object.entries(fields)) {
    let node = root
    for (const part of name.split('.')) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map() })
      node = node.children.get(part)!
    }
    node.value = value
  }
  const render = (node: Node): string => [...node.children].map(([name, child]) => `<field name="${escapeXml(name)}">${child.value === undefined ? '' : `<value>${escapeXml(child.value)}</value>`}${render(child)}</field>`).join('')
  const source = agencyFormSources[key]
  return { format: 'xfdf', mediaType: 'application/xfdf', filingStatus: 'prepared-not-submitted', officialPdfUrl: source.url, edition: source.edition, sourceSha256: source.sha256, fields, requiredManualSteps,
    xml: `<?xml version="1.0" encoding="UTF-8"?><xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve"><fields>${render(root)}</fields><f href="${escapeXml(source.url)}"/></xfdf>` }
}

export function exportAgencyForm(i: AgencyReturnInput): AgencyFormExport {
  const key = originalKey(i)
  const fields: Fields = {}
  entity(fields, i, key)
  if (!Number.isSafeInteger(i.employeeCount) || i.employeeCount < 0 || i.employeeCount > 999999) fail()
  cents(i.depositsCents)
  const t = i.totals, a = amounts(t), p = page(1)
  const steps = ['Import into the exact source PDF edition and verify the visible fields; sign and date the return before filing.']
  const put = (n: number, value: number) => money(fields, [`${p}f1_${n}[0]`, `${p}f1_${n + 1}[0]`], value)
  fields[`${p}f1_12[0]`] = String(i.employeeCount)
  if (i.form === '941') {
    const m = agencyFormMap['f941-2026']
    for (const q of m.quarter_1_to_4) fields[q.field] = q.onValue === String(i.quarter) ? q.onValue : 'Off'
    const values = [t.incomeTaxWagesCents, t.incomeTaxWithheldCents, t.socialSecurityWagesCents, a.ss, 0, 0, t.medicareWagesCents, a.med, t.additionalMedicareWagesCents, a.additional, a.fica, 0, a.before, a.fractions, 0, 0, a.total, 0, a.total, i.depositsCents, Math.max(0, a.total - i.depositsCents), Math.max(0, i.depositsCents - a.total)]
    values.forEach((v, n) => put(13 + 2 * n, v))
    if (t.socialSecurityWagesCents === 0 && t.medicareWagesCents === 0) fields[m.line4_noFICAWages.field] = m.line4_noFICAWages.onValue
    if (i.seasonal) fields[m.line18_seasonal.field] = m.line18_seasonal.onValue
  } else {
    if (i.seasonal) fail('seasonal_checkbox_is_941_only')
    const values = [t.socialSecurityWagesCents, a.ss, t.medicareWagesCents, a.med, t.additionalMedicareWagesCents, a.additional, t.incomeTaxWithheldCents, a.before, a.fractions, a.total, 0, a.total, i.depositsCents, Math.max(0, a.total - i.depositsCents), Math.max(0, i.depositsCents - a.total)]
    values.forEach((v, n) => put(13 + 2 * n, v))
  }
  if (i.monthlyLiabilityCents) {
    const monthly = i.monthlyLiabilityCents
    if (monthly.length !== (i.form === '941' ? 3 : 12) || monthly.reduce((n, v) => n + cents(v), 0) !== a.total) fail('agency_liability_schedule_mismatch')
    if (i.form === '941') {
      fields[`${page(2)}c2_1[1]`] = '2'
      monthly.forEach((v, n) => money(fields, [`${page(2)}f2_${1 + n * 2}[0]`, `${page(2)}f2_${2 + n * 2}[0]`], v))
      money(fields, [`${page(2)}f2_7[0]`, `${page(2)}f2_8[0]`], a.total)
    } else if (a.total >= 250000) {
      fields[`${page(2)}BulletedList[0].Bullet3[0].c2_2[0]`] = '1'
      monthly.forEach((v, n) => {
        const group = ['FirstQuarter', 'SecondQuarter', 'ThirdQuarter', 'FourthQuarter'][Math.floor(n / 3)]
        money(fields, [`${page(2)}${group}[0].f2_${1 + n * 2}[0]`, `${page(2)}${group}[0].f2_${2 + n * 2}[0]`], v)
      })
      money(fields, [`${page(2)}f2_25[0]`, `${page(2)}f2_26[0]`], a.total)
    }
  } else steps.push('Complete the applicable deposit-schedule declaration and liability schedule, including Schedule B or Form 943-A when required; deposits are not a liability schedule.')
  if (i.depositsCents > a.total) steps.push('Choose the overpayment disposition and complete any refund information yourself.')
  return exportData(key, fields, steps)
}

export function exportAgencyCorrection(i: AgencyCorrectionInput): AgencyFormExport {
  originalKey(i) // Only corrections to the explicitly supported source tax periods.
  const key = i.form === '941' ? 'f941x-2026' : 'f943x-2026'
  const m = agencyFormMap[key]
  const fields: Fields = {}
  entity(fields, i, key)
  const discovered = date(i.discoveredOn)
  if (Number(discovered.slice(0, 4)) < i.taxYear || i.w2FiledOrWillFile !== true || !['adjustment', 'claim'].includes(i.process) || !Array.isArray(i.certifications)) fail()
  const reason = label(i.reason, 3000)
  const a = amounts(i.original), b = amounts(i.corrected)
  fields[m.correctingYear[0]] = String(i.taxYear)
  const pieces = [discovered.slice(5, 7), discovered.slice(8, 10), discovered.slice(0, 4)]
  m.discovery_MM_DD_YYYY.forEach((f, n) => { fields[f] = pieces[n] })
  for (const [n, c] of m.process_adjust_or_claim.entries()) fields[c.field] = n === (i.process === 'adjustment' ? 0 : 1) ? c.onValue : 'Off'
  fields[m.line3_W2certification.field] = m.line3_W2certification.onValue
  if (i.form === '941') {
    fields[`${page(1)}SideBoxes[0].c1_1[0]`] = '1'
    for (let n = 0; n < 4; n++) fields[`${page(1)}SideBoxes[0].c1_2[${n}]`] = n + 1 === i.quarter ? String(i.quarter) : 'Off'
  }
  const certificationNames: CorrectionCertification[] = ['adjust-repaid', 'adjust-employer-only', 'adjust-not-withheld', 'claim-repaid', 'claim-consent', 'claim-employer-only', 'claim-not-withheld']
  for (const c of i.certifications) {
    const n = certificationNames.indexOf(c)
    if (n < 0 || !c.startsWith(i.process === 'adjustment' ? 'adjust-' : 'claim-')) fail('invalid_correction_certification')
    fields[`${page(1)}c1_${n + (i.form === '941' ? 6 : 4)}[0]`] = i.form === '941' ? '2' : '1'
  }
  const employerOnly = i.certifications.some(c => c.endsWith('employer-only'))
  const notWithheld = i.certifications.some(c => c.endsWith('not-withheld'))
  if (employerOnly && i.certifications.length !== 1) fail('ambiguous_correction_tax_shares')
  const priorYear = Number(discovered.slice(0, 4)) > i.taxYear
  const fitChange = i.corrected.incomeTaxWithheldCents - i.original.incomeTaxWithheldCents
  const addChange = i.corrected.additionalMedicareWagesCents - i.original.additionalMedicareWagesCents
  if (priorYear && (fitChange !== 0 || addChange !== 0) && i.priorYearWithholdingAdministrativeError !== true) fail('prior_year_withholding_requires_administrative_error')
  if (fitChange < 0 && (priorYear || i.process === 'claim') && !notWithheld) fail('income_tax_not_withheld_certification_required')
  if (addChange < 0 && (priorYear || i.form === '943' || i.process === 'claim') && !notWithheld) fail('additional_medicare_not_withheld_certification_required')
  if (employerOnly && (fitChange !== 0 || addChange !== 0)) fail('employer_only_cannot_correct_employee_withholding')
  const map = agencyFormMap[key] as unknown as Record<string, Pair | CorrectionRow>
  const corrections: number[] = []
  const row = (name: string, old: number, corrected: number, taxChange?: number) => {
    if (old === corrected && (taxChange === undefined || taxChange === 0)) return
    const r = map[name] as CorrectionRow
    money(fields, r.corrected, corrected); money(fields, r.original, old); money(fields, r.difference, corrected - old)
    if (r.taxCorrection && taxChange !== undefined) { money(fields, r.taxCorrection, taxChange); corrections.push(taxChange) }
  }
  const wageTax = (old: number, corrected: number, rate: number) => tax(corrected - old, employerOnly && corrected < old ? rate / 2 : rate)
  if (i.form === '941') row('line6_wages', i.original.incomeTaxWagesCents, i.corrected.incomeTaxWagesCents)
  row(i.form === '941' ? 'line7_FIT' : 'line11_FIT', i.original.incomeTaxWithheldCents, i.corrected.incomeTaxWithheldCents, fitChange)
  row(i.form === '941' ? 'line8_SS_base' : 'line6_SS_base', i.original.socialSecurityWagesCents, i.corrected.socialSecurityWagesCents, wageTax(i.original.socialSecurityWagesCents, i.corrected.socialSecurityWagesCents, 1240))
  row(i.form === '941' ? 'line12_Medicare_base' : 'line9_Medicare_base', i.original.medicareWagesCents, i.corrected.medicareWagesCents, wageTax(i.original.medicareWagesCents, i.corrected.medicareWagesCents, 290))
  row(i.form === '941' ? 'line13_AdditionalMedicare_base' : 'line10_AdditionalMedicare_base', i.original.additionalMedicareWagesCents, i.corrected.additionalMedicareWagesCents, tax(addChange, 90))
  if (employerOnly && a.fractions !== b.fractions) fail('employer_only_fraction_adjustment_requires_separate_allocation')
  row(i.form === '941' ? 'line15_adjustments' : 'line12_adjustments', a.fractions, b.fractions, b.fractions - a.fractions)
  const under = corrections.some(n => n > 0), over = corrections.some(n => n < 0)
  if (i.process === 'claim' && (under || !over)) fail('claim_requires_only_overreported_tax')
  if (over && i.certifications.length === 0) fail('overreported_tax_requires_certification')
  const total = corrections.reduce((sum, n) => sum + n, 0)
  money(fields, map[i.form === '941' ? 'line23_subtotal' : 'line20_subtotal'] as Pair, total)
  money(fields, map[i.form === '941' ? 'line27_total' : 'line25_total'] as Pair, total)
  fields[(map[i.form === '941' ? 'line43_explanation' : 'line41_explanation'] as Pair)[0]] = reason
  if (under && over) fields[`${page(5)}c5_1[0]`] = '1'
  return exportData(key, fields, ['Verify the correction eligibility and every selected certification against the printed instructions; supply any required supporting schedules, sign and date all required pages before filing.'])
}
