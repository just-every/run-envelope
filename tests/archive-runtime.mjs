import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { cp, copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileRecords } from '@runeditrun/rer/modules/portability/files'
import { archiveFixture } from './archive-fixture.mjs'
import { archiveKeyCustody } from './archive-key-custody.mjs'
import { unrelatedPersonArchive, unrelatedCorrectionArchive, foreignFundingArchive, rewrittenArchive } from './archive-relationships.mjs'
import { archiveEditions } from './archive-editions.mjs'
import { archiveAdoption } from './archive-adoption.mjs'
import { archiveErasure } from './archive-erasure.mjs'

const execute = promisify(execFile)
const quote = value => '"' + value.replaceAll('"', '""') + '"'
const canonical = value => JSON.stringify(normal(value))
function normal(value) {
  if (ArrayBuffer.isView(value)) return { blob: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') }
  if (Array.isArray(value)) return value.map(normal)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normal(value[key])]))
  return value
}
const ordered = rows => rows.map(normal).sort((a, b) => canonical(a).localeCompare(canonical(b)))
const digest = value => createHash('sha256').update(canonical(value)).digest('hex')

async function run(program, args, cwd, env) {
  try {
    const result = await execute(program, args, { cwd, env, timeout: 600000, maxBuffer: 16 * 1024 * 1024 })
    return { code: 0, output: result.stdout + result.stderr }
  } catch (error) {
    if (typeof error.code !== 'number') throw new Error('Archive CLI could not complete: ' + (error.killed ? 'child timeout' : 'child launch failed'))
    return { code: error.code, output: String(error.stdout ?? '') + String(error.stderr ?? '') }
  }
}

/** Copy public tracked source, never the checkout's private settings or runtime. */
async function checkout(root, destination) {
  await mkdir(destination, { recursive: true, mode: 0o700 })
  const result = await execute('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 8 * 1024 * 1024 })
  for (const file of result.stdout.split('\0').filter(Boolean)) {
    if (/^(?:\.git|\.wrangler|node_modules|exports)(?:\/|$)|(?:^|\/)\.dev\.vars(?:\.|$)|(?:^|\/)\.env(?:\.|$)/.test(file)) continue
    const source = join(root, file), target = join(destination, file)
    const status = await lstat(source)
    assert.ok(status.isFile(), 'archive scratch source consists of tracked regular files')
    await mkdir(dirname(target), { recursive: true, mode: 0o700 })
    await copyFile(source, target)
  }
  await symlink(join(root, 'node_modules'), join(destination, 'node_modules'), 'dir')
}

async function databases(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await databases(path))
    else if (entry.isFile() && entry.name.endsWith('.sqlite')) files.push(path)
  }
  return files
}

/** Read-only inspection; every business fixture above uses a native HTTP door. */
async function snapshot(state, inventory) {
  const found = []
  for (const file of await databases(join(state, 'v3', 'd1'))) {
    const db = new DatabaseSync(file, { readOnly: true })
    try {
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name)
      if (!names.includes('env_companies')) continue
      const selected = inventory ?? names.filter(name => /^(?:env_|oa_|oc_)/.test(name)).map(name => ({ name }))
      const tables = {}
      for (const table of selected) {
        if (!names.includes(table.name)) { tables[table.name] = []; continue }
        const columns = table.columns?.filter(column => !column.generated).map(column => column.name)
        const projection = columns?.map(quote).join(',') ?? '*'
        tables[table.name] = ordered(db.prepare('SELECT ' + projection + ' FROM ' + quote(table.name)).all())
      }
      found.push(tables)
    } finally { db.close() }
  }
  assert.ok(found.length <= 1, 'one native foundation database supplies the archive')
  return found[0] ?? {}
}
/** Inspect the same native D1 SQLite store without starting another CLI process. */
export async function inspectNativeSql(state, command) {
  for (const file of await databases(join(state, 'v3', 'd1'))) {
    const db = new DatabaseSync(file, {readOnly:true})
    try {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='env_companies'").get()) continue
      return JSON.parse(JSON.stringify(db.prepare(command).all()))
    } finally { db.close() }
  }
  throw new Error('Native payroll database is absent')
}
const populated = tables => Object.fromEntries(Object.entries(tables).filter(([, rows]) => rows.length))
function ciphers(tables) {
  return ordered(Object.entries(tables).flatMap(([table, rows]) => rows.flatMap(row =>
    Object.entries(row).filter(([column, value]) => /(?:^|_)cipher$/.test(column) && value !== null).map(([column, value]) =>
      ({ table, column, key: Object.fromEntries(Object.entries(row).filter(([key]) => /^(?:company_id|id|person_id|kind|object_id|version|code)$/.test(key))), value })))))
}

