import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {schemaErrors} from '../../src/modules/agent-door/conformance/schema.mjs'
import {client,state} from './native.mjs'
import {contractFixtures} from './fixtures.mjs'

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const paths=['/mcp','/api/envelope/mcp']
const toolsCall=['tools','call'].join('/'),toolsList=['tools','list'].join('/')
const names=['envelope.workspace.snapshot','envelope.bonus.read','envelope.reports.bonuses','envelope.draft.read','envelope.reports.proposals']
const decision=answer=>answer.result?._meta?.['com.runeditrun/decision']
const valid=(schema,value)=>assert.deepEqual(schemaErrors(schema,value),[],'the runtime result satisfies discovery')
const nativeValues=preview=>({...preview,people:preview.people.map(({details,...person})=>person),holds:preview.holds.map(({reason,...hold})=>hold)})

/** Missing, mistyped or expanded compensation must be rejected by discovery. */
function contractRejects(schema,value) {
  const visit=(rule,item,path=[])=>{
    if(item===null||typeof item!=='object')return
    if(rule.oneOf)rule=rule.oneOf.find(branch=>schemaErrors(branch,item).length===0)
    if(Array.isArray(item)) {
      for(let i=0;i<item.length;i++)visit(rule.items,item[i],[...path,i])
      return
    }
    const at=root=>path.reduce((row,key)=>row[key],root)
    for(const key of Object.keys(item)) {
      const removed=structuredClone(value);delete at(removed)[key]
      assert.ok(schemaErrors(schema,removed).length,'discovery rejects a missing native field '+[...path,key].join('.'))
      const mistyped=structuredClone(value)
      at(mistyped)[key]=item[key]===null?{}:typeof item[key]==='string'?17:'synthetic-envelope-wrong-type'
      assert.ok(schemaErrors(schema,mistyped).length,'discovery rejects a mistyped native field '+[...path,key].join('.'))
      visit(rule.properties[key],item[key],[...path,key])
    }
    const expanded=structuredClone(value);at(expanded).bankNumber='synthetic-envelope-private'
    assert.ok(schemaErrors(schema,expanded).length,'discovery rejects an undeclared private field at '+path.join('.'))
  }
  visit(schema,value)
  for(const [field,claim] of Object.entries({status:'approved',approval:'approved',dispatch:'sent',payroll:'calculated',payment:'settled',filing:'filed',delivered:'confirmed',algorithm:'plaintext'})) {
    if(Object.hasOwn(value,field))assert.ok(schemaErrors(schema,{...value,[field]:claim}).length,
      'discovery rejects an unsupported completion claim for '+field)
  }
}

const installedSchemas=new Map()
/** Retain discovery before a credential changes; neither door may expand it. */
export async function discoverToolContracts(context) {
  if(context.step.id!=='credentials-restrict'||!['autonomous','held'].includes(context.phase))return
  const {origin,request,phase}=context,listed=[]
  for(const path of paths) {
    const response=await request(origin+path,{method:'POST',headers:{origin,authorization:'Bearer '+state.get(origin).localToken,
      'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':toolsList},
      body:JSON.stringify({jsonrpc:'2.0',id:9200,method:toolsList,params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})})
    assert.equal(response.status,200)
    listed.push((await response.json()).result.tools)
  }
  assert.deepEqual(listed[0],listed[1],'all installed tool contracts agree at both MCP paths')
  installedSchemas.set(origin+':'+phase,new Map(listed[0].map(row=>[row.name,row])))
}

