import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { industryFixture, ordinaryFacts } from './industry-fixture.mjs'
import { claimsFixture } from './claims-fixture.mjs'
import { archiveAuthority } from './archive-authority.mjs'
import { archiveYearFixture } from './archive-year-fixture.mjs'
import { intakeCustodyFixture } from './intake-custody.mjs'

/** Real native business records; only the retained agency request is a source-edge fixture. */
export async function archiveFixture(context) {
  const payroll = industryFixture(context)
  const company = await payroll.company('Synthetic archive payroll employer', ['<img src="https://ungranted.example/pixel" onerror="globalThis.syntheticEnvelope586=true">'])
  const person = company.people[0]
  await payroll.classify(company, person, ordinaryFacts)
  const check = await payroll.preview(company, person)
  await payroll.approve(company, person, 'industry-check', check.id)
  const checkBefore = await payroll.data(payroll.path(company, person))
  assert.ok(checkBefore.checks.some(row => row.id === check.id), 'a persisted calculated check exists before archiving')
  const year = await archiveYearFixture(payroll, company)
  const second = await payroll.company('Synthetic second annual employer', ['Synthetic second annual worker'])
  await payroll.classify(second, second.people[0], ordinaryFacts)
  const secondYear = await archiveYearFixture(payroll, second)

  const capture = JSON.parse(await readFile(new URL('./fixtures/sides/willow-native-capture.json', import.meta.url)))
  capture.originals = Object.fromEntries(Object.entries(capture.originals).map(([key, value]) =>
    [key, { filename: value.filename, bytes: Buffer.from(value.base64, 'base64') }]))
  capture.manifest = JSON.parse(capture.originals.manifest.bytes)
  capture.recordsText = capture.originals.records.bytes.toString()
  capture.audit = JSON.parse(capture.originals.audit.bytes)
  const claims = await claimsFixture(context, { willow: capture })
  const claim = await claims.data(claims.claims + '/import', claims.validRequest(), 201)
  const door = claims.claims + '/' + claim.id
  await claims.data(door + '/evidence', claims.evidence(claim.version))
  let retained = await claims.data(door)
  await claims.data(door + '/prepare', claims.prepare(retained.version))
  retained = await claims.data(door)
  assert.equal(retained.data.status, 'ready-for-review', 'the original Willow and payroll evidence support a retained response')
  const notice = await payroll.data(company.base + '/notices', {
    reference: 'synthetic-envelope-archive-notice', locationId: company.location.id,
    body: 'Synthetic retained agency notice. Payroll officer must investigate the assessed period.',
  }, 201)
  const authority = await archiveAuthority(context, company, notice)
  for (const [index, employer] of [company, second].entries()) {
    const account = await payroll.data(employer.base + '/funding-accounts', {id:'synthetic-envelope-archive-funding-'+index,version:0,name:'Retained operating account',lastFour:index?'0202':'0101',accountReference:'synthetic-envelope-archive-bank-'+index},201)
    await payroll.data(employer.base + '/funding-plans', {id:'synthetic-envelope-archive-plan-'+index,version:0,runId:employer.run.id,runVersion:employer.run.version,accountId:account.id,accountVersion:account.version},201)
  }
  const formerEmail = 'synthetic-creator@example.com'
  await payroll.data('/auth/invite', { email: formerEmail, displayName: 'Synthetic prior company creator', role: 'owner' }, 202)
  const invite = new URL(context.edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;', '&'))
  const joined = await payroll.call('/auth/confirm', { token: invite.searchParams.get('token') })
  assert.equal(joined.status, 303)
  const creatorCookie = joined.headers.get('set-cookie').split(';')[0]
  const creatorCompanies = []
  for (const [index, name] of ['Synthetic creator recovery company', 'Synthetic successor recovery company'].entries())
    creatorCompanies.push(await payroll.data('/api/envelope/companies', { name, ein: '00-00053' + String(index).padStart(2, '0') }, 201, creatorCookie))
  const creator = await payroll.data('/auth/session', undefined, 200, creatorCookie)
  await payroll.data('/auth/operator/role', { operatorId: creator.operator.id, role: 'member' })

  const unused = await payroll.data(company.base + '/people', { name: 'Synthetic unused archive worker', locationId: company.location.id }, 201)
  const hireInput={provider:'willow',version:0,sourceVersion:1,sourcePersonId:'synthetic-envelope-privacy-hire-worker',sourceEvidence:'Synthetic reviewed original hire',sourceApprovedBy:'Synthetic HR reviewer',
    export:{schema:'envelope-willow-payroll@1',sourceId:'synthetic-envelope-privacy-hire',effectiveDate:'2026-01-02',values:{name:'Synthetic local custody worker',locationId:company.location.id}}}
  const hire=await payroll.data(company.base+'/hris-hires',hireInput,201)
  const hireReview=await payroll.data(company.base+'/hris-hires/'+hire.id+'/review')
  await payroll.data(company.base+'/hris-hires/'+hire.id+'/approve',{version:hireReview.version,reviewToken:hireReview.reviewToken})
  const privacyPerson=await payroll.data(company.base+'/hris-hires/'+hire.id+'/apply',{version:1},201)
  await payroll.data(company.base+'/hris-hires',{...hireInput,version:1,sourceVersion:2},201)
  const revisedHire=await payroll.data(company.base+'/hris-hires/'+hire.id+'/review')
  await payroll.data(company.base+'/hris-hires/'+hire.id+'/approve',{version:revisedHire.version,reviewToken:revisedHire.reviewToken})
  const hireCustody={id:hire.id,input:hireInput}

  for (const kind of ['ssn', 'bank', 'tax']) await payroll.data(company.base + '/people/' + privacyPerson.id + '/private',
    {kind, version: 0, value: 'synthetic-envelope-5401'}, 201)
  const custodyBase = company.base + '/people/' + privacyPerson.id
  const hostileCustody = '<img src="https://ungranted.example/custody" onerror="globalThis.syntheticEnvelope794=true">'
  const custodyObjects = []
  for (const bucket of ['sick', 'pto', 'holiday']) {
    const account = await payroll.data(custodyBase + '/leave', {
      bucket, owner:bucket==='sick'?'willow':'payroll', hireDate:'2026-01-01', effectiveDate:'2026-01-01',
      capMinutes:4800, carryoverMinutes:2400, openingMinutes:480,
      tiers:[{years:0,earnedMinutes:1,workedMinutes:30}], policyEvidence:hostileCustody,
    }, 201)
    custodyObjects.push(account.id)
    const review = await payroll.data(custodyBase + '/leave/review?bucket=' + bucket)
    await payroll.data(custodyBase + '/leave/approve', {bucket, version:review.version, reviewToken:review.reviewToken})
    if(bucket!=='sick') {
    await payroll.data(custodyBase + '/leave/entries', {
      bucket, version:1, sourceId:'synthetic-envelope-custody-' + bucket, sourceVersion:1,
      day:'2026-10-19', operation:'adjustment', direction:'credit', minutes:60, evidence:hostileCustody,
    }, 201)
    const changed=await payroll.data(custodyBase+'/leave/review?bucket='+bucket)
    await payroll.data(custodyBase+'/leave/approve',{bucket,version:changed.version,reviewToken:changed.reviewToken})
    }
  }
  const custodyInputs = []
  const values={hire:{},rate:{rateCents:2500},location:{locationId:company.location.id},
    leave:{minutes:60,rateCents:2500,code:'sick'},benefit:{amountCents:500,code:hostileCustody},termination:{}}
  for(const type of ['hire','rate','location','leave','benefit','termination']) custodyInputs.push({door:'hris',body:{
    provider:'willow',type,sourcePersonId:'synthetic-envelope-custody-worker',sourceEvidence:hostileCustody,
    sourceApprovedBy:'Synthetic reviewer',sourceVersion:1,version:0,
    export:{schema:'envelope-willow-payroll@1',sourceId:'synthetic-envelope-custody-'+type,effectiveDate:'2026-10-19',values:values[type]}}})
  for(const [provider,raw] of [
    ['bamboohr',{id:'synthetic-envelope-bamboohr',payType:'Hourly',payPer:'Hour',payRate:'25.00',payRateEffectiveDate:'2026-10-19'}],
    ['hibob',{id:5401,payPeriod:'Hourly',base:{currency:'USD',value:25},effectiveDate:'2026-10-19'}],
    ['rippling',{id:'synthetic-envelope-rippling',worker_id:'synthetic-envelope-custody-worker',hourly_wage:{currency_type:'USD',value:25},salary_effective_date:'2026-10-19'}],
  ]) custodyInputs.push({door:'hris',body:{provider,type:'rate',sourcePersonId:'synthetic-envelope-custody-worker',
    sourceEvidence:hostileCustody,sourceApprovedBy:'Synthetic reviewer',sourceVersion:1,version:0,export:raw}})
  for(const [index,provider] of ['gauge','plinth','glove','mallet','strap','orbit'].entries()) custodyInputs.push({door:'earnings-sources',body:{
    provider,sourcePersonId:'synthetic-envelope-custody-worker',sourceEvidence:hostileCustody,sourceApprovedBy:'Synthetic reviewer',sourceVersion:1,version:0,
    export:{schema:'envelope-job-earning@1',status:'approved',currency:'USD',paymentState:'unpaid',sourceId:'synthetic-envelope-custody-'+provider,
      effectiveDate:'2026-10-19',amountCents:500,jobId:hostileCustody,approvedBy:'Synthetic reviewer',earningType:['job','commission','per-service'][index%3]}}})
  for (const input of custodyInputs) {
    const source = await payroll.data(custodyBase + '/' + input.door, input.body, 201)
    input.id = source.id
    custodyObjects.push(source.id)
    if(input.body.type==='leave') {
      const first=await payroll.data(custodyBase+'/hris/'+source.id+'/review')
      await payroll.data(custodyBase+'/hris/'+source.id+'/approve',{version:first.version,reviewToken:first.reviewToken})
      await payroll.data(custodyBase+'/hris/'+source.id+'/leave-handoff',{bucket:'sick',ledgerVersion:1},201)
      const bank=await payroll.data(custodyBase+'/leave/review?bucket=sick')
      await payroll.data(custodyBase+'/leave/approve',{bucket:'sick',version:bank.version,reviewToken:bank.reviewToken})
    }
    await payroll.data(custodyBase + '/' + input.door, {...input.body, version:1, sourceVersion:2}, 201)
    const review=await payroll.data(custodyBase+'/'+input.door+'/'+source.id+'/review')
    if(input.body.type==='leave') {
      await payroll.data(custodyBase+'/hris/'+source.id+'/approve',{version:review.version,reviewToken:review.reviewToken})
      await payroll.data(custodyBase+'/hris/'+source.id+'/leave-handoff',{bucket:'sick',ledgerVersion:2},201)
      const handed=await payroll.data(custodyBase+'/leave/review?bucket=sick')
      assert.equal(handed.data.balanceMinutes,420,'connected leave consumes the reviewed 60 minutes exactly once')
      await payroll.data(custodyBase+'/leave/approve',{bucket:'sick',version:handed.version,reviewToken:handed.reviewToken})
    }
  }
  const custodyNoticeInput={reference:'synthetic-envelope-custody-notice',locationId:company.location.id,body:'Synthetic worker-bearing notice retained for explicit custody.'}
  const custodyNotice=await payroll.data(company.base+'/notices',custodyNoticeInput,201)
  const noticeDetails=await payroll.data(company.base+'/notices/'+custodyNotice.id)
  await payroll.data(company.base+'/notices/'+custodyNotice.id+'/people',{personId:privacyPerson.id,digest:noticeDetails.digest,consent:true},201)
  const custodyNoticeLinkId=custodyNotice.id
  let custodyReply=await payroll.data(company.base+'/notices/'+custodyNotice.id+'/replies',{version:0,to:'agency@example.com',subject:'Private worker notice',body:'Synthetic retained worker response.'},201)
  custodyReply=await payroll.data(company.base+'/notices/'+custodyNotice.id+'/replies',{id:custodyReply.id,version:1,to:'agency@example.com',subject:'Private worker notice',body:'Synthetic corrected retained worker response.'},201)
  const replyReview=await payroll.data(company.base+'/notice-replies/'+custodyReply.id+'/review')
  await payroll.data(company.base+'/notice-replies/'+custodyReply.id+'/approve',{version:replyReview.version,digest:replyReview.digest,reviewToken:replyReview.reviewToken})
  const custodyPdf=Buffer.from('%PDF-1.7\nSynthetic retained worker custody original.\n%%EOF').toString('base64')
  const caseDoor=company.base+'/notices/'+custodyNotice.id+'/case'
  const caseInput={version:0,type:'deposit-mismatch',agency:'IRS',employerEin:'00-0003101',periodStart:'2026-07-01',periodEnd:'2026-09-30',dueOn:'2026-10-28',principalCents:10000,proposedPenaltyCents:500,pdf:custodyPdf,quote:'Synthetic private original.',rawExtraction:'Synthetic worker notice extraction.',verifiedExtraction:true}
  await payroll.data(caseDoor,caseInput,201)
  await payroll.data(caseDoor+'/evidence',{version:1,kind:'deposit',reference:'synthetic-envelope-custody-deposit',employerEin:caseInput.employerEin,periodStart:caseInput.periodStart,periodEnd:caseInput.periodEnd,pdf:custodyPdf,quote:'Synthetic private deposit evidence.',amountCents:10000})
  const caseReview=await payroll.data(caseDoor+'/review')
  await payroll.data(caseDoor+'/approve',{version:caseReview.version,reviewToken:caseReview.reviewToken})
  const paperDoor=custodyBase+'/paper-onboarding',original={signed:true,signedBy:'Synthetic local custody worker',signedOn:'2026-01-01',pdf:custodyPdf}
  const paperInput={version:0,attestTranscription:true,workerType:'employee',hiredOn:'2026-01-02',paymentMethod:'paper-check',tin:'900005401',address:'1 Synthetic Street, Austin TX 78701',
    federal:{form:'W-4',effectiveFrom:'2026-01-02',original,fields:{filingStatus:'single',multipleJobs:'no',dependentCreditCents:0,otherIncomeCents:0,deductionsCents:0,additionalCents:100,exempt:'no'}},state:{form:'OH-IT-4',effectiveFrom:'2026-01-02',original,fields:{residenceAddress:'1 Synthetic Street, Columbus OH 43215',schoolDistrictName:'Synthetic Columbus',schoolDistrictNumber:'2503',allowances:1,additionalCents:1000,localExemption:'none'}}}
  const paper=await payroll.data(paperDoor,paperInput,201)
  await payroll.data(paperDoor,{...paperInput,version:1,federal:{...paperInput.federal,fields:{...paperInput.federal.fields,additionalCents:200}}},201)
  const paperReview=await payroll.data(paperDoor+'/review')
  await payroll.data(paperDoor+'/approve',{version:paperReview.version,reviewToken:paperReview.reviewToken})
  const privateCustody={paperId:paper.id,caseId:custodyNotice.id,pdf:custodyPdf}
  const erasedIntakes = await intakeCustodyFixture(payroll, company, privacyPerson.id, 'erased')
  const retainedIntakes = await intakeCustodyFixture(payroll, company, person.id, 'retained')
  custodyObjects.push(...erasedIntakes.map(row=>row.id))
  const aiProviders=await payroll.data(company.base+'/providers')
  await payroll.data(company.base+'/providers',{id:'openai',version:aiProviders.find(p=>p.id==='openai').version,enabled:true,consent:true,secret:'synthetic-envelope-privacy-ai'},201)
  const aiAgent=await payroll.data(company.base+'/agents',{name:'Synthetic privacy analysis',hours:1,actions:['notices:process'],fields:['tax'],locations:['*'],providers:['openai'],models:['gpt-4.1-mini']},201)
  const invoke=async(token,name,args)=>{
    const response=await context.worker.fetch(context.origin+'/api/envelope/mcp',{method:'POST',headers:{origin:context.origin,'content-type':['application','json'].join('/'),authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:541,method:['tools','call'].join('/'),params:{name,arguments:args}})})
    assert.equal(response.status,200,await response.clone().text())
    return JSON.parse((await response.json()).result.content[0].text)
  }
  const analysis=await invoke(aiAgent.token,'notice.process',{companyId:company.id,noticeId:custodyNotice.id})
  const dispatched=await invoke(authority.agentToken,'reply.dispatch',{companyId:company.id,replyId:custodyReply.id,version:custodyReply.version,digest:custodyReply.digest})
  assert.equal(dispatched.state,'accepted')
  const noticeCustody={id:custodyNotice.id,replyId:custodyReply.id,analysisId:analysis.id,input:custodyNoticeInput}
  const coworker=await payroll.data(company.base+'/people',{name:'Synthetic shared-run coworker',locationId:company.location.id},201)
  const custodyGroup='synthetic-envelope-custody-group',custodyRun='synthetic-envelope-custody-run'
  await payroll.data(company.base+'/pay-settings/group',{id:custodyGroup,version:0,name:'Shared local custody run',people:[privacyPerson.id,coworker.id]},201)
  const groupReview=await payroll.data(company.base+'/pay-settings/review/group/'+custodyGroup)
  await payroll.data(company.base+'/pay-settings/group/'+custodyGroup+'/approve',{version:groupReview.version,reviewToken:groupReview.reviewToken})
  const sharedRun=await payroll.data(company.base+'/pay-settings/earnings-run',{id:custodyRun,version:0,groupId:custodyGroup,periodStart:'2026-10-19',periodEnd:'2026-10-25',payDate:'2026-10-30',frequency:'weekly'},201)
  assert.deepEqual(sharedRun.preview.people.map(p=>p.id).sort(),[privacyPerson.id,coworker.id].sort())
  await payroll.data(custodyBase+'/leave/entries',{bucket:'holiday',version:2,sourceId:'synthetic-envelope-custody-holiday-review',sourceVersion:1,
    day:'2026-10-20',operation:'adjustment',direction:'credit',minutes:1,evidence:hostileCustody},201)
  custodyObjects.push(custodyGroup,custodyRun)
  const sharedCustody={coworkerId:coworker.id,groupId:custodyGroup,runId:custodyRun}
  const privacyWork = await payroll.data(company.base + '/people/' + privacyPerson.id + '/allocations/work', {
    id: 'synthetic-envelope-privacy-work', version: 0, day: '2026-10-19', state: 'TX', locality: 'Austin', minutes: 480,
    earnedCents: 100000, officeState: 'TX', nyReason: 'not-applicable', sourceRef: 'Synthetic approved local-custody time'
  }, 201)
  const privacyPayroll = await payroll.company('Synthetic erasure payroll employer', ['Synthetic erasure payroll worker'])
  await payroll.classify(privacyPayroll, privacyPayroll.people[0], ordinaryFacts)
  const privacyCheck = await payroll.preview(privacyPayroll, privacyPayroll.people[0])
  await payroll.approve(privacyPayroll, privacyPayroll.people[0], 'industry-check', privacyCheck.id)
  const privacyReturn = await payroll.data(privacyPayroll.base+'/industry-returns', {
    id:'synthetic-envelope-privacy-return',version:0,form:'941',taxYear:2026,quarter:4,
    checks:[{personId:privacyPayroll.people[0].id,id:privacyCheck.id,version:privacyCheck.version}],
    address:{street:'100 Main Street',city:'Austin',state:'TX',postalCode:'78701'},employeeCount:0,depositsCents:0,
    basis:'Reviewed synthetic payroll for local erasure; no payment or filing.'
  },201)
  const privacyWorker=privacyPayroll.people[0],privacyBase=privacyPayroll.base
  const rate=await payroll.data(privacyBase+'/people/'+privacyWorker.id+'/rates',{version:1,hourlyCents:2500,effectiveDate:'2026-01-01'},201)
  const rateReview=await payroll.data(privacyBase+'/rates/'+rate.id)
  await payroll.data(privacyBase+'/rates/'+rate.id+'/approve',{reviewToken:rateReview.reviewToken})
  const owner=(await payroll.data('/auth/session')).operator.id
  const work=await payroll.data(privacyBase+'/firm-work',{workKind:'run',sourceKind:'earnings-run',sourceId:privacyPayroll.run.id,sourceVersion:1,
    title:'Review synthetic erased payroll',details:'Private payroll preparation derivative',dueDate:'2026-10-30',dueTime:'16:00',timeZone:'UTC',evidenceRef:'Synthetic current payroll source',assigneeId:owner},201)
  const draftAgent=await payroll.data(privacyBase+'/agents',{name:'Synthetic local draft custody',hours:1,actions:['drafts:prepare','drafts:read','records:read'],fields:['compensation'],locations:['*'],providers:[],models:[]},201)
  const rpc=await context.worker.fetch(context.origin+'/api/envelope/mcp',{method:'POST',headers:{origin:context.origin,'content-type':['application','json'].join('/'),authorization:'Bearer '+draftAgent.token},body:JSON.stringify({jsonrpc:'2.0',id:540,method:['tools','call'].join('/'),params:{name:'draft.prepare',arguments:{companyId:privacyPayroll.id,personId:privacyWorker.id,minutes:480,periodStart:'2026-10-19',periodEnd:'2026-10-25',payDate:'2026-10-30',sourceRef:'Synthetic reviewed input',requestKey:'synthetic-envelope-privacy-draft'}}})})
  assert.equal(rpc.status,200,await rpc.clone().text())
  const draft=JSON.parse((await rpc.json()).result.content[0].text)
  const privacyClaims=await claimsFixture(context,{willow:capture})
  const privacyClaim=await privacyClaims.data(privacyClaims.claims+'/import',privacyClaims.validRequest(),201)
  await privacyClaims.data(privacyClaims.claims+'/'+privacyClaim.id+'/evidence',privacyClaims.evidence(privacyClaim.version))
  let privacyClaimRow=await privacyClaims.data(privacyClaims.claims+'/'+privacyClaim.id)
  await privacyClaims.data(privacyClaims.claims+'/'+privacyClaim.id+'/prepare',privacyClaims.prepare(privacyClaimRow.version))
  privacyClaimRow=await privacyClaims.data(privacyClaims.claims+'/'+privacyClaim.id)
  const privacyGraphs=[{companyId:privacyPayroll.id,personId:privacyPayroll.people[0].id,
    objects:[privacyCheck.id,privacyReturn.id,privacyPayroll.run.id],kind:'payroll',workId:work.id,draftId:draft.id,agentId:draftAgent.id},
    {companyId:privacyClaims.company.id,personId:privacyClaims.person.id,objects:[privacyClaim.id],kind:'claim',
     claimId:privacyClaim.id,request:privacyClaims.validRequest(),artifactIds:privacyClaimRow.data.artifacts.map(a=>a.id)}]
  return { companies: [company.id, second.id, claims.company.id], years: [year, secondYear], checkId: check.id,
    creatorCompanies, formerEmail, creatorId: creator.operator.id, privacyGraphs, custodyObjects, custodyInputs, erasedIntakes, retainedIntakes, noticeCustody, sharedCustody, privateCustody, hireCustody, hostileCustody, privacyPersonId: privacyPerson.id, privacyWorkId: privacyWork.id, claimId: claim.id, noticeId: notice.id, unusedId: unused.id, retainedPersonId: person.id, authority, privateValue: '900-69-0001' }
}
