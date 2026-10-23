import type { Actor } from '../access'
import { auditStatement, fence, requireAction } from '../access'
import { PayrollError, date, integer, recordKey, seal, text, unseal } from '../security'
import { WorkspaceStore, currentSources, digest, type Sources, type Revision } from '../workspace/store'
import type { ClaimData, ClaimRecord, ClaimRepresentative } from './types'

export const claimKind = 'ui-claim' as const
export const human = (actor: Actor) => {
  if (!['native', 'password', 'oidc', 'dev'].includes(actor.session.kind)) throw new PayrollError('human_session_required', 403)
}
export const latestClaim = (alias: string) => `${alias}.version=(SELECT MAX(version) FROM env_workspace_versions nc WHERE nc.company_id=${alias}.company_id AND nc.kind=${alias}.kind AND nc.object_id=${alias}.object_id)`
export const representativeSql = `EXISTS(SELECT 1 FROM oa_operators ro JOIN env_grants rg ON rg.operator_id=ro.id
 WHERE ro.id=? AND ro.status='active' AND ro.version=? AND rg.company_id=? AND rg.role='owner' AND rg.revoked_at IS NULL AND rg.version=?)`
export const representativeArgs = (actor: Actor, r: ClaimRepresentative) => [r.id, r.operatorVersion, actor.company, r.grantVersion]
export class ClaimLifecycle {
  constructor(public store: WorkspaceStore) {}
  scope(actor: Actor) {
    if (actor.grant.role !== 'owner' || !actor.grant.locations.includes('*')) throw new PayrollError('owner_required', 403)
    requireAction(actor, 'records:read', undefined, 'compensation')
    requireAction(actor, 'private:read', undefined, 'tax')
    requireAction(actor, 'private:read', undefined, 'ssn')
    const f = fence(actor)
    return { sql: `${f.sql} AND EXISTS(SELECT 1 FROM env_grants cg WHERE cg.company_id=? AND cg.operator_id=? AND cg.role='owner' AND cg.revoked_at IS NULL AND cg.version=?)`, args: [...f.args, actor.company, actor.session.operator.id, actor.grant.version] }
  }
  async representative(actor: Actor, id: string): Promise<ClaimRepresentative> {
    const f = this.scope(actor)
    const row = await this.store.records.statement(`SELECT o.id,o.display_name AS name,o.version AS operatorVersion,g.version AS grantVersion FROM oa_operators o JOIN env_grants g ON g.operator_id=o.id WHERE o.id=? AND o.status='active' AND g.company_id=? AND g.role='owner' AND g.revoked_at IS NULL AND ${f.sql}`, [text(id), actor.company, ...f.args]).first<ClaimRepresentative>()
    if (!row) throw new PayrollError('named_employer_representative_required', 403)
    return row
  }
  async history(actor: Actor, id?: string): Promise<ClaimRecord[]> {
    const f = this.scope(actor), key = await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY), event = crypto.randomUUID()
    const results = await this.store.records.env.DB.batch<Record<string, unknown>>([
      auditStatement(this.store.records.env, actor, event, 'claim.evidence.read', id || actor.company, actor.grant.version),
      this.store.records.statement(`SELECT v.object_id AS id,v.kind,v.version,v.created_by AS createdBy,v.created_at AS createdAt,v.cipher,(${currentSources('v')}) AS sourcesCurrent FROM env_workspace_versions v WHERE v.company_id=? AND v.kind='ui-claim' ${id ? 'AND v.object_id=?' : ''} AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?) ORDER BY v.object_id,v.version DESC`, [actor.company, ...(id ? [id] : []), ...f.args, event]),
    ])
    if (!results[0].meta.changes) throw new PayrollError('claim_authority_changed', 409)
    return Promise.all(results[1].results.map(async ({ cipher, ...r }) => ({ ...r, personId: null, personVersion: null, approvedBy: null, approvedAt: null, withdrawnBy: null, data: JSON.parse(await unseal(key, JSON.stringify([actor.company, claimKind, r.id, r.version]), String(cipher))) } as unknown as ClaimRecord)))
  }
  async details(actor: Actor, id: string) {
    const row = (await this.history(actor, text(id)))[0]
    if (!row) throw new PayrollError('claim_not_found', 404)
    return row
  }
  async company(actor: Actor) {
    const f = this.scope(actor)
    const row = await this.store.records.statement(`SELECT name,ein_cipher AS cipher FROM env_companies WHERE id=? AND ${f.sql}`, [actor.company, ...f.args]).first<{ name: string; cipher: string }>()
    if (!row) throw new PayrollError('claim_authority_changed', 403)
    const ein = await unseal(await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY), JSON.stringify([actor.company, 'ein']), row.cipher)
    return { ein: ein.replace(/\D/g, ''), legalName: row.name }
  }
  async append(actor: Actor, id: string, expected: number, data: ClaimData, action: string, extra = { sql: '1', args: [] as unknown[] }, staleEvidence = false) {
    const f = this.scope(actor), version = expected + 1, event = crypto.randomUUID(), records = this.store.records
    const key = await recordKey(records.env.ENVELOPE_RECORD_KEY), cipher = await seal(key, JSON.stringify([actor.company, claimKind, id, version]), JSON.stringify(data))
    const objects: NonNullable<Sources['objects']> = data.payroll.map(p => ({ kind: p.kind, id: p.id, version: p.version, approved: true }))
    const people = data.worker ? [{ id: data.worker.id, version: data.worker.version }] : []
    const deps = `NOT EXISTS(SELECT 1 FROM json_each(?) pin WHERE NOT EXISTS(SELECT 1 FROM env_workspace_versions sv WHERE sv.company_id=? AND sv.kind=json_extract(pin.value,'$.kind') AND sv.object_id=json_extract(pin.value,'$.id') AND sv.version=json_extract(pin.value,'$.version') ${staleEvidence ? '' : `AND ${latestClaim('sv')} AND ${currentSources('sv')} AND EXISTS(SELECT 1 FROM env_workspace_decisions sd WHERE sd.company_id=sv.company_id AND sd.kind=sv.kind AND sd.object_id=sv.object_id AND sd.version=sv.version AND sd.decision='approved') AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions sd WHERE sd.company_id=sv.company_id AND sd.kind=sv.kind AND sd.object_id=sv.object_id AND sd.version=sv.version AND sd.decision='withdrawn')`}))`
    const personSql = data.worker && !staleEvidence ? `AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?) AND EXISTS(SELECT 1 FROM env_private_records WHERE company_id=? AND person_id=? AND kind='ssn' AND version=?)` : ''
    const personArgs = data.worker && !staleEvidence ? [actor.company, data.worker.id, data.worker.version, actor.company, data.worker.id, data.worker.ssnVersion] : []
    const result = await records.env.DB.batch([
      records.statement(`INSERT INTO env_workspace_versions(company_id,kind,object_id,version,cipher,created_by,created_at,change_id)
        SELECT ?,'ui-claim',?,?,?,?,?,? WHERE ${f.sql}
        AND COALESCE((SELECT MAX(version) FROM env_workspace_versions WHERE company_id=? AND kind='ui-claim' AND object_id=?),0)=?
        AND ${deps} ${personSql} AND ${extra.sql} RETURNING version`, [actor.company, id, version, cipher, actor.session.operator.id, Date.now(), event, ...f.args, actor.company, id, expected, JSON.stringify(objects), actor.company, ...personArgs, ...extra.args]),
      records.statement(`INSERT INTO env_workspace_people(company_id,kind,object_id,version,person_id,person_version) SELECT ?,'ui-claim',?,?,json_extract(value,'$.id'),json_extract(value,'$.version') FROM json_each(?) WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`, [actor.company, id, version, JSON.stringify(people), event]),
      records.statement(`INSERT INTO env_workspace_dependencies(company_id,kind,object_id,version,source_kind,source_id,source_version,needs_approval) SELECT ?,'ui-claim',?,?,json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.version'),1 FROM json_each(?) WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`, [actor.company, id, version, JSON.stringify(objects), event]),
      auditStatement(records.env, actor, event, action, id, version, 'EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)', [event]),
    ])
    if (!result[0].results.length) throw new PayrollError('claim_source_or_authority_changed', 409)
    return { id, kind: claimKind, version }
  }
  async review(actor: Actor, row: ClaimRecord) {
    human(actor)
    if (!row.data.responseDigest || !row.data.packet || row.data.holds.length || !row.sourcesCurrent || row.data.handoff) throw new PayrollError('claim_not_ready_for_review', 409)
    const token = crypto.randomUUID() + crypto.randomUUID(), tokenHash = await digest(token), f = this.scope(actor), event = crypto.randomUUID()
    const results = await this.store.records.env.DB.batch([
      this.store.records.statement(`INSERT INTO env_workspace_reviews(token_hash,company_id,kind,object_id,version,session_id,operator_id,grant_version,expires_at) SELECT ?,?,'ui-claim',?,?,?,?,?,? WHERE ${f.sql} AND EXISTS(SELECT 1 FROM env_workspace_versions v WHERE v.company_id=? AND v.kind='ui-claim' AND v.object_id=? AND v.version=? AND ${latestClaim('v')} AND ${currentSources('v')}) RETURNING token_hash`, [tokenHash, actor.company, row.id, row.version, actor.session.id, actor.session.operator.id, actor.grant.version, Date.now() + 600000, ...f.args, actor.company, row.id, row.version]),
      auditStatement(this.store.records.env, actor, event, 'claim.response.reviewed', row.id, row.version, 'EXISTS(SELECT 1 FROM env_workspace_reviews WHERE token_hash=?)', [tokenHash]),
    ])
    if (!results[0].results.length) throw new PayrollError('claim_review_changed', 409)
    return { ...row, reviewToken: token, responseDigest: row.data.responseDigest }
  }
}
export const exactVersion = (row: Pick<Revision<unknown>, 'version'>, input: Record<string, unknown>) => {
  if (Number(input.version) !== row.version) throw new PayrollError('claim_version_changed', 409)
}