/** First custody foundation only: no restored sign-in, provider adoption or outbound effects. */
export async function archiveJourney(context) {
  const { root, persist, quiesce, settings } = context
  assert.equal(typeof quiesce, 'function', 'the parent pauses its native worker while its test state is copied')
  assert.ok(root && persist && settings?.ENVELOPE_RECORD_KEY, 'the native harness supplies root, persist and its independently held record key')
  const fixture = await archiveFixture(context)
  const priorState=await snapshot(persist)
  assert.ok(priorState.env_notice_dispatches.some(row=>row.state==='unknown'),'the prior schema has a real unknown obligation')
  await quiesce(async()=>{
    await context.upgrade()
    const upgraded=await snapshot(persist)
    assert.deepEqual(populated(upgraded),populated(priorState),'upgrade preserves every populated business and identity table byte for byte')
    await context.upgrade()
    assert.deepEqual(populated(await snapshot(persist)),populated(priorState),'reapplying migrations is non-destructive')
  })
  console.log('ARCHIVE-UPGRADE passed: populated prior schema, unknown notice obligations, unchanged ciphertext and authority history, idempotent native migration')
  const temporary = await mkdtemp(join(tmpdir(), 'envelope-archive-'))
  try {
    const source = join(temporary, 'source'), target = join(temporary, 'target'), corruptTarget = join(temporary, 'corrupt-target')
    await Promise.all([source, target, corruptTarget].map(directory => checkout(resolve(root), directory)))
    await mkdir(join(source, '.wrangler'), { recursive: true, mode: 0o700 })
    await quiesce(() => cp(persist, join(source, '.wrangler', 'state'), { recursive: true }))
    const state = directory => join(directory, '.wrangler', 'state')
    let before = await snapshot(state(source))
    for (const id of fixture.companies) assert.ok(before.env_companies.some(row => row.id === id))
    assert.ok(before.env_workspace_decisions.some(row => row.decision === 'approved'), 'historical human approvals are real source records')
    for (const year of fixture.years) {
      for (const returnId of [year.originalReturnId, year.correctedReturnId])
        assert.ok(before.env_workspace_versions.some(row => row.kind === 'industry-return' && row.object_id === returnId), 'original and corrected prepared returns remain retained')
      for (const check of [...year.monthlyChecks, { id: year.correctionId }])
        assert.ok(before.env_workspace_versions.some(row => row.kind === 'industry-check' && row.object_id === check.id), 'annual calculations and linked correction are real archived records')
    }
    assert.ok(before.env_grants.length && before.oa_sessions.length, 'the source has active company authority and native sessions to exclude')
    assert.ok(before.env_agent_grants.some(row => row.id === fixture.authority.agentId && row.expires_at > Date.now()), 'a live sponsored agent grant exists before export')
    assert.ok(before.env_agent_credentials.some(row => row.id === fixture.authority.agentId), 'the source agent has a usable credential')
    assert.ok(before.env_external_providers.some(row => row.enabled === 1), 'the source has an explicitly enabled provider')
    for (const effect of fixture.authority.effects) {
      const retained = before.env_notice_dispatches.find(row => row.reply_id === effect.replyId)
      assert.equal(retained.state, effect.state)
      assert.equal(retained.provider_receipt, effect.providerReceipt)
      assert.equal(retained.id, effect.executionId, 'accepted and unknown work retains the original provider execution identity')
    }
    assert.ok(before.env_notice_approvals.some(row => row.reply_id === fixture.authority.replyId && row.expires_at > Date.now()), 'the source has a real exact human reply approval')
    const cli = join(root, 'node_modules', '@runeditrun', 'rer', 'global', 'rer.mjs')
    const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG: 'warn' }
    delete env.ENVELOPE_RECORD_KEY
    const keys = await archiveKeyCustody({ source, target, corruptTarget, temporary, run, env, key: settings.ENVELOPE_RECORD_KEY })
    const rer = (directory, verb, file, configuration = env, journal) => run(process.execPath,
      [cli, verb, '--cwd', directory, verb === 'export' ? '--output' : '--input', file,
        ...(verb === 'import' ? ['--yes'] : []), ...(journal ? ['--journal', journal] : []), '--json', '--non-interactive', '--no-queue'], directory, configuration)
    const oldArchive = join(source, 'exports', 'before-erasure.rer')
    const earlierExport = await rer(source, 'export', oldArchive)
    assert.equal(earlierExport.code, 0, 'a real earlier archive retains the soon-erased unused worker: ' + earlierExport.output)
    await context.withRestoredWorker(state(source), () => archiveErasure(context, fixture))
    before = await snapshot(state(source))
    assert.ok(!before.env_people.some(row => row.id === fixture.unusedId), 'only the unused worker was erased before the current archive')
    const exported = await rer(source, 'export', 'exports/custody.rer')
    assert.equal(exported.code, 0, 'the real rer export succeeds for populated native state')
    const archive = join(source, 'exports', 'custody.rer'), records = []
    for await (const record of fileRecords(archive)) records.push(record)
    const manifest = records.find(record => record.kind === 'manifest')
    const rows = Object.fromEntries(manifest.tables.map(table => [table.name, []]))
    for (const record of records) for (const item of record.items ?? []) if (item.kind === 'row') rows[item.table].push(item.row)
    for (const name of Object.keys(rows)) rows[name] = ordered(rows[name])
    assert.ok(!rows.env_private_records.some(row => row.person_id === fixture.privacyPersonId), 'the public archive contains no erased private record')
    assert.ok(!rows.env_workspace_versions.some(row => row.object_id === fixture.privacyWorkId), 'the public archive contains no erased work derivative')
    assert.ok(!rows.env_workspace_people.some(row => row.person_id === fixture.privacyPersonId), 'the public archive contains no erased source pin')
    for(const graph of fixture.privacyGraphs) {
      assert.ok(!rows.env_people.some(row=>row.id===graph.personId))
      assert.ok(!rows.env_workspace_versions.some(row=>row.company_id===graph.companyId && graph.objects.includes(row.object_id)),'actual archive contains no erased payroll or claim file derivative')
    }
    for (const id of fixture.custodyObjects) {
      assert.ok(!rows.env_workspace_versions.some(row => row.object_id === id), 'export contains no erased leave or intake revision')
      for (const table of ['env_workspace_people','env_workspace_dependencies','env_workspace_decisions','env_workspace_review_inputs'])
        assert.ok(!rows[table].some(row => row.object_id === id), 'export contains no erased leave or intake derivative')
    }
    const damagedEditions = join(temporary, 'damaged-editions.rer')
    const editions = await archiveEditions(records, source, damagedEditions)
    const text = await readFile(archive, 'utf8')
    assert.ok(!text.includes(settings.ENVELOPE_RECORD_KEY), 'record-key custody is separate from archive contents')
    assert.ok(!text.includes(fixture.authority.agentToken) && !text.includes(fixture.authority.providerSecret), 'live agent and provider secrets never enter the archive')
    assert.ok(!text.includes(fixture.authority.webhookSecret),'webhook signing secret is not archived')
    assert.equal(rows.env_webhooks.find(w=>w.id===fixture.authority.webhookId).active,0,'archived webhook consent is inactive')
    assert.ok(!text.includes(fixture.privateValue), 'private worker identifiers remain encrypted')
    const includedBefore = Object.fromEntries(Object.keys(rows).map(name => [name, before[name] ?? []]))
    assert.equal(digest(ciphers(rows)), digest(ciphers(includedBefore)), 'encrypted records retain their exact ciphertext and record association')
    assert.equal(digest(rows.env_workspace_decisions), digest(before.env_workspace_decisions), 'human approval history remains evidence')
    for (const name of ['oa_sessions', 'oa_tokens', 'oa_credentials', 'oa_step_up_challenges', 'env_grants', 'env_workspace_reviews', 'env_rate_reviews', 'env_notice_reviews', 'env_external_providers', 'env_agent_credentials', 'env_webhook_keys'])
      assert.equal(rows[name]?.length ?? 0, 0, 'archive carries no active authority from ' + name)
    for (const name of ['env_agent_grants', 'env_notice_approvals', 'env_verification_consents', 'env_verification_releases'])
      for (const row of rows[name] ?? []) assert.equal(row.expires_at, 0, 'retained authorization evidence is inactive')
    for (const row of rows.env_agent_grants ?? [])
      for (const key of ['actions', 'fields', 'locations', 'providers', 'models']) assert.deepEqual(JSON.parse(row[key]), [], 'agent provenance has no usable capability scope')

    // Migrations initialize a genuinely empty second installation through Wrangler's public CLI.
    const migrated = await run(process.execPath, [join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1', 'migrations', 'apply', 'foundation', '--local', '--persist-to', '.wrangler/state', '--config', 'wrangler.jsonc'], target, env)
    assert.equal(migrated.code, 0, 'the empty target receives native migrations')
    const empty = await snapshot(state(target))
    const absentKey = { ...env }; delete absentKey.ENVELOPE_RECORD_KEY
    const missing = await rer(target, 'import', archive, absentKey)
    assert.notEqual(missing.code, 0, 'a separately supplied original encryption key is required')
    assert.ok(missing.output.includes('archive_record_key_required'), 'missing key refusal identifies the recovery requirement')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'missing-key refusal publishes no business or identity rows')
    await keys.wrong()
    const wrong = await rer(target, 'import', archive)
    assert.notEqual(wrong.code, 0, 'an unrelated validly shaped key cannot recover encrypted records')
    assert.ok(wrong.output.includes('archive_record_key_or_cipher_invalid'), 'wrong-key refusal authenticates the retained ciphertext')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'wrong-key refusal publishes no business or identity rows')
    await keys.original()
    await mkdir(join(target, 'exports'), { recursive: true, mode: 0o700 })
    await copyFile(archive, join(target, 'exports', 'later-journal.rer'))
    const stale = await rer(target, 'import', oldArchive, env, 'exports/later-journal.rer')
    assert.notEqual(stale.code, 0, 'a later erasure journal fences the real older archive')
    assert.ok(stale.output.includes('erased_row') || stale.output.includes('erasure_epoch'), 'native restore identifies the erased-row fence; diagnostics: ' + ['erasure_epoch','later_journal','erased_row','target_not_empty','schema_mismatch','payload_inventory','archive_relationship_invalid','archive_source_editions_invalid','archive_record_key_required','transfer_failed','restore_refused','migration_ledger','unknown_option','configuration_inventory'].filter(code => stale.output.includes(code)).join(', '))
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'stale archive refusal cannot resurrect erased data or publish business history')
    const unrelated = join(temporary, 'unrelated-person.rer')
    await unrelatedPersonArchive(records, unrelated)
    const relation = await rer(target, 'import', unrelated)
    assert.notEqual(relation.code, 0, 'a checksummed archive with a foreign person reference refuses import')
    assert.ok(relation.output.includes('archive_relationship_invalid'), 'staged business relationships are checked beyond transport checksums')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'relationship refusal publishes no business or identity rows')
    for (const field of ['runId','accountId']) {
      const foreign = join(temporary, 'foreign-funding-' + field + '.rer')
      await foreignFundingArchive(records, foreign, settings.ENVELOPE_RECORD_KEY, field)
      const refused = await rer(target, 'import', foreign)
      assert.notEqual(refused.code, 0, 'a foreign employer funding reference refuses native import')
      assert.ok(refused.output.includes('archive_relationship_invalid'))
      assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'foreign funding import publishes no rows')
    }
    const unrelatedCorrection = join(temporary, 'unrelated-correction.rer')
    await unrelatedCorrectionArchive(records, unrelatedCorrection, settings.ENVELOPE_RECORD_KEY, fixture.years[0].correctionId)
    const correctionRefusal = await rer(target, 'import', unrelatedCorrection)
    assert.notEqual(correctionRefusal.code, 0, 'authenticated corrected history must refer to a retained original from the same employer and worker')
    assert.ok(correctionRefusal.output.includes('archive_relationship_invalid'))
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'broken encrypted correction reference publishes no business or identity rows')

    const broken = join(temporary, 'corrupt.rer')
    await writeFile(broken, text.slice(0, text.lastIndexOf('\n', text.length - 2) + 1), { mode: 0o600 })
    const corruptBefore = await snapshot(state(corruptTarget))
    const corrupt = await rer(corruptTarget, 'import', broken)
    assert.notEqual(corrupt.code, 0, 'a truncated archive is refused')
    assert.ok(corrupt.output.includes('closing_missing'), 'corruption is detected by the actual archive verifier')
    assert.equal(digest(populated(await snapshot(state(corruptTarget)))), digest(populated(corruptBefore)), 'corruption writes no business or identity rows')

    const editionRefusal = await rer(target, 'import', damagedEditions)
    assert.notEqual(editionRefusal.code, 0, 'an internally damaged source edition refuses even with valid archive transport checksums')
    assert.ok(editionRefusal.output.includes('archive_source_editions_invalid'), 'edition validation checks retained source bytes')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'damaged source edition publishes no business or identity history')
    assert.deepEqual(await readdir(join(target, '.rer', 'archive-editions')).catch(error => {
      if (error.code === 'ENOENT') return []; throw error
    }), [], 'refused source editions leave no recovered source payload')
    const removedSource = join(target, 'src', 'envelope', 'workspace', 'nj-withholding.ts')
    await rm(removedSource)
    const restored = await rer(target, 'import', archive)
    assert.equal(restored.code, 0, 'independently supplying the original record key permits the actual CLI restore')
    assert.deepEqual(await readFile(join(target, '.rer', 'archive-editions', editions.descriptor.sha256 + '.json')), editions.bytes,
      'restore retains exact historical source bytes independently of the target checkout')
    assert.equal(await lstat(removedSource).catch(error => { if (error.code === 'ENOENT') return null; throw error }), null,
      'historical source retention never recreates or executes application code')
    const targetRows = await snapshot(state(target), manifest.tables.map(table => ({ ...table,
      columns: table.columns.filter(column => !(manifest.excludedColumns[table.name] ?? []).includes(column.name)) })))
    assert.equal(digest(targetRows), digest(rows), 'every archived business and identity row matches the fresh target')
    assert.equal(digest(ciphers(targetRows)), digest(ciphers(includedBefore)), 'restore preserves exact encrypted history without re-encryption')
    const after = await snapshot(state(target))
    for (const name of ['oa_sessions', 'oa_tokens', 'oa_credentials', 'env_grants', 'env_workspace_reviews', 'env_external_providers', 'env_webhook_keys'])
      assert.equal(after[name]?.length ?? 0, 0, 'restored history does not reactivate ' + name)
    await context.withRestoredWorker(state(target), async () => {
      const outboundBefore = context.edge.mails.length
      const company = '/api/envelope/companies/' + fixture.companies[0]
      const requests = [[company, 'GET'], [company + '/notices', 'POST']]
      for (const [path, method] of requests) {
        const response = await context.worker.fetch(context.origin + path, { method,
          headers: { cookie: context.cookie, origin: context.origin, 'content-type': 'application\u002fjson' },
          ...(method === 'POST' ? { body: JSON.stringify({ reference: 'synthetic-envelope-replay', body: 'Former-session replay' }) } : {}) })
        assert.equal(response.status, 401, 'the real restored Worker refuses prior installation authority')
        assert.deepEqual(await response.json(), { error: 'authentication_required' })
      }
      const response = await context.worker.fetch(context.origin + '/api/envelope/mcp', { method: 'POST',
        headers: { authorization: 'Bearer ' + fixture.authority.agentToken, origin: context.origin, 'content-type': 'application\u002fjson' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 53, method: ['tools', 'call'].join('/'), params: { name: 'reply.dispatch',
          arguments: { companyId: fixture.companies[0], replyId: fixture.authority.replyId,
            version: fixture.authority.replyVersion, digest: fixture.authority.replyDigest } } }) })
      assert.equal(response.status, 401, 'a previously usable agent bearer cannot dispatch the retained approved reply')
      assert.equal(context.edge.mails.length, outboundBefore, 'restored credential replay makes no external request')
      await archiveAdoption(context, fixture)
    })
    const adoptedHistory = await snapshot(state(target))
    assert.equal(adoptedHistory.env_archive_adoptions.length, 3, 'each distinct adoption retains exact native consent')
    for (const receipt of adoptedHistory.env_archive_adoptions) {
      assert.deepEqual(JSON.parse(receipt.readable_history), ['compensation', 'tax'])
      assert.ok(adoptedHistory.env_audit.some(event => event.id === receipt.event_id && event.actor_id
        && event.company_id === receipt.company_id && event.action === 'archive.history.adopted'),
      'the immutable receipt is linked to the actual attributed audit event')
    }
    const consentArchive = join(target, 'exports', 'adopted-history.rer')
    const consentExport = await rer(target, 'export', consentArchive)
    assert.equal(consentExport.code, 0, 'adopted history and its exact consent remain portable evidence')
    const consentMigration = await run(process.execPath, [join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1', 'migrations', 'apply', 'foundation', '--local', '--persist-to', '.wrangler/state', '--config', 'wrangler.jsonc'], corruptTarget, env)
    assert.equal(consentMigration.code, 0)
    const consentEmpty = await snapshot(state(corruptTarget))
    const consentRecords = []
    for await (const record of fileRecords(consentArchive)) consentRecords.push(record)
    const brokenConsent = structuredClone(consentRecords)
    const consentRow = brokenConsent.flatMap(record => record.items ?? []).find(item => item.table === 'env_archive_adoptions').row
    const unrelatedEvent = brokenConsent.flatMap(record => record.items ?? []).find(item => item.table === 'env_audit'
      && item.row.company_id === consentRow.company_id && item.row.action === 'company.created').row
    consentRow.event_id = unrelatedEvent.id
    const brokenConsentArchive = join(temporary, 'unrelated-consent.rer')
    await rewrittenArchive(brokenConsent, brokenConsentArchive)
    const consentRefusal = await rer(corruptTarget, 'import', brokenConsentArchive)
    assert.notEqual(consentRefusal.code, 0, 'a checksummed receipt cannot claim an unrelated audit event as consent')
    assert.ok(consentRefusal.output.includes('archive_relationship_invalid'))
    assert.equal(digest(populated(await snapshot(state(corruptTarget)))), digest(populated(consentEmpty)),
      'invalid consent attribution publishes no business or identity history')
    const consentRestore = await rer(corruptTarget, 'import', consentArchive)
    assert.equal(consentRestore.code, 0, 'the next empty installation retains consent without restoring its authority')
    const nextHistory = await snapshot(state(corruptTarget))
    assert.deepEqual(nextHistory.env_archive_adoptions, adoptedHistory.env_archive_adoptions)
    assert.equal(nextHistory.env_grants.length, 0, 'historical consent cannot recreate a restored grant')
    assert.equal(nextHistory.oa_sessions.length, 0, 'historical consent cannot recreate a native session')
    const occupied = await rer(target, 'import', archive)
    assert.notEqual(occupied.code, 0, 'an already populated target refuses a second import')
    assert.ok(occupied.output.includes('target_not_empty'), 'the refusal is specifically the nonempty target')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(adoptedHistory)), 'nonempty refusal leaves all prior business and identity history unchanged')
    await keys.occupied()
    console.log('Archive custody journey passed: native annual corrections, source editions, unused-worker erasure fence, inactive authority, restricted audited adoption and atomic CLI refusals.')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

