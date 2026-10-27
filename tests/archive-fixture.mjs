import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { industryFixture, ordinaryFacts } from './industry-fixture.mjs'
import { claimsFixture } from './claims-fixture.mjs'
import { archiveAuthority } from './archive-authority.mjs'
import { archiveYearFixture } from './archive-year-fixture.mjs'

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
  const privacyPerson = await payroll.data(company.base + '/people', { name: 'Synthetic local custody worker', locationId: company.location.id }, 201)
  for (const kind of ['ssn', 'bank', 'tax']) await payroll.data(company.base + '/people/' + privacyPerson.id + '/private',
    {kind, version: 0, value: 'synthetic-envelope-5401'}, 201)
  const custodyBase = company.base + '/people/' + privacyPerson.id
  const hostileCustody = '<img src="https://ungranted.example/custody" onerror="globalThis.syntheticEnvelope794=true">'
  const custodyObjects = []
  for (const bucket of ['sick', 'pto', 'holiday']) {
    const account = await payroll.data(custodyBase + '/leave', {
      bucket, owner:'payroll', hireDate:'2026-01-01', effectiveDate:'2026-01-01',
      capMinutes:4800, carryoverMinutes:2400, openingMinutes:480,
      tiers:[{years:0,earnedMinutes:1,workedMinutes:30}], policyEvidence:hostileCustody,
    }, 201)
    custodyObjects.push(account.id)
    const review = await payroll.data(custodyBase + '/leave/review?bucket=' + bucket)
    await payroll.data(custodyBase + '/leave/approve', {bucket, version:review.version, reviewToken:review.reviewToken})
    await payroll.data(custodyBase + '/leave/entries', {
      bucket, version:1, sourceId:'synthetic-envelope-custody-' + bucket, sourceVersion:1,
      day:'2026-10-19', operation:'adjustment', direction:'credit', minutes:60, evidence:hostileCustody,
    }, 201)
  }
  const custodyInputs = [
    {door:'hris', body:{provider:'willow',type:'benefit',sourcePersonId:'synthetic-envelope-794-worker',
      sourceEvidence:hostileCustody,sourceApprovedBy:'Synthetic reviewer',sourceVersion:1,version:0,
      export:{schema:'envelope-willow-payroll@1',sourceId:'synthetic-envelope-794-benefit',effectiveDate:'2026-10-19',values:{amountCents:500,code:hostileCustody}}}},
    {door:'earnings-sources', body:{provider:'gauge',sourcePersonId:'synthetic-envelope-794-worker',
      sourceEvidence:hostileCustody,sourceApprovedBy:'Synthetic reviewer',sourceVersion:1,version:0,
      export:{schema:'envelope-job-earning@1',status:'approved',currency:'USD',paymentState:'unpaid',
        sourceId:'synthetic-envelope-794-earning',effectiveDate:'2026-10-19',amountCents:500,
        jobId:hostileCustody,approvedBy:'Synthetic reviewer',earningType:'job'}}},
  ]
  for (const input of custodyInputs) {
    const source = await payroll.data(custodyBase + '/' + input.door, input.body, 201)
    input.id = source.id
    custodyObjects.push(source.id)
    await payroll.data(custodyBase + '/' + input.door, {...input.body, version:1, sourceVersion:2}, 201)
    await payroll.data(custodyBase + '/' + input.door + '/' + source.id + '/review')
  }
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
    creatorCompanies, formerEmail, creatorId: creator.operator.id, privacyGraphs, custodyObjects, custodyInputs, hostileCustody, privacyPersonId: privacyPerson.id, privacyWorkId: privacyWork.id, claimId: claim.id, noticeId: notice.id, unusedId: unused.id, retainedPersonId: person.id, authority, privateValue: '900-69-0001' }
}
