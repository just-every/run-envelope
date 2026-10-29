import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'

const answers = {standard:'autonomous',money:'autonomous',commitment:'autonomous',external:'autonomous',sensitive:'autonomous',destructive:'autonomous',accounts:'autonomous',access:'autonomous',security:'autonomous',gated:'autonomous'}
// Existing native-agent journeys explicitly configure their company before use.
export async function answerAgentPolicy({origin,cookie,company,worker=globalThis}) {
  const r=await worker.fetch(origin+'/api/envelope/companies/'+company+'/agents/class-policy',{method:'POST',headers:{cookie,origin,'content-type':['application','json'].join('/')},body:JSON.stringify({version:0,...answers})})
  assert.equal(r.status,200,await r.clone().text())
}

/** One authorization sanity journey through native Settings, MCP, REST and CLI. */
export async function agentPolicyJourney({origin,cookie,settings,sql,restart}) {
  let clockNow=Date.parse('2026-10-28T12:00:00Z')
  const contentType=['application','json'].join('/')
  const call=(path,body,who=cookie)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':contentType},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data=async(path,body,status=200,who=cookie)=>{const r=await call(path,body,who);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const company=await data('/api/envelope/companies',{name:'Synthetic policy employer',ein:'00-0009601'},201)
  const foreign=await data('/api/envelope/companies',{name:'Synthetic separate employer',ein:'00-0009602'},201)
  const base='/api/envelope/companies/'+company.id, ui='/app/envelope/companies/'+company.id+'/agents'
  const location=await data(base+'/locations',{name:'Policy workplace',state:'PA'},201)
  const person=await data(base+'/people',{name:'Synthetic policy worker',locationId:location.id},201)
  const rate=await data(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2500,effectiveDate:'2026-01-01',sourceRef:'synthetic-envelope-9603'},201)
  const review=await data(base+'/rates/'+rate.id)
  await data(base+'/rates/'+rate.id+'/approve',{version:review.version,reviewToken:review.reviewToken})
  const ownerHash=await hashToken(settings.SESSION_SECRET,'session',cookie.split('=')[1]), now=clockNow
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
    SELECT 'synthetic-envelope-9604',token_hash,id,operator_id,operator_version,'credentials:mint','/app',${now},${now+600000},${now} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
  await sql(`UPDATE oa_sessions SET expires_at=${clockNow+8*86400000} WHERE token_hash='${ownerHash}'`)
  const issue=()=>data(base+'/agents',{name:'Synthetic policy agent',hours:1,actions:['records:read','drafts:prepare','drafts:read'],locations:['*'],fields:['compensation']},201)
  let credential=await issue()
  const mcp=(name,args={},token=credential.token)=>fetch(origin+'/api/envelope/mcp',{method:'POST',headers:{authorization:'Bearer '+token,origin,'content-type':contentType},body:JSON.stringify({jsonrpc:'2.0',id:9601,method:'tools/call',params:{name,arguments:args}})})
  const tool=async(name,args={},status=200)=>{const r=await mcp(name,args);const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return status===200 ? JSON.parse(body.result.content[0].text) : body.error}
  const rest=(path,body,token=credential.token,method)=>fetch(origin+'/api/envelope/v1/companies/'+company.id+path,{method:method??(body===undefined?'GET':'POST'),headers:{authorization:'Bearer '+token,origin,'content-type':contentType},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const cli=(args,body)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/envelope-cli.mjs',...args],{env:{...process.env,ENVELOPE_ORIGIN:origin,ENVELOPE_TOKEN:credential.token},stdio:['pipe','pipe','pipe']})
    let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));child.stdin.end(body===undefined?undefined:JSON.stringify(body))
  })
  const input={personId:person.id,minutes:480,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9605',requestKey:'synthetic-envelope-9606'}
  const effects=()=>sql(`SELECT (SELECT COUNT(*) FROM env_run_drafts) AS drafts,(SELECT COUNT(*) FROM env_workspace_versions) AS versions,(SELECT COUNT(*) FROM env_review_presentations) AS presentations,(SELECT COUNT(*) FROM env_agent_credentials) AS credentials,(SELECT group_concat(token_hash) FROM env_agent_credentials) AS hashes`)
  let state=(await data(base+'/agents')).classPolicy
  const configure=async(change={})=>{state=await data(base+'/agents/class-policy',{version:state.version,...answers,...change});return state}
  const pause=async(paused)=>{state=await data(base+'/agents/pause',{version:state.version,paused});return state}
  const before=await effects()
  for(const [name,args] of [['records.list',{companyId:company.id}],['draft.prepare',{...input,companyId:company.id}],['credentials.rotate',{}]]) {
    const error=await tool(name,args,403);assert.equal(error.message,'policy_unset');assert.equal(error.data.setupLink,ui+'#class-policy')
  }
  const unsetRest=await rest('/drafts',input);assert.equal(unsetRest.status,403);assert.equal((await unsetRest.json()).setupLink,ui+'#class-policy')
  const unsetCli=await cli(['prepare',company.id],input)
  assert.notEqual(unsetCli.code,0);assert.ok(unsetCli.stderr.includes('policy_unset')&&unsetCli.stderr.includes(origin+ui+'#class-policy'));assert.ok(!unsetCli.stderr.includes(credential.token))
  assert.deepEqual(await effects(),before,'unset policy prevents writes and rotation')
  await data(base+'/agents/class-policy',{version:0,standard:'autonomous'},400)
  await pause(true)
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(proof,{recursive:true})
  try {
    const context=await browser.newContext(),page=await context.newPage(),at=cookie.indexOf('=')
    await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin}])
    const capture=async label=>{for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});await page.goto(origin+ui);await page.evaluate(()=>document.fonts.ready);if(label==='agent-policy-activity')await page.getByText('Human access and security changes',{exact:true}).click();await page.screenshot({path:join(proof,label+'-'+width+'.png'),fullPage:true})}}
    await capture('agent-policy-unset')
    await page.setViewportSize({width:1440,height:1000})
    for(const key of Object.keys(answers)) {
      assert.equal(await page.locator(`select[name="${key}"]`).inputValue(),'','each class starts unanswered')
      await page.locator(`select[name="${key}"]`).selectOption('autonomous')
    }
    await page.getByRole('button',{name:'Save class policy',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForURL(origin+ui+'#class-policy')
    state=(await data(base+'/agents')).classPolicy;assert.deepEqual(state.answers,answers)
    assert.equal(state.paused,true,'saving setup cannot resume paused agents')
    await pause(false)
    const prepared=await tool('draft.prepare',{...input,companyId:company.id})
    assert.equal(prepared.approval,'not-approved');assert.equal(prepared.dispatch,'unavailable')
    const read=await tool('draft.read',{companyId:company.id,draftId:prepared.id});assert.equal(read.minutes,480);assert.equal(read.hourlyCents,2500)
    const cliRead=await cli(['status',company.id,prepared.id]);assert.equal(cliRead.code,0,cliRead.stderr);assert.equal(JSON.parse(cliRead.stdout).id,prepared.id)
    assert.equal((await rest('/drafts/'+prepared.id,undefined,credential.token,'HEAD')).status,200)
    assert.deepEqual((await tool('records.list',{companyId:company.id})).records.map(p=>p.id),[person.id])
    const report=await tool('reports.proposals',{companyId:company.id});assert.equal(report.proposals.length,1);assert.equal(report.proposals[0].id,prepared.id)
    const bonus=await tool('bonus.prepare',{...input,companyId:company.id,minutes:undefined,amountCents:25000,requestKey:'synthetic-envelope-9607'})
    assert.equal(bonus.approval,'requires-separate-human-proof')
    assert.equal((await tool('bonus.read',{companyId:company.id,runId:bonus.id})).preview.grossCashCents,25000)
    assert.equal((await tool('reports.bonuses',{companyId:company.id})).bonuses.length,1)
    assert.equal((await tool('run.review',{companyId:company.id,runId:bonus.id})).approval,'requires-separate-human-proof')
    await configure({money:'blocked'})
    assert.equal((await tool('bonus.prepare',{...input,companyId:company.id,minutes:undefined,amountCents:25000,requestKey:'synthetic-envelope-9607'})).id,bonus.id,'blocking money leaves uncalculated preparation available')
    const old=credential.token;credential={...credential,...await tool('credentials.rotate')}
    assert.equal((await mcp('records.list',{companyId:company.id},old)).status,401)
    assert.equal((await rest('/records')).status,200)
    // All-autonomous never supplies absent scopes or authority over another company.
    const scopedBefore=await effects()
    assert.equal((await mcp('records.list',{companyId:foreign.id})).status,403)
    assert.equal((await fetch(origin+'/api/envelope/v1/companies/'+foreign.id+'/records',{headers:{authorization:'Bearer '+credential.token}})).status,403)
    assert.equal((await fetch(origin+base+'/agents/pause',{method:'POST',headers:{authorization:'Bearer '+credential.token,origin,'content-type':contentType},body:JSON.stringify({version:state.version,paused:false})})).status,403)
    const limited=await data(base+'/agents',{name:'Synthetic read-only agent',hours:1,actions:['records:read'],locations:['*'],fields:[]},201)
    assert.equal((await mcp('draft.prepare',{...input,companyId:company.id},limited.token)).status,403)
    assert.deepEqual((await effects()).map(r=>({...r,credentials:0,hashes:''})),scopedBefore.map(r=>({...r,credentials:0,hashes:''})))
    // A bearer may reduce its own authority, never enlarge it or edit another grant.
    const disposable=await issue(), own=async(args,status=200)=>{
      const r=await mcp('credentials.restrict',args,disposable.token),body=await r.json()
      assert.equal(r.status,status,JSON.stringify(body))
      return status===200?JSON.parse(body.result.content[0].text):body.error
    }
    const unchangedGrant=()=>sql(`SELECT actions,fields,locations,version FROM env_agent_grants WHERE id='${disposable.id}'`)
    const originalGrant=await unchangedGrant()
    assert.equal((await own({actions:['pay:release']},403)).message,'self_escalation')
    assert.deepEqual(await unchangedGrant(),originalGrant,'policy cannot add a payroll power')
    await configure({access:'blocked'})
    assert.equal((await own({actions:['records:read']},403)).message,'policy_blocked')
    assert.deepEqual(await unchangedGrant(),originalGrant,'blocked restriction has no effect')
    await configure()
    const reduced=await own({actions:['records:read'],fields:[],locations:[location.id]})
    assert.equal(reduced.direction,'narrow');assert.equal(reduced.peopleCount,1)
    assert.deepEqual(reduced.actions,['records:read'])
    const repeated=await own({actions:['records:read'],fields:[],locations:[location.id]})
    assert.equal(repeated.direction,'unchanged')
    assert.equal(repeated.version,reduced.version,'replaying the retained scope cannot revoke another current call')
    assert.equal((await mcp('records.list',{companyId:company.id},disposable.token)).status,200)
    assert.equal((await mcp('draft.prepare',{...input,companyId:company.id},disposable.token)).status,403)
    const afterNarrow=await unchangedGrant()
    assert.equal((await own({actions:['records:read','drafts:prepare'],fields:['compensation'],locations:['*']},403)).message,'self_escalation')
    assert.deepEqual(await unchangedGrant(),afterNarrow,'previous powers cannot be restored by the bearer')
    assert.equal((await own({credentialId:credential.id,actions:[]},400)).message,'invalid_agent_scope')
    await data(base+'/agents/'+disposable.id+'/revoke',{version:reduced.version})
    assert.equal((await mcp('records.list',{companyId:company.id},disposable.token)).status,403)
    const accessCalls=(await data(base+'/agents')).activity.calls.filter(c=>c.credentialId===disposable.id&&c.tool==='credentials.restrict')
    assert.ok(accessCalls.some(c=>c.decision==='executed'&&c.classes.join()==='access'&&c.facts.direction==='narrow'&&c.facts.peopleCount===1))
    assert.ok(accessCalls.some(c=>c.decision==='self_escalation'&&c.facts.direction==='widen'))
    // Native provider changes remain owner-only, classed security and secret-free.
    await data(base+'/providers',{id:'openai',version:0,enabled:true,consent:true,secret:'synthetic-envelope-9610'},201)
    await data(base+'/providers',{id:'openai',version:1,enabled:true,consent:true,secret:'synthetic-envelope-9611'},201)
    await data(base+'/providers',{id:'openai',version:2,enabled:false,removeCredential:true},201)
    const secured=(await data(base+'/agents')).activity.changes.filter(c=>c.action==='provider.declared')
    assert.equal(secured.length,3)
    assert.ok(secured.every(c=>c.classes.join()==='security'&&c.actorName))
    assert.ok(!JSON.stringify(secured).includes('synthetic-envelope-9611'),'audit never exposes provider secrets')
    // A company answers its own policy; another company's setup changes nothing here.
    await answerAgentPolicy({origin,cookie,company:foreign.id})
    await configure({standard:'blocked',security:'blocked',money:'blocked',sensitive:'blocked'})
    const blockedBefore=await effects()
    for(const [name,args] of [['records.list',{companyId:company.id}],['draft.read',{companyId:company.id,draftId:prepared.id}],['draft.prepare',{...input,companyId:company.id}],['credentials.rotate',{}],['bonus.prepare',{companyId:company.id}]])assert.equal((await tool(name,args,403)).message,'policy_blocked')
    assert.notEqual((await cli(['prepare',company.id],input)).code,0)
    assert.deepEqual(await effects(),blockedBefore,'blocked reads, proposals and rotation cannot change records or secrets')
    for(const decision of ['review','approval']) {await configure({standard:decision});assert.equal((await tool('draft.prepare',{...input,companyId:company.id},403)).message,'policy_'+decision+'_required');assert.deepEqual(await effects(),blockedBefore)}
    await configure()
    await pause(true);const pausedAt=performance.now()
    await restart()
    assert.equal((await tool('records.list',{companyId:company.id},403)).message,'agents_paused')
    assert.ok(performance.now()-pausedAt<60000,'the first payroll call after durable Pause is stopped within 60 seconds')
    assert.equal((await rest('/drafts',input)).status,403)
    assert.equal((await tool('credentials.rotate',{},403)).message,'agents_paused')
    await capture('agent-policy-paused')
    await pause(false)
    // A partially streamed call was already authenticated when Pause was saved.
    for(const transport of ['mcp','rest']) {
      const beforeRace=await effects(),body=JSON.stringify(transport==='rest'?{...input,requestKey:'synthetic-envelope-race-'+transport}:{jsonrpc:'2.0',id:9602,method:'tools/call',params:{name:'draft.prepare',arguments:{...input,companyId:company.id,requestKey:'synthetic-envelope-race-'+transport}}})
      let controller
      const action=transport==='rest'?'transport.rest.v1':'transport.open'
      const accessBefore=(await data(base+'/agents')).access.filter(a=>a.credentialId===credential.id&&a.action===action).length
      const stream=new ReadableStream({start(c){controller=c;c.enqueue(new TextEncoder().encode(body.slice(0,-1)))}})
      const pending=fetch(origin+(transport==='rest'?'/api/envelope/v1/companies/'+company.id+'/drafts':'/api/envelope/mcp'),{method:'POST',duplex:'half',headers:{authorization:'Bearer '+credential.token,origin,'content-type':contentType},body:stream})
      try {
        let authenticated=false
        for(let n=0;n<50;n++) {const activity=(await data(base+'/agents')).access;if(activity.filter(a=>a.credentialId===credential.id&&a.action===action).length>accessBefore) {authenticated=true;break}await new Promise(r=>setTimeout(r,25))}
        assert.ok(authenticated,'authenticated call is suspended before execution')
        await pause(true)
        if(transport==='rest') await pause(false)
        controller.enqueue(new TextEncoder().encode(body.slice(-1)));controller.close()
        const refused=await pending;assert.equal(refused.status,403,await refused.clone().text())
        assert.deepEqual(await effects(),beforeRace,'Pause fences an already-open call, including a later resume')
      } finally {try{controller.close()}catch{}await pending.catch(()=>{})}
      if(state.paused)await pause(false)
    }
    // Hold the real D1 batch after policy evaluation, then change durable policy.
    for(const [name,args,route] of [
      ['draft.prepare',{...input,companyId:company.id,requestKey:'synthetic-envelope-db-race'},'/api/envelope/mcp'],
      ['records.list',{},'/api/envelope/v1/companies/'+company.id+'/records'],
      ['credentials.rotate',{},'/api/envelope/mcp'],
    ]) {
      const beforeExecution=await effects(),isRest=route.includes('/v1/')
      const pending=fetch(origin+route,{method:isRest?'GET':'POST',headers:{authorization:'Bearer '+credential.token,origin,'content-type':contentType,'x-synthetic-policy-batch':'hold'},
        ...(isRest?{}:{body:JSON.stringify({jsonrpc:'2.0',id:9603,method:'tools/call',params:{name,arguments:args}})})})
      try {
        let waiting=false
        for(let n=0;n<100;n++) {const observed=await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'observe'}});if(observed.headers.get('x-synthetic-policy-state')==='waiting'){waiting=true;break}await new Promise(r=>setTimeout(r,25))}
        assert.ok(waiting,'real database execution is suspended after policy evaluation')
        assert.ok((await data(base+'/agents')).activity.calls.some(c=>c.tool===name&&c.decision==='pending'),'the attempt is durable before execution')
        await pause(true)
        await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}})
        const refused=await pending;assert.equal(refused.status,403,await refused.clone().text())
        assert.deepEqual(await effects(),beforeExecution,'Pause fences a stale read or write after policy was evaluated')
      } finally {await fetch(origin+'/health',{headers:{'x-synthetic-policy-batch':'release'}});await pending.catch(()=>{})}
      await pause(false)
    }
    const beforeRestart=(await data(base+'/agents')).activity
    await restart()
    assert.deepEqual((await data(base+'/agents')).activity,beforeRestart,'restart retains class decisions and audit totals')
    assert.equal((await tool('draft.read',{companyId:company.id,draftId:prepared.id})).id,prepared.id)
    // Revoking a sponsor's native grant invalidates its credential with policy still autonomous.
    const staffId='synthetic-envelope-9608',staffToken=randomBytes(32).toString('base64url'),staffHash=await hashToken(settings.SESSION_SECRET,'session',staffToken),staffSession='synthetic-envelope-9609'
    await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${staffId}','synthetic-envelope-9608'||char(64)||'example.test','Synthetic policy sponsor','member','active',1,1);
      INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('${staffSession}','${staffHash}','${staffId}',1,'native',${clockNow},${clockNow+3600000});
      INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES('${staffSession}','${staffHash}','${staffSession}','${staffId}',1,'credentials:mint','/app',${clockNow},${clockNow+600000},${clockNow})`)
    const staffCookie=cookie.slice(0,cookie.indexOf('=')+1)+staffToken
    await sql("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('synthetic-envelope-9613','synthetic-envelope-9613'||char(64)||'example.test','Synthetic policy colleague','member','inactive',1,1)")
    await data('/auth/operator/status',{operatorId:'synthetic-envelope-9613',status:'active'})
    const grant={operatorId:staffId,version:0,role:'payroll-admin',locations:['*'],fields:[],actions:['records:read']}
    await data(base+'/grants',grant)
    await data(base+'/agents/pause',{version:state.version,paused:true},403,staffCookie)
    await data(base+'/agents/class-policy',{version:state.version,...answers},403,staffCookie)
    const staff=await data(base+'/agents',{name:'Synthetic sponsored policy agent',hours:1,actions:['records:read'],locations:['*'],fields:[]},201,staffCookie)
    assert.equal((await mcp('records.list',{companyId:company.id},staff.token)).status,200)
    const staffView=await data(base+'/agents',undefined,200,staffCookie)
    assert.ok(staffView.activity.calls.every(c=>c.sponsorId===staffId))
    assert.deepEqual(staffView.activity.installation,[],'a company sponsor cannot read installation administration')
    const installation=(await data(base+'/agents')).activity.installation
    assert.ok(installation.some(c=>c.action==='operators.reactivate'&&c.classes.includes('access')&&c.facts.direction==='grant'&&c.facts.peopleCount===1))
    const beforeProviderRefusal=await sql(`SELECT version,secret_cipher FROM env_external_providers WHERE company_id='${company.id}'`)
    await data(base+'/providers',{id:'openai',version:3,enabled:true,consent:true,secret:'synthetic-envelope-9612'},403,staffCookie)
    assert.deepEqual(await sql(`SELECT version,secret_cipher FROM env_external_providers WHERE company_id='${company.id}'`),beforeProviderRefusal)
    await data(base+'/grants',{...grant,version:1,actions:[]})
    const revokedBefore=await effects();assert.equal((await mcp('records.list',{companyId:company.id},staff.token)).status,403);assert.deepEqual(await effects(),revokedBefore)
    // Firm accountants use the same native grants, including widening and narrowing.
    await data(base+'/grants',{...grant,version:2,role:'accountant',fields:['compensation'],actions:['records:read','rates:propose']})
    await data(base+'/grants',{...grant,version:3,role:'accountant',fields:['compensation'],actions:['records:read','rates:propose','audit:read']})
    await data(base+'/grants',{...grant,version:4,role:'accountant',fields:[],actions:['records:read']})
    await data(base+'/grants',{...grant,version:5,revoke:true})
    const native=(await data(base+'/agents')).activity.changes
    const grantChanges=native.filter(c=>c.targetId===staffId)
    for(const direction of ['grant','widen','narrow','revoke'])assert.ok(grantChanges.some(c=>c.classes.join()==='access'&&c.facts.direction===direction&&c.facts.peopleCount===1))
    assert.ok(native.some(c=>c.targetId===disposable.id&&c.action==='agent.issued'&&c.classes.includes('access')&&c.classes.includes('security')&&c.facts.direction==='grant'))
    assert.ok(native.some(c=>c.targetId===disposable.id&&c.action==='agent.revoked'&&c.facts.direction==='revoke'))
    assert.deepEqual((await data('/api/envelope/companies/'+foreign.id+'/agents')).activity.changes.filter(c=>['grant.changed','provider.declared','agent.issued'].includes(c.action)),[],'native class facts stay in their company')
    // Company role labels confer no extra powers: compare the retained scopes.
    const colleagueId='synthetic-envelope-9613'
    const roleGrant={operatorId:colleagueId,role:'payroll-admin',locations:['*'],fields:['compensation'],actions:['records:read','rates:propose']}
    await data(base+'/grants',{...roleGrant,version:0})
    const narrowedRole={...roleGrant,role:'viewer',locations:[location.id],fields:[],actions:['records:read']}
    await data(base+'/grants',{...narrowedRole,version:1})
    await data(base+'/grants',{...narrowedRole,role:'accountant',version:2})
    await data(base+'/grants',{...roleGrant,role:'preparer',version:3})
    await data(base+'/grants',{...roleGrant,role:'viewer',actions:['records:read','audit:read'],version:4})
    const roleChanges=(await data(base+'/agents')).activity.changes.filter(c=>c.targetId===colleagueId)
    for(const [version,direction] of [[2,'narrow'],[3,'unchanged'],[4,'widen'],[5,'widen-and-narrow']]) {
      const event=(await sql(`SELECT id FROM env_audit WHERE company_id='${company.id}' AND target_id='${colleagueId}' AND version=${version}`))[0]
      const change=roleChanges.find(c=>c.id===event.id)
      assert.equal(change?.facts.direction,direction,'company role transition version '+version)
      assert.equal(change?.facts.peopleCount,1)
    }
    // Seed the rest of one fixed UTC week through real calls, with real D1 time
    // supplied by the test-only clock rather than the machine's civil date.
    const expectedDays=['2026-10-28']
    for(let day=1;day<7;day++) {
      const instant=new Date(Date.parse('2026-10-28T12:00:00Z')+day*86400000).toISOString()
      clockNow=Date.parse(instant);expectedDays.push(instant.slice(0,10))
      assert.equal((await fetch(origin+'/health',{headers:{'x-synthetic-clock':instant}})).status,200)
      const dailyProofHash=await hashToken(settings.SESSION_SECRET,'link','synthetic-envelope-policy-day-'+day)
      await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
        SELECT 'synthetic-envelope-policy-day-${day}','${dailyProofHash}',id,operator_id,operator_version,'credentials:mint','/app',${clockNow},${clockNow+600000},${clockNow} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
      const daily=await issue()
      await configure({standard:day%2?'blocked':'autonomous'})
      assert.equal((await mcp('records.list',{companyId:company.id},daily.token)).status,day%2?403:200)
      const dayRows=await data(base+'/agents?from='+instant.slice(0,10)+'&through='+instant.slice(0,10))
      assert.equal(dayRows.activity.calls.length,1)
      assert.deepEqual(dayRows.activity.counts,[{class:'standard',decision:day%2?'policy_blocked':'executed',count:1}])
    }
    const history=await data(base+'/agents'),totals={}
    assert.deepEqual([...new Set(history.activity.calls.map(c=>new Date(c.occurredAt).toISOString().slice(0,10)))].sort(),expectedDays,'the selected week includes actual calls on all seven dates')
    for(const row of history.activity.calls) {
      assert.ok(row.agentName&&row.sponsorName&&row.credentialId&&row.sponsorId)
      for(const kind of row.classes)totals[kind+':'+row.decision]=(totals[kind+':'+row.decision]??0)+1
    }
    assert.deepEqual(Object.fromEntries(history.activity.counts.map(r=>[r.class+':'+r.decision,r.count])),totals)
    const nativeTotals=await sql(`SELECT c.value AS class,a.decision,COUNT(*) AS count FROM env_agent_call_audit a,json_each(a.classes) c WHERE a.company_id='${company.id}' GROUP BY c.value,a.decision ORDER BY c.value,a.decision`)
    assert.deepEqual(history.activity.counts,nativeTotals,'public totals equal the durable attributed audit')
    assert.ok(history.activity.calls.some(c=>c.classes.includes('security')&&c.decision==='executed'))
    assert.ok(history.activity.calls.some(c=>c.decision==='policy_unset')&&history.activity.calls.some(c=>c.decision==='agents_paused'))
    await capture('agent-policy-activity')
    await page.setViewportSize({width:1440,height:1000});await page.goto(origin+ui)
    for(const [key,total] of Object.entries(totals))assert.ok((await page.locator(`[data-agent-count="${key}"]`).innerText()).endsWith(': '+total))
    await page.getByText('Human access and security changes',{exact:true}).click()
    const humanChanges=await page.locator('details').filter({has:page.getByText('Human access and security changes',{exact:true})}).innerText()
    assert.ok(humanChanges.includes('grant.changed · access · widen · 1 person'))
    assert.ok(humanChanges.includes('grant.changed · access · narrow · 1 person'))
    assert.ok(humanChanges.includes('provider.declared · security'))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'settings fit the desktop')
    for(const control of await page.locator('button,a,summary').all())if(await control.isVisible())assert.ok((await control.innerText()).trim(),'touched controls have visible labels')
    assert.ok(await page.locator('#class-policy').evaluate(n=>[...n.querySelectorAll('p,label,button,select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=13)))
    // Installation role direction uses the role before the guarded mutation.
    const roleDirection=async(role,direction)=>{
      const beforeIds=new Set((await data(base+'/agents')).activity.installation.map(c=>c.id))
      await data('/auth/operator/role',{operatorId:colleagueId,role})
      const entry=(await data(base+'/agents')).activity.installation.find(c=>c.action==='operators.role'&&!beforeIds.has(c.id))
      assert.equal(entry?.facts.direction,direction,'installation promotion or demotion to '+role)
      assert.equal(entry?.facts.peopleCount,1)
    }
    await roleDirection('admin','widen')
    await roleDirection('member','narrow')
    await roleDirection('owner','widen')
    await roleDirection('admin','narrow')
    await roleDirection('owner','widen')
    const nativeSignIn=async operatorId=>{
      const operator=(await sql(`SELECT version FROM oa_operators WHERE id='${operatorId}'`))[0]
      const token=randomBytes(32).toString('base64url'),hash=await hashToken(settings.SESSION_SECRET,'link',token)
      await sql(`INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at)
        VALUES('${randomBytes(12).toString('hex')}','${hash}','magic','${operatorId}',${operator.version},'/app',${clockNow},${clockNow+600000})`)
      const signed=await call('/auth/confirm',{token},'')
      assert.equal(signed.status,303,await signed.clone().text())
      return signed.headers.get('set-cookie').split(';')[0]
    }
    const otherOwner=await nativeSignIn(colleagueId),otherHash=await hashToken(settings.SESSION_SECRET,'session',otherOwner.split('=')[1])
    await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
      SELECT 'synthetic-envelope-9614',token_hash,id,operator_id,operator_version,'credentials:mint','/app',${clockNow},${clockNow+600000},${clockNow} FROM oa_sessions WHERE token_hash='${otherHash}'`)
    const originalOwner=(await sql('SELECT claim_id AS id FROM oa_bootstrap'))[0].id
    const beforeDemotion=await effects()
    await data('/auth/operator/role',{operatorId:originalOwner,role:'member'},200,otherOwner)
    assert.equal((await call(base+'/agents')).status,401,'demotion invalidates the old native session')
    const demotedCookie=await nativeSignIn(originalOwner)
    const demotedView=await data(base+'/agents',undefined,200,demotedCookie)
    assert.equal((await sql(`SELECT role FROM env_grants WHERE company_id='${company.id}' AND operator_id='${originalOwner}'`))[0].role,'owner','company access remains independent of installation ownership')
    assert.deepEqual(demotedView.activity.installation,[],'a demoted bootstrap owner with company access cannot read installation administration')
    await context.clearCookies()
    await context.addCookies([{name:demotedCookie.split('=')[0],value:demotedCookie.split('=')[1],url:origin}])
    await page.goto(origin+ui)
    await page.getByText('Human access and security changes',{exact:true}).click()
    assert.ok(!(await page.locator('main').innerText()).includes('installation operators.'),'the rendered Agents page also withholds installation history')
    assert.deepEqual(await effects(),beforeDemotion,'audit reads after demotion change no payroll or agent records')
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      await page.screenshot({path:join(proof,'agent-policy-demoted-owner-'+width+'.png'),fullPage:true})
    }

  } finally {await browser.close()}
  console.log('AGENT-POLICY passed: explicit unanswered company classes; MCP, REST and CLI refusal and allowed preparation; security rotation; current scope and sponsor; durable Pause, suspended calls and resume fencing; attributed audit and exact public totals over seven fixed UTC dates; 1440 and 390 settings proof')
}
