import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { privateValue } from './privacy-recorder.mjs'
import { industryFixture, ordinaryFacts } from './industry-fixture.mjs'

export async function multiCompanyJourney(context) {
  const { origin, cookie, sql, settings } = context
  const f = industryFixture(context), { data, call, company, classify, preview, approve, path } = f
  const a = await company('Synthetic separate employer A', ['Synthetic shared worker'])
  const b = await company('Synthetic separate employer B', ['Synthetic shared worker'])
  assert.notEqual(a.id, b.id); assert.notEqual(a.einSuffix, b.einSuffix); assert.notEqual(a.people[0].id, b.people[0].id)
  const sharedTaxpayer='synthetic-envelope-shared-worker-6110'
  privateValue(sharedTaxpayer)
  const checks = []
  for (const [index, c] of [a, b].entries()) {
    await data(c.base+'/people/'+c.people[0].id+'/private',{kind:'ssn',version:0,value:sharedTaxpayer},201)
    const original=await call(c.base+'/people/'+c.people[0].id+'/private/ssn')
    assert.equal(original.status,200);assert.equal(await original.text(),sharedTaxpayer)
    await classify(c, c.people[0], ordinaryFacts, index ? { w4: { version:'2020_or_later', filingStatus:'single', step2Checked:false, step3AnnualCreditsCents:0, step4aOtherIncomeCents:0, step4bDeductionsCents:0, step4cExtraWithholdingCents:1000 } } : {})
    const check = await preview(c, c.people[0]); await approve(c, c.people[0], 'industry-check', check.id); checks.push(check)
  }
  assert.deepEqual(checks.map(c => c.data.result.netCashCents), [84542, 83542])
  assert.deepEqual(checks.map(c => c.data.result.employeeTaxes.incomeTaxCents), [7808, 8808])
  const reportDoor = '/api/envelope/reports/combined-labor'
  let report = await data(reportDoor)
  assert.deepEqual(report.rows.map(row => [row.companyId, row.personId, row.netCents]).sort(), [[a.id,a.people[0].id,84542],[b.id,b.people[0].id,83542]].sort())
  assert.deepEqual(report.totals, {grossCents:200000, netCents:168084, employeeTaxCents:31916, employerTaxCents:27300})
  assert.equal(report.paymentStatus, 'not-paid')
  const corrected = await preview(a,a.people[0],{corrects:checks[0].id,correctionReason:'Reviewed duplicate register attribution correction'})
  report=await data(reportDoor)
  assert.equal(report.rows.length,2,'an unreviewed correction cannot hide approved wages')
  assert.ok(report.rows.some(row=>row.checkId===checks[0].id))
  await approve(a,a.people[0],'industry-check',corrected.id)
  report=await data(reportDoor)
  assert.equal(report.rows.length,2)
  assert.ok(report.rows.some(row=>row.checkId===corrected.id))
  assert.ok(!report.rows.some(row=>row.checkId===checks[0].id))
  const sameIdCorrection = await preview(b,b.people[0],{id:checks[1].id,version:1,corrects:checks[1].id,correctionReason:'Reviewed same-identity register correction',yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:700000}})
  assert.equal(sameIdCorrection.version,2)
  const assertCorrectedReport = async (employerTaxCents) => {
    const current = await data(reportDoor)
    assert.deepEqual(current.rows.map(row=>[row.companyId,row.personId,row.runId,row.checkId,row.grossCents,row.netCents]).sort(),
      [[a.id,a.people[0].id,a.run.id,corrected.id,100000,84542],[b.id,b.people[0].id,b.run.id,checks[1].id,100000,83542]].sort())
    assert.deepEqual(current.totals,{grossCents:200000,netCents:168084,employeeTaxCents:31916,employerTaxCents})
  }
  await assertCorrectedReport(27300)
  await approve(b,b.people[0],'industry-check',sameIdCorrection.id)
  await assertCorrectedReport(21300)
  const duplicate = await preview(a,a.people[0])
  await approve(a,a.people[0],'industry-check',duplicate.id)
  const ambiguous = await call(reportDoor)
  assert.equal(ambiguous.status,409);assert.equal((await ambiguous.json()).error,'ambiguous_prepared_checks')
  await data(path(a,a.people[0])+'/decision/industry-check/'+duplicate.id,{version:1,withdraw:true})
  assert.deepEqual((await data(reportDoor)).totals,{grossCents:200000,netCents:168084,employeeTaxCents:31916,employerTaxCents:21300})
  const snapshot = () => sql('SELECT * FROM env_workspace_versions ORDER BY company_id,kind,object_id,version; SELECT * FROM env_workspace_decisions ORDER BY company_id,kind,object_id,version; SELECT * FROM env_audit ORDER BY id; SELECT * FROM env_people ORDER BY company_id,id; SELECT * FROM env_private_records ORDER BY company_id,person_id,kind; SELECT * FROM env_run_approvals ORDER BY company_id,run_id,version')
  const refused = async (request, status) => { const before = await snapshot(); const response = await request(); assert.equal(response.status,status,await response.clone().text()); assert.deepEqual(await snapshot(),before,'a refused cross-company or unavailable payment request writes nothing'); return response }
  const accountInput = {id:'synthetic-envelope-funding-a',version:0,name:'Operating account A',lastFour:'0101',accountReference:'synthetic-envelope-6101'}
  await refused(() => call(a.base+'/funding-accounts',accountInput),403)
  const ownerSession = (await sql('SELECT id,operator_id,operator_version FROM oa_sessions WHERE revoked_at IS NULL ORDER BY created_at LIMIT 1'))[0]
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('synthetic-envelope-company-proof','synthetic-envelope-6102','${ownerSession.id}','${ownerSession.operator_id}',${ownerSession.operator_version},'credentials:mint','/app',${Date.now()},${Date.now()+600000},${Date.now()})`)
  const accounts = [], plans = []
  for (const [index,c] of [a,b].entries()) {
    privateValue('synthetic-envelope-610'+(3+index))
    const account = await data(c.base+'/funding-accounts',{...accountInput,id:'synthetic-envelope-funding-'+index,name:'Operating account '+index,lastFour:index?'0202':'0101',accountReference:'synthetic-envelope-610'+(3+index)},201)
    accounts.push(account)
    const visible = await data(c.base+'/funding-accounts')
    assert.deepEqual(visible.map(row=>row.data),[{name:'Operating account '+index,lastFour:index?'0202':'0101',status:'unverified',paymentAuthority:false}])
    assert.ok(!JSON.stringify(visible).includes('accountReference'))
    plans.push(await data(c.base+'/funding-plans',{id:'synthetic-envelope-plan-'+index,version:0,runId:c.run.id,runVersion:1,accountId:account.id,accountVersion:1},201))
    await refused(() => call(c.base+'/funding-plans/'+plans[index].id+'/release',{version:1}),409)
    const form = await data(c.base+'/industry-returns',{id:'synthetic-envelope-separate-return-'+index,version:0,form:'941',taxYear:2026,quarter:4,checks:[{personId:c.people[0].id,id:checks[index].id,version:1}],address:{street:'100 Main Street',city:'Austin',state:'TX',postalCode:'78701'},employeeCount:0,depositsCents:0,basis:'Separate reviewed employer payroll'},201)
    const exact = await data(c.base+'/industry-returns/'+form.id+'/review')
    assert.equal(exact.data.company.legalName,c.name)
    assert.equal(exact.data.totals.incomeTaxWithheldCents,index?8808:7808)
    assert.equal(exact.data.export.filingStatus,'prepared-not-submitted')
    await data(c.base+'/industry-returns/'+form.id+'/decision',{version:1,reviewToken:exact.reviewToken})
    const document = await call(c.base+'/industry-returns/'+form.id+'/download')
    assert.equal(document.status,200); assert.ok((await document.text()).includes(c.name))
  }
  const storedAccounts=await sql("SELECT cipher FROM env_workspace_versions WHERE kind='company-funding'")
  assert.equal(storedAccounts.length,2)
  assert.ok(storedAccounts.every(row=>!row.cipher.includes('synthetic-envelope-6103')&&!row.cipher.includes('synthetic-envelope-6104')))
  const plan = {id:'synthetic-envelope-foreign-plan',version:0,runId:a.run.id,runVersion:1,accountId:b.id,accountVersion:1}
  await refused(() => call(a.base+'/funding-plans',{...plan,accountId:accounts[1].id}),404)
  await refused(() => call(a.base+'/funding-plans',{...plan,runId:b.run.id,accountId:accounts[0].id}),404)
  await refused(() => call(a.base+'/funding-plans/'+plans[1].id+'/release',{version:1}),404)
  await refused(() => call(a.base+'/people/'+b.people[0].id),404)
  await refused(() => call(a.base+'/people/'+b.people[0].id+'/private',{kind:'ssn',version:1,value:'synthetic-envelope-foreign-record'}),404)
  await refused(() => call(a.base+'/industry-returns',{id:'synthetic-envelope-foreign-form',version:0,form:'941',taxYear:2026,quarter:4,checks:[{personId:b.people[0].id,id:checks[1].id,version:1}]}),404)
  await data(a.base+'/funding-accounts',{...accountInput,id:accounts[0].id,version:1,lastFour:'0303'},201)
  const stale = await refused(() => call(a.base+'/funding-plans/'+plans[0].id+'/release',{version:1}),409)
  assert.equal((await stale.json()).error,'funding_sources_changed')
  // Synthetic identities are the fixture; every grant and business action uses HTTP.
  const token=randomBytes(32).toString('base64url'), hash=await hashToken(settings.SESSION_SECRET,'session',token)
  const who=cookie.split('=')[0]+'='+token, operator='synthetic-envelope-company-accountant'
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${operator}','company-accountant@example.com','Synthetic scoped accountant','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-company-accountant-session','${hash}','${operator}',1,'native',${Date.now()},${Date.now()+3600000})`)
  const grant = {operatorId:operator,version:0,role:'accountant',locations:[a.location.id],fields:['compensation','tax'],actions:['records:read','private:read']}
  await data(a.base+'/grants',grant)
  report=await data(reportDoor,undefined,200,who)
  assert.deepEqual(report.rows.map(row=>[row.companyId,row.personId,row.netCents]),[[a.id,a.people[0].id,84542]])
  assert.deepEqual(report.totals,{grossCents:100000,netCents:84542,employeeTaxCents:15458,employerTaxCents:13650})
  assert.ok(!JSON.stringify(report).includes(b.id))
  await refused(() => call(a.base+'/funding-accounts',undefined,who),403)
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  try {
    const bc=await browser.newContext();await bc.addCookies([{name:cookie.split('=')[0],value:cookie.split('=')[1],url:origin}]);const page=await bc.newPage()
    const folder=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(folder,{recursive:true})
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      for(const [index,c] of [a,b].entries())for(const suffix of ['', '/industry-returns']) {
        await page.goto(origin+c.base.replace('/api/','/app/')+suffix);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        assert.ok((await page.locator('main').innerText()).includes(c.name))
        for(const control of await page.locator('button,a,summary').all())if(await control.isVisible())assert.ok((await control.innerText()).trim(),'existing company screens use named controls')
        await page.screenshot({path:join(folder,`separate-company-${index}${suffix?'-forms':''}-${width}.png`),fullPage:true})
      }
    }
  } finally {await browser.close()}
  await data(a.base+'/grants',{...grant,version:1,fields:[]})
  await refused(()=>call(reportDoor,undefined,who),401)
  const freshSession = async suffix => {
    const value=randomBytes(32).toString('base64url'),hash=await hashToken(settings.SESSION_SECRET,'session',value)
    await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-company-session-${suffix}','${hash}','${operator}',1,'native',${Date.now()},${Date.now()+3600000})`)
    return cookie.split('=')[0]+'='+value
  }
  const noFields=await data(reportDoor,undefined,200,await freshSession('no-fields'))
  assert.deepEqual(noFields.rows,[]);assert.deepEqual(noFields.totals,{grossCents:0,netCents:0,employeeTaxCents:0,employerTaxCents:0})
  const other=await data(a.base+'/locations',{name:'Restricted second location',state:'TX'},201)
  await data(a.base+'/grants',{...grant,version:2,locations:[other.id]})
  assert.deepEqual((await data(reportDoor,undefined,200,await freshSession('other-location'))).rows,[])
  await data(b.base+'/pay-settings/earnings-run',{id:b.run.id,version:1,groupId:b.run.preview.groupId,periodStart:'2026-10-19',periodEnd:'2026-10-25',payDate:'2026-10-30',frequency:'weekly'},201)
  const oldRun=await refused(()=>call(b.base+'/funding-plans/'+plans[1].id+'/release',{version:1}),409)
  assert.equal((await oldRun.json()).error,'funding_sources_changed')
  console.log('MULTI-COMPANY passed: separate EIN preparations, funding references, federal wages and forms; scoped labor report, cross-company no-write refusals, stale funding and immediate revocation; unpaid boundary and existing screens at 1440 and 390.')
}
