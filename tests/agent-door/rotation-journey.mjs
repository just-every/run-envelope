import {beforeRestriction,afterRestriction,authorityInjectionStep} from './authority.mjs'
import {riskBefore,riskAfter,riskAudit} from './risk-facts.mjs'
import {replayStep,replayMutation} from './replay.mjs'
import {toolContracts,discoverToolContracts,installedToolContracts} from './tool-contracts.mjs'
import assert from 'node:assert/strict'
import {state,rotationKeys} from './native.mjs'
import {docsJourney} from './docs.mjs'
import maskedResources from './masked-resources.mjs'
// Phase preparation lets Base retain every native fixture call in its audit
// accounting, including resource reads made with the declared local client.
export const prepareResources=context=>maskedResources(context)
export default async function(context) {
  const {database,request,origin,cookie}=context
  try { await riskAudit({database,request,origin,cookie}) } catch(error) { console.error('Risk facts audit',error.code,error.stack?.split('\n').find(line=>line.includes('risk-facts.mjs:')));throw error }
  const db=await database('DB')
  const rows=(await db.prepare("SELECT * FROM env_agent_call_audit WHERE rowid IN (SELECT MIN(rowid) FROM env_agent_call_audit WHERE door_operation_id IS NOT NULL GROUP BY tool)").all()).results
  for(const native of rows) {
    const audits=(await db.prepare("SELECT row FROM agent_door_audit WHERE json_extract(row,'$.operation_id')=?").bind(native.door_operation_id).all()).results.map(value=>JSON.parse(value.row))
    const name=({'records.person':'resources/read','run.review':'envelope.runs.review_link','notice.process':'envelope.notices.process','reply.dispatch':'envelope.notices.reply','job.status':'envelope.jobs.status'})[native.tool]??'envelope.'+native.tool
    const matching=audits.find(row=>row.tool===name&&row.agent.id===native.door_agent_id&&row.sponsor.id===native.sponsor_id)
    assert.ok(matching,'native activity and shared audit identify the same agent, sponsor and operation')
    assert.deepEqual(JSON.parse(native.classes).sort(),matching.classes.map(value=>value.class).sort())
    const response=await request(origin+'/api/envelope/companies/'+native.company_id+'/agents?operation='+native.door_operation_id,{headers:{cookie}})
    assert.equal(response.status,200)
    assert.ok((await response.json()).activity.calls.some(row=>row.operationId===native.door_operation_id))
  }
}
export async function beforeStep(context) {
  await discoverToolContracts(context)
  try {await riskBefore(context);await beforeRestriction(context)} catch(error) {console.error('Native admission assertion in '+context.phase+': '+error.message);throw error}
}
export async function afterStep(context) {
  try {
    await toolContracts(context)
    await installedToolContracts(context)
  } catch(error) {
    console.error('Tool contract assertion failed:',context.phase,context.step.id,
      error.stack?.split('\n').find(line=>line.includes('tool-contracts.mjs'))?.trim())
    throw error
  }

  try {await afterRestriction(context);await authorityInjectionStep(context);await riskAfter(context);await replayStep(context);await replayMutation(context)} catch(error) {console.error('Native restriction assertion in '+context.phase+': '+error.message);throw error}
  const {phase,step,result,origin,request,database}=context
  if(step.tool!=='envelope.credentials.rotate')return
  assert.equal(Object.hasOwn(result,'token'),false,'the door never retains a plaintext native bearer')
  const db=await database('DB')
  const latest=phase==='autonomous'?await db.prepare("SELECT json_extract(c.outcome,'$.result.encryptedToken') AS encrypted FROM agent_door_calls c JOIN agent_door_audit a ON a.id=c.decision_id WHERE json_extract(a.row,'$.tool')='envelope.credentials.rotate' ORDER BY c.created_at DESC,a.sequence DESC LIMIT 1").first():null
  const token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},rotationKeys.get(origin+':'+phase),Buffer.from(latest?.encrypted??result.encryptedToken,'base64')))
  const saved=state.get(origin),list=bearer=>request(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:51,method:'tools/list',params:{}})})
  assert.equal((await list(saved.localToken)).status,401,'the previous native bearer stops immediately')
  for(const path of ['/mcp','/api/envelope/mcp'])for(const method of ['prompts/list','prompts/get']) {
    const revoked=await request(origin+path,{method:'POST',headers:{authorization:'Bearer '+saved.localToken,'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:52,method,params:{name:'payroll-workers'}})})
    assert.equal(revoked.status,401,'a revoked native bearer cannot list or retrieve specialist jobs')
    const body=await revoked.json()
    assert.equal(body.result,undefined)
  }
  assert.equal((await list(token)).status,200,'the decrypted replacement retains the real native scope')
  for(const [table,columns] of [['agent_door_calls',['outcome']],['agent_door_approvals',['saved','result']],['agent_door_audit',['row','evidence']]]) {
    const row=await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${columns.map(column=>`instr(COALESCE(${column},''),?)>0`).join(' OR ')}`).bind(...columns.map(()=>token)).first()
    assert.equal(row.n,0,'durable door records contain only encrypted credential delivery')
  }
  saved.localToken=token
  if(['autonomous','held'].includes(phase))await docsJourney(context)
}
