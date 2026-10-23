import type { PortalRequest, PortalResponsePacket, PortalConfirmation, PortalFollowUp, PortalAnswer, PortalPreparer, PortalAttachment } from './portal-types'
import type { Kind, Revision } from '../workspace/store'

export interface ClaimSource {
  kind: Kind; id: string; version: number; sourceRef: string
  from: string; through: string; grossCents: number
}
export interface ClaimRepresentative {
  id: string; name: string; operatorVersion: number; grantVersion: number
}
export interface ClaimArtifact {
  artifactId: string; sourceRef: string; sourceSha256: string; sourceVersion: number
}
export interface ClaimMandate extends ClaimArtifact {
  employerEin: string; agency: string; state: string; representativeId: string
  effectiveFrom: string; effectiveThrough: string; scope: 'unemployment-claim-response'
  reviewedBy: string; reviewedAt: string
}
export interface ClaimWillowFacts extends Omit<ClaimArtifact, 'sourceVersion'> {
  sourceVersion: string
  source: 'willow'; portalReason: string; effectiveDate: string; sourceArtifact: Record<string, unknown>; sourceApprovedBy: string; sourceApprovedAt: string
  sourcePersonId: string; separationDate: string; lastDayWorked: string; reason: string; facts: string
  reviewedBy: string; reviewedAt: string
}
export interface ClaimWorker {
  id: string; name: string; locationId: string; version: number; ssnVersion: number
}
export type ClaimAnswer = PortalAnswer
export interface ClaimSignature {
  actorId: string; name: string; operatorVersion: number; grantVersion: number; sessionId: string
  responseDigest: string; signedAt: number; statement: string
}
export interface ClaimEscalation {
  id: string; reason: string; representativeId: string; representativeName: string; recordedAt: number
  deadlineAt: string; beforeDeadline: boolean; status: 'assigned-in-envelope'
}
export interface ClaimPortalReview {
  artifactId: string; sourceSha256: string; responseDigest: string; reviewedBy: string; reviewedAt: string
}
export interface ClaimHandoff {
  id: string; responseDigest: string; recordedBy: string; recordedAt: number
  portalUrl: string; portalResponseArtifactId: string; portalResponseSha256: string; status: 'human-portal-handoff'; remoteSubmission: 'unconfirmed'
}
export interface ClaimArtifactFile {
  id: string; name: string; mediaType: string; contentBase64: string; sha256: string; bytes: number
}
export interface ClaimData {
  artifacts: ClaimArtifactFile[]; request: PortalRequest; requestDigest: string; representative: ClaimRepresentative; escalationAt: string
  worker?: ClaimWorker; payroll: ClaimSource[]; willow?: ClaimWillowFacts; mandate?: ClaimMandate
  disputed: boolean; missingFacts: string[]; holds: string[]; answers: ClaimAnswer[]
  disputeResolution?: {artifactId:string;reviewedBy:string;reviewedAt:string}
  preparer?: PortalPreparer; attachments?: PortalAttachment[]; packet?: PortalResponsePacket; responseDigest?: string; signature?: ClaimSignature; portalReview?: ClaimPortalReview; handoff?: ClaimHandoff
  activeFollowUp?: PortalFollowUp; previousResponses?: { version: number; responseDigest: string; agencyReference?: string }[]
  independentlyVerifiedAgencyAcceptance: false; confirmations: PortalConfirmation[]; followUps: PortalFollowUp[]; escalations: ClaimEscalation[]
  status: 'awaiting-evidence' | 'ready-for-preparation' | 'held' | 'ready-for-review' | 'signed' | 'human-portal-handoff' | 'confirmation-reported' | 'agency-confirmation-reviewed' | 'follow-up-required'
}
export type ClaimRecord = Revision<ClaimData>
export interface ClaimReview extends ClaimRecord { reviewToken: string; responseDigest: string }
