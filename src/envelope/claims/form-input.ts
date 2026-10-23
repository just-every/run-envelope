import type { Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, date, text } from '../security'
import type { WorkspaceStore } from '../workspace/store'
import { digest } from '../workspace/store'
import { ClaimLifecycle, artifacts, artifactText, claimObject } from './lifecycle'

const fileFields = ['requestFile', 'mandateFile', 'confirmationFile', 'followUpFile', 'resolutionFile', 'portalResponseFile', 'willowManifest', 'willowRecords', 'willowAudit']
const generatedFields = new Set(['artifacts', ...fileFields.flatMap(f => [f + 'ArtifactId', f + 'Sha256'])])
export async function claimsMultipartInput(request: Request): Promise<Input> {
  const reader = request.body?.getReader()
  if (!reader) throw new PayrollError('invalid_claim_form')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.length
    if (size > 3 * 1024 * 1024) { await reader.cancel(); throw new PayrollError('input_too_large', 413) }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  let form: FormData
  try { form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData() } catch { throw new PayrollError('invalid_claim_form') }
  const result: Input = {}, files: Input[] = [], seen = new Set<string>()
  for (const [key, value] of form) {
    if (seen.has(key)) throw new PayrollError('duplicate_input')
    seen.add(key)
    if (generatedFields.has(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new PayrollError('invalid_claim_form_field')
    if (typeof value === 'string') {
      if (fileFields.includes(key)) throw new PayrollError('invalid_claim_artifact')
      result[key] = value
      continue
    }
    if (!fileFields.includes(key)) throw new PayrollError('invalid_claim_artifact')
    if (!value.size) continue
    if (value.size > 512 * 1024) throw new PayrollError('claim_artifact_too_large', 413)
    const data = new Uint8Array(await value.arrayBuffer())
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), n => n.toString(16).padStart(2, '0')).join('')
    let binary = ''
    for (let index = 0; index < data.length; index += 8192) binary += String.fromCharCode(...data.subarray(index, index + 8192))
    const id = 'artifact-' + sha256
    files.push({ id, name: value.name, mediaType: value.type.split(';')[0].trim().toLowerCase(), contentBase64: btoa(binary), sha256 })
    result[key + 'ArtifactId'] = id
    result[key + 'Sha256'] = sha256
  }
  result.artifacts = files
  return result
}
const lines = (value: unknown) => String(value ?? '').split(/\r?\n/).map(v => v.trim()).filter(Boolean)
const checked = (value: unknown) => value === true || value === 'true'
function instant(value: unknown): unknown {
  if (value === undefined || value === '') return value
  const supplied = text(value, 40), raw = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(supplied) ? supplied + (supplied.length === 16 ? ':00Z' : 'Z') : supplied
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) throw new PayrollError('invalid_claim_instant')
  date(raw.slice(0, 10))
  const time = Date.parse(raw)
  if (!Number.isFinite(time)) throw new PayrollError('invalid_claim_instant')
  return new Date(time).toISOString()
}
function commonValues(value: Input): Input {
  const result: Input = { ...value, artifacts: value.artifacts ?? [] }
  if (value.version !== undefined) result.version = Number(value.version)
  for (const key of ['deadlineAt', 'escalationAt', 'submittedAt', 'receivedAt']) if (value[key] !== undefined) result[key] = instant(value[key])
  return result
}
function selectedPayroll(value: Input) {
  const keys = Object.keys(value).filter(key => key.startsWith('payroll.'))
  if (Array.isArray(value.payroll)) {
    if (keys.length) throw new PayrollError('duplicate_claim_payroll_input')
    return value.payroll
  }
  if (value.payroll !== undefined) throw new PayrollError('invalid_claim_payroll_selection')
  const result = keys.map(key => {
    if (!/^payroll\.\d+$/.test(key)) throw new PayrollError('invalid_claim_payroll_selection')
    const match = /^(income-source):([A-Za-z0-9][-A-Za-z0-9]{0,79}):([1-9]\d*)$/.exec(String(value[key]))
    if (!match || !Number.isSafeInteger(Number(match[3]))) throw new PayrollError('invalid_claim_payroll_selection')
    return { kind: match[1], id: match[2], version: Number(match[3]) }
  })
  if (new Set(result.map(p => p.kind + ':' + p.id)).size !== result.length) throw new PayrollError('duplicate_claim_payroll_input')
  return result
}
export function claimForm(action: string, value: Input): Input {
  const common = commonValues(value)
  if (value.request || value.willow || value.confirmation || value.followUp || Array.isArray(value.answers)) {
    for (const [key, dates] of [['request', ['deadlineAt']], ['confirmation', ['submittedAt']], ['followUp', ['receivedAt', 'deadlineAt']]] as const) {
      if (value[key]) {
        const source = claimObject(value[key]), normalized = { ...source }
        for (const field of dates) if (source[field] !== undefined) normalized[field] = instant(source[field])
        common[key] = normalized
      }
    }
    return common
  }
  if (action === 'import') return { ...common, request: { exchange: value.exchange, requestId: value.requestId, agency: value.agency, state: value.state, employerEin: value.employerEin, stateEmployerId: value.stateEmployerId, claimantName: value.claimantName, claimantIdentifier: value.claimantIdentifier, issuedOn: value.issuedOn, dueOn: value.dueOn, deadlineAt: common.deadlineAt, timeZone: value.timeZone, deadlineBasis: value.deadlineBasis, sourceRef: value.sourceRef, sourceSha256: value.requestFileSha256, claimantStatedReason: value.claimantStatedReason, responseStatus: 'Not Started', requestedWeeks: lines(value.requestedWeeks).map(weekEnding => ({ weekEnding })) } }
  if (action === 'evidence') {
    const willowKeys = ['willowManifestArtifactId', 'willowRecordsArtifactId', 'willowAuditArtifactId'], supplied = willowKeys.filter(key => value[key])
    if (supplied.length && supplied.length !== willowKeys.length) throw new PayrollError('complete_willow_originals_required', 409)
    return { ...common, payroll: selectedPayroll(value),
      ...(supplied.length ? { willow: { manifestArtifactId: value.willowManifestArtifactId, recordsArtifactId: value.willowRecordsArtifactId, auditArtifactId: value.willowAuditArtifactId, sourceRef: value.willowSourceRef, lastDayWorked: value.lastDayWorked, portalReason: value.portalReason }, willowReviewed: checked(value.willowReviewed) } : {}),
      ...(value.mandateFileArtifactId ? { mandate: { artifactId: value.mandateFileArtifactId, sourceVersion: 1, sourceRef: value.mandateSourceRef, sourceSha256: value.mandateFileSha256, employerEin: String(value.employerEin ?? '').replace(/\D/g, ''), agency: value.agency, state: value.state, representativeId: value.representativeId, effectiveFrom: value.effectiveFrom, effectiveThrough: value.effectiveThrough, scope: 'unemployment-claim-response' }, mandateReviewed: checked(value.mandateReviewed) } : {}),
      disputed: checked(value.disputed), missingFacts: lines(value.missingFacts), disputeResolutionRef: value.resolutionFileArtifactId,
    }
  }
  if (action === 'prepare') return { ...common, answers: [...Object.keys(value).filter(key => key.startsWith('answer.') && String(value[key] ?? '').trim()).map(key => ({ field: key.slice(7), value: String(value[key]), citations: lines(value['cite.' + key.slice(7)]) })), ...Object.keys(value).filter(key=>key.startsWith('question.')&&String(value[key]??'').trim()).map(key=>({field:'agency-question:'+key.slice(9),question:String(value[key]),questionSourceRef:value.questionSourceRef,value:String(value['response.'+key.slice(9)]??''),citations:lines(value['questionCitation.'+key.slice(9)])}))], preparer: { kind: value.preparerKind, name: value.preparerName, jobTitle: value.jobTitle, phone: value.phone, email: value.email } }
  if (action === 'portal-review') return {...common,portalResponseArtifactId:value.portalResponseFileArtifactId??value.portalResponseArtifactId,matchesReviewedResponse:checked(value.matchesReviewedResponse)}
  if (action === 'confirmation') return { ...common, confirmation: { requestIdentity: value.requestIdentity, responseDigest: value.responseDigest, confirmationNumber: value.confirmationNumber, employerEin: value.employerEin, stateEmployerId: value.stateEmployerId, submittedAt: common.submittedAt, sourceRef: value.sourceRef, sourceSha256: value.confirmationFileSha256, agencyMessage: value.agencyMessage }, reviewEvidence: checked(value.reviewEvidence), artifactId: value.confirmationFileArtifactId }
  if (action === 'follow-up') return { ...common, followUp: { requestIdentity: value.requestIdentity, agencyReference: value.agencyReference, employerEin: value.employerEin, stateEmployerId: value.stateEmployerId, receivedAt: common.receivedAt, dueOn: value.dueOn, deadlineAt: common.deadlineAt, timeZone: value.timeZone, deadlineBasis: value.deadlineBasis, questions: lines(value.questions).map(question => ({ question, sourceRef: String(value.sourceRef ?? '') })), sourceRef: value.sourceRef, sourceSha256: value.followUpFileSha256, ownerId: value.ownerId } }
  return common
}
export async function resolveClaimForm(action: string, value: Input, actor: Actor, store: WorkspaceStore): Promise<Input> {
  const result = claimForm(action, value)
  if (action === 'prepare' && !Array.isArray(value.answers)) {
    const selected = Object.keys(value).filter(key => key.startsWith('attachment.'))
    if (!selected.length) { result.attachments = []; return result }
    const row = await new ClaimLifecycle(store).details(actor, text(value.claimId))
    if (Number(result.version) !== row.version) throw new PayrollError('claim_version_changed', 409)
    result.attachments = selected.map(key => {
      if (!checked(value[key])) throw new PayrollError('invalid_claim_attachment_selection')
      const file = row.data.artifacts.find(artifact => artifact.id === key.slice(11))
      if (!file || !['application/pdf', 'text/plain', 'text/csv', 'application/rtf', 'image/tiff'].includes(file.mediaType)) throw new PayrollError('permitted_retained_attachment_required', 409)
      return { id: file.id, name: file.name, mediaType: file.mediaType, bytes: file.bytes, sha256: file.sha256, sourceRef: file.name }
    })
    return result
  }
  if (action !== 'evidence' || !result.willow || value.willow) return result
  const lifecycle = new ClaimLifecycle(store), scope = lifecycle.scope(actor), personId = text(result.personId)
  await store.records.person(actor, personId)
  const link = await store.records.statement(`SELECT source_key AS sourceKey FROM env_hris_people WHERE company_id=? AND person_id=? AND ${scope.sql}`, [actor.company, personId, ...scope.args]).first<{ sourceKey: string }>()
  if (!link) throw new PayrollError('claim_willow_worker_mapping_required', 409)
  const originals = await artifacts([], result.artifacts), data = { artifacts: originals }, willow = claimObject(result.willow)
  const manifest = claimObject(artifactText(data, willow.manifestArtifactId).text), recordsFile = artifactText(data, willow.recordsArtifactId), records = claimObject(recordsFile.text)
  const auditFile = artifactText(data, willow.auditArtifactId)
  let audit: Input[]
  try { const parsed = JSON.parse(auditFile.text); if (!Array.isArray(parsed)) throw 0; audit = parsed.map(claimObject) } catch { throw new PayrollError('invalid_willow_audit') }
  if (manifest.schema !== ['willow.employee-bundle','v1'].join('/') || records.schema !== ['willow.employee-records','v1'].join('/') || !Array.isArray(manifest.files) || !Array.isArray(records.records)) throw new PayrollError('native_willow_export_required')
  const entry = manifest.files.map(claimObject).find(file => file.path === 'records.json')
  if (entry?.sha256 !== recordsFile.file.sha256 || entry.size !== recordsFile.file.bytes) throw new PayrollError('willow_export_digest_mismatch', 409)
  const matchingPeople = (await Promise.all(records.records.map(async raw => {
    const person = claimObject(raw), key = await digest(JSON.stringify(['willow', text(person.personId)]))
    return key === link.sourceKey ? person : undefined
  }))).filter((person): person is Input => Boolean(person))
  if (matchingPeople.length !== 1) throw new PayrollError(matchingPeople.length ? 'ambiguous_willow_worker_evidence' : 'claim_willow_worker_mapping_mismatch', 409)
  const person = matchingPeople[0]
  if (!Array.isArray(person.employment) || !Array.isArray(person.lifecycle)) throw new PayrollError('complete_willow_separation_evidence_required', 409)
  const candidates = person.employment.map(claimObject).flatMap(employment => {
    if (!employment.endDate) return []
    return (person.lifecycle as unknown[]).map(claimObject).filter(item => item.kind === 'leaver' && item.status === 'completed' && item.period === employment.id && item.anchorDate === employment.endDate && Number(item.openTasks) === 0).map(item => ({ employment, item }))
  })
  if (candidates.length !== 1) throw new PayrollError(candidates.length ? 'ambiguous_willow_separation_evidence' : 'completed_willow_leaver_required', 409)
  const { employment, item } = candidates[0]
  const started = audit.some(event => {
    if (event.action !== 'leaver.start' || event.subject !== person.personId) return false
    const detail = claimObject(event.detail)
    return detail.case === item.id && detail.period === employment.id && detail.endDate === employment.endDate
  })
  if (!started || !audit.some(event => event.action === 'case.complete' && event.subject === item.id)) throw new PayrollError('native_willow_completion_audit_required', 409)
  result.willow = { ...willow, personId: person.personId, employmentId: employment.id, caseId: item.id, sourceRef: willow.sourceRef ? text(willow.sourceRef, 500) : `${recordsFile.file.name} · Willow export ${date(manifest.asOf)}` }
  return result
}
