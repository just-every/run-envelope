import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {schemaErrors} from '../../src/modules/agent-door/conformance/schema.mjs'
import {client} from './native.mjs'
import {contractFixtures} from './fixtures.mjs'

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const paths=['/mcp','/api/envelope/mcp']
const toolsCall=['tools','call'].join('/'),toolsList=['tools','list'].join('/')
const names=['envelope.workspace.snapshot','envelope.bonus.read','envelope.reports.bonuses']
const decision=answer=>answer.result?._meta?.['com.runeditrun/decision']
const valid=(schema,value)=>assert.deepEqual(schemaErrors(schema,value),[],'the runtime result satisfies discovery')
const nativeValues=preview=>({...preview,people:preview.people.map(({details,...person})=>person),holds:preview.holds.map(({reason,...hold})=>hold)})

/** Missing, mistyped or expanded compensation must be rejected by discovery. */
function contractRejects(schema,value) {
  const visit=(rule,item,path=[])=>{
    if(item===null||typeof item!=='object')return
    if(Array.isArray(item)) {
      for(let i=0;i<item.length;i++)visit(rule.items,item[i],[...path,i])
      return
    }
    const at=root=>path.reduce((row,key)=>row[key],root)
    for(const key of Object.keys(item)) {
      const removed=structuredClone(value);delete at(removed)[key]
      assert.ok(schemaErrors(schema,removed).length,'discovery rejects a missing native field '+[...path,key].join('.'))
      const mistyped=structuredClone(value)
      at(mistyped)[key]=typeof item[key]==='string'?17:'synthetic-envelope-wrong-type'
      assert.ok(schemaErrors(schema,mistyped).length,'discovery rejects a mistyped native field '+[...path,key].join('.'))
      visit(rule.properties[key],item[key],[...path,key])
    }
    const expanded=structuredClone(value);at(expanded).bankNumber='synthetic-envelope-private'
    assert.ok(schemaErrors(schema,expanded).length,'discovery rejects an undeclared private field at '+path.join('.'))
  }
  visit(schema,value)
}

/** One native sanity journey, under both policies, through both MCP paths. */
export async function toolContracts(context) {
  if(context.step.id!=='workspace-snapshot'||!['autonomous','held'].includes(context.phase))return
  const fixture=contractFixtures.get(context.origin+':'+context.phase)
  assert.ok(fixture,'the policy phase has independently seeded native records')
  const {origin,request,phase,database}=context,{base,company,person,unrelated,name,privateValue,grant,inputs}=fixture
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
    const sensitive=tool!=='envelope.workspace.snapshot'&&tool!=='envelope.bonus.prepare'
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
    assert.deepEqual([snapshot.people,snapshot.drafts,snapshot.bonuses],[2,0,0])
    assert.match(snapshot.sha256,/^[a-f0-9]{64}$/);snapshots.push(snapshot)
    const empty=await call(path,names[2],{companyId:company.id,limit:1},0)
    valid(schemas.get(names[2]),empty)
    assert.deepEqual(empty,{kind:'bonus-earnings-preparations',bonuses:[],limit:1,next:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
  }
  assert.deepEqual(snapshots[0],snapshots[1],'read-only calls do not alter the visible fingerprint')
  const expected=new Map()
  for(const [i,input] of inputs.entries()) {
    const result=await call(paths[i],'envelope.bonus.prepare',input)
    const id=digest(['bonus',company.id,grant.id,input.requestKey])
    assert.deepEqual(result,{id,version:1,status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'})
    const preview={periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',frequency:'off-cycle bonus',groupId:'',
      people:[{id:person.id,name,earningsCents:input.amountCents,taxableCashCents:input.amountCents,reimbursementCents:0,afterTaxDeductionCents:0,
        cashTipsCents:0,paycheckTipsCents:0,tipFundsCents:0}],
      holds:[{personId:person.id,code:'bonus-calculation-incomplete'}],
      destinations:[{personId:person.id,bankVersion:1}],grossCashCents:input.amountCents,taxableCashCents:input.amountCents,reimbursementCents:0,afterTaxDeductionCents:0,
      taxAmounts:null,netPay:null,paymentReady:false,setupFingerprint:'',locationStates:['PA'],ruleFingerprint:'',ruleSources:[],
      bonusPreparation:{credentialId:grant.id,requestFingerprint:digest([person.id,input.amountCents,input.periodStart,input.periodEnd,input.payDate,input.sourceRef]),sourceRef:input.sourceRef,amountCents:input.amountCents}}
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
    expected.get(row.id).preview=row.data
    const pin=await db.prepare("SELECT person_id FROM env_workspace_people WHERE company_id=? AND kind='earnings-run' AND object_id=? AND version=1").bind(company.id,row.id).first()
    assert.equal(pin.person_id,person.id,'the retained native reference identifies the selected worker')
    assert.notEqual(pin.person_id,unrelated.id)
  }
  const ordered=[...expected.keys()].sort()
  for(const path of paths) {
    const snapshot=await call(path,names[0],{});valid(schemas.get(names[0]),snapshot)
    assert.deepEqual([snapshot.people,snapshot.drafts,snapshot.bonuses],[2,0,2])
    assert.notEqual(snapshot.sha256,snapshots[0].sha256,'persisted preparation changes the fingerprint')
    contractRejects(schemas.get(names[0]),snapshot)
    for(const id of ordered) {
      const read=await call(path,names[1],{companyId:company.id,runId:id})
      valid(schemas.get(names[1]),read);assert.deepEqual(read,expected.get(id))
      contractRejects(schemas.get(names[1]),read)
      for(const [field,value] of [['taxAmounts',0],['netPay',inputs[0].amountCents],['paymentReady',true]]) {
        const payable=structuredClone(read);payable.preview[field]=value
        assert.ok(schemaErrors(schemas.get(names[1]),payable).length,'an uncalculated bonus cannot claim '+field)
      }
      assert.ok(schemaErrors(schemas.get(names[1]),{...read,dispatch:'sent'}).length,'the contract cannot imply dispatch occurred')
    }
    let after
    const seen=[]
    for(let page=0;page<3;page++) {
      const report=await call(path,names[2],{companyId:company.id,limit:1,...(after?{after}:{})},page<2?1:0)
      valid(schemas.get(names[2]),report)
      const id=ordered[page],entry=id?expected.get(id):null
      assert.deepEqual(report,{kind:'bonus-earnings-preparations',bonuses:entry?[{id,version:1,personId:person.id,amountCents:entry.preview.grossCashCents,
        periodStart:'2026-10-01',periodEnd:'2026-10-07',payDate:'2026-10-09',sourcesCurrent:true,status:'uncalculated-earnings-run'}]:[],
        limit:1,next:page===0?id:null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'})
      if(page===0)contractRejects(schemas.get(names[2]),report)
      seen.push(...report.bonuses.map(row=>row.id));after=id
    }
    assert.deepEqual(seen,ordered,'pagination serves each retained selection exactly once')
  }
  assert.deepEqual(await retained(),nativeAfter,'all reads leave native runs and grants unchanged')
  console.log('PROBE BASE-AGENT-002 2: '+phase+' actual MCP paths -> native snapshot, bonus preview and empty and paginated report match independent records; missing, mistyped and private expansion rejected')
  console.log('PROBE BASE-AGENT-002 3: '+phase+' actual discovery and reads -> read-only annotations, standard snapshot and sensitive compensation with exact selected counts')
}
