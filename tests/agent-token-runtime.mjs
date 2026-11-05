import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { autonomousPolicy, heldPolicy, policyEnvelope } from '../src/modules/agent-door/conformance/crypto.mjs'
import { answers } from './agent-door/native.mjs'
import { tokenCall, tokenChallenge, tokenInstant } from './agent-door/tokens.mjs'

/** Paired Business credential sanity journey against the emitted persistent Worker. */
export async function tokenJourney({origin,cookie,settings,sql,restart,advanceClock,installation,request:transport}) {
  const request = (path,body,who=cookie,extra={}) => transport(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',
    headers:{origin,...(who?{cookie:who}:{}),'content-type':'application/json','CF-Connecting-IP':'127.0.0.2',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const owner = async (path,body,status=200) => {
    const response = await request(path,body)
    assert.equal(response.status,status,'native token journey door '+path)
    return response.json()
  }
  await installation.pair(request)
  assert.equal((await request('/auth/settings/business',{})).status,403,'bootstrap alone supplies no recent identity proof')
  const signIn=async()=>{
    const before=installation.mails.length
    assert.equal((await request('/auth/magic-link',{email:settings.OWNER_EMAIL,returnTo:'/app'},'')).status,202)
    assert.equal(installation.mails.length,before+1,'a real native link reaches the declared mail edge')
    const link=new URL(installation.mails.at(-1).text.match(/https:\/\/[^\s]+/)[0])
    assert.equal(link.origin,origin)
    const response=await request('/auth/confirm',{token:link.searchParams.get('token')},'')
    assert.equal(response.status,303)
    cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
    assert.ok(cookie.startsWith('__Host-operator_session='))
    assert.equal((await request('/auth/confirm',{token:link.searchParams.get('token')},'')).status,400,'native identity links remain single use')
  }
  await signIn()
  const mcp=(bearer,name,args,options={})=>tokenCall(origin,bearer,name,args,{...options,request:transport})
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
  const refused = async (bearer,name,input,path='/mcp') => {
    const before=await retained(),effects=await writes()
    const answer=await mcp(bearer,name,input,{path})
    assert.equal(answer.status,401,'withdrawn Business authority returns the canonical challenge')
    tokenChallenge(answer,origin)
    assert.equal(answer.body.result,undefined,'withdrawal cannot disclose an earlier outcome')
    assert.deepEqual(await retained(),before)
    assert.deepEqual(await writes(),effects)
  }
  const waitingForBatch=async()=>{
    let waiting=false
    for(let i=0;i<200;i++) {
      const probe=await transport(origin+'/health',{headers:{'x-synthetic-policy-batch':'observe'}})
      if(probe.headers.get('x-synthetic-policy-state')==='waiting'){waiting=true;break}
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    assert.equal(waiting,true,'the real native action is suspended at its selected storage batch')
  }
  const releaseBatch=()=>transport(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}})
  const suspended = async (bearer,withdraw) => {
    const before=await retained(),effects=await writes()
    const pending=mcp(bearer,'envelope.draft.prepare',args(),{headers:{'x-synthetic-policy-batch':'hold-preparation'}})
    try {
      await waitingForBatch()
      await withdraw()
    } finally {
      await releaseBatch()
    }
    const answer=await pending
    assert.equal(answer.status,200)
    assert.equal(answer.body.result?.isError,true,'withdrawal fences an already admitted preparation')
    assert.equal(answer.body.result?.structuredContent,undefined)
    assert.deepEqual(await retained(),before,'a suspended request cannot change native business or credential state')
    assert.deepEqual(await writes(),effects,'withdrawal leaves no native preparation effect')
  }
  for (const phase of ['autonomous','held']) {
    const policy=phase==='autonomous'?autonomousPolicy():heldPolicy()
    const initialPolicy=await installation.adopt(request,policy)
    installation.context.consent=crypto.randomUUID()
    installation.context.agentId = crypto.randomUUID()
    const credential = await owner(base+'/agents',{name:'Synthetic paired payroll agent',businessAgentId:installation.context.agentId,hours:1,actions:['records:read','drafts:prepare'],fields:['compensation'],locations:['*']},201)
    const native = (await owner(base+'/agents')).grants.find(row=>row.id===credential.id)
    assert.equal(native.businessAgentId,installation.context.agentId,'a genuine native issuance binds this exact Business agent')
    assert.deepEqual(JSON.parse(native.actions),['records:read','drafts:prepare'])
    const token = await installation.token()
    const read = success(await mcp(token,'envelope.records.list',{companyId:company.id}))
    assert.ok(read.records.some(row=>row.id===person.id&&row.name==='Synthetic token worker'),'a valid Business token reads actual native data')
    const preparedArgs=args(), before = await writes(), answer = await mcp(token,'envelope.draft.prepare',preparedArgs), prepared = success(answer)
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
        const answer = await mcp(bearer,'envelope.draft.prepare',args(),{path,...options})
        assert.equal(answer.status,status,'credential refusal at '+path)
        assert.equal(answer.body.result,undefined,'refusal exposes no business result')
        tokenChallenge(answer,origin,needed)
        if (status===403) assert.equal(answer.body.error?.data?.code,'insufficient_scope')
        assert.deepEqual(await retained(),beforeState,'refusal cannot change retained business records, grants, hashes, bindings or policy')
        assert.deepEqual(await writes(),beforeWrites,'refusal cannot add native preparation attribution')
      }
      await refusal(null,401)
      const anonymous = await mcp(null,undefined,undefined,{path})
      assert.equal(anonymous.status,401);tokenChallenge(anonymous,origin)
      const metadata = await (await transport(origin+'/.well-known/oauth-protected-resource/mcp')).json()
      assert.equal(metadata.resource,origin+'/mcp','the alias still challenges for the canonical MCP resource')
      assert.deepEqual(metadata.authorization_servers,[installation.context.signer.issuer])
      assert.deepEqual(metadata.bearer_methods_supported,['header'])
      assert.deepEqual(metadata.scopes_supported,['credentials:restrict','credentials:rotate','dispatch:execute','drafts:prepare','drafts:read','notices:process','records:read'])
      const discovery = await mcp(token,undefined,undefined,{path})
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

      success(await mcp(await installation.token({iat,exp:iat+900}),'envelope.records.list',{companyId:company.id},{path}))
      await refusal(await installation.token({iat,exp:iat+901}),401)
      await refusal(await installation.token({iat:iat-300,exp:iat-1}),401)
      const edge = await installation.token({iat,exp:iat+1})
      success(await mcp(edge,'envelope.records.list',{companyId:company.id},{path}))
      await advanceClock('2026-10-28T12:00:01.000Z')
      await refusal(edge,401)
      await advanceClock(tokenInstant)
      console.log('PROBE BASE-AGENT-004 3 '+phase+' '+path+': 900-second token and pre-expiry read -> served; 901-second, expired and exact-expiry tokens -> 401, no native effect')

      const readonly = await installation.token({scope:'records:read'})
      success(await mcp(readonly,'envelope.records.list',{companyId:company.id},{path}))
      await refusal(readonly,403,{},['drafts:prepare'])
      console.log('PROBE BASE-AGENT-004 4 '+phase+' '+path+': read-only token -> native read; preparation -> 403 insufficient_scope with complete write-scope challenge, no effect')

      const queryToken = await installation.token()
      await refusal(null,401,{queryToken})
      await refusal(token,401,{queryToken})
      await noBearerRetention()
      console.log('PROBE BASE-AGENT-004 5 '+phase+' '+path+': query token alone and alongside valid Authorization -> 401, no effect, no bearer in response diagnostics or populated durable audit')
    }
    await restart()
    success(await mcp(token,'envelope.records.list',{companyId:company.id},{path:'/api/envelope/mcp'}))
    await noBearerRetention()
    const consent=installation.context.consent
    const independent=await installation.token({consent:crypto.randomUUID()})
    success(await mcp(independent,'envelope.records.list',{companyId:company.id}))
    await suspended(token,()=>installation.adopt(request,policy,{revoked:{agents:[],consents:[consent]}}))
    assert.equal((await request('/api/rer/agent-policy',{policy:initialPolicy.policy})).status,409,'a captured earlier signed policy cannot restore consent')
    for(const path of ['/mcp','/api/envelope/mcp']) {
      await refused(token,'envelope.records.list',{companyId:company.id},path)
      await refused(token,'envelope.draft.prepare',args(),path)
      await refused(token,'envelope.draft.prepare',preparedArgs,path)
      await refused(token,undefined,undefined,path)
      success(await mcp(independent,'envelope.records.list',{companyId:company.id},{path}))
    }
    await advanceClock('2026-10-28T12:00:59.000Z')
    await refused(await installation.token(),'envelope.draft.prepare',preparedArgs)
    await restart()
    await refused(token,'envelope.draft.prepare',preparedArgs)
    success(await mcp(independent,'envelope.records.list',{companyId:company.id}))
    await advanceClock(tokenInstant)
    // Seed-side withdrawal is deliberately broader: the owner revokes this
    // recorded Business agent. Its separate native bearer remains independent.
    await owner('/agents/api/agents/'+installation.context.agentId+'/revoke',{})
    for(const path of ['/mcp','/api/envelope/mcp']) {
      await refused(independent,'envelope.records.list',{companyId:company.id},path)
      await refused(independent,'envelope.draft.prepare',preparedArgs,path)
    }
    success(await mcp(credential.token,'envelope.records.list',{companyId:company.id}))
    await restart()
    await refused(independent,'envelope.draft.prepare',preparedArgs)
    await noBearerRetention()
    console.log('PROBE BASE-AGENT-004 6 '+phase+': signed consent withdrawal and seed owner agent withdrawal -> immediate 401 on both MCP routes, fresh and saved-outcome calls refused, restart and 59-second probe remain refused; unrelated consent and native credential stay usable; suspended preparation changes nothing')
  }
  installation.context.agentId=crypto.randomUUID();installation.context.consent=crypto.randomUUID()
  const local=await owner(base+'/agents',{name:'Synthetic independent native agent',businessAgentId:installation.context.agentId,hours:1,actions:['records:read','drafts:prepare'],fields:['compensation'],locations:['*']},201)
  const paired=await installation.token(),unpairArgs=args()
  success(await mcp(paired,'envelope.draft.prepare',unpairArgs))
  const beforeUnpair=await retained(),stops=await sql("SELECT * FROM bs_audit WHERE action='stopped' ORDER BY id")
  const guest='synthetic-envelope-9853'+String.fromCharCode(64)+'example.test'
  installation.recipients.add(guest)
  await owner('/auth/invite',{email:guest,displayName:'Synthetic installation member',role:'member'},202)
  const invite=new URL(installation.mails.at(-1).text.match(/https:\/\/[^\s]+/)[0])
  const invited=await request('/auth/confirm',{token:invite.searchParams.get('token')},'')
  assert.equal(invited.status,303)
  const guestCookie=invited.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
  assert.equal((await request('/auth/settings/business',{},guestCookie)).status,403,'an admitted native member cannot unpair')
  assert.equal((await request('/auth/settings/business',{},'')).status,401)
  assert.equal((await request('/auth/settings/business',{},'',{authorization:'Bearer '+paired})).status,401,'a Business bearer cannot unpair the installation')
  assert.equal((await request('/auth/settings/business',{},cookie,{origin:'https://foreign.example.test'})).status,403)
  assert.deepEqual(await retained(),beforeUnpair)
  assert.deepEqual(await sql("SELECT * FROM bs_audit WHERE action='stopped' ORDER BY id"),stops)
  const stopState=await sql('SELECT * FROM bs_settings')
  const current=await owner('/auth/session')
  const pendingStop=request('/auth/settings/business',{},cookie,{'x-synthetic-policy-batch':'hold-business-stop'})
  try {
    await waitingForBatch()
    assert.equal((await request('/auth/session/revoke',{sessionId:current.id})).status,204)
  } finally { await releaseBatch() }
  assert.equal((await pendingStop).status,503,'a revoked session cannot commit an already admitted unpair')
  assert.deepEqual(await sql('SELECT * FROM bs_settings'),stopState,'failed owner fence rolls back the stop')
  assert.deepEqual(await sql("SELECT * FROM bs_audit WHERE action='stopped' ORDER BY id"),stops,'failed owner fence rolls back its audit')
  assert.equal((await request('/auth/settings/business',{})).status,401)
  await signIn()

  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  try {
    const context=await browser.newContext({ignoreHTTPSErrors:true})
    const page=await context.newPage(),folder=process.env.ENVELOPE_PROOF_DIR??'test-results/envelope'
    await mkdir(folder,{recursive:true})
    const show=async(label)=>{
      await context.clearCookies()
      await context.addCookies([{name:'__Host-operator_session',value:cookie.split('=')[1],url:origin,httpOnly:true,secure:true}])
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000})
        assert.equal((await page.goto(origin+'/auth/settings/identity')).status(),200)
        if(width===1440) {
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
          assert.equal(await page.locator('main').evaluate(node=>[...node.querySelectorAll('p,label,button,a,summary')].every(control=>parseFloat(getComputedStyle(control).fontSize)>=13)),true)
          for(const control of await page.locator('button,a,summary').all()) assert.ok((await control.innerText()).trim(),'native Settings uses visible control labels')
        }
        await page.screenshot({path:join(folder,'business-'+label+'-'+width+'.png'),fullPage:true})
      }
    }
    await show('paired')
    assert.equal(await page.getByRole('button',{name:'Stop taking settings from Business'}).count(),1)
    await suspended(paired,async()=>{
      assert.deepEqual(await owner('/auth/settings/business',{}),{stopped:true})
    })
    const stopped=(await sql("SELECT * FROM bs_audit WHERE action='stopped' ORDER BY id")).filter(row=>!stops.some(prior=>prior.id===row.id))
    assert.equal(stopped.length,1)
    assert.equal(stopped[0].actor,local.sponsorId,'unpair audit names the actual native owner')
    for(const path of ['/mcp','/api/envelope/mcp']) {
      await refused(paired,'envelope.records.list',{companyId:company.id},path)
      await refused(paired,'envelope.draft.prepare',unpairArgs,path)
    }
    const metadata=await (await transport(origin+'/.well-known/oauth-protected-resource/mcp')).json()
    assert.deepEqual(metadata.authorization_servers,[],'unpairing removes the Business issuer from resource metadata')
    const afterStop=await policyEnvelope(installation.context,autonomousPolicy())
    assert.equal((await request('/api/rer/agent-policy',{policy:afterStop.policy})).status,404)
    await installation.pair(request,404)
    assert.deepEqual(await owner('/agents/api/state').then(row=>({paired:row.paired,source:row.policy.source,complete:row.policy.complete})),{paired:false,source:'local',complete:false},'unpairing supplies no automatic local policy')
    const policy=await transport(origin+'/agents/api/policy',{method:'PUT',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({document:autonomousPolicy()})})
    assert.equal(policy.status,200,'only the signed-in owner explicitly configures the local fallback')
    success(await mcp(local.token,'envelope.records.list',{companyId:company.id}))
    await restart()
    await refused(paired,'envelope.draft.prepare',unpairArgs)
    await signIn()
    assert.equal((await request('/app')).status,200,'fresh native sign-in still opens the application after unpairing and restart')
    success(await mcp(local.token,'envelope.records.list',{companyId:company.id},{path:'/api/envelope/mcp'}))
    await show('unpaired')
    assert.equal(await page.getByRole('button',{name:'Stop taking settings from Business'}).count(),0)
    assert.ok((await page.locator('main').innerText()).includes('Business settings are stopped'))
    await noBearerRetention()
  } finally { await browser.close() }
  console.log('PROBE BASE-AGENT-004 7: native owner Settings unpair -> Business calls and old-policy replay refuse, in-flight preparation has no effect; restart retains the stop, a fresh native email-link sign-in succeeds and explicit local policy permits the independent native credential')
  console.log('AGENT-TOKENS passed: both policies and MCP routes, paired admission and refusal boundaries, received consent and seed agent withdrawal, fenced in-flight preparation, native Settings unpair and fresh sign-in; real Business delivery and sibling seed execution remain external proof')
}
