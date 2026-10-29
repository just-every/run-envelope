import assert from 'node:assert/strict'
import {state,rotationKeys} from './native.mjs'
export default async function({database,request,origin,cookie}) {
  const db=await database('DB')
  const rows=(await db.prepare("SELECT * FROM env_agent_call_audit WHERE rowid IN (SELECT MIN(rowid) FROM env_agent_call_audit WHERE door_operation_id IS NOT NULL GROUP BY tool)").all()).results
  for(const native of rows) {
    const audits=(await db.prepare("SELECT row FROM agent_door_audit WHERE json_extract(row,'$.operation_id')=?").bind(native.door_operation_id).all()).results.map(value=>JSON.parse(value.row))
    const name=({'run.review':'envelope.runs.review_link','notice.process':'envelope.notices.process','reply.dispatch':'envelope.notices.reply'})[native.tool]??'envelope.'+native.tool
    const matching=audits.find(row=>row.tool===name&&row.agent.id===native.door_agent_id&&row.sponsor.id===native.sponsor_id)
    assert.ok(matching,'native activity and shared audit identify the same agent, sponsor and operation')
    assert.deepEqual(JSON.parse(native.classes).sort(),matching.classes.map(value=>value.class).sort())
    const response=await request(origin+'/api/envelope/companies/'+native.company_id+'/agents?operation='+native.door_operation_id,{headers:{cookie}})
    assert.equal(response.status,200)
    assert.ok((await response.json()).activity.calls.some(row=>row.operationId===native.door_operation_id))
  }
}
export async function afterStep({phase,step,result,origin,request,database}) {
  if(step.tool!=='envelope.credentials.rotate')return
  assert.equal(Object.hasOwn(result,'token'),false,'the door never retains a plaintext native bearer')
  const db=await database('DB')
  const latest=phase==='autonomous'?await db.prepare("SELECT json_extract(c.outcome,'$.result.encryptedToken') AS encrypted FROM agent_door_calls c JOIN agent_door_audit a ON a.id=c.decision_id WHERE json_extract(a.row,'$.tool')='envelope.credentials.rotate' ORDER BY c.created_at DESC,a.sequence DESC LIMIT 1").first():null
  const token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'RSA-OAEP'},rotationKeys.get(origin+':'+phase),Buffer.from(latest?.encrypted??result.encryptedToken,'base64')))
  const saved=state.get(origin),list=bearer=>request(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:51,method:'tools/list',params:{}})})
  assert.equal((await list(saved.localToken)).status,401,'the previous native bearer stops immediately')
  assert.equal((await list(token)).status,200,'the decrypted replacement retains the real native scope')
  for(const [table,columns] of [['agent_door_calls',['outcome']],['agent_door_approvals',['saved','result']],['agent_door_audit',['row','evidence']]]) {
    const row=await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${columns.map(column=>`instr(COALESCE(${column},''),?)>0`).join(' OR ')}`).bind(...columns.map(()=>token)).first()
    assert.equal(row.n,0,'durable door records contain only encrypted credential delivery')
  }
  saved.localToken=token
}
