import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {randomBytes,randomUUID,webcrypto} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {serveHosted,HOSTED_ORIGIN} from '@runeditrun/rer/internal/cli/hosted-output.mjs'
import {createAgentConformanceNetwork} from '@runeditrun/rer/internal/cli/agent-network.mjs'
import {verificationBindings} from '@runeditrun/rer/internal/cli/agent-bindings.mjs'
import {createProtocol,errorCode} from '../../src/modules/agent-door/conformance/protocol.mjs'
import {autonomousPolicy,heldPolicy,signJws,seconds,accessToken} from '../../src/modules/agent-door/conformance/crypto.mjs'
import {listedDoor} from '../../src/modules/agent-door/conformance/discovery.mjs'
import {runJourney} from '../../src/modules/agent-door/conformance/journey.mjs'
import {removalPhase,blockedPhases} from '../../src/modules/agent-door/conformance/policy-phases.mjs'
import {negativePhase} from '../../src/modules/agent-door/conformance/negative.mjs'
import initializeOwner from './owner.mjs'
import initializeAgent from './agent.mjs'
import {client,cookieOf,state} from './native.mjs'

// Faults affect this verifier's observations only. Product routes, native
// authorization, durable effects and the shared conformance checks stay real.
// Each fault must trip its named assertion after the same check passes cleanly.
const root=process.cwd(),surface=JSON.parse(await readFile('agent-surface.json','utf8'))
const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
const kid=randomUUID(),installationId=randomUUID(),issuer='https://synthetic-envelope-9941.invalid'
const email=['synthetic-envelope-9941','example.invalid'].join('@'),sub=randomUUID(),business='rer-agent-conformance'
const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey),publicKeys={[kid]:{...jwk,kid,alg:'ES256',use:'sig'}}
const signer={issuer,installationId,kid,privateKey:pair.privateKey},token=randomBytes(32).toString('hex')
const values={issuer,installationId,appOrigin:HOSTED_ORIGIN,publicKeys:JSON.stringify(publicKeys),email,sub,token,sessionSecret:randomBytes(32).toString('hex')}
const nativeBindings=await verificationBindings(root,surface.verification.owner.bindings,values)
const network=await createAgentConformanceNetwork(root,surface.verification.network,{email})
let hosted
try {
  hosted=await serveHosted(root,{outboundService:request=>network.fetch(request),bindings:{
    RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_APP_ORIGIN:HOSTED_ORIGIN,
    RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(publicKeys),
    RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:HOSTED_ORIGIN,subject:installationId,email,keys:publicKeys}),
    OWNER_EMAIL:email,SETUP_TOKEN:token,...nativeBindings,
  }})
  const origin=hosted.origin,request=async(absolute,init={})=>{
    const url=new URL(absolute,origin)
    assert.equal(url.origin,origin,'fault probes stay inside the disposable installation')
    const response=await hosted.fetch(url.href.slice(origin.length+1),{...init,signal:AbortSignal.timeout(30000),headers:Object.fromEntries(new Headers(init.headers))})
    return response
  }
  const session=await initializeOwner({request,origin,email,mail:network.mail,reviewers:{},displayName:'Synthetic Envelope 9941',returnTo:'/app',claim:{path:'/auth/bootstrap',token}})
  const cookie=cookieOf(session);await session.body?.cancel()
  const native=client({request,origin,cookie})
  const settings=await signJws(pair.privateKey,kid,'rer-business-settings+jwt',{
    v:1,iss:issuer,aud:origin,sub:installationId,business,email,owner_id:sub,jti:randomUUID(),iat:seconds(),exp:seconds()+300,rev:1,values:{},logo:null,team:null,
  })
  assert.equal((await request('/api/rer/business-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({settings})})).status,200)
  const agentId='synthetic-envelope-'+randomUUID()
  await initializeAgent({agentId,request:(absolute,{headers,...init}={})=>request(absolute,{...init,headers:{...Object.fromEntries(new Headers(headers)),cookie,origin}}),origin})
  const saved=state.get(origin),sponsor=(await native('/auth/session')).operator
  const prepare=async()=>{
    const restriction=await native(saved.base+'/agents',{name:'Synthetic fault-probe restriction',hours:24,actions:['records:read','drafts:prepare','drafts:read'],fields:['compensation'],locations:['*']},201)
    return {clients:{restriction:{token:restriction.token,clientId:restriction.id,agent:{id:restriction.id,name:'Synthetic fault-probe restriction',specialist:surface.specialist}},local:{token:saved.localToken,clientId:saved.grantId,agent:{id:saved.grantId,name:'Payroll assistant',specialist:surface.specialist}}},values:{
      company:saved.company.id,person:saved.person.id,location:saved.location.id,key:randomUUID(),actions:['records:read','drafts:prepare','drafts:read','notices:process','dispatch:execute'],
    }}
  }
  const c=createProtocol({fetch:request,origin,surface,signer,person:{email,cookie,sub},business,consent:randomUUID(),agentId,points:[],seq:0,revision:0,listed:new Map(),prepare})
  c.sponsor.id=sponsor.id
  // The restoration refusal needs its real narrowing step even in a draft-only fault probe.
  const select=ids=>({...surface,journey:surface.journey.filter(step=>ids.includes(step.id)||step.id==='credentials-restrict').sort((a,b)=>Number(a.id==='credentials-restrict')-Number(b.id==='credentials-restrict'))})
  const draft=()=>({...surface.journey.find(step=>step.id==='draft').args,companyId:saved.company.id,personId:saved.person.id,requestKey:randomUUID(),idempotency_key:randomUUID()})
  const extraEffect=async()=>{
    const answer=await c.tool('envelope.draft.prepare',draft(),{client:'local'})
    assert.ok(answer.result?.structuredContent&&!answer.result.isError,'the injected effect is a real authorized native preparation')
  }
  let faults=0
  const exercise=async(label,check,expected,install)=>{
    c.points=[];await check()
    assert.ok(c.points.length&&c.points.every(point=>point.ok),label+' clean control: '+c.points.filter(point=>!point.ok).map(point=>point.id+': '+point.detail).join(', '))
    c.points=[];const restore=install()
    try {await check()} finally {restore()}
    assert.ok(c.points.some(point=>point.id===expected&&!point.ok),label+' fault must fail '+expected)
    faults++
    console.log('PROBE BASE-AGENT-013 3 '+label+': real installed door with one verifier fault -> rejected by '+expected)
  }
  const wrap=(key,alter)=>{
    const original=c[key];c[key]=(...args)=>alter(original,...args)
    return ()=>{c[key]=original}
  }
  const ready=async(document=autonomousPolicy())=>{
    await c.adopt(document);await c.prepare('failure-probes')
    c.listed=new Map((await c.mcp('tools/list')).result.tools.map(tool=>[tool.name,tool]))
  }

  await exercise('effect before approval',async()=>{c.surface=select(['credentials-restrict']);await ready(heldPolicy());await runJourney(c,'failure-approval',{held:true})},
    'BASE-AGENT-007.5.no-effect.credentials-restrict',()=>wrap('stepTool',async(original,...args)=>{
      const answer=await original(...args)
      if(answer.result?.resultType==='input_required')await extraEffect()
      return answer
    }))

  await exercise('effect while blocked',async()=>{
    c.surface=select(['credentials-restrict'])
    await blockedPhases(c)
  },'BASE-AGENT-007.1.blocked-no-effect.access.credentials-restrict',()=>wrap('stepTool',async(original,...args)=>{
    const answer=await original(...args)
    if(errorCode(answer)==='policy_blocked')await extraEffect()
    return answer
  }))

  await exercise('effect before setup',async()=>{c.surface=select(['draft']);await removalPhase(c)},
    'BASE-AGENT-007.2.unset-no-effect',()=>wrap('stepTool',async(original,...args)=>{
      const answer=await original(...args)
      // A person can still work while agents have no policy. Feed that real
      // changed state to the harness as the deliberately faulty observation.
      if(errorCode(answer)==='policy_unset')await native(saved.base+'/people',{name:'synthetic-envelope-'+randomUUID(),locationId:saved.location.id},201)
      return answer
    }))

  const adopt=c.adopt
  for(const held of [false,true]) {
    // Negative token and person-door checks also run under both policies.
    // Retain explicit blocked, removed and single-class policies unchanged.
    c.adopt=(document,options)=>adopt(held&&isDeepStrictEqual(document,autonomousPolicy())?heldPolicy():document,options)
    console.log('AGENT-CONFORMANCE-FAILURES policy='+ (held?'held':'autonomous'))
    await exercise('missing schema',async()=>{c.surface=surface;await ready();await listedDoor(c)},
      'BASE-AGENT-002.2.schema.envelope.draft.prepare',()=>wrap('mcp',async(original,method,...args)=>{
        const answer=await original(method,...args)
        if(method==='tools/list')delete answer.result.tools.find(tool=>tool.name==='envelope.draft.prepare').outputSchema
        return answer
      }))

    await exercise('wrong computed class',async()=>{c.surface=select(['draft']);await ready();await runJourney(c,'failure-class',{held})},
      'BASE-AGENT-006.2.failure-class.draft',()=>wrap('stepTool',async(original,...args)=>{
        const answer=await original(...args)
        answer.decision.classes[0].class='sensitive'
        return answer
      }))

    await exercise('wrong computed facts',async()=>{c.surface=select(['draft']);await ready();await runJourney(c,'failure-facts',{held})},
      'BASE-AGENT-006.2.failure-facts.draft',()=>wrap('stepTool',async(original,...args)=>{
        const answer=await original(...args)
        answer.decision.classes[0].facts.measure=2
        return answer
      }))

    await exercise('argument changes class',async()=>{
      c.surface={...select(['records-list']),journey:[surface.journey.find(step=>step.id==='credentials-restrict'),{...surface.journey.find(step=>step.id==='records-list'),inject:{limit:1,internal:true,confirmExternal:true,confirmed:true}}]}
      await ready();await runJourney(c,'failure-injection',{injections:true,held})
    },'BASE-AGENT-005.5.failure-injection.records-list',()=>wrap('stepTool',async(original,step,args,...rest)=>{
      const answer=await original(step,args,...rest)
      if(args.limit===1)answer.decision.classes[0].class='sensitive'
      return answer
    }))

    await exercise('agent completes person step',async()=>{c.surface=select(['draft']);await negativePhase(c)},
      'BASE-AGENT-008.2.person-door',()=>wrap('request',async(original,path,init={})=>{
        if(new URL(path,origin).pathname==='/agents/api/pause'&&new Headers(init.headers).has('authorization'))
          return original(path,{...init,headers:{origin,cookie,'content-type':'application/json'}})
        return original(path,init)
      }))

    await exercise('wrong audience accepted',async()=>{c.surface=select(['draft']);await negativePhase(c)},
      'BASE-AGENT-004.2.audience',()=>wrap('mcp',async(original,method,params,options={})=>{
        if(options.token) {
          const claims=JSON.parse(Buffer.from(options.token.split('.')[1],'base64url').toString())
          if(claims.aud==='https://sibling.invalid/mcp')options={...options,token:await accessToken(c)}
        }
        return original(method,params,options)
      }))

    await exercise('duplicate effect on retry',async()=>{c.surface=select(['draft']);await ready();await runJourney(c,'failure-replay',{replay:true,held})},
      'BASE-AGENT-012.1.failure-replay',()=>{
        const seen=new Map()
        return wrap('stepTool',async(original,step,args,...rest)=>{
          if(step.id!=='draft')return original(step,args,...rest)
          if(seen.has(args.idempotency_key)) {
            const duplicate=await original(step,{...args,requestKey:randomUUID(),idempotency_key:randomUUID()},...rest)
            assert.ok(duplicate.result?.structuredContent&&!duplicate.result.isError)
            return seen.get(args.idempotency_key)
          }
          const answer=await original(step,args,...rest);seen.set(args.idempotency_key,answer);return answer
        })
      })

    // Compare the same masked identities shown by the current native person
    // door, with populated records rather than two empty or self-derived lists.
    c.surface=surface;await ready()
    const records=(await c.tool('envelope.records.list',{companyId:saved.company.id})).result.structuredContent.records
    const visible=await Promise.all(records.map(async record=>{
      const {id,name,locationId,version}=await native(saved.base+'/people/'+record.id)
      return {id,name,locationId,version}
    }))
    const checkParity=actual=>assert.deepEqual(actual.toSorted((a,b)=>a.id.localeCompare(b.id)),visible.toSorted((a,b)=>a.id.localeCompare(b.id)),'MCP identities must equal the native person door')
    assert.ok(visible.length);checkParity(records)
    const wrong=structuredClone(records);wrong[0].name='synthetic-envelope-wrong-person'
    assert.throws(()=>checkParity(wrong),assert.AssertionError)
    faults++
    console.log('PROBE BASE-AGENT-013 3 role parity: populated MCP and native person reads -> changed identity rejected')
  }
  c.adopt=adopt
  console.log('AGENT-CONFORMANCE-FAILURES passed: '+faults+' faults rejected after clean controls under autonomous and held policies; product authority unchanged')
} finally {
  try {await hosted?.close()} finally {await network.close()}
}
