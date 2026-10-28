import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { read, utils, write } from '@e965/xlsx'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { industryFixture, ordinaryFacts } from './industry-fixture.mjs'
import { localCookieName } from '../src/modules/operator-auth/http.mjs'
import { lanyardExportCases } from './lanyard-exports.mjs'

/** Run intake through the same native HTTP and built screens used by employers. */
export async function runIntakeCases({ origin, cookie, sql, settings, advanceClock }) {
  await advanceClock('2026-01-31T12:00:00Z')
  const call = (path, body, who = cookie) =>
    fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'manual',
      headers: { cookie: who, origin, 'content-type': ['application', 'json'].join('/') },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  const data = async (path, body, status = 200, who = cookie) => {
    const r = await call(path, body, who)
    assert.equal(r.status, status, await r.clone().text())
    return r.json()
  }
  // Independent Pub 15 shortfall fixture: $42.60 wages and $600 held tips.
  const fixture = industryFixture({origin,cookie})
  const tipped = await fixture.company('Synthetic tip-tax employer',['Synthetic held-tip server','Synthetic paycheck-tip server'])
  const groupId = 'synthetic-envelope-tip-group', rateId = 'synthetic-envelope-tip-rate', taxRunId = 'synthetic-envelope-tip-run'
  const taxPay = tipped.base+'/pay-settings', taxDoor = taxPay+'/intake'
  const setupTax = async (kind,id,body) => {
    await data(taxPay+'/'+kind,{id,version:0,...body},201)
    const review=await data(taxPay+'/review/'+kind+'/'+id)
    await data(taxPay+'/'+kind+'/'+id+'/approve',{version:review.version,reviewToken:review.reviewToken})
  }
  await setupTax('group',groupId,{name:'Tip-tax fixture',people:tipped.people.map(p=>p.id)})
  await setupTax('pay-change',rateId,{name:'Reviewed federal tip-credit wage',groupId,effectiveDate:'2026-01-01',items:tipped.people.map(p=>({personId:p.id,personVersion:p.version,rateCents:213,basis:'hourly',employmentFrom:'2026-01-01',employmentThrough:'2026-12-31',unpaidDates:[]}))})
  const taxRows=tipped.people.flatMap((p,i)=>[
    {sourceId:'synthetic-envelope-tip-hours-'+i,personId:p.id,day:'2026-01-19',workweek:'2026-01-19',code:'regular',minutes:1200,amountCents:0,settlement:'',evidence:'synthetic-envelope-901',state:'',riskClass:''},
    {sourceId:'synthetic-envelope-tip-money-'+i,personId:p.id,day:'2026-01-19',workweek:'2026-01-19',code:'tip',minutes:0,amountCents:i?30000:60000,settlement:i?'paycheck':'cash',evidence:'synthetic-envelope-902',state:'',riskClass:''}])
  const taxPreview=await data(taxDoor+'/preview',{id:taxRunId,version:0,namespace:'synthetic-envelope-tip-reports',rows:taxRows})
  await data(taxDoor+'/apply',{id:taxRunId,version:0,namespace:taxPreview.data.namespace,rows:taxPreview.data.rows,digest:taxPreview.digest,format:'grid'},201)
  const intakeReview=await data(taxDoor+'/'+taxRunId+'/review')
  await data(taxDoor+'/'+taxRunId+'/approve',{version:1,reviewToken:intakeReview.reviewToken})
  await data(taxPay+'/earnings-run',{id:taxRunId,version:0,groupId,periodStart:'2026-01-19',periodEnd:'2026-01-25',payDate:'2026-01-30',frequency:'weekly'},201)
  for(const p of tipped.people)await fixture.classify(tipped,p,ordinaryFacts)
  const tipApi=fixture.path(tipped,tipped.people[0]), secondTipApi=fixture.path(tipped,tipped.people[1])
  const taxBody={runId:taxRunId,runVersion:1,reportReceivedOn:'2026-01-31',reportEvidence:'Signed January tip report received January 31',yearToDateEvidence:'Reviewed opening register, no earlier wages',socialSecurityBeforeCents:0,medicareBeforeCents:0,version:0}
  const shortage=await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-before'},201)
  const result=shortage.data.result
  assert.equal(result.newCashBeforeTaxCents,4260);assert.equal(result.reportedTipsCents,60000);assert.equal(result.netCashCents,0)
  assert.deepEqual(result.regular,{socialSecurityCents:264,medicareCents:62,additionalMedicareCents:0,incomeTaxCents:0})
  assert.deepEqual(result.order,[{kind:'regular-wage-taxes',dueCents:326,collectedCents:326},{kind:'tip-social-security-and-medicare',dueCents:4590,collectedCents:3934},{kind:'tip-income-tax',dueCents:3519,collectedCents:0}])
  assert.deepEqual(result.uncollected,{socialSecurityCents:532,medicareCents:124,additionalMedicareCents:0,incomeTaxCents:3519})
  assert.deepEqual(result.employer,{socialSecurityCents:3984,medicareCents:932})
  assert.deepEqual(result.reportingBasis,{form941:{line5bTipWagesCents:60000,line5bTaxCents:7440,line5cWagesCents:64260,line5cTaxCents:1864,line5dWagesCents:0,line5dTaxCents:0,line9AdjustmentCents:-656},form944:{line6AdjustmentCents:-656},w2Box12:{A:532,B:124}})
  assert.equal(shortage.data.collectionDeadline,'2026-02-10');assert.equal(shortage.data.collectionState,'open-collection-window');assert.equal(result.paymentReady,false)
  const paidTips=await data(secondTipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-paycheck-preview'},201)
  assert.equal(paidTips.data.result.newCashBeforeTaxCents,34260);assert.equal(paidTips.data.result.netCashCents,31309)
  assert.equal(paidTips.data.result.uncollected.socialSecurityCents,0)
  const capped=await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-cap',socialSecurityBeforeCents:18450000,medicareBeforeCents:20000000},201)
  assert.equal(capped.data.result.employer.socialSecurityCents,0)
  assert.equal(capped.data.result.reportingBasis.form941.line5dWagesCents,64260)
  assert.equal(capped.data.result.reportingBasis.form941.line5dTaxCents,578)
  assert.deepEqual(capped.data.result.reportingBasis.w2Box12,{A:0,B:0})
  await data(tipApi+'/tip-tax-funds',{...taxBody,id:'synthetic-envelope-tip-promise',amountCents:500,status:'promised',receiptRef:'Unreceived offer'},409)
  // Keep the synthetic owner's native session valid across the fixed collection window.
  await sql("UPDATE oa_sessions SET expires_at=1771545600000 WHERE operator_id IN (SELECT id FROM oa_operators WHERE role='owner')")
  await advanceClock('2026-02-09T12:00:00Z')
  const receiptBody={...taxBody,id:'synthetic-envelope-tip-receipt',amountCents:500,status:'received',receiptRef:'Employer-attested cash receipt synthetic-envelope-903'}
  const receipt=await data(tipApi+'/tip-tax-funds',receiptBody,201)
  assert.equal(receipt.data.receivedOn,'2026-02-09');assert.equal(receipt.data.provenance,'human-attested-received-funds')
  await data(tipApi+'/tip-tax-funds',receiptBody,409)
  await data(tipApi+'/tip-tax-funds',{...receiptBody,id:'synthetic-envelope-tip-alias'},409)
  await data(tipApi+'/tip-tax-funds',{...receiptBody,id:'synthetic-envelope-tip-excess',receiptRef:'synthetic-envelope-excess',amountCents:100000},409)
  // One physical receipt cannot fund another run or another worker.
  const nextTaxRun = 'synthetic-envelope-tip-next-run'
  const nextRows = taxRows.map(row => ({...row,sourceId:row.sourceId+'-next',...(row.code==='tip' ? {settlement:'cash',amountCents:60000} : {})}))
  const nextPreview = await data(taxDoor+'/preview',{id:nextTaxRun,version:0,namespace:'synthetic-envelope-next-tip-reports',rows:nextRows})
  await data(taxDoor+'/apply',{id:nextTaxRun,version:0,namespace:nextPreview.data.namespace,rows:nextPreview.data.rows,digest:nextPreview.digest,format:'grid'},201)
  const nextReview = await data(taxDoor+'/'+nextTaxRun+'/review')
  await data(taxDoor+'/'+nextTaxRun+'/approve',{version:1,reviewToken:nextReview.reviewToken})
  await data(taxPay+'/earnings-run',{id:nextTaxRun,version:0,groupId,periodStart:'2026-01-19',periodEnd:'2026-01-25',payDate:'2026-01-30',frequency:'weekly'},201)
  await data(tipApi+'/tip-tax-funds',{...receiptBody,id:'synthetic-envelope-cross-run-receipt',runId:nextTaxRun},409)
  await data(secondTipApi+'/tip-tax-funds',{...receiptBody,id:'synthetic-envelope-cross-person-receipt',runId:nextTaxRun,amountCents:1},409)
  const untouched = await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-next-run-unfunded',runId:nextTaxRun},201)
  assert.equal(untouched.data.result.furnishedCents,0)
  assert.equal(untouched.data.result.reportingBasis.form941.line9AdjustmentCents,-656)

  // Independent high-YTD fixture exercises Additional Medicare shortage reporting.
  const highRun = 'synthetic-envelope-tip-high-run'
  const highRows = taxRows.map(row => ({...row,sourceId:row.sourceId+'-high',...(row.code==='tip' && row.settlement==='cash' ? {amountCents:600000} : {})}))
  const highPreview = await data(taxDoor+'/preview',{id:highRun,version:0,namespace:'synthetic-envelope-high-tip-reports',rows:highRows})
  await data(taxDoor+'/apply',{id:highRun,version:0,namespace:highPreview.data.namespace,rows:highPreview.data.rows,digest:highPreview.digest,format:'grid'},201)
  const highReview = await data(taxDoor+'/'+highRun+'/review')
  await data(taxDoor+'/'+highRun+'/approve',{version:1,reviewToken:highReview.reviewToken})
  await data(taxPay+'/earnings-run',{id:highRun,version:0,groupId,periodStart:'2026-01-19',periodEnd:'2026-01-25',payDate:'2026-01-30',frequency:'weekly'},201)
  const highBasis = {...taxBody,runId:highRun,socialSecurityBeforeCents:18450000,medicareBeforeCents:20000000}
  const highBefore = await data(tipApi+'/tip-tax-previews',{...highBasis,id:'synthetic-envelope-high-before'},201)
  assert.equal(highBefore.data.result.uncollected.socialSecurityCents,0)
  assert.equal(highBefore.data.result.uncollected.medicareCents,4540)
  assert.equal(highBefore.data.result.uncollected.additionalMedicareCents,5400)
  assert.equal(highBefore.data.result.reportingBasis.form941.line9AdjustmentCents,-9940)
  assert.equal(highBefore.data.result.reportingBasis.form944.line6AdjustmentCents,-9940)
  assert.deepEqual(highBefore.data.result.reportingBasis.w2Box12,{A:0,B:4540})
  await data(tipApi+'/tip-tax-funds',{...highBasis,id:'synthetic-envelope-high-receipt',amountCents:500,status:'received',receiptRef:'synthetic-envelope-high-actual'},201)
  const highAfter = await data(tipApi+'/tip-tax-previews',{...highBasis,id:'synthetic-envelope-high-after'},201)
  assert.equal(highAfter.data.result.uncollected.medicareCents,4040)
  assert.equal(highAfter.data.result.uncollected.additionalMedicareCents,5400)
  assert.equal(highAfter.data.result.reportingBasis.form941.line9AdjustmentCents,-9440)
  assert.equal(highAfter.data.result.reportingBasis.form944.line6AdjustmentCents,-9440)
  assert.deepEqual(highAfter.data.result.reportingBasis.w2Box12,{A:0,B:4040})
  const crossRunRace = await Promise.all([
    {...highBasis,id:'synthetic-envelope-receipt-race-high'},
    {...taxBody,runId:nextTaxRun,id:'synthetic-envelope-receipt-race-next'},
  ].map(basis => call(tipApi+'/tip-tax-funds',{...basis,amountCents:1,status:'received',receiptRef:'synthetic-envelope-one-physical-receipt'})))
  assert.deepEqual(crossRunRace.map(r=>r.status).sort(),[201,409],'Concurrent different runs may claim one physical receipt only once')

  const reduced=await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-after'},201)
  assert.equal(reduced.data.result.furnishedCents,500);assert.equal(reduced.data.result.uncollected.socialSecurityCents,126);assert.equal(reduced.data.result.uncollected.medicareCents,30)
  assert.equal(reduced.data.result.reportingBasis.form941.line9AdjustmentCents,-156);assert.equal(reduced.data.result.netCashCents,0)
  assert.deepEqual(reduced.data.result.employer,{socialSecurityCents:3984,medicareCents:932})
  const raced=await Promise.all(['a','b'].map(suffix=>call(tipApi+'/tip-tax-funds',{...receiptBody,id:'synthetic-envelope-tip-race-'+suffix,receiptRef:'synthetic-envelope-race-'+suffix,amountCents:3000})))
  assert.deepEqual(raced.map(r=>r.status).sort(),[201,409],'Concurrent receipts cannot allocate the same remaining shortage twice')
  const afterRace=await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-after-race'},201)
  assert.equal(afterRace.data.result.furnishedCents,3500);assert.equal(afterRace.data.result.uncollected.incomeTaxCents,675)
  await advanceClock('2026-02-11T00:00:01Z')
  const closed=await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-closed'},201)
  assert.equal(closed.data.collectionState,'closed-report-uncollected');assert.deepEqual(closed.data.result,afterRace.data.result)
  await data(tipApi+'/tip-tax-funds',{...receiptBody,id:'synthetic-envelope-tip-late'},409)
  const history=await data(tipApi+'/tip-tax-previews')
  assert.deepEqual(history.find(r=>r.id===shortage.id).data.result,result,'Received funds never rewrite the prior snapshot')
  await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-stale',runVersion:2},409)
  await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-private'},401,'')
  await setupTax('pay-item','synthetic-envelope-tip-deduction',{name:'Unreviewed legal deduction treatment',groupId,amountCents:10000,taxCode:'after-tax-deduction',effectiveDate:'2026-01-01',recurring:true})
  await data(taxPay+'/earnings-run',{id:taxRunId,version:1,groupId,periodStart:'2026-01-19',periodEnd:'2026-01-25',payDate:'2026-01-30',frequency:'weekly'},201)
  await data(tipApi+'/tip-tax-previews',{...taxBody,id:'synthetic-envelope-tip-deduction-preview',runVersion:2},409)
  await advanceClock('2026-01-31T12:00:00Z')
  const company = await data(
      '/api/envelope/companies',
      { name: 'Synthetic run intake employer', ein: '00-0000800' },
      201
    ),
    api = '/api/envelope/companies/' + company.id
  const location = await data(
    api + '/locations',
    { name: 'Intake workplace', state: 'CO' },
    201
  )
  const people = []
  for (const name of [
    'Synthetic server one',
    'Synthetic server two',
    'Synthetic worker three',
  ])
    people.push(
      await data(api + '/people', { name, locationId: location.id }, 201)
    )
  const pay = api + '/pay-settings',
    door = pay + '/intake',
    runId = 'synthetic-envelope-800',
    namespace = 'synthetic-envelope-801'
  const setup = async (kind, id, body) => {
    await data(pay + '/' + kind, { id, version: 0, ...body }, 201)
    const r = await data(pay + '/review/' + kind + '/' + id)
    await data(pay + '/' + kind + '/' + id + '/approve', {
      version: r.version,
      reviewToken: r.reviewToken,
    })
  }
  await setup('group', 'synthetic-envelope-802', {
    name: 'Intake group',
    people: people.map((p) => p.id),
  })
  await setup('pay-change', 'synthetic-envelope-803', {
    name: 'Reviewed hourly rates',
    groupId: 'synthetic-envelope-802',
    effectiveDate: '2026-01-01',
    items: people.map((p) => ({
      personId: p.id,
      personVersion: p.version,
      rateCents: 1000,
      basis: 'hourly',
      employmentFrom: '2026-01-01',
      employmentThrough: '2027-12-31',
      unpaidDates: [],
    })),
  })
  const base = {
    day: '2026-11-02',
    workweek: '2026-11-02',
    code: 'regular',
    minutes: 0,
    amountCents: 0,
    settlement: '',
    evidence: 'synthetic-envelope-804',
    state: '',
    riskClass: '',
  }
  const rows = people.map((p, i) => ({
    ...base,
    sourceId: 'synthetic-envelope-' + (810 + i),
    personId: p.id,
    minutes: [480, 60, 120][i],
  }))
  rows.push(
    {
      ...base,
      sourceId: 'synthetic-envelope-813',
      personId: people[0].id,
      code: 'tip',
      amountCents: 60000,
      settlement: 'cash',
    },
    {
      ...base,
      sourceId: 'synthetic-envelope-814',
      personId: people[1].id,
      code: 'tip',
      amountCents: 30000,
      settlement: 'paycheck',
    },
    {
      ...base,
      sourceId: 'synthetic-envelope-815',
      personId: people[2].id,
      code: 'bonus',
      amountCents: 10000,
    },
    {
      ...base,
      sourceId: 'synthetic-envelope-816',
      personId: people[2].id,
      code: 'reimbursement',
      amountCents: 2500,
    }
  )
  const preview = (body) =>
    data(door + '/preview', { id: runId, namespace, ...body })
  const apply = (p) =>
    data(
      door + '/apply',
      {
        id: p.id,
        version: p.version,
        namespace: p.data.namespace,
        rows: p.data.rows,
        digest: p.digest,
        fileDigest: p.data.fileDigest,
        format: p.data.format,
      },
      201
    )
  const approve = async (version) => {
    const r = await data(door + '/' + runId + '/review')
    assert.equal(r.version, version)
    await data(door + '/' + runId + '/approve', {
      version,
      reviewToken: r.reviewToken,
    })
  }
  const run = (version) =>
    data(
      pay + '/earnings-run',
      {
        id: runId,
        version,
        groupId: 'synthetic-envelope-802',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-15',
        payDate: '2026-11-16',
        frequency: 'biweekly',
      },
      201
    )
  await data(
    door + '/preview',
    {
      id: runId,
      namespace,
      version: 0,
      rows: [{ ...rows[3], settlement: '' }],
    },
    409
  )
  await data(
    door + '/preview',
    {
      id: runId,
      namespace,
      version: 0,
      rows: [{ ...rows[0], personId: 'synthetic-envelope-unknown' }],
    },
    409
  )
  await data(
    door + '/preview',
    { id: runId, namespace, version: 0, rows: [rows[0], rows[0]] },
    400
  )
  const initial = await preview({ version: 0, rows })
  assert.equal(
    initial.cells.filter((c) => c.field === 'amountCents' && c.after === 60000)
      .length,
    1
  )
  await apply(initial)
  await data(
    pay + '/earnings-run',
    {
      id: runId,
      version: 0,
      groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02',
      periodEnd: '2026-11-15',
      payDate: '2026-11-16',
      frequency: 'biweekly',
    },
    409
  )
  await approve(1)
  const first = await run(0)
  assert.equal(
    first.preview.grossCashCents,
    53500,
    'already-held tips add no second payout'
  )
  assert.deepEqual(
    first.preview.people.map((p) => [
      p.earningsCents,
      p.cashTipsCents,
      p.paycheckTipsCents,
      p.reimbursementCents,
    ]),
    [
      [8000, 60000, 0, 0],
      [1000, 0, 30000, 0],
      [12000, 0, 0, 2500],
    ]
  )
  assert.equal(first.preview.taxAmounts, null)
  assert.equal(first.preview.paymentReady, false)
  const replay = await apply(await preview({ version: 1, rows }))
  assert.equal(replay.replayed, true)
  assert.equal(replay.version, 1)
  await data(
    door + '/preview',
    {
      id: 'synthetic-envelope-duplicate-run',
      namespace,
      version: 0,
      rows: [rows[0]],
    },
    409
  )
  await data(
    pay + '/earnings-run',
    {
      id: 'synthetic-envelope-second-run',
      intakeRunId: runId,
      version: 0,
      groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02',
      periodEnd: '2026-11-15',
      payDate: '2026-11-16',
      frequency: 'biweekly',
    },
    409
  )

  // The provider captures enter the same public run door, then require exact native review.
  // Source tender is deliberately independent from the reviewed settlement mapping.
  for (const provider of ['lanyard', 'toast']) {
    const providerRun = 'synthetic-envelope-' + provider + '-run'
    const mappings = {}, payload = provider === 'toast' ? [] : {
      id: 'synthetic-envelope-batch', revision: 2, status: 'exported',
      exportedBy: 'synthetic-envelope-manager', exportedAt: '2026-11-09T12:00:00Z', lines: [],
    }
    for (let i = 0; i < 2; i++) {
      const source = 'synthetic-envelope-provider-' + i, worker = 'synthetic-envelope-source-worker-' + i
      const mapping = { sourcePersonId: worker, personId: people[i].id,
        day: '2026-11-02', workweek: '2026-11-02' }
      if (provider === 'toast') {
        payload.push({ guid: source, employeeReference: { guid: worker },
          inDate: '2026-11-02T09:00:00Z', outDate: '2026-11-02T17:00:00Z',
          businessDate: '20261102', deleted: false, autoClockedOut: false,
          regularHours: 8, overtimeHours: 0, declaredCashTips: 0, nonCashTips: [600,300][i],
          cashGratuityServiceCharges: 0, nonCashGratuityServiceCharges: 0, tipsWithheld: 0,
          nonCashTipsRoundingLoss: 0 })
        mappings[source] = { ...mapping, settlements: { declaredCashTips: 'cash', nonCashTips: ['cash','paycheck'][i] } }
      } else {
        payload.lines.push({ timeId: source, payrollId: worker, start: '2026-11-02T09:00:00Z',
          end: '2026-11-02T17:00:00Z', minutes: 480, revision: 1 })
        payload.lines.push({ payInputId: source + '-tip', payrollId: worker, start: '2026-11-02T12:00:00Z',
          minutes: 0, costCents: [60000,30000][i], payCode: 'tips', revision: 1 })
        mappings[source] = mapping
        mappings[source + '-tip'] = { ...mapping, settlement: ['cash','paycheck'][i] }
      }
    }
    // Complete five-day week; tips occur once on the first day, not on every imported shift.
    for (const day of ['03','04','05','06']) for (let i = 0; i < 2; i++) {
      const source = 'synthetic-envelope-provider-' + i + '-' + day, worker = 'synthetic-envelope-source-worker-' + i
      const mapping = { sourcePersonId: worker, personId: people[i].id, day: '2026-11-' + day, workweek: '2026-11-02' }
      if (provider === 'toast') {
        payload.push({ guid: source, employeeReference: { guid: worker },
          inDate: '2026-11-' + day + 'T09:00:00Z', outDate: '2026-11-' + day + 'T17:00:00Z',
          businessDate: '202611' + day, deleted: false, autoClockedOut: false,
          regularHours: 8, overtimeHours: 0, declaredCashTips: 0, nonCashTips: 0 })
        mappings[source] = { ...mapping, settlements: { declaredCashTips: 'cash', nonCashTips: 'cash' } }
      } else {
        payload.lines.push({ timeId: source, payrollId: worker, start: '2026-11-' + day + 'T09:00:00Z',
          end: '2026-11-' + day + 'T17:00:00Z', minutes: 480, revision: 1 })
        mappings[source] = mapping
      }
    }
    const capture = { provider, account: 'synthetic-envelope-workplace', payload, mappings,
      evidence: 'synthetic-envelope-reviewed-export' }
    const body = { id: providerRun, version: 0, providerCapture: capture }
    const diff = await data(door + '/preview', body)
    assert.equal(diff.data.namespace, provider + ':synthetic-envelope-workplace')
    assert.equal(diff.data.providerCapture.sourceDigest, createHash('sha256').update(JSON.stringify(payload)).digest('hex'))
    assert.equal(diff.data.rows.filter(r => r.code === 'regular').reduce((n,r) => n + r.minutes, 0), 4800)
    assert.deepEqual(diff.data.rows.filter(r => r.code === 'tip' && r.amountCents).map(r => [r.personId,r.amountCents,r.settlement]),
      [[people[0].id,60000,'cash'],[people[1].id,30000,'paycheck']])
    await data(door + '/apply', { ...body, digest: diff.digest }, 201)
    const reviewProvider = async version => {
      const exact = await data(door + '/' + providerRun + '/review')
      await data(door + '/' + providerRun + '/approve', { version, reviewToken: exact.reviewToken })
    }
    await reviewProvider(1)
    const runBody = { id: providerRun, version: 0, groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02', periodEnd: '2026-11-15', payDate: '2026-11-16', frequency: 'biweekly' }
    const frozen = await data(pay + '/earnings-run', runBody, 201)
    assert.equal(frozen.preview.grossCashCents, 110000)
    assert.deepEqual(frozen.preview.people.map(p => [p.earningsCents,p.cashTipsCents,p.paycheckTipsCents]),
      [[40000,60000,0],[40000,0,30000],[0,0,0]])
    const replayDiff = await data(door + '/preview', { ...body, version: 1 })
    assert.equal((await data(door + '/apply', { ...body, version: 1, digest: replayDiff.digest }, 201)).replayed, true)
    await data(door + '/preview', { ...body, id: providerRun + '-duplicate' }, 409)
    if (provider === 'lanyard') {
      const renamedBatch = structuredClone(capture)
      renamedBatch.payload.id = 'synthetic-envelope-another-batch'
      await data(door + '/preview', { ...body, id: providerRun + '-renamed', providerCapture: renamedBatch }, 409)
    }
    const omitted = structuredClone(capture)
    if (provider === 'toast') omitted.payload.pop()
    else omitted.payload.lines.pop()
    await data(door + '/preview', { ...body, version: 1, providerCapture: omitted }, 409)
    const unknown = structuredClone(capture)
    Object.values(unknown.mappings)[0].personId = 'synthetic-envelope-unknown'
    await data(door + '/preview', { ...body, version: 1, providerCapture: unknown }, 409)
    const ambiguous = structuredClone(capture)
    if (provider === 'toast') delete Object.values(ambiguous.mappings)[0].settlements.nonCashTips
    else delete ambiguous.mappings['synthetic-envelope-provider-0-tip'].settlement
    await data(door + '/preview', { ...body, version: 1, providerCapture: ambiguous }, 409)
    // A settlement-only source edit creates a visible delta and makes the frozen earnings stale.
    const changed = structuredClone(capture)
    if (provider === 'toast') changed.mappings['synthetic-envelope-provider-0'].settlements.nonCashTips = 'paycheck'
    else changed.mappings['synthetic-envelope-provider-0-tip'].settlement = 'paycheck'
    const changedBody = { ...body, version: 1, providerCapture: changed }
    const changedDiff = await data(door + '/preview', changedBody)
    assert.deepEqual(changedDiff.cells.filter(c => c.status === 'change').map(c => [c.field,c.before,c.after]),
      [['settlement','cash','paycheck']])
    await data(door + '/apply', { ...changedBody, digest: changedDiff.digest }, 201)
    await data(pay + '/earnings-run', { ...runBody, version: 1 }, 409)
    await data(door + '/preview', { id: providerRun, namespace: diff.data.namespace, version: 2, rows: diff.data.rows }, 409)
    await reviewProvider(2)
    const revised = await data(pay + '/earnings-run', { ...runBody, version: 1 }, 201)
    assert.equal(revised.preview.grossCashCents, 170000)
    const retainedRuns = await data(pay)
    assert.equal(retainedRuns.runs.find(r => r.id === providerRun && r.version === 1).data.grossCashCents, 110000)
    await data(door + '/' + providerRun + '/withdraw', { version: 2 })
    await data(pay + '/earnings-run', { ...runBody, version: 2 }, 409)
    const unsupported = structuredClone(capture)
    if (provider === 'toast') unsupported.payload[0].nonCashGratuityServiceCharges = 25
    else unsupported.payload.lines[0].corrects = 'synthetic-envelope-prior'
    await data(door + '/preview', { ...body, version: 2, providerCapture: unsupported }, 409)
  }

  for (const provider of ['deputy','when-i-work']) {
    const sourceCapture = { provider, account: '8800', evidence: 'synthetic-envelope-reviewed-' + provider, mappings: {}, payload: [] }
    for (let day = 2; day <= 6; day++) for (let i = 0; i < 2; i++) {
      const id = 8801 + (day - 2) * 2 + i, worker = 8811 + i, localDay = '2026-11-0' + day
      sourceCapture.mappings[String(id)] = { sourcePersonId: String(worker), personId: people[i].id,
        day: localDay, workweek: '2026-11-02', settlement: ['cash','paycheck'][i] }
      sourceCapture.payload.push(provider === 'deputy' ? {
        Id: id, Employee: worker, Date: localDay, StartTime: Date.parse(localDay + 'T09:00:00Z') / 1000,
        EndTime: Date.parse(localDay + 'T10:00:00Z') / 1000, TotalTime: 1, TotalTimeInv: 1, TimeApproved: true, PayRuleApproved: true,
        TimeApprover: 8821, Discarded: false, IsLeave: false, isInProgress: false, ValidationFlag: 0,
      } : { id, user_id: worker, account_id: 8800, start_time: localDay + 'T09:00:00Z',
        end_time: localDay + 'T10:00:00Z', length: 1, is_approved: true, is_alerted: false, alert_type: 0,
        cash_tips: day === 2 ? ['600.00','300.00'][i] : '0.00' })
    }
    const sourceBody = { id: 'synthetic-envelope-' + provider + '-run', version: 0, providerCapture: sourceCapture }
    const sourceDiff = await data(door + '/preview', sourceBody)
    assert.deepEqual(sourceDiff.data.rows.filter(r => r.code === 'regular').map(r => r.minutes), Array(10).fill(60))
    await data(door + '/apply', { ...sourceBody, digest: sourceDiff.digest }, 201)
    const sourceReview = await data(door + '/' + sourceBody.id + '/review')
    await data(door + '/' + sourceBody.id + '/approve', { version: 1, reviewToken: sourceReview.reviewToken })
    const sourceRun = { id: sourceBody.id, version: 0, groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02', periodEnd: '2026-11-15', payDate: '2026-11-16', frequency: 'biweekly' }
    const expected = provider === 'deputy' ? 10000 : 40000
    assert.equal((await data(pay + '/earnings-run', sourceRun, 201)).preview.grossCashCents, expected)
    const sourceReplay = await data(door + '/preview', { ...sourceBody, version: 1 })
    assert.equal((await data(door + '/apply', { ...sourceBody, version: 1, digest: sourceReplay.digest }, 201)).replayed, true)
    await data(door + '/preview', { ...sourceBody, id: sourceBody.id + '-duplicate' }, 409)
    const unknown = structuredClone(sourceCapture); unknown.mappings['8801'].personId = 'synthetic-envelope-unknown'
    await data(door + '/preview', { ...sourceBody, version: 1, providerCapture: unknown }, 409)
    const unapproved = structuredClone(sourceCapture)
    if (provider === 'deputy') unapproved.payload[0].PayRuleApproved = false
    else unapproved.payload[0].is_approved = false
    await data(door + '/preview', { ...sourceBody, version: 1, providerCapture: unapproved }, 409)
    const corrected = structuredClone(sourceCapture)
    if (provider === 'deputy') corrected.payload[0].TotalTime = 0.5
    else corrected.payload[0].length = 0.5
    const changed = { ...sourceBody, version: 1, providerCapture: corrected }, changedDiff = await data(door + '/preview', changed)
    assert.deepEqual(changedDiff.cells.filter(c => c.status === 'change').map(c => [c.field,c.before,c.after]), [['minutes',60,30]])
    await data(door + '/apply', { ...changed, digest: changedDiff.digest }, 201)
    await data(pay + '/earnings-run', { ...sourceRun, version: 1 }, 409)
    const revisedReview = await data(door + '/' + sourceBody.id + '/review')
    await data(door + '/' + sourceBody.id + '/approve', { version: 2, reviewToken: revisedReview.reviewToken })
    assert.equal((await data(pay + '/earnings-run', { ...sourceRun, version: 1 }, 201)).preview.grossCashCents, expected - 500)
    assert.equal((await data(pay)).runs.find(r => r.id === sourceBody.id && r.version === 1).data.grossCashCents, expected)
    await data(door + '/' + sourceBody.id + '/withdraw', { version: 2 })
    await data(pay + '/earnings-run', { ...sourceRun, version: 2 }, 409)
  }

  const squareCapture = { provider: 'square', account: 'synthetic-envelope-square-location',
    evidence: 'synthetic-envelope-reviewed-square', mappings: {}, payload: [] }
  for (let day = 2; day <= 6; day++) for (let i = 0; i < 2; i++) {
    const id = 'synthetic-envelope-square-' + (day - 2) + '-' + i, worker = 'synthetic-envelope-square-worker-' + i, localDay = '2026-11-0' + day
    squareCapture.payload.push({ id, team_member_id: worker, location_id: squareCapture.account, version: 1, status: 'CLOSED',
      start_at: localDay + 'T09:00:00Z', end_at: localDay + 'T17:00:00Z',
      breaks: [{ start_at: localDay + 'T12:00:00Z', end_at: localDay + 'T12:30:00Z', is_paid: i === 1,
        break_type_id: 'synthetic-envelope-break-type', name: 'Synthetic meal break', expected_duration: 'PT30M' }],
      declared_cash_tip_money: { amount: day === 2 ? [60000,30000][i] : 0, currency: 'USD' } })
    squareCapture.mappings[id] = { sourcePersonId: worker, personId: people[i].id, day: localDay,
      workweek: '2026-11-02', settlement: ['cash','paycheck'][i] }
  }
  const squareBody = { id: 'synthetic-envelope-square-run', version: 0, providerCapture: squareCapture }
  const captureRefusals = [], browserRefusals = []
  const refuseCapture = async (body, label, error, screen) => {
    if (screen) browserRefusals.push({ body, error, screen })
    const before = await data(door), observed = []
    for (const route of ['preview', 'apply']) {
      const response = await call(door + '/' + route, { ...body, digest: 'synthetic-envelope-invalid-preview' })
      const result = await response.json()
      observed.push([route, response.status, result.error ?? null])
    }
    captureRefusals.push({ label, observed, expected: [['preview',409,error],['apply',409,error]] })
    assert.deepEqual(await data(door), before, label + ' writes no intake version')
  }
  const refuseWorkerIdentity = async (capture, entry, field, label) => {
    for (const value of [undefined, null, '', '   ', 42, {}, 'synthetic-envelope-'.repeat(10), 'synthetic-envelope-\u0001']) {
      const malformed = structuredClone(capture), [id, source] = entry(malformed)
      source[field] = value
      malformed.mappings[id].sourcePersonId = value
      await refuseCapture({ id: 'synthetic-envelope-invalid-worker', version: 0, providerCapture: malformed },
        label + ' refuses matched malformed identity ' + JSON.stringify(value), 'provider_worker_mapping_required',
        value === undefined ? label.toLowerCase() + '-missing-worker' : undefined)
    }
    for (const side of ['source', 'mapping']) {
      const malformed = structuredClone(capture), [id, source] = entry(malformed)
      if (side === 'source') delete source[field]
      else delete malformed.mappings[id].sourcePersonId
      await refuseCapture({ id: 'synthetic-envelope-invalid-worker', version: 0, providerCapture: malformed },
        label + ' refuses missing ' + side + ' identity', 'provider_worker_mapping_required')
    }
    const mismatch = structuredClone(capture), [id] = entry(mismatch)
    mismatch.mappings[id].sourcePersonId = 'synthetic-envelope-other-worker'
    await refuseCapture({ id: 'synthetic-envelope-invalid-worker', version: 0, providerCapture: mismatch },
      label + ' refuses a different source worker', 'provider_worker_mapping_required')
  }
  await refuseWorkerIdentity(squareCapture, c => [c.payload[0].id, c.payload[0]], 'team_member_id', 'Square')
  const squareDiff = await data(door + '/preview', squareBody)
  assert.deepEqual(squareDiff.data.rows.filter(r => r.code === 'regular').map(r => r.minutes), [450,480,450,480,450,480,450,480,450,480])
  await data(door + '/apply', { ...squareBody, digest: squareDiff.digest }, 201)
  const squareReview = await data(door + '/' + squareBody.id + '/review')
  await data(door + '/' + squareBody.id + '/approve', { version: 1, reviewToken: squareReview.reviewToken })
  const squareRun = { id: squareBody.id, version: 0, groupId: 'synthetic-envelope-802',
    periodStart: '2026-11-02', periodEnd: '2026-11-15', payDate: '2026-11-16', frequency: 'biweekly' }
  assert.equal((await data(pay + '/earnings-run', squareRun, 201)).preview.grossCashCents, 107500)
  const squareUnknown = structuredClone(squareCapture); Object.values(squareUnknown.mappings)[0].personId = 'synthetic-envelope-unknown'
  await data(door + '/preview', { ...squareBody, version: 1, providerCapture: squareUnknown }, 409)
  await data(door + '/preview', { ...squareBody, id: squareBody.id + '-duplicate' }, 409)
  const squareReplay = await data(door + '/preview', { ...squareBody, version: 1 })
  assert.equal((await data(door + '/apply', { ...squareBody, version: 1, digest: squareReplay.digest }, 201)).replayed, true)
  const openSquare = structuredClone(squareCapture); openSquare.payload[0].status = 'OPEN'
  await data(door + '/preview', { ...squareBody, version: 1, providerCapture: openSquare }, 409)
  const overlapping = structuredClone(squareCapture); overlapping.payload[0].breaks.push(overlapping.payload[0].breaks[0])
  await data(door + '/preview', { ...squareBody, version: 1, providerCapture: overlapping }, 409)
  const squareChangedCapture = structuredClone(squareCapture); squareChangedCapture.payload[0].breaks[0].is_paid = true
  squareChangedCapture.payload[0].version = 2
  const squareChanged = { ...squareBody, version: 1, providerCapture: squareChangedCapture }
  const squareChangedDiff = await data(door + '/preview', squareChanged)
  assert.deepEqual(squareChangedDiff.cells.filter(c => c.status === 'change').map(c => [c.field,c.before,c.after]), [['minutes',450,480]])
  await data(door + '/apply', { ...squareChanged, digest: squareChangedDiff.digest }, 201)
  await data(pay + '/earnings-run', { ...squareRun, version: 1 }, 409)
  const squareCorrectedReview = await data(door + '/' + squareBody.id + '/review')
  await data(door + '/' + squareBody.id + '/approve', { version: 2, reviewToken: squareCorrectedReview.reviewToken })
  assert.equal((await data(pay + '/earnings-run', { ...squareRun, version: 1 }, 201)).preview.grossCashCents, 108000)
  assert.equal((await data(pay)).runs.find(r => r.id === squareBody.id && r.version === 1).data.grossCashCents, 107500)
  await data(door + '/' + squareBody.id + '/withdraw', { version: 2 })
  await data(pay + '/earnings-run', { ...squareRun, version: 2 }, 409)

  const clockifyCapture = { provider: 'clockify', account: 'synthetic-envelope-clockify-workspace',
    evidence: 'synthetic-envelope-reviewed-clockify', mappings: {}, payload: [] }
  for (let day = 2; day <= 6; day++) for (let i = 0; i < 2; i++) {
    const id = 'synthetic-envelope-clockify-' + (day - 2) + '-' + i, user = 'synthetic-envelope-clockify-user-' + i, localDay = '2026-11-0' + day
    clockifyCapture.payload.push({ id, userId: user, workspaceId: clockifyCapture.account, type: 'REGULAR', isLocked: true,
      timeInterval: { start: localDay + 'T09:00:00Z', end: localDay + 'T17:00:00Z', duration: '28800' } })
    clockifyCapture.mappings[id] = { sourcePersonId: user, personId: people[i].id, day: localDay, workweek: '2026-11-02' }
  }
  const clockifyBody = { id: 'synthetic-envelope-clockify-run', version: 0, providerCapture: clockifyCapture }
  const clockifyDiff = await data(door + '/preview', clockifyBody)
  assert.deepEqual(clockifyDiff.data.rows.map(r => [r.personId,r.minutes,r.amountCents,r.code]),
    [2,3,4,5,6].flatMap(() => [[people[0].id,480,0,'regular'],[people[1].id,480,0,'regular']]))
  await data(door + '/apply', { ...clockifyBody, digest: clockifyDiff.digest }, 201)
  const clockifyReview = await data(door + '/' + clockifyBody.id + '/review')
  await data(door + '/' + clockifyBody.id + '/approve', { version: 1, reviewToken: clockifyReview.reviewToken })
  const clockifyRun = { id: clockifyBody.id, version: 0, groupId: 'synthetic-envelope-802',
    periodStart: '2026-11-02', periodEnd: '2026-11-15', payDate: '2026-11-16', frequency: 'biweekly' }
  assert.equal((await data(pay + '/earnings-run', clockifyRun, 201)).preview.grossCashCents, 80000)
  const clockifyUnknown = structuredClone(clockifyCapture); Object.values(clockifyUnknown.mappings)[0].personId = 'synthetic-envelope-unknown'
  await data(door + '/preview', { ...clockifyBody, version: 1, providerCapture: clockifyUnknown }, 409)
  await data(door + '/preview', { ...clockifyBody, id: clockifyBody.id + '-duplicate' }, 409)
  const clockifyReplay = await data(door + '/preview', { ...clockifyBody, version: 1 })
  assert.equal((await data(door + '/apply', { ...clockifyBody, version: 1, digest: clockifyReplay.digest }, 201)).replayed, true)
  const unlocked = structuredClone(clockifyCapture); unlocked.payload[0].isLocked = false
  await data(door + '/preview', { ...clockifyBody, version: 1, providerCapture: unlocked }, 409)
  const badInterval = structuredClone(clockifyCapture); badInterval.payload[0].timeInterval.duration = '1'
  await data(door + '/preview', { ...clockifyBody, version: 1, providerCapture: badInterval }, 409)
  const clockifyCorrected = structuredClone(clockifyCapture)
  clockifyCorrected.payload[0].timeInterval.end = '2026-11-02T16:00:00Z'
  clockifyCorrected.payload[0].timeInterval.duration = '25200'
  const clockifyChanged = { ...clockifyBody, version: 1, providerCapture: clockifyCorrected }
  const clockifyCorrection = await data(door + '/preview', clockifyChanged)
  assert.deepEqual(clockifyCorrection.cells.filter(c => c.status === 'change').map(c => [c.field,c.before,c.after]), [['minutes',480,420]])
  await data(door + '/apply', { ...clockifyChanged, digest: clockifyCorrection.digest }, 201)
  await data(pay + '/earnings-run', { ...clockifyRun, version: 1 }, 409)
  const clockifyCorrectedReview = await data(door + '/' + clockifyBody.id + '/review')
  await data(door + '/' + clockifyBody.id + '/approve', { version: 2, reviewToken: clockifyCorrectedReview.reviewToken })
  assert.equal((await data(pay + '/earnings-run', { ...clockifyRun, version: 1 }, 201)).preview.grossCashCents, 79000)
  assert.equal((await data(pay)).runs.find(r => r.id === clockifyBody.id && r.version === 1).data.grossCashCents, 80000)
  await data(door + '/' + clockifyBody.id + '/withdraw', { version: 2 })
  await data(pay + '/earnings-run', { ...clockifyRun, version: 2 }, 409)

  for (const provider of ['homebase','7shifts','quickbooks-time','clover']) {
    const entries = [], mappings = {}, users = {}, jobcodes = { '8900': { id: 8900, type: 'regular' } }
    for (let day = 2; day <= 6; day++) for (let i = 0; i < 2; i++) {
      const id = 89000 + day * 10 + i, worker = 8911 + i, localDay = '2026-11-0' + day
      const start = localDay + 'T09:00:00Z', end = localDay + (i ? 'T17:00:00Z' : 'T16:30:00Z')
      const tip = day === 2 ? [60000,30000][i] : 0
      mappings[String(id)] = { sourcePersonId: String(worker), personId: people[i].id, day: localDay,
        workweek: '2026-11-02', settlement: ['cash','paycheck'][i], settlements: { cash_tips: 'cash', credit_tips: ['cash','paycheck'][i] } }
      users[String(worker)] = { id: worker, active: true, approved_to: '2026-11-06' }
      if (provider === 'homebase') entries.push({ id, user_id: worker, approved: true,
        clock_in: start, clock_out: localDay + 'T17:00:00Z', updated_at: localDay + 'T18:00:00Z',
        timebreaks: [{ id: id + 1000, timecard_id: id, paid: i === 1,
          start_at: localDay + 'T12:00:00Z', end_at: localDay + 'T12:30:00Z' }],
        labor: { regular_hours: i ? 8 : 7.5, weekly_overtime: 0, paid_hours: i ? 8 : 7.5,
          cash_tips: 0, credit_tips: tip / 100, break_penalty: 0, paid_time_off_hours: 0, time_off_hours: 0 } })
      if (provider === '7shifts') entries.push({ id, company_id: 8900, user_id: worker, location_id: 8901,
        approved: true, deleted: false, auto_clocked_out: false, clocked_in: start, clocked_out: localDay + 'T17:00:00Z', tips: tip,
        modified: localDay + 'T18:00:00Z', breaks: [{ id: id + 1000, user_id: worker, paid: i === 1,
          in: localDay + 'T12:00:00Z', out: localDay + 'T12:30:00Z' }] })
      if (provider === 'quickbooks-time') entries.push({ id, user_id: worker, jobcode_id: 8900, type: 'regular',
        start, end, date: localDay, duration: i ? 28800 : 27000, on_the_clock: false, locked: 0,
        last_modified: localDay + 'T18:00:00Z' })
      if (provider === 'clover') entries.push({ id: String(id), employee: { id: String(worker) },
        inTime: Date.parse(start), outTime: Date.parse(end), cashTipsCollected: tip, serverBanking: i === 0 })
    }
    const payload = provider === '7shifts' ? { data: entries, object: 'time_punches', meta: { cursor: { prev: null, next: null } } }
      : provider === 'quickbooks-time' ? { results: { timesheets: Object.fromEntries(entries.map(e => [e.id,e])) },
        more: false, supplemental_data: { users, jobcodes } } : provider === 'clover' ? { elements: entries } : entries
    const source = { provider, account: '8900', currency: 'USD', evidence: 'synthetic-envelope-reviewed-' + provider, payload, mappings }
    const body = { id: 'synthetic-envelope-' + provider + '-run', version: 0, providerCapture: source }
    if (provider === 'clover') await refuseWorkerIdentity(source,
      c => [c.payload.elements[0].id, c.payload.elements[0].employee], 'id', 'Clover')
    if (provider === '7shifts') {
      for (const cursor of [
        { current: 'synthetic-envelope-final', prev: 'synthetic-envelope-previous', next: null, count: 1 },
        { prev: null, next: 'synthetic-envelope-next' },
        { next: null }, { prev: null }, { prev: '', next: null }, { prev: null, next: '' },
      ]) {
        const incomplete = structuredClone(source)
        incomplete.payload.data = [incomplete.payload.data.at(-1)]
        incomplete.mappings = { [incomplete.payload.data[0].id]: incomplete.mappings[incomplete.payload.data[0].id] }
        incomplete.payload.meta.cursor = cursor
        await refuseCapture({ ...body, id: body.id + '-incomplete', providerCapture: incomplete },
          '7shifts refuses incomplete cursor ' + JSON.stringify(cursor), 'complete_provider_capture_required',
          cursor.prev ? '7shifts-final-page' : undefined)
      }
    }
    const preview = await data(door + '/preview', body)
    assert.deepEqual(preview.data.rows.filter(r => r.code === 'regular').map(r => [r.personId,r.minutes]),
      [2,3,4,5,6].flatMap(() => [[people[0].id,450],[people[1].id,480]]), provider + ' reconciles the explicit five-day workweek')
    assert.equal(preview.data.providerCapture.sourceDigest, createHash('sha256').update(JSON.stringify(payload)).digest('hex'))
    if (provider !== 'quickbooks-time') assert.deepEqual(preview.data.rows.filter(r => r.code === 'tip' && r.amountCents).map(r => [r.personId,r.amountCents,r.settlement]),
      [[people[0].id,60000,'cash'],[people[1].id,30000,'paycheck']], provider + ' preserves cents and settlement')
    await data(door + '/apply', { ...body, digest: preview.digest }, 201)
    const run = { id: body.id, version: 0, groupId: 'synthetic-envelope-802',
      periodStart: '2026-11-02', periodEnd: '2026-11-15', payDate: '2026-11-16', frequency: 'biweekly' }
    await data(pay + '/earnings-run', run, 409, cookie)
    const approveSource = async version => {
      const review = await data(door + '/' + body.id + '/review')
      await data(door + '/' + body.id + '/approve', { version, reviewToken: review.reviewToken })
    }
    await approveSource(1)
    const expected = provider === 'quickbooks-time' ? 77500 : 107500
    assert.equal((await data(pay + '/earnings-run', run, 201)).preview.grossCashCents, expected)
    const replay = await data(door + '/preview', { ...body, version: 1 })
    assert.equal((await data(door + '/apply', { ...body, version: 1, digest: replay.digest }, 201)).replayed, true)
    const beforeRefusals = await data(door)
    await data(door + '/preview', { ...body, id: body.id + '-duplicate' }, 409)
    const unknown = structuredClone(source); unknown.mappings['89020'].personId = 'synthetic-envelope-unknown'
    await data(door + '/preview', { ...body, version: 1, providerCapture: unknown }, 409)
    const badSource = structuredClone(source)
    if (provider === 'homebase') badSource.payload[0].approved = false
    if (provider === '7shifts') badSource.payload.data[0].approved = false
    if (provider === 'quickbooks-time') {
      badSource.payload.supplemental_data.users['8911'].approved_to = '2026-11-01'
      badSource.payload.results.timesheets['89020'].locked = 1
    }
    if (provider === 'clover') delete badSource.payload.elements[0].outTime
    await data(door + '/preview', { ...body, version: 1, providerCapture: badSource }, 409)
    const unsafe = structuredClone(source)
    if (provider === 'homebase') unsafe.payload[0].labor.break_penalty = 1
    if (provider === '7shifts') unsafe.payload.data[0].breaks.push(unsafe.payload.data[0].breaks[0])
    if (provider === 'quickbooks-time') unsafe.payload.supplemental_data.jobcodes['8900'].type = 'pto'
    if (provider === 'clover') { unsafe.payload.elements[0].overrideOutTime = Date.parse('2026-11-02T16:00:00Z') }
    await data(door + '/preview', { ...body, version: 1, providerCapture: unsafe }, 409)
    if (provider === '7shifts' || provider === 'quickbooks-time') {
      const incomplete = structuredClone(source)
      if (provider === '7shifts') incomplete.payload.meta.cursor.next = 'synthetic-envelope-next-page'
      else incomplete.payload.more = true
      await data(door + '/preview', { ...body, version: 1, providerCapture: incomplete }, 409)
    }
    assert.deepEqual(await data(door), beforeRefusals, provider + ' refusals retain every prior source version')
    const corrected = structuredClone(source)
    if (provider === 'homebase') {
      corrected.payload[0].clock_out = '2026-11-02T16:30:00Z'
      corrected.payload[0].labor.regular_hours = 7; corrected.payload[0].labor.paid_hours = 7
    }
    if (provider === '7shifts') corrected.payload.data[0].clocked_out = '2026-11-02T16:30:00Z'
    if (provider === 'quickbooks-time') {
      corrected.payload.results.timesheets['89020'].end = '2026-11-02T16:00:00Z'
      corrected.payload.results.timesheets['89020'].duration = 25200
    }
    if (provider === 'clover') {
      corrected.payload.elements[0].overrideOutTime = Date.parse('2026-11-02T16:00:00Z')
      corrected.payload.elements[0].overrideOutEmployee = { id: 'synthetic-envelope-manager' }
    }
    const change = { ...body, version: 1, providerCapture: corrected }, difference = await data(door + '/preview', change)
    assert.deepEqual(difference.cells.filter(c => c.status === 'change').map(c => [c.sourceId,c.field,c.before,c.after]),
      [['89020:regular','minutes',450,420]], provider + ' identifies the exact source correction')
    await data(door + '/apply', { ...change, digest: difference.digest }, 201)
    await data(pay + '/earnings-run', { ...run, version: 1 }, 409)
    await approveSource(2)
    assert.equal((await data(pay + '/earnings-run', { ...run, version: 1 }, 201)).preview.grossCashCents, expected - 500)
    assert.equal((await data(pay)).runs.find(r => r.id === body.id && r.version === 1).data.grossCashCents, expected)
    if (provider !== 'quickbooks-time') {
      const settlement = structuredClone(corrected)
      if (provider === 'homebase') settlement.mappings['89020'].settlements.credit_tips = 'paycheck'
      else settlement.mappings['89020'].settlement = 'paycheck'
      const settlementBody = { ...body, version: 2, providerCapture: settlement }, diff = await data(door + '/preview', settlementBody)
      assert.deepEqual(diff.cells.filter(c => c.status === 'change').map(c => [c.field,c.before,c.after]), [['settlement','cash','paycheck']])
      await data(door + '/apply', { ...settlementBody, digest: diff.digest }, 201)
      await data(pay + '/earnings-run', { ...run, version: 2 }, 409)
      await approveSource(3)
      assert.equal((await data(pay + '/earnings-run', { ...run, version: 2 }, 201)).preview.grossCashCents, expected + 59500)
    }
    await data(door + '/' + body.id + '/withdraw', { version: provider === 'quickbooks-time' ? 2 : 3 })
    await data(pay + '/earnings-run', { ...run, version: provider === 'quickbooks-time' ? 2 : 3 }, 409)
  }

  assert.deepEqual(captureRefusals.map(({label,observed}) => [label,observed]),
    captureRefusals.map(({label,expected}) => [label,expected]), 'malformed captures refuse at both public intake doors')

  const allocated = await lanyardExportCases({data,door,pay,personId:people[0].id,origin,cookie})
  const caLocation = await data(api + '/locations', { name: 'California premium workplace', state: 'CA' }, 201)
  const caWorker = await data(api + '/people', { name: 'Synthetic premium worker', locationId: caLocation.id }, 201)
  await setup('group', 'synthetic-envelope-premium-group', { name: 'Premium review', people: [caWorker.id] })
  await setup('pay-change', 'synthetic-envelope-premium-rate', {
    name: 'California nonexempt ordinary rate', groupId: 'synthetic-envelope-premium-group', effectiveDate: '2026-01-01',
    items: [{ personId: caWorker.id, personVersion: caWorker.version, rateCents: 1000, basis: 'hourly',
      salaryType: 'nonexempt', employmentFrom: '2026-01-01', employmentThrough: '2027-12-31', unpaidDates: [] }] })
  const premiumRows = ['02','03','04','05','06'].map(day => ({ ...base,
    sourceId: 'synthetic-envelope-premium-work-' + day, personId: caWorker.id, day: '2026-11-' + day, minutes: 480 }))
  premiumRows.push({ ...base, sourceId: 'synthetic-envelope-premium-bonus', personId: caWorker.id,
    code: 'nondiscretionary-bonus', amountCents: 8000 })
  for (const code of ['meal-premium','rest-premium']) premiumRows.push({ ...base,
    sourceId: 'synthetic-envelope-' + code, personId: caWorker.id, code, minutes: 60, state: 'CA' })
  const premiumId = 'synthetic-envelope-premium-run', premiumBody = { id: premiumId, version: 0,
    namespace: 'synthetic-envelope-premiums', rows: premiumRows }
  const premiumDiff = await data(door + '/preview', premiumBody)
  await data(door + '/apply', { ...premiumBody, digest: premiumDiff.digest }, 201)
  const premiumReview = await data(door + '/' + premiumId + '/review')
  await data(door + '/' + premiumId + '/approve', { version: 1, reviewToken: premiumReview.reviewToken })
  const premiumRunBody = { id: premiumId, version: 0, groupId: 'synthetic-envelope-premium-group',
    periodStart: '2026-11-02', periodEnd: '2026-11-08', payDate: '2026-11-09', frequency: 'weekly' }
  const premiumResult = await data(pay + '/earnings-run', premiumRunBody, 201)
  // Independently: $400 straight wages + $80 allocated bonus over 40 worked hours = $12 per hour.
  // One meal and one rest premium are $12 each, without two fabricated worked hours.
  assert.equal(premiumResult.preview.grossCashCents, 50400)
  assert.deepEqual(premiumResult.preview.people[0].details.filter(d => /^California (meal|rest)-premium /.test(d)), [
    'California meal-premium 2026-11-02, source synthetic-envelope-meal-premium: 60 premium minutes, 1200 cents at the workweek regular rate; zero additional worked hours.',
    'California rest-premium 2026-11-02, source synthetic-envelope-rest-premium: 60 premium minutes, 1200 cents at the workweek regular rate; zero additional worked hours.' ])
  const premiumReplay = await data(door + '/preview', { ...premiumBody, version: 1 })
  assert.equal((await data(door + '/apply', { ...premiumBody, version: 1, digest: premiumReplay.digest }, 201)).replayed, true)
  await data(door + '/preview', { ...premiumBody, version: 1,
    rows: [{ ...premiumRows.at(-1), sourceId: 'synthetic-envelope-duplicate-rest' }] }, 409)
  await data(door + '/preview', { ...premiumBody, version: 1,
    rows: [{ ...premiumRows.at(-1), minutes: 120 }] }, 409)
  const removePremium = { ...premiumBody, version: 1, rows: [{ sourceId: 'synthetic-envelope-meal-premium', minutes: 0 }] }
  const removedDiff = await data(door + '/preview', removePremium)
  assert.deepEqual(removedDiff.cells.filter(c => c.status === 'change').map(c => [c.field,c.before,c.after]), [['minutes',60,0]])
  await data(door + '/apply', { ...removePremium, digest: removedDiff.digest }, 201)
  await data(pay + '/earnings-run', { ...premiumRunBody, version: 1 }, 409)
  const correctedPremiumReview = await data(door + '/' + premiumId + '/review')
  await data(door + '/' + premiumId + '/approve', { version: 2, reviewToken: correctedPremiumReview.reviewToken })
  assert.equal((await data(pay + '/earnings-run', { ...premiumRunBody, version: 1 }, 201)).preview.grossCashCents, 49200)
  assert.equal((await data(pay)).runs.find(r => r.id === premiumId && r.version === 1).data.grossCashCents, 50400)

  // Reviewed non-work pay and mandatory service charges stay distinct from worked time and tips.
  const earningWorker = await data(api + '/people', { name: 'Synthetic non-work earnings worker', locationId: location.id }, 201)
  const earningGroup = 'synthetic-envelope-nonwork-group'
  await setup('group', earningGroup, { name: 'Non-work earnings review', people: [earningWorker.id] })
  await setup('pay-change', 'synthetic-envelope-nonwork-rate', {
    name: 'Reviewed nonexempt rate', groupId: earningGroup, effectiveDate: '2026-01-01',
    items: [{ personId: earningWorker.id, personVersion: earningWorker.version, rateCents: 1000, basis: 'hourly',
      salaryType: 'nonexempt', employmentFrom: '2026-01-01', employmentThrough: '2027-12-31', unpaidDates: [] }] })
  const earningRunIds = []
  for (const format of ['grid','csv','xls','xlsx','toast','lanyard']) {
    const id = 'synthetic-envelope-nonwork-' + format, namespace = id + '-source'
    earningRunIds.push(id)
    const entries = ['02','03','04','05','06'].map(day => ({ ...base,
      sourceId: id + '-' + day, personId: earningWorker.id, day: '2026-11-' + day, minutes: 540,
      job: day === '02' ? 'synthetic-envelope-kitchen' : 'synthetic-envelope-floor' }))
    entries.push({ ...base, sourceId: id + '-service', personId: earningWorker.id, code: 'service-charge',
      amountCents: 9000, settlement: 'paycheck', job: 'synthetic-envelope-floor' },
      { ...base, sourceId: id + '-paid', personId: earningWorker.id, code: 'paid-leave', minutes: 480, amountCents: 8000 },
      { ...base, sourceId: id + '-unpaid', personId: earningWorker.id, code: 'unpaid-leave', minutes: 120 },
      { ...base, sourceId: id + '-bonus', personId: earningWorker.id, code: 'nondiscretionary-bonus', amountCents: 4500 })
    let body = { id, version: 0, namespace, rows: entries }, providerCapture
    if (format === 'toast' || format === 'lanyard') {
      const payload = format === 'toast' ? [] : { id: id + '-batch', revision: 1, status: 'exported',
        exportedBy: 'synthetic-envelope-payroll-reviewer', exportedAt: '2026-11-09T12:00:00Z', lines: [] }
      const mappings = {}
      for (const entry of entries.slice(0,5)) {
        const mapping = { personId: earningWorker.id, sourcePersonId: 'synthetic-envelope-nonwork-source-worker',
          day: entry.day, workweek: entry.workweek, job: entry.job }
        if (format === 'toast') {
          payload.push({ guid: entry.sourceId, employeeReference: { guid: mapping.sourcePersonId },
            inDate: entry.day + 'T08:00:00Z', outDate: entry.day + 'T17:00:00Z', businessDate: entry.day.replaceAll('-', ''),
            deleted: false, autoClockedOut: false, regularHours: 9, overtimeHours: 0,
            declaredCashTips: 0, nonCashTips: 0, cashGratuityServiceCharges: 0, nonCashGratuityServiceCharges: entry.day.endsWith('02') ? 90 : 0 })
          mappings[entry.sourceId] = { ...mapping, settlements: { declaredCashTips: 'cash', nonCashTips: 'cash', nonCashGratuityServiceCharges: 'paycheck' } }
        } else {
          payload.lines.push({ timeId: entry.sourceId, payrollId: mapping.sourcePersonId, revision: 1,
            start: entry.day + 'T08:00:00Z', end: entry.day + 'T17:00:00Z', minutes: 540, job: entry.job })
          mappings[entry.sourceId] = mapping
        }
      }
      if (format === 'lanyard') {
        payload.lines.push({ payInputId: id + '-paid', payrollId: 'synthetic-envelope-nonwork-source-worker', revision: 1,
          start: '2026-11-02T12:00:00Z', end: '2026-11-02T12:00:00Z', minutes: 480, costCents: 8000, payCode: 'PTO',
          approval: { by: 'synthetic-envelope-reviewer', at: '2026-11-09T12:00:00Z', reason: 'synthetic-envelope-approved-leave' } })
        mappings[id + '-paid'] = { personId: earningWorker.id, sourcePersonId: 'synthetic-envelope-nonwork-source-worker',
          day: '2026-11-02', workweek: '2026-11-02' }
      }
      providerCapture = { provider: format, account: id, evidence: 'synthetic-envelope-reviewed-nonwork-capture', payload, mappings }
      body = { id, version: 0, providerCapture }
    }
    const prepare = async request => {
      if (!['csv','xls','xlsx'].includes(format)) return data(door + '/preview', request)
      const response = await call(door + '/template?format=' + format)
      assert.equal(response.status, 200)
      const book = read(new Uint8Array(await response.arrayBuffer()), { type: 'array' })
      const headers = utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })[0]
      book.Sheets[book.SheetNames[0]] = utils.aoa_to_sheet([headers, ...request.rows.map(row => headers.map(key => row[key] ?? ''))])
      const form = new FormData()
      form.set('id', id); form.set('version', String(request.version)); form.set('namespace', namespace)
      form.set('file', new File([write(book, { type: 'array', bookType: format === 'xls' ? 'biff8' : format })], id + '.' + format))
      const result = await fetch(origin + door + '/preview', { method: 'POST', headers: { cookie, origin }, body: form })
      assert.equal(result.status, 200, await result.clone().text())
      return result.json()
    }
    const commitInput = async (request, diff) => data(door + '/apply', providerCapture ? { ...request, digest: diff.digest } : {
      id, version: request.version, namespace, rows: diff.data.rows, fileDigest: diff.data.fileDigest, format: diff.data.format, digest: diff.digest }, 201)
    const diff = await prepare(body)
    assert.equal(diff.data.rows.filter(row => row.code === 'regular').reduce((sum,row) => sum + row.minutes, 0), 2700)
    assert.equal(diff.data.rows.find(row => row.code === 'regular' && row.day === '2026-11-02').job, 'synthetic-envelope-kitchen')
    if (format !== 'toast') assert.equal(diff.data.rows.find(row => row.code === 'paid-leave').minutes, 480)
    await commitInput(body, diff)
    const reviewEarning = async version => {
      const review = await data(door + '/' + id + '/review')
      await data(door + '/' + id + '/approve', { version, reviewToken: review.reviewToken })
    }
    const runBody = { id, version: 0, groupId: earningGroup, periodStart: '2026-11-02', periodEnd: '2026-11-08',
      payDate: '2026-11-09', frequency: 'weekly' }
    await reviewEarning(1)
    const result = (await data(pay + '/earnings-run', runBody, 201)).preview
    // Independent 45 worked hours at $10. PTO is $80, not eight more worked hours.
    // Native: ($450 + $90 service wages + $45 bonus) / 45 = $13; half-time is $32.50.
    const expected = format === 'toast' ? 57000 : format === 'lanyard' ? 55500 : 69750
    assert.equal(result.grossCashCents, expected, format + ' exact wage, service and non-work totals')
    assert.equal(result.people[0].earningsCents, expected)
    assert.equal(result.people[0].cashTipsCents, 0, 'mandatory service charges never become declared tips')
    assert.equal(result.people[0].paycheckTipsCents, 0)
    assert.match(result.people[0].details.join(' '), /45 hours, 5 overtime hours/)
    assert.equal(result.paymentReady, false)
    assert.equal((await commitInput({ ...body, version: 1 }, await prepare({ ...body, version: 1 }))).replayed, true)
    let correction
    if (format === 'toast') {
      const changed = structuredClone(providerCapture)
      changed.payload[0].nonCashGratuityServiceCharges = 0
      correction = { ...body, version: 1, providerCapture: changed }
      const unsafe = structuredClone(providerCapture); unsafe.mappings[entries[0].sourceId].settlements.nonCashGratuityServiceCharges = 'cash'
      assert.equal((await data(door + '/preview', { ...body, version: 1, providerCapture: unsafe }, 409)).error, 'service_charge_unpaid_wage_evidence_required')
    } else if (format === 'lanyard') {
      const delta = structuredClone(providerCapture); delta.payload.lines.at(-1).revision = 2
      assert.equal((await data(door + '/preview', { ...body, version: 1, providerCapture: delta }, 409)).error,
        'provider_pay_code_review_required', 'a later PTO export is a delta, never a replacement amount')
      const unapprovedLeave = structuredClone(providerCapture); unapprovedLeave.payload.lines.at(-1).approval.at = 'not-a-date'
      assert.equal((await data(door + '/preview', { ...body, version: 1, providerCapture: unapprovedLeave }, 409)).error,
        'approved_provider_export_required')
      const changed = structuredClone(providerCapture)
      changed.payload.lines.at(-1).minutes = 240; changed.payload.lines.at(-1).costCents = 4000
      correction = { ...body, version: 1, providerCapture: changed }
    } else {
      correction = { ...body, version: 1, rows: [{ sourceId: id + '-service', amountCents: 0 }, { sourceId: id + '-paid', amountCents: '' }] }
      for (const settlement of ['', 'cash']) assert.equal((await data(door + '/preview', {
        ...body, version: 1, rows: [{ ...entries[5], sourceId: id + '-ambiguous-service', settlement }] }, 409)).error, 'service_charge_unpaid_wage_evidence_required')
      assert.equal((await data(door + '/preview', { ...body, version: 1,
        rows: [{ ...entries[7], amountCents: 100 }] }, 400)).error, 'unpaid_leave_cannot_create_pay')
    }
    const corrected = await prepare(correction)
    assert.ok(corrected.cells.some(cell => cell.status === 'change' && cell.field === 'amountCents'))
    if (!providerCapture) assert.equal(corrected.data.rows.find(row => row.code === 'paid-leave').amountCents, 8000, 'blank preserves reviewed leave pay')
    await commitInput(correction, corrected)
    await data(pay + '/earnings-run', { ...runBody, version: 1 }, 409)
    await reviewEarning(2)
    assert.equal((await data(pay + '/earnings-run', { ...runBody, version: 1 }, 201)).preview.grossCashCents,
      format === 'toast' ? 47500 : format === 'lanyard' ? 51500 : 60250)
    assert.equal((await data(pay)).runs.find(run => run.id === id && run.version === 1).data.grossCashCents, expected)
    await data(door + '/' + id + '/withdraw', { version: 2 })
    await data(pay + '/earnings-run', { ...runBody, version: 2 }, 409)
  }

  const jobEdit = { id: earningRunIds[0], version: 2, namespace: earningRunIds[0] + '-source',
    rows: [{ sourceId: earningRunIds[0] + '-02', job: 'synthetic-envelope-prep' }] }
  const jobDiff = await data(door + '/preview', jobEdit)
  assert.deepEqual(jobDiff.cells.filter(cell => cell.status === 'change').map(cell => [cell.field,cell.before,cell.after]),
    [['job','synthetic-envelope-kitchen','synthetic-envelope-prep']])
  await data(door + '/apply', { ...jobEdit, digest: jobDiff.digest }, 201)

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'],
  })
  try {
    const context = await browser.newContext(),
      [name, value] = cookie.split('=')
    await context.addCookies([{ name, value, url: origin }])
    const page = await context.newPage()
    const folder = process.env.ENVELOPE_PROOF_DIR ?? './test-results/envelope'
    await mkdir(folder, { recursive: true })
    const capture = async (label) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          ),
          true,
          label
        )
        for (const c of await page.locator('button,a,summary').all())
          assert.ok((await c.innerText()).trim(), label)
        await page.screenshot({
          path: join(folder, label + '-' + width + '.png'),
          fullPage: true,
        })
      }
    }
    for (const { body, error, screen } of browserRefusals) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(origin + door.replace('/api/', '/app/'))
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Preview exact cell changes', exact: true }) })
      await form.locator('[name="id"]').fill(body.id)
      await page.getByText('Import reviewed provider data', { exact: true }).click()
      await form.locator('[name="providerCapture"]').fill(JSON.stringify(body.providerCapture))
      const response = page.waitForResponse(r => r.url().endsWith('/intake/preview') && r.request().method() === 'POST')
      await page.getByRole('button', { name: 'Preview exact cell changes', exact: true }).click()
      assert.equal((await response).status(), 409)
      assert.match(await page.locator('main').innerText(), new RegExp(error.replaceAll('_', ' ')))
      await capture('run-intake-refused-' + screen)
    }
    await page.goto(origin + door.replace('/api/', '/app/'))
    await capture('run-intake-entry')
    assert.ok((await page.locator('main').innerText()).includes(allocated.id))
    await capture('run-intake-signed-correction')
    await page.goto(origin + (door + '/' + earningRunIds[0] + '/review').replace('/api/', '/app/'))
    assert.match(await page.locator('main').innerText(), /paid-leave/)
    assert.match(await page.locator('main').innerText(), /service-charge/)
    assert.match(await page.locator('main').innerText(), /synthetic-envelope-prep/)
    await capture('run-intake-nonwork-review')
    await page.goto(origin + door.replace('/api/', '/app/'))
    // A provider import also works through the native form, without a manual namespace.
    await page.setViewportSize({ width: 1440, height: 1000 })
    const browserCapture = structuredClone(clockifyCapture), browserSource = 'synthetic-envelope-clockify-browser'
    browserCapture.payload = [{ ...browserCapture.payload[0], id: browserSource }]
    browserCapture.mappings = { [browserSource]: browserCapture.mappings['synthetic-envelope-clockify-0-0'] }
    const providerForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Preview exact cell changes', exact: true }) })
    await providerForm.locator('[name="id"]').fill('synthetic-envelope-provider-browser')
    await page.getByText('Import reviewed provider data', { exact: true }).click()
    await providerForm.locator('[name="providerCapture"]').fill(JSON.stringify(browserCapture))
    await page.getByRole('button', { name: 'Preview exact cell changes', exact: true }).click()
    await page.getByRole('heading', { name: 'Exact changes before applying', exact: true }).waitFor()
    assert.match(await page.locator('main').innerText(), /synthetic-envelope-clockify-browser:regular/)
    await capture('run-intake-provider-diff')
    await page.getByRole('button', { name: 'Apply these exact changes', exact: true }).click()
    await page.waitForURL(origin + door.replace('/api/', '/app/'))
    const browserRetained = (await data(door)).find(r => r.id === 'synthetic-envelope-provider-browser')
    assert.equal(browserRetained.data.rows[0].minutes, 480)
    assert.equal(browserRetained.data.providerCapture.provider, 'clockify')
    assert.equal(browserRetained.approvedBy, null)
    // The grid is a native form. Its three rows use the same diff and apply door as files.
    await page.setViewportSize({ width: 1440, height: 1000 })
    const grid = page
      .locator('form')
      .filter({
        has: page.getByRole('button', {
          name: 'Preview exact cell changes',
          exact: true,
        }),
      })
    await grid.locator('[name="id"]').fill(runId)
    await grid.locator('[name="version"]').fill('1')
    await grid.locator('[name="namespace"]').fill(namespace)
    for (let i = 0; i < 3; i++) {
      await page.getByText('Manual row ' + (i + 1), { exact: true }).click()
      for (const field of [
        'sourceId',
        'day',
        'workweek',
        'minutes',
        'evidence',
      ])
        await page
          .locator(`[name="row${i}.${field}"]`)
          .fill(String(rows[i][field]))
      await page.locator(`[name="row${i}.personId"]`).selectOption(people[i].id)
    }
    await page
      .getByRole('button', { name: 'Preview exact cell changes', exact: true })
      .click()
    await page
      .getByRole('heading', {
        name: 'Exact changes before applying',
        exact: true,
      })
      .waitFor()
    assert.match(
      await page.locator('main').innerText(),
      /Unchanged; replay creates no new earnings/
    )
    await capture('run-intake-cell-diff')
    await page
      .getByRole('button', { name: 'Apply these exact changes', exact: true })
      .click()
    await page.waitForURL(origin + door.replace('/api/', '/app/'))

    let version = 1
    for (const [i, format] of ['csv', 'xls', 'xlsx'].entries()) {
      const response = await call(door + '/template?format=' + format)
      assert.equal(response.status, 200)
      const book = read(new Uint8Array(await response.arrayBuffer()), {
          type: 'array',
        }),
        sheet = book.Sheets[book.SheetNames[0]],
        headers = utils.sheet_to_json(sheet, { header: 1 })[0]
      // An independent expected set exercises changed, preserved and zeroed values.
      const patches = [
        { sourceId: rows[0].sourceId, minutes: 481 + i },
        { sourceId: rows[3].sourceId, amountCents: '' },
        { sourceId: rows[5].sourceId, amountCents: 0 },
      ]
      const customHeaders = headers.map((h) =>
        h === 'minutes' ? 'Worked minutes' : h
      )
      book.Sheets[book.SheetNames[0]] = utils.aoa_to_sheet([
        customHeaders,
        ...patches.map((p) => headers.map((h) => p[h] ?? '')),
      ])
      const bytes = write(book, {
        type: 'array',
        bookType: format === 'xls' ? 'biff8' : format,
      })
      const form = new FormData()
      form.set('id', runId)
      form.set('version', String(version))
      form.set('namespace', namespace)
      form.set('columnMap', JSON.stringify({ minutes: 'Worked minutes' }))
      form.set('file', new File([bytes], 'synthetic-envelope-820.' + format))
      const uploaded = await fetch(origin + door + '/preview', {
        method: 'POST',
        headers: { cookie, origin },
        body: form,
      })
      assert.equal(uploaded.status, 200, await uploaded.clone().text())
      const diff = await uploaded.json()
      assert.equal(
        diff.data.rows.find((r) => r.sourceId === rows[3].sourceId).amountCents,
        60000,
        'blank preserves held tips'
      )
      assert.equal(
        diff.data.rows.find((r) => r.sourceId === rows[5].sourceId).amountCents,
        0,
        'explicit zero removes the bonus'
      )
      assert.ok(
        diff.cells.some(
          (c) =>
            c.sourceId === rows[0].sourceId &&
            c.field === 'minutes' &&
            c.status === 'change' &&
            c.after === 481 + i
        )
      )
      assert.equal(diff.data.fileDigest, createHash('sha256').update(new Uint8Array(bytes)).digest('hex'), 'provenance hashes the exact uploaded bytes')
      if (i === 0) {
        await page.goto(origin + door.replace('/api/', '/app/'))
        await page.setViewportSize({ width: 1440, height: 1000 })
        const upload = page
          .locator('form')
          .filter({
            has: page.getByRole('button', {
              name: 'Preview exact cell changes',
              exact: true,
            }),
          })
        await upload.locator('[name="id"]').fill(runId)
        await upload.locator('[name="version"]').fill(String(version))
        await upload.locator('[name="namespace"]').fill(namespace)
        await page.getByText('Map spreadsheet columns', { exact: true }).click()
        await upload.locator('[name="map.minutes"]').fill('Worked minutes')
        await upload
          .locator('[name="file"]')
          .setInputFiles({
            name: 'synthetic-envelope-820.csv',
            mimeType: ['text', 'csv'].join('/'),
            buffer: Buffer.from(bytes),
          })
        await page
          .getByRole('button', {
            name: 'Preview exact cell changes',
            exact: true,
          })
          .click()
        await page
          .getByRole('heading', {
            name: 'Exact changes before applying',
            exact: true,
          })
          .waitFor()
        assert.match(await page.locator('main').innerText(), /480 → 481/)
        assert.match(await page.locator('main').innerText(), /10000 → 0/)
        await capture('run-intake-file-diff')
        await page
          .getByRole('button', {
            name: 'Apply these exact changes',
            exact: true,
          })
          .click()
        await page.waitForURL(origin + door.replace('/api/', '/app/'))
      } else await apply(diff)
      version++
      assert.equal(
        (await data(pay)).runs.find((r) => r.id === runId && r.version === 1)
          .sourceStatus,
        'changed-repreview-required'
      )
      await approve(version)
      const retained = await data(door)
      assert.equal(
        retained.find((r) => r.id === runId && r.version === version).data.fileDigest,
        diff.data.fileDigest
      )
      const same = await apply(await preview({ version, rows: diff.data.rows }))
      assert.equal(same.replayed, true)
      assert.equal(same.version, version)
    }
    const correction = await preview({
      version,
      rows: [{ sourceId: rows[3].sourceId, settlement: 'paycheck' }],
    })
    assert.ok(
      correction.cells.some(
        (c) =>
          c.field === 'settlement' &&
          c.before === 'cash' &&
          c.after === 'paycheck' &&
          c.status === 'change'
      )
    )
    await apply(correction)
    version++
    await page.goto(
      origin + (door + '/' + runId + '/review').replace('/api/', '/app/')
    )
    await capture('run-intake-exact-review')
    await approve(version)
    const revised = await run(1)
    assert.equal(revised.preview.people[0].cashTipsCents, 0)
    assert.equal(revised.preview.people[0].paycheckTipsCents, 60000)
    assert.equal(
      revised.preview.grossCashCents,
      103550,
      'settlement edit changes only actual new cash plus corrected regular hours'
    )
    const retainedRuns = (await data(pay)).runs
    assert.equal(
      retainedRuns.find((r) => r.version === 1 && r.id === runId).data
        .grossCashCents,
      53500,
      'frozen prior version retained'
    )
    await page.goto(origin + door.replace('/api/', '/app/'))
    await capture('run-intake-reviewed-history')
    await data(door + '/' + runId + '/withdraw', { version })
    await data(
      pay + '/earnings-run',
      {
        id: runId,
        version: 2,
        groupId: 'synthetic-envelope-802',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-15',
        payDate: '2026-11-16',
        frequency: 'biweekly',
      },
      409
    )
    assert.equal((await call(door, undefined, '')).status, 401)
    const foreign = await data(
      '/api/envelope/companies',
      { name: 'Synthetic foreign intake company', ein: '00-0000801' },
      201
    )
    await data(
      '/api/envelope/companies/' + foreign.id + '/pay-settings/intake/preview',
      { id: runId, version: 0, namespace, rows: [rows[0]] },
      409
    )
    const raceRow = { ...rows[0], sourceId: 'synthetic-envelope-raced-source' }
    const candidates = await Promise.all(
      ['synthetic-envelope-race-one', 'synthetic-envelope-race-two'].map((id) =>
        data(door + '/preview', { id, namespace, version: 0, rows: [raceRow] })
      )
    )
    const raced = await Promise.all(
      candidates.map((p) =>
        call(door + '/apply', {
          id: p.id,
          version: 0,
          namespace,
          rows: p.data.rows,
          digest: p.digest,
          format: p.data.format,
        })
      )
    )
    assert.deepEqual(
      raced.map((r) => r.status).sort(),
      [201, 409],
      'concurrent runs cannot claim the same source'
    )
    assert.equal(
      (await data(door)).filter((r) => candidates.some((c) => c.id === r.id))
        .length,
      1
    )
    const currentRows = await data(door),
      stale = await preview({
        version,
        rows: [{ sourceId: rows[0].sourceId, minutes: 480 }],
      })
    await data(
      door + '/apply',
      {
        id: runId,
        namespace,
        version,
        rows: stale.data.rows,
        digest: 'synthetic-envelope-not-the-preview',
        format: 'grid',
      },
      409
    )
    assert.deepEqual(
      await data(door),
      currentRows,
      'a changed preview digest writes no source version'
    )
    const staff = {}
    for (const name of ['preparer', 'reviewer']) {
      const id = 'synthetic-envelope-intake-' + name,
        token = randomBytes(32).toString('base64url'),
        hash = await hashToken(settings.SESSION_SECRET, 'session', token)
      await sql(
        `INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${id}','intake-${name}@example.com','Synthetic ${name}','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('${id}-session','${hash}','${id}',1,'native',${Date.now()},${Date.now() + 3600000})`
      )
      staff[name] = {
        id,
        cookie: localCookieName('operator_session_local', origin) + '=' + token,
      }
      await data(api + '/grants', {
        operatorId: id,
        version: 0,
        role: 'payroll-admin',
        locations: ['*'],
        fields: ['compensation'],
        actions: [
          'records:read',
          name === 'preparer' ? 'rates:propose' : 'rates:approve',
        ],
      })
    }
    const staffId = 'synthetic-envelope-staff-run',
      staffBody = {
        id: staffId,
        version: 0,
        namespace,
        rows: [{ ...rows[0], sourceId: 'synthetic-envelope-staff-source' }],
      }
    const staffDiff = await data(
      door + '/preview',
      staffBody,
      200,
      staff.preparer.cookie
    )
    await data(
      door + '/apply',
      {
        ...staffBody,
        rows: staffDiff.data.rows,
        digest: staffDiff.digest,
        format: 'grid',
      },
      201,
      staff.preparer.cookie
    )
    await data(
      door + '/' + staffId + '/review',
      undefined,
      403,
      staff.preparer.cookie
    )
    await data(
      door + '/preview',
      { ...staffBody, version: 1 },
      403,
      staff.reviewer.cookie
    )
    const reviewed = await data(
      door + '/' + staffId + '/review',
      undefined,
      200,
      staff.reviewer.cookie
    )
    await data(
      door + '/' + staffId + '/approve',
      { version: 1, reviewToken: reviewed.reviewToken },
      200,
      staff.reviewer.cookie
    )
    const attributed = (await data(door)).find((r) => r.id === staffId)
    assert.equal(attributed.createdBy, staff.preparer.id)
    assert.equal(attributed.approvedBy, staff.reviewer.id)
    const pending = await data(
      door + '/preview',
      {
        ...staffBody,
        version: 1,
        rows: [{ ...staffBody.rows[0], minutes: 10 }],
      },
      200,
      staff.preparer.cookie
    )
    await data(api + '/grants', {
      operatorId: staff.preparer.id,
      version: 1,
      revoke: true,
    })
    await data(
      door + '/apply',
      {
        ...staffBody,
        version: 1,
        rows: pending.data.rows,
        digest: pending.digest,
        format: 'grid',
      },
      401,
      staff.preparer.cookie
    )
    assert.equal(
      (
        await call(
          door + '/template?format=xlsx',
          undefined,
          staff.preparer.cookie
        )
      ).status,
      401
    )
    assert.equal((await data(door)).filter((r) => r.id === staffId).length, 1)
    await setup('group', 'synthetic-envelope-week-group', {
      name: 'Actual workweeks',
      people: [people[2].id],
    })
    await setup('pay-change', 'synthetic-envelope-week-rate', {
      name: 'Reviewed nonexempt weekly rate',
      groupId: 'synthetic-envelope-week-group',
      effectiveDate: '2026-01-01',
      items: [
        {
          personId: people[2].id,
          personVersion: people[2].version,
          rateCents: 1000,
          basis: 'hourly',
          salaryType: 'nonexempt',
          employmentFrom: '2026-01-01',
          employmentThrough: '2027-12-31',
          unpaidDates: [],
        },
      ],
    })
    const weekly = []
    for (const [week, dates, hours] of [
      ['2026-11-02', ['02', '03', '04', '05', '06'], 9],
      ['2026-11-09', ['09', '10', '11', '12', '13'], 7],
    ]) {
      for (const day of dates)
        weekly.push({
          ...base,
          sourceId: 'synthetic-envelope-week-' + day,
          personId: people[2].id,
          day: '2026-11-' + day,
          workweek: week,
          minutes: hours * 60,
        })
    }
    weekly.push(
      {
        ...base,
        sourceId: 'synthetic-envelope-week-bonus',
        personId: people[2].id,
        code: 'nondiscretionary-bonus',
        amountCents: 9000,
      },
      {
        ...base,
        sourceId: 'synthetic-envelope-wa-one',
        personId: people[2].id,
        code: 'wa-assessment-hours',
        minutes: 75.5,
        state: 'WA',
        riskClass: 'synthetic-envelope-class-one',
      },
      {
        ...base,
        sourceId: 'synthetic-envelope-wa-two',
        personId: people[2].id,
        code: 'wa-assessment-hours',
        minutes: 120.25,
        state: 'WA',
        riskClass: 'synthetic-envelope-class-two',
      },
      {
        ...base,
        sourceId: 'synthetic-envelope-or-partial',
        personId: people[2].id,
        code: 'or-assessment-hours',
        minutes: 0.125,
        state: 'OR',
      }
    )
    const weekId = 'synthetic-envelope-week-run',
      weekBody = { id: weekId, version: 0, namespace, rows: weekly }
    const weekDiff = await data(door + '/preview', weekBody)
    await data(
      door + '/apply',
      {
        ...weekBody,
        rows: weekDiff.data.rows,
        digest: weekDiff.digest,
        format: 'grid',
      },
      201
    )
    const weekReview = await data(door + '/' + weekId + '/review')
    await data(door + '/' + weekId + '/approve', {
      version: 1,
      reviewToken: weekReview.reviewToken,
    })
    const weeklyResult = await data(
      pay + '/earnings-run',
      {
        id: weekId,
        version: 0,
        groupId: 'synthetic-envelope-week-group',
        periodStart: '2026-11-02',
        periodEnd: '2026-11-15',
        payDate: '2026-11-16',
        frequency: 'biweekly',
      },
      201
    )
    // Independently: week one $450 wages + $90 bonus, rate $12, half-time $6 * 5 = $30;
    // week two $350 wages. Averaging the 80 hours would wrongly omit that $30.
    assert.equal(weeklyResult.preview.grossCashCents, 92000)
    assert.ok(
      weeklyResult.preview.people[0].details.some(
        (d) =>
          d.includes('2026-11-02: 45 hours, 5 overtime hours') &&
          d.includes('3000 cents additional half-time')
      )
    )
    const preserved = (await data(door)).find((r) => r.id === weekId).data.rows
    assert.deepEqual(
      preserved
        .filter((r) => r.code.endsWith('assessment-hours'))
        .map((r) => [r.code, r.minutes, r.riskClass]),
      [
        ['or-assessment-hours', 0.125, ''],
        ['wa-assessment-hours', 75.5, 'synthetic-envelope-class-one'],
        ['wa-assessment-hours', 120.25, 'synthetic-envelope-class-two'],
      ]
    )
    assert.equal(
      (
        await data(
          door + '/apply',
          {
            ...weekBody,
            version: 1,
            digest: (await data(door + '/preview', { ...weekBody, version: 1 }))
              .digest,
            format: 'grid',
          },
          201
        )
      ).replayed,
      true
    )
    const formula = utils.book_new()
    utils.book_append_sheet(
      formula,
      utils.aoa_to_sheet([['sourceId'], [{ f: '1+1', v: 2, t: 'n' }]]),
      'Earnings'
    )
    const badForm = new FormData()
    badForm.set('id', runId)
    badForm.set('version', String(version))
    badForm.set('namespace', namespace)
    badForm.set(
      'file',
      new File(
        [write(formula, { type: 'array', bookType: 'xlsx' })],
        'synthetic-envelope-formula.xlsx'
      )
    )
    const refusedFile = await fetch(origin + door + '/preview', {
      method: 'POST',
      headers: { cookie, origin },
      body: badForm,
    })
    assert.equal(refusedFile.status, 400)
    assert.deepEqual(await refusedFile.json(), {
      error: 'intake_formula_or_link_refused',
    })
    const custody = api + '/people/' + people[0].id + '/privacy'
    const inventory = await data(custody)
    for (const id of [runId, 'synthetic-envelope-lanyard-run', 'synthetic-envelope-toast-run',
      'synthetic-envelope-deputy-run', 'synthetic-envelope-when-i-work-run',
      'synthetic-envelope-clockify-run', 'synthetic-envelope-square-run', 'synthetic-envelope-homebase-run',
      'synthetic-envelope-7shifts-run', 'synthetic-envelope-quickbooks-time-run', 'synthetic-envelope-clover-run']) {
      assert.ok(inventory.retained.filter(r => r.table === 'env_workspace_versions' && r.key.kind === 'run-intake' && r.key.object_id === id).length >= 2,
        'custody explicitly includes original and corrected intake: ' + id)
    }
    const ciphers = await sql(`SELECT cipher FROM env_workspace_versions WHERE company_id='${company.id}' AND kind='run-intake'`)
    assert.ok(ciphers.length >= 14)
    for (const row of ciphers) {
      assert.ok(!row.cipher.includes('synthetic-envelope-source-worker-0'))
      assert.ok(!row.cipher.includes('synthetic-envelope-reviewed-export'))
    }
    assert.equal((await call(door, undefined, staff.reviewer.cookie)).status, 200)
    const ownerHash = await hashToken(settings.SESSION_SECRET, 'session', cookie.slice(cookie.indexOf('=') + 1))
    const now = Date.now(), proofId = randomBytes(16).toString('hex')
    // Seed Base's independently tested fresh native step-up; custody actions use the public doors.
    await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
      SELECT '${proofId}','${proofId}',id,operator_id,operator_version,'payroll:sensitive','/app',${now},${now + 600000},${now}
      FROM oa_sessions WHERE token_hash='${ownerHash}'`)
    await data(custody + '/request', { consent: true, fingerprint: inventory.fingerprint })
    await data(door, undefined, 403, staff.reviewer.cookie)
    const heldRead = await data(door)
    assert.equal(heldRead.filter(r => r.id === 'synthetic-envelope-lanyard-run').length, 2)
    const owner = (await data('/auth/session')).operator.id
    const reads = (await data(api + '/audit')).filter(e => e.action === 'workspace.run-intake.read')
    assert.ok(reads.some(e => e.actorId === owner && e.targetId === company.id && e.occurredAt > 0), 'owner held reads are attributed')

    const exactCustody = await data(custody)
    const selection = { consent: true, fingerprint: exactCustody.fingerprint, records: exactCustody.retained.map(r => r.id),
      legalBasis: 'Synthetic reviewed record-specific release; no active statutory hold remains.', custodian: 'Native payroll owner' }
    await data(custody + '/release', selection, 409)
    await data(api + '/people/' + people[0].id + '/erase', { ...selection, version: people[0].version }, 409)
    assert.deepEqual(await data(door), heldRead, 'unclassified retention refuses erasure without deleting original or corrected input')
    await data(custody + '/retain', { ...selection, earliestReleaseAt: '2000-01-01T00:00:00.000Z' })
    assert.equal((await data(custody)).status, 'held', 'elapsed time cannot release intake history')
    assert.equal((await data(custody + '/release', selection)).status, 'eligible')
    // Keep exact erasure receipts newer than the preceding intake history in the bounded audit page.
    await advanceClock('2026-01-31T12:00:01Z')
    const erased = await data(api + '/people/' + people[0].id + '/erase', { ...selection, version: people[0].version })
    assert.equal(erased.erased, true)
    assert.ok(erased.recordsDeleted >= exactCustody.retained.length)
    const remaining = await data(door)
    for (const id of [runId, allocated.id, ...['lanyard','toast','deputy','when-i-work','clockify','square','homebase','7shifts','quickbooks-time','clover'].map(provider => 'synthetic-envelope-' + provider + '-run')])
      assert.equal(remaining.filter(r => r.id === id).length, 0, 'eligible erasure removes every retained intake version: ' + id)
    assert.equal((await call(api + '/people/' + people[0].id)).status, 404)
    const replayRows = rows.map(row => ({ ...row, personId: people[1].id }))
    await data(door + '/preview', { id: runId + '-replay', namespace, version: 0, rows: replayRows }, 409)
    for (const provider of ['lanyard','toast','deputy','when-i-work','clockify','square','homebase','7shifts','quickbooks-time','clover']) {
      const source = structuredClone(heldRead.find(r => r.id === 'synthetic-envelope-' + provider + '-run' && r.version === 1).data.providerCapture)
      for (const mapping of Object.values(source.mappings)) mapping.personId = people[1].id
      const response = await data(door + '/preview', { id: 'synthetic-envelope-' + provider + '-replay', version: 0, providerCapture: source }, 409)
      assert.equal(response.error, 'erased_source', provider + ' erasure fences source identity after run renaming and worker remapping')
    }
    assert.deepEqual(await data(door), remaining, 'stale source replay restores no private version')
    const staleAllocated = structuredClone(allocated.original)
    for (const mapping of Object.values(staleAllocated.mappings)) mapping.personId = people[1].id
    assert.equal((await data(door+'/preview',{id:allocated.id+'-replay',version:0,providerCapture:staleAllocated},409)).error,'erased_source')
    const erasureAudit = (await data(api + '/audit')).filter(e => e.action === 'privacy.worker.erased')
    assert.equal(erasureAudit.length, 1)
    assert.notEqual(erasureAudit[0].targetId, people[0].id)

    const nonworkDoor = api + '/people/' + earningWorker.id + '/privacy'
    const nonworkInventory = await data(nonworkDoor)
    for (const id of earningRunIds) assert.equal(nonworkInventory.retained.filter(record =>
      record.table === 'env_workspace_versions' && record.key.kind === 'run-intake' && record.key.object_id === id).length,
      id === earningRunIds[0] ? 3 : 2, 'custody retains each original and corrected non-work source: ' + id)
    const nonworkSources = await data(door)
    for (const row of await sql(`SELECT cipher FROM env_workspace_versions WHERE company_id='${company.id}' AND kind='run-intake'`))
      assert.ok(!row.cipher.includes('synthetic-envelope-nonwork'), 'non-work source records and job labels stay encrypted')
    await data(nonworkDoor + '/request', { consent: true, fingerprint: nonworkInventory.fingerprint })
    await data(door, undefined, 403, staff.reviewer.cookie)
    await data(nonworkDoor, undefined, 403, staff.reviewer.cookie)
    const nonworkHeld = await data(nonworkDoor)
    const nonworkSelection = { consent: true, fingerprint: nonworkHeld.fingerprint, records: nonworkHeld.retained.map(record => record.id),
      legalBasis: 'Synthetic reviewed non-work source retention release; no active statutory hold remains.', custodian: 'Native payroll owner',
      earliestReleaseAt: '2000-01-01T00:00:00.000Z' }
    await data(nonworkDoor + '/release', nonworkSelection, 409)
    await data(nonworkDoor + '/retain', nonworkSelection)
    await data(nonworkDoor + '/release', nonworkSelection)
    await advanceClock('2026-01-31T12:00:02Z')
    const nonworkErased = await data(api + '/people/' + earningWorker.id + '/erase', { ...nonworkSelection, version: earningWorker.version })
    const afterNonwork = await data(door)
    assert.ok(!afterNonwork.some(row => earningRunIds.includes(row.id)), 'eligible erasure removes every retained non-work capture and job version')
    for (const id of earningRunIds) {
      const prior = nonworkSources.find(row => row.id === id && row.version === 1)
      const replay = prior.data.providerCapture ? { providerCapture: structuredClone(prior.data.providerCapture) } :
        { namespace: prior.data.namespace, rows: prior.data.rows.map(row => ({ ...row, personId: people[1].id })) }
      if (replay.providerCapture) for (const mapping of Object.values(replay.providerCapture.mappings)) mapping.personId = people[1].id
      assert.equal((await data(door + '/preview', { id: id + '-replay', version: 0, ...replay }, 409)).error, 'erased_source',
        'changing run and worker cannot resurrect non-work input: ' + id)
    }
    assert.deepEqual(await data(door), afterNonwork)
    const nonworkAudit = (await data(api + '/audit')).filter(event => event.action === 'privacy.worker.erased')
    const currentErasure = nonworkAudit.find(event => event.targetId === nonworkErased.id)
    assert.ok(currentErasure, 'the bounded recent audit exposes the exact new erasure receipt')
    assert.equal(currentErasure.actorId, owner)
    assert.equal(currentErasure.version, earningWorker.version)
    const allErasures = await sql(`SELECT target_id AS targetId FROM env_audit WHERE company_id='${company.id}' AND action='privacy.worker.erased'`)
    assert.equal(allErasures.length, 2, 'both erasure receipts survive beyond the recent audit page')
    assert.ok(allErasures.every(event => ![people[0].id, earningWorker.id].includes(event.targetId)))

  } finally {
    await browser.close()
  }
  console.log(
    'RUN-INTAKE passed: ten reviewed provider workweeks, native three-worker grid, mapped CSV XLS XLSX changes, blank and zero, source claims, replay, typed tips, exact corrections, frozen history, held custody, reviewed eligible erasure and source fencing after run renaming and worker remapping; bounded federal tip-tax preparations; no payment claim'
  )
}
