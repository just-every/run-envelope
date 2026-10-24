import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { cp, copyFile, lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileRecords } from '@runeditrun/rer/modules/portability/files'
import { archiveFixture } from './archive-fixture.mjs'
import { archiveKeyCustody } from './archive-key-custody.mjs'
import { unrelatedPersonArchive, unrelatedCorrectionArchive } from './archive-relationships.mjs'
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
    const damagedEditions = join(temporary, 'damaged-editions.rer')
    const editions = await archiveEditions(records, source, damagedEditions)
    const text = await readFile(archive, 'utf8')
    assert.ok(!text.includes(settings.ENVELOPE_RECORD_KEY), 'record-key custody is separate from archive contents')
    assert.ok(!text.includes(fixture.authority.agentToken) && !text.includes(fixture.authority.providerSecret), 'live agent and provider secrets never enter the archive')
    assert.ok(!text.includes(fixture.privateValue), 'private worker identifiers remain encrypted')
    const includedBefore = Object.fromEntries(Object.keys(rows).map(name => [name, before[name] ?? []]))
    assert.equal(digest(ciphers(rows)), digest(ciphers(includedBefore)), 'encrypted records retain their exact ciphertext and record association')
    assert.equal(digest(rows.env_workspace_decisions), digest(before.env_workspace_decisions), 'human approval history remains evidence')
    for (const name of ['oa_sessions', 'oa_tokens', 'oa_credentials', 'oa_step_up_challenges', 'env_grants', 'env_workspace_reviews', 'env_rate_reviews', 'env_notice_reviews', 'env_external_providers', 'env_agent_credentials'])
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
    assert.ok(stale.output.includes('erased_row'), 'native restore identifies the erased-row fence; diagnostics: ' + ['erasure_epoch','later_journal','erased_row','target_not_empty','schema_mismatch','payload_inventory','archive_relationship_invalid','archive_source_editions_invalid','archive_record_key_required','transfer_failed','restore_refused','migration_ledger','unknown_option','configuration_inventory'].filter(code => stale.output.includes(code)).join(', '))
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'stale archive refusal cannot resurrect erased data or publish business history')
    const unrelated = join(temporary, 'unrelated-person.rer')
    await unrelatedPersonArchive(records, unrelated)
    const relation = await rer(target, 'import', unrelated)
    assert.notEqual(relation.code, 0, 'a checksummed archive with a foreign person reference refuses import')
    assert.ok(relation.output.includes('archive_relationship_invalid'), 'staged business relationships are checked beyond transport checksums')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(empty)), 'relationship refusal publishes no business or identity rows')
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
    for (const name of ['oa_sessions', 'oa_tokens', 'oa_credentials', 'env_grants', 'env_workspace_reviews', 'env_external_providers'])
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
    const occupied = await rer(target, 'import', archive)
    assert.notEqual(occupied.code, 0, 'an already populated target refuses a second import')
    assert.ok(occupied.output.includes('target_not_empty'), 'the refusal is specifically the nonempty target')
    assert.equal(digest(populated(await snapshot(state(target)))), digest(populated(adoptedHistory)), 'nonempty refusal leaves all prior business and identity history unchanged')
    await keys.occupied()
    console.log('Archive custody journey passed: native annual corrections, source editions, unused-worker erasure fence, inactive authority, restricted audited adoption and atomic CLI refusals.')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
