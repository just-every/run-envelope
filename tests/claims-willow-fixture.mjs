import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { crc32 } from 'node:zlib'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

// Willow's native employee export is an uncompressed ZIP32 archive. Read its
// central directory independently of the writer, including each entry CRC.
function bundleFiles(bytes) {
  const end = bytes.length - 22, files = new Map()
  assert.ok(end >= 0, 'a complete Willow ZIP was downloaded')
  assert.equal(bytes.readUInt32LE(end), 0x06054b50)
  const count = bytes.readUInt16LE(end + 10)
  let position = bytes.readUInt32LE(end + 16)
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(position), 0x02014b50)
    assert.equal(bytes.readUInt16LE(position + 10), 0, 'native stored ZIP entry')
    const size = bytes.readUInt32LE(position + 24), nameSize = bytes.readUInt16LE(position + 28)
    const name = bytes.subarray(position + 46, position + 46 + nameSize).toString('utf8')
    const local = bytes.readUInt32LE(position + 42)
    assert.equal(bytes.readUInt32LE(local), 0x04034b50)
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    const content = bytes.subarray(start, start + size)
    assert.equal(content.length, size)
    assert.equal(crc32(content), bytes.readUInt32LE(position + 16), name + ' checksum')
    assert.ok(!files.has(name), 'unique ZIP entry')
    files.set(name, content)
    position += 46 + nameSize + bytes.readUInt16LE(position + 30) + bytes.readUInt16LE(position + 32)
  }
  assert.equal(position, end)
  return files
}

/** Accept the original extracted files from a captured native export, unchanged. */
export function capturedWillowClaimsFixture(capture) {
  const { manifest, recordsText, audit, sourceRef, personId, employmentId, caseId } = capture
  assert.equal(manifest.schema, ['willow.employee-bundle', 'v1'].join('/'))
  assert.equal(manifest.project, ['people', 'willow'].join('/'))
  assert.ok(manifest.sections.includes('employment') && manifest.sections.includes('lifecycle'))
  const file = manifest.files.find(item => item.path === 'records.json')
  assert.ok(file, 'native manifest covers records.json')
  assert.equal(Buffer.byteLength(recordsText), file.size)
  assert.equal(digest(Buffer.from(recordsText)), file.sha256)
  const records = JSON.parse(recordsText)
  assert.equal(records.schema, ['willow.employee-records', 'v1'].join('/'))
  const record = records.records.find(item => item.personId === personId)
  assert.ok(record, 'selected source person is present')
  assert.ok(!record.withheldSections.includes('employment') && !record.withheldSections.includes('lifecycle'))
  const employment = record.employment.find(item => item.id === employmentId)
  const leaver = record.lifecycle.find(item => item.id === caseId)
  assert.ok(employment?.endDate && employment.endReason, 'private native separation reason is readable')
  assert.equal(leaver?.kind, 'leaver')
  assert.equal(leaver.period, employmentId)
  assert.equal(leaver.status, 'completed')
  assert.ok(leaver.tasks.length && leaver.tasks.every(task => task.status === 'completed'))
  assert.ok(leaver.tasks.some(task => task.evidenceRequired && task.evidence && task.completedAt))
  const started = audit.find(event => event.action === 'leaver.start' && event.subject === personId && JSON.parse(event.detail).case === caseId)
  const completed = audit.find(event => event.action === 'case.complete' && event.subject === caseId)
  assert.ok(started?.actor && completed?.actor, 'native committed author and completion actors remain separate facts')
  assert.equal(JSON.parse(started.detail).period, employmentId)
  assert.equal(JSON.parse(started.detail).endDate, employment.endDate)
  for (const task of leaver.tasks.filter(item => item.evidenceRequired)) {
    assert.ok(audit.some(event => event.action === 'task.complete' && event.subject === task.id && JSON.parse(event.detail).case === caseId))
  }
  return {
    willow: { manifest, recordsText, audit, sourceRef, personId, employmentId, caseId },
    manifest, recordsText, audit, sourceRef, personId, sourcePersonId: personId, employmentId, caseId,
    record, employment, leaver,
    provenance: { recordedBy: started.actor, recordedAt: started.at, completedBy: completed.actor, completedAt: completed.at },
  }
}

/**
 * The parent starts and closes Willow's REAL built-Worker harness, with the
 * standard official-schema mail edge, then passes h here. This helper never
 * starts a process, edits sibling source, writes its database, or makes an
 * invented source payload. A saved capture can instead use the helper above.
 */
