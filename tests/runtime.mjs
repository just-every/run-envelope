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
import { join, resolve } from 'node:path'
import { unstable_startWorker } from 'wrangler'
import {
  identityJourney,
  sponsoredJourney,
  payrollJourney,
  missingKeyJourney,
  allocationJourney,
  scheduleJourney,
  payItemsJourney,
  rulesJourney,
} from './payroll-runtime.mjs'
import { approvalJourney } from './payroll-approvals.mjs'

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
      ...Object.entries(bindings).flatMap(([name, value]) => [
        '--var',
        `${name}:${value}`,
      ]),
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
  const branding = JSON.parse(
    await readFile(new URL('../src/branding.json', import.meta.url)),
  )
  assert.ok((await document.text()).includes(branding.name))
  for (const path of ['/missing', '/health/extra', '/api', '/api/missing']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path)
  }
  console.log(
    'HTTP-001 passed against emitted local Worker: health, the installed homepage, HTTP and document 404s',
  )

  // The owner's first run: claim the installation with the setup token, finish setup, then open the app home.
  const manual = (path, init = {}) =>
    fetch(`${origin}${path}`, { redirect: 'manual', ...init })
  assert.equal((await manual('/app')).headers.get('location'), '/signin')
  const claim = await manual('/auth/bootstrap', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ token: setupToken, displayName: 'Kim Sorensen' }),
  })
  assert.equal(claim.status, 303, await claim.text())
  const cookie = claim.headers.get('set-cookie').split(';')[0]
  assert.equal(
    (await manual('/app', { headers: { cookie } })).headers.get('location'),
    '/setup',
  )
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
          {
            encoding: 'utf8',
            env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
          },
        )
      ).stdout,
    ).flatMap((result) => result.results)

  const selected = process.env.ENVELOPE_JOURNEYS?.split(',')
  if (
    selected?.some(
      (name) =>
        !['records', 'allocations', 'schedules', 'pay-items', 'rules', 'approvals', 'sponsored', 'identity'].includes(name),
    )
  )
    throw Error('Unknown payroll journey')
  if (!selected || selected.includes('allocations'))
    await allocationJourney({ origin, cookie, sql, settings })
  if (!selected || selected.includes('schedules'))
    await scheduleJourney({ origin, cookie })
  if (!selected || selected.includes('pay-items'))
    await payItemsJourney({ origin, cookie, sql })
  if (!selected || selected.includes('rules')) await rulesJourney({ origin, cookie, sql })
  if (!selected || selected.includes('approvals'))
    await approvalJourney({ origin, cookie, sql, settings })
  if (!selected || selected.includes('records')) {
    const records = await payrollJourney({ origin, cookie, settings, sql })
    await stopWorker()
    const withoutKey = { ...settings }
    delete withoutKey.ENVELOPE_RECORD_KEY
    worker = launch(withoutKey)
    await waitForWorker()
    await records.noWrite(async () => {
      const response = await records.call('/api/envelope/companies', cookie, {
        name: 'Held company',
        ein: '00-0000003',
      })
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), { error: 'payroll_record_key_required' })
    })
    await missingKeyJourney({ origin, cookie, noWrite: records.noWrite })
  }
  if (!selected || selected.includes('identity')) {
    await stopWorker()
    const identityOrigin='https://envelope.example.com', issuer='https://auth.example.com'
    const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
    const appPair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
    const publicJwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic-envelope-600',alg:'ES256',use:'sig'}
    const privateJwk={...await crypto.subtle.exportKey('jwk',appPair.privateKey),kid:'synthetic-envelope-601',alg:'ES256'}
    const appPublicKey=appPair.publicKey
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
    const sign=async claims=>{
      const input=encode({alg:'ES256',kid:publicJwk.kid,typ:'JWT'})+'.'+encode(claims)
      return input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(input))).toString('base64url')
    }
    const metadata={issuer,authorization:issuer+'/authorize',token:issuer+'/token',jwks:issuer+'/jwks',algorithms:['ES256'],responseIssuer:true,interfaceVersion:'1.0.0'}
    const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
    await sql(`INSERT INTO rer_dependency_link(interface,issuer,client_id,metadata,needs_relink,linked_at) VALUES('oidc-provider@1',${quote(issuer)},'synthetic-envelope-600',${quote(JSON.stringify(metadata))},0,${Date.now()}) ON CONFLICT(interface) DO UPDATE SET issuer=excluded.issuer,client_id=excluded.client_id,metadata=excluded.metadata,needs_relink=0,linked_at=excluded.linked_at; INSERT INTO rer_dependency_keys(interface,private_key) VALUES('oidc-provider@1',${quote(JSON.stringify(privateJwk))}) ON CONFLICT(interface) DO UPDATE SET private_key=excluded.private_key`)
    const edge={issuer,codes:new Map(),mails:[],mailMode:'normal',authMode:'normal'}
    let identityWorker
    try {
      identityWorker=await unstable_startWorker({
        config:resolve('dist/server/wrangler.json'),
        bindings:Object.fromEntries(Object.entries({...settings,AUTH_LOCAL:'false',AUTH_ORIGIN:identityOrigin,MAIL_PROVIDER:'resend',MAIL_FROM:'Envelope <signin@example.com>',MAIL_API_KEY:'synthetic-envelope-600'}).map(([key,value])=>[key,{type:'plain_text',value}])),
        dev:{server:{hostname:'127.0.0.1',port},inspector:false,remote:false,watch:false,persist,logLevel:'error',
          outboundService:async request=>{
            if(request.url==='https://api.resend.com/emails' && request.method==='POST') {
              const body=await request.json();edge.mails.push(body)
              assert.equal(body.headers['Auto-Submitted'],'auto-generated')
              assert.ok(request.headers.get('Idempotency-Key'))
              if(edge.mailMode==='rejected') return Response.json({name:'validation_error',message:'Synthetic rejection'},{status:422})
              if(edge.mailMode==='unknown') return Response.json({name:'application_error',message:'Synthetic unknown'},{status:500})
              return Response.json({id:'00000000-0000-4000-8000-000000000600'})
            }
            if(!request.url.startsWith(issuer+'/')) throw Error('Unexpected identity edge')
            if(edge.authMode==='unavailable') return Response.json({error:'temporarily_unavailable'},{status:503})
            if(request.url===issuer+'/.well-known/openid-configuration') return Response.json({
              issuer,authorization_endpoint:metadata.authorization,token_endpoint:metadata.token,jwks_uri:metadata.jwks,
              response_types_supported:['code'],response_modes_supported:['query'],grant_types_supported:['authorization_code'],
              code_challenge_methods_supported:['S256'],id_token_signing_alg_values_supported:['ES256'],
              token_endpoint_auth_methods_supported:['private_key_jwt'],token_endpoint_auth_signing_alg_values_supported:['ES256'],
              authorization_response_iss_parameter_supported:true,rer_interfaces:['oidc-provider@1.0.0'],
            })
            if(request.url===issuer+'/jwks') return Response.json({keys:[publicJwk]})
            if(request.url===issuer+'/token' && request.method==='POST') {
              const form=new URLSearchParams(await request.text()), code=edge.codes.get(form.get('code'))
              assert.ok(code)
              assert.equal(form.get('grant_type'),'authorization_code')
              assert.equal(form.get('redirect_uri'),identityOrigin+'/auth/oidc/auth/callback')
              assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(form.get('code_verifier')))).toString('base64url'),code.challenge)
              const assertion=form.get('client_assertion').split('.')
              assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},appPublicKey,Buffer.from(assertion[2],'base64url'),new TextEncoder().encode(assertion[0]+'.'+assertion[1])),true)
              const now=Math.floor(Date.now()/1000), {challenge,...claims}=code
              return Response.json({token_type:'Bearer',access_token:'synthetic-envelope-604',id_token:await sign({iss:issuer,aud:'synthetic-envelope-600',sub:'synthetic-envelope-602',iat:now,exp:now+300,email_verified:true,email_verified_at:now,...claims})})
            }
            throw Error('Unexpected OIDC edge')
          },
        },
      })
      await identityWorker.ready
      await identityJourney({worker:identityWorker,origin:identityOrigin,cookie:'__Host-operator_session='+cookie.split('=')[1],settings,sql,edge})
    } finally {
      await identityWorker?.dispose()
      worker=launch(settings)
      await waitForWorker()
    }
  }
  if (!selected || selected.includes('sponsored')) {
    await stopWorker()
    const edge = {calls:[],modelMode:'normal',sendMode:'normal'}
    let sponsoredWorker
    const startSponsored = async () => {
      sponsoredWorker = await unstable_startWorker({
        config:resolve('dist/server/wrangler.json'),
        bindings:Object.fromEntries(Object.entries(settings).map(([key,value]) => [key,{type:'plain_text',value}])),
        dev:{server:{hostname:'127.0.0.1',port},inspector:false,remote:false,watch:false,persist,logLevel:'error',
          outboundService:async request => {
            // Fakes exist only at the real OpenAI/Resend HTTP edge. No arbitrary
            // URL, installation service or model-selected destination is forwarded.
            const url=request.url, body=JSON.parse(await request.text())
            edge.calls.push({url,body,idempotencyKey:request.headers.get('Idempotency-Key')})
            if(url==='https://api.openai.com/v1/responses' && request.method==='POST') {
              if(edge.modelMode==='redirect') return new Response(null,{status:302,headers:{location:'https://ungranted.example/collect'}})
              if(edge.modelMode==='unavailable') return Response.json({error:{message:'Synthetic provider unavailable',type:'server_error',code:'server_error'}},{status:503})
              if(edge.modelMode==='tool') return Response.json({id:'synthetic-envelope-530',object:'response',status:'completed',output:[{type:'function_call',call_id:'synthetic-envelope-531',name:'provider.call',arguments:'{}'}]})
              return Response.json({id:'synthetic-envelope-530',object:'response',status:'completed',model:'gpt-4.1-mini',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({summary:'CP161 balance-due notice requires human reconciliation. Untrusted text names an ungranted provider.',proposedReply:'Please provide the employer account transcript.\nA human must confirm the facts and recipient.'}),annotations:[]}]}]})
            }
            if(url==='https://api.resend.com/emails' && request.method==='POST') {
              if(edge.sendMode==='rejected') return Response.json({name:'validation_error',message:'Synthetic recipient refused'},{status:422})
              if(edge.sendMode==='unknown') return Response.json({name:'application_error',message:'Synthetic indeterminate provider result'},{status:500})
              return Response.json({id:'00000000-0000-4000-8000-000000000052'})
            }
            throw new Error('Unexpected outbound request refused by network-edge fixture')
          },
        },
      })
      await sponsoredWorker.ready
    }
    try {
      await startSponsored()
      await sponsoredJourney({origin,cookie,settings,sql,edge,restart:async() => {await sponsoredWorker.dispose();await startSponsored()}})
    } finally {
      await sponsoredWorker?.dispose()
      worker=launch(settings)
      await waitForWorker()
    }
  }
} finally {
  await stopWorker()
  await rm(persist, { recursive: true, force: true })
}
