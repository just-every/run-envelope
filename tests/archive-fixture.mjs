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
  const unused = await payroll.data(company.base + '/people', { name: 'Synthetic unused archive worker', locationId: company.location.id }, 201)
  const privacyPerson = await payroll.data(company.base + '/people', { name: 'Synthetic local custody worker', locationId: company.location.id }, 201)
  for (const kind of ['ssn', 'bank', 'tax']) await payroll.data(company.base + '/people/' + privacyPerson.id + '/private',
    {kind, version: 0, value: 'synthetic-envelope-5401'}, 201)
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
    privacyGraphs, privacyPersonId: privacyPerson.id, privacyWorkId: privacyWork.id, claimId: claim.id, noticeId: notice.id, unusedId: unused.id, retainedPersonId: person.id, authority, privateValue: '900-69-0001' }
}
