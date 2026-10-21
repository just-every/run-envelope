import { queuedEntrypoint } from '@runeditrun/rer/queued-entry'
const queued = await queuedEntrypoint(import.meta.url, 'verify:runtime')
if (queued !== null) process.exit(queued)
import assert from 'node:assert/strict'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { payrollJourney, missingKeyJourney, allocationJourney, scheduleJourney, payItemsJourney, rulesJourney } from './payroll-runtime.mjs'

const socket = createServer()
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise((resolve) => socket.close(resolve))
// The installed homepage reads the claim state from D1: run the emitted Worker
// on its own migrated store, never the checkout's local data.
const persist = await mkdtemp(join(tmpdir(), 'foundation-runtime-'))
execFileSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'foundation',
    '--local',
    '--persist-to',
    persist,
    '--config',
    'dist/server/wrangler.json',
  ],
  { stdio: 'pipe', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } },
)
// A loopback installation with its owner's settings, so the owner's first run can be walked through the public doors.
const origin = `http://127.0.0.1:${port}`
const setupToken = randomBytes(32).toString('hex')
const settings = {
  AUTH_LOCAL: 'true',
  AUTH_ORIGIN: origin,
  OWNER_EMAIL: 'owner@example.com',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  SETUP_TOKEN: setupToken,
  ENVELOPE_RECORD_KEY: randomBytes(32).toString('base64'),
}
let output = ''
function launch(bindings) {
  const child = spawn(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--inspector-port',
      '0',
      '--local',
      '--persist-to',
      persist,
      '--ip',
      '127.0.0.1',
      '--config',
      'dist/server/wrangler.json',
      '--port',
      String(port),
      ...Object.entries(bindings).flatMap(([name, value]) => ['--var', `${name}:${value}`]),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })
  return child
}
let worker = launch(settings)
async function stopWorker() {
  worker.kill('SIGTERM')
  await new Promise((resolve) =>
    worker.exitCode !== null || worker.signalCode !== null
      ? resolve()
      : worker.once('exit', resolve),
  )
}
async function waitForWorker() {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (worker.exitCode !== null) throw new Error('test Worker exited before readiness')
    try {
      if ((await fetch(origin + '/health')).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('test Worker readiness timeout')
}

try {
  let ready = false
  for (let attempt = 0; attempt < 120; attempt++) {
    if (worker.exitCode !== null) throw new Error(output)
    try {
      ready = (await fetch(`${origin}/health`)).ok
    } catch {}
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(ready, output)
  const health = await (await fetch(`${origin}/health`)).json()
  assert.equal(health.status, 'ok')
  assert.equal(health.ok, true)
  assert.deepEqual(Object.keys(health.deployment ?? {}).sort(), [
    'fingerprint',
    'sourceSha',
    'versionId',
  ])
  const document = await fetch(origin)
  assert.equal(document.status, 200)
  const branding = JSON.parse(await readFile(new URL('../src/branding.json', import.meta.url)))
  assert.ok((await document.text()).includes(branding.name))
  for (const path of ['/missing', '/health/extra', '/api', '/api/missing']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path)
  }
  console.log(
    'HTTP-001 passed against emitted local Worker: health, the installed homepage, HTTP and document 404s',
  )

  // The owner's first run: claim the installation with the setup token, finish setup, then open the app home.
  const manual = (path, init = {}) => fetch(`${origin}${path}`, { redirect: 'manual', ...init })
  assert.equal((await manual('/app')).headers.get('location'), '/signin')
  const claim = await manual('/auth/bootstrap', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ token: setupToken, displayName: 'Kim Sorensen' }),
  })
  assert.equal(claim.status, 303, await claim.text())
  const cookie = claim.headers.get('set-cookie').split(';')[0]
  assert.equal((await manual('/app', { headers: { cookie } })).headers.get('location'), '/setup')
  const finished = await manual('/setup', {
    method: 'POST',
    headers: { cookie, origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'displayName=Kim+Sorensen&confirm=yes',
  })
  assert.equal(finished.headers.get('location'), '/app')
  const home = await manual('/app', { headers: { cookie } })
  assert.equal(home.status, 200, await home.clone().text())
  assert.match(home.headers.get('content-type'), /^text\/html/)
  console.log(
    'APP-HOME passed against emitted local Worker: the owner claims, finishes setup and opens the app home',
  )
  const execute = promisify(execFile)
  const sql = async (command) =>
    JSON.parse(
      (
        await execute(
          process.execPath,
          [
            'node_modules/wrangler/bin/wrangler.js',
            'd1',
            'execute',
            'foundation',
            '--local',
            '--persist-to',
            persist,
            '--config',
            'dist/server/wrangler.json',
            '--json',
            '--command',
            command,
          ],
          { encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } },
        )
      ).stdout,
    ).flatMap((result) => result.results)

  const selected = process.env.ENVELOPE_JOURNEYS?.split(',')
  if (selected?.some(name => !['records','allocations','schedules','pay-items','rules'].includes(name))) throw Error('Unknown payroll journey')
  if (!selected || selected.includes('allocations')) await allocationJourney({ origin, cookie, sql })
  if (!selected || selected.includes('schedules')) await scheduleJourney({ origin, cookie })
  if (!selected || selected.includes('pay-items')) await payItemsJourney({ origin, cookie, sql })
  if (!selected || selected.includes('rules')) await rulesJourney({ origin, cookie, sql })
  if (!selected || selected.includes('records')) {
    const records = await payrollJourney({ origin, cookie, settings, sql })
    await stopWorker()
    const withoutKey = { ...settings }
    delete withoutKey.ENVELOPE_RECORD_KEY
    worker = launch(withoutKey)
    await waitForWorker()
    await records.noWrite(async () => {
      const response = await records.call('/api/envelope/companies', cookie, {name:'Held company',ein:'00-0000003'})
      assert.equal(response.status,503)
      assert.deepEqual(await response.json(),{error:'payroll_record_key_required'})
    })
    await missingKeyJourney({origin,cookie,noWrite:records.noWrite})
  }
} finally {
  await stopWorker()
  await rm(persist, { recursive: true, force: true })
}
