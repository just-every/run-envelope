import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const mime = (type, subtype) => [type, subtype].join('/')
const day = (value, offset = 0) => new Date(Date.parse(value + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10)
const today = () => new Date().toISOString().slice(0, 10)

/** A retained original test artifact, representing bytes at the agency or employer document edge. */
export function claimArtifact(id, name, content, mediaType = mime('text', 'plain')) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content)
  return { id, name, mediaType, contentBase64: bytes.toString('base64'), sha256: sha(bytes), bytes: bytes.length }
}

/**
 * Creates business records through native public doors. The caller supplies an
 * actual Willow capture, or an explicitly test-only fixture at that source edge.
 * No SQL business writes, invented reviewed flags, processes or provider calls.
 */
export async function claimsFixture(context, { willow } = {}) {
  assert.ok(willow, 'a native Willow export capture or declared source-edge test fixture is required')
  const { origin, cookie } = context
  const transport = context.worker ? (url, options) => context.worker.fetch(url, options) : (url, options) => fetch(url, options)
  const call = (path, body, who = cookie) => transport(origin + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { cookie: who, origin, host: new URL(origin).host, 'content-type': mime('application', 'json') },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = async (path, body, status = 200, who = cookie) => {
    const response = await call(path, body, who)
    assert.equal(response.status, status, path + ' ' + await response.clone().text())
    return response.json()
  }
  const capture = willow.willow ?? willow
  const recordsText = willow.recordsText ?? capture.recordsText
  const records = JSON.parse(recordsText)
  const record = records.records.find(row => row.personId === capture.personId)
  assert.ok(record, 'the original export contains the requested source worker')
  const employment = record.employment.find(row => row.id === capture.employmentId)
  const leaver = record.lifecycle.find(row => row.id === capture.caseId)
  assert.ok(employment?.startDate && employment.endDate && employment.endReason && leaver?.tasks?.length)
  const lastDayWorked = willow.lastDayWorked ?? capture.lastDayWorked
  assert.ok(lastDayWorked && leaver.tasks.some(task => String(task.evidence).includes(lastDayWorked)), 'actual last day worked comes from explicit retained HR evidence')
  const session = await data('/auth/session'), operator = session.operator
  assert.ok(operator?.id && operator.displayName, 'the current native operator supplies representative identity')
  const nonce = randomUUID().slice(0, 8), ein = '00-0006901', normalizedEin = ein.replace('-', '')
  const workerName = willow.workerName ?? capture.workerName
  const employerName = willow.employerName ?? employment.legalEntity?.name
  assert.ok(typeof workerName === 'string' && workerName && typeof employerName === 'string' && employerName,
    'source worker and employer names come from the native capture or its declared test-edge identity')
  const company = await data('/api/envelope/companies', { name: employerName, ein }, 201)
  const base = '/api/envelope/companies/' + company.id
  const location = await data(base + '/locations', { name: 'Pennsylvania workplace', state: 'PA' }, 201)
  const sourceAudit = capture.audit ?? willow.audit
  const sourceAuthor = sourceAudit.find(row => row.action === 'leaver.start' && row.subject === capture.personId)
  assert.ok(sourceAuthor?.actor)
  const hire = await data(base + '/hris-hires', {
    provider: 'willow', version: 0, sourceVersion: 1, sourcePersonId: capture.personId,
    sourceEvidence: capture.sourceRef, sourceApprovedBy: sourceAuthor.actor,
    export: { schema: 'envelope-willow-payroll@1', sourceId: capture.employmentId,
      effectiveDate: employment.startDate, values: { name: workerName, locationId: location.id } },
  }, 201)
  const hireReview = await data(base + '/hris-hires/' + hire.id + '/review')
  await data(base + '/hris-hires/' + hire.id + '/approve', { version: hireReview.version, reviewToken: hireReview.reviewToken })
  const person = await data(base + '/hris-hires/' + hire.id + '/apply', { version: hireReview.version }, 201)
  const personPath = base + '/people/' + person.id
  const ssn = '900-69-0001'
  await data(personPath + '/private', { kind: 'ssn', version: 0, value: ssn }, 201)

  const originals = willow.originals
  const original = (key, textKey) => {
    if (originals?.[key]?.bytes) return Buffer.from(originals[key].bytes)
    assert.equal(typeof willow[textKey], 'string', 'captured original ' + key + ' text is required')
    return Buffer.from(willow[textKey])
  }
  const manifestFile = claimArtifact('willow-manifest-' + nonce, 'willow-manifest.json', original('manifest', 'manifestText'), mime('application', 'json'))
  const recordsFile = claimArtifact('willow-records-' + nonce, 'willow-records.json', original('records', 'recordsText'), mime('application', 'json'))
  const auditFile = claimArtifact('willow-audit-' + nonce, 'willow-audit.json', original('audit', 'auditText'), mime('application', 'json'))
  const period = { from: day(lastDayWorked, -6), through: lastDayWorked }
  const grossCents = 100000
  const registerText = `Synthetic original employer payroll register\nWorker: ${workerName}\nPayroll identifier: ${person.id}\nPeriod: ${period.from} through ${period.through}\nGross wages: $1000.00\nRegular rate: $25.00 hourly. Eight hours worked on October 9, 12, 13, 14 and 15, 2026. Forty hours total. Paid October 16, 2026. Weekly earnings: $200.00 in the week ending October 10, $800.00 in the week ending October 17.\nEmployer reviewed declaration: nonseasonal employment; no compensation after the last day worked except wages for hours worked; no company pension or 401K disbursement; no workers compensation.\n`
  const registerFile = claimArtifact('payroll-register-' + nonce, 'synthetic-reviewed-payroll-register.txt', registerText)
  const registerRef = 'Retained original employer register ' + registerFile.id
  const registerDoor = personPath + '/verification'
  const incomeInput = { id: 'synthetic-envelope-claims-register-' + nonce, version: 0, ...period, grossCents,
    sourceRef: registerRef, evidence: 'Reviewed original employer register: $1000 gross. Nonseasonal; no post-work compensation except regular wages, pension or 401K disbursement, or workers compensation.' }
  const income = await data(registerDoor + '/income', incomeInput, 201)
  const incomeReview = await data(registerDoor + '/income-source/' + income.id + '/review')
  await data(registerDoor + '/income-source/' + income.id + '/approve', { version: incomeReview.version, reviewToken: incomeReview.reviewToken })
  const payroll = { kind: 'income-source', id: income.id, version: income.version }
  const claims = base + '/claims', timeZone = ['America', 'New_York'].join('/')
  const dueOn = day(today(), 10), deadlineAt = dueOn + 'T20:00:00.000Z'
  const agency = 'Pennsylvania Department of Labor & Industry', stateEmployerId = 'synthetic-pa-6901'
  const portalReason = ['Laid Off', 'Lack of Work'].join('/')
  const requestId = 'synthetic-sides-separation-' + nonce
  const requestText = `Synthetic SIDES E-Response Separation Information request at the official portal edge\nState: PA\nAgency: ${agency}\nFEIN: ${ein}\nSEIN: ${stateEmployerId}\nClaim Number: ${requestId}\nClaimant Name: ${workerName}\nSocial Security Number: ${ssn}\nRequest Date: ${today()}\nResponse Due Date: ${dueOn}\nResponse Status: Not Started\nClaimant stated reason: ${portalReason}\n`
  const requestFile = claimArtifact('agency-request-' + nonce, 'synthetic-sides-separation-request.txt', requestText)
  const request = { exchange: 'separation', requestId, agency, state: 'PA', employerEin: normalizedEin, stateEmployerId,
    claimantName: workerName, claimantIdentifier: ssn, issuedOn: today(), dueOn, deadlineAt, timeZone,
    deadlineBasis: 'internal-cutoff-on-agency-due-date', sourceRef: 'SIDES E-Response retained separation request ' + requestId,
    sourceSha256: requestFile.sha256, portalUrl: 'https://uisides.org/', claimantStatedReason: portalReason, responseStatus: 'Not Started' }
  const mandateText = `Synthetic signed employer mandate at the document edge\nEmployer: ${company.name}\nEIN: ${ein}\nAgency: ${agency}\nState: PA\nRepresentative: ${operator.displayName} (${operator.id})\nScope: unemployment-claim-response\nEffective: ${day(today(), -30)} through ${day(today(), 365)}\nAuthorized employer separation and wage responses only.\n`
  const mandateFile = claimArtifact('employer-mandate-' + nonce, 'synthetic-signed-claim-mandate.txt', mandateText)
  const validRequest = (overrides = {}) => {
    const value={...request,...overrides}
    const file=claimArtifact(requestFile.id,requestFile.name,`Synthetic SIDES E-Response request at the official portal edge\nClaim Number: ${value.requestId}\nAgency: ${value.agency}\nState: ${value.state}\nFEIN: ${value.employerEin}\nSEIN: ${value.stateEmployerId}\nClaimant Name: ${value.claimantName}\nSocial Security Number: ${value.claimantIdentifier}\nRequest Date: ${value.issuedOn}\nResponse Due Date: ${value.dueOn}\nResponse Status: Not Started\nClaimant stated reason: ${value.claimantStatedReason}\n`)
    return {request:{...value,sourceSha256:file.sha256},representativeId:operator.id,escalationAt:day(value.dueOn,-2)+'T16:00:00.000Z',artifacts:[file]}
  }
  const evidence = (version, overrides = {}) => ({ version, personId: person.id, payroll: [payroll],
    artifacts: [manifestFile, recordsFile, auditFile, mandateFile, registerFile],
    willow: { manifestArtifactId: manifestFile.id, recordsArtifactId: recordsFile.id, auditArtifactId: auditFile.id,
      sourceRef: capture.sourceRef, personId: capture.personId, employmentId: capture.employmentId, caseId: capture.caseId,
      lastDayWorked, portalReason }, willowReviewed: true,
    mandate: { artifactId: mandateFile.id, sourceRef: 'Retained signed employer mandate ' + mandateFile.id,
      sourceSha256: mandateFile.sha256, sourceVersion: 1, employerEin: normalizedEin, agency, state: 'PA',
      representativeId: operator.id, effectiveFrom: day(today(), -30), effectiveThrough: day(today(), 365), scope: 'unemployment-claim-response' },
    mandateReviewed: true, disputed: false, missingFacts: [], ...overrides })
  const sourceCitation = [recordsFile.id], payrollCitation = [payroll.id, registerFile.id]
  const term = employment.terms?.find(row => row.status === 'active')
  assert.ok(term?.jobTitle, 'the native employment history supplies the job title')
  const prepare = (version, overrides = {}) => ({ version,
    answers: [
      { field: 'employerReason', value: portalReason, citations: sourceCitation },
      { field: 'jobTitle', value: term.jobTitle, citations: sourceCitation },
      { field: 'firstDayOfWork', value: employment.startDate, citations: sourceCitation },
      { field: 'lastDayWorked', value: lastDayWorked, citations: sourceCitation },
      ...['seasonal', 'compensationAfterSeparation', 'pensionOr401k', 'workersCompensation'].map(field => ({ field, value: 'No', citations: payrollCitation })),
    ], preparer: { kind: 'Employer', name: operator.displayName, jobTitle: 'Employer representative', phone: '202-555-0169', email: operator.email },
    attachments: [{ id: registerFile.id, name: registerFile.name, mediaType: registerFile.mediaType, bytes: registerFile.bytes, sha256: registerFile.sha256, sourceRef: registerRef }], ...overrides })
  const confirmation = (row, reviewEvidence = false, overrides = {}) => {
    const submittedAt = overrides.submittedAt ?? new Date().toISOString(), confirmationNumber = overrides.confirmationNumber ?? 'synthetic-sides-confirmation-' + nonce
    const response = row.data
    const file = claimArtifact('portal-confirmation-' + response.responseDigest.slice(0,40), 'synthetic-sides-portal-confirmation.txt',
      `Synthetic official portal confirmation at the network edge\nYour response has been accepted.\nConfirmation Number: ${confirmationNumber}\nClaim Number: ${response.request.requestId}\n${response.activeFollowUp ? `Additional Fact Finding: ${response.activeFollowUp.agencyReference}\n` : ''}FEIN: ${ein}\nSEIN: ${stateEmployerId}\nSubmitted: ${submittedAt}\n`)
    return { version: row.version, reviewEvidence, artifacts: [file], confirmation: {
      requestIdentity: response.request.requestIdentity, responseDigest: response.responseDigest, confirmationNumber,
      employerEin: normalizedEin, stateEmployerId, submittedAt, sourceRef: 'Retained SIDES confirmation ' + confirmationNumber,
      sourceSha256: file.sha256, agencyMessage: 'Your response has been accepted.', ...overrides } }
  }
  const stepUp = async (who = cookie) => {
    const mails = context.edge?.mails
    assert.ok(Array.isArray(mails), 'native step-up requires the parent official-schema mail edge; no proof is fabricated')
    const before = mails.length
    await data('/auth/step-up', { action: 'credentials:mint', returnTo: claims.replace('/api/', '/app/') }, 202, who)
    const sent = mails.slice(before).at(-1)
    assert.ok(sent, 'the real proof route sent an email at the network edge')
    const match = String(sent.text).match(/https?:[^\s"<>]+/)
    assert.ok(match, 'the native auth message contains its confirmation link')
    const token = new URL(match[0].replaceAll('&amp;', '&')).searchParams.get('token')
    const confirmed = await call('/auth/confirm', { token }, who)
    assert.equal(confirmed.status, 303, await confirmed.clone().text())
    return confirmed
  }
  const signature = (review, overrides = {}) => ({ version: review.version, reviewToken: review.reviewToken,
    responseDigest: review.responseDigest, statement: 'I reviewed this exact response and its retained evidence and authorize this claim response only.', ...overrides })
  return { call, data, company: { ...company, ein, normalizedEin, base }, base, location, person, personPath,
    operator, session, cookie, claims, door: claims, hire, payroll, run: income, incomeInput, registerDoor,
    request, validRequest, evidence, prepare, confirmation, signature, stepUp, willow,
    files: { request: requestFile, mandate: mandateFile, manifest: manifestFile, records: recordsFile, audit: auditFile, register: registerFile },
    lastDayWorked, separationDate: employment.endDate, period, grossCents, portalReason, stateEmployerId, agency, timeZone, nonce }
}
