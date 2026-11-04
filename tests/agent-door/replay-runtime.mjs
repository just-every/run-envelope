import assert from 'node:assert/strict'
import {hashToken} from '../../src/modules/operator-auth/crypto.mjs'
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs'
import {answers} from './native.mjs'
import {prepared,refused,replayError} from './replay.mjs'

/** Persistent emitted-Worker sanity journey; all agent state changes use doors. */
export async function replayJourney({origin,cookie,settings,sql,restart,advanceClock}) {
  const owner=async(path,body,method=body===undefined?'GET':'POST',status=200)=>{
    const response=await fetch(origin+path,{method,redirect:'manual',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(response.status,status,path+' '+await response.clone().text())
    return response.json()
  }
  // The shared runtime's bootstrap person has no recent email proof. Use its
  // existing operator-auth fixture seam, never write any agent-door state.
  const ownerHash=await hashToken(settings.SESSION_SECRET,'session',cookie.split('=')[1]),now=Date.parse('2026-10-28T12:00:00Z')
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
    SELECT 'synthetic-envelope-replay-proof',token_hash,id,operator_id,operator_version,'credentials:mint','/app',${now},${now+600000},${now} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
  const company=await owner('/api/envelope/companies',{name:'Synthetic replay employer',ein:'00-0009841'},'POST',201),base='/api/envelope/companies/'+company.id
  const location=await owner(base+'/locations',{name:'Synthetic replay workplace',state:'PA'},'POST',201)
  const person=await owner(base+'/people',{name:'Synthetic replay worker',locationId:location.id},'POST',201)
  const rate=await owner(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2500,effectiveDate:'2026-01-01',sourceRef:'synthetic-envelope-9842'},'POST',201)
  const rateReview=await owner(base+'/rates/'+rate.id)
  await owner(base+'/rates/'+rate.id+'/approve',{version:rateReview.version,reviewToken:rateReview.reviewToken})
  let nativePolicy=await owner(base+'/agents/class-policy',{version:0,...answers}),seq=1000,currentRate=rate
  const shared=async document=>owner('/agents/api/policy',{document},'PUT')
  const issue=()=>owner(base+'/agents',{name:'Synthetic replay agent',hours:24,actions:['records:read','drafts:read','drafts:prepare'],fields:['compensation'],locations:['*']},'POST',201)
  const wire=async(credential,name,args,{path='/mcp',discard=false}={})=>{
    const id=++seq,response=await fetch(origin+path,{method:'POST',headers:{origin,authorization:'Bearer '+credential.token,'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name},body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})})
    if(discard) {assert.equal(response.status,200);await response.body.cancel();return {id}}
    const answer=await response.json();assert.equal(answer.id,id,'each retry uses its own JSON-RPC id')
    return {...answer,httpStatus:response.status}
  }
  const business=async()=>({drafts:await owner(base+'/drafts'),preparations:(await owner(base+'/agents')).access.filter(row=>row.action==='drafts:prepare')})
  const audit=async(credential,key)=>{
    const rows=[];let after='0'
    for(let page=0;page<10;page++) {
      const value=await owner('/agents/api/audit?after='+after+'&agent='+credential.id)
      rows.push(...value.rows.filter(row=>row.idempotency_key===key));if(value.cursor===after)break;after=value.cursor
    }
    return rows
  }
  const refusal=async(credential,args,code,options)=>{
    const before=await business(),prior=new Set((await audit(credential,args.idempotency_key)).map(row=>row.id))
    const answer=await wire(credential,'envelope.draft.prepare',args,options);refused(answer,code)
    assert.deepEqual(await business(),before,'refused replay leaves retained business state unchanged')
    const row=(await audit(credential,args.idempotency_key)).findLast(row=>!prior.has(row.id))
    assert.ok(row,'each admitted refused replay has its own audit')
    assert.equal(row.agent.id,credential.id);assert.equal(row.sponsor.id,credential.sponsorId)
    assert.equal(row.tool,'envelope.draft.prepare');assert.equal(row.outcome,'refused');assert.equal(row.code,code)
    assert.ok(Number.isFinite(Date.parse(row.at)))
    if(answer.result?._meta?.['com.runeditrun/decision']) {
      const decision=answer.result._meta['com.runeditrun/decision']
      assert.equal(row.revision,decision.revision);assert.equal(row.decision,decision.disposition)
    }
    return answer
  }
  for(const phase of ['autonomous','held']) {
    await shared(phase==='autonomous'?autonomousPolicy():heldPolicy())
    const credential=await issue(),key=crypto.randomUUID(),args={companyId:company.id,personId:person.id,minutes:480,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9843',requestKey:crypto.randomUUID(),idempotency_key:key}
    const before=await business(),answer=await wire(credential,'envelope.draft.prepare',args),result=prepared(answer)
    assert.equal(answer.result._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous')
    const after=await business(),draft=after.drafts.find(row=>row.id===result.id)
    assert.equal(after.drafts.length,before.drafts.length+1);assert.equal(after.preparations.length,before.preparations.length+1)
    assert.equal(draft.minutes,480);assert.equal(draft.personId,person.id);assert.equal(draft.rateId,currentRate.id)
    assert.equal(after.preparations.find(row=>row.targetId===result.id).credentialId,credential.id)
    assert.deepEqual(prepared(await wire(credential,'envelope.draft.prepare',args)),result)
    assert.deepEqual(await business(),after,'ordinary duplicate produces exactly one native preparation')
    // Let the server finish, but discard the response stream without reading it.
    const lost={...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
    const lostId=(await wire(credential,'envelope.draft.prepare',lost,{discard:true})).id
    const retained=await business(),lostDraft=retained.drafts.find(row=>!after.drafts.some(previous=>previous.id===row.id))
    assert.ok(lostDraft,'the dropped response followed a committed native effect')
    assert.equal(retained.drafts.length,after.drafts.length+1);assert.equal(retained.preparations.length,after.preparations.length+1)
    const recovered=await wire(credential,'envelope.draft.prepare',lost,{path:'/api/envelope/mcp'})
    assert.notEqual(recovered.id,lostId);assert.equal(prepared(recovered).id,lostDraft.id)
    assert.deepEqual(prepared(await wire(credential,'envelope.draft.prepare',lost)),prepared(recovered))
    assert.deepEqual(await business(),retained,'lost-response recovery has no second effect')
    await restart()
    assert.deepEqual(prepared(await wire(credential,'envelope.draft.prepare',args,{path:'/api/envelope/mcp'})),result)
    assert.deepEqual(prepared(await wire(credential,'envelope.draft.prepare',lost)),prepared(recovered))
    assert.deepEqual(await business(),retained,'process restart retains both first outcomes')
    await refusal(credential,{...args,minutes:481},'idempotency_conflict')
    const state=await owner(base+'/agents'),nativeGrant=state.grants.find(row=>row.id===credential.id),previousPerson=await owner(base+'/people/'+person.id)
    const previousRevision=JSON.stringify([previousPerson.version,nativeGrant.version,state.classPolicy.version])
    currentRate=await owner(base+'/people/'+person.id+'/rates',{version:previousPerson.version,hourlyCents:2600,effectiveDate:phase==='autonomous'?'2026-09-01':'2026-09-02'},'POST',201)
    const changedReview=await owner(base+'/rates/'+currentRate.id)
    await owner(base+'/rates/'+currentRate.id+'/approve',{version:changedReview.version,reviewToken:changedReview.reviewToken})
    const stale={...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID(),expected_revision:previousRevision}
    const conflict=await refusal(credential,stale,'revision_conflict'),currentPerson=await owner(base+'/people/'+person.id)
    assert.equal(currentPerson.version,previousPerson.version+1,'an actual reviewed source change made the saved revision stale')
    const revision=JSON.stringify([currentPerson.version,nativeGrant.version,state.classPolicy.version])
    assert.equal(replayError(conflict).current_revision,revision,'stale reply names the independently retained current revision')
    const fresh=prepared(await wire(credential,'envelope.draft.prepare',{...stale,expected_revision:revision}))
    assert.notEqual(fresh.id,result.id,'the advertised current revision admits a new preparation')
    assert.equal((await owner(base+'/drafts')).find(row=>row.id===fresh.id).rateId,currentRate.id,'fresh revision binds the newly reviewed rate')
    console.log('PROBE BASE-AGENT-012 1-4 '+phase+': MCP duplicate, dropped stream, new ids, alias, restart, changed arguments and stale revision -> equal retained outcomes, one effect per key, typed conflicts and current revision')
    // Current policy gates run even when this exact key already succeeded.
    await owner('/agents/api/pause',{paused:true})
    await refusal(credential,args,'agents_paused')
    await restart();await refusal(credential,args,'agents_paused')
    await owner('/agents/api/pause',{paused:false})
    nativePolicy=await owner(base+'/agents/pause',{version:nativePolicy.version,paused:true})
    await refusal(credential,args,'agents_paused')
    nativePolicy=await owner(base+'/agents/pause',{version:nativePolicy.version,paused:false})
    await shared({...autonomousPolicy(),rules:[{id:'blocked',class:'*',do:'blocked'}]})
    await refusal(credential,args,'policy_blocked')
    await shared({...autonomousPolicy(),rules:[{id:'approval',class:'*',do:'approval',approver:['sponsor'],wait:'PT1H'}]})
    await refusal(credential,args,'approval_required')
    await shared(autonomousPolicy())
    nativePolicy=await owner(base+'/agents/class-policy',{version:nativePolicy.version,...answers,standard:'blocked'})
    await refusal(credential,args,'policy_blocked')
    nativePolicy=await owner(base+'/agents/class-policy',{version:nativePolicy.version,...answers,standard:'approval'})
    await refusal(credential,args,'policy_approval_required')
    nativePolicy=await owner(base+'/agents/class-policy',{version:nativePolicy.version,...answers})
    assert.deepEqual(prepared(await wire(credential,'envelope.draft.prepare',args)),result,'resumption restores the first result')
    const restrictionArgs={actions:['records:read','drafts:read'],idempotency_key:crypto.randomUUID()},restriction=await wire(credential,'envelope.credentials.restrict',restrictionArgs)
    assert.equal(restriction.result?.isError,false,JSON.stringify(replayError(restriction)))
    assert.deepEqual(restriction.result.structuredContent.actions,['records:read','drafts:read'])
    const restrictedGrant=(await owner(base+'/agents')).grants.find(row=>row.id===credential.id)
    assert.deepEqual((await wire(credential,'envelope.credentials.restrict',restrictionArgs)).result.structuredContent,restriction.result.structuredContent,'a real scope reduction replays its first outcome')
    refused(await wire(credential,'envelope.credentials.restrict',{...restrictionArgs,actions:['records:read']}),'idempotency_conflict')
    assert.deepEqual((await owner(base+'/agents')).grants.find(row=>row.id===credential.id),restrictedGrant,'replayed or conflicting restriction cannot alter the retained scope version')
    const restrictionRevision=JSON.stringify([restrictedGrant.version,restrictedGrant.version,nativePolicy.version])
    const staleRestriction=await wire(credential,'envelope.credentials.restrict',{actions:['records:read'],idempotency_key:crypto.randomUUID(),expected_revision:JSON.stringify([restrictedGrant.version-1,restrictedGrant.version-1,nativePolicy.version])})
    refused(staleRestriction,'revision_conflict')
    assert.equal(replayError(staleRestriction).current_revision,restrictionRevision,'stale restriction identifies the actual current grant revision')
    assert.deepEqual((await owner(base+'/agents')).grants.find(row=>row.id===credential.id),restrictedGrant,'stale scope revision cannot narrow the credential')
    await refusal(credential,args,'insufficient_scope')
    const read=await wire(credential,'envelope.draft.read',{companyId:company.id,draftId:result.id})
    assert.equal(read.result.structuredContent.id,result.id,'retained read authority still reads its preparation')
    console.log('PROBE BASE-AGENT-012 current-authority '+phase+': saved key under Pause, blocked policy, fresh approval and removed scope -> refused without cached content or business effects; agent and sponsor attributed in audit')
    // A separately admitted credential is revoked through each real owner door.
    const revoked=await issue(),revokedArgs={...args,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
    prepared(await wire(revoked,'envelope.draft.prepare',revokedArgs))
    await owner('/agents/api/agents/'+revoked.id+'/revoke',{})
    await refusal(revoked,revokedArgs,'unauthenticated')
    await owner(base+'/agents/'+revoked.id+'/revoke',{version:1})
    const revocationBefore=await business()
    const unauthorized=await wire(revoked,'envelope.draft.prepare',revokedArgs)
    assert.equal(unauthorized.httpStatus,401);assert.equal(unauthorized.result?.structuredContent,undefined)
    await restart()
    assert.equal((await wire(revoked,'envelope.draft.prepare',revokedArgs)).httpStatus,401)
    assert.deepEqual(await business(),revocationBefore,'revocation and restart cannot recover cached preparation data or write')
    console.log('PROBE BASE-AGENT-012 revocation '+phase+': saved key after shared and native grant revocation and restart -> unauthenticated, no saved content, unchanged preparations')
  }

  // Check the retention edge with the existing injected clock, retaining D1
  // across real process restarts. Rotate an expiring bearer independently;
  // neither rotation nor passage of time changes its saved-call namespace.
  const retained=[]
  for(const phase of ['autonomous','held']) {
    await shared(phase==='autonomous'?autonomousPolicy():heldPolicy())
    const credential=await owner(base+'/agents',{name:'Synthetic retention agent',hours:24,reviewDate:'2026-11-05',actions:['records:read','drafts:read','drafts:prepare'],fields:['compensation'],locations:['*']},'POST',201)
    const args={companyId:company.id,personId:person.id,minutes:480,periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourceRef:'synthetic-envelope-9844',requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
    retained.push({phase,credential,args,result:prepared(await wire(credential,'envelope.draft.prepare',args))})
  }
  const beforeRetention=await business()
  await advanceClock('2026-10-29T11:59:00.000Z')
  await shared(autonomousPolicy())
  const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt'])
  const {kty,n,e}=await crypto.subtle.exportKey('jwk',pair.publicKey)
  for(const saved of retained) {
    const previous=saved.credential.token,response=await wire(saved.credential,'envelope.credentials.rotate',{publicKey:{kty,n,e},idempotency_key:crypto.randomUUID()})
    assert.equal(response.result?.isError,false,JSON.stringify(replayError(response)))
    const value=response.result.structuredContent
    saved.credential.token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},pair.privateKey,Buffer.from(value.encryptedToken,'base64')))
    assert.equal((await wire({...saved.credential,token:previous},'envelope.draft.prepare',saved.args)).httpStatus,401,'the retired bearer cannot recover an old outcome')
  }
  for(const boundary of ['2026-10-29T11:59:59.999Z','2026-10-29T12:00:00.000Z','2026-10-29T12:00:00.001Z']) {
    await advanceClock(boundary)
    await restart()
    await advanceClock(boundary)
    for(const saved of retained) {
      await shared(saved.phase==='autonomous'?autonomousPolicy():heldPolicy())
      assert.deepEqual(prepared(await wire(saved.credential,'envelope.draft.prepare',saved.args,{path:'/api/envelope/mcp'})),saved.result,'the 24-hour retention edge preserves the first outcome under '+saved.phase)
      assert.deepEqual(await business(),beforeRetention,'retention and restart cannot repeat native preparation')
      await refusal(saved.credential,{...saved.args,minutes:481},'idempotency_conflict')
    }
  }
  console.log('PROBE BASE-AGENT-012 retention: persistent MCP at 24 hours minus 1 ms, exactly 24 hours and plus 1 ms, rotated credentials and Worker restarts -> equal first outcomes and changed-argument conflicts under both policies, no repeated preparation')
}
