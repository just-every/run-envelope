import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function archiveErasure(context, fixture) {
  const { worker, origin, cookie } = context
  const company = '/api/envelope/companies/' + fixture.companies[0]
  const call = (path, body, headers = {}) => worker.fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { cookie, origin, 'content-type': ['application', 'json'].join('/'), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const audit = async () => (await (await call(company + '/audit')).json()).filter(event => event.action === 'privacy.worker.erased')
  const invited=await call('/auth/invite',{email:'synthetic-envelope-privacy-viewer@example.com',displayName:'Synthetic custody viewer',role:'member'})
  assert.equal(invited.status,202)
  const invitation=new URL(context.edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;','&'))
  const confirmed=await call('/auth/confirm',{token:invitation.searchParams.get('token')},{cookie:''})
  assert.equal(confirmed.status,303)
  const viewerCookie=confirmed.headers.get('set-cookie').split(';')[0]
  const viewer=(await (await call('/auth/session',undefined,{cookie:viewerCookie})).json()).operator
  const graphReceipts=[]
  for(const graph of fixture.privacyGraphs) {
    const base='/api/envelope/companies/'+graph.companyId,privacy=base+'/people/'+graph.personId+'/privacy'
    const inventory=await (await call(privacy)).json()
    assert.equal(inventory.status,'held')
    assert.equal((await call(base+'/grants',{operatorId:viewer.id,version:0,role:'accountant',locations:['*'],fields:['tax','compensation','ssn'],actions:['records:read','private:read','export']})).status,200)
    assert.equal((await call(base+'/people/'+graph.personId,undefined,{cookie:viewerCookie})).status,200,'current ordinary grant reads worker before the request')
    for(const id of graph.objects) assert.ok(inventory.retained.some(r=>r.table==='env_workspace_versions'&&r.key.object_id===id),'the complete payroll and claim derivative is retained')
    if(graph.kind==='payroll') {
      for(const table of ['env_rate_proposals','env_run_drafts','env_firm_work','env_firm_work_history']) assert.ok(inventory.retained.some(r=>r.table===table),'rate, agent draft and firm history share the dependency graph')
    }
    if(graph.kind==='claim') assert.ok(inventory.retained.filter(r=>r.table==='env_workspace_versions'&&r.key.object_id===graph.claimId).length>=3,'initial claim request and later artifact versions share one erasure scope')
    assert.equal((await call(privacy+'/request',{consent:true,fingerprint:inventory.fingerprint})).status,200)
    for(const path of [base,base+'/people/'+graph.personId,base+'/people/'+graph.personId+'/private/ssn',base+'/export',base+'/pay-settings',base+'/people/'+graph.personId+'/allocations',base+'/people/'+graph.personId+'/hris',base+'/people/'+graph.personId+'/earnings-sources',base+'/people/'+graph.personId+'/leave',base+'/people/'+graph.personId+'/verification',base+'/people/'+graph.personId+'/industry',base+'/industry-returns',base+'/claims',base+'/drafts',base+'/providers',base+'/notices',base+'/grants',base+'/audit',base+'/setup',base+'/privacy-requests']) assert.equal((await call(path,undefined,{cookie:viewerCookie})).status,403,'held data denies every ordinary viewer read door')
    const requests=await (await call(base+'/privacy-requests')).json()
    assert.equal(requests.length,1);assert.equal(requests[0].status,'held')
    graphReceipts.push({base,id:requests[0].id,graph,privacy,inventory})
  }
  const browserProof=async(state,url,expected,fail=false) => {
    const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
    try {
      const session=await browser.newContext({ignoreHTTPSErrors:true})
      const separator=cookie.indexOf('=')
      await session.addCookies([{name:cookie.slice(0,separator),value:cookie.slice(separator+1),url:origin,secure:true}])
      const page=await session.newPage(),proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope'
      await mkdir(proof,{recursive:true})
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000})
        await page.goto(origin+url)
        assert.match(await page.locator('main').innerText(),expected)
        const details=page.locator('details').first()
        if(await details.count()) {
          await details.locator('summary').focus();await page.keyboard.press('Enter')
          assert.equal(await details.getAttribute('open'),'','keyboard opens the exact retained field set')
          assert.match(await details.innerText(),/Earliest release UTC/)
          await page.keyboard.press('Enter')
        }
        if(fail) {
          const form=page.locator('form[action$="/release"]')
          await form.locator('details').first().locator('summary').click()
          await form.locator('input[name="records"]').first().check()
          await form.getByLabel('Lawful release reason').fill('Synthetic attempted release before legal classification')
          await form.locator('input[name="consent"]').check()
          await Promise.all([page.waitForURL(url=>url.pathname.endsWith('/privacy/release')),form.getByRole('button',{name:'Release selected holds'}).click()])
          assert.match(await page.locator('[role="alert"]').innerText(),/hold not releasable/)
          assert.match(await page.locator('main').innerText(),/No action completed/)
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,state+' fits '+width)
        for(const control of await page.locator('button,a,summary').all()) if(await control.isVisible())assert.ok((await control.innerText()).trim(),'privacy controls have visible labels')
        await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY')
        await page.screenshot({path:join(proof,'privacy-'+state+'-'+width+'.png'),fullPage:true})
      }
    } finally {await browser.close()}
  }
  await browserProof('empty',company.replace('/api/','/app/')+'/privacy-requests',/No erasure requests/)
  for(const receipt of graphReceipts) {
    const {base,privacy,inventory,graph}=receipt
    await browserProof(graph.kind+'-held',privacy.replace('/api/','/app/'),/Local inventory: held/)
    await browserProof(graph.kind+'-failed',privacy.replace('/api/','/app/'),/Local inventory: held/,true)
    const select={fingerprint:inventory.fingerprint,records:inventory.retained.map(r=>r.id),consent:true,
      legalBasis:'Synthetic reviewed statutory release; no active legal hold remains.',custodian:'Native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
    assert.equal((await call(privacy+'/release',select)).status,409,'unclassified mixed data cannot be released')
    assert.equal((await call(privacy+'/retain',select)).status,200)
    assert.equal((await call(privacy+'/release',select)).status,200)
    const started=Date.now(),erased=await call(base+'/people/'+graph.personId+'/erase',{version:inventory.version,...select})
    assert.equal(erased.status,200,await erased.clone().text())
    assert.ok(Date.now()-started<300000)
    for(const path of [base+'/people/'+graph.personId,base+'/people/'+graph.personId+'/industry',base+'/people/'+graph.personId+'/verification'])assert.equal((await call(path)).status,404,'erased worker reads refuse')
    if(graph.kind==='claim') {
      assert.equal((await call(base+'/claims/'+graph.claimId)).status,404)
      for(const id of graph.artifactIds)assert.equal((await call(base+'/claims/'+graph.claimId+'/artifacts/'+id)).status,404,'claim original bytes are absent')
      assert.equal((await call(base+'/claims/import',graph.request)).status,409,'a retired claim request cannot recreate its encrypted originals')
    } else {
      assert.ok(!(await (await call(base+'/firm-work')).json()).some(r=>r.id===graph.workId))
      assert.ok(!(await (await call(base+'/drafts')).json()).some(r=>r.id===graph.draftId))
      const agentAudit=await (await call(base+'/agents/access')).json()
      assert.ok(!agentAudit.some(r=>r.targetId===graph.draftId||r.target_id===graph.draftId),'permanent agent actions anonymize erased draft targets')
      const returns=await (await call(base+'/industry-returns')).json()
      assert.ok(!returns.some(r=>graph.objects.includes(r.id)))
      assert.equal((await call(base+'/industry-returns/'+graph.objects[1]+'/download')).status,404)
    }
    const completed=await (await call(base+'/privacy-requests')).json()
    assert.equal(completed[0].id,receipt.id);assert.equal(completed[0].status,'completed');assert.equal(completed[0].personId,null)
    assert.ok(completed[0].recordsDeleted>10)
    await browserProof(graph.kind+'-completed',base.replace('/api/','/app/')+'/privacy-requests',/completed/)
    const events=await (await call(base+'/audit')).json()
    assert.ok(!events.some(e=>[graph.personId,...graph.objects].includes(e.targetId)),'all erased graph audit targets are anonymous')
  }
  const sharedBase='/api/envelope/companies/'+fixture.heldShared.companyId
  const sharedInventories=await Promise.all(fixture.heldShared.people.map(async person=>(await call(sharedBase+'/people/'+person+'/privacy')).json()))
  const sharedRecord=sharedInventories[1].retained.find(r=>r.table==='env_notices'&&r.key.id===fixture.heldShared.noticeId)
  assert.ok(sharedRecord,'the other worker can identify the exact jointly retained notice')
  assert.ok(sharedInventories[0].retained.some(r=>r.id===sharedRecord.id),'both inventories identify the same shared statutory record')
  const sharedGate={fingerprint:sharedInventories[1].fingerprint,records:[sharedRecord.id],consent:true,legalBasis:'Synthetic active statutory hold for the other worker',custodian:'Native owner',earliestReleaseAt:'9999-12-31T00:00:00.000Z'}
  assert.equal((await call(sharedBase+'/people/'+fixture.heldShared.people[1]+'/privacy/retain',sharedGate)).status,200)
  const sharedSelection={...sharedGate,fingerprint:sharedInventories[0].fingerprint,records:sharedInventories[0].retained.map(r=>r.id),earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
  const sharedPrivacy=sharedBase+'/people/'+fixture.heldShared.people[0]+'/privacy'
  assert.equal((await call(sharedPrivacy+'/retain',sharedSelection)).status,200)
  assert.equal((await call(sharedPrivacy+'/release',sharedSelection)).status,409,'one worker cannot release the other worker statutory gate on shared notice evidence')
  assert.equal((await call(sharedBase+'/people/'+fixture.heldShared.people[0]+'/erase',{version:1,...sharedSelection})).status,409,'shared held evidence prevents the complete deletion transaction')
  const stillHeld=await (await call(sharedPrivacy)).json()
  assert.equal(stillHeld.retained.find(r=>r.id===sharedRecord.id).earliestReleaseAt,'9999-12-31T00:00:00.000Z')
  assert.equal((await call(sharedBase+'/notices/'+fixture.heldShared.noticeId)).status,200,'refused shared erasure preserves the original evidence')
  for(const person of fixture.heldShared.people) assert.equal((await call(sharedBase+'/people/'+person)).status,200,'refused shared erasure preserves both worker identities')
  const initial = await audit()
  const door = company + '/people/' + fixture.unusedId + '/erase'
  assert.equal((await call(door, { version: 1 })).status, 400, 'unused-worker erasure requires explicit owner consent')
  assert.equal((await call(door, { version: 1, consent: true }, { authorization: 'Bearer ' + fixture.authority.agentToken })).status, 403,
    'a working scoped bearer cannot authorize erasure alongside an owner cookie')
  const retained = await call(company + '/people/' + fixture.retainedPersonId + '/erase', { version: 1, consent: true })
  assert.equal(retained.status, 409)
  assert.deepEqual(await retained.json(), { error: 'erasure_retention_review_required' })
  assert.equal((await call(company + '/people/' + fixture.retainedPersonId)).status, 200, 'payroll-dependent records remain held for retention review')
  assert.equal((await call(door, { version: 2, consent: true })).status, 409, 'an obsolete worker version cannot erase current data')
  assert.deepEqual(await audit(), initial, 'refused privacy requests publish no erasure audit event')
  const privacyDoor = company + '/people/' + fixture.privacyPersonId + '/privacy'
  const getPrivacy = async () => {
    const response = await call(privacyDoor)
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  const held = await getPrivacy()
  assert.equal(held.status, 'held')
  assert.deepEqual(held.retained.filter(r => r.table === 'env_private_records').map(r => r.key.kind).sort(), ['bank','ssn','tax'])
  assert.ok(held.retained.some(r => r.table === 'env_workspace_versions' && r.key.object_id === fixture.privacyWorkId))
  assert.ok(held.retained.some(r => r.table === 'env_workspace_people'))
  assert.ok(held.retained.filter(r => r.table === 'env_workspace_reviews').length >= 5, 'private review challenges join the exact retained revision')
  assert.equal(fixture.custodyInputs.length,34,'six earning adapters with three shapes each and sixteen HRIS variants are populated')
  assert.deepEqual([...new Set(fixture.custodyInputs.filter(i=>i.door==='hris').map(i=>i.body.provider+':'+i.body.type))].sort(),
    ['willow:hire','willow:rate','willow:location','willow:leave','willow:benefit','willow:termination','bamboohr:rate','hibob:rate','rippling:rate'].sort())
  assert.deepEqual(fixture.custodyInputs.filter(i=>i.door==='earnings-sources').map(i=>i.body.provider+':'+i.body.export.earningType).sort(),['gauge','plinth','glove','mallet','strap','orbit'].flatMap(p=>['job','commission','per-service'].map(t=>p+':'+t)).sort())
  const personBase=company+'/people/'+fixture.privacyPersonId
  const reporting=fixture.reportingCustody
  for(const [id,versions] of [[reporting.reportId,3],[reporting.activeReportId,1],[reporting.instructionId,2],...fixture.noticeCustody.linkIds.map(id=>[id,1])])
    assert.equal(held.retained.filter(r=>r.table==='env_workspace_versions'&&r.key.object_id===id).length,versions,'every reporting response, original instruction and shared association version is inventoried')
  assert.deepEqual(held.retained.filter(r=>r.table==='env_new_hire_authority').map(r=>r.key.report_id).sort(),[reporting.reportId,reporting.activeReportId].sort(),'both historical and active transfer authority join retention')
  const coworkerInventory=await (await call(company+'/people/'+fixture.sharedCustody.coworkerId+'/privacy')).json()
  assert.ok(coworkerInventory.retained.some(r=>r.table==='env_notices'&&r.key.id===fixture.noticeCustody.id),'the second worker independently reaches the shared notice')
  assert.equal(coworkerInventory.retained.filter(r=>r.table==='env_notice_replies'&&r.key.id===fixture.noticeCustody.replyId).length,2,'the second worker reaches every retained reply revision')
  for(const id of fixture.noticeCustody.linkIds) assert.ok(coworkerInventory.retained.some(r=>r.table==='env_workspace_versions'&&r.key.object_id===id),'both shared associations join either worker inventory')
  for(const provider of ['bamboohr','hibob','rippling']) for(const type of ['hire','location','leave','benefit','termination']) {
    const input=fixture.custodyInputs.find(i=>i.body.provider===provider)
    assert.equal((await call(personBase+'/hris',{...input.body,type})).status,409,'unsupported provider event is refused without adding private custody')
  }
  for (const id of fixture.custodyObjects) {
    const expected=id===fixture.sharedCustody.groupId?1:id===fixture.sharedCustody.runId?3:id.endsWith('-sick')||id.endsWith('-holiday')?5:id.endsWith('-pto')?4:2
    assert.equal(held.retained.filter(r => r.table === 'env_workspace_versions' && r.key.object_id === id).length, expected,
      'every source revision, connected bank, shared group and downstream run is retained: '+id)
  }
  for(const [table,key,value] of [['env_notices','id',fixture.noticeCustody.id],['env_notice_analysis','id',fixture.noticeCustody.analysisId],
    ['env_notice_replies','id',fixture.noticeCustody.replyId],['env_notice_reviews','reply_id',fixture.noticeCustody.replyId],
    ['env_notice_approvals','reply_id',fixture.noticeCustody.replyId],['env_notice_dispatches','reply_id',fixture.noticeCustody.replyId]])
    assert.ok(held.retained.some(r=>r.table===table&&(table==='env_notice_reviews'?r.fields.includes('reply_id'):r.key[key]===value)),'worker notice inventory includes '+table)
  assert.equal(held.retained.filter(r=>r.table==='env_notice_replies'&&r.key.id===fixture.noticeCustody.replyId).length,2,'both encrypted notice reply versions are retained')
  assert.equal(held.retained.filter(r=>r.table==='env_workspace_versions'&&r.key.kind==='hris-hire'&&r.key.object_id===fixture.hireCustody.id).length,2,'mapped original hire and correction are in custody')
  assert.ok(held.retained.some(r=>r.table==='env_hris_people'&&r.key.source_key),'the original payroll identity mapping is retained')
  for(const [kind,id] of [['paper-onboarding',fixture.privateCustody.paperId],['tax-notice-case',fixture.privateCustody.caseId]]) {
    assert.equal(held.retained.filter(r=>r.table==='env_workspace_versions'&&r.key.kind===kind&&r.key.object_id===id).length,2,'private originals and retained evidence versions join the full erasure scope')
  }
  for (const door of ['hris','earnings-sources']) {
    const path = company + '/people/' + fixture.privacyPersonId + '/' + door
    const original = await (await call(path)).json()
    const input = fixture.custodyInputs.find(input => input.door === door)
    for (const malformed of [null, [], '{broken', 17]) {
      assert.equal((await call(path, {...input.body, version:2, sourceVersion:3, export:malformed})).status,400,
        'malformed structured intake is rejected through the native door')
      assert.deepEqual(await (await call(path)).json(), original, 'rejected source input changes no retained version or review')
    }
  }
  for (const record of held.retained) {
    assert.ok(record.fields.length)
    assert.match(record.legalBasis, /Unclassified statutory retention/)
    assert.equal(record.earliestReleaseAt, null)
    assert.equal(record.released, false)
  }
  assert.match(held.boundary, /Downloaded copies and already-filed agency records are outside local recall/)
  assert.equal((await call(privacyDoor, undefined, {authorization:'Bearer ' + fixture.authority.agentToken})).status, 403)
  assert.equal((await call('/api/envelope/companies/' + fixture.companies[1] + '/people/' + fixture.privacyPersonId + '/privacy')).status, 404)
  assert.equal((await call(company + '/grants', {operatorId:viewer.id,version:0,role:'accountant',locations:['*'],fields:['tax','compensation','ssn','bank'],actions:['records:read','private:read','export']})).status,200)
  const privateDoors=[company+'/people/'+fixture.privacyPersonId+'/paper-onboarding',
    company+'/people/'+fixture.privacyPersonId+'/paper-onboarding/original/1/federal',
    company+'/people/'+fixture.privacyPersonId+'/paper-onboarding/original/2/federal',
    company+'/people/'+fixture.privacyPersonId+'/paper-onboarding/original/1/state',
    company+'/people/'+fixture.privacyPersonId+'/paper-onboarding/original/2/state',
    company+'/notices/'+fixture.noticeCustody.id+'/case',
    company+'/notices/'+fixture.noticeCustody.id+'/case/original/1/0',
    company+'/notices/'+fixture.noticeCustody.id+'/case/original/2/1',
    company+'/hris-hires/'+fixture.hireCustody.id+'/review',
    personBase+'/new-hire-reports',personBase+'/new-hire-reports/'+reporting.reportId+'/review',
    personBase+'/new-hire-reports/'+reporting.activeReportId+'/review',
    personBase+'/withholding-instructions',personBase+'/withholding-instructions/review',
    personBase+'/withholding-instructions/original/1',personBase+'/withholding-instructions/original/2',company+'/pay-settings/intake']
  const approvedReviewDoors=new Set([company+'/hris-hires/'+fixture.hireCustody.id+'/review',personBase+'/new-hire-reports/'+reporting.activeReportId+'/review',personBase+'/withholding-instructions/review'])
  const ordinaryStatus=path=>path===company+'/pay-settings/intake'?200:403
  const ownerStatus=path=>approvedReviewDoors.has(path)?409:200
  for(const path of privateDoors) {
    const originalResponse=await call(path)
    assert.equal(originalResponse.status,ownerStatus(path),'current owner reads retained custody: '+path+' '+await originalResponse.clone().text())
    if(path.includes('/original/')) assert.equal(Buffer.from(await originalResponse.arrayBuffer()).toString('base64'),fixture.privateCustody.pdf,'the positive original path returns the exact retained bytes')
    assert.equal((await call(path,undefined,{cookie:''})).status,401,'signed-out direct private transport refuses')
    assert.equal((await call(path,undefined,{cookie:viewerCookie})).status,ordinaryStatus(path),'ordinary access follows the existing record or original permission')
    assert.equal((await call(path,undefined,{authorization:'Bearer '+fixture.authority.agentToken})).status,403,'mixed agent credentials cannot acquire owner custody')
  }
  for(const path of privateDoors) {
    const html=await call(path.replace('/api/','/app/'))
    assert.equal(html.status,ownerStatus(path),'the current owner can use private transport '+path)
    if(!path.includes('/original/')) assert.match(html.headers.get('content-type'),/text\/html/)
    const denied=await call(path.replace('/api/','/app/'),undefined,{cookie:viewerCookie})
    assert.equal(denied.status,ordinaryStatus(path),'native page access follows the same private permission')
  }
  const sessionLink=await call('/auth/magic-link',{email:'owner@example.com',returnTo:'/app/envelope'}, {cookie:''})
  assert.equal(sessionLink.status,202)
  const ownerLink=new URL(context.edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;','&'))
  const ownerConfirmed=await call('/auth/confirm',{token:ownerLink.searchParams.get('token')},{cookie:''})
  assert.equal(ownerConfirmed.status,303)
  const oldOwner=ownerConfirmed.headers.get('set-cookie').split(';')[0]
  for(const path of privateDoors) assert.equal((await call(path,undefined,{cookie:oldOwner})).status,ownerStatus(path),'a second current owner session reads '+path)
  assert.equal((await call('/auth/signout',{}, {cookie:oldOwner})).status,204)
  for(const path of privateDoors) assert.equal((await call(path,undefined,{cookie:oldOwner})).status,401,'sign-out immediately fences a previously usable private transport')
  assert.equal((await call(company+'/hris-hires',undefined,{cookie:viewerCookie})).status,200,'current scoped viewer can read mapped source history before the request')
  Object.assign(held,await getPrivacy())
  const custodyReads = ['leave','hris','earnings-sources',...['ssn','bank','tax'].map(kind => 'private/' + kind)]
  for (const door of custodyReads) assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/' + door, undefined, {cookie:viewerCookie})).status,200,
    'a current ordinary grant can read the exact custody family before the erasure request')
  assert.equal((await call(privacyDoor+'/request',{consent:true,fingerprint:held.fingerprint})).status,200)
  Object.assign(held,await getPrivacy())
  const heldReports=await (await call(personBase+'/new-hire-reports')).json()
  assert.equal(heldReports.find(r=>r.id===reporting.activeReportId).canTransfer,false,'a held request removes pending transfer authority')
  assert.equal((await call(personBase+'/new-hire-reports/'+reporting.activeReportId+'/transfer',{version:1})).status,409,'an approved report cannot transfer while held')
  for(const path of privateDoors) {
    assert.equal((await call(path)).status,ownerStatus(path),'the owner retains audited custody; completed reviews cannot issue a new approval')
    assert.equal((await call(path.replace('/api/','/app/'),undefined,{cookie:viewerCookie})).status,403,'held native pages refuse ordinary access')
  }
  for (const door of custodyReads) assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/' + door, undefined, {cookie:viewerCookie})).status,403,
    'a held request withdraws ordinary access to each leave, intake and private attachment door')
  assert.equal((await call(company+'/hris-hires',undefined,{cookie:viewerCookie})).status,403,'held mapped source history refuses ordinary access')
  for(const path of privateDoors) assert.equal((await call(path,undefined,{cookie:viewerCookie})).status,403,'held private originals remain restricted')
  const custodyBeforeDenied=await getPrivacy()
  const mutationDoors=[
    [company+'/pay-settings/intake/apply',{...fixture.sharedCustody.intakeInput,version:2,digest:'synthetic-envelope-stale-preview'}],
    [personBase+'/new-hire-reports',reporting.reportInput],
    [personBase+'/new-hire-reports/'+reporting.activeReportId+'/approve',{version:1,reviewToken:'synthetic-envelope-stale-review'}],
    [personBase+'/new-hire-reports/'+reporting.activeReportId+'/transfer',{version:1}],
    [personBase+'/new-hire-reports/'+reporting.reportId+'/response',{version:3,receiptId:'synthetic-envelope-denied-response',response:'accepted',reportingDate:'2026-02-03',agencyResponse:'Synthetic denied response'}],
    [personBase+'/withholding-instructions',reporting.instructionInput],
    [personBase+'/withholding-instructions/approve',{version:2,reviewToken:'synthetic-envelope-stale-review'}],
    [company+'/notices/'+fixture.noticeCustody.id+'/people',{personId:fixture.sharedCustody.coworkerId,consent:true,digest:'synthetic-envelope-stale-digest'}],
  ]
  for(const [path,body] of mutationDoors) for(const [headers,status] of [[{cookie:viewerCookie},403],[{cookie:oldOwner},401],[{cookie:''},401],[{authorization:'Bearer '+fixture.authority.agentToken},403]]) {
    assert.equal((await call(path,body,headers)).status,status,'private mutation cannot use denied authority: '+path)
    assert.equal((await call(path.replace('/api/','/app/'),body,headers)).status,status,'native form cannot use denied authority: '+path)
  }
  assert.equal((await getPrivacy()).fingerprint,custodyBeforeDenied.fingerprint,'all denied private mutations leave the retained business graph unchanged')
  const scopedRead=await worker.fetch(origin+'/api/envelope/mcp',{method:'POST',headers:{origin,'content-type':['application','json'].join('/'),authorization:'Bearer '+fixture.authority.agentToken},body:JSON.stringify({jsonrpc:'2.0',id:54,method:['tools','call'].join('/'),params:{name:'records.list',arguments:{companyId:fixture.companies[0],personId:fixture.privacyPersonId}}})})
  assert.equal(scopedRead.status,403,'a previously usable sponsored bearer cannot read retained company data')
  await browserProof('loaded',privacyDoor.replace('/api/','/app/'),/Local inventory: held/)
  const providerDoor=company+'/privacy-provider-requests'
  const requestHistory=await (await call(company+'/privacy-requests')).json()
  const localRequest=requestHistory.find(r=>r.personId===fixture.privacyPersonId)
  assert.ok(localRequest,'external follow-up must name a real separate local erasure request')
  const externalOutboundBefore=context.edge.mails.length
  const followup={version:0,consent:true,requestId:localRequest.id,provider:'openai',reference:'synthetic-envelope-provider-request',status:'requested',evidence:'Synthetic owner requests provider follow-up; no remote deletion is asserted.'}
  assert.equal((await call(providerDoor,{...followup,requestId:'synthetic-envelope-foreign-request'})).status,409)
  assert.equal((await call('/api/envelope/companies/'+fixture.companies[1]+'/privacy-provider-requests',followup)).status,409,'another company cannot bind the local erasure request')
  assert.equal((await call(providerDoor,{...followup,status:'confirmation-reported'})).status,409,'a local request cannot start as remotely confirmed')
  assert.equal((await call(providerDoor,followup,{cookie:viewerCookie})).status,403)
  assert.equal((await call(providerDoor,followup,{cookie:''})).status,401)
  assert.equal((await call(providerDoor,followup,{authorization:'Bearer '+fixture.authority.agentToken})).status,403)
  const externalCreated=await call(providerDoor,followup)
  assert.equal(externalCreated.status,201,await externalCreated.clone().text())
  const externalId=(await externalCreated.json()).id
  for(const [version,status] of [[1,'submitted'],[2,'unknown'],[3,'rejected'],[4,'submitted']]) {
    const updated=await call(providerDoor+'/'+externalId,{version,consent:true,status,evidence:'Synthetic owner-attested '+status+' reference; provider retention remains separately governed.'})
    assert.equal(updated.status,201,await updated.clone().text())
  }
  assert.equal((await call(providerDoor+'/'+externalId,{version:1,consent:true,status:'confirmation-reported',evidence:'Stale response'})).status,409)
  let externalHistory=await (await call(providerDoor)).json()
  assert.deepEqual(externalHistory.filter(r=>r.id===externalId).map(r=>r.data.status),['submitted','rejected','unknown','submitted','requested'])
  assert.ok(externalHistory.every(r=>r.data.externalDeletionVerified===false&&r.data.provenance==='owner-attested'))
  assert.equal(context.edge.mails.length,externalOutboundBefore,'recording provider status sends no outbound request')
  Object.assign(held,await getPrivacy())
  const selection = {fingerprint: held.fingerprint, records: held.retained.map(r => r.id), consent: true,
    legalBasis: 'Synthetic reviewed statutory retention release; no active legal hold remains.', custodian: 'Native payroll owner'}
  assert.equal((await call(privacyDoor + '/release', selection)).status, 409, 'an unclassified statutory hold cannot be released')
  assert.equal((await call(privacyDoor + '/retain', {...selection, earliestReleaseAt:'2000-01-01'})).status, 400, 'release gates require explicit UTC instants')
  const classify = await call(privacyDoor + '/retain', {...selection, earliestReleaseAt:'2000-01-01T00:00:00.000Z'})
  assert.equal(classify.status, 200, await classify.clone().text())
  assert.equal((await getPrivacy()).status, 'held', 'elapsed time never releases a statutory hold')
  assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1, consent:true, fingerprint:held.fingerprint})).status, 409)
  const released = await call(privacyDoor + '/release', selection)
  assert.equal(released.status, 200, await released.clone().text())
  assert.equal((await released.json()).status, 'eligible')
  const changed = await call(company + '/people/' + fixture.privacyPersonId + '/private', {kind:'tax',version:1,value:'synthetic-envelope-5402'})
  assert.equal(changed.status,201)
  assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1,consent:true,fingerprint:held.fingerprint})).status,409, 'changed retained contents invalidate the old erasure review')
  const revised = await getPrivacy()
  assert.equal(revised.status,'held','a release never transfers to changed private contents')
  selection.fingerprint = revised.fingerprint
  assert.equal((await call(privacyDoor + '/retain', {...selection,earliestReleaseAt:'2000-01-01T00:00:00.000Z'})).status,200)
  assert.equal((await call(privacyDoor + '/release',selection)).status,200)
  held.fingerprint = revised.fingerprint

  assert.equal((await call(privacyDoor + '/release', selection)).status, 409, 'a human release cannot replay')

  const retainedDoor = company + '/people/' + fixture.retainedPersonId + '/privacy'
  const statutory = await (await call(retainedDoor)).json()
  assert.ok(statutory.retained.some(r => r.table === 'env_workspace_decisions'), 'payroll decisions and source pins are in the transitive held set')
  const future = {fingerprint:statutory.fingerprint, records:[statutory.retained[0].id], consent:true,
    legalBasis:'Synthetic active statutory payroll hold', custodian:'Native payroll owner', earliestReleaseAt:'9999-12-31T00:00:00.000Z'}
  assert.equal((await call(retainedDoor + '/retain', future)).status, 200)
  assert.equal((await call(retainedDoor + '/release', future)).status, 409, 'release before the UTC gate refuses')
  assert.equal((await call(retainedDoor + '/retain', {...future, earliestReleaseAt:'2000-01-01T00:00:00.000Z'})).status, 200)
  const futureState = await (await call(retainedDoor)).json()
  assert.equal(futureState.retained.find(r => r.id === future.records[0]).earliestReleaseAt, future.earliestReleaseAt, 'reclassification never shortens an established gate')
  assert.equal((await call(retainedDoor + '/release', future)).status, 409)

  const browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  try {
    const session = await browser.newContext({ignoreHTTPSErrors:true})
    const separator = cookie.indexOf('=')
    await session.addCookies([{name:cookie.slice(0,separator), value:cookie.slice(separator+1), url:origin, secure:true}])
    const page = await session.newPage(), proof = process.env.ENVELOPE_PROOF_DIR ?? './test-results/envelope'
    await mkdir(proof,{recursive:true})
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      await page.goto(origin + (company + '/people/' + fixture.privacyPersonId).replace('/api/','/app/'))
      assert.ok((await page.locator('main').innerText()).includes('Synthetic local custody worker'))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      for (const control of await page.locator('button,a,summary').all()) if (await control.isVisible())
        assert.ok((await control.innerText()).trim(), 'all controls on the existing worker screen have visible words')
      await page.keyboard.press('Tab')
      assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY')
      await page.screenshot({path:join(proof,'privacy-before-'+width+'.png'),fullPage:true})
    }
    const forbidden = []
    page.on('request', request => { if (request.url().startsWith('https://ungranted.example/')) forbidden.push(request.url()) })
    for(const [label,path] of [['reporting',personBase+'/new-hire-reports'],['instructions',personBase+'/withholding-instructions']]) {
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:1000})
        assert.equal((await page.goto(origin+path.replace('/api/','/app/'))).status(),200)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        for(const control of await page.locator('button,a,summary').all()) if(await control.isVisible()) assert.ok((await control.innerText()).trim(),'custody screens have labeled actions')
        await page.screenshot({path:join(proof,'privacy-'+label+'-'+width+'.png'),fullPage:true})
      }
    }
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      for (const door of ['leave','hris','earnings-sources']) {
        const review = door === 'leave' ? '/review?bucket=holiday' : '/' + fixture.custodyInputs.find(input => input.door === door).id + '/review'
        const response = await page.goto(origin + (company + '/people/' + fixture.privacyPersonId + '/' + door + review).replace('/api/','/app/'))
        assert.equal(response.status(),200)
        assert.ok((await page.locator('main').innerText()).includes(fixture.hostileCustody), 'hostile custody evidence remains visible as literal text')
        assert.equal(await page.evaluate(() => globalThis.syntheticEnvelope794),undefined)
        assert.equal(await page.locator('main img').count(),0)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true)
        for (const control of await page.locator('button,a,summary').all()) if (await control.isVisible()) assert.ok((await control.innerText()).trim(), 'source and leave controls have visible words; no icon-only action lacks a tooltip')
        await page.keyboard.press('Tab')
        assert.notEqual(await page.evaluate(() => document.activeElement.tagName),'BODY')
        await page.screenshot({path:join(proof,'custody-' + door + '-' + width + '.png'),fullPage:true})
      }
    }
    assert.deepEqual(forbidden,[], 'retained source evidence cannot trigger a remote request')
    const finalScope = await getPrivacy()
    assert.notEqual(finalScope.fingerprint,held.fingerprint, 'new private review challenges invalidate the earlier erasure selection')
    assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1,consent:true,fingerprint:held.fingerprint,records:selection.records})).status,409)
    selection.fingerprint = finalScope.fingerprint
    selection.records = finalScope.retained.map(record => record.id)
    assert.equal((await call(privacyDoor + '/retain', {...selection,earliestReleaseAt:'2000-01-01T00:00:00.000Z'})).status,200)
    assert.equal((await call(privacyDoor + '/release',selection)).status,200)
    held.fingerprint = finalScope.fingerprint
    const started = Date.now()
    const cascade = await call(company + '/people/' + fixture.privacyPersonId + '/erase', {version:1,consent:true,fingerprint:held.fingerprint,records:selection.records})
    assert.equal(cascade.status, 200, await cascade.clone().text())
    assert.ok((await cascade.json()).recordsDeleted >= 6)
    assert.ok(Date.now()-started < 300000, 'the committed synchronous cascade finishes inside five minutes')
    assert.equal((await call(company + '/people/' + fixture.privacyPersonId)).status,404)
    for (const kind of ['ssn','bank','tax']) assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/private/' + kind)).status,404)
    assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/allocations')).status,404)
    assert.equal((await call(company+'/hris-hires',fixture.hireCustody.input)).status,409,'original mapped hire source cannot resurrect a worker')
    assert.ok(!(await (await call(company+'/hris-hires')).json()).some(r=>r.id===fixture.hireCustody.id),'erased mapped hire is absent from the collection')
    assert.ok(!(await (await call(company+'/pay-settings/intake')).json()).some(r=>r.id===fixture.sharedCustody.runId),'erasure removes both versions of shared run intake')
    assert.equal((await call(company+'/pay-settings/intake/preview',{...fixture.sharedCustody.intakeInput,id:'synthetic-envelope-renamed-private-intake',version:0,rows:fixture.sharedCustody.intakeInput.rows.map(row=>({...row,personId:fixture.sharedCustody.coworkerId}))})).status,409,'erased shared input cannot replay under a renamed run and surviving coworker')
    assert.equal((await call(company+'/people/'+fixture.sharedCustody.coworkerId)).status,200,'erasing a shared run does not erase its unrelated coworker')
    const afterSettings=await (await call(company+'/pay-settings')).json()
    assert.ok(!afterSettings.runs.some(r=>r.id===fixture.sharedCustody.runId),'shared downstream payroll is absent after erasure')
    assert.equal((await call(company+'/notices/'+fixture.noticeCustody.id)).status,403,'erased notice body and derivatives are unavailable')
    for(const path of privateDoors.filter(path=>path!==company+'/pay-settings/intake')) assert.ok([403,404].includes((await call(path)).status),'erased private history and original bytes are unavailable')
    assert.equal((await call(personBase+'/new-hire-reports',reporting.reportInput)).status,404,'a stale reporting payload cannot recreate the erased worker')
    assert.equal((await call(personBase+'/withholding-instructions',reporting.instructionInput)).status,404,'a stale IRS instruction cannot recreate the erased worker')
    const coworkerAfter=await (await call(company+'/people/'+fixture.sharedCustody.coworkerId+'/privacy')).json()
    assert.ok(!coworkerAfter.retained.some(r=>r.table==='env_notices'),'the surviving coworker has no dangling shared notice custody')
    assert.ok(!coworkerAfter.retained.some(r=>r.table==='env_workspace_versions'&&fixture.noticeCustody.linkIds.includes(r.key.object_id)),'both retired associations are absent')
    assert.equal((await call(company+'/notice-replies/'+fixture.noticeCustody.replyId+'/review')).status,403)
    assert.equal((await call(company+'/notices',fixture.noticeCustody.input)).status,409,'retired notice source cannot resurrect under a new random identifier')
    externalHistory=await (await call(providerDoor)).json()
    assert.equal(externalHistory.filter(r=>r.id===externalId).length,5,'local erasure preserves the separate unresolved provider request')
    assert.equal(externalHistory.find(r=>r.id===externalId).data.status,'submitted','local completion does not manufacture an external outcome')
    assert.equal(JSON.stringify(externalHistory).includes(fixture.privacyPersonId),false,'provider history contains no erased worker identifier')
    const reported=await call(providerDoor+'/'+externalId,{version:5,consent:true,status:'confirmation-reported',evidence:'Synthetic retained provider confirmation entered by the owner; authenticity remains unverified.'})
    assert.equal(reported.status,201)
    const reportedHistory=await (await call(providerDoor)).json()
    assert.equal(reportedHistory.find(r=>r.id===externalId).data.externalDeletionVerified,false,'an attested receipt is not independent provider proof')
    assert.equal((await call(providerDoor+'/'+externalId,{version:6,consent:true,status:'submitted',evidence:'Duplicate request'})).status,409,'confirmation cannot silently restart destruction')
    for (const door of ['leave','hris','earnings-sources']) assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/' + door)).status,404)
    for (const input of fixture.custodyInputs) {
      const currentCompany = await (await call(company)).json()
      const replacement = await (await call(company + '/people', {name:'Synthetic source replay worker',locationId:currentCompany.people[0].locationId})).json()
      assert.equal((await call(company + '/people/' + replacement.id + '/' + input.door, input.body)).status,409,
        'erased intake source cannot resurrect under a new worker identity')
    }
    const auditEvents = await (await call(company + '/audit')).json()
    assert.ok(!auditEvents.some(e => [fixture.privacyPersonId,fixture.privacyWorkId,...fixture.custodyObjects,fixture.noticeCustody.id,fixture.noticeCustody.replyId,fixture.noticeCustody.analysisId,fixture.privateCustody.paperId,...fixture.noticeCustody.linkIds,reporting.reportId,reporting.activeReportId,reporting.instructionId].includes(e.targetId)), 'retained action targets are anonymized across every erased source and private derivative')
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      const response = await page.goto(origin + (company + '/people/' + fixture.privacyPersonId).replace('/api/','/app/'))
      assert.equal(response.status(),404)
      assert.ok(!(await page.locator('main').innerText()).includes('Synthetic local custody worker'))
      await page.screenshot({path:join(proof,'privacy-after-'+width+'.png'),fullPage:true})
    }
    await session.close()
  } finally {await browser.close()}
  assert.equal((await call(company + '/people/' + fixture.retainedPersonId)).status,200,'unreleased payroll remains intact')
  await browserProof('completed',company.replace('/api/','/app/')+'/privacy-requests',/completed/)
  assert.equal((await call(company + '/people/' + fixture.privacyPersonId + '/allocations/work', {id:fixture.privacyWorkId,version:0,day:'2026-10-19'})).status,404,'a stale worker source cannot resurrect its erased identity')
  const currentCompany = await (await call(company)).json()
  const replacement = await call(company + '/people', {name:'Synthetic later worker', locationId:currentCompany.people[0].locationId})
  assert.equal(replacement.status,201)
  const replacementId = (await replacement.json()).id
  const staleSource = await call(company + '/people/' + replacementId + '/allocations/work', {
    id:fixture.privacyWorkId,version:0,day:'2026-10-19',state:'TX',locality:'Austin',minutes:480,earnedCents:100000,
    officeState:'TX',nyReason:'not-applicable',sourceRef:'Synthetic stale source replay'
  })
  assert.equal(staleSource.status,409,'the erased source cannot be assigned to a replacement identity')
  assert.deepEqual(await staleSource.json(),{error:'erased_source'})
  const erased = await call(door, { version: 1, consent: true })
  assert.equal(erased.status, 200, await erased.clone().text())
  const receipt = await erased.json()
  assert.equal(receipt.erased, true)
  assert.ok(receipt.id && !receipt.id.includes(fixture.unusedId))
  assert.equal((await call(company + '/people/' + fixture.unusedId)).status, 404, 'the native record read cannot resurrect erased identity')
  const events = await audit()
  assert.equal(events.length, initial.length + 2)
  assert.ok(events.some(event => event.targetId === receipt.id), 'the permanent erasure action uses an anonymous target')
  assert.equal((await call(door, { version: 1, consent: true })).status, 409)
  assert.deepEqual(await audit(), events, 'replayed erasure has no repeated effect or audit')
}
