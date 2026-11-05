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
      const headers={authorization:'Bearer '+(options.token??issued.token),origin,'content-type':'application/json',
        accept:'application/json, text/event-stream','MCP-Protocol-Version':version,'Mcp-Method':method,
        ...(['tools/call','prompts/get','resources/read'].includes(method)?{'Mcp-Name':method==='resources/read'?params.uri:params.name}:{}),...options.headers}
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
    assert.ok(discovery.capabilities.resources)
    assert.ok(discovery.capabilities.prompts)
    assert.ok(discovery._meta['io.modelcontextprotocol/serverInfo'].name)
    assert.ok(discovery._meta['io.modelcontextprotocol/serverInfo'].version)
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

    const resourceUri='envelope://companies/'+saved.company.id+'/preparation-state'
    const cacheLists={}
    for(const [method,field] of [['resources/templates/list','resourceTemplates'],['prompts/list','prompts']]) {
      const listed=await rpc(method),again=await rpc(method),old=await rpc(method,{}, {version:legacy})
      assert.equal(listed.status,200)
      assert.deepEqual(listed.body.result,again.body.result,'resource and prompt lists are deterministic')
      assert.deepEqual(listed.body.result,old.body.result,'both protocols expose identical resource and prompt lists')
      assert.equal(listed.body.result.cacheScope,'private')
      assert.ok(Number.isFinite(listed.body.result.ttlMs)&&listed.body.result.ttlMs>=0)
      assert.ok(listed.body.result[field].length>0,'offered capabilities have usable entries')
      cacheLists[field]=listed.body.result[field]
    }
    assert.ok(cacheLists.resourceTemplates.some(item=>resourceUri===item.uriTemplate.replace('{company}',saved.company.id)))
    const prepared=await rpc('tools/call',{name:'envelope.draft.prepare',arguments:{...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}})
    assert.equal(prepared.body.result.isError,false,'the disposable native credential prepares real hourly inputs')
    const snapshot=await rpc('tools/call',{name:'envelope.workspace.snapshot',arguments:{}})
    const resource=await rpc('resources/read',{uri:resourceUri})
    assert.equal(resource.status,200)
    assert.equal(resource.body.error,undefined)
    assert.equal(resource.body.result.contents.length,1)
    assert.equal(resource.body.result.contents[0].uri,resourceUri)
    const observed=JSON.parse(resource.body.result.contents[0].text)
    assert.equal(snapshot.body.result.isError,false)
    assert.deepEqual(observed,snapshot.body.result.structuredContent,'the resource uses the existing scoped native action')
    const visiblePeople=await db.prepare('SELECT COUNT(*) AS n FROM env_people WHERE company_id=?').bind(saved.company.id).first()
    const visibleDrafts=await db.prepare('SELECT COUNT(*) AS n FROM env_run_drafts WHERE company_id=? AND credential_id=?').bind(saved.company.id,issued.id).first()
    assert.ok(visiblePeople.n>0&&visibleDrafts.n>0,'the resource checks populated native state')
    assert.equal(observed.people,visiblePeople.n)
    assert.equal(observed.drafts,visibleDrafts.n)
    assert.deepEqual(Object.keys(observed).sort(),['bonuses','drafts','people','sha256'],'resource contains only the existing counts and digest')
    const beforePrompts=await retained(db,saved.company.id)
    for(const prompt of cacheLists.prompts) {
      const answer=await rpc('prompts/get',{name:prompt.name})
      assert.equal(answer.status,200)
      assert.equal(answer.body.error,undefined)
      assert.ok(answer.body.result.messages.length>0)
      const messages=answer.body.result.messages
      assert.ok(messages.every(message=>message.role==='user'&&message.content.type==='text'&&message.content.text.length>0))
      const instructions=messages.map(message=>message.content.text).join('\n')
      const referenced=instructions.match(/envelope\.[a-z_]+\.[a-z_]+/g)
      assert.ok(referenced.length>0)
      assert.ok(referenced.every(name=>names.includes(name)),'the prompt refers only to installed tools')
      assert.ok(isDeepStrictEqual(await retained(db,saved.company.id),beforePrompts),'retrieving a prompt has no native business or credential effect')
    }
    console.log('PROBE BASE-AGENT-001 1: '+phase+' '+path+' discovery -> versions, tools, resources, prompts, server identity and specialist instructions; populated preparation resource matches native state; prompt retrieves without action')

    const baseline=await retained(db,saved.company.id)
    assert.ok(baseline.drafts.length>0,'refusals are checked against retained native preparations')
    assert.ok(baseline.credentials.some(row=>row.id===issued.id),'the disposable credential is genuinely persisted')
    for(const method of [['roots','list'],['sampling','createMessage'],['logging','setLevel']].map(parts=>parts.join('/'))) {
      const absent=await rpc(method)
      assert.equal(absent.status,404,'Roots, Sampling and Logging are not served')
      assert.equal(absent.body.error.code,-32601)
      assert.ok(isDeepStrictEqual(await retained(db,saved.company.id),baseline),'unsupported protocol families have no native effect')
    }
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
    const foreign=await data('/api/envelope/companies',{name:'Synthetic protocol isolation',ein:'00-0000081'},201)
    const missing=await rpc('resources/read',{uri:'envelope://companies/'+crypto.randomUUID()+'/preparation-state'})
    const forbidden=await rpc('resources/read',{uri:'envelope://companies/'+foreign.id+'/preparation-state'})
    assert.deepEqual(forbidden.body.error,missing.body.error,'foreign and absent companies reveal no resource content')
    assert.equal(forbidden.body.result,undefined)
    const restricted=await data(saved.base+'/agents',{name:'synthetic-envelope-protocol-restricted',hours:1,
      actions:['drafts:read'],fields:['compensation'],locations:['*'],providers:[],models:[]},201)
    const noScope=await rpc('resources/read',{uri:resourceUri},{token:restricted.token})
    assert.equal(noScope.status,403,'a native credential without records authority cannot read preparation state')
    assert.equal(noScope.body.error.data.code,'insufficient_scope')
    assert.equal(noScope.body.result,undefined)
    await data('/agents/api/pause',{paused:true})
    try {
      const pausedResource=await rpc('resources/read',{uri:resourceUri})
      const pausedPrompt=await rpc('prompts/get',{name:cacheLists.prompts[0].name})
      assert.equal(pausedResource.body.error.data.code,'agents_paused')
      assert.equal(pausedResource.body.result,undefined)
      assert.equal(pausedPrompt.body.error.data.code,'agents_paused')
      assert.equal(pausedPrompt.body.result,undefined)
    } finally {await data('/agents/api/pause',{paused:false})}
    const nativePolicy=await data(saved.base+'/agents')
    await data(saved.base+'/agents/pause',{version:nativePolicy.classPolicy.version,paused:true})
    try {
      const paused=await rpc('resources/read',{uri:resourceUri})
      assert.equal(paused.body.result,undefined,'native company Pause prevents resource delivery')
      assert.ok(paused.body.error)
    } finally {
      const current=await data(saved.base+'/agents')
      await data(saved.base+'/agents/pause',{version:current.classPolicy.version,paused:false})
    }
    const issuedGrant=nativePolicy.grants.find(grant=>grant.id===issued.id)
    await data(saved.base+'/agents/'+issued.id+'/revoke',{version:issuedGrant.version})
    const revoked=await rpc('resources/read',{uri:resourceUri})
    assert.equal(revoked.status,401)
    assert.equal(revoked.body.result,undefined,'revocation prevents resource delivery')
    console.log('PROBE BASE-AGENT-001 6: '+phase+' '+path+' oversized body and stream -> 413, unchanged populated preparation and credential state, bearer still reads native records')
  }
}
