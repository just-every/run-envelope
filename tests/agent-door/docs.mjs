import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { state } from './native.mjs'

/** Compare the public reference with authenticated discovery, not a copied name list. */
export function assertReference(reference, listed, templates, surface) {
  assert.deepEqual(reference.tools.map(tool=>tool.name),listed.map(tool=>tool.name),'documentation must contain exactly the discovered tools')
  assert.deepEqual(reference.resourceTemplates.map(resource=>resource.uriTemplate),templates.map(resource=>resource.uriTemplate),'documentation must contain exactly the discovered resource templates')
  for(const actual of listed) {
    const documented=reference.tools.find(tool=>tool.name===actual.name)
    const {job,classTests,...wire}=documented
    assert.deepEqual(wire,actual,'documented tool metadata and schemas must equal real discovery')
    const declaration=surface.tools.find(tool=>tool.name===actual.name)
    assert.equal(job,declaration.job)
    assert.deepEqual(classTests,declaration.classTests)
    assert.deepEqual(classTests.map(proof=>proof.class).sort(),actual._meta['com.runeditrun/classes'].toSorted(),'each possible class needs a computed-class test')
    for(const proof of classTests) {
      const fixture=surface.journey.find(step=>step.id===proof.step && step.tool===actual.name)
      assert.ok(fixture?.expect.some(item=>item.class===proof.class),'a proof mapping must reach that tool and computed class')
      assert.equal(proof.test,'BASE-AGENT-006.2.<policy>.'+fixture.id)
    }
  }
}

export async function docsJourney({request,origin,database,phase}) {
  const token=state.get(origin).localToken
  const rpc=async(method,params={},status=200)=> {
    const response=await request(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:83,method,params})})
    assert.equal(response.status,status)
    return await response.json()
  }
  const response=await request(origin+'/docs/agents',{headers:{accept:'application/json'}})
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
  const reference=await response.json(),html=await (await request(origin+'/docs/agents')).text()
  const listed=(await rpc('tools/list')).result.tools,templates=(await rpc('resources/templates/list')).result.resourceTemplates
  const surface=JSON.parse(await readFile(new URL('../../agent-surface.json',import.meta.url),'utf8'))
  assertReference(reference,listed,templates,surface)
  assert.deepEqual([...html.matchAll(/data-tool="([^"]+)"/g)].map(match=>match[1]).sort(),listed.map(tool=>tool.name).sort(),'every documented tool is rendered on the page')
  for(const tool of reference.tools)for(const proof of tool.classTests) {
    await access(new URL('../../'+proof.path,import.meta.url))
    assert.ok(html.includes('data-proof="'+proof.step+'"'),'the page renders each computed-class proof')
  }
  const discover=(await rpc('server/discover')).result
  assert.deepEqual(reference.limits,discover._meta['com.runeditrun/limits'])
  assert.deepEqual(reference.capabilities,discover._meta['com.runeditrun/capabilities'])
  for(const tool of listed)assert.ok(discover.instructions.includes(tool.name),'discovery instructions are generated from installed jobs')
  assert.ok(discover.instructions.includes('/docs/agents'))
  assert.equal(reference.specialist,surface.specialist)
  assert.ok(reference.unfinishedJobs.length)
  const audits=(await (await database('DB')).prepare('SELECT row FROM agent_door_audit').all()).results.map(record=>JSON.parse(record.row))
  for(const tool of reference.tools)for(const proof of tool.classTests) {
    const decision=phase==='autonomous'?'autonomous':proof.class==='standard'?'review':'approval'
    assert.ok(audits.some(row=>row.tool===tool.name && row.decision===decision && ['done','replayed'].includes(row.outcome) && row.classes.some(item=>item.class===proof.class)), 'the documented computed class has a completed real call under '+phase)
  }
  // Exercise the comparator with omissions, so a plausible but incomplete reference fails.
  for(const omission of ['tool','class','proof']) {
    const altered=structuredClone(reference)
    if(omission==='tool')altered.tools.pop()
    if(omission==='class')altered.tools[0]._meta['com.runeditrun/classes'].pop()
    if(omission==='proof')altered.tools[0].classTests.pop()
    assert.throws(()=>assertReference(altered,listed,templates,surface),undefined,'detect omitted '+omission)
  }
  const unsupported=await rpc('prompts/get',{name:'payroll'})
  assert.equal(unsupported.error.data.code,'capability_not_declared')
  assert.ok(reference.errors.includes(unsupported.error.data.code),'the live capability refusal is documented')
  console.log('AGENT-DOCS '+phase+' passed: '+listed.length+' tools, '+reference.tools.reduce((n,tool)=>n+tool.classTests.length,0)+' computed-class proofs, '+templates.length+' resource templates; omitted tool, class and proof refused')
}