export function claimObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { return claimObject(JSON.parse(value)) } catch { throw new PayrollError('invalid_claim_evidence') }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PayrollError('invalid_claim_evidence')
  return value as Record<string, unknown>
}
export function claimInstant(value: unknown) {
  const raw = text(value, 40), time = Date.parse(raw)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== raw) throw new PayrollError('invalid_claim_instant')
  return raw
}
export const claimEvidenceText = (value: unknown, max = 10000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new PayrollError('invalid_claim_evidence_text')
  return value.trim()
}
export const reviewed = (value: unknown) => value === true || value === 'true'
export const hexDigest = (value: unknown) => {
  const v = text(value, 64)
  if (!/^[a-f0-9]{64}$/.test(v)) throw new PayrollError('invalid_evidence_digest')
  return v
}
export function escalation(data: ClaimData, reason: string) {
  const now = Date.now()
  return { id: crypto.randomUUID(), reason, representativeId: data.representative.id, representativeName: data.representative.name, recordedAt: now, deadlineAt: data.request.deadlineAt, beforeDeadline: now < Date.parse(data.request.deadlineAt), status: 'assigned-in-envelope' as const }
}
export async function artifacts(existing: import('./types').ClaimArtifactFile[], input: unknown) {
  if (input === undefined) return existing
  if (!Array.isArray(input) || input.length > 12) throw new PayrollError('invalid_claim_artifacts')
  const added = await Promise.all(input.map(async value => {
    const file = claimObject(value), id = text(file.id, 80), name = text(file.name, 200), mediaType = text(file.mediaType, 100)
    if (!/^[A-Za-z0-9][-A-Za-z0-9_]{0,79}$/.test(id) || !['application/pdf', 'application/json', 'text/plain', 'text/html', 'text/csv', 'image/png', 'image/jpeg', 'image/tiff', 'application/rtf'].includes(mediaType)) throw new PayrollError('invalid_claim_artifact')
    if (typeof file.contentBase64 !== 'string' || file.contentBase64.length > 700000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.contentBase64)) throw new PayrollError('invalid_claim_artifact')
    let bytes: Uint8Array
    try { bytes = Uint8Array.from(atob(file.contentBase64), c => c.charCodeAt(0)) } catch { throw new PayrollError('invalid_claim_artifact') }
    if (!bytes.length || bytes.length > 512 * 1024) throw new PayrollError('claim_artifact_too_large')
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), b => b.toString(16).padStart(2, '0')).join('')
    if (file.sha256 && file.sha256 !== sha256) throw new PayrollError('claim_artifact_digest_mismatch')
    return { id, name, mediaType, contentBase64: file.contentBase64, sha256, bytes: bytes.length }
  }))
  const result = [...existing]
  for (const file of added) {
    const old = result.find(f => f.id === file.id)
    if (old && (old.sha256 !== file.sha256 || old.name !== file.name || old.mediaType !== file.mediaType)) throw new PayrollError('claim_artifact_identity_conflict', 409)
    if (!old) result.push(file)
  }
  if (result.length > 30 || result.reduce((n, f) => n + f.bytes, 0) > 2 * 1024 * 1024) throw new PayrollError('claim_artifacts_too_large')
  return result
}
export function retainedArtifact(data: Pick<ClaimData, 'artifacts'>, sha256: string) {
  const file = data.artifacts.find(a => a.sha256 === sha256)
  if (!file) throw new PayrollError('retained_original_artifact_required', 409)
  return file
}
export function artifactText(data: Pick<ClaimData, 'artifacts'>, id: unknown) {
  const file = data.artifacts.find(a => a.id === text(id, 80))
  if (!file) throw new PayrollError('retained_original_artifact_required', 409)
  try { return { file, text: new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(file.contentBase64), c => c.charCodeAt(0))) } } catch { throw new PayrollError('invalid_claim_json_artifact') }
}
export function willowEvidence(actor: Actor, data: ClaimData, input: Record<string, unknown>): import('./types').ClaimWillowFacts {
  human(actor)
  const manifestFile = artifactText(data, input.manifestArtifactId), recordsFile = artifactText(data, input.recordsArtifactId), auditFile = artifactText(data, input.auditArtifactId)
  const manifest = claimObject(manifestFile.text), records = claimObject(recordsFile.text)
  let audit: Record<string, unknown>[]
  try { const parsed = JSON.parse(auditFile.text); if (!Array.isArray(parsed)) throw 0; audit = parsed.map(claimObject) } catch { throw new PayrollError('invalid_willow_audit') }
  if (manifest.schema !== ['willow.employee-bundle','v1'].join('/') || records.schema !== ['willow.employee-records','v1'].join('/') || !Array.isArray(manifest.files) || !Array.isArray(records.records)) throw new PayrollError('native_willow_export_required')
  const recordEntry = manifest.files.map(claimObject).find(f => f.path === 'records.json')
  if (recordEntry?.sha256 !== recordsFile.file.sha256 || recordEntry.size !== recordsFile.file.bytes) throw new PayrollError('willow_export_digest_mismatch', 409)
  const personId = text(input.personId), employmentId = text(input.employmentId), caseId = text(input.caseId)
  const person = records.records.map(claimObject).find(p => p.personId === personId)
  if (!person || !Array.isArray(person.employment) || !Array.isArray(person.lifecycle) || (Array.isArray(person.withheldSections) && person.withheldSections.some(v => ['employment', 'lifecycle'].includes(String(v))))) throw new PayrollError('complete_willow_separation_evidence_required', 409)
  const employment = person.employment.map(claimObject).find(e => e.id === employmentId), lifecycle = person.lifecycle.map(claimObject).find(c => c.id === caseId)
  if (!employment || !lifecycle || lifecycle.kind !== 'leaver' || lifecycle.status !== 'completed' || Number(lifecycle.openTasks) !== 0 || !Array.isArray(lifecycle.tasks)) throw new PayrollError('completed_willow_leaver_required', 409)
  const tasks = lifecycle.tasks.map(claimObject), sourceStart = audit.find(a => {
    if (a.action !== 'leaver.start' || a.subject !== personId) return false
    const detail = claimObject(a.detail)
    return detail.case === caseId && detail.period === employmentId && detail.endDate === employment.endDate
  }), sourceComplete = audit.find(a => a.action === 'case.complete' && a.subject === caseId)
  if (!sourceStart || !sourceComplete || !tasks.length || tasks.some(t => t.status !== 'completed' || (t.evidenceRequired && (typeof t.evidence !== 'string' || !t.evidence.trim())) || !audit.some(a => a.action === 'task.complete' && a.subject === t.id && claimObject(a.detail).case === caseId))) throw new PayrollError('native_willow_completion_audit_required', 409)
  const facts = tasks.filter(t => typeof t.evidence === 'string' && t.evidence.trim()).map(t => `${text(t.title, 200)}: ${claimEvidenceText(t.evidence, 4000)}`).join('\n')
  const separationDate = date(employment.endDate), lastDayWorked = date(input.lastDayWorked)
  if (lastDayWorked > separationDate || !facts.includes(lastDayWorked)) throw new PayrollError('evidenced_actual_last_day_worked_required', 409)
  if (typeof employment.endReason !== 'string' || !employment.endReason.trim()) throw new PayrollError('willow_separation_reason_required', 409)
  const completedAt = Number(sourceComplete.at)
  if (!Number.isSafeInteger(completedAt) || completedAt < 1 || completedAt > Date.now()) throw new PayrollError('invalid_willow_completion_time')
  const reason = text(employment.endReason, 1000), sourceApprovedAt = new Date(completedAt).toISOString()
  if (Date.parse(sourceApprovedAt) > Date.now()) throw new PayrollError('invalid_willow_completion_time')
  return { source: 'willow', portalReason: text(input.portalReason, 200), artifactId: recordsFile.file.id, sourceVersion: text(person.revision, 100), sourceRef: text(input.sourceRef, 500), sourceSha256: recordsFile.file.sha256,
    sourcePersonId: personId, sourceApprovedBy: text(sourceComplete.actor), sourceApprovedAt, effectiveDate: separationDate, separationDate, lastDayWorked, reason, facts,
    reviewedBy: actor.session.operator.id, reviewedAt: new Date().toISOString(), sourceArtifact: { manifest, person, audit: audit.filter(a => a === sourceStart || a === sourceComplete || tasks.some(t => t.id === a.subject)) } }
}
