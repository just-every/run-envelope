import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {inspectNativeSql} from '/workspace/run-envelope-sx-f103/tests/archive-runtime.mjs'
const fixture='/tmp/envelope-archive-X96GOm',product='/workspace/run-envelope-sx-f103'
const target=join(fixture,'target'),restored=join(fixture,'corrupt-target')
const state=path=>join(path,'.wrangler/state'),sql=(dir,query)=>inspectNativeSql(state(dir),query)
const expected=await sql(target,'SELECT * FROM env_archive_adoptions ORDER BY event_id')
assert.equal(expected.length,3)
assert.deepEqual(await sql(restored,'SELECT * FROM env_archive_adoptions ORDER BY event_id'),expected,'consent restore keeps exact attributed history')
for(const table of ['env_grants','oa_sessions']) assert.equal((await sql(restored,'SELECT COUNT(*) AS n FROM '+table))[0].n,0,'consent history never reactivates '+table)
const hash=data=>createHash('sha256').update(typeof data==='string'?data:JSON.stringify(data)).digest('hex')
const snapshot=async()=>{
 const tables=await sql(target,"SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'env_*' OR name GLOB 'oa_*' OR name GLOB 'oc_*') ORDER BY name")
 const rows={}
 for(const {name} of tables) rows[name]=(await sql(target,'SELECT * FROM "'+name.replaceAll('"','""')+'"')).map(row=>JSON.stringify(row)).sort()
 return hash(rows)
}
const before=await snapshot(),keyBefore=hash(await readFile(join(target,'.dev.vars'),'utf8'))
const execute=promisify(execFile),env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'warn'}
delete env.ENVELOPE_RECORD_KEY
const run=async(program,args)=>{
 try{const result=await execute(program,args,{cwd:target,env,timeout:600000,maxBuffer:16*1024*1024});return {exit:0,output:result.stdout+result.stderr}}
 catch(error){if(typeof error.code!=='number')throw error;return {exit:error.code,output:String(error.stdout??'')+String(error.stderr??'')}}
}
const occupied=await run(process.execPath,[join(product,'node_modules/@runeditrun/rer/global/rer.mjs'),'import','--cwd',target,'--input',join(fixture,'source/exports/custody.rer'),'--yes','--json','--non-interactive','--no-queue'])
await writeFile('/tmp/sx-f103-occupied-repro.log',occupied.output)
assert.notEqual(occupied.exit,0);assert.ok(occupied.output.includes('target_not_empty'),'nonempty refusal identifies the actual safety boundary')
assert.equal(await snapshot(),before,'refusal leaves every native business and identity row unchanged')
const keyResult=await run(process.execPath,[join(target,'scripts/portability/record-key.mjs'),'recover','--input',join(fixture,'unrelated-record-key.txt'),'--yes'])
await writeFile('/tmp/sx-f103-key-occupied.log',keyResult.output)
assert.notEqual(keyResult.exit,0);assert.ok(keyResult.output.includes('record_key_target_not_empty'))
assert.equal(hash(await readFile(join(target,'.dev.vars'),'utf8')),keyBefore,'recovery never replaces a populated target key')
assert.equal(await snapshot(),before,'key recovery refusal preserves native history')
const receipt={consentHistoryRestored:true,consents:expected.length,restoredGrants:0,restoredSessions:0,nonemptyRefusalExit:occupied.exit,nonemptyRefusalCode:'target_not_empty',businessUnchanged:true,keyRefusalExit:keyResult.exit,keyRefusalCode:'record_key_target_not_empty',keyUnchanged:true}
await writeFile('/tmp/sx-f103-archive-completion.json',JSON.stringify(receipt,null,2)+'\n')
console.log('ARCHIVE-COMPLETION passed: exact three consent receipts, inactive authority, nonempty refusal and unchanged key and business history')
