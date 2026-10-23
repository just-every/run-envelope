import { PayrollError, date } from '../security'
import type {
  PortalAnswer, PortalAttachment, PortalConfirmation, PortalConfirmationInput,
  PortalFollowUp, PortalFollowUpInput, PortalRequest, PortalRequestInput,
  PortalResponseField, PortalResponseInput, PortalResponsePacket, PortalSignature,
} from './portal-types'
export type * from './portal-types'

export const portalSchemaVersion = 'sides-e-response-portal-guides@2026-10-24'
export const portalSources = {
  separation: { url: 'https://labor.maryland.gov/employment/ui-sides_separationinformationeresponseuserguide.pdf', sha256: '56b48b267f89631d02f93e88f6a96182d704498abbf39b46bf5eaa5c9c068743' },
  earnings: { url: 'https://labor.maryland.gov/employment/ui-sides_earningsverificationeresponseuserguide.pdf', sha256: 'c5fca8cb7d07f3428932c5a1666709911010e78f06181562ca78f0708533365e' },
  adf: { url: 'https://labor.alaska.gov/estax/documents/ADF_E-Response_User_Guide.pdf', sha256: '0c6a3f91341f0ec5190034c138a2554a6ab1181ca37deda490dfb502143627fb', edition: 'Additional Fact-Finding E-Response User Guide, Version 1, September 2019' },
} as const
/** Page numbers are PDF page ordinals, including the cover, not printed page numbers.
 * Labels are visible portal questions, not XML elements or undocumented HTML names. */
