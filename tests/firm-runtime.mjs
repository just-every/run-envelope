import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { firmFixture } from './firm-fixture.mjs'

export async function firmJourney(context) {
  const {origin,cookie,sql}=context
  const f=await firmFixture(context),{data,call,clients,people,owner,period,signIn}=f
  const dashboard=await data('/api/envelope/firm',undefined,200,people.firm.cookie)
  assert.equal(dashboard.clients.length,20)
  assert.ok(!JSON.stringify(dashboard).includes(clients[20].name),'ungranted client is absent')
  assert.equal(dashboard.clients.find(c=>c.id===clients[19].id).payrollVisible,false)
  assert.equal(dashboard.clients.find(c=>c.id===clients[0].id).registrations[0].registration,'pending')
  assert.ok(!JSON.stringify(dashboard).includes('accountNumber'))
  const due=await data('/api/envelope/firm?due=today&day=2026-10-30&kind=notice',undefined,200,people.firm.cookie)
  assert.equal(due.clients.length,10)
  const dueRuns=await data('/api/envelope/firm?due=today&day=2026-10-30&kind=run',undefined,200,people.firm.cookie)
  assert.equal(dueRuns.clients.length,19);assert.ok(dueRuns.clients.every(c=>c.runs.every(r=>r.payDate===period.payDate)))
  assert.ok(due.clients.every(c=>c.work.every(w=>w.data.dueDate==='2026-10-30')))
  const denied=clients[20],first=clients[0],second=clients[1],third=clients[2]
  const batch={...period,requestKey:'synthetic-envelope-2904',selections:[first,second,clients[19],denied].map(c=>`${c.id}:${c.groupId}:1`)}
  const result=await data('/api/envelope/firm/prepare',batch,200,people.firm.cookie)
  assert.deepEqual(result.outcomes.map(o=>o.state),['prepared','prepared','refused','refused'])
  const replay=await data('/api/envelope/firm/prepare',batch,200,people.firm.cookie)
  assert.deepEqual(replay.outcomes.map(o=>o.state),['already-prepared','already-prepared','refused','refused'])
  assert.equal((await sql("SELECT COUNT(*) AS n FROM env_workspace_versions WHERE kind='earnings-run' AND object_id LIKE 'firm-%'"))[0].n,2)
  const altered=await data('/api/envelope/firm/prepare',{...batch,payDate:'2026-11-06'},200,people.firm.cookie)
  assert.equal(altered.outcomes[0].error,'preparation_key_reused')
  const run=result.outcomes[0], runPath=first.base+'/pay-settings/earnings-run/'+run.id
  const review=await data(runPath+'/review',undefined,200,people.firm.cookie)
  await data(runPath+'/approve',{version:review.version,reviewToken:review.reviewToken},200,people.firm.cookie)
  assert.equal((await call(second.base+'/pay-settings/earnings-run/'+run.id+'/approve',{version:review.version,reviewToken:review.reviewToken},people.firm.cookie)).status,404)
  assert.equal((await call(clients[19].base+'/pay-settings/earnings-run/'+clients[19].run.id+'/review',undefined,people.firm.cookie)).status,403)
  const secondRunPath=second.base+'/pay-settings/earnings-run/'+result.outcomes[1].id
  const secondReview=await data(secondRunPath+'/review',undefined,200,people.firm.cookie)
  await data(secondRunPath+'/approve',{version:secondReview.version,reviewToken:secondReview.reviewToken},200,people.firm.cookie)
  const before=(await sql('SELECT COUNT(*) AS n FROM env_run_approvals'))[0].n
  const blocked=await call(runPath+'/release',{version:review.version},people.firm.cookie)
  assert.equal(blocked.status,409);assert.equal((await blocked.json()).error,'run_not_payable')
  assert.equal((await sql('SELECT COUNT(*) AS n FROM env_run_approvals'))[0].n,before)
  const badTask=await call(first.base+'/firm-work',{workKind:'notice',sourceId:denied.notice.id,sourceVersion:1,title:'Foreign notice',details:'No write',dueDate:period.payDate,dueTime:'16:00',timeZone:'America/New_York',evidenceRef:'synthetic-envelope-2905',assigneeId:people.firm.id},people.firm.cookie)
  assert.equal(badTask.status,400)
  const delegate=await data(first.base+'/firm-work/'+first.task.id+'/delegate',{version:1,assigneeId:people.backup.id,backupId:owner},200,people.firm.cookie)
  assert.equal(delegate.version,2)
  const invalid=await call(first.base+'/firm-work/'+first.task.id+'/delegate',{version:2,assigneeId:people.stranger.id},people.firm.cookie)
  assert.equal(invalid.status,409)
  assert.equal((await data(first.base+'/firm-work/'+first.task.id,undefined,200,people.firm.cookie)).item.version,2)
  let blotter
  const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(proof,{recursive:true})
  try {
    const contexts={}
    for(const [name,session] of [['owner',cookie],['firm',people.firm.cookie],['backup',people.backup.cookie],['stranger',people.stranger.cookie]]){
      contexts[name]=await browser.newContext({ignoreHTTPSErrors:true});const [key,value]=session.split('=');await contexts[name].addCookies([{name:key,value,url:origin}])
    }
    const pages=Object.fromEntries(await Promise.all(Object.entries(contexts).map(async([name,c])=>[name,await c.newPage()])))
    const capture=async(label,path,who='firm')=>{
      const page=pages[who]
      for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(origin+path);await page.evaluate(()=>document.fonts.ready);if(label.includes('handover'))await page.getByText('Handover history',{exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label);for(const control of await page.locator('button,a,summary').all())if(await control.isVisible())assert.ok((await control.innerText()).trim(),label+' visible control: '+await control.evaluate(el=>el.outerHTML));await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),'BODY');await page.screenshot({path:join(proof,`${label}-${width}.png`),fullPage:!['firm-loaded','firm-filtered','firm-company-settings'].includes(label)})}
      return page
    }
    await capture('firm-empty','/app/envelope/firm','stranger')
    await capture('firm-company-settings','/app/envelope','owner')
    await capture('firm-loaded','/app/envelope/firm')
    let page=await capture('firm-filtered','/app/envelope/firm?due=today&day=2026-10-30&kind=notice')
    assert.equal(await page.getByText(clients[20].name,{exact:true}).count(),0)
    const preparation=pages.firm
    for(const width of [1440,390]) {
      await preparation.setViewportSize({width,height:1000});await preparation.goto(origin+'/app/envelope/firm')
      for(const c of [first,second]) await preparation.getByRole('group',{name:c.name,exact:true}).getByRole('checkbox').check()
      await preparation.getByLabel('Period start',{exact:true}).fill(period.periodStart);await preparation.getByLabel('Period end',{exact:true}).fill(period.periodEnd);await preparation.getByLabel('Pay date',{exact:true}).fill(period.payDate)
      await preparation.getByRole('button',{name:'Prepare selected drafts',exact:true}).scrollIntoViewIfNeeded();await preparation.screenshot({path:join(proof,`firm-batch-selected-${width}.png`)})
      await preparation.getByRole('button',{name:'Prepare selected drafts',exact:true}).click();await preparation.waitForURL(origin+'/app/envelope/firm/prepare')
      await preparation.getByRole('heading',{name:'Preparation results',exact:true}).scrollIntoViewIfNeeded();assert.equal(await preparation.getByRole('status').getByRole('link').count(),2);await preparation.screenshot({path:join(proof,`firm-batch-prepared-${width}.png`)})
    }
    await capture('firm-work-list',first.base.replace('/api/','/app/')+'/firm-work')
    page=await capture('firm-exact-client-review',runPath.replace('/api/','/app/')+'/review','backup');await page.getByRole('heading',{name:'Review an exact run version',exact:true}).waitFor()
    for(const [kind,sourceKind,sourceId] of [['funding','earnings-run',first.run.id],['filing','registration','STATE-WH']]) {
      page=await capture('firm-assign-'+kind,first.base.replace('/api/','/app/')+'/firm-work?sourceKind='+sourceKind+'&sourceId='+sourceId+'&sourceVersion=1')
      await page.getByLabel('Work type',{exact:true}).selectOption(kind)
      await page.getByLabel('Work to do',{exact:true}).fill('Review '+kind+' deadline')
      await page.getByLabel('Handover notes',{exact:true}).fill('Check the sourced deadline and current client authority before any action.')
      await page.getByLabel('Due date',{exact:true}).fill(period.payDate);await page.getByLabel('Due time',{exact:true}).fill('16:00')
      await page.getByLabel('Deadline source reference',{exact:true}).fill('Client reviewed October '+kind+' instruction')
      await page.getByLabel('Responsible person',{exact:true}).selectOption(people.firm.id);await page.getByLabel('Backup person',{exact:true}).selectOption(owner)
      await page.getByRole('button',{name:'Assign this work',exact:true}).click();await page.waitForURL(/\/firm-work\/[^/?]+$/)
      assert.ok((await page.locator('main').innerText()).includes('Jordan Lee'))
    }
    const assigned=await data(first.base+'/firm-work',undefined,200,people.firm.cookie)
    assert.ok(assigned.some(w=>w.workKind==='funding'&&w.sourceId===first.run.id));assert.ok(assigned.some(w=>w.workKind==='filing'&&w.sourceId==='STATE-WH'))
    let jobUrl='https://blotter.example.com/app?job=synthetic-envelope-2906'
    if(process.env.ENVELOPE_BLOTTER_WORKTREE){
      const previous=process.cwd();process.chdir(process.env.ENVELOPE_BLOTTER_WORKTREE)
      try{const {harness}=await import(join(process.cwd(),'./tests/blotter/harness.mjs'));blotter=await harness()
        const client=await blotter.json('/clients',{name:first.name,abn:'10 000 000 001',contactName:'Rosa Perez',contactEmail:'rosa@example.test'},blotter.owner)
        const template=await blotter.json('/templates',{name:'Payroll inquiry follow-up',recurrence:'monthly',steps:'Review Envelope source',requests:'Protected Envelope notice source',feeCents:0},blotter.owner)
        const job=await blotter.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2026-10-01',dueDate:period.payDate,dueNote:'Envelope agency notice deadline',preparerEmail:'owner@example.test',reviewerEmail:'owner@example.test'},blotter.owner)
        await blotter.json('/jobs/'+job.id+'/threads',{title:'Envelope notice handoff',body:'Client '+first.name+'; due '+period.payDate+'; private source '+origin+first.base.replace('/api/','/app/')+'/notices/'+first.notice.id,anchor:'job',mentions:[]},blotter.owner)
        jobUrl=blotter.origin+'/app?job='+job.id
        for(const entry of blotter.owner.split('; ')){const [name,value]=entry.split('=');await contexts.firm.addCookies([{name,value,url:blotter.origin}])}
        const setupPage=await contexts.firm.newPage();await setupPage.goto(blotter.origin+'/setup');await setupPage.getByRole('checkbox').check();await setupPage.getByRole('button',{name:'Finish setup',exact:true}).click();await setupPage.waitForURL(blotter.origin+'/app');await setupPage.close()
      }finally{process.chdir(previous)}
    }
    const app=first.base.replace('/api/','/app/'),workPath=app+'/firm-work/'+first.task.id
    page=await capture('firm-handoff-settings',app+'/firm-settings','owner')
    await page.getByLabel('Your Blotter website').fill(new URL(jobUrl).origin);await page.getByRole('button',{name:'Save destination',exact:true}).click();await page.waitForURL(origin+app+'/firm-settings')
    page=await capture('firm-delegated',workPath)
    await page.getByLabel('Blotter job link').fill(jobUrl);await page.getByLabel('Receiving person').selectOption(people.backup.id);await page.getByLabel('Handoff reference').fill('Blotter payroll inquiry discussion');await page.getByRole('button',{name:'Record pending handoff',exact:true}).click();await page.waitForURL(origin+workPath)
    await capture('firm-handoff-pending',workPath)
    if(blotter){const popup=contexts.firm.waitForEvent('page');await pages.firm.getByRole('link',{name:'Open recorded Blotter job',exact:true}).click();const target=await popup;await target.waitForLoadState();assert.equal(new URL(target.url()).searchParams.get('job'),new URL(jobUrl).searchParams.get('job'));await target.getByRole('heading',{name:first.name+' · Payroll inquiry follow-up',exact:true}).waitFor();assert.ok((await target.locator('body').innerText()).includes(first.name));await target.setViewportSize({width:390,height:1000});await target.screenshot({path:join(proof,'firm-blotter-job-390.png'),fullPage:true});await target.setViewportSize({width:1440,height:1000});await target.screenshot({path:join(proof,'firm-blotter-job-1440.png'),fullPage:true});await target.close();console.log('Native Blotter handoff followed through the built sibling.')}
    const pending=(await data(first.base+'/firm-work/'+first.task.id,undefined,200,people.firm.cookie)).item
    assert.equal((await call(first.base+'/firm-work/'+first.task.id+'/acknowledge',{version:pending.version,evidenceRef:'Not the recipient'},people.firm.cookie)).status,403)
    page=await capture('firm-receiving',workPath,'backup');await page.getByLabel('Receipt reference').fill('Reviewed the assigned Blotter discussion');await page.getByRole('button',{name:'I received this work',exact:true}).click();await page.waitForURL(origin+workPath);await capture('firm-handoff-acknowledged',workPath,'backup')
    const current=(await data(first.base+'/firm-work/'+first.task.id,undefined,200,people.backup.cookie)).item
    assert.equal(current.status,'acknowledged')
    assert.equal((await call(first.base+'/firm-work/'+first.task.id+'/handoff',{version:current.version,jobUrl:'https://outside.example.com/app?job=synthetic-envelope-2906',recipientId:people.backup.id,evidenceRef:'Wrong destination'},people.firm.cookie)).status,400)
    await data(second.base+'/grants',{operatorId:people.firm.id,version:1,revoke:true})
    assert.equal((await call(secondRunPath+'/release',{version:1},people.firm.cookie)).status,401)
    const transferred=await data(second.base+'/firm-work/'+second.task.id)
    assert.equal((await sql(`SELECT approver_id FROM env_run_approvals WHERE company_id='${second.id}' AND run_id='${result.outcomes[1].id}'`))[0].approver_id,people.firm.id,'handover does not transfer historical approval');
    assert.equal(transferred.item.assigneeId,owner);assert.equal(transferred.history.at(-1).event,'authority.reassigned')
    await signIn(people.firm)
    assert.equal((await call(secondRunPath+'/release',{version:1},people.firm.cookie)).status,403)
    assert.equal((await data('/api/envelope/firm',undefined,200,people.firm.cookie)).clients.length,19)
    const removed=await call('/auth/operator/status',{operatorId:people.backup.id,status:'inactive'});assert.equal(removed.status,200,await removed.clone().text())
    const handover=await data(first.base+'/firm-work/'+first.task.id)
    assert.equal(handover.item.assigneeId,owner);assert.equal(handover.item.status,'recipient-changed');assert.equal(handover.history.at(-1).assigneeName, (await sql(`SELECT display_name FROM oa_operators WHERE id='${owner}'`))[0].display_name)
    assert.equal((await call(first.base+'/firm-work/'+first.task.id,undefined,people.backup.cookie)).status,401)
    await capture('firm-staff-handover',workPath,'owner');await capture('firm-mandate-handover',second.base.replace('/api/','/app/')+'/firm-work/'+second.task.id,'owner')
    assert.equal((await call('/api/envelope/firm',undefined,'')).status,401)
  }finally{await browser.close();await blotter?.close()}
  console.log('Firm journey: 20 clients, scoped batch and exact approvals, deadline filtering, human handoff, revocation and named staff handover passed.')
}
