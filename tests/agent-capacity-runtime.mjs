import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {autonomousPolicy,heldPolicy,accessToken,policyEnvelope,signJws} from '../src/modules/agent-door/conformance/crypto.mjs'
import {answers} from './agent-door/native.mjs'

/** Real issued credentials, emitted Worker, persistent D1 and public transports. */
export async function agentCapacityJourney({origin,cookie,settings,sql,restart,advanceClock,edge,request}) {
  const owner=async(path,body,method=body===undefined?'GET':'POST',status=200)=>{
    const response=await request(origin+path,{method,redirect:'manual',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(response.status,status,path+' '+await response.clone().text())
    return response.json()
  }
  const auth=async(path,body,status,session=cookie)=>{
    const response=await request(origin+path,{method:'POST',redirect:'manual',headers:{cookie:session,origin,'cf-connecting-ip':'192.0.2.64','content-type':'application/json'},body:JSON.stringify(body)})
    assert.equal(response.status,status,path+' '+await response.clone().text())
    return response
  }
  const confirm=async()=>{
    const message=edge.mails.at(-1)
    assert.deepEqual(message.to,[settings.OWNER_EMAIL],'the proof goes only to the native owner')
    const link=new URL(message.text.match(/https:\/\/[^\s]+/)[0])
    assert.equal(link.origin,origin)
    assert.equal(link.pathname,'/auth/confirm')
    const response=await auth(link.pathname,{token:link.searchParams.get('token')},303)
    assert.equal((await auth(link.pathname,{token:link.searchParams.get('token')},400)).headers.has('set-cookie'),false,'a consumed human proof cannot be replayed')
    return response
  }
  const signIn=async()=>{
    const sent=edge.mails.length
    await auth('/auth/magic-link',{email:settings.OWNER_EMAIL,returnTo:'/app'},202,'')
    assert.equal(edge.mails.length,sent+1)
    const response=await confirm()
    cookie=response.headers.get('set-cookie').split(';')[0]
    assert.ok(cookie.startsWith('__Host-operator_session='),'capacity fixtures use a genuine native sign-in session')
    assert.equal((await request(origin+'/app',{redirect:'manual',headers:{cookie}})).status,200)
  }
  await signIn()
  const company=await owner('/api/envelope/companies',{name:'Synthetic capacity employer',ein:'00-0009851'},'POST',201),base='/api/envelope/companies/'+company.id
  const location=await owner(base+'/locations',{name:'Synthetic capacity workplace',state:'PA'},'POST',201)
  const person=await owner(base+'/people',{name:'Synthetic capacity worker',locationId:location.id},'POST',201)
  const rate=await owner(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2500,effectiveDate:'2026-01-01',sourceRef:'synthetic-envelope-9852'},'POST',201)
  const review=await owner(base+'/rates/'+rate.id)
  await owner(base+'/rates/'+rate.id+'/approve',{version:review.version,reviewToken:review.reviewToken})
  await owner(base+'/agents/class-policy',{version:0,...answers})
  const issue=(businessAgentId)=>owner(base+'/agents',{businessAgentId,name:'Synthetic capacity agent',hours:24,actions:['records:read','drafts:read','drafts:prepare'],fields:['compensation'],locations:['*']},'POST',201)
  let sequence=0
  const wire=async(credential,path,name,args={},method='tools/call')=>{
    const id=++sequence,response=await request(origin+path,{method:'POST',headers:{origin,...(credential?{authorization:'Bearer '+credential.token}:{}),'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(method==='tools/call'?{'Mcp-Name':name}:{})},body:JSON.stringify({jsonrpc:'2.0',id,method,params:{...(method==='tools/call'?{name,arguments:args}:{}),_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})})
    const body=await response.json()
    assert.equal(body.id,id,'capacity errors retain the parsed request id')
    return {response,body}
  }
  const rest=async(credential,body,method=body===undefined?'GET':'POST')=>{
    const response=await request(origin+'/api/envelope/v1/companies/'+company.id+(body===undefined?'/records':'/drafts'),{method,headers:{origin,authorization:'Bearer '+credential.token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
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
  const capture=async(label,paused)=>{
    const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
    const folder=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope'
    await mkdir(folder,{recursive:true})
    try {
      const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage(),split=cookie.indexOf('=')
      await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin}])
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000})
        assert.equal((await page.goto(origin+'/agents')).status(),200)
        await page.evaluate(()=>document.fonts.ready)
        if(width===1440) {
          assert.equal((await page.locator('[data-agents-state]').innerText()).includes('paused'),paused)
          assert.equal(await page.getByRole('button',{name:'Pause agents',exact:true}).count(),1,'the person control stays available during Business Pause')
        }
        await page.screenshot({path:join(folder,label+'-'+width+'.png'),fullPage:false})
      }
    } finally {await browser.close()}
  }
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
    if(phase==='held')await signIn()
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
    await signIn()
    for(const route of routes)limited(route==='rest'?await rest(credential):await wire(credential,route,'envelope.records.list',{companyId:company.id}))
    assert.deepEqual(await business(),admitted,'fresh human authentication does not replenish an existing agent budget')
    console.log('PROBE BASE-AGENT-011 1 '+phase+': fresh native mail-link sign-in after restart -> owner access restored with no seeded proof; exhausted agent still receives HTTP 429 on both MCP routes and v1 REST')
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
    await owner(base+'/agents/'+racing.id+'/revoke',{version:1})
    const revokedAtCapacity=await business()
    for(const route of routes) {
      const denied=route==='rest'?await rest(racing):await wire(racing,route,'envelope.records.list',{companyId:company.id})
      assert.equal(denied.response.status,route==='rest'?403:401,'revoked authority takes precedence over an exhausted budget')
      assert.equal(denied.response.headers.get('retry-after'),null)
    }
    assert.deepEqual(await business(),revokedAtCapacity,'exhausted and revoked credentials cannot expose data or change business state')
    console.log('PROBE BASE-AGENT-011 1 '+phase+': simultaneous calls through both MCP routes and v1 REST with one slot left -> exactly one admitted and two HTTP 429, unchanged business state')
    // Neither the company control nor installation Pause can be resumed by a
    // bearer. A current human session remains usable throughout either pause.
    for(const control of ['company','installation']) {
      const toggle=async paused=>control==='installation'
        ?owner('/agents/api/pause',{paused})
        :owner(base+'/agents/pause',{version:(await owner(base+'/agents')).classPolicy.version,paused})
      await toggle(true)
      const paused=await business(),started=performance.now()
      await restart()
      await advanceClock('2026-10-28T12:01:00.000Z')
      for(const token of [credential,independent])for(const route of routes) {
        const denied=route==='rest'?await rest(token):await wire(token,route,'envelope.records.list',{companyId:company.id})
        assert.equal(denied.body.error??denied.body.result?._meta?.['com.runeditrun/error']?.code,'agents_paused',JSON.stringify(denied.body))
      }
      assert.ok(performance.now()-started<60000,'Pause survives restart and stops the next calls within 60 seconds')
      for(const path of ['/agents/api/pause',base+'/agents/pause']) {
        const denied=await request(origin+path,{method:'POST',headers:{origin,authorization:'Bearer '+independent.token,'content-type':'application/json'},body:JSON.stringify({paused:false,version:(await owner(base+'/agents')).classPolicy.version})})
        assert.equal(denied.status,403,'an agent token cannot resume '+control+' Pause')
      }
      assert.deepEqual(await business(),paused,'paused reads and agent resume attempts preserve business state')
      await toggle(false)
      for(const route of routes)await read(independent,route)
      assert.deepEqual(await business(),paused,'a human resume restores reads without replaying refused effects')
      console.log('PROBE BASE-AGENT-011 6,7 '+phase+': '+control+' Pause and Worker restart -> both native credentials refused through both MCP routes and v1 REST within 60 seconds; bearer resume 403, owner still reads; human resume restores access')
    }
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

  // A daily business rule consumes reviewed outside-recipient facts, separately
  // from the installation's minute capacity. No external account is contacted.
  await advanceClock('2026-10-28T12:02:00.000Z')
  await owner(base+'/providers',{id:'resend',version:0,enabled:true,consent:true,secret:'synthetic-envelope-9860',sender:['capacity','example.test'].join(String.fromCharCode(64))},'POST',201)
  const dispatcher=await owner(base+'/agents',{name:'Synthetic recipient-limited agent',hours:24,actions:['records:read','dispatch:execute'],fields:['tax'],locations:['*'],providers:['resend']},'POST',201)
  const notice=await owner(base+'/notices',{locationId:location.id,reference:'synthetic-envelope-9861',body:'Confirm the employer address with the exact reviewed recipient.'},'POST',201)
  const prepareReply=async n=>{
    const reply=await owner(base+'/notices/'+notice.id+'/replies',{to:['synthetic-envelope-'+n,'example.test'].join(String.fromCharCode(64)),subject:'Synthetic employer address',body:'The reviewed employer address is unchanged.'},'POST',201)
    const review=await owner(base+'/notice-replies/'+reply.id+'/review')
    await owner(base+'/notice-replies/'+reply.id+'/approve',{version:review.version,digest:review.digest,reviewToken:review.reviewToken})
    return {companyId:company.id,replyId:reply.id,version:review.version,digest:review.digest,idempotency_key:crypto.randomUUID()}
  }
  const errorOf=value=>value.body.result?._meta?.['com.runeditrun/error']?.code??value.body.error?.data?.code??value.body.error
  const daily=autonomousPolicy()
  daily.rules.push({id:'outside-default',class:'external',do:'blocked'},{id:'three-recipients',class:'external',seed:'envelope',agent:dispatcher.id,max_per_day:3,do:'autonomous'})
  await owner('/agents/api/policy',{document:daily},'PUT')
  const outgoing=[]
  for(let n=1;n<=4;n++)outgoing.push(await prepareReply(9861+n))
  const dispatches=()=>sql(`SELECT id,state,provider_receipt FROM env_notice_dispatches WHERE company_id='${company.id}' ORDER BY id`)
  for(let i=0;i<3;i++) {
    const result=await wire(dispatcher,routes[i%2],'envelope.notices.reply',outgoing[i])
    assert.equal(result.response.status,200)
    assert.equal(result.body.result.structuredContent.state,'accepted',JSON.stringify(result.body))
    assert.equal(edge.calls.length,i+1,'each explicitly invoked and exactly human-approved message has one provider-edge receipt')
    assert.equal(edge.calls[i].body.to[0],['synthetic-envelope-'+(9862+i),'example.test'].join(String.fromCharCode(64)))
  }
  const sent=await dispatches()
  assert.equal(sent.length,3);assert.ok(sent.every(row=>row.state==='accepted'&&row.provider_receipt))
  await restart();await advanceClock('2026-10-28T12:02:00.000Z')
  for(const route of routes.slice(0,2)) {
    const fourth=await wire(dispatcher,route,'envelope.notices.reply',outgoing[3])
    assert.equal(errorOf(fourth),'policy_blocked',JSON.stringify(fourth.body))
    assert.ok(fourth.body.result._meta['com.runeditrun/decision'].classes.some(row=>row.class==='external'&&row.rule==='outside-default'&&row.do==='blocked'))
    assert.equal(edge.calls.length,3,'past the daily cap no provider request occurs')
    assert.deepEqual(await dispatches(),sent,'fourth outside recipient has no partial dispatch effect')
  }
  await read(dispatcher,'/mcp')
  assert.equal(edge.calls.length,3,'a no-cost read is unaffected by an outside-recipient cap')
  const recipientUsage=await sql(`SELECT classes FROM agent_door_usage WHERE agent='${dispatcher.id}'`)
  assert.equal(recipientUsage.flatMap(row=>JSON.parse(row.classes)).filter(row=>row.class==='external').reduce((sum,row)=>sum+row.facts.measure,0),3)
  const visible=[]
  let after='0'
  for(let page=0;page<20;page++) {
    const usageView=await owner('/agents/api/audit?agent='+dispatcher.id+'&class=external&after='+after)
    visible.push(...usageView.rows)
    assert.equal(usageView.differs_from_policy,0,'the person sees the actual calls and class decisions for this agent')
    if(usageView.cursor===after)break
    after=usageView.cursor
  }
  assert.equal(visible.filter(row=>row.outcome==='done').length,3)
  assert.equal(visible.filter(row=>row.code==='policy_blocked').length,2)
  assert.ok(visible.every(row=>row.agent.id===dispatcher.id&&row.classes.some(item=>item.class==='external'&&item.facts.measure===1)))
  console.log('PROBE BASE-AGENT-011 2: seed and agent daily cap of three outside recipients, four distinct exact-human-approved messages -> three accepted Resend-schema receipts; fourth blocked on both MCP routes after restart with no dispatch or outbound request; free read still works')

  // Exercise the actual installed Business trust receiver with disposable
  // signing material and a genuinely issued, explicitly bound native grant.
  await advanceClock('2026-10-28T12:03:00.000Z')
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
  const signer={privateKey:pair.privateKey,kid:'synthetic-envelope-9870',issuer:'https://auth.example.com',installationId:'synthetic-envelope-9871'}
  const keys={[signer.kid]:await crypto.subtle.exportKey('jwk',pair.publicKey)}
  const trust={v:1,issuer:signer.issuer,audience:origin,subject:signer.installationId,keys}
  await restart({RER_BUSINESS_TRUST:JSON.stringify(trust),RER_OWNER_CLAIM_ISSUER:signer.issuer,RER_OWNER_CLAIM_INSTALLATION_ID:signer.installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys)})
  await advanceClock('2026-10-28T12:03:00.000Z')
  const businessId='synthetic-envelope-9872',subject='synthetic-envelope-9873',issuedAt=Date.parse('2026-10-28T12:03:00Z')/1000
  const signedSettings=await signJws(pair.privateKey,signer.kid,'rer-business-settings+jwt',{v:1,iss:signer.issuer,aud:origin,sub:signer.installationId,business:businessId,email:settings.OWNER_EMAIL,owner_id:subject,jti:crypto.randomUUID(),iat:issuedAt,exp:issuedAt+3600,rev:1,values:{},logo:null,team:null})
  const applied=await request(origin+'/api/rer/business-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({settings:signedSettings})})
  assert.equal(applied.status,200,await applied.clone().text())
  let context={signer,origin,business:businessId,person:{sub:subject,email:settings.OWNER_EMAIL},consent:'synthetic-envelope-9874',surface:{specialist:'payroll',tools:[{scope:'records:read'},{scope:'drafts:prepare'},{scope:'drafts:read'}]},seq:0,revision:0,now:()=>Date.parse('2026-10-28T12:03:00Z')}
  const adopt=async(paused=false,document=autonomousPolicy())=>{
    const envelope=await policyEnvelope(context,document,{paused})
    const response=await request(origin+'/api/rer/agent-policy',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({policy:envelope.policy})})
    assert.equal(response.status,200,await response.clone().text())
    context={...context,seq:envelope.payload.seq,revision:envelope.payload.revision}
    return envelope
  }
  await adopt()
  const boundId='synthetic-envelope-9875',native=await issue(boundId),otherId='synthetic-envelope-9876'
  await issue(otherId)
  const paired={token:await accessToken({...context,agentId:boundId})},other={token:await accessToken({...context,agentId:otherId})}
  for(const route of routes.slice(0,2))await read(paired,route)
  const discovered=await wire(null,'/mcp',null,{},'server/discover'),capacity=discovered.body.result._meta['com.runeditrun/limits'].requestsPerMinute
  for(let slot=2;slot<capacity-1;slot++)await read(paired,routes[slot%2])
  const before=await business(),args={companyId:company.id,personId:person.id,minutes:60,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9877',requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
  const last=await wire(paired,'/api/envelope/mcp','envelope.draft.prepare',args)
  assert.equal(last.response.status,200,JSON.stringify(last.body));assert.ok(last.body.result.structuredContent.id)
  const admitted=await business();assert.equal(admitted.drafts.length,before.drafts.length+1)
  for(const route of routes.slice(0,2)) {
    const refused=await wire(paired,route,'envelope.draft.prepare',{...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()})
    assert.equal(refused.response.status,429,JSON.stringify(refused.body));assert.equal(refused.response.headers.get('retry-after'),'60');assert.equal(errorOf(refused),'rate_limited')
    assert.deepEqual(await business(),admitted)
  }
  await restart();await advanceClock('2026-10-28T12:03:00.000Z')
  assert.equal((await wire(paired,'/mcp','envelope.records.list',{companyId:company.id})).response.status,429)
  for(const route of routes.slice(0,2))await read(other,route)
  for(const route of routes)await read(native,route)
  await advanceClock('2026-10-28T12:03:59.999Z')
  assert.equal((await wire(paired,'/mcp','envelope.records.list',{companyId:company.id})).response.headers.get('retry-after'),'1')
  await advanceClock('2026-10-28T12:04:00.000Z')
  for(const route of routes.slice(0,2))await read(paired,route)
  console.log('PROBE BASE-AGENT-011 1 paired: signed Business credentials bound by native owner grant -> final advertised slot prepares once; both MCP overruns 429, restart retains exhaustion, independent signed and native credentials still read, last millisecond waits one second and next minute resumes')

  for(const control of ['business','installation','company']) {
    const toggle=async paused=>control==='business'?adopt(paused):control==='installation'?owner('/agents/api/pause',{paused}):owner(base+'/agents/pause',{version:(await owner(base+'/agents')).classPolicy.version,paused})
    const old=control==='business'?await adopt():null
    await toggle(true)
    const before=await business(),started=performance.now()
    await restart();await advanceClock('2026-10-28T12:04:00.000Z')
    for(const credential of [paired,other,native])for(const route of credential===native?routes:routes.slice(0,2)) {
      const paused=route==='rest'?await rest(credential):await wire(credential,route,'envelope.draft.prepare',{...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()})
      assert.equal(errorOf(paused),'agents_paused',JSON.stringify(paused.body))
    }
    assert.ok(performance.now()-started<60000,'paired Pause stops next calls within 60 seconds')
    for(const credential of [paired,other,native])for(const path of ['/agents/api/pause',base+'/agents/pause']) {
      const response=await request(origin+path,{method:'POST',headers:{origin,authorization:'Bearer '+credential.token,'content-type':'application/json'},body:JSON.stringify({paused:false,version:1})})
      assert.equal(response.status,403,'native or Business bearer never resumes a person control')
    }
    if(old) {
      const stale=await request(origin+'/api/rer/agent-policy',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({policy:old.policy})})
      assert.equal(stale.status,409,'replaying the pre-Pause signed envelope cannot resume agents')
      assert.equal((await owner('/agents/api/state')).paused.business,true)
      await capture('agents-business-paused',true)
    }
    assert.deepEqual(await business(),before,'paused calls and agent resume refusals change no native business state')
    await toggle(false)
    for(const route of routes.slice(0,2))await read(paired,route)
    for(const route of routes)await read(native,route)
    assert.deepEqual(await business(),before,'current human resume restores each supported token and transport')
    console.log('PROBE BASE-AGENT-011 6,7 paired '+control+': durable Pause -> native and both signed Business tokens refused on supported transports within 60 seconds, owner reads continue, bearer resumes 403; human resume restores reads without replaying refused preparation')
  }
  const capped=autonomousPolicy();capped.spend={caps:[{seed:'envelope',specialist:'payroll',microusd_per_day:0}]}
  await adopt(false,capped)
  assert.equal((await owner('/agents/api/state')).policy.spend_caps,'not_enforced')
  await read(paired,'/mcp')
  await capture('agents-business-resumed',false)
  console.log('PROBE BASE-AGENT-011 3,4,5: pinned Base public policy state after signed zero spend cap -> spend_caps=not_enforced; zero-cost native read works; provider-cost registration, spend reservation and complete usage need a Base change and remain unproved')

  const nextDay=Date.parse('2026-10-29T00:00:00Z')
  await advanceClock('2026-10-29T00:00:00.000Z')
  context={...context,now:()=>nextDay}
  await adopt(false,daily)
  assert.equal(edge.calls.length,3,'a day boundary never automatically sends a previously refused message')
  const proofMails=edge.mails.length
  await auth('/auth/step-up',{action:'credentials:mint',returnTo:'/app'},202)
  assert.equal(edge.mails.length,proofMails+1)
  const proof=await confirm()
  assert.equal(proof.headers.has('set-cookie'),false,'next-day step-up retains the current human session')
  const tomorrow=await prepareReply(9866)
  const fresh=await wire(dispatcher,'/mcp','envelope.notices.reply',tomorrow)
  assert.equal(fresh.body.result?.structuredContent?.state,'accepted',JSON.stringify(fresh.body))
  assert.equal(edge.calls.length,4)
  assert.equal((await dispatches()).length,4,'the next UTC day admits a newly reviewed explicit send')
  const today=await sql(`SELECT classes FROM agent_door_usage WHERE agent='${dispatcher.id}' AND at>=${nextDay}`)
  assert.equal(today.flatMap(row=>JSON.parse(row.classes)).filter(row=>row.class==='external').reduce((sum,row)=>sum+row.facts.measure,0),1)
  console.log('PROBE BASE-AGENT-011 2: controlled next UTC day and real same-session mail step-up -> no automatic dispatch; a newly exact-human-approved explicit send receives one Resend-schema receipt and consumes one new-day recipient')
}
