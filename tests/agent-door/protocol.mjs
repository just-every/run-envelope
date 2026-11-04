import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {VERSION} from '../../src/modules/agent-door/conformance/protocol.mjs'
import {client,state} from './native.mjs'

const legacy='2025-11-25'
const versionMeta=version=>({'io.modelcontextprotocol/protocolVersion':version})

async function retained(db,company) {
  const rows=async(sql)=>(await db.prepare(sql).bind(company).all()).results
  return {
    drafts:await rows('SELECT * FROM env_run_drafts WHERE company_id=? ORDER BY id'),
    bonuses:await rows("SELECT * FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' ORDER BY object_id,version"),
    grants:await rows('SELECT * FROM env_agent_grants WHERE company_id=? ORDER BY id'),
    credentials:await rows('SELECT c.* FROM env_agent_credentials c JOIN env_agent_grants g ON g.id=c.id WHERE g.company_id=? ORDER BY c.id'),
  }
}

/** Public protocol requests must fail before native preparation or rotation. */
export default async function protocolJourney(context) {
  const {phase,request,origin,database,args}=context
  const saved=state.get(origin),data=client(context),db=await database('DB')
  let canonicalTools
  for(const path of ['/mcp','/api/envelope/mcp']) {
    // This new bearer has never initialized: its first request is modern discovery.
    const issued=await data(saved.base+'/agents',{name:'synthetic-envelope-protocol-'+phase,hours:1,
      actions:['records:read','drafts:prepare','drafts:read'],fields:['compensation'],locations:['*'],providers:[],models:[]},201)
    let id=0
    const rpc=async(method,params={},options={})=> {
      const version=options.version??VERSION
      const body=JSON.stringify({jsonrpc:'2.0',id:++id,method,params:{...params,
        ...(version===legacy?{}:{_meta:{...versionMeta(version),...params._meta}})}})
      const headers={authorization:'Bearer '+issued.token,origin,'content-type':'application/json',
        accept:'application/json, text/event-stream','MCP-Protocol-Version':version,'Mcp-Method':method,
        ...(method==='tools/call'?{'Mcp-Name':params.name}:{}),...options.headers}
      const response=await request(origin+path,{method:'POST',headers,
        body:options.stream?new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(body));controller.close()}}):body,
        ...(options.stream?{duplex:'half'}:{})})
      assert.equal(response.headers.get('cache-control'),'no-store','protocol responses are never shared or stored')
      const text=await response.text()
      let parsed
      try {parsed=JSON.parse(text)} catch {assert.equal(response.status,413,'only the outer size guard may return a plain-text refusal')}
      return {status:response.status,headers:response.headers,body:parsed}
    }
    const first=await rpc('tools/list')
    assert.equal(first.status,200,'modern discovery needs no initialization')
    assert.ok(first.body.result.tools.some(tool=>tool.name==='envelope.draft.prepare'),'discovery includes native preparation')
    assert.equal(first.headers.has('mcp-session-id'),false)
    console.log('PROBE BASE-AGENT-001 2: '+phase+' '+path+' fresh bearer, modern tools list without initialize -> 200 with native tools')

    const discovered=await rpc('server/discover'),discovery=discovered.body.result
    assert.equal(discovered.status,200)
    assert.ok(discovery.supportedVersions.includes(VERSION)&&discovery.supportedVersions.includes(legacy))
    assert.ok(discovery.capabilities.tools)
    assert.ok(discovery._meta['io.modelcontextprotocol/serverInfo'].name)
    assert.ok(discovery.instructions.includes('payroll'))
    for(const unsupported of ['roots','sampling','logging']) assert.equal(Object.hasOwn(discovery.capabilities,unsupported),false)

    const second=await rpc('tools/list')
    assert.equal(second.status,200)
    assert.deepEqual(first.body.result,second.body.result,'repeated discovery retains exact order and metadata')
    assert.ok(Number.isFinite(first.body.result.ttlMs)&&first.body.result.ttlMs>=0)
    assert.equal(first.body.result.cacheScope,'private')
    const names=first.body.result.tools.map(tool=>tool.name)
    if(canonicalTools) assert.deepEqual(names,canonicalTools,'the alias exposes the canonical tools')
    else canonicalTools=names
    console.log('PROBE BASE-AGENT-001 4: '+phase+' '+path+' repeated tools list -> identical nonempty list, numeric ttlMs, private cache and no-store')

    const initialized=await rpc('initialize',{protocolVersion:legacy,capabilities:{},clientInfo:{name:'synthetic-envelope-protocol',version:'1'}},{version:legacy})
    assert.equal(initialized.status,200)
    assert.equal(initialized.body.result.protocolVersion,legacy)
    assert.equal(initialized.headers.has('mcp-session-id'),false)
    const oldTools=await rpc('tools/list',{}, {version:legacy})
    assert.equal(oldTools.status,200)
    assert.deepEqual(oldTools.body.result,first.body.result,'legacy initialization exposes the identical tools and cache metadata')

    const baseline=await retained(db,saved.company.id)
    assert.ok(baseline.drafts.length>0,'refusals are checked against retained native preparations')
    assert.ok(baseline.credentials.some(row=>row.id===issued.id),'the disposable credential is genuinely persisted')
    const prepare={name:'envelope.draft.prepare',arguments:{...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}}
    const refuse=async(label,params,options,status,code,message)=> {
      const answer=await rpc('tools/call',params,options)
      assert.equal(answer.status,status,label+' HTTP status')
      if(code!==undefined) {
        assert.equal(answer.body?.error?.code,code,label+' stable RPC code')
        assert.equal(answer.body?.error?.message,message,label+' stable RPC message')
      }
      assert.ok(isDeepStrictEqual(await retained(db,saved.company.id),baseline),label+' leaves retained preparations, grants and credential hashes unchanged')
      return answer
    }
    for(const version of ['2099-01-01','2025-03-26']) {
      const refused=await refuse('unsupported protocol',prepare,{version},400,-32022,'UnsupportedProtocolVersion')
      assert.ok(refused.body.error.data.supported.includes(VERSION)&&refused.body.error.data.supported.includes(legacy))
      assert.equal(refused.body.error.data.requested,version)
    }
    console.log('PROBE BASE-AGENT-001 3: '+phase+' '+path+' unsupported versions with native preparation -> UnsupportedProtocolVersion, unchanged native state')
    await refuse('foreign Origin',prepare,{headers:{origin:'https://synthetic-envelope-foreign.invalid'}},403,-32600,'Origin refused')
    await refuse('method mismatch',prepare,{headers:{'Mcp-Method':'tools/list'}},400,-32020,'HeaderMismatch')
    await refuse('version metadata mismatch',{...prepare,_meta:versionMeta(legacy)},{},400,-32020,'HeaderMismatch')
    const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt'])
    const {kty,n,e}=await crypto.subtle.exportKey('jwk',pair.publicKey)
    await refuse('rotation name mismatch',{name:'envelope.credentials.rotate',arguments:{publicKey:{kty,n,e},idempotency_key:crypto.randomUUID()}},
      {headers:{'Mcp-Name':'envelope.draft.prepare'}},400,-32020,'HeaderMismatch')
    console.log('PROBE BASE-AGENT-001 5: '+phase+' '+path+' foreign Origin and method, name and version mismatches -> refused, preparations and credentials unchanged')

    const max=discovery._meta['com.runeditrun/limits'].maxBodyBytes
    assert.ok(Number.isSafeInteger(max)&&max>0)
    // The extra metadata keeps the business arguments valid if a size guard regresses.
    const oversized={...prepare,_meta:{padding:'x'.repeat(max+1)}}
    await refuse('oversized body',oversized,{},413)
    await refuse('oversized stream',oversized,{stream:true},413)
    const stillValid=await request(origin+'/api/envelope/v1/companies/'+saved.company.id+'/records',{headers:{authorization:'Bearer '+issued.token}})
    assert.equal(stillValid.status,200,'protocol refusals do not invalidate the real native credential')
    assert.ok((await stillValid.json()).records.some(record=>record.id===saved.person.id))
    assert.ok(isDeepStrictEqual(await retained(db,saved.company.id),baseline),'native read confirms unchanged state independently of protocol errors')
    console.log('PROBE BASE-AGENT-001 6: '+phase+' '+path+' oversized body and stream -> 413, unchanged populated preparation and credential state, bearer still reads native records')
  }
}
