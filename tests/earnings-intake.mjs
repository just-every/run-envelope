import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { chromium } from '@playwright/test'
import { join } from 'node:path'

/** EARNINGS-INTAKE: real spreadsheets, retained differences and current exact review. */
export async function earningsIntakeJourney({origin,cookie}) {
  const call = (path,body) => fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie,origin,...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})})
  const data = async(path,body,status=200) => {
    const response=await call(path,body)
    assert.equal(response.status,status,await response.clone().text())
    return response.json()
  }
  const company=await data('/api/envelope/companies',{name:'Synthetic intake shop',ein:'00-0000942'},201)
  const base='/api/envelope/companies/'+company.id, door=base+'/pay-settings', screen=door.replace('/api/','/app/')
  const location=await data(base+'/locations',{name:'Synthetic Seattle intake',state:'WA'},201)
  const people=[]
  for (const name of ['Synthetic server held','Synthetic server paycheck','Synthetic cook']) people.push(await data(base+'/people',{name,locationId:location.id},201))
  const group={id:'synthetic-envelope-942',version:0,name:'Synthetic intake crew',people:people.map(person=>person.id)}
  const approve=async(kind,id)=>{
    const row=await data(door+'/review/'+kind+'/'+id)
    return data(door+'/'+kind+'/'+id+'/approve',{version:row.version,reviewToken:row.reviewToken})
  }
  await data(door+'/group',group,201); await approve('group',group.id)
  const change={id:'synthetic-envelope-943',version:0,name:'Synthetic hourly setup',groupId:group.id,effectiveDate:'2026-01-01',items:people.map(person=>({personId:person.id,personVersion:person.version,rateCents:2500,basis:'hourly',employmentFrom:'2026-01-01',employmentThrough:'2026-12-31',unpaidDates:[]}))}
  await data(door+'/pay-change',change,201); await approve('pay-change',change.id)
  const headers=['rowId','personId','day','code','minutes','amountCents','settlement','state','riskClass','coveredMinutes','sourceRef']
  const scope={groupId:group.id,periodStart:'2026-03-01',periodEnd:'2026-03-14'}
  const period={...scope,payDate:'2026-03-20',frequency:'biweekly'}
  const row=(id,person,code,minutes,amount,settlement='',riskClass='',covered=0)=>[id,person.id,'2026-03-02',code,minutes,amount,settlement,'WA',riskClass,covered,id+'-source']
  const book=(format,rows,customHeaders=headers)=>{
    const workbook=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([customHeaders,...rows]),'Earnings')
    return new Uint8Array(XLSX.write(workbook,{type:'array',bookType:format}))
  }
  const upload=(format,id,version,rows,extra={})=>{
    const form=new FormData()
    for(const [key,value] of Object.entries({...scope,id,version,...extra}))form.set(key,String(value))
    form.set('file',new File([book(format,rows)],'synthetic-envelope-942.'+format))
    return form
  }
  for(const format of ['csv','xls','xlsx']) {
    const template=await call(door+'/earnings-template/'+format)
    assert.equal(template.status,200)
    const templateBook=XLSX.read(new Uint8Array(await template.arrayBuffer()),{type:'array'})
    assert.deepEqual(XLSX.utils.sheet_to_json(templateBook.Sheets[templateBook.SheetNames[0]],{header:1})[0],headers)
    const id='synthetic-envelope-942-'+format
    const initial=Array.from({length:502},()=>[])
    initial[0]=row(id+'-held',people[0],'tip',0,60000,'cash')
    initial[501]=row(id+'-owed',people[1],'tip',0,30000,'paycheck')
    const runCount=(await data(door)).runs.length
    const preview=await data(door+'/intake-preview',upload(format,id,0,initial))
    assert.deepEqual(preview.diff.map(item=>[item.sourceRow,item.action,item.after.amountCents]),[[2,'create',60000],[503,'create',30000]],'late worksheet rows must not silently disappear')
    assert.equal((await data(door)).runs.length,runCount,'preview has no run side effect')
    await data(door+'/intake',upload(format,id,0,initial),201)
    const review=await data(door+'/review/run-input/'+id)
    assert.equal(review.data.rows.length,2)
    assert.equal(review.data.fileDigest.length,64)
    assert.ok(review.createdBy)
    await data(door+'/run-input/'+id+'/approve',{version:1,reviewToken:review.reviewToken})
    const retained=await data(door+'/earnings-run',{...period,id,version:0},201)
    assert.deepEqual(retained.preview.people.map(person=>[person.cashTipsCents,person.paycheckTipsCents,person.reportedTipsCents]),[[60000,0,60000],[0,30000,30000],[0,0,0]])
    assert.equal(retained.preview.grossCashCents,30000,'only paycheck tips create new cash')
    assert.equal(retained.preview.taxAmounts,null,'no invented tax calculation')
    const replay=await data(door+'/intake',upload(format,id,1,initial),201)
    assert.equal(replay.replayed,true); assert.equal(replay.version,1)
    const correction=[row(id+'-held',people[0],'tip',0,'','cash'),row(id+'-owed',people[1],'tip',0,0,'paycheck')]
    const corrected=await data(door+'/intake-preview',upload(format,id,1,correction))
    assert.deepEqual(corrected.diff.map(item=>[item.action,item.after.amountCents]),[['unchanged',60000],['change',0]],'blank preserves while explicit zero replaces')
    await data(door+'/intake',upload(format,id,1,correction),201)
    const view=await data(door)
    assert.equal(view.runs.find(run=>run.id===id).sourceStatus,'changed-repreview-required')
    assert.equal(view.runs.find(run=>run.id===id).data.grossCashCents,30000,'correction cannot overwrite frozen run')
    await approve('run-input',id)
    const second=await data(door+'/earnings-run',{...period,id,version:1},201)
    assert.equal(second.preview.grossCashCents,0)
    assert.deepEqual(second.preview.intake.diff[1].before.amountCents,30000)
    assert.deepEqual(second.preview.intake.diff[1].after.amountCents,0)
    assert.equal((await data(door+'/intake',upload(format,id+'-duplicate',0,initial),409)).error,'source_already_in_another_run')
    await data(door+'/run-input/'+id+'/withdraw',{version:2})
    const withdrawn=(await data(door)).runs.find(run=>run.id===id && run.version===2)
    assert.equal(withdrawn.sourceStatus,'changed-repreview-required','revoked source approval invalidates its exact run')
    assert.equal(withdrawn.data.grossCashCents,0,'withdrawal preserves frozen business history')
  }
  const raceId='synthetic-envelope-942-race'
  const raceRow=Object.fromEntries(headers.map((key,index)=>[key,row(raceId+'-row',people[0],'tip',0,100,'cash')[index]]))
  const race=await Promise.all([call(door+'/intake',{...scope,id:raceId+'-one',version:0,rows:[raceRow]}),call(door+'/intake',{...scope,id:raceId+'-two',version:0,rows:[raceRow]})])
  assert.deepEqual(race.map(response=>response.status).sort(),[201,409],'concurrent run assignment retains one source item only')
  const overtimeId='synthetic-envelope-942-overtime'
  const overtimeRows=[]
  for(const [week,count] of [['2026-03-02',5],['2026-03-09',3]]) for(let day=0;day<count;day++) {
    const values=row(overtimeId+'-'+week+'-'+day,people[2],'hours',600,0)
    values[2]=new Date(Date.parse(week+'T00:00:00Z')+day*86400000).toISOString().slice(0,10)
    overtimeRows.push(Object.fromEntries(headers.map((key,index)=>[key,values[index]])))
  }
  overtimeRows.push(Object.fromEntries(headers.map((key,index)=>[key,row(overtimeId+'-bonus',people[2],'bonus',0,16000)[index]])))
  const overtimeInput={...scope,id:overtimeId,version:0,workweekStart:'2026-03-01',bonusAllocation:'hours-worked',rows:overtimeRows}
  await data(door+'/intake',overtimeInput,201);await approve('run-input',overtimeId)
  const overtimeRun=await data(door+'/earnings-run',{...period,id:overtimeId,version:0},201)
  assert.equal(overtimeRun.preview.people[2].earningsCents,229500,'50 hours plus 30 hours at $25, $160 bonus, and $135 extra half-time; never average to 40')
  assert.ok(overtimeRun.preview.people[2].details.some(line=>line.includes('3000 actual minutes, 600 overtime minutes, 13500 cents')))
  assert.ok(overtimeRun.preview.people[2].details.some(line=>line.includes('1800 actual minutes, 0 overtime minutes, 0 cents')))
  const overtimeReplay=await data(door+'/intake',{...overtimeInput,version:1},201)
  assert.equal(overtimeReplay.replayed,true)
  assert.equal((await data(door)).runs.find(run=>run.id===overtimeId).data.grossCashCents,229500)
  const id='synthetic-envelope-942-manual'
  const rows=[
    row(id+'-hours',people[0],'hours',60,0),
    row(id+'-bonus',people[0],'bonus',0,10000),
    row(id+'-reimbursement',people[1],'reimbursement',0,1250),
    row(id+'-wa-one',people[0],'assessment',0,0,'','synthetic-envelope-941',105),
    row(id+'-wa-two',people[0],'assessment',0,0,'','synthetic-envelope-942',45),
    row(id+'-or',people[2],'assessment',0,0,'','',15),
    row(id+'-premium',people[2],'meal-premium',0,2500),
  ].map(values=>Object.fromEntries(headers.map((key,index)=>[key,values[index]])))
  rows[5].state='OR'
  const input={...scope,id,version:0,rows}
  assert.equal((await data(door+'/intake',{...input,rows:[{...rows[0],personId:'synthetic-envelope-unknown'}]},400)).error,'person_outside_reviewed_group')
  assert.equal((await data(door+'/intake',{...input,rows:[{...rows[0],code:'tip',settlement:''}]},400)).error,'ambiguous_tip_settlement')
  assert.equal((await data(door+'/intake',{...input,rows:[{...rows[0],code:'meal-premium'}]},400)).error,'premium_or_assessment_cannot_add_work_hours')
  await data(door+'/intake',input,201)
  await approve('run-input',id)
  const retained=await data(door+'/earnings-run',{...period,id,version:0},201)
  assert.equal(retained.preview.people[0].earningsCents,12500,'assessment hours never inflate wages')
  assert.equal(retained.preview.people[1].reimbursementCents,1250)
  assert.deepEqual(retained.preview.intake.rows.filter(row=>row.code==='assessment').map(row=>[row.state,row.riskClass,row.coveredMinutes]),[['WA','synthetic-envelope-941',105],['WA','synthetic-envelope-942',45],['OR','',15]])
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']})
  try {
    const context=await browser.newContext()
    const [name,value]=cookie.split('='); await context.addCookies([{name,value,url:origin}])
    const page=await context.newPage()
    await page.setViewportSize({width:1440,height:1000})
    await page.goto(origin+screen)
    await page.getByText('Enter manual earnings',{exact:true}).click()
    await page.getByLabel('Manual run ID',{exact:true}).fill('synthetic-envelope-942-grid')
    await page.getByLabel('Manual period start',{exact:true}).fill(scope.periodStart)
    await page.getByLabel('Manual period end',{exact:true}).fill(scope.periodEnd)
    for (const [index,code,amount,settlement] of [[0,'tip','60000','cash'],[1,'tip','30000','paycheck'],[2,'bonus','2500','']]) {
      await page.getByLabel(`Row ${index+1} ID`,{exact:true}).fill('synthetic-envelope-942-grid-'+index)
      await page.getByLabel(`Row ${index+1} worker`,{exact:true}).selectOption(people[index].id)
      await page.getByLabel(`Row ${index+1} date`,{exact:true}).fill('2026-03-02')
      await page.getByLabel(`Row ${index+1} earning code`,{exact:true}).selectOption(code)
      await page.getByLabel(`Row ${index+1} amount in cents`,{exact:true}).fill(amount)
      await page.getByLabel(`Row ${index+1} tip settlement`,{exact:true}).selectOption(settlement)
    }
    await page.getByRole('button',{name:'Review manual earnings',exact:true}).focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(origin+screen+'/review/run-input/synthetic-envelope-942-grid')
    const prepared=await data(door+'/review/run-input/synthetic-envelope-942-grid')
    assert.deepEqual(prepared.data.rows.map(row=>[row.personId,row.amountCents,row.settlement]),[[people[0].id,60000,'cash'],[people[1].id,30000,'paycheck'],[people[2].id,2500,'']])
    await page.getByRole('button',{name:'Approve this exact setup',exact:true}).focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(origin+screen)
    const grid=await data(door+'/earnings-run',{...period,id:'synthetic-envelope-942-grid',version:0},201)
    assert.equal(grid.preview.grossCashCents,32500,'manual grid pays only the owed tips and bonus')
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      await page.goto(origin+screen)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      for(const control of await page.locator('button,a').all())assert.ok((await control.textContent()).trim(),'all controls have visible words')
      await page.screenshot({path:join(process.env.ENVELOPE_PROOF_DIR??'test-results/envelope',`earnings-upload-${width}.png`),fullPage:true})
      await page.getByText('Enter manual earnings',{exact:true}).click()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'manual entry fits the viewport')
      await page.screenshot({path:join(process.env.ENVELOPE_PROOF_DIR??'test-results/envelope',`earnings-grid-${width}.png`),fullPage:true})
      await page.goto(origin+screen+'/earnings-run/'+id+'/review')
      if(width===1440) {
        const reviewText=await page.locator('main').innerText()
        for(const allocation of ['state WA, risk class synthetic-envelope-941, covered minutes 105','state WA, risk class synthetic-envelope-942, covered minutes 45','state OR, risk class not supplied, covered minutes 15']) assert.ok(reviewText.includes(allocation),'exact retained assessment allocation: '+allocation)
      }
      await page.screenshot({path:join(process.env.ENVELOPE_PROOF_DIR??'test-results/envelope',`earnings-assessment-review-${width}.png`),fullPage:true})
    }
  } finally {await browser.close()}
  console.log('EARNINGS-INTAKE passed: all three spreadsheet formats retain rows 2 and 503; blank and zero, replay, correction, immutable runs, exact source approval, typed tip cash and report basis, premiums and fractional assessment hours; selected screens 1440 and 390. Tax calculation and payment remain unavailable.')
}