export const portalFieldSchema: Record<string, { label: string; exchanges: readonly string[]; pdfPage: number }> = {
  employerReason: { label: "Employer's reason for claimant's separation", exchanges: ['separation'], pdfPage: 8 },
  jobTitle: { label: "Claimant's job title", exchanges: ['separation'], pdfPage: 8 },
  firstDayOfWork: { label: "What was the claimant's first day of work?", exchanges: ['separation'], pdfPage: 8 },
  lastDayWorked: { label: 'What was the last day claimant performed work?', exchanges: ['separation'], pdfPage: 8 },
  seasonal: { label: 'Was this seasonal employment?', exchanges: ['separation'], pdfPage: 8 },
  totalGrossWagesSince: { label: 'Total gross wages earned since the date specified by the request', exchanges: ['separation'], pdfPage: 10 },
  compensationAfterSeparation: { label: 'Did or will the claimant receive any compensation on or after the last day of work (excluding wages for hours worked)?', exchanges: ['separation'], pdfPage: 10 },
  pensionOr401k: { label: ["Is or will the claimant receive a company pension and", "or 401K disbursement?"].join('/'), exchanges: ['separation'], pdfPage: 10 },
  workersCompensation: { label: "Is (or was) the claimant receiving workers' compensation?", exchanges: ['separation'], pdfPage: 10 },
  workedOrReceivedPayments: { label: 'Did this person perform work or receive any payments between the dates specified by the request?', exchanges: ['earnings'], pdfPage: 8 },
  firstDayWorkedOrPpp: { label: 'What was the first day the claimant physically worked or the first allocated payment date of a Paycheck Protection Program (PPP) between the dates specified by the request?', exchanges: ['earnings'], pdfPage: 8 },
  stillWorking: { label: 'Is the claimant still working?', exchanges: ['earnings'], pdfPage: 8 },
  contractAmount: { label: 'Did the claimant work under contract for a specific amount?', exchanges: ['earnings'], pdfPage: 9 },
  mileTripUnit: { label: ["Was the claimant paid by the mile or Trip", "Load", "Unit?"].join('/'), exchanges: ['earnings'], pdfPage: 9 },
  regularRate: { label: 'Regular Rate of Pay', exchanges: ['earnings'], pdfPage: 9 },
  overtimeRate: { label: 'Overtime Rate of Pay', exchanges: ['earnings'], pdfPage: 9 },
  trainingRate: { label: 'Training Rate of Pay', exchanges: ['earnings'], pdfPage: 9 },
  payFrequency: { label: ["How often is", "was the claimant paid?"].join('/'), exchanges: ['earnings'], pdfPage: 9 },
  payPeriodStart: { label: 'Pay period start date', exchanges: ['earnings'], pdfPage: 9 },
  earningsSelection: { label: 'Select each type of payment received for the week(s) listed', exchanges: ['earnings'], pdfPage: 10 },
  payPeriodEarnings: { label: 'Pay Period Earnings: Hours, Earnings, Date Paid and applicable additional payment types', exchanges: ['earnings'], pdfPage: 11 },
  additionalInformation: { label: 'Enter any additional information about this Earnings Verification, including details of the PPP (if applicable).', exchanges: ['earnings'], pdfPage: 13 },
  supportingDocumentation: { label: 'Supporting documentation relevant to the response', exchanges: ['separation'], pdfPage: 11 },
}
export const separationReasons = [
  'Temporary Layoff', ["Laid Off", "Lack of Work"].join('/'), ["Fired", "Discharged"].join('/'), ["Vacation", "Holiday Shutdown"].join('/'),
  'Asked to Resign', 'Voluntary Quit', 'Educational Institution Employee Between Semesters or Terms, Likely to Return',
  'Educational Institution Employee Between Semesters or Terms, Not Likely to Return', 'Still Employed, Full-time',
  'Still Employed, Part-time', 'Still Employer, Hours Reduced', ["On Call", "Temporary Status"].join('/'), 'Leave of Absence',
  'Retirement', 'Suspension', 'Labor Dispute', 'Professional Athlete Between Sports Seasons', 'Disaster Related', 'Not Listed Above',
] as const
function fail(code = 'invalid_claim_portal_artifact'): never { throw new PayrollError(code) }
function text(value: unknown, max = 240): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(value)) fail()
  return value.trim()
}
function sha(value: unknown) {
  const s = text(value, 64).toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(s)) fail('invalid_claim_artifact_digest')
  return s
}
function ein(value: unknown) {
  const s = text(value, 10).replace('-', '')
  if (!/^\d{9}$/.test(s)) fail('invalid_claim_employer_ein')
  return s
}
function instant(value: unknown) {
  const s = text(value, 30)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s) || !Number.isFinite(Date.parse(s))) fail('invalid_claim_instant')
  const normalized = new Date(s).toISOString()
  if (normalized !== (s.includes('.') ? s : s.replace('Z', '.000Z'))) fail('invalid_claim_instant')
  return normalized
}
function localDate(at: string, zone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at))
    const part = (type: string) => parts.find(p => p.type === type)!.value
    return `${part('year')}-${part('month')}-${part('day')}`
  } catch { return fail('invalid_claim_time_zone') }
}
function cutoff(dueOn: string, deadlineAt: unknown, timeZone: unknown, basis: PortalRequestInput['deadlineBasis']) {
  const at = instant(deadlineAt), zone = text(timeZone, 80)
  if (localDate(at, zone) !== dueOn) fail('claim_cutoff_due_date_mismatch')
  if (basis !== undefined && !['agency-specified-instant', 'internal-cutoff-on-agency-due-date'].includes(basis)) fail()
  return { deadlineAt: at, timeZone: zone, deadlineBasis: basis ?? 'internal-cutoff-on-agency-due-date' as const }
}
export function parsePortalRequest(input: PortalRequestInput): PortalRequest {
  if (!['separation', 'earnings'].includes(input.exchange)) fail('unsupported_claim_exchange')
  const state = text(input.state, 2)
  if (!'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ').includes(state)) fail('unsupported_claim_state')
  const identifier = text(input.claimantIdentifier, 11).replace(/-/g, '')
  if (!/^\d{9}$/.test(identifier)) fail('full_claimant_identifier_required')
  const issuedOn = date(input.issuedOn), dueOn = date(input.dueOn)
  if (issuedOn > dueOn) fail('invalid_claim_request_dates')
  if (input.portalUrl !== undefined && input.portalUrl !== 'https://uisides.org/' && input.portalUrl !== 'https://uisides.org') fail('unsupported_claim_portal')
  const employerEin = ein(input.employerEin), requestId = text(input.requestId, 120), stateEmployerId = text(input.stateEmployerId, 120)
  const result: PortalRequest = {
    exchange: input.exchange, requestId, agency: text(input.agency), state, employerEin, stateEmployerId,
    claimantName: text(input.claimantName), claimantIdentifier: identifier, issuedOn, dueOn,
    ...cutoff(dueOn, input.deadlineAt, input.timeZone, input.deadlineBasis),
    sourceRef: text(input.sourceRef, 500), sourceSha256: sha(input.sourceSha256), portalUrl: 'https://uisides.org/', schemaVersion: portalSchemaVersion,
    requestIdentity: JSON.stringify([state, employerEin, stateEmployerId, input.exchange, requestId, issuedOn]),
  }
  if (input.claimantStatedReason) result.claimantStatedReason = text(input.claimantStatedReason, 500)
  if (input.responseStatus !== undefined) {
    if (!['Not Started', 'In Progress', 'Submitted'].includes(input.responseStatus)) fail()
    result.responseStatus = input.responseStatus
  }
  if (input.requestedWeeks !== undefined) {
    if (!Array.isArray(input.requestedWeeks) || input.requestedWeeks.length > 104) fail()
    result.requestedWeeks = input.requestedWeeks.map(w => {
      const weekEnding = date(w.weekEnding)
      if (new Date(`${weekEnding}T12:00:00Z`).getUTCDay() !== 6) fail('claim_earnings_week_must_end_saturday')
      return { weekEnding }
    })
    if (new Set(result.requestedWeeks.map(w => w.weekEnding)).size !== result.requestedWeeks.length) fail('duplicate_claim_earnings_week')
  }
  return result
}
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
async function digest(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), b => b.toString(16).padStart(2, '0')).join('')
}
function number(value: number, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > 1_000_000_000_000) fail()
  return value
}
function attachment(a: PortalAttachment): PortalAttachment {
  if (!['application/pdf', 'text/plain', 'text/csv', 'application/rtf', 'image/tiff'].includes(a.mediaType)) fail('unsupported_claim_attachment')
  return { id: text(a.id), name: text(a.name), mediaType: a.mediaType, bytes: number(a.bytes, true), sha256: sha(a.sha256), sourceRef: text(a.sourceRef, 500) }
}
function signature(s: PortalSignature, responseDigest: string) {
  if (sha(s.responseDigest) !== responseDigest) fail('claim_signature_payload_changed')
  return { signerId: text(s.signerId), signerName: text(s.signerName), signedAt: instant(s.signedAt), responseDigest, statement: text(s.statement, 1000) }
}
export async function preparePortalResponse(input: PortalResponseInput): Promise<PortalResponsePacket> {
  const request = parsePortalRequest(input.request)
  if (input.request.requestIdentity !== request.requestIdentity) fail('claim_request_identity_changed')
  if (input.followUp && !['needs-human-response', 'response-confirmed'].includes(input.followUp.status)) fail('invalid_claim_followup_status')
  // Parsing reconstructs immutable source content with the initial status. Later
  // confirmation metadata cannot rewrite the exact response originally signed.
  const followUp = input.followUp ? parsePortalFollowUp(input.followUp, request) : undefined
  if (ein(input.company.ein) !== request.employerEin || text(input.company.stateEmployerId) !== request.stateEmployerId) fail('claim_employer_mismatch')
  const company = { ein: request.employerEin, legalName: text(input.company.legalName), stateEmployerId: request.stateEmployerId }
  const worker = { personId: text(input.worker.personId), name: text(input.worker.name) }
  if (!Array.isArray(input.payrollEvidence) || input.payrollEvidence.length === 0 || input.payrollEvidence.length > 500) fail('claim_payroll_evidence_required')
  const payroll = input.payrollEvidence.map(p => {
    const from = date(p.from), through = date(p.through)
    if (from > through) fail('invalid_claim_payroll_period')
    return { kind: text(p.kind), id: text(p.id), version: number(p.version, true), sourceRef: text(p.sourceRef, 500), from, through, grossCents: number(p.grossCents) }
  }).sort((a, b) => a.id.localeCompare(b.id))
  if (new Set(payroll.map(p => p.id)).size !== payroll.length) fail('duplicate_claim_payroll_evidence')
  let willow: PortalResponseInput['willowFacts']
  if (input.willowFacts) {
    const f = input.willowFacts
    if (f.source !== 'willow') fail('reviewed_willow_claim_facts_required')
    willow = { source: 'willow', artifactId: text(f.artifactId), sourceVersion: text(f.sourceVersion, 100), sourceRef: text(f.sourceRef, 500), sourceSha256: sha(f.sourceSha256), sourceApprovedBy: text(f.sourceApprovedBy), sourceApprovedAt: instant(f.sourceApprovedAt), effectiveDate: date(f.effectiveDate), separationDate: date(f.separationDate), lastDayWorked: date(f.lastDayWorked), reason: text(f.reason, 500), portalReason: text(f.portalReason, 500), facts: text(f.facts, 10000), reviewedBy: text(f.reviewedBy), reviewedAt: instant(f.reviewedAt) }
    if (willow.lastDayWorked > willow.separationDate) fail('invalid_claim_separation_dates')
    if (willow.sourceApprovedAt > willow.reviewedAt) fail('claim_review_predates_willow_source_approval')
  }
  if (!followUp && request.exchange === 'separation' && !willow) fail('reviewed_willow_claim_facts_required')
  const attachments = (input.attachments ?? []).map(attachment).sort((a, b) => a.id.localeCompare(b.id))
  if (attachments.length > 10 || attachments.reduce((n, a) => n + a.bytes, 0) > 5_000_000 || new Set(attachments.map(a => a.id)).size !== attachments.length) fail('claim_attachment_limit')
  const refs = new Set([...payroll.map(p => p.id), ...attachments.map(a => a.id), ...(willow ? [willow.artifactId] : [])])
  if (!Array.isArray(input.answers) || input.answers.length === 0 || input.answers.length > 100) fail('claim_answers_required')
  const fields: PortalResponseField[] = input.answers.map((a: PortalAnswer) => {
    const field = text(a.field, 120), known = Object.hasOwn(portalFieldSchema, field) ? portalFieldSchema[field] : undefined
    if (!Array.isArray(a.citations) || a.citations.length === 0) fail('claim_answer_citation_required')
    const citations = [...new Set(a.citations.map(c => text(c)))].sort()
    if (citations.some(c => !refs.has(c))) fail('unknown_claim_answer_citation')
    if (followUp) {
      const index = followUp.questions.findIndex((_, n) => field === `agency-question:${n + 1}`)
      if (index < 0 || a.question !== followUp.questions[index].question || a.questionSourceRef !== followUp.sourceRef) fail('claim_followup_question_mismatch')
      return { field, label: followUp.questions[index].question, value: text(a.value, 10000), citations, guide: followUp.sourceRef }
    }
    if (known && !known.exchanges.includes(request.exchange)) fail('claim_question_exchange_mismatch')
    if (!known && (!field.startsWith('agency-question:') || text(a.questionSourceRef, 500) !== request.sourceRef)) fail('undocumented_claim_portal_question')
    return { field, label: known?.label ?? text(a.question, 1000), value: text(a.value, 10000), citations,
      guide: known ? `${portalSources[request.exchange].url}#page=${known.pdfPage}` : request.sourceRef }
  }).sort((a, b) => followUp ? Number(a.field.split(':')[1]) - Number(b.field.split(':')[1]) : a.field.localeCompare(b.field))
  if (new Set(fields.map(a => a.field)).size !== fields.length) fail('duplicate_claim_answer')
  const required = followUp ? followUp.questions.map((_, n) => `agency-question:${n + 1}`) : request.exchange === 'separation'
    ? ['employerReason', 'jobTitle', 'firstDayOfWork', 'lastDayWorked', 'seasonal', 'compensationAfterSeparation', 'pensionOr401k', 'workersCompensation']
    : ['workedOrReceivedPayments', 'stillWorking', 'regularRate', 'payFrequency', 'payPeriodStart', 'payPeriodEarnings']
  if (required.some(f => !fields.some(a => a.field === f))) fail('claim_response_incomplete')
  const answer = (key: string) => fields.find(f => f.field === key)
  for (const key of ['seasonal', 'compensationAfterSeparation', 'workersCompensation', 'stillWorking', 'contractAmount', 'mileTripUnit']) {
    const a = answer(key)
    if (a && !['Yes', 'No'].includes(a.value)) fail('claim_yes_no_answer_required')
  }
  for (const key of ['firstDayOfWork', 'lastDayWorked', 'payPeriodStart', 'firstDayWorkedOrPpp']) if (answer(key)) date(answer(key)!.value)
  if (!followUp && willow && request.exchange === 'separation') {
    const reason = answer('employerReason')!
    if (!(separationReasons as readonly string[]).includes(reason.value)) fail('unsupported_claim_separation_reason')
    if (reason.value !== willow.portalReason || answer('lastDayWorked')!.value !== willow.lastDayWorked || !reason.citations.includes(willow.artifactId) || !answer('lastDayWorked')!.citations.includes(willow.artifactId)) fail('claim_willow_facts_conflict')
    if (request.claimantStatedReason && request.claimantStatedReason !== reason.value) fail('claim_disputed_separation_requires_representative')
  }
  const p = input.preparer
  if (!['Employer', 'TPA'].includes(p.kind)) fail()
  const preparer = { kind: p.kind, name: text(p.name), jobTitle: text(p.jobTitle), phone: text(p.phone, 40), email: text(p.email, 254), fax: p.fax ? text(p.fax, 40) : '' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preparer.email)) fail('invalid_claim_preparer_email')
  // Keep every cited source and all request identifiers in the digest even though
  // the printable packet masks SSN and contains only the information needed by a human.
  const responseDigest = await digest({ schemaVersion: portalSchemaVersion, request, company, worker, payroll, willow: willow ?? null, fields, preparer, attachments, ...(followUp ? { followUp } : {}) })
  const signed = input.approvedSignature ? signature(input.approvedSignature, responseDigest) : undefined
  const rows = fields.map(f => {
    const display = ['firstDayOfWork', 'lastDayWorked', 'payPeriodStart', 'firstDayWorkedOrPpp'].includes(f.field)
      ? `${f.value.slice(5, 7)}/${f.value.slice(8, 10)}/${f.value.slice(0, 4)}` : f.value
    return `<tr><th>${html(f.label)}</th><td>${html(display).replace(/\n/g, '<br>')}</td><td>${f.citations.map(html).join(', ')}</td></tr>`
  }).join('')
  const sourceRows = payroll.map(p => `<li>${html(p.id)} v${p.version}: ${html(p.from)} through ${html(p.through)}, gross $${(p.grossCents / 100).toFixed(2)}; ${html(p.sourceRef)}</li>`).join('')
  const followUpHeading = followUp ? `<h2>Additional Fact-Finding</h2><p>Agency reference: ${html(followUp.agencyReference)}<br>Current due date: ${html(followUp.dueOn)}<br>Cutoff: ${html(followUp.deadlineAt)} · ${html(followUp.timeZone)} · ${html(followUp.deadlineBasis!)}<br>Assigned representative: ${html(followUp.ownerId)}<br>Original correspondence: ${html(followUp.sourceRef)} · SHA-256 ${followUp.sourceSha256}</p>` : ''
  const packetHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Unemployment response for human portal transfer</title><style>body{font:16px Georgia,serif;color:#172329;max-width:960px;margin:24px auto;padding:0 20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #64727b;padding:10px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{width:34%}p,li{line-height:1.5}@media print{body{margin:0;max-width:none}tr{break-inside:avoid}}</style></head><body><h1>${followUp ? 'Additional fact-finding response for human portal transfer' : 'Response for human portal transfer'}</h1>${followUpHeading}<p>Prepared only. This packet has not been submitted to an agency.</p><p>${html(request.agency)} · ${html(request.state)} · ${html(followUp ? 'Additional Fact-Finding' : request.exchange)}<br>Claim number: ${html(request.requestId)} · Request: ${html(request.issuedOn)} · Due: ${html(request.dueOn)}<br>Company: ${html(company.legalName)} · FEIN: ${html(company.ein)} · SEIN: ${html(company.stateEmployerId)}<br>Worker: ${html(worker.name)} · SSN: ***-**-${html(request.claimantIdentifier.slice(-4))}</p><p>Use the authorized SIDES E-Response portal at https://uisides.org/. ${followUp ? 'Select Additional Fact-Finding and match this follow-up request. Answer every retained inquiry, include relevant permitted attachments, complete preparer information, inspect the official response and select Submit to State yourself.' : 'Match its request, answer its current reason-specific questions, inspect View Response and select Submit yourself.'} Save the confirmation number and downloaded response. A prepared packet or signed approval does not prove submission.</p><table><thead><tr><th>Portal field</th><th>Reviewed response</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table><h2>Payroll evidence</h2><ul>${sourceRows}</ul>${willow ? `<h2>Reviewed Willow separation facts</h2><p>${html(willow.facts).replace(/\n/g, '<br>')}</p><p>${html(willow.artifactId)} v${html(willow.sourceVersion)}; ${html(willow.sourceRef)}; source approver ${html(willow.sourceApprovedBy)}; reviewer ${html(willow.reviewedBy)}</p>` : ''}<h2>Attachments to transfer</h2><ul>${attachments.map(a => `<li>${html(a.name)} (${a.bytes} bytes); ${html(a.id)}; SHA-256 ${a.sha256}</li>`).join('')}</ul><h2>Preparer</h2><p>${html(preparer.kind)} · ${html(preparer.name)} · ${html(preparer.jobTitle)}<br>${html(preparer.phone)} · ${html(preparer.email)}${preparer.fax ? `<br>Fax: ${html(preparer.fax)}` : ''}</p><h2>Human approval</h2><p>${signed ? `${html(signed.signerName)} (${html(signed.signerId)}) · ${html(signed.signedAt)}<br>${html(signed.statement)}` : 'Unsigned. An authorized human must approve the exact response before transfer.'}</p><p>Response digest: ${responseDigest}</p></body></html>`
  return { schemaVersion: portalSchemaVersion, requestIdentity: request.requestIdentity, responseDigest, fields, packetHtml, transferStatus: 'prepared-not-submitted', ...(signed ? { signature: signed } : {}), sourceEditions: [followUp ? portalSources.adf : portalSources[request.exchange]] }
}

