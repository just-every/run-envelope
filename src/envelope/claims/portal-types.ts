/** Local transcription types for the documented SIDES E-Response portal.
 * These are not a SIDES JSON API or a Central Broker message schema. */
export interface PortalRequestInput {
  exchange: 'separation' | 'earnings'
  requestId: string
  agency: string
  state: string
  employerEin: string
  stateEmployerId: string
  claimantName: string
  claimantIdentifier: string
  issuedOn: string
  dueOn: string
  deadlineAt: string
  timeZone: string
  /** Absent means an internal cutoff, not an agency-specified time. */
  deadlineBasis?: 'agency-specified-instant' | 'internal-cutoff-on-agency-due-date'
  sourceRef: string
  sourceSha256: string
  portalUrl?: string
  claimantStatedReason?: string
  responseStatus?: 'Not Started' | 'In Progress' | 'Submitted'
  requestedWeeks?: { weekEnding: string }[]
}
export interface PortalRequest extends Omit<PortalRequestInput, 'portalUrl' | 'deadlineBasis'> {
  requestIdentity: string
  portalUrl: 'https://uisides.org/'
  deadlineBasis: 'agency-specified-instant' | 'internal-cutoff-on-agency-due-date'
  schemaVersion: string
}
export interface PayrollEvidence {
  kind: string
  id: string
  version: number
  sourceRef: string
  from: string
  through: string
  grossCents: number
}
export interface ReviewedWillowFacts {
  source: 'willow'
  artifactId: string
  sourceVersion: string
  sourceRef: string
  sourceSha256: string
  sourceApprovedBy: string
  sourceApprovedAt: string
  effectiveDate: string
  separationDate: string
  lastDayWorked: string
  reason: string
  /** Explicit native human mapping from the retained HR reason to an official category. */
  portalReason: string
  facts: string
  reviewedBy: string
  reviewedAt: string
}
export interface PortalAnswer {
  /** A key from portalFieldSchema, or a question transcribed from the request. */
  field: string
  value: string
  citations: string[]
  /** Only for an additional reason-specific question actually in the agency request. */
  question?: string
  questionSourceRef?: string
}
export interface PortalAttachment {
  id: string
  name: string
  mediaType: 'application/pdf' | 'text/plain' | 'text/csv' | 'application/rtf' | 'image/tiff'
  bytes: number
  sha256: string
  sourceRef: string
}
export interface PortalPreparer {
  kind: 'Employer' | 'TPA'
  name: string
  jobTitle: string
  phone: string
  email: string
  fax?: string
}
export interface PortalSignature {
  signerId: string
  signerName: string
  signedAt: string
  responseDigest: string
  statement: string
}
export interface PortalResponseInput {
  request: PortalRequest
  followUp?: PortalFollowUp
  company: { ein: string; legalName: string; stateEmployerId: string }
  worker: { personId: string; name: string }
  payrollEvidence: PayrollEvidence[]
  willowFacts?: ReviewedWillowFacts
  answers: PortalAnswer[]
  preparer: PortalPreparer
  attachments?: PortalAttachment[]
  /** Caller supplies this only from an exact native human approval, never raw request input. */
  approvedSignature?: PortalSignature
}
export interface PortalResponseField {
  field: string
  label: string
  value: string
  citations: string[]
  guide: string
}
export interface PortalResponsePacket {
  schemaVersion: string
  requestIdentity: string
  responseDigest: string
  fields: PortalResponseField[]
  packetHtml: string
  transferStatus: 'prepared-not-submitted'
  signature?: PortalSignature
  sourceEditions: { url: string; sha256: string; edition?: string }[]
}
export interface PortalConfirmationInput {
  requestIdentity: string
  responseDigest: string
  confirmationNumber: string
  employerEin: string
  stateEmployerId: string
  /** A local transcription of submission time, with its evidence retained. */
  submittedAt: string
  sourceRef: string
  sourceSha256: string
  /** Only the exact documented confirmation sentence is accepted as evidence. */
  agencyMessage?: string
  /** Caller supplies review only after inspecting the retained original artifact. */
  evidenceReview?: { reviewedBy: string; reviewedAt: string; artifactId: string; artifactSha256: string }
}
export interface PortalConfirmation extends PortalConfirmationInput {
  evidenceStatus: 'reported-unverified' | 'agency-confirmation-reviewed'
  /** This is the portal's response acceptance, not an eligibility determination. */
  responseAccepted: boolean
  timeliness: 'before-cutoff' | 'after-cutoff'
  agencyDueDateTimeliness: 'on-or-before-due-date' | 'after-due-date'
}
export interface PortalFollowUpInput {
  requestIdentity: string
  agencyReference: string
  employerEin: string
  stateEmployerId: string
  receivedAt: string
  dueOn: string
  deadlineAt: string
  timeZone: string
  deadlineBasis?: PortalRequestInput['deadlineBasis']
  questions: { question: string; sourceRef: string }[]
  sourceRef: string
  sourceSha256: string
  ownerId: string
}
export interface PortalFollowUp extends PortalFollowUpInput {
  status: 'needs-human-response' | 'response-confirmed'
  responseDigest?: string
  confirmationNumber?: string
  /** Locally transcribed correspondence, not a documented SIDES callback payload. */
  evidenceKind: 'agency-correspondence-transcription'
  overdueAtReceipt: boolean
}
