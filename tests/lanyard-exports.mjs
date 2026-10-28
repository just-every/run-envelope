import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// One employer journey: import allocated work and non-work pay, then reconcile an exported correction.
export async function lanyardExportCases({data, door, pay, personId, origin, cookie}) {
  const id = 'synthetic-envelope-lanyard-allocated', account = 'synthetic-envelope-lanyard-allocations'
  const worker = 'synthetic-envelope-allocated-worker', root = 'synthetic-envelope-allocated-root'
  const approval = {by:'synthetic-envelope-source-owner',at:'2026-11-09T12:00:00Z',reason:'Reviewed source correction'}
  const mapping = {sourcePersonId:worker,personId,day:'2026-11-02',workweek:'2026-11-02',settlement:'cash',code:'other-earning'}
  const original = {provider:'lanyard',account,reconciliation:'signed-exports',evidence:'synthetic-envelope-approved-batch',
    payload:{id:'synthetic-envelope-original-export',revision:2,status:'exported',exportedBy:approval.by,exportedAt:approval.at,lines:[]},mappings:{}}
  const lines = original.payload.lines
  for (const [job,minutes] of [['Kitchen',240],['Floor',240]])
    lines.push({rootId:root,timeId:'synthetic-envelope-original-time',revision:5,payrollId:worker,
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
  lines.push({sickUseId:'synthetic-envelope-allocated-sick',sickLine:true,revision:1,payrollId:worker,
    start:'2026-11-02T12:00:00Z',minutes:120,costCents:2000,payCode:'Reviewed sick leave'},
    {holidayPayId:'synthetic-envelope-allocated-holiday',holidayLine:true,revision:1,payrollId:worker,
      start:'2026-11-02T12:00:00Z',minutes:180,costCents:3000,payCode:'Reviewed holiday pay'},
    {rootId:root,timeId:'synthetic-envelope-original-time',differentialLine:true,revision:5,payrollId:worker,
      start:'2026-11-02T09:00:00Z',minutes:480,costCents:1000,payCode:'Reviewed shift differential'})
  original.mappings['synthetic-envelope-allocated-sick'] = mapping
  original.mappings['synthetic-envelope-allocated-holiday'] = mapping
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
  assert.equal(first.preview.grossCashCents,54000)
  assert.equal(first.preview.people.find(person=>person.id===personId).cashTipsCents,60000)
  const correction = structuredClone(original)
  correction.payload.id = 'synthetic-envelope-corrected-export'
  correction.payload.lines = [
    ...[['Kitchen',-120],['Floor',60]].map(([job,minutes])=>({rootId:root,timeId:'synthetic-envelope-corrected-time',
      corrects:'synthetic-envelope-original-time',revision:2,payrollId:worker,start:'2026-11-02T09:00:00Z',
      end:'2026-11-02T16:00:00Z',minutes,job,area:job,site:'synthetic-envelope-site'})),
    {payInputId:'synthetic-envelope-allocated-PTO',revision:2,payrollId:worker,start:'2026-11-02T12:00:00Z',
      minutes:-240,costCents:-4000,payCode:'PTO',approval},
    {payInputId:'synthetic-envelope-allocated-tips',revision:2,payrollId:worker,start:'2026-11-02T12:00:00Z',
      minutes:0,costCents:-10000,payCode:'tips',approval},
    {...lines.find(line=>line.sickLine),revision:2,minutes:-60,costCents:-1000},
    {...lines.find(line=>line.holidayPayId),revision:2,minutes:-180,costCents:-3000},
    {...lines.find(line=>line.differentialLine),timeId:'synthetic-envelope-corrected-time',corrects:'synthetic-envelope-original-time',
      revision:2,minutes:-60,costCents:500},
  ]
  correction.mappings = {'synthetic-envelope-corrected-time':mapping,
    'synthetic-envelope-allocated-PTO':mapping,'synthetic-envelope-allocated-tips':mapping,
    'synthetic-envelope-allocated-sick':mapping,'synthetic-envelope-allocated-holiday':mapping}
  const correctedBody = {...body,version:1,providerCapture:correction}
  const diff = await data(door+'/preview',correctedBody)
  assert.deepEqual(diff.data.rows.filter(row=>row.job).map(row=>[row.job,row.minutes]).sort(),[['Floor',300],['Kitchen',120]])
  assert.equal(diff.data.rows.find(row=>row.sourceId==='synthetic-envelope-allocated-PTO:PTO').amountCents,4000)
  assert.deepEqual(diff.data.rows.filter(row=>row.code==='paid-leave').map(row=>[row.minutes,row.amountCents]).sort((a,b)=>a[0]-b[0]),
    [[0,0],[60,1000],[240,4000]],'sick and holiday corrections preserve non-work entitlements without adding worked hours')
  assert.deepEqual(diff.data.rows.filter(row=>row.code==='other-earning').map(row=>[row.minutes,row.amountCents]),[[0,1500]],
    'a differential carries additional money without duplicating its source worked minutes')
  assert.equal(diff.data.rows.find(row=>row.code==='tip').amountCents,50000)
  assert.deepEqual(diff.cells.filter(cell=>cell.field==='minutes' && cell.status==='change').map(cell=>[cell.before,cell.after]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
    [[120,60],[180,0],[240,120],[240,300],[480,240]])
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
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']})
  try {
    const context = await browser.newContext()
    const separator = cookie.indexOf('=')
    await context.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:origin}])
    const page = await context.newPage(), screen = door.replace('/api/','/app/')
    await page.setViewportSize({width:1440,height:1000})
    await page.goto(origin+screen)
    const form = page.locator('form').filter({has:page.getByRole('button',{name:'Preview exact cell changes',exact:true})})
    await form.locator('[name="id"]').fill(id)
    await form.locator('[name="version"]').fill('1')
    await page.getByText('Import reviewed provider data',{exact:true}).click()
    await form.locator('[name="providerCapture"]').fill(JSON.stringify(correction))
    await page.getByRole('button',{name:'Preview exact cell changes',exact:true}).click()
    await page.waitForURL(origin+screen+'/preview')
    assert.match(await page.locator('main').innerText(),/240\s*→\s*120/)
    const proof = process.env.ENVELOPE_PROOF_DIR ?? './test-results/envelope'
    await mkdir(proof,{recursive:true})
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      await page.screenshot({path:join(proof,'run-intake-source-correction-'+width+'.png'),fullPage:true})
    }
    await page.setViewportSize({width:1440,height:1000})
    await page.getByRole('button',{name:'Apply these exact changes',exact:true}).focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(origin+screen)
    assert.equal((await data(door)).filter(row=>row.id===id).length,2,'the native preview form applies the exact correction once')
  } finally { await browser.close() }
  await data(pay+'/earnings-run',{...run,version:1},409)
  await approve(2)
  const revised = await data(pay+'/earnings-run',{...run,version:1},201)
  // 39 hours at $10, $40 PTO, $10 sick pay and $15 differential. Holiday pay is zero.
  // Held tips create no new cash, and neither non-work nor differential minutes create hours.
  assert.equal(revised.preview.grossCashCents,45500)
  assert.equal(revised.preview.people.find(person=>person.id===personId).cashTipsCents,50000)
  assert.equal((await data(pay)).runs.find(row=>row.id===id && row.version===1).data.grossCashCents,54000)
  for (const capture of [correction,original]) {
    const replay = {...body,version:2,providerCapture:capture}
    const preview = await data(door+'/preview',replay)
    assert.equal((await data(door+'/apply',{...replay,digest:preview.digest},201)).replayed,true)
  }
  await data(door+'/preview',{...body,id:id+'-another-run'},409)
  const reallocated = structuredClone(original)
  reallocated.payload.lines = [{...reallocated.payload.lines[0],job:'Patio',area:'Patio',minutes:480}]
  const duplicate = {id:id+'-new-allocation',version:0,providerCapture:reallocated}
  for (const action of ['preview','apply'])
    assert.equal((await data(door+'/'+action,duplicate,409)).error,'source_already_assigned_to_run',
      'changing only job allocation cannot move one source entitlement into another run')
  // A premium can receive a renewed decision while its enclosing timesheet is unchanged.
  const premiumId = 'synthetic-envelope-renewed-premium', premiumTime = premiumId+'-time'
  const premiumOriginal = {provider:'lanyard',account:premiumId,reconciliation:'signed-exports',
    evidence:'synthetic-envelope-reviewed-premium',mappings:{[premiumTime]:mapping},
    payload:{id:premiumId+'-original',revision:2,status:'exported',exportedBy:approval.by,exportedAt:approval.at,
      lines:[{timeId:premiumTime,rootId:premiumTime,revision:3,payrollId:worker,start:'2026-11-02T09:00:00Z',
        premiumLine:true,premiumInputId:premiumId+'-decision',premiumRevision:1,ruleId:premiumId+'-rule',ruleRevision:1,
        kind:'reporting',date:'2026-11-02',payCode:'Reporting premium',minutes:60,costCents:500}]}}
  const premiumChanged = structuredClone(premiumOriginal)
  premiumChanged.payload.id = premiumId+'-correction'
  Object.assign(premiumChanged.payload.lines[0],{premiumRevision:2,minutes:-30,costCents:-200})
  for (const [version,capture,total] of [[0,premiumOriginal,500],[1,premiumChanged,300]]) {
    const body = {id:premiumId,version,providerCapture:capture}
    const preview = await data(door+'/preview',body)
    assert.deepEqual(preview.data.rows.map(row=>[row.minutes,row.amountCents]),[[0,total]])
    await data(door+'/apply',{...body,digest:preview.digest},201)
    const review = await data(door+'/'+premiumId+'/review')
    await data(door+'/'+premiumId+'/approve',{version:version+1,reviewToken:review.reviewToken})
    assert.equal((await data(pay+'/earnings-run',{...run,id:premiumId,version},201)).preview.grossCashCents,total)
  }
  assert.equal((await data(pay)).runs.find(row=>row.id===premiumId && row.version===1).data.grossCashCents,500)
  const stalePremium = structuredClone(premiumOriginal);stalePremium.payload.id= premiumId+'-stale'
  assert.equal((await data(door+'/preview',{id:premiumId,version:2,providerCapture:stalePremium},409)).error,'provider_correction_history_required')
  await data(door+'/'+premiumId+'/withdraw',{version:2})
  await data(pay+'/earnings-run',{...run,id:premiumId,version:2},409)
  await data(door+'/'+id+'/withdraw',{version:2})
  await data(pay+'/earnings-run',{...run,version:2},409)
  return {id,original,premiumId,premiumOriginal}
}