/** The verification journey supplies its real native state before and after erasure. */
export async function verificationArchiveCheckpoint(context, companyId, personId) {
  const {root, persist, quiesce, settings} = context
  const temporary = await mkdtemp(join(tmpdir(), 'envelope-verification-archive-'))
  const source = join(temporary, 'source'), target = join(temporary, 'target')
  const state = directory => join(directory, '.wrangler', 'state')
  try {
    await Promise.all([source, target].map(directory => checkout(root, directory)))
    const env = {...process.env, WRANGLER_SEND_METRICS:'false', WRANGLER_LOG:'warn'}
    delete env.ENVELOPE_RECORD_KEY
    const {writePrivateFile}=await import('@runeditrun/rer/private-files')
    for(const directory of [source,target]) await writePrivateFile(join(directory,'.dev.vars'),'ENVELOPE_RECORD_KEY='+settings.ENVELOPE_RECORD_KEY+'\n',true)
    const cli = join(root,'node_modules','@runeditrun','rer','global','rer.mjs')
    const invoke = (directory, verb, file, journal) => run(process.execPath,[cli,verb,'--cwd',directory,
      verb === 'export' ? '--output' : '--input',file,...(verb === 'import' ? ['--yes'] : []),
      ...(journal ? ['--journal',journal] : []),'--json','--non-interactive','--no-queue'],directory,env)
    await mkdir(dirname(state(source)),{recursive:true})
    const exportCurrent = file => quiesce(async()=>{
      await rename(persist,state(source))
      try { return await invoke(source,'export',file) }
      finally { await rename(state(source),persist) }
    })
    const original = await quiesce(()=>snapshot(persist))
    const oldArchive = join(source,'exports','verification-before-erasure.rer')
    const old = await exportCurrent(oldArchive)
    assert.equal(old.code,0,'verification archive export: ' + old.output)
    const records = []
    for await (const record of fileRecords(oldArchive)) records.push(record)
    const oldManifest=records.find(record=>record.kind==='manifest')
    const rows = records.flatMap(record => record.items ?? []).filter(item => item.kind === 'row')
    for (const table of ['env_verification_consents','env_verification_releases','env_verification_corrections']) {
      const exported = rows.filter(item => item.table === table && item.row.company_id === companyId).map(item => item.row)
      const expected = original[table].filter(row => row.company_id === companyId).map(row =>
        table === 'env_verification_corrections' ? row : {...row,expires_at:0})
      assert.ok(expected.length,'verification archive contains genuine history for ' + table)
      assert.equal(digest(ordered(exported)),digest(ordered(expected)),'verification evidence is exact and authority inactive')
    }
    assert.ok(rows.some(item => item.table === 'env_workspace_versions' && item.row.company_id === companyId && item.row.kind === 'disclosure'))
    const migrated = await run(process.execPath,[join(root,'node_modules','wrangler','bin','wrangler.js'),
      'd1','migrations','apply','foundation','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc'],target,env)
    assert.equal(migrated.code,0,'verification target migrations: ' + migrated.output)
    const empty = await snapshot(state(target))
    const finish = async () => {
      try {
        const journal = join(source,'exports','verification-erasure-journal.rer')
        const current = await exportCurrent(journal)
        assert.equal(current.code,0,'post-erasure verification export: ' + current.output)
        const after = []
        let laterManifest
        for await (const record of fileRecords(journal)) {
          if(record.kind==='manifest') laterManifest=record
          for(const item of record.items ?? []) if(item.kind==='row') after.push(item)
        }
        assert.equal(laterManifest.sourceIdentity,oldManifest.sourceIdentity,'both exports belong to the same actual native installation')
        assert.ok(laterManifest.epoch>oldManifest.epoch && laterManifest.journal.length>oldManifest.journal.length,'actual erasure advances the native journal')
        for (const table of ['env_verification_consents','env_verification_releases','env_verification_corrections'])
          assert.ok(!after.some(item => item.table === table && item.row.company_id === companyId),'erased verification rows cannot leave through archives')
        assert.ok(!after.some(item => item.row.person_id === personId || (item.table === 'env_people' && item.row.id === personId)))
        await mkdir(join(target,'exports'),{recursive:true})
        await copyFile(journal,join(target,'exports','verification-erasure-journal.rer'))
        const refused = await invoke(target,'import',oldArchive,'exports/verification-erasure-journal.rer')
        assert.notEqual(refused.code,0,'older verification archive cannot resurrect erased source facts or history')
        assert.match(refused.output,/erased_row|erasure_epoch/,'restore identifies the erasure fence')
        assert.equal(digest(populated(await snapshot(state(target)))),digest(populated(empty)),'refused verification restore publishes nothing')
        console.log('VERIFICATION-ARCHIVE passed: exact encrypted history and inactive consent authority; erased derivatives absent; actual older archive refused with later journal and no publication.')
      } finally { await rm(temporary,{recursive:true,force:true}) }
    }
    return Object.assign(finish,{dispose:()=>rm(temporary,{recursive:true,force:true})})
  } catch(error) { await rm(temporary,{recursive:true,force:true}); throw error }
}
