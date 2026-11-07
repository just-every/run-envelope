import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {hashToken} from '../../src/modules/operator-auth/crypto.mjs'
import {signJws,policyEnvelope,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs'
import {answers} from './native.mjs'
import {refused,replayError} from './replay.mjs'

/** Only the two declared paid HTTP edges are replaced. D1 and doors stay real. */
export function replayNetwork() {
  const calls=[]
  const edge={calls,holdReplies:false,replyMode:'accepted',release:null,async fetch(request) {
    const body=await request.json()
    assert.equal(request.method,'POST')
    const model=request.url==='https://api.openai.com/v1/responses'
    assert.equal(request.headers.get('authorization'),'Bearer synthetic-envelope-'+(model?'9850':'9851'))
    if(model) {
      assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false)
      assert.equal(body.text.format.type,'json_schema')
      assert.equal(body.input[0].content[0].type,'input_text')
      calls.push({kind:'analysis',text:body.input[0].content[0].text})
      return Response.json({id:'synthetic-envelope-9852',status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'The employer address needs confirmation.',proposedReply:'The employer address is unchanged.'})}]}]})
    }
    assert.equal(request.url,'https://api.resend.com/emails')
    assert.deepEqual(body.to,[['agency','example.com'].join('@')])
    assert.equal(body.from,['payroll','example.com'].join('@'))
    assert.ok(body.subject);assert.ok(body.text)
    assert.ok(request.headers.get('Idempotency-Key'))
    calls.push({kind:'reply',key:request.headers.get('Idempotency-Key'),text:body.text})
    if(edge.holdReplies) await new Promise(resolve=>{edge.release=resolve})
    if(edge.replyMode==='unknown')return Response.json({name:'application_error',message:'Synthetic uncertain response'},{status:503})
    return Response.json({id:crypto.randomUUID()})
  }}
  return edge
}

