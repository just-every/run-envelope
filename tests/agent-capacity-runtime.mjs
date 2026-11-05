import assert from 'node:assert/strict'
import {hashToken} from '../src/modules/operator-auth/crypto.mjs'
import {autonomousPolicy,heldPolicy} from '../src/modules/agent-door/conformance/crypto.mjs'
import {answers} from './agent-door/native.mjs'

/** Real issued credentials, emitted Worker, persistent D1 and public transports. */
export async function agentCapacityJourney({origin,cookie,settings,sql,restart,advanceClock}) {
  const owner=async(path,body,method=body===undefined?'GET':'POST',status=200)=>{
    const response=await fetch(origin+path,{method,redirect:'manual',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(response.status,status,path+' '+await response.clone().text())
    return response.json()
  }
  // Reuse the installation bootstrap's recent-proof seam. Agent credentials,
  // policies, source reviews and business effects still use their public doors.
  const now=Date.parse('2026-10-28T12:00:00Z'),ownerHash=await hashToken(settings.SESSION_SECRET,'session',cookie.split('=')[1])
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
    SELECT 'synthetic-envelope-capacity-proof',token_hash,id,operator_id,operator_version,'credentials:mint','/app',${now},${now+600000},${now} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
  const company=await owner('/api/envelope/companies',{name:'Synthetic capacity employer',ein:'00-0009851'},'POST',201),base='/api/envelope/companies/'+company.id
  const location=await owner(base+'/locations',{name:'Synthetic capacity workplace',state:'PA'},'POST',201)
  const person=await owner(base+'/people',{name:'Synthetic capacity worker',locationId:location.id},'POST',201)
  const rate=await owner(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2500,effectiveDate:'2026-01-01',sourceRef:'synthetic-envelope-9852'},'POST',201)
  const review=await owner(base+'/rates/'+rate.id)
  await owner(base+'/rates/'+rate.id+'/approve',{version:review.version,reviewToken:review.reviewToken})
  await owner(base+'/agents/class-policy',{version:0,...answers})
  const issue=()=>owner(base+'/agents',{name:'Synthetic capacity agent',hours:24,actions:['records:read','drafts:read','drafts:prepare'],fields:['compensation'],locations:['*']},'POST',201)
  let sequence=0
  const wire=async(credential,path,name,args={},method='tools/call')=>{
    const id=++sequence,response=await fetch(origin+path,{method:'POST',headers:{origin,...(credential?{authorization:'Bearer '+credential.token}:{}),'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(method==='tools/call'?{'Mcp-Name':name}:{})},body:JSON.stringify({jsonrpc:'2.0',id,method,params:{...(method==='tools/call'?{name,arguments:args}:{}),_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})})
    const body=await response.json()
    assert.equal(body.id,id,'capacity errors retain the parsed request id')
    return {response,body}
  }
  const rest=async(credential,body,method=body===undefined?'GET':'POST')=>{
    const response=await fetch(origin+'/api/envelope/v1/companies/'+company.id+(body===undefined?'/records':'/drafts'),{method,headers:{origin,authorization:'Bearer '+credential.token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    return {response,body:method==='HEAD'?null:await response.json()}
  }
  const read=async(credential,route)=>{
    const value=route==='rest'?await rest(credential):await wire(credential,route,'envelope.records.list',{companyId:company.id})
    assert.equal(value.response.status,200,JSON.stringify(value.body))
    const records=route==='rest'?value.body:value.body.result.structuredContent
    assert.equal(records.records.length,1)
    assert.equal(records.records[0].id,person.id)
    assert.equal(records.records[0].name,person.name)
    return value
  }
  const business=async()=>({drafts:await owner(base+'/drafts'),person:await owner(base+'/people/'+person.id),grants:(await owner(base+'/agents')).grants})
  const limited=({response,body},native=true)=>{
    assert.equal(response.status,429,JSON.stringify(body))
    assert.match(response.headers.get('retry-after')??'',/^[1-9][0-9]*$/)
    assert.equal(Number(response.headers.get('retry-after')),48,'wait is rounded up to the controlled minute boundary')
    assert.equal(response.headers.get('cache-control'),'no-store')
    assert.equal(response.headers.get('www-authenticate'),null,'valid exhaustion does not ask for a new credential')
    if(body)assert.equal(body.error?.data?.code??body.error,native?'agent_rate_limited':'rate_limited')
  }
  const routes=['/mcp','/api/envelope/mcp','rest']
  const invalid={token:'A'.repeat(43)}
  for(const [phase,document] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]) {
    await advanceClock('2026-10-28T12:00:00.000Z')
    await owner('/agents/api/policy',{document},'PUT')
    const credential=await issue(),independent=await issue()
    const discovery=await wire(null,'/mcp',null,{},'server/discover'),alias=await wire(null,'/api/envelope/mcp',null,{},'server/discover')
    const limits=discovery.body.result._meta['com.runeditrun/limits']
    assert.deepEqual(alias.body.result._meta['com.runeditrun/limits'],limits)
    assert.ok(Number.isSafeInteger(limits.requestsPerMinute)&&limits.requestsPerMinute>1&&limits.requestsPerMinute<=1000)
    for(const route of routes) {
      const bad=route==='rest'?await rest(invalid):await wire(invalid,route,'envelope.records.list',{companyId:company.id})
      assert.equal(bad.response.status,401,'unknown bearer is unauthenticated before capacity admission')
      assert.equal(bad.response.headers.get('retry-after'),null)
    }
    for(let slot=1;slot<limits.requestsPerMinute;slot++)await read(credential,routes[(slot-1)%routes.length])
    // A native counter is inspected only, never seeded or reset. It independently
    // proves that aliases and the REST adapter charge exactly one slot each.
    const counter=await sql(`SELECT count FROM oa_limits WHERE key='envelope-agent:${credential.id}'`)
    assert.equal(counter[0].count,limits.requestsPerMinute-1)
    const before=await business(),args={companyId:company.id,personId:person.id,minutes:480,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9853',requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
    const {companyId,idempotency_key,...restArgs}=args
    const last=phase==='autonomous'?await wire(credential,'/mcp','envelope.draft.prepare',args):await rest(credential,restArgs)
    assert.equal(last.response.status,phase==='autonomous'?200:201,JSON.stringify(last.body))
    const result=phase==='autonomous'?last.body.result.structuredContent:last.body
    const admitted=await business(),draft=admitted.drafts.find(row=>row.id===result.id)
    assert.equal(admitted.drafts.length,before.drafts.length+1,'last advertised slot creates exactly one retained preparation')
    assert.equal(draft.personId,person.id);assert.equal(draft.minutes,480);assert.equal(draft.rateId,rate.id)
    await advanceClock('2026-10-28T12:00:12.345Z')
    for(const route of routes) {
      const attempt={...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
      const {companyId,idempotency_key,...nativeArgs}=attempt
      limited(route==='rest'?await rest(credential,nativeArgs):await wire(credential,route,'envelope.draft.prepare',attempt))
      assert.deepEqual(await business(),admitted,'capacity refuses before any preparation or credential change')
    }
    limited(await rest(credential,undefined,'HEAD'))
    for(const route of routes) {
      const bad=route==='rest'?await rest(invalid):await wire(invalid,route,'envelope.records.list',{companyId:company.id})
      assert.equal(bad.response.status,401,'an exhausted installation never authenticates an invalid credential')
    }
    for(const route of routes)await read(independent,route)
    assert.deepEqual(await business(),admitted,'independent issued capacity and owner browser reads remain available')
    await restart()
    await advanceClock('2026-10-28T12:00:12.345Z')
    for(const route of routes)limited(route==='rest'?await rest(credential):await wire(credential,route,'envelope.records.list',{companyId:company.id}))
    assert.deepEqual(await business(),admitted,'persistent exhaustion survives Worker restart without business effects')
    console.log('PROBE BASE-AGENT-011 1 '+phase+': advertised slots across both MCP routes and v1 REST -> last preparation admitted, first and mixed-route overruns 429 with Retry-After 48; invalid bearer 401, independent credential and browser session still work; restart retains exhaustion')
    await advanceClock('2026-10-28T12:00:59.999Z')
    const edge=await wire(credential,'/mcp','envelope.records.list',{companyId:company.id})
    assert.equal(edge.response.status,429);assert.equal(edge.response.headers.get('retry-after'),'1')
    await advanceClock('2026-10-28T12:01:00.000Z')
    for(const route of routes)await read(credential,route)
    assert.deepEqual(await business(),admitted,'minute rollover restores reads without replaying refused writes')
    // Simultaneous routes contend for one remaining slot in persistent D1.
    const racing=await issue()
    for(let slot=1;slot<limits.requestsPerMinute;slot++)await read(racing,routes[(slot-1)%routes.length])
    const beforeRace=await business()
    const attempts=await Promise.all(routes.map(route=>route==='rest'?rest(racing):wire(racing,route,'envelope.records.list',{companyId:company.id})))
    assert.equal(attempts.filter(value=>value.response.status===200).length,1,'only one route may take the final capacity slot')
    for(const refused of attempts.filter(value=>value.response.status!==200)) {
      assert.equal(refused.response.status,429,JSON.stringify(refused.body))
      assert.equal(refused.response.headers.get('retry-after'),'60')
    }
    assert.deepEqual(await business(),beforeRace,'contending reads cannot create business effects')
    console.log('PROBE BASE-AGENT-011 1 '+phase+': simultaneous calls through both MCP routes and v1 REST with one slot left -> exactly one admitted and two HTTP 429, unchanged business state')
    // Resumed capacity supplies no authority after the owner revokes the grant.
    await owner(base+'/agents/'+credential.id+'/revoke',{version:1})
    const revoked=await business()
    for(const route of routes) {
      const denied=route==='rest'?await rest(credential):await wire(credential,route,'envelope.records.list',{companyId:company.id})
      assert.equal(denied.response.status,route==='rest'?403:401)
      assert.equal(denied.response.headers.get('retry-after'),null)
    }
    assert.deepEqual(await business(),revoked,'revocation cannot reveal records or perform business work')
    console.log('PROBE BASE-AGENT-011 1 '+phase+': final millisecond -> Retry-After 1; next minute -> all routes resume reads; current owner revocation -> authority refusal with unchanged business state')
  }
}
