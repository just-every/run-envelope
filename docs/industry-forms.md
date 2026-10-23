# Official IRS form-data exports

`src/envelope/industry/agency-forms.ts` prepares XFDF data for import into an official IRS PDF. `agency-form-map.ts` exposes the observed AcroForm field names, checkbox export values, source URLs and SHA-256 digests. The digests identify the exact source bytes inspected; the exporter does not download a PDF or claim that a subsequently downloaded file matches them. Consumers must compare the PDF digest before applying these mappings. IRS current-form URLs can change.

| Return | Supported tax period | Official edition |
| --- | --- | --- |
| 941 | 2026, quarters 1 through 4 | [March 2026 final](https://www.irs.gov/pub/irs-pdf/f941.pdf) |
| 943 | 2025 | [2025 final](https://www.irs.gov/pub/irs-prior/f943--2025.pdf) |
| 941-X | Correction of a supported 2026 quarter | [April 2026 final](https://www.irs.gov/pub/irs-pdf/f941x.pdf) |
| 943-X | Correction of the supported 2025 year | [February 2026 final](https://www.irs.gov/pub/irs-pdf/f943x.pdf) |

Final 2026 Form 943 is unavailable in this source set. Both return and correction exports reject that original tax period with `final_2026_form_943_not_released`. The [2026 draft](https://www.irs.gov/pub/irs-dft/f943--dft.pdf) must not be filed. A 2026 agricultural calculation elsewhere must remain explicitly identified as draft computation, without a final Form 943 export. The 2025 export requires actual 2025 payroll totals and annual wage-base calculations.

## Input and output

`exportAgencyForm(input)` takes `form`, `taxYear`, a quarter for 941, company identity, `totals`, `employeeCount`, and `depositsCents`. The domestic company address contains `street`, `city`, two-letter uppercase `state`, and `postalCode`; `ein` accepts nine digits or the usual two-digit and seven-digit groups. Foreign addresses require a separate future mapping and are not represented as domestic addresses.

`AgencyTotals` contains integer cents: `incomeTaxWagesCents`, `incomeTaxWithheldCents`, `socialSecurityWagesCents`, `socialSecurityTaxCents`, `medicareWagesCents`, `medicareTaxCents`, `additionalMedicareWagesCents`, and `additionalMedicareTaxCents`. Social security and Medicare taxes include employer and employee shares; Additional Medicare is employee tax only. Aggregate finalized, actual paycheck calculation results for the selected company, return assignment and tax period. Do not mix agricultural 943 payroll with 941 payroll. Form 941 income-tax wages are the wages reportable on line 2, not every amount reportable in W-2 box 1. Form 943 has no equivalent general-compensation line.

`employeeCount` is the count required by the printed return instructions, not automatically every person ever paid: Form 941 uses the specified pay period including the twelfth of the applicable month; Form 943 uses the pay period including March 12. The optional `seasonal` flag checks Form 941 line 18 only; it does not classify workers or waive a return obligation.

This boundary covers cash payroll without tips, third-party sick pay, group-term-life adjustments, research credits, historical pandemic credits, aggregate return filers or worker reclassification. It sets the corresponding current-return tax and credit lines to zero. Such amounts must not be included in these cash-only aggregates. It does not prepare Form 8974, Schedule B, Form 943-A, W-2, W-2c, a payment voucher, or payment instructions.

The percentage lines use the printed rates: 12.4% social security, 2.9% Medicare, and 0.9% Additional Medicare, rounded to the nearest cent using integer arithmetic. The fractions-of-cents adjustment reconciles those aggregate percentage lines with the supplied actual paycheck taxes. Therefore the caller must supply actual tax liabilities, with any discrepancy attributable only to paycheck rounding, rather than use the adjustment to conceal uncollected tax or a classification error. A Social Security wage limit applies to each employee upstream; applying a single wage limit to a company aggregate is incorrect.

The optional `monthlyLiabilityCents` contains three or twelve actual monthly tax liabilities whose sum must equal total tax. This fills the monthly liability schedule, and asserts the employer is entitled to use that schedule. It must not be a list of deposits. Without it, the export's `requiredManualSteps` explicitly calls for the applicable deposit declaration and liability schedule. Form 943's printed instructions omit its monthly schedule when total tax is less than $2,500. An overpayment leaves disposition and refund information for the filer.

Every result contains `format: 'xfdf'`, `mediaType: 'application/xfdf'`, `filingStatus: 'prepared-not-submitted'`, `officialPdfUrl`, `edition`, `sourceSha256`, `fields`, `xml`, and `requiredManualSteps`. `fields` is a flat record of actual fully qualified PDF field names and string values. Dollars and cents occupy separate fields, including a leading minus sign in the dollar field for negative corrections. Checkbox values come from the PDF appearance states, including the unusual value `2` for the 941-X W-2 certification. The XML uses nested fields to preserve the AcroForm hierarchy and escapes input text; no DTD, script, or arbitrary PDF target URL is emitted.

## Corrections

`exportAgencyCorrection(input)` takes the same company and period plus `original`, `corrected`, `discoveredOn` as an ISO date, `reason`, `process: 'adjustment' | 'claim'`, `w2FiledOrWillFile: true`, and explicit `certifications`. Original totals must describe the amounts actually reported, including prior corrections; corrected totals describe the corrected return amounts. This API does not discover the historical return or establish correction eligibility.

The exporter fills the corrected, previously reported, difference and tax-correction columns for changed supported lines, the subtotal, total, explanation, discovery date, period, process and repeated identity headers on the five return pages. Social security and Medicare correction columns multiply the wage difference by the printed rate. Employer-only overreport corrections use 6.2% and 1.45%; an employer-only fractions adjustment needs a separate share allocation and is rejected. Correction-column rounding follows the printed difference-times-rate calculation; it may differ by a cent from subtracting two independently rounded original-return percentage lines. The explanation must describe the factual cause, affected workers, periods and arithmetic sufficiently for the actual correction.

Certifications select the corresponding full printed statements:

| Input | Printed statement |
| --- | --- |
| `adjust-repaid` | Line 4a, including employee reimbursement and required prior-year employee statements |
| `adjust-employer-only` | Line 4b, employer share only under its stated conditions |
| `adjust-not-withheld` | Line 4c, tax not withheld from employee wages |
| `claim-repaid` | Line 5a, including reimbursement and required employee statements |
| `claim-consent` | Line 5b, including employee consent and required prior-year statements |
| `claim-employer-only` | Line 5c, employer share only under its stated conditions |
| `claim-not-withheld` | Line 5d, tax not withheld from employee wages |

The caller must attest to the complete printed statement; selecting a short label cannot replace the underlying reimbursement, consent or statement. Any tax overreport requires an appropriate explicit certification. A claim cannot contain a positive tax correction. Employer-only corrections cannot alter employee FIT or Additional Medicare withholding, or be combined with conflicting certifications. Prior-year FIT or Additional Medicare changes require `priorYearWithholdingAdministrativeError: true`; this means a reporting discrepancy concerning amounts actually withheld, not permission to change previous-year withholding. Prior-year reductions and claim reductions in those employee-only taxes also require the applicable not-withheld certification. The module does not determine limitations periods or eligibility for exceptions.

## Import and independent verification

Download the exact official source PDF, verify its SHA-256, then import the XFDF using a PDF application that supports AcroForm data import. All generated `fields` keys must exist in that PDF's field tree, and every selected checkbox value must exist in that widget's appearance states. An independent importer can parse the XFDF namespace, recursively join nested field names with periods, and compare the resulting values to `fields` before filling the PDF. Reopen the filled PDF and inspect its field values and rendered lines, including split dollar/cents boxes, negative corrections, selected quarter and correction process. Some general browser PDF viewers do not support XFDF import.

These exports are unsigned preparation artifacts. Complete every returned manual step and review the visible form and required attachments before filing through an authorized method. No IRS account is used, no return is transmitted, and no acceptance or MeF compatibility is asserted.

## Format sources

[Adobe's XFDF example](https://guides.adobe.com/coldfusion/en/docs/coldfusion-tools/__references__/populating-a-pdf-form-with-xml-data.html) documents the XFDF namespace, fields and values. [Adobe's Acrobat API documentation](https://opensource.adobe.com/dc-acrobat-sdk-docs/library/jsapiref/doc.html#exportasxfdf) documents XFDF import and export and points to the [ISO 19444-1 specification](https://www.iso.org/standard/74272.html). [IANA's registration](https://www.iana.org/assignments/media-types/application/xfdf) identifies the current `application/xfdf` media type and XML 1.0 basis; `application/vnd.adobe.xfdf` is its deprecated alias. This implementation uses the form-field subset only and does not claim validation against an IRS MeF XSD.
