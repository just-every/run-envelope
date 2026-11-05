import assert from 'node:assert/strict'
import { autonomousPolicy, heldPolicy } from '../src/modules/agent-door/conformance/crypto.mjs'
import { answers, recentNativeProof } from './agent-door/native.mjs'
import { tokenCall, tokenChallenge, tokenInstant } from './agent-door/tokens.mjs'

/** Paired Business credential sanity journey against the emitted persistent Worker. */
export async function tokenJourney({origin,cookie,settings,sql,restart,advanceClock,installation}) {
  const request = (path,body) => fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',
    headers:{origin,cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const owner = async (path,body,status=200) => {
    const response = await request(path,body)
    assert.equal(response.status,status,'native token journey door '+path)
    return response.json()
  }
  await installation.pair(request)
  await recentNativeProof({cookie,settings,sql,now:Date.parse(tokenInstant),id:'synthetic-envelope-token-proof'})
  const company = await owner('/api/envelope/companies',{name:'Synthetic paired employer',ein:'00-0009849'},201)
  const base = '/api/envelope/companies/'+company.id
  const location = await owner(base+'/locations',{name:'Synthetic token workplace',state:'PA'},201)
  const person = await owner(base+'/people',{name:'Synthetic token worker',locationId:location.id},201)
  const rate = await owner(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2500,effectiveDate:'2026-01-01',sourceRef:'synthetic-envelope-9850'},201)
  const review = await owner(base+'/rates/'+rate.id)
  await owner(base+'/rates/'+rate.id+'/approve',{version:review.version,reviewToken:review.reviewToken})
  await owner(base+'/agents/class-policy',{version:0,...answers})

  const tables = ['env_people','env_rate_proposals','env_run_drafts','env_agent_grants','env_agent_credentials','env_business_agent_bindings','env_grants','env_agent_class_policy']
  const retained = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table,await sql('SELECT * FROM '+table+' ORDER BY rowid')])))
  const writes = () => sql("SELECT * FROM env_agent_access WHERE action='drafts:prepare' ORDER BY rowid")
  const noBearerRetention = async () => {
    const names = await sql("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'agent_door_%' OR name LIKE 'env_agent_%' OR name IN ('env_audit','oa_auth_audit','bs_audit')) ORDER BY name")
    let auditRows = 0
    for (const {name} of names) {
      assert.match(name,/^[a-z_]+$/)
      const rows = await sql('SELECT * FROM '+name)
      if (name==='agent_door_audit') auditRows += rows.length
      const serialized = JSON.stringify(rows)
      for (const bearer of installation.bearers)
        assert.equal(serialized.includes(bearer),false,'durable '+name+' contains no plaintext Business bearer')
    }
    assert.ok(auditRows>0,'privacy checks inspect populated durable audit, including successful and refused calls')
  }
  const args = () => ({companyId:company.id,personId:person.id,minutes:480,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9851',requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()})
  const success = answer => {
    assert.equal(answer.status,200)
    assert.equal(answer.body.result?.isError,false)
    return answer.body.result.structuredContent
  }
  for (const phase of ['autonomous','held']) {
    await installation.adopt(request,phase==='autonomous'?autonomousPolicy():heldPolicy())
    installation.context.agentId = crypto.randomUUID()
    const credential = await owner(base+'/agents',{name:'Synthetic paired payroll agent',businessAgentId:installation.context.agentId,hours:1,actions:['records:read','drafts:prepare'],fields:['compensation'],locations:['*']},201)
    const native = (await owner(base+'/agents')).grants.find(row=>row.id===credential.id)
    assert.equal(native.businessAgentId,installation.context.agentId,'a genuine native issuance binds this exact Business agent')
    assert.deepEqual(JSON.parse(native.actions),['records:read','drafts:prepare'])
    const token = await installation.token()
    const read = success(await tokenCall(origin,token,'envelope.records.list',{companyId:company.id}))
    assert.ok(read.records.some(row=>row.id===person.id&&row.name==='Synthetic token worker'),'a valid Business token reads actual native data')
    const before = await writes(), answer = await tokenCall(origin,token,'envelope.draft.prepare',args()), prepared = success(answer)
    assert.equal(answer.body.result._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous')
    assert.equal(prepared.status,'uncalculated-proposal');assert.equal(prepared.approval,'not-approved');assert.equal(prepared.dispatch,'unavailable')
    const effect = (await writes()).filter(row=>!before.some(previous=>previous.id===row.id))
    assert.equal(effect.length,1);assert.equal(effect[0].target_id,prepared.id)
    assert.equal(effect[0].credential_id,credential.id);assert.equal(effect[0].sponsor_id,credential.sponsorId)
    assert.equal(effect[0].door_agent_id,installation.context.agentId);assert.equal(effect[0].door_consent,installation.context.consent)
    const draft = (await owner(base+'/drafts')).find(row=>row.id===prepared.id)
    assert.equal(draft.personId,person.id);assert.equal(draft.minutes,480);assert.equal(draft.rateId,rate.id)

    for (const path of ['/mcp','/api/envelope/mcp']) {
      const refusal = async (bearer,status,options={},needed=[]) => {
        const beforeState = await retained(),beforeWrites = await writes()
        const answer = await tokenCall(origin,bearer,'envelope.draft.prepare',args(),{path,...options})
        assert.equal(answer.status,status,'credential refusal at '+path)
        assert.equal(answer.body.result,undefined,'refusal exposes no business result')
        tokenChallenge(answer,origin,needed)
        if (status===403) assert.equal(answer.body.error?.data?.code,'insufficient_scope')
        assert.deepEqual(await retained(),beforeState,'refusal cannot change retained business records, grants, hashes, bindings or policy')
        assert.deepEqual(await writes(),beforeWrites,'refusal cannot add native preparation attribution')
      }
      await refusal(null,401)
      const anonymous = await tokenCall(origin,null,undefined,undefined,{path})
      assert.equal(anonymous.status,401);tokenChallenge(anonymous,origin)
      const metadata = await (await fetch(origin+'/.well-known/oauth-protected-resource/mcp')).json()
      assert.equal(metadata.resource,origin+'/mcp','the alias still challenges for the canonical MCP resource')
      assert.deepEqual(metadata.authorization_servers,[installation.context.signer.issuer])
      assert.deepEqual(metadata.bearer_methods_supported,['header'])
      assert.deepEqual(metadata.scopes_supported,['credentials:restrict','credentials:rotate','dispatch:execute','drafts:prepare','drafts:read','notices:process','records:read'])
      const discovery = await tokenCall(origin,token,undefined,undefined,{path})
      assert.equal(discovery.status,200)
      assert.deepEqual([...new Set(discovery.body.result.tools.map(tool=>tool._meta['com.runeditrun/scope']))].sort(),metadata.scopes_supported,'advertised scopes cover actual installed discovery')
      console.log('PROBE BASE-AGENT-004 1 '+phase+' '+path+': unauthenticated MCP -> 401, canonical RFC 9728 challenge, trusted issuer and installed scopes')

      const iat = installation.context.now/1000
      await refusal(await installation.token({aud:'https://sibling.example.test/mcp'}),401)
      await refusal(await installation.token({iss:'https://untrusted.example.test'}),401)
      await refusal(await installation.untrustedToken(),401)
      const unbound = await installation.token({act:{sub:crypto.randomUUID(),name:'Synthetic unbound agent',specialist:'payroll'}})
      await refusal(unbound,403,{},['drafts:prepare'])
      console.log('PROBE BASE-AGENT-004 2 '+phase+' '+path+': paired token -> native read and one attributed preparation; foreign audience, untrusted issuer or key and unbound agent -> refused, native state unchanged; sibling installation not exercised')

      success(await tokenCall(origin,await installation.token({iat,exp:iat+900}),'envelope.records.list',{companyId:company.id},{path}))
      await refusal(await installation.token({iat,exp:iat+901}),401)
      await refusal(await installation.token({iat:iat-300,exp:iat-1}),401)
      const edge = await installation.token({iat,exp:iat+1})
      success(await tokenCall(origin,edge,'envelope.records.list',{companyId:company.id},{path}))
      await advanceClock('2026-10-28T12:00:01.000Z')
      await refusal(edge,401)
      await advanceClock(tokenInstant)
      console.log('PROBE BASE-AGENT-004 3 '+phase+' '+path+': 900-second token and pre-expiry read -> served; 901-second, expired and exact-expiry tokens -> 401, no native effect')

      const readonly = await installation.token({scope:'records:read'})
      success(await tokenCall(origin,readonly,'envelope.records.list',{companyId:company.id},{path}))
      await refusal(readonly,403,{},['drafts:prepare'])
      console.log('PROBE BASE-AGENT-004 4 '+phase+' '+path+': read-only token -> native read; preparation -> 403 insufficient_scope with complete write-scope challenge, no effect')

      const queryToken = await installation.token()
      await refusal(null,401,{queryToken})
      await refusal(token,401,{queryToken})
      await noBearerRetention()
      console.log('PROBE BASE-AGENT-004 5 '+phase+' '+path+': query token alone and alongside valid Authorization -> 401, no effect, no bearer in response diagnostics or populated durable audit')
    }
    await restart()
    success(await tokenCall(origin,token,'envelope.records.list',{companyId:company.id},{path:'/api/envelope/mcp'}))
    await noBearerRetention()
  }
  console.log('AGENT-TOKENS passed: both policies, canonical and alias MCP, persisted trust and native binding, unchanged refused effects; privacy recorder checks generated bearers in Worker diagnostics')
}
