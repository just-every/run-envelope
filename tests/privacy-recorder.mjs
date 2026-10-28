// Shared observation of the existing public-door journeys. No production fallback.
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { unstable_startWorker } from 'wrangler'

const sensitive = new Set(['000-00-0001', '000000002', 'synthetic-envelope-1',
  'synthetic-envelope-2', 'synthetic-envelope-3', 'synthetic-envelope-510', 'synthetic-envelope-512'])
const violations = []
const installations = new Set()
const counts = { outbound: 0, browserRequests: 0, browserLogs: 0, workerLogs: 0, bundles: 0, privateInputs: 0 }
function inspect(value, channel) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  for (const secret of sensitive) {
    // Synthetic identifiers are also prefixes of unrelated public fixture IDs.
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(escaped + '(?![0-9A-Za-z_-])').test(serialized)) violations.push(channel + ': sensitive value')
  }
}
export function privateValue(value) { if (typeof value === 'string' && value) sensitive.add(value) }
export function recordPrivateInput(url, body) {
  if (typeof body !== 'string' || !body || !/\/(private|providers)$/.test(new URL(url).pathname)) return
  let input
  try { input = JSON.parse(body) } catch { input = Object.fromEntries(new URLSearchParams(body)) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  if (['ssn','bank','tax'].includes(input.kind) && input.value) { privateValue(input.value); counts.privateInputs++ }
  if (input.secret) { privateValue(input.secret); counts.privateInputs++ }
}
const nativeFetch = globalThis.fetch
// Observe synthetic values at their actual public input boundary, including
// generated bank values, rather than relying on a fixed fixture inventory.
globalThis.fetch = (input, init) => {
  recordPrivateInput(typeof input === 'string' || input instanceof URL ? input : input.url, init?.body)
  return nativeFetch(input, init)
}
export function workerLog(log) { counts.workerLogs++; inspect(log, 'Worker log') }
export async function startRecordedWorker(options) {
  const edge = options.dev?.outboundService
  const binding = name => options.bindings?.[name]?.value
  const mailProvider = binding('MAIL_PROVIDER')
  const mailUrl = mailProvider === 'sendgrid' ? 'https://api.sendgrid.com/v3/mail/send'
    : mailProvider === 'cloudflare' ? `https://api.cloudflare.com/client/v4/accounts/${binding('MAIL_ACCOUNT_ID')}/email/sending/send`
    : mailProvider === 'rer' ? binding('MAIL_RELAY_URL')
    : mailProvider === 'resend' ? 'https://api.resend.com/emails' : null
  if (binding('MAIL_API_KEY')) privateValue(binding('MAIL_API_KEY'))
  const server = options.dev.server
  installations.add(`http${server.secure ? 's' : ''}://${server.hostname}:${server.port}`)
  return unstable_startWorker({ ...options, dev: { ...options.dev,
    structuredLogsHandler: workerLog,
    outboundService: async request => {
      counts.outbound++
      const allowed = new Set(['https://api.openai.com/v1/responses',
        'https://auth.example.com/.well-known/openid-configuration', 'https://auth.example.com/jwks', 'https://auth.example.com/token'])
      if (!mailProvider) allowed.add('https://api.resend.com/emails')
      if (mailUrl) allowed.add(mailUrl)
      if (binding('MAIL_API_KEY') && request.headers.get('authorization') === 'Bearer ' + binding('MAIL_API_KEY'))
        assert.equal(request.url, mailUrl, 'Native credential never reaches a different recipient')
      if (request.url === mailUrl) assert.equal(request.headers.get('authorization'), 'Bearer ' + binding('MAIL_API_KEY'), 'Native mail credential stays at its declared transport')
      if (binding('ENVELOPE_WEBHOOK_URL')) allowed.add(binding('ENVELOPE_WEBHOOK_URL'))
      if (!allowed.has(request.url) && request.url !== mailUrl) violations.push('Undeclared Worker destination')
      inspect(request.url, 'Outbound URL')
      const payload = await request.clone().text()
      inspect(payload, 'Outbound body')
      // Provider credentials belong only to their own Authorization header.
      const headers = new Headers(request.headers)
      headers.delete('authorization')
      inspect([...headers], 'Outbound headers')
      if (request.url === binding('ENVELOPE_WEBHOOK_URL')) return nativeFetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),body:payload,redirect:'manual'})
      if (!edge) {
        violations.push('Undeclared outbound request')
        return new Response(null, { status: 502 })
      }
      return edge(request)
    },
  } })
}

const launch = chromium.launch.bind(chromium)
chromium.launch = async (...args) => {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) args[0] = {...args[0], executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args:[...(args[0]?.args ?? []),'--no-sandbox']}
  const browser = await launch(...args)
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async (...contextArgs) => {
    const context = await newContext(...contextArgs)
    context.on('request', request => {
      counts.browserRequests++
      const url = new URL(request.url())
      recordPrivateInput(url, request.postData())
      const local = installations.has(url.origin)
      if (!local && !(url.origin === 'https://auth.example.com' && url.pathname === '/authorize'))
        violations.push('Undeclared browser destination')
      inspect(request.url(), 'Browser URL')
      // Same-installation form submissions are authorized private input.
      inspect(request.headers(), 'Browser headers')
      if (!local) inspect(request.postData() ?? '', 'External browser body')
    })
    context.on('page', page => {
      page.on('console', message => { counts.browserLogs++; inspect(message.text(), 'Browser console') })
      page.on('pageerror', error => { counts.browserLogs++; inspect(error.message, 'Browser error') })
    })
    return context
  }
  return browser
}

export async function finishPrivacyRecording() {
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await scan(path)
      else { counts.bundles++; inspect(await readFile(path, 'utf8'), 'Client asset') }
    }
  }
  await scan('./dist/client')
  assert.ok(counts.browserRequests > 0, 'The recorder observed real browser requests')
  assert.ok(counts.bundles > 0, 'The recorder inspected emitted client assets')
  assert.deepEqual(violations, [], 'No private value or undeclared destination in recorded channels')
  console.log('PRIVACY-RECORDER passed ' + JSON.stringify(counts))
}

export const outboundRequestCount = () => counts.outbound