export function parsePortalConfirmation(input: PortalConfirmationInput, request: PortalRequest, packet: Pick<PortalResponsePacket, 'requestIdentity' | 'responseDigest'>): PortalConfirmation {
  if (input.requestIdentity !== request.requestIdentity || packet.requestIdentity !== request.requestIdentity || sha(input.responseDigest) !== packet.responseDigest) fail('claim_confirmation_binding_mismatch')
  if (ein(input.employerEin) !== request.employerEin || text(input.stateEmployerId) !== request.stateEmployerId) fail('claim_employer_mismatch')
  const submittedAt = instant(input.submittedAt), sourceSha256 = sha(input.sourceSha256)
  if (submittedAt.slice(0, 10) < request.issuedOn) fail('claim_confirmation_predates_request')
  let evidenceReview: PortalConfirmationInput['evidenceReview']
  if (input.evidenceReview) {
    const r = input.evidenceReview
    if (sha(r.artifactSha256) !== sourceSha256) fail('claim_confirmation_artifact_changed')
    if (input.agencyMessage !== 'Your response has been accepted.') fail('claim_confirmation_message_required')
    evidenceReview = { reviewedBy: text(r.reviewedBy), reviewedAt: instant(r.reviewedAt), artifactId: text(r.artifactId), artifactSha256: sourceSha256 }
    if (evidenceReview.reviewedAt < submittedAt) fail('claim_confirmation_review_predates_submission')
  }
  return { requestIdentity: request.requestIdentity, responseDigest: packet.responseDigest, confirmationNumber: text(input.confirmationNumber, 160), employerEin: request.employerEin, stateEmployerId: request.stateEmployerId, submittedAt, sourceRef: text(input.sourceRef, 500), sourceSha256, ...(input.agencyMessage ? { agencyMessage: text(input.agencyMessage, 500) } : {}), ...(evidenceReview ? { evidenceReview } : {}), evidenceStatus: evidenceReview ? 'agency-confirmation-reviewed' : 'reported-unverified', responseAccepted: Boolean(evidenceReview), timeliness: submittedAt <= request.deadlineAt ? 'before-cutoff' : 'after-cutoff', agencyDueDateTimeliness: localDate(submittedAt, request.timeZone) <= request.dueOn ? 'on-or-before-due-date' : 'after-due-date' }
}
export function parsePortalFollowUp(input: PortalFollowUpInput, request: PortalRequest): PortalFollowUp {
  if (input.requestIdentity !== request.requestIdentity || ein(input.employerEin) !== request.employerEin || text(input.stateEmployerId) !== request.stateEmployerId) fail('claim_followup_binding_mismatch')
  const receivedAt = instant(input.receivedAt), dueOn = date(input.dueOn)
  if (receivedAt.slice(0, 10) < request.issuedOn) fail('invalid_claim_followup_dates')
  if (!Array.isArray(input.questions) || input.questions.length === 0 || input.questions.length > 100) fail('claim_followup_questions_required')
  return { requestIdentity: request.requestIdentity, agencyReference: text(input.agencyReference), employerEin: request.employerEin, stateEmployerId: request.stateEmployerId, receivedAt, dueOn, ...cutoff(dueOn, input.deadlineAt, input.timeZone, input.deadlineBasis), questions: input.questions.map(q => ({ question: text(q.question, 3000), sourceRef: text(q.sourceRef, 500) })), sourceRef: text(input.sourceRef, 500), sourceSha256: sha(input.sourceSha256), ownerId: text(input.ownerId), status: 'needs-human-response', evidenceKind: 'agency-correspondence-transcription', overdueAtReceipt: localDate(receivedAt, text(input.timeZone, 80)) > dueOn }
}
