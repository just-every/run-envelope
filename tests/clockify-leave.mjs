import assert from 'node:assert/strict'

/** Reviewed Clockify non-work entries remain distinct from worked time and native payment authority. */
export async function clockifyLeaveCases({data,door,pay,people}) {
  const id = 'synthetic-envelope-clockify-leave-run', worker = 'synthetic-envelope-clockify-leave-worker'
  const account = 'synthetic-envelope-clockify-leave-account'
  const capture = {provider:'clockify',account,evidence:'synthetic-envelope-reviewed-leave',payload:[],mappings:{}}
  for (const [i,type,minutes,code,amountCents] of [[0,'TIME_OFF',120,'paid-leave',2000],[1,'HOLIDAY',60,'unpaid-leave',0]]) {
    const source = 'synthetic-envelope-clockify-leave-'+i
    capture.payload.push({id:source,userId:worker+i,workspaceId:account,isLocked:true,type,projectId:'synthetic-envelope-project-'+i,
      timeInterval:{start:'2026-11-02T09:00:00Z',end:i?'2026-11-02T10:00:00Z':'2026-11-02T11:00:00Z',duration:String(minutes*60)}})
    capture.mappings[source] = {sourcePersonId:worker+i,personId:people[i].id,day:'2026-11-02',workweek:'2026-11-02',code,amountCents,
      sourceJobId:'synthetic-envelope-project-'+i,job:i?'Floor':'Kitchen'}
  }
  const body = {id,version:0,providerCapture:capture}
  const diff = await data(door+'/preview',body)
  assert.deepEqual(diff.data.rows.map(row=>[row.personId,row.code,row.minutes,row.amountCents]),
    [[people[0].id,'paid-leave',120,2000],[people[1].id,'unpaid-leave',60,0]])
  const missing = structuredClone(capture);delete missing.mappings[capture.payload[0].id].code
  assert.equal((await data(door+'/preview',{...body,providerCapture:missing},409)).error,'provider_leave_mapping_required')
  const unsafe = structuredClone(capture);unsafe.mappings[capture.payload[1].id].amountCents=100
  assert.equal((await data(door+'/preview',{...body,providerCapture:unsafe},400)).error,'unpaid_leave_cannot_create_pay')
  const unlocked = structuredClone(capture);unlocked.payload[0].isLocked=false
  await data(door+'/preview',{...body,providerCapture:unlocked},409)
  assert.ok(!(await data(door)).some(row=>row.id===id),'refused leave imports write no version')
  await data(door+'/apply',{...body,digest:diff.digest},201)
  const approve = async version => {
    const review = await data(door+'/'+id+'/review')
    await data(door+'/'+id+'/approve',{version,reviewToken:review.reviewToken})
  }
  const run = {id,version:0,groupId:'synthetic-envelope-802',periodStart:'2026-11-02',periodEnd:'2026-11-08',payDate:'2026-11-09',frequency:'weekly'}
  await approve(1)
  const first = (await data(pay+'/earnings-run',run,201)).preview
  assert.equal(first.grossCashCents,2000,'only the explicitly reviewed non-work amount contributes money')
  assert.equal(first.people.find(person=>person.id===people[1].id).earningsCents,0)
  assert.equal(first.paymentReady,false,'retained non-work inputs do not establish lawful leave rates or paid consumption')
  assert.ok(first.people.find(person=>person.id===people[0].id).details.some(detail=>detail.includes('paid-leave: 120 minutes, 2000 cents')))
  const changed = structuredClone(capture)
  changed.payload[0].timeInterval.end='2026-11-02T10:00:00Z';changed.payload[0].timeInterval.duration='3600'
  changed.mappings[changed.payload[0].id].amountCents=1000
  changed.payload[0].projectId='synthetic-envelope-project-corrected'
  assert.equal((await data(door+'/preview',{...body,version:1,providerCapture:changed},409)).error,'provider_job_mapping_required',
    'a changed source project requires a newly reviewed exact mapping')
  changed.mappings[changed.payload[0].id].sourceJobId=changed.payload[0].projectId
  changed.mappings[changed.payload[0].id].job='Front'
  const correctedBody = {...body,version:1,providerCapture:changed}
  const correction = await data(door+'/preview',correctedBody)
  assert.deepEqual(correction.cells.filter(cell=>cell.status==='change').map(cell=>[cell.field,cell.before,cell.after]),
    [['minutes',120,60],['amountCents',2000,1000],['job','Kitchen','Front']])
  await data(door+'/apply',{...correctedBody,digest:correction.digest},201)
  await data(pay+'/earnings-run',{...run,version:1},409)
  await approve(2)
  assert.equal((await data(pay+'/earnings-run',{...run,version:1},201)).preview.grossCashCents,1000)
  assert.equal((await data(pay)).runs.find(row=>row.id===id && row.version===1).data.grossCashCents,2000)
  const replay = {...correctedBody,version:2}
  assert.equal((await data(door+'/apply',{...replay,digest:(await data(door+'/preview',replay)).digest},201)).replayed,true)
  await data(door+'/preview',{...body,id:id+'-duplicate'},409)
  await data(door+'/'+id+'/withdraw',{version:2})
  await data(pay+'/earnings-run',{...run,version:2},409)
  return {id,capture}
}
