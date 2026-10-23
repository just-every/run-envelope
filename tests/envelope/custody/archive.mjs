import {restoredJourney} from './restored.mjs'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,mkdir,cp,symlink,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
const execute=promisify(execFile)

/** Public rer export/import/export on synthetic populated native local stores. */
export async function archiveJourney({persist,settings,formerToken}) {
  const scratch=await mkdtemp(join(tmpdir(),'envelope-archive-')),root=resolve('.'),
    files=(await execute('git',['ls-files','-z'])).stdout.split('\0').filter(Boolean),
    cli=resolve('node_modules/@runeditrun/rer/bin/rer.mjs')
  const fixture=async name=>{
    const dir=join(scratch,name)
    await mkdir(dir,{recursive:true})
    for(const file of files) {await mkdir(dirname(join(dir,file)),{recursive:true});await cp(join(root,file),join(dir,file))}
    await symlink(join(root,'node_modules'),join(dir,'node_modules'),'dir')
    return dir
  }
  const run=async(dir,args,status=0)=>{
    try {
      const result=await execute(process.execPath,[cli,...args,'--cwd',dir],{maxBuffer:4*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}})
      assert.equal(status,0,'expected refusal: '+args[0]);return result.stdout
    } catch(error) {
      if(error.code!==status) throw Error('archive command '+args[0]+' exited '+error.code+'\n'+error.stdout+'\n'+error.stderr)
      return error.stdout+error.stderr
    }
  }
  const records=async path=>(await readFile(path,'utf8')).trim().split('\n').map(l=>JSON.parse(l))
  const rows=records=>records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(r=>r.kind==='row').reduce((all,r)=>{(all[r.table]??=[]).push(r.row);return all},{})
  const normalized=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort().map(([table,data])=>[table,data.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))])))
  try {
    const source=await fixture('source'),target=await fixture('target'),damagedTarget=await fixture('damaged')
    await mkdir(join(source,'.wrangler'),{recursive:true})
    await cp(persist,join(source,'.wrangler/state'),{recursive:true})
    await run(source,['export','--output','exports/populated.rer'])
    const archive=await records(join(source,'exports/populated.rer')),before=rows(archive),manifest=archive[0]
    assert.equal(manifest.version,2)
    for(const table of ['env_companies','env_locations','env_notices','env_notice_analysis','env_notice_replies','env_notice_approvals','env_notice_dispatches','env_private_files','env_audit','env_agent_history','env_agent_access']) assert.ok(before[table]?.length,table+' is populated and archived')
    for(const table of ['env_grants','env_agent_grants','env_agent_credentials','env_external_providers','oa_sessions','oa_tokens','oa_step_up_challenges','env_notice_reviews']) assert.equal(before[table],undefined,table+' never transfers')
    assert.ok(before.env_companies.length>=2,'mixed company history')
    assert.ok(before.env_companies.every(c=>c.restored===1))
    assert.ok(before.env_notice_approvals.every(a=>a.expires_at===1 && a.revoked_at===1))
    assert.ok(before.env_notice_dispatches.some(d=>d.state==='unknown'))
    assert.ok(before.env_notice_dispatches.some(d=>d.state==='accepted' && d.provider_receipt))
    assert.ok(before.env_private_files.some(f=>f.version===2),'all immutable file versions')
    const raw=JSON.stringify(archive)
    for(const secret of ['synthetic-envelope-510','synthetic-envelope-512','000-00-0057']) assert.equal(raw.includes(secret),false,'no key or raw private original in archive')
    // The archive is deliberately placed under the destination's private export path.
    await mkdir(join(target,'exports'),{recursive:true})
    await cp(join(source,'exports/populated.rer'),join(target,'exports/populated.rer'))
    await run(target,['import','--input','exports/populated.rer','--yes'])
    await run(target,['export','--output','exports/roundtrip.rer'])
    const after=rows(await records(join(target,'exports/roundtrip.rer')))
    assert.equal(normalized(after),normalized(before),'every retained business row and encrypted byte/digest round trips')
    assert.match(await run(target,['import','--input','exports/populated.rer','--yes'],4),/target_not_empty/)
    await run(target,['export','--output','exports/after-refusal.rer'])
    assert.equal(normalized(rows(await records(join(target,'exports/after-refusal.rer')))),normalized(after),'nonempty refusal leaves business rows unchanged')
    await mkdir(join(damagedTarget,'exports'),{recursive:true})
    const corrupt=structuredClone(archive),part=corrupt.find(r=>r.kind==='part'),item=part.items.find(i=>i.kind==='row')
    item.row[Object.keys(item.row)[0]]='synthetic-envelope-599'
    await writeFile(join(damagedTarget,'exports/corrupt.rer'),corrupt.map(r=>JSON.stringify(r)).join('\n')+'\n')
    assert.match(await run(damagedTarget,['import','--input','exports/corrupt.rer','--yes'],1),/verification failed/)
    await restoredJourney({target,settings,formerToken})
    console.log('ARCHIVE-CUSTODY passed: public native export/import/export preserves every populated mixed-company business row and immutable file/digest; excludes sessions, tokens, live grants/provider keys; restores paused with historical expired approvals and accepted/unknown original IDs; corrupt and nonempty imports refuse')
  } finally {await rm(scratch,{recursive:true,force:true})}
}