export async function claimsWillowFixture(h, options = {}) {
  const {
    employerName = 'Synthetic Envelope separation employer',
    workerName = 'Synthetic separated worker', payrollId = 'synthetic-envelope-6901',
    startDate = '2026-01-05', endDate = '2026-10-16', lastDayWorked = '2026-10-15',
    reason = 'Position eliminated after the employer closed this work location.',
    reviewEvidence = `Reviewed employer separation notice and attendance record. Last day actually worked: ${lastDayWorked}. Last day of employment: ${endDate}. Position eliminated; no misconduct assertion.`,
  } = options
  assert.equal((await h.raw('/auth/bootstrap', { body: { token: h.vars.SETUP_TOKEN, displayName: 'Synthetic HR reviewer' } })).status, 303)
  const cookie = await h.signIn(h.vars.OWNER_EMAIL)
  assert.equal((await h.raw('/setup', { cookie, form: new URLSearchParams({ confirm: 'yes' }) })).status, 303)
  const api = (path, body) => h.api(path, cookie, body)
  const timezone = ['America', 'New_York'].join('/')
  await api('employer.configure', { name: employerName, timezone, country: 'US', currency: 'USD' })
  const member = await api('me')
  const location = await api('location.create', { name: 'Synthetic Pennsylvania workplace', timezone, workState: 'PA' })
  const entity = await api('entity.create', { name: employerName })
  const schedule = await api('schedule.create', { name: 'Synthetic five day week', mon: '8', tue: '8', wed: '8', thu: '8', fri: '8', sat: '0', sun: '0' })
  const publish = async (kind, name, title, evidence) => {
    const template = await api('template.create', {
      kind, name, requiredFields: ['payroll_id'], taskTitle: [title], taskAssignee: ['hr'],
      taskDueDays: ['0'], taskEvidence: [evidence ? 'yes' : 'no'], taskSystem: [''], taskAction: [''],
    })
    const preview = await api('template.preview', { template: template.id })
    await api('template.publish', { review: preview.id })
    return template
  }
  const joiner = await publish('joiner', 'Synthetic reviewed employment', 'Review employment record', false)
  const leaver = await publish('leaver', 'Synthetic reviewed separation', 'Review separation notice and actual last day worked', true)
  const started = await api('joiner.start', {
    template: joiner.id, legalName: workerName, workEmail: 'synthetic-separated-worker@example.test',
    employeeNumber: payrollId, startDate, employmentType: 'full_time', payrollId,
    jobTitle: 'Production associate', locationId: location.id, scheduleId: schedule.id,
    payBasis: 'hourly', payAmount: '25.00',
  })
  await api('period.entity', { period: started.period, entity: entity.id })
  for (const task of (await api('cases/' + started.case)).tasks) await api('task.complete', { task: task.id })
  await api('case.complete', { case: started.case })
  const ended = await api('leaver.start', { period: started.period, endDate, reason, template: leaver.id })
  for (const task of (await api('cases/' + ended.case)).tasks)
    await api('task.complete', { task: task.id, evidence: reviewEvidence })
  await api('case.complete', { case: ended.case })
  const current = await api('me')
  const asOf = current.today > endDate ? current.today : endDate
  const params = new URLSearchParams({ scope: 'organization', fields: 'name,startDate,endDate,payrollId',
    history: 'employment,lifecycle', person: started.person, asOf })
  const exportPath = '/app/exports/employees.zip?' + params
  const response = await h.raw(exportPath, { cookie })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /application\/zip/)
  const bytes = Buffer.from(await response.arrayBuffer()), files = bundleFiles(bytes)
  const manifest = JSON.parse(files.get('manifest.json').toString('utf8'))
  for (const file of manifest.files) {
    assert.equal(files.get(file.path)?.length, file.size)
    assert.equal(digest(files.get(file.path)), file.sha256)
  }
  const auditResponse = await h.raw('/api/willow/audit', { cookie })
  assert.equal(auditResponse.status, 200)
  const auditText = await auditResponse.text(), audit = JSON.parse(auditText)
  const captured = capturedWillowClaimsFixture({ manifest, recordsText: files.get('records.json').toString('utf8'),
    audit, sourceRef: h.origin + exportPath + '#sha256=' + digest(bytes),
    personId: started.person, employmentId: started.period, caseId: ended.case })
  assert.equal(captured.provenance.recordedBy, member.id)
  assert.equal(captured.provenance.completedBy, member.id)
  assert.equal(captured.employment.endReason, reason)
  assert.ok(captured.leaver.tasks.some(task => task.evidence === reviewEvidence))
  return { ...captured, bytes, zipBytes: bytes, zipSha256: digest(bytes), files,
    manifestText: files.get('manifest.json').toString('utf8'), auditText,
    originals: {
      manifest: { filename: 'willow-manifest.json', bytes: files.get('manifest.json') },
      records: { filename: 'willow-records.json', bytes: files.get('records.json') },
      audit: { filename: 'willow-audit.json', bytes: Buffer.from(auditText) },
    },
    origin: h.origin, exportPath, cookie, reviewer: member, employerName, workerName, payrollId,
    startDate, endDate, lastDayWorked, reason, reviewEvidence, legalEntityId: entity.id }
}