/** Continue the persistent replay journey across every other installed writer. */
export async function replayFamilies({origin,cookie,settings,owner,sql,restart,advanceClock,edge,wire:nativeWire}) {
  const company=await owner('/api/envelope/companies',{name:'Synthetic replay families',ein:'00-0009853'},'POST',201)
  const base='/api/envelope/companies/'+company.id
  const location=await owner(base+'/locations',{name:'Replay families workplace',state:'PA'},'POST',201)
  const person=await owner(base+'/people',{name:'Synthetic replay families worker',locationId:location.id},'POST',201)
  await owner(base+'/agents/class-policy',{version:0,...answers})
  for(const id of ['openai','resend']) await owner(base+'/providers',{id,version:0,enabled:true,consent:true,secret:'synthetic-envelope-'+(id==='openai'?'9850':'9851'),...(id==='resend'?{sender:['payroll','example.com'].join('@')}:{})},'POST',201)
  // Disposable signing material enters only this local installation's existing
  // trust and signed-settings lifecycle. No agent tables are written by tests.
  const signing=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
  const kid='synthetic-envelope-replay',keys={[kid]:await crypto.subtle.exportKey('jwk',signing.publicKey)}
  const signer={privateKey:signing.privateKey,kid,issuer:'https://business.example',installationId:'synthetic-envelope-replay-installation'}
  let instant='2026-10-28T12:00:00.000Z',seq=0,revision=0,document
  const clock=async value=>{instant=value;await advanceClock(value)}
  const iat=()=>Math.floor(Date.parse(instant)/1000)
  const other={id:'synthetic-envelope-replay-other',email:['synthetic-envelope-9855','example.com'].join('@'),token:randomBytes(32).toString('base64url')}
  await restart({RER_OWNER_CLAIM_ISSUER:signer.issuer,RER_OWNER_CLAIM_INSTALLATION_ID:signer.installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys),RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer:signer.issuer,audience:origin,subject:signer.installationId,email:settings.OWNER_EMAIL,keys})})
  const roster=await owner('/api/rer/business-settings',{settings:await signJws(signer.privateKey,kid,'rer-business-settings+jwt',{v:1,iss:signer.issuer,aud:origin,sub:signer.installationId,business:'synthetic-envelope-business',owner_id:'synthetic-envelope-owner',email:settings.OWNER_EMAIL,jti:crypto.randomUUID(),iat:iat(),exp:iat()+86400,rev:1,values:{},logo:null,team:[{id:other.id,email:other.email,name:'Synthetic other person',role:'member',invite:1}]})},'POST',503)
  assert.equal(roster.error,'invitation_delivery_failed','local mail remains suppressed; no invitation-delivery claim is made')
  // Signed Business settings issued the actual native invitation and binding.
  // Complete only the operator-auth session fixture seam; payroll and agent
  // powers below are granted exclusively through their normal public doors.
  const otherNative=(await sql(`SELECT id FROM oa_operators WHERE email='${other.email}'`))[0]
  assert.ok(otherNative)
  const otherHash=await hashToken(settings.SESSION_SECRET,'session',other.token),now=Date.parse(instant)
  await sql(`UPDATE oa_operators SET status='active' WHERE id='${otherNative.id}';
    INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) SELECT '${other.id}','${otherHash}',id,version,'native',${now},${now+8*86400000} FROM oa_operators WHERE id='${otherNative.id}';
    INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) SELECT '${other.id}','${otherHash}','${other.id}',id,version,'credentials:mint','/app',${now},${now+600000},${now} FROM oa_operators WHERE id='${otherNative.id}'`)
  await owner(base+'/grants',{operatorId:otherNative.id,version:0,role:'payroll-admin',actions:['records:read','notices:read','notices:write','notices:dispatch'],fields:['tax'],locations:['*']})
  const adopt=async()=>{
    const signed=await policyEnvelope({signer,origin,business:'synthetic-envelope-business',now:instant},document,{revision,seq:++seq})
    await owner('/api/rer/agent-policy',{policy:signed.policy})
  }
  const shared=async value=>{document=value;revision++;await adopt()}
  const wire=async(credential,name,args,options)=>nativeWire({...credential,token:await signJws(signer.privateKey,kid,'at+jwt',{iss:signer.issuer,aud:origin+'/mcp',sub:credential.subject??'synthetic-envelope-owner',email:credential.email??settings.OWNER_EMAIL,act:{sub:credential.businessAgentId,name:'Synthetic family replay agent',specialist:'payroll'},client_id:'synthetic-envelope-client',scope:'records:read drafts:read drafts:prepare notices:process dispatch:execute credentials:restrict credentials:rotate',business:'synthetic-envelope-business',consent:credential.businessAgentId,jti:crypto.randomUUID(),iat:iat(),exp:iat()+300})},name,args,options)
  const otherCookie=cookie.split('=')[0]+'='+other.token
  const issuedOther=await fetch(origin+base+'/agents',{method:'POST',headers:{cookie:otherCookie,origin,'content-type':'application/json'},body:JSON.stringify({name:'Synthetic other agent',businessAgentId:crypto.randomUUID(),hours:24,reviewDate:'2026-11-05',actions:['records:read','dispatch:execute'],fields:['tax'],locations:['*'],providers:['resend']})})
  assert.equal(issuedOther.status,201,await issuedOther.clone().text())
  const foreign={...await issuedOther.json(),subject:other.id,email:other.email}
  const issue=()=>owner(base+'/agents',{name:'Synthetic family replay agent',businessAgentId:crypto.randomUUID(),hours:24,reviewDate:'2026-11-05',actions:['records:read','drafts:read','drafts:prepare','notices:process','dispatch:execute'],fields:['compensation','tax'],locations:['*'],providers:['openai','resend'],models:['gpt-4.1-mini']},'POST',201)
  const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt'])
  const {kty,n,e}=await crypto.subtle.exportKey('jwk',pair.publicKey),publicKey={kty,n,e}
  const decrypt=async result=>new TextDecoder().decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},pair.privateKey,Buffer.from(result.encryptedToken,'base64')))
  const result=answer=>{assert.equal(answer.result?.isError,false,JSON.stringify(answer));assert.ok(answer.result.structuredContent);return answer.result.structuredContent}
  // Independent native state excludes read audit but includes every write and
  // encrypted delivery change, so replay cannot conceal a second effect.
  const effects=async()=>({native:await sql(`SELECT 'analysis' AS kind,id AS id,cipher AS value FROM env_notice_analysis WHERE company_id='${company.id}'
    ; SELECT 'dispatch' AS kind,id,state||COALESCE(provider_receipt,'') FROM env_notice_dispatches WHERE company_id='${company.id}'
    ; SELECT 'run' AS kind,object_id AS id,cipher AS value FROM env_workspace_versions WHERE company_id='${company.id}' AND kind='earnings-run'
    ; SELECT 'presentation' AS kind,token_hash AS id,CAST(run_version AS TEXT) FROM env_review_presentations WHERE company_id='${company.id}'
    ; SELECT 'grant' AS kind,g.id AS id,CAST(g.version AS TEXT)||g.actions||g.fields||g.locations||c.token_hash||CAST(c.secret_expires_at AS TEXT) FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id WHERE g.company_id='${company.id}'
    ; SELECT 'write' AS kind,id,action||target_id FROM env_agent_access WHERE company_id='${company.id}' AND action IN ('bonus.prepared','run.review','notices:process','dispatch:execute','credentials:rotate','access:restrict')`).then(rows=>rows.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id))),network:structuredClone(edge.calls)})
  const approve=async answer=>{
    const handle=answer.result?._meta?.['com.runeditrun/approval'];assert.ok(handle,'held mutations require an actual person decision')
    const path='/agents/api/approvals/'+handle.id,{approval}=await owner(path)
    // Discard the completing person's response. The next MCP request is the
    // first observation of the committed outcome, with another JSON-RPC id.
    const response=await fetch(origin+path+'/approve',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({revision:approval.revision,summary_sha256:approval.summary_sha256})})
    assert.equal(response.status,200);await response.body.cancel()
  }
  const complete=async(credential,name,args,phase,discard=false)=>{
    if(phase==='held'&&!['envelope.bonus.prepare','envelope.runs.review_link'].includes(name)) {
      const before=await effects(),pending=await wire(credential,name,args)
      assert.deepEqual(await effects(),before,'held call cannot write before the person approves')
      await approve(pending)
    } else await wire(credential,name,args,{discard})
    return wire(credential,name,args,{path:'/api/envelope/mcp'})
  }
  const observe=async(credential,name,args)=>{
    const answer=await wire(credential,name,args)
    if(!answer.result?._meta?.['com.runeditrun/approval'])return answer
    await approve(answer)
    return wire(credential,name,args,{requestState:answer.result.requestState})
  }
  const retained=[]
  for(const phase of ['autonomous','held']) {
    await shared(phase==='held'?heldPolicy():autonomousPolicy())
    for(const name of ['envelope.bonus.prepare','envelope.runs.review_link','envelope.notices.process','envelope.notices.reply','envelope.credentials.restrict','envelope.credentials.rotate']) {
      const credential=await issue(),key=crypto.randomUUID()
      let args,changed,notice,run
      if(name==='envelope.bonus.prepare'||name==='envelope.runs.review_link') {
        const bonus={companyId:company.id,personId:person.id,amountCents:17000,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9854',requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
        if(name==='envelope.bonus.prepare') {args=bonus;changed={...args,amountCents:17001}}
        else {run=result(await complete(credential,'envelope.bonus.prepare',bonus,phase));args={companyId:company.id,runId:run.id,idempotency_key:key};changed={...args,runId:crypto.randomUUID()}}
      } else if(name.startsWith('envelope.notices.')) {
        notice=await owner(base+'/notices',{locationId:location.id,reference:'synthetic-envelope-'+crypto.randomUUID(),body:'Please confirm the employer address.'},'POST',201)
        if(name==='envelope.notices.process') {args={companyId:company.id,noticeId:notice.id,idempotency_key:key};changed={...args,noticeId:crypto.randomUUID()}}
        else {
          const reply=await owner(base+'/notices/'+notice.id+'/replies',{to:['agency','example.com'].join('@'),subject:'Employer address',body:'The employer address is unchanged.'},'POST',201)
          const review=await owner(base+'/notice-replies/'+reply.id+'/review')
          await owner(base+'/notice-replies/'+reply.id+'/approve',{version:review.version,digest:review.digest,reviewToken:review.reviewToken})
          args={companyId:company.id,replyId:reply.id,version:review.version,digest:review.digest,background:true,idempotency_key:key};changed={...args,digest:'synthetic-envelope-changed'}
        }
      } else if(name==='envelope.credentials.restrict') {
        args={actions:['records:read','drafts:read'],idempotency_key:key};changed={...args,actions:['records:read']}
      } else {args={publicKey,idempotency_key:key};changed={...args,publicKey:{...publicKey,n:(n[0]==='A'?'B':'A')+n.slice(1)}}}
      const before=await effects()
      const {idempotency_key:unused,...missing}=args
      refused(await wire(credential,name,missing),'idempotency_key_required')
      assert.deepEqual(await effects(),before,'missing key cannot write or contact a provider')
      let answer
      if(name==='envelope.notices.reply')edge.holdReplies=true
      answer=await complete(credential,name,args,phase,true)
      if(name==='envelope.credentials.rotate') {
        const previous=credential.token
        credential.token=await decrypt(result(answer))
        assert.equal((await nativeWire({...credential,token:previous},'envelope.records.list',{companyId:company.id})).httpStatus,401,'lost delivery does not keep the retired local bearer alive')
        assert.equal(result(await nativeWire(credential,'envelope.records.list',{companyId:company.id})).records[0].id,person.id,'the recovered ciphertext decrypts to the current scoped native bearer')
      }
      const saved=result(answer)
      let after=await effects()
      assert.notDeepEqual(after,before,name+' executes one real native effect')
      const writeAction=({'envelope.bonus.prepare':'bonus.prepared','envelope.runs.review_link':'run.review','envelope.notices.process':'notices:process','envelope.notices.reply':'dispatch:execute','envelope.credentials.restrict':'access:restrict','envelope.credentials.rotate':'credentials:rotate'})[name]
      const writes=rows=>rows.filter(row=>row.kind==='write'&&row['action||target_id'].startsWith(writeAction)).length
      assert.equal(writes(after.native),writes(before.native)+1,name+' records exactly one attributed native write')
      const nativeKind=({'envelope.bonus.prepare':'run','envelope.runs.review_link':'presentation','envelope.notices.process':'analysis','envelope.notices.reply':'dispatch'})[name]
      if(nativeKind)assert.equal(after.native.filter(row=>row.kind===nativeKind).length,before.native.filter(row=>row.kind===nativeKind).length+1,name+' retains exactly one native record')
      if(name==='envelope.bonus.prepare') {
        const read=result(await observe(credential,'envelope.bonus.read',{companyId:company.id,runId:saved.id}))
        assert.equal(read.preview.grossCashCents,17000);assert.equal(read.preview.paymentReady,false)
      } else if(name==='envelope.runs.review_link') {
        assert.equal(saved.runId,run.id);assert.match(saved.reviewUrl,/presentation=/);assert.equal(saved.approval,'requires-separate-human-proof')
      } else if(name==='envelope.notices.process') {
        const native=await owner(base+'/notices/'+notice.id)
        assert.equal(native.analyses.length,1);assert.equal(native.analyses[0].id,saved.id);assert.equal(saved.status,'untrusted-proposal')
        assert.equal(after.network.filter(row=>row.kind==='analysis').length,before.network.filter(row=>row.kind==='analysis').length+1)
      } else if(name==='envelope.notices.reply') {
        assert.equal(saved.state,'pending','long work immediately returns a durable handle')
        assert.ok(saved.jobId)
        const status=()=>wire(credential,'envelope.jobs.status',{companyId:company.id,jobId:saved.jobId})
        assert.equal(result(await status()).state,'pending')
        // This person has a genuinely issued, currently admitted company grant
        // with the required dispatch scope. Only ownership of this job differs.
        assert.equal(result(await wire(foreign,'envelope.records.list',{companyId:company.id})).records[0].id,person.id)
        const beforeForeign=await effects()
        for(const jobId of [saved.jobId,crypto.randomUUID()])refused(await wire(foreign,'envelope.jobs.status',{companyId:company.id,jobId}),'job_not_found')
        assert.deepEqual(await effects(),beforeForeign,'another person learns no job state and cannot trigger a send')
        assert.deepEqual(result(await wire(credential,name,args)),saved,'pending duplicate returns the original handle')
        refused(await wire(credential,name,{...args,background:false}),'idempotency_conflict')
        await owner('/agents/api/pause',{paused:true})
        refused(await status(),'agents_paused')
        await owner('/agents/api/pause',{paused:false})
        await clock('2026-10-28T12:00:31.000Z')
        assert.equal(result(await status()).state,'unknown','an interrupted pending ledger cannot claim a known outcome after the provider deadline')
        assert.deepEqual(result(await wire(credential,name,args)),saved,'uncertain status cannot change the first mutation outcome or resend')
        assert.equal(edge.calls.filter(row=>row.kind==='reply').length,before.network.filter(row=>row.kind==='reply').length+1)
        await clock('2026-10-28T12:00:00.000Z')
        assert.ok(edge.release,'one authorized provider call is in progress')
        edge.holdReplies=false;edge.release();edge.release=null
        let completed
        for(let attempt=0;attempt<50;attempt++) {
          completed=result(await status())
          if(completed.state!=='pending')break
          await new Promise(resolve=>setTimeout(resolve,20))
        }
        assert.equal(completed.state,'accepted');assert.ok(completed.providerReceipt)
        const native=await owner(base+'/notices/'+notice.id)
        assert.equal(native.replies[0].dispatchState,'accepted');assert.equal(native.replies[0].providerReceipt,completed.providerReceipt)
        assert.equal(edge.calls.filter(row=>row.kind==='reply').length,before.network.filter(row=>row.kind==='reply').length+1)
        await restart();await clock('2026-10-28T12:00:00.000Z')
        assert.deepEqual(result(await status()),completed,'completed job status survives process restart')
        console.log('PROBE BASE-AGENT-012 5 '+phase+': explicitly approved background MCP reply -> durable pending handle, accepted status and one provider call; another admitted person sees job_not_found for both foreign and absent handles; Pause refuses status; restart retains completion')
        const uncertain=await owner(base+'/notices/'+notice.id+'/replies',{to:['agency','example.com'].join('@'),subject:'Second exact reply',body:'Please retain the confirmed employer address.'},'POST',201)
        const review=await owner(base+'/notice-replies/'+uncertain.id+'/review')
        await owner(base+'/notice-replies/'+uncertain.id+'/approve',{version:review.version,digest:review.digest,reviewToken:review.reviewToken})
        const unknownArgs={...args,replyId:uncertain.id,version:review.version,digest:review.digest,idempotency_key:crypto.randomUUID()}
        edge.replyMode='unknown'
        const unknown=result(await complete(credential,name,unknownArgs,phase,true))
        let unknownStatus
        for(let attempt=0;attempt<50;attempt++) {
          unknownStatus=result(await wire(credential,'envelope.jobs.status',{companyId:company.id,jobId:unknown.jobId}))
          if(unknownStatus.state!=='pending')break
          await new Promise(resolve=>setTimeout(resolve,20))
        }
        assert.equal(unknownStatus.state,'unknown');assert.equal(unknownStatus.providerReceipt,null)
        const calls=edge.calls.length
        await restart();await clock('2026-10-28T12:00:00.000Z')
        assert.deepEqual(result(await wire(credential,name,unknownArgs)),unknown)
        assert.deepEqual(result(await wire(credential,'envelope.jobs.status',{companyId:company.id,jobId:unknown.jobId})),unknownStatus)
        assert.equal(edge.calls.length,calls,'unknown delivery, replay and restart never retry the provider')
        edge.replyMode='accepted'
        after=await effects()
      } else if(name==='envelope.credentials.restrict') {
        const grant=(await owner(base+'/agents')).grants.find(row=>row.id===credential.id)
        assert.equal(grant.version,2);assert.deepEqual(JSON.parse(grant.actions),args.actions)
      }
      assert.deepEqual(result(await wire(credential,name,args)),saved,name+' returns the first completed outcome')
      refused(await wire(credential,name,changed),'idempotency_conflict')
      assert.deepEqual(await effects(),after,name+' repeats neither the native write nor the provider call')
      retained.push({phase,credential,name,args,changed,saved})
      console.log('PROBE BASE-AGENT-012 family '+phase+' '+name+': missing key, lost response, new RPC id, duplicate and changed arguments -> one native effect and equal result, conflict without another effect')
    }
    const entries=retained.filter(row=>row.phase===phase)
    await restart();await clock('2026-10-28T12:00:00.000Z')
    for(const row of entries) assert.deepEqual(result(await wire(row.credential,row.name,row.args)),row.saved,row.name+' survives a Worker restart')
    await clock('2026-10-29T11:59:00.000Z');await adopt()
    for(const row of entries) {
      // Renew native admission explicitly before expiry. A renewed short-lived
      // Business token alone cannot extend the independently retained grant.
      const renewal=await complete(row.credential,'envelope.credentials.rotate',{publicKey,idempotency_key:crypto.randomUUID()},phase)
      row.credential.token=await decrypt(result(renewal))
    }
    const beforeRetention=await effects()
    for(const boundary of ['2026-10-29T11:59:59.999Z','2026-10-29T12:00:00.000Z','2026-10-29T12:00:00.001Z']) {
      await restart();await clock(boundary);await adopt()
      for(const row of entries) {
        assert.deepEqual(result(await wire(row.credential,row.name,row.args,{path:'/api/envelope/mcp'})),row.saved,row.name+' retains its first outcome at '+boundary+' under '+phase)
        refused(await wire(row.credential,row.name,row.changed),'idempotency_conflict')
        assert.deepEqual(await effects(),beforeRetention,row.name+' retention cannot repeat native or provider work')
      }
    }
    console.log('PROBE BASE-AGENT-012 family retention '+phase+': all six non-hourly mutating families at 24 hours minus 1 ms, exactly and plus 1 ms, renewed actual native credentials, signed policy refresh with unchanged revision and persistent restarts -> original results and conflicts, no repeated effects')
    await clock('2026-10-28T12:00:00.000Z')
  }
}
