#!/usr/bin/env node
// A preparation client holds only its sponsored bearer, never a human session.

async function main() {
  const [command, company, reference, extra] = process.argv.slice(2)
  if (!['records', 'prepare', 'status'].includes(command) ||
      !/^[-a-zA-Z0-9]+$/.test(company ?? '') || process.argv.length > 5 || extra ||
      (command === 'status' && !/^[-a-zA-Z0-9]+$/.test(reference ?? '')) ||
      (command === 'prepare' && reference) ||
      (command === 'records' && reference && !/^[-a-zA-Z0-9]+$/.test(reference)))
    throw Error('usage: envelope-cli.mjs records COMPANY [AFTER] | prepare COMPANY < draft.json | status COMPANY DRAFT')
  let origin
  try { origin = new URL(process.env.ENVELOPE_ORIGIN) } catch { throw Error('ENVELOPE_ORIGIN must name the installation origin') }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      !(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))))
    throw Error('Use an HTTPS installation origin, or HTTP loopback for a local sandbox')
  const token = process.env.ENVELOPE_TOKEN
  if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? '')) throw Error('ENVELOPE_TOKEN must contain a current sponsored credential')
  let body
  if (command === 'prepare') {
    const chunks = []
    let size = 0
    for await (const chunk of process.stdin) {
      size += chunk.length
      if (size > 64000) throw Error('Draft input exceeds 64000 bytes')
      chunks.push(chunk)
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw 0
      body = JSON.stringify(value)
    } catch { throw Error('Draft input must be a JSON object') }
  }
  const path = `/api/envelope/v1/companies/${company}/` +
    (command === 'records' ? 'records' + (reference ? '?after=' + reference : '') :
      command === 'prepare' ? 'drafts' : 'drafts/' + reference)
  const response = await fetch(new URL(path, origin), {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body }),
  }).catch(() => { throw Error('Installation request failed; no redirected request was followed. Retry preparation with the same requestKey.') })
  if (!response.ok) {
    // Never echo arbitrary remote content or request headers into an error log.
    throw Error(`Installation refused request (HTTP ${response.status})`)
  }
  const value = await response.json().catch(() => { throw Error('Installation returned invalid JSON') })
  process.stdout.write(JSON.stringify(value) + '\n')
}
main().catch(error => {
  process.stderr.write(error.message + '\n')
  process.exitCode = 1
})