/** Extend the existing seeded journey, rather than adding isolated pin tests. */
export async function installedToolContracts(context) {
  const {origin,phase,step,args,result,database,outputs,request}=context
  if(!['autonomous','held'].includes(phase))return
  const declared=installedSchemas.get(origin+':'+phase)?.get(step.tool)
  assert.ok(declared,'a runtime call must have a discovered contract')
  valid(declared.outputSchema,result);contractRejects(declared.outputSchema,result)
  const readOnly=['envelope.records.list','envelope.draft.read','envelope.bonus.read','envelope.reports.proposals','envelope.reports.bonuses','envelope.workspace.snapshot'].includes(step.tool)
  assert.deepEqual(declared.annotations,{readOnlyHint:readOnly,destructiveHint:false,
    openWorldHint:['envelope.notices.process','envelope.notices.reply'].includes(step.tool)})
  const saved=state.get(origin),db=await database('DB'),owner=client(context)
  const one=async(sql,...values)=>db.prepare(sql).bind(...values).first()
  const all=async(sql,...values)=>(await db.prepare(sql).bind(...values).all()).results
  const grant=await one('SELECT g.*,c.secret_expires_at FROM env_agent_grants g JOIN env_agent_credentials c ON c.id=g.id WHERE g.id=?',saved.grantId)
  const proposalState={status:'uncalculated-proposal',approval:'not-approved',dispatch:'unavailable'}
  const proposals=()=>all(`SELECT d.id,d.person_id AS personId,d.person_version AS personVersion,d.rate_id AS rateId,d.minutes,
    d.period_start AS periodStart,d.period_end AS periodEnd,d.pay_date AS payDate,(p.version!=d.person_version) AS stale
    FROM env_run_drafts d JOIN env_people p ON p.company_id=d.company_id AND p.id=d.person_id
    WHERE d.company_id=? AND d.credential_id=? ORDER BY d.id`,saved.company.id,saved.grantId)
  if(step.id==='credentials-restrict') {
    assert.deepEqual(result,{id:saved.grantId,version:grant.version,direction:'unchanged',peopleCount:1,
      actions:['records:read','drafts:prepare','drafts:read','notices:process','dispatch:execute'],fields:['compensation','tax'],locations:['*']})
    for(const field of ['actions','fields','locations'])assert.deepEqual(result[field],JSON.parse(grant[field]))
  } else if(step.id==='records-list') {
    const records=await all('SELECT id,name,location_id AS locationId,version FROM env_people WHERE company_id=? ORDER BY id',saved.company.id)
    assert.deepEqual(records,[{id:saved.person.id,name:'Morgan Rivera',locationId:saved.location.id,version:2}])
    assert.deepEqual(result,{records,limit:100,next:null})
  } else if(step.id==='draft') {
    const row=await one('SELECT id,person_id,minutes,source_ref FROM env_run_drafts WHERE company_id=? AND credential_id=? AND request_key=?',args.companyId,saved.grantId,args.requestKey)
    assert.deepEqual(row,{id:result.id,person_id:saved.person.id,minutes:480,source_ref:'native-conformance'})
    assert.deepEqual(result,{id:row.id,...proposalState})
  } else if(step.id==='draft-read') {
    const row=(await proposals()).find(row=>row.id===args.draftId)
    const rate=await one('SELECT hourly_cents FROM env_rate_proposals WHERE company_id=? AND id=?',args.companyId,row.rateId)
    assert.equal(rate.hourly_cents,2500);assert.equal(row.minutes,480);assert.equal(row.personId,saved.person.id)
    assert.deepEqual(result,{...row,personName:'Morgan Rivera',hourlyCents:2500,sourceRef:'native-conformance',...proposalState})
  } else if(step.id==='reports-proposals') {
    const rows=await proposals();assert.ok(rows.length>0,'the report must inspect retained preparations')
    assert.ok(rows.some(row=>row.id===outputs.draft.id&&row.minutes===480&&row.personId===saved.person.id))
    assert.deepEqual(result,{kind:'run-input-proposals',proposals:rows,limit:100,next:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
  } else if(step.id==='bonus') {
    const id=digest(['bonus',args.companyId,saved.grantId,args.requestKey])
    assert.deepEqual(result,{id,version:1,status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'})
    const row=(await owner(saved.base+'/pay-settings')).runs.find(row=>row.id===id)
    assert.equal(row.data.grossCashCents,50000);assert.equal(row.data.people[0].id,saved.person.id)
    assert.equal(row.data.taxAmounts,null);assert.equal(row.data.netPay,null);assert.equal(row.data.paymentReady,false)
    assert.ok(schemaErrors(declared.outputSchema,{...result,version:2}).length,'an immutable bonus cannot claim a later preparation version')
  } else if(step.id==='run-review') {
    const link=new URL(result.reviewUrl),token=link.searchParams.get('presentation')
    assert.equal(link.origin,origin)
    assert.equal(link.pathname,'/app/envelope/companies/'+args.companyId+'/pay-settings/earnings-run/'+args.runId+'/review')
    assert.deepEqual([...link.searchParams.keys()],['presentation'])
    const reference=await one('SELECT run_id,run_version,credential_id FROM env_review_presentations WHERE token_hash=?',createHash('sha256').update(token).digest('hex'))
    assert.deepEqual(reference,{run_id:outputs.bonus.id,run_version:1,credential_id:saved.grantId})
    assert.deepEqual(result,{runId:reference.run_id,version:1,reviewUrl:link.href,approval:'requires-separate-human-proof'})
  } else if(step.id==='notice-process') {
    const notice=await owner(saved.base+'/notices/'+args.noticeId)
    const retained=notice.analyses.find(row=>row.id===result.id);assert.ok(retained)
    assert.deepEqual(retained,{id:result.id,summary:'The notice requests an address confirmation.',proposedReply:'The address is unchanged.',sourceReference:'notice:'+args.noticeId+':'+notice.digest})
    assert.deepEqual(result,{...retained,noticeId:args.noticeId,status:'untrusted-proposal',approval:'not-approved'})
  } else if(step.id==='reply-dispatch') {
    const retained=await one('SELECT state,provider_receipt AS providerReceipt FROM env_notice_dispatches WHERE company_id=? AND reply_id=? AND version=?',args.companyId,args.replyId,args.version)
    assert.equal(retained.state,'accepted');assert.match(retained.providerReceipt,/^[a-f0-9-]{36}$/)
    assert.deepEqual(result,{id:args.replyId,version:args.version,...retained,delivered:'unconfirmed'})
    assert.ok(schemaErrors(declared.outputSchema,{...result,providerReceipt:null}).length,'acceptance requires the retained provider receipt')
    assert.ok(schemaErrors(declared.outputSchema,{...result,state:'unknown'}).length,'uncertainty cannot claim an accepted provider receipt')
    // A new shared call reaches native replay; its receipt never proves delivery.
    const replayGrant=await owner(saved.base+'/agents',{name:'Synthetic result-contract replay',hours:1,
      actions:['dispatch:execute'],fields:['tax'],locations:['*'],providers:['resend']},201)
    const retry={...args,idempotency_key:crypto.randomUUID()}
    const invoke=async requestState=>{
      const response=await request(origin+paths[1],{method:'POST',headers:{origin,authorization:'Bearer '+replayGrant.token,
        'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':toolsCall,'Mcp-Name':step.tool},
        body:JSON.stringify({jsonrpc:'2.0',id:9300,method:toolsCall,params:{name:step.tool,arguments:retry,...(requestState?{requestState}:{}),
          _meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}}}}})})
      assert.equal(response.status,200)
      return response.json()
    }
    let answer=await invoke()
    if(phase==='held') {
      assert.equal(answer.result.resultType,'input_required');assert.equal(answer.result.structuredContent,undefined)
      const handle=answer.result._meta['com.runeditrun/approval'],{approval}=await owner('/agents/api/approvals/'+handle.id)
      await owner('/agents/api/approvals/'+handle.id+'/approve',{revision:approval.revision,summary_sha256:approval.summary_sha256})
      answer=await invoke(answer.result.requestState)
    }
    assert.equal(answer.result.isError,false)
    assert.deepEqual(answer.result.structuredContent,{id:args.replyId,version:args.version,...retained,replayed:true})
    valid(declared.outputSchema,answer.result.structuredContent);contractRejects(declared.outputSchema,answer.result.structuredContent)
    assert.equal((await one('SELECT COUNT(*) AS n FROM env_notice_dispatches WHERE company_id=? AND reply_id=?',args.companyId,args.replyId)).n,1)
  } else if(step.id==='credentials-rotate') {
    assert.equal(result.id,saved.grantId);assert.equal(result.expiresAt,grant.expires_at)
    assert.equal(result.secretExpiresAt,grant.secret_expires_at);assert.equal(result.algorithm,'RSA-OAEP-256')
    assert.equal(Buffer.from(result.encryptedToken,'base64').length,256)
    assert.equal(Object.hasOwn(result,'token'),false)
  }
  console.log('PROBE BASE-AGENT-002 installed '+phase+' '+step.tool+': runtime result -> closed discovery schema, missing and mistyped fields refused, truthful annotations and native references')
}

/** One native sanity journey, under both policies, through both MCP paths. */
export async function toolContracts(context) {
  if(context.step.id!=='workspace-snapshot'||!['autonomous','held'].includes(context.phase))return
  const fixture=contractFixtures.get(context.origin+':'+context.phase)
  assert.ok(fixture,'the policy phase has independently seeded native records')
  const {origin,request,phase,database}=context,{base,company,person,unrelated,name,privateValue,grant,inputs,rate,hourlyInputs,bonusPeople,boundaryInputs}=fixture
  const owner=client(context),db=await database('DB')
  let seq=9900
  const wire=async(path,method,params={})=>{
    const id=++seq,response=await request(origin+path,{method:'POST',headers:{origin,authorization:'Bearer '+grant.token,
      'content-type':['application','json'].join('/'),'MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(params.name?{'Mcp-Name':params.name}:{})},
      body:JSON.stringify({jsonrpc:'2.0',id,method,params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28',
        'io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}}}}})})
    assert.equal(response.status,200,'contract call completes over '+path)
    const answer=await response.json();assert.equal(answer.id,id)
    return answer
  }
  const retained=async()=>({runs:(await owner(base+'/pay-settings')).runs,
    grants:(await owner(base+'/agents')).grants})
  const nativeBefore=await retained()
  const call=async(path,tool,args,measure=1)=>{
    const before=(await retained()).runs
    let answer=await wire(path,toolsCall,{name:tool,arguments:args})
    const sensitive=!['envelope.workspace.snapshot','envelope.bonus.prepare','envelope.draft.prepare'].includes(tool)
    const facts=decision(answer)
    assert.equal(facts.disposition,phase==='autonomous'?'autonomous':sensitive?'approval':'review')
    assert.deepEqual(facts.classes.map(({class:kind,facts})=>({class:kind,facts})),[
      {class:sensitive?'sensitive':'standard',facts:sensitive?{measure,kind:'compensation'}:{measure:1}}])
    if(phase==='held'&&sensitive) {
      assert.equal(answer.result.resultType,'input_required')
      assert.equal(answer.result.structuredContent,undefined,'pending reads withhold compensation')
      assert.deepEqual((await retained()).runs,before,'a pending read changes no native run')
      const handle=answer.result._meta['com.runeditrun/approval']
      const {approval}=await owner('/agents/api/approvals/'+handle.id)
      assert.equal(approval.tool,tool);assert.equal(approval.state,'pending')
      const approved=await owner('/agents/api/approvals/'+handle.id+'/approve',{revision:approval.revision,summary_sha256:approval.summary_sha256})
      assert.equal(approved.approval.state,'executed')
      answer=await wire(path,toolsCall,{name:tool,arguments:args,requestState:answer.result.requestState})
    }
    assert.equal(answer.result?.isError,false,'a supported native result is served')
    assert.notEqual(answer.result.resultType,'input_required')
    const result=answer.result.structuredContent
    assert.ok(result)
    assert.equal(JSON.stringify(answer).includes(privateValue),false,'no private bank value is returned')
    assert.equal(JSON.stringify(result).includes(grant.token),false,'no native bearer is returned')
    return result
  }
  const discoveries=[]
  for(const path of paths) {
    const listed=await wire(path,toolsList)
    const selected=names.map(tool=>{
      const row=listed.result.tools.find(row=>row.name===tool);assert.ok(row)
      assert.deepEqual(row.annotations,{readOnlyHint:true,destructiveHint:false,openWorldHint:false})
      assert.equal(row._meta['com.runeditrun/scope'],tool==='envelope.workspace.snapshot'?'records:read':'drafts:read')
      assert.deepEqual(row._meta['com.runeditrun/classes'],[tool==='envelope.workspace.snapshot'?'standard':'sensitive'])
      return row
    })
    discoveries.push(selected)
  }
  assert.deepEqual(discoveries[0],discoveries[1],'both doors advertise the same native contracts')
  const schemas=new Map(discoveries[0].map(row=>[row.name,row.outputSchema]))
  const snapshots=[]
  for(const path of paths) {
    const snapshot=await call(path,names[0],{});valid(schemas.get(names[0]),snapshot)
    assert.deepEqual(Object.keys(snapshot).sort(),['bonuses','drafts','people','sha256'])
    assert.deepEqual([snapshot.people,snapshot.drafts,snapshot.bonuses],[3,0,0])
    assert.match(snapshot.sha256,/^[a-f0-9]{64}$/);snapshots.push(snapshot)
    const empty=await call(path,names[2],{companyId:company.id,limit:1},0)
    valid(schemas.get(names[2]),empty)
    assert.deepEqual(empty,{kind:'bonus-earnings-preparations',bonuses:[],limit:1,next:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
    const proposals=await call(path,names[4],{companyId:company.id,limit:1},0)
    valid(schemas.get(names[4]),proposals)
    assert.deepEqual(proposals,{kind:'run-input-proposals',proposals:[],limit:1,next:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
  }
  assert.deepEqual(snapshots[0],snapshots[1],'read-only calls do not alter the visible fingerprint')
  const expected=new Map()
  for(const [i,input] of inputs.entries()) {
    const result=await call(paths[i],'envelope.bonus.prepare',input)
    const id=digest(['bonus',company.id,grant.id,input.requestKey])
    assert.deepEqual(result,{id,version:1,status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'})
    const selected=bonusPeople[i]
    const preview={periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',frequency:'off-cycle bonus',groupId:'',
      people:[{id:selected.id,name:selected.name,earningsCents:input.amountCents,taxableCashCents:input.amountCents,reimbursementCents:0,afterTaxDeductionCents:0,
        cashTipsCents:0,paycheckTipsCents:0,tipFundsCents:0}],
      holds:[{personId:selected.id,code:'bonus-calculation-incomplete'}],
      destinations:[{personId:selected.id,bankVersion:selected.bankVersion}],grossCashCents:input.amountCents,taxableCashCents:input.amountCents,reimbursementCents:0,afterTaxDeductionCents:0,
      taxAmounts:null,netPay:null,paymentReady:false,setupFingerprint:'',locationStates:['PA'],ruleFingerprint:'',ruleSources:[],
      bonusPreparation:{credentialId:grant.id,requestFingerprint:digest([selected.id,input.amountCents,input.periodStart,input.periodEnd,input.payDate,input.sourceRef]),sourceRef:input.sourceRef,amountCents:input.amountCents}}
    expected.set(id,{id,version:1,preview,sourcesCurrent:true,status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'})
  }
  const nativeAfter=await retained()
  assert.equal(nativeBefore.runs.length,0);assert.equal(nativeAfter.runs.length,2)
  assert.deepEqual(nativeAfter.grants,nativeBefore.grants,'preparation and reads do not widen grants')
  for(const row of nativeAfter.runs) {
    assert.ok(expected.has(row.id));assert.equal(row.version,1)
    assert.deepEqual(nativeValues(row.data),expected.get(row.id).preview,'the native retained values match the independent fixture')
    assert.ok(row.data.people[0].details.some(detail=>detail.includes(row.data.bonusPreparation.sourceRef)))
    assert.ok(row.data.people[0].details.some(detail=>detail.includes(grant.id)))
    assert.ok(row.data.holds[0].reason.length>0,'the retained calculation hold has an explanation')
    const pin=await db.prepare("SELECT person_id FROM env_workspace_people WHERE company_id=? AND kind='earnings-run' AND object_id=? AND version=1").bind(company.id,row.id).first()
    assert.equal(pin.person_id,expected.get(row.id).preview.people[0].id,'the retained native reference identifies the selected worker')
    assert.notEqual(pin.person_id,unrelated.id)
  }
  const ordered=[...expected.keys()].sort(),bonusSnapshots=[]
  for(const path of paths) {
    const snapshot=await call(path,names[0],{});valid(schemas.get(names[0]),snapshot)
    assert.deepEqual([snapshot.people,snapshot.drafts,snapshot.bonuses],[3,0,2]);bonusSnapshots.push(snapshot)
    assert.notEqual(snapshot.sha256,snapshots[0].sha256,'persisted preparation changes the fingerprint')
    contractRejects(schemas.get(names[0]),snapshot)
    for(const id of ordered) {
      const read=await call(path,names[1],{companyId:company.id,runId:id})
      valid(schemas.get(names[1]),read)
      assert.deepEqual({...read,preview:nativeValues(read.preview)},expected.get(id),'the MCP result matches independent native input values')
      assert.deepEqual(read.preview,nativeAfter.runs.find(row=>row.id===id).data,'MCP and the native owner read the same retained preview')
      contractRejects(schemas.get(names[1]),read)
      for(const [field,value] of [['taxAmounts',0],['netPay',inputs[0].amountCents],['paymentReady',true]]) {
        const payable=structuredClone(read);payable.preview[field]=value
        assert.ok(schemaErrors(schemas.get(names[1]),payable).length,'an uncalculated bonus cannot claim '+field)
      }
      assert.ok(schemaErrors(schemas.get(names[1]),{...read,dispatch:'sent'}).length,'the contract cannot imply dispatch occurred')
      // Detect a fabricated calculation, a lost hold or an expanded payee list.
      const invalid=[
        preview=>{preview.holds=[]},
        preview=>{preview.people=[]},
        preview=>{preview.destinations=[]},
        preview=>{preview.people.push(structuredClone(preview.people[0]))},
        preview=>{preview.people[0].cashTipsCents=1},
        preview=>{preview.reimbursementCents=1},
        preview=>{preview.setupFingerprint='synthetic-envelope-evaluated'},
        preview=>{preview.ruleFingerprint='synthetic-envelope-evaluated'},
        preview=>{preview.ruleSources=[{id:'synthetic-envelope-rule',version:1,name:'Synthetic rule',determination:'accepted',approved:true}]},
      ]
      for(const change of invalid) {
        const corrupted=structuredClone(read);change(corrupted.preview)
        assert.ok(schemaErrors(schemas.get(names[1]),corrupted).length,'discovery refuses an unsupported native bonus result')
      }
    }
    let after
    const seen=[]
    for(let page=0;page<3;page++) {
      const report=await call(path,names[2],{companyId:company.id,limit:1,...(after?{after}:{})},page<2?1:0)
      valid(schemas.get(names[2]),report)
      const id=ordered[page],entry=id?expected.get(id):null
      assert.deepEqual(report,{kind:'bonus-earnings-preparations',bonuses:entry?[{id,version:1,personId:entry.preview.people[0].id,amountCents:entry.preview.grossCashCents,
        periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourcesCurrent:true,status:'uncalculated-earnings-run'}]:[],
        limit:1,next:page===0?id:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
      if(page===0)contractRejects(schemas.get(names[2]),report)
      seen.push(...report.bonuses.map(row=>row.id));after=id
    }
    assert.deepEqual(seen,ordered,'pagination serves each retained selection exactly once')
  }
  assert.deepEqual(await retained(),nativeAfter,'all reads leave native runs and grants unchanged')
  const expectedDrafts=new Map()
  for(const [i,input] of hourlyInputs.entries()) {
    const result=await call(paths[i],'envelope.draft.prepare',input)
    assert.deepEqual(result,{id:result.id,status:'uncalculated-proposal',approval:'not-approved',dispatch:'unavailable'})
    expectedDrafts.set(result.id,{id:result.id,personId:person.id,personVersion:2,rateId:rate.id,minutes:input.minutes,
      periodStart:input.periodStart,periodEnd:input.periodEnd,payDate:input.payDate,stale:0})
  }
  const retainedDrafts=await owner(base+'/drafts')
  assert.equal(retainedDrafts.length,2)
  for(const row of retainedDrafts) {
    const {personName,sourceRef,credentialId,...values}=row
    const input=hourlyInputs.find(input=>input.minutes===row.minutes)
    assert.equal(personName,name);assert.equal(sourceRef,input.sourceRef);assert.equal(credentialId,grant.id)
    assert.deepEqual(values,(({stale,...fields})=>fields)(expectedDrafts.get(row.id)))
  }
  const draftOrder=[...expectedDrafts.keys()].sort()
  for(const path of paths) {
    for(const id of draftOrder) {
      const expected=expectedDrafts.get(id),input=hourlyInputs.find(input=>input.minutes===expected.minutes)
      const read=await call(path,names[3],{companyId:company.id,draftId:id})
      valid(schemas.get(names[3]),read);contractRejects(schemas.get(names[3]),read)
      assert.deepEqual(read,{...expected,personName:name,hourlyCents:3275,sourceRef:input.sourceRef,status:'uncalculated-proposal',approval:'not-approved',dispatch:'unavailable'})
    }
    const seen=[]
    for(let page=0;page<3;page++) {
      const report=await call(path,names[4],{companyId:company.id,limit:1,...(page?{after:draftOrder[page-1]}:{})},page<2?1:0)
      valid(schemas.get(names[4]),report);contractRejects(schemas.get(names[4]),report)
      const id=draftOrder[page]
      assert.deepEqual(report,{kind:'run-input-proposals',proposals:id?[expectedDrafts.get(id)]:[],limit:1,next:page===0?id:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
      seen.push(...report.proposals.map(row=>row.id))
    }
    assert.deepEqual(seen,draftOrder,'hourly pagination serves each independently retained preparation once')
  }
  assert.deepEqual(await owner(base+'/drafts'),retainedDrafts,'schema probes never change retained compensation')
  assert.deepEqual(await retained(),nativeAfter,'hourly inputs do not expand bonus selections or grants')
  const populated=[]
  for(const path of paths) {
    const snapshot=await call(path,names[0],{});valid(schemas.get(names[0]),snapshot)
    assert.deepEqual([snapshot.people,snapshot.drafts,snapshot.bonuses],[3,2,2])
    assert.notEqual(snapshot.sha256,bonusSnapshots[0].sha256,'retained hourly inputs also change the workspace fingerprint')
    populated.push(snapshot)
  }
  assert.deepEqual(populated[0],populated[1],'both paths reconcile the same populated workspace')
  // A real native source change makes one retained bonus stale without
  // changing its immutable amounts or the other worker's current preparation.
  const changed=await owner(base+'/people/'+person.id+'/rates',{version:2,hourlyCents:3400,effectiveDate:'2026-09-01',sourceRef:'synthetic-envelope-contract-correction'},201)
  assert.ok(changed.id)
  const changedReview=await owner(base+'/rates/'+changed.id)
  await owner(base+'/rates/'+changed.id+'/approve',{version:changedReview.version,reviewToken:changedReview.reviewToken})
  assert.equal((await owner(base+'/people/'+person.id)).version,3)
  for(const entry of expected.values())entry.sourcesCurrent=entry.preview.people[0].id!==person.id
  const staleNative=await retained()
  assert.deepEqual(staleNative.grants,nativeAfter.grants,'a source correction changes no grant')
  for(const row of staleNative.runs)assert.equal(Boolean(row.sourcesCurrent),expected.get(row.id).sourcesCurrent,'the native retained source version independently identifies stale compensation')
  for(const path of paths) {
    const report=await call(path,names[2],{companyId:company.id},2)
    valid(schemas.get(names[2]),report)
    assert.deepEqual(report.bonuses.map(({id,personId,sourcesCurrent,amountCents})=>({id,personId,sourcesCurrent,amountCents})),
      ordered.map(id=>{const row=expected.get(id);return {id,personId:row.preview.people[0].id,sourcesCurrent:row.sourcesCurrent,amountCents:row.preview.grossCashCents}}))
    assert.equal(report.next,null)
    for(const id of ordered) {
      const read=await call(path,names[1],{companyId:company.id,runId:id})
      valid(schemas.get(names[1]),read)
      assert.deepEqual({...read,preview:nativeValues(read.preview)},expected.get(id))
      assert.deepEqual(read.preview,nativeAfter.runs.find(row=>row.id===id).data,'stale source status never rewrites retained bonus values')
    }
  }
  assert.deepEqual(await retained(),staleNative,'current and stale reads are read-only')
  // Exercise the native amount and source-reference boundaries, independently
  // of discovery, so a closed schema cannot silently exclude accepted results.
  const boundaryIds=[]
  for(const [i,input] of boundaryInputs.entries()) {
    const prepared=await call(paths[i],'envelope.bonus.prepare',input)
    const id=digest(['bonus',company.id,grant.id,input.requestKey]);boundaryIds.push(id)
    assert.deepEqual(prepared,{id,version:1,status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'})
    const preparationSchema=installedSchemas.get(origin+':'+phase).get('envelope.bonus.prepare').outputSchema
    valid(preparationSchema,prepared)
    assert.ok(schemaErrors(preparationSchema,{...prepared,id:'synthetic-envelope-wrong-reference'}).length,
      'preparation discovery refuses a fabricated bonus reference')
    for(const path of paths) {
      const read=await call(path,names[1],{companyId:company.id,runId:id})
      valid(schemas.get(names[1]),read)
      const native=(await retained()).runs.find(row=>row.id===id)
      assert.deepEqual(read.preview,native.data)
      assert.equal(read.preview.grossCashCents,input.amountCents)
      assert.equal(read.preview.people[0].earningsCents,input.amountCents)
      assert.equal(read.preview.people[0].id,input.personId)
      assert.equal(read.preview.bonusPreparation.sourceRef,input.sourceRef)
      assert.equal(read.preview.periodEnd,'2024-02-29')
      assert.equal(read.preview.taxAmounts,null);assert.equal(read.preview.netPay,null)
      assert.equal(read.preview.paymentReady,false);assert.equal(read.dispatch,'unavailable')
      for(const sourceRef of ['',input.sourceRef+'x']) {
        const invalid=structuredClone(read);invalid.preview.bonusPreparation.sourceRef=sourceRef
        assert.ok(schemaErrors(schemas.get(names[1]),invalid).length,'discovery refuses a source reference the native preparation cannot retain')
      }
      assert.ok(schemaErrors(schemas.get(names[1]),{...read,id:'synthetic-envelope-wrong-reference'}).length,
        'discovery refuses a fabricated bonus reference')
    }
  }
  const boundaries=await retained()
  assert.equal(boundaries.runs.length,4)
  assert.deepEqual(boundaries.grants,staleNative.grants,'boundary preparations do not expand grants')
  for(const sourceRef of ['',boundaryInputs[0].sourceRef+'x']) {
    const input={...boundaryInputs[0],sourceRef,requestKey:crypto.randomUUID(),idempotency_key:crypto.randomUUID()}
    for(const path of paths) {
      const refused=await wire(path,toolsCall,{name:'envelope.bonus.prepare',arguments:input})
      assert.equal(refused.result.isError,true)
      assert.equal(refused.result.structuredContent,undefined)
      assert.equal(refused.result._meta['com.runeditrun/error'].code,'invalid_input',
        'MCP preserves the native source-reference refusal')
    }
    const {companyId,idempotency_key,...nativeInput}=input
    const response=await request(origin+'/api/envelope/v1/companies/'+companyId+'/bonus-runs',{
      method:'POST',headers:{origin,authorization:'Bearer '+grant.token,'content-type':'application/json'},body:JSON.stringify(nativeInput)})
    assert.equal(response.status,400)
    assert.equal((await response.json()).error,'invalid_input','REST preserves the same native refusal code')
  }
  assert.deepEqual(await retained(),boundaries,'refused bonus inputs create no preparation and change no grant')
  for(const path of paths) {
    const report=await call(path,names[2],{companyId:company.id,limit:100},4)
    valid(schemas.get(names[2]),report)
    assert.equal(report.bonuses.length,4);assert.equal(report.limit,100);assert.equal(report.next,null)
    for(const [i,id] of boundaryIds.entries())assert.equal(report.bonuses.find(row=>row.id===id).amountCents,boundaryInputs[i].amountCents)
    const page=await call(path,names[2],{companyId:company.id,limit:1},1)
    assert.equal(page.bonuses.length,1);assert.equal(page.next,page.bonuses[0].id)
    valid(schemas.get(names[2]),page)
    for(const limit of [0,101]) {
      assert.ok(schemaErrors(schemas.get(names[2]),{...page,limit}).length,'discovery refuses a page limit outside native capacity')
      const refused=await wire(path,toolsCall,{name:names[2],arguments:{companyId:company.id,limit}})
      assert.equal(refused.result.isError,true)
      assert.equal(refused.result.structuredContent,undefined)
    }
    assert.ok(schemaErrors(schemas.get(names[2]),{...page,next:'synthetic-envelope-wrong-cursor'}).length,
      'discovery refuses a cursor that cannot identify a native bonus')
    const expanded=structuredClone(page);expanded.bonuses[0].id='synthetic-envelope-wrong-reference'
    assert.ok(schemaErrors(schemas.get(names[2]),expanded).length,'report entries retain native bonus references')
  }
  assert.deepEqual(await retained(),boundaries,'invalid report queries and boundary reads change no preparation or grant')
  console.log('PROBE BASE-AGENT-002 native boundaries: '+phase+' both MCP paths -> one-cent and maximum native bonus, full source reference and leap day preserved; invalid limits, references and cursors detected without business effects')
  console.log('PROBE BASE-AGENT-002 native variants: '+phase+' both MCP paths -> bank version zero without bank data, two distinct payees, current and stale sources with immutable amounts; fabricated rule evaluation and missing calculation holds refused')
  console.log('PROBE BASE-AGENT-002 2: '+phase+' actual MCP paths -> native snapshot, bonus preview and empty and paginated report match independent records; missing, mistyped and private expansion rejected')
  console.log('PROBE BASE-AGENT-002 3: '+phase+' actual discovery and reads -> read-only annotations, standard snapshot and sensitive compensation with exact selected counts')
}
