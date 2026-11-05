import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { accessToken, policyEnvelope, signJws } from '../../src/modules/agent-door/conformance/crypto.mjs'
import { privateValue } from '../privacy-recorder.mjs'

export const tokenInstant = '2026-10-28T12:00:00.000Z'

/** Disposable installation trust, using the installed Business wire formats. */
export async function tokenInstallation(origin, email) {
  const keys = await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
  const kid = crypto.randomUUID(), issuer = 'https://business.example.test', installationId = crypto.randomUUID()
  const publicKeys = {[kid]:await webcrypto.subtle.exportKey('jwk',keys.publicKey)}
  const trust = {v:1,issuer,audience:'self-host',subject:installationId,email,keys:publicKeys}
  const context = {
    origin, signer:{privateKey:keys.privateKey,kid,issuer,installationId}, now:Date.parse(tokenInstant),
    business:crypto.randomUUID(), person:{sub:crypto.randomUUID(),email}, consent:crypto.randomUUID(),
    surface:{specialist:'payroll',tools:[]}, seq:0, revision:0, revoked:{agents:[],consents:[]},
  }
  const bearers = new Set()
  const mails = []
  const recipients=new Set([email])
  const remember = token => {bearers.add(token);privateValue(token);return token}
  return {
    context, bearers, mails, recipients,
    async mailEdge(request) {
      assert.equal(request.url,'https://api.resend.com/emails')
      assert.equal(request.method,'POST')
      const body=await request.json()
      assert.equal(body.to.length,1)
      assert.ok(recipients.has(body.to[0]),'only explicitly admitted native identity recipients are permitted')
      assert.equal(body.cc,undefined);assert.equal(body.bcc,undefined)
      assert.equal(body.attachments,undefined)
      mails.push(body)
      return Response.json({id:crypto.randomUUID()})
    },
    bindings:{
      RER_OWNER_CLAIM_ISSUER:issuer, RER_OWNER_CLAIM_INSTALLATION_ID:installationId,
      RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(publicKeys), RER_BUSINESS_TRUST:JSON.stringify(trust),
    },
    async pair(request, status=200) {
      const iat = context.now / 1000
      const settings = await signJws(keys.privateKey,kid,'rer-business-settings+jwt',{
        v:1,iss:issuer,aud:trust.audience,sub:installationId,business:context.business,email,
        owner_id:context.person.sub,jti:crypto.randomUUID(),iat,exp:iat+300,rev:1,
        values:{display_name:'Synthetic token employer'},logo:null,team:[],
      })
      const response = await request('/api/rer/business-settings',{settings})
      assert.equal(response.status,status,'the existing signed settings lifecycle binds the Business owner only while paired')
      await response.body.cancel()
    },
    async adopt(request, document, options={}) {
      const revoked={agents:[...new Set([...context.revoked.agents,...options.revoked?.agents??[]])],consents:[...new Set([...context.revoked.consents,...options.revoked?.consents??[]])]}
      const signed = await policyEnvelope(context,document,{...options,revoked})
      const response = await request('/api/rer/agent-policy',{policy:signed.policy})
      assert.equal(response.status,200,'the existing signed policy receiver adopts the company policy')
      const body = await response.json()
      assert.deepEqual(body.adopted,{seq:signed.payload.seq,revision:signed.payload.revision})
      context.seq = signed.payload.seq;context.revision = signed.payload.revision
      context.revoked=revoked
      return signed
    },
    async token(overrides = {}) {
      return remember(await accessToken(context,{scope:'records:read drafts:prepare',...overrides}))
    },
    async untrustedToken() {
      const foreign = await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify'])
      return remember(await accessToken({...context,signer:{...context.signer,privateKey:foreign.privateKey}},{scope:'records:read drafts:prepare'}))
    },
  }
}

let requestId = 0
/** Exercise real MCP transport; never put credentials in assertion diagnostics. */
export async function tokenCall(origin, token, name, args, {path='/mcp',queryToken,headerToken=token,request=fetch,headers={}} = {}) {
  const url = new URL(path,origin)
  if (queryToken) url.searchParams.set('access_token',queryToken)
  const method = name ? 'tools/call' : 'tools/list'
  const response = await request(url,{
    method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json',
      'MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,
      ...(name?{'Mcp-Name':name}:{}),...(headerToken?{authorization:'Bearer '+headerToken}:{}),...headers,
    },
    body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params:{
      ...(name?{name,arguments:args}:{}),_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'},
    }}),
  })
  const text = await response.text()
  for (const bearer of [token,queryToken,headerToken].filter(Boolean))
    assert.equal(text.includes(bearer) || JSON.stringify([...response.headers]).includes(bearer),false,'MCP response diagnostics never echo a bearer')
  return {status:response.status,headers:response.headers,body:JSON.parse(text)}
}

/** The same isolated HTTPS transport used by native identity journeys.
 * Its certificate exception is confined to this exact loopback installation. */
export function tokenTransport(origin) {
  assert.equal(new URL(origin).hostname,'127.0.0.1')
  return (url,init={})=>new Promise((resolve,reject)=>{
    assert.equal(new URL(url).origin,origin)
    const request=httpsRequest(url,{method:init.method,headers:init.headers,rejectUnauthorized:false},response=>{
      const chunks=[]
      response.on('data',chunk=>chunks.push(chunk));response.on('error',reject)
      response.on('end',()=>{
        const headers=new Headers()
        for(let i=0;i<response.rawHeaders.length;i+=2) headers.append(response.rawHeaders[i],response.rawHeaders[i+1])
        resolve(new Response([204,304].includes(response.statusCode)?null:Buffer.concat(chunks),{status:response.statusCode,headers}))
      })
    })
    request.on('error',reject);request.end(init.body)
  })
}

export function tokenChallenge(answer, origin, needed = []) {
  assert.equal(answer.headers.get('www-authenticate'), 'Bearer '+
    (needed.length?'error="insufficient_scope", scope="'+needed.join(' ')+'", ':'')+
    'resource_metadata="'+origin+'/.well-known/oauth-protected-resource/mcp"')
}
