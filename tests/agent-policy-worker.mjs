import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

// The real emitted Worker and D1 stay in use. Only the next request's batch
// scheduling is held, so Pause can arrive after policy evaluation and before SQL.
export async function agentPolicyWorker() {
  const configPath=resolve('dist/server/wrangler.json'),config=JSON.parse(await readFile(configPath,'utf8'))
  const target='./'+config.main.replace(/^\.\//,''),entrypoint=join(dirname(configPath),'agent-policy-test-worker.mjs')
  await writeFile(entrypoint,`
import worker from ${JSON.stringify(target)}
export * from ${JSON.stringify(target)}
const SystemDate=Date
let instant=SystemDate.parse('2026-10-28T12:00:00Z')
globalThis.Date=class extends SystemDate {
 constructor(...args){super(...(args.length?args:[instant]))}
 static now(){return instant}
}
let phase='idle',release
export default {
 ...worker,
 async fetch(request,env,context) {
  const next=request.headers.get('x-synthetic-clock')
  if(next)instant=SystemDate.parse(next)
  const control=request.headers.get('x-synthetic-policy-batch')
  if(control==='release') { release?.();release=undefined;phase='idle' }
  let held=false
  const database=new Proxy(env.DB,{
   get(target,key) {
    if(key==='prepare')return sql=>target.prepare(sql.replaceAll("unixepoch('subsec')*1000",String(instant)))
    if(key==='batch') return async (...args)=>{
     if(control==='hold'&&!held) {
      held=true;phase='waiting'
      let timer
      try { await new Promise(resolve=>{release=resolve;timer=setTimeout(()=>{phase='timed-out';resolve()},10000)}) }
      finally { clearTimeout(timer) }
     }
     return target.batch(...args)
    }
    const value=Reflect.get(target,key,target)
    return typeof value==='function' ? value.bind(target) : value
   }
  })
  const response=await worker.fetch(request,{...env,DB:database},context)
  if(control==='observe'||control==='release') {
   const headers=new Headers(response.headers);headers.set('x-synthetic-policy-state',phase)
   return new Response(response.body,{status:response.status,headers})
  }
  return response
 }
}
`)
  return entrypoint
}
