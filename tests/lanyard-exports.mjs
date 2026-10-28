import assert from 'node:assert/strict'

// One employer journey: import allocated work and non-work pay, then reconcile an exported correction.
export async function lanyardExportCases({data, door, pay, personId}) {
  const id = 'synthetic-envelope-lanyard-allocated', account = 'synthetic-envelope-lanyard-allocations'
  const worker = 'synthetic-envelope-allocated-worker', root = 'synthetic-envelope-allocated-root'
  const approval = {by:'synthetic-envelope-source-owner',at:'2026-11-09T12:00:00Z',reason:'Reviewed source correction'}
  const mapping = {sourcePersonId:worker,personId,day:'2026-11-02',workweek:'2026-11-02',settlement:'cash'}
  const original = {provider:'lanyard',account,reconciliation:'signed-exports',evidence:'synthetic-envelope-approved-batch',
    payload:{id:'synthetic-envelope-original-export',revision:2,status:'exported',exportedBy:approval.by,exportedAt:approval.at,lines:[]},mappings:{}}
  const lines = original.payload.lines
  for (const [job,minutes] of [['Kitchen',240],['Floor',240]])
    lines.push({rootId:root,timeId:'synthetic-envelope-original-time',revision:2,payrollId:worker,
      start:'2026-11-02T09:00:00Z',end:'2026-11-02T17:00:00Z',minutes,job,area:job,site:'synthetic-envelope-site'})
  original.mappings['synthetic-envelope-original-time'] = mapping
  for (const day of ['03','04','05','06']) {
    const timeId = 'synthetic-envelope-allocated-' + day
    lines.push({rootId:timeId,timeId,revision:2,payrollId:worker,start:'2026-11-'+day+'T09:00:00Z',
      end:'2026-11-'+day+'T17:00:00Z',minutes:480})
    original.mappings[timeId] = {...mapping,day:'2026-11-'+day}
  }
  for (const [kind,minutes,costCents] of [['PTO',480,8000],['tips',0,60000]]) {
    const payInputId = 'synthetic-envelope-allocated-' + kind
    lines.push({payInputId,revision:1,payrollId:worker,start:'2026-11-02T12:00:00Z',minutes,costCents,payCode:kind,approval})
    original.mappings[payInputId] = mapping
  }
  const body = {id,version:0,providerCapture:original}
  const initial = await data(door+'/preview',body)
  assert.deepEqual(initial.data.rows.filter(row=>row.job).map(row=>[row.job,row.minutes]).sort(),[['Floor',240],['Kitchen',240]])
  assert.equal(initial.data.rows.filter(row=>row.code==='regular').reduce((sum,row)=>sum+row.minutes,0),2400)
  await data(door+'/apply',{...body,digest:initial.digest},201)
  const approve = async version => {
    const review = await data(door+'/'+id+'/review')
    await data(door+'/'+id+'/approve',{version,reviewToken:review.reviewToken})
  }
  await approve(1)
  const run = {id,version:0,groupId:'synthetic-envelope-802',periodStart:'2026-11-02',periodEnd:'2026-11-08',payDate:'2026-11-09',frequency:'weekly'}
  const first = await data(pay+'/earnings-run',run,201)
  assert.equal(first.preview.grossCashCents,48000)
  assert.equal(first.preview.people.find(person=>person.id===personId).cashTipsCents,60000)
  const correction = structuredClone(original)
  correction.payload.id = 'synthetic-envelope-corrected-export'
  correction.payload.lines = [
    ...[['Kitchen',-120],['Floor',60]].map(([job,minutes])=>({rootId:root,timeId:'synthetic-envelope-corrected-time',
      corrects:'synthetic-envelope-original-time',revision:4,payrollId:worker,start:'2026-11-02T09:00:00Z',
      end:'2026-11-02T16:00:00Z',minutes,job,area:job,site:'synthetic-envelope-site'})),
    {payInputId:'synthetic-envelope-allocated-PTO',revision:2,payrollId:worker,start:'2026-11-02T12:00:00Z',
      minutes:-240,costCents:-4000,payCode:'PTO',approval},
    {payInputId:'synthetic-envelope-allocated-tips',revision:2,payrollId:worker,start:'2026-11-02T12:00:00Z',
      minutes:0,costCents:-10000,payCode:'tips',approval},
  ]
  correction.mappings = {'synthetic-envelope-corrected-time':mapping,
    'synthetic-envelope-allocated-PTO':mapping,'synthetic-envelope-allocated-tips':mapping}
  const correctedBody = {...body,version:1,providerCapture:correction}
  const diff = await data(door+'/preview',correctedBody)
  assert.deepEqual(diff.data.rows.filter(row=>row.job).map(row=>[row.job,row.minutes]).sort(),[['Floor',300],['Kitchen',120]])
  assert.equal(diff.data.rows.find(row=>row.code==='paid-leave').amountCents,4000)
  assert.equal(diff.data.rows.find(row=>row.code==='tip').amountCents,50000)
  assert.deepEqual(diff.cells.filter(cell=>cell.field==='minutes' && cell.status==='change').map(cell=>[cell.before,cell.after]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
    [[240,120],[240,300],[480,240]])
  // Unknown history, a changed published export and a duplicate export cannot manufacture pay.
  const missing = await data(door+'/preview',{...correctedBody,id:id+'-orphan',version:0},409)
  assert.equal(missing.error,'provider_correction_history_required')
  const changed = structuredClone(original);changed.payload.lines[0].minutes=241
  assert.equal((await data(door+'/preview',{...body,version:1,providerCapture:changed},409)).error,'provider_export_changed')
  const renamed = structuredClone(original);renamed.payload.id='synthetic-envelope-duplicated-export'
  await data(door+'/preview',{...body,version:1,providerCapture:renamed},409)
  const overdrawn = structuredClone(correction);overdrawn.payload.lines[0].minutes=-241
  assert.equal((await data(door+'/preview',{...correctedBody,providerCapture:overdrawn},409)).error,'provider_correction_exceeds_source')
  const unapproved = structuredClone(correction);unapproved.payload.status='draft'
  assert.equal((await data(door+'/preview',{...correctedBody,providerCapture:unapproved},409)).error,'approved_provider_export_required')
  assert.equal((await data(door)).filter(row=>row.id===id).length,1,'refused captures write no input version')
  await data(door+'/apply',{...correctedBody,digest:diff.digest},201)
  await data(pay+'/earnings-run',{...run,version:1},409)
  await approve(2)
  const revised = await data(pay+'/earnings-run',{...run,version:1},201)
  // 39 actual hours at $10 plus $40 non-work pay. Held tips create no new cash.
  assert.equal(revised.preview.grossCashCents,43000)
  assert.equal(revised.preview.people.find(person=>person.id===personId).cashTipsCents,50000)
  assert.equal((await data(pay)).runs.find(row=>row.id===id && row.version===1).data.grossCashCents,48000)
  for (const capture of [correction,original]) {
    const replay = {...body,version:2,providerCapture:capture}
    const preview = await data(door+'/preview',replay)
    assert.equal((await data(door+'/apply',{...replay,digest:preview.digest},201)).replayed,true)
  }
  await data(door+'/preview',{...body,id:id+'-another-run'},409)
  await data(door+'/'+id+'/withdraw',{version:2})
  await data(pay+'/earnings-run',{...run,version:2},409)
  return {id,original}
}
