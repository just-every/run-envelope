import assert from 'node:assert/strict'
import { mkdir,writeFile,readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { credentialResponse } from './human-proof-fixture.mjs'
import { industryFixture,ordinaryFacts } from './industry-fixture.mjs'

export async function industryJourney(context) {
 const f=industryFixture(context),{data,call,company,proposal,path,approve,classify,preview}=f
 const farm=await company('Prairie Farm',['Elena Alvarez','Owen Bennett','Mateo Cruz'])
 const farmFacts={employerKind:'farm',entityType:'sole_proprietor',workKind:'agricultural'}
 await classify(farm,farm.people[0],farmFacts);const farmCheck=await preview(farm,farm.people[0])
 await classify(farm,farm.people[1],{...farmFacts,workKind:'nonagricultural',seasonal:true});const officeCheck=await preview(farm,farm.people[1])
 await classify(farm,farm.people[2],{...farmFacts,claims:[{kind:'h2a',immigrationStatus:'H-2A',services:'authorized_agricultural_labor',tinStatus:'provided'}]});const h2a=await preview(farm,farm.people[2])
 assert.equal(farmCheck.data.result.formAssignment,'943');assert.equal(officeCheck.data.result.formAssignment,'941')
 assert.deepEqual(farmCheck.data.result.employeeTaxes,{incomeTaxCents:7808,socialSecurityCents:6200,medicareCents:1450,additionalMedicareCents:0})
 assert.equal(farmCheck.data.result.netCashCents,84542);assert.equal(h2a.data.result.totalEmployeeTaxCents,0);assert.equal(h2a.data.result.totalEmployerTaxCents,0);assert.equal(h2a.data.result.wages.w2Box1WagesCents,100000);assert.ok(h2a.data.input.facts.claims[0].reviewedBy);assert.ok(h2a.data.input.facts.claims[0].documentId.includes('v1-evidence'))
 const nonprofit=await company('Community Learning Trust',['Aisha Khan']);await classify(nonprofit,nonprofit.people[0],{employerKind:'nonprofit',entityType:'nonprofit',claims:[{kind:'nonprofit_501c3',determination:'501c3'}]});const charitable=await preview(nonprofit,nonprofit.people[0]);assert.equal(charitable.data.result.employerTaxes.futaCents,0);assert.deepEqual(charitable.data.result.employeeTaxes,farmCheck.data.result.employeeTaxes)
 const church=await company('Community Church',['Pastor Riley','Casey Secretary'])
 const minister={employerKind:'church',entityType:'nonprofit',claims:[{kind:'minister',credential:'ordained',services:'exercise_of_ministry'},{kind:'minister_housing',designatedBeforePayment:'2025-12-01',designatedCents:1200000,actualHousingExpensesCents:960000,fairRentalValueIncludingUtilitiesCents:1080000,reasonableCompensationCents:2000000,annualReconciliation:'current_year_allocations'}]}
 await classify(church,church.people[0],minister);const clergy=await preview(church,church.people[0],{housingAllowanceCents:40000,yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,housingExcludedCents:0}})
 await classify(church,church.people[1],{employerKind:'church',entityType:'nonprofit',claims:[{kind:'nonprofit_501c3',determination:'501c3'}]});const secretary=await preview(church,church.people[1])
 assert.equal(clergy.data.result.wages.w2Box1WagesCents,60000);assert.equal(clergy.data.result.totalEmployeeTaxCents,0);assert.equal(clergy.data.result.netCashCents,100000);assert.equal(secretary.data.result.employeeTaxes.socialSecurityCents,6200);assert.ok(clergy.data.result.classification.selfEmploymentNotice)
 const scorp=await company('Pecan Design Inc',['Jordan Owner'])
 const shareholder={entityType:'s_corporation',workerRole:'corporate_officer',claims:[{kind:'s_corp_health',ownershipPercent:3,benefit:'employer_paid_accident_health',planCoverage:'employees_generally'}]}
 await classify(scorp,scorp.people[0],shareholder);const ownerCheck=await preview(scorp,scorp.people[0],{shareholderHealthInsuranceCents:20000})
 assert.equal(ownerCheck.data.result.wages.incomeTaxWagesCents,120000);assert.equal(ownerCheck.data.result.wages.socialSecurityWagesCents,100000);assert.equal(ownerCheck.data.result.wages.futaWagesCents,100000)
 const residency=await company('Research Studio',['Resident Worker','Nonresident Worker','Authorized Student','Indian Student'])
 const visitor={kind:'nonresident_fjmq',immigrationStatus:'F-1',services:'authorized_status_purpose'}
 for(const [i,p] of residency.people.entries())await classify(residency,p,{taxResidency:i?'nonresident':'resident',claims:i>=2?[visitor,...(i===3?[{kind:'india_student',nationality:'India',role:'student'}]:[])]:[]})
 const residentChecks=[];for(const p of residency.people)residentChecks.push(await preview(residency,p))
 assert.equal(residentChecks[0].data.result.employeeTaxes.incomeTaxCents,7808);assert.equal(residentChecks[1].data.result.employeeTaxes.incomeTaxCents,11830);assert.equal(residentChecks[1].data.result.employeeTaxes.socialSecurityCents,6200);assert.equal(residentChecks[2].data.result.employeeTaxes.socialSecurityCents,0);assert.equal(residentChecks[2].data.result.employerTaxes.futaCents,0);assert.equal(residentChecks[3].data.result.employeeTaxes.incomeTaxCents,7808)
 const family=await company('Sorensen Family Workshop',['Child Seventeen','Child Eighteen','Child Twenty One','Working Parent'])
 for(const [i,p] of family.people.entries())await classify(family,p,{entityType:'sole_proprietor',birthDate:['2009-01-01','2008-01-01','2005-01-01','1970-01-01'][i],claims:[{kind:'family_employment',relationship:i===3?'parent':'child'}]})
 const familyChecks=[];for(const p of family.people)familyChecks.push(await preview(family,p))
 assert.equal(familyChecks[0].data.result.employeeTaxes.socialSecurityCents,0);assert.equal(familyChecks[0].data.result.employeeTaxes.incomeTaxCents,7808);assert.equal(familyChecks[1].data.result.employeeTaxes.socialSecurityCents,6200);assert.equal(familyChecks[1].data.result.employerTaxes.futaCents,0);assert.equal(familyChecks[2].data.result.employerTaxes.futaCents,6000);assert.equal(familyChecks[3].data.result.employerTaxes.futaCents,0)
 const school=await company('Town College',['Student Assistant']);const studentFacts={employerKind:'school',entityType:'nonprofit',claims:[{kind:'school_student',enrollment:'at_least_half_time',relationship:'education_predominates',employerIsEnrolledSchool:true,scheduledWeeklyHours:20,professionalEmployee:false,socialSecurityCoverage:'no_section_218_coverage',attendance:'class_session'}]}
 await classify(school,school.people[0],studentFacts);const student=await preview(school,school.people[0]);assert.equal(student.data.result.employeeTaxes.socialSecurityCents,0)
 // Unsupported claims, expired evidence and a foreign company reference fail through the same public doors.
 for(const facts of [{...ordinaryFacts,claims:[visitor]},{...ordinaryFacts,employerKind:'church',claims:[{kind:'minister_housing',designatedBeforePayment:'2025-12-01',designatedCents:1,actualHousingExpensesCents:1,fairRentalValueIncludingUtilitiesCents:1,reasonableCompensationCents:1,annualReconciliation:'current_year_allocations'}]},{...studentFacts,claims:[{...studentFacts.claims[0],scheduledWeeklyHours:40}]}]){
  const response=await call(path(school,school.people[0])+'/classification',proposal(school,facts,{version:1}));assert.equal(response.status,400,await response.text())
 }
 await classify(residency,residency.people[0],ordinaryFacts,{version:1,effectiveThrough:'2026-09-30'})
 assert.equal((await call(path(residency,residency.people[0])+'/checks',{id:'synthetic-envelope-expired',version:0,runId:residency.run.id,runVersion:1,yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0},yearToDateEvidence:'Opening register'})).status,409)
 assert.equal((await call(path(nonprofit,nonprofit.people[0])+'/checks',{id:'synthetic-envelope-foreign',version:0,runId:farm.run.id,runVersion:1,yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0}})).status,404)
 await approve(scorp,scorp.people[0],'industry-check',ownerCheck.id)
 const approvedBefore=(await data(path(scorp,scorp.people[0]))).checks.find(c=>c.id===ownerCheck.id);assert.ok(approvedBefore.approvedBy)
 const correctedFacts={...shareholder,claims:[{...shareholder.claims[0],ownershipPercent:2}]}
 const proposed=await data(path(scorp,scorp.people[0])+'/classification',proposal(scorp,correctedFacts,{version:1}),201)
 assert.equal((await call(path(scorp,scorp.people[0])+'/checks',{id:'synthetic-envelope-unreviewed',version:0,runId:scorp.run.id,runVersion:1,yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0}})).status,409)
 await approve(scorp,scorp.people[0],'industry-classification',proposed.id)
 const corrected=await preview(scorp,scorp.people[0],{shareholderHealthInsuranceCents:20000,corrects:ownerCheck.id,correctionReason:'Reviewed attribution shows exactly two percent for the tax year.'});assert.equal(corrected.data.result.wages.w2Box1WagesCents,100000);assert.equal(corrected.data.amendment.wages.w2Box1WagesCents,-20000);assert.equal((await data(path(scorp,scorp.people[0]))).checks.find(c=>c.id===ownerCheck.id).data.result.wages.w2Box1WagesCents,120000)
 const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope';await mkdir(proof,{recursive:true})
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  const ctx=await browser.newContext({ignoreHTTPSErrors:true});const [name,value]=context.cookie.split('=');await ctx.addCookies([{name,value,url:context.origin}]);const page=await ctx.newPage()
  const capture=async(label,url,open)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(context.origin+url);await page.evaluate(()=>document.fonts.ready);if(open)await page.getByText(open,{exact:true}).click();await page.screenshot({path:join(proof,`${label}-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);for(const el of await page.locator('button,a,summary').all())if(await el.isVisible())assert.ok((await el.innerText()).trim(),label+' unnamed control')};return page}
  for(const [label,c,p] of [['farm',farm,farm.people[0]],['office',farm,farm.people[1]],['h2a',farm,farm.people[2]],['nonprofit',nonprofit,nonprofit.people[0]],['minister',church,church.people[0]],['secretary',church,church.people[1]],['owner-correction',scorp,scorp.people[0]],['student',school,school.people[0]]])await capture('industry-'+label,path(c,p).replace('/api/','/app/'))
  await capture('industry-person-entry',farm.base.replace('/api/','/app/')+'/people/'+farm.people[0].id)
  await capture('industry-classification-form',path(nonprofit,nonprofit.people[0]).replace('/api/','/app/'),'Change classification with new evidence');await page.getByLabel('Evidence title',{exact:true}).fill('Updated signed charitable employer determination');await page.getByRole('button',{name:'Propose classification',exact:true}).click();await page.waitForURL(context.origin+path(nonprofit,nonprofit.people[0]).replace('/api/','/app/'));await page.getByRole('link',{name:'Review exact classification',exact:true}).click();await capture('industry-classification-review',new URL(page.url()).pathname);await page.getByRole('button',{name:'Approve this exact version',exact:true}).click();await page.waitForURL(context.origin+path(nonprofit,nonprofit.people[0]).replace('/api/','/app/'))
  await capture('industry-exact-check-review',path(farm,farm.people[0]).replace('/api/','/app/')+'/review/industry-check/'+farmCheck.id)
  await page.getByRole('button',{name:'Approve this exact version',exact:true}).click();await page.waitForURL(context.origin+path(farm,farm.people[0]).replace('/api/','/app/'))
  for(const label of ['social Security wages before this check (cents)','medicare wages before this check (cents)','futa wages before this check (cents)'])await page.getByLabel(label,{exact:true}).fill('0')
  await page.getByLabel('Year-to-date register or opening-balance reference',{exact:true}).fill('Signed opening register: no earlier wages this year.')
  await page.getByRole('button',{name:'Calculate federal check',exact:true}).click();await page.waitForURL(context.origin+path(farm,farm.people[0]).replace('/api/','/app/'))
  assert.equal((await data(path(farm,farm.people[0]))).checks.length,2)
  await capture('industry-calculated-from-form',path(farm,farm.people[0]).replace('/api/','/app/'))
  const forms=await import('./industry-forms-journey.mjs');await forms.industryFormsJourney({f,context,proof,capture,page,farm,officeCheck,nonprofit,charitable,scorp,ownerCheck,corrected,company,classify,preview,approve})
 }finally{await browser.close()}
 console.log('Industry journey: reviewed farm, office, H-2A, charity, clergy, shareholder, resident, student and family federal checks; original and corrected official forms; current authority passed.')
}


/** Continue actual deterministic payroll controls in the company whose AI key was removed. */
export async function payrollWithoutAiJourney(context, companyId, capture) {
 const f=industryFixture(context),{data,call,company,path,classify,preview,approve}=f
 const c=await company('Unused name',['Synthetic deterministic worker'],2026,{id:companyId})
 const p=c.people[0],api=path(c,p),ui=api.replace('/api/','/app/')
 await classify(c,p,ordinaryFacts)
 const check=await preview(c,p)
 assert.deepEqual(check.data.result.employeeTaxes,{incomeTaxCents:7808,socialSecurityCents:6200,medicareCents:1450,additionalMedicareCents:0})
 assert.equal(check.data.result.netCashCents,84542)
 assert.equal(check.data.result.totalEmployerTaxCents,13650)
 await capture(ui,'payroll-without-ai-calculated')
 await approve(c,p,'industry-check',check.id)
 const runDoor=c.base+'/pay-settings/earnings-run/'+c.run.id
 const review=await data(runDoor+'/review')
 const proofBrowser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try {
  const proofContext=await proofBrowser.newContext(), proofPage=await proofContext.newPage()
  await proofContext.addCookies([{name:context.cookie.split('=')[0],value:context.cookie.split('=')[1],url:context.origin}])
  await proofPage.goto(context.origin+runDoor.replace('/api/','/app/')+'/review')
  const cdp=await proofContext.newCDPSession(proofPage)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}})
  const enrollment=await data(c.base+'/pay-settings/passkeys/options',{})
  await data(c.base+'/pay-settings/passkeys/register',{id:enrollment.id,response:await credentialResponse(proofPage,enrollment.options,true)})
  await data(runDoor+'/approve',{version:review.version,reviewToken:review.reviewToken,gesture:'approve-exact-run',humanChallenge:review.humanProof.id,assertion:await credentialResponse(proofPage,review.humanProof.options)})
 } finally {await proofBrowser.close()}

 const before=await context.sql('SELECT * FROM env_run_approvals; SELECT * FROM env_audit')
 const release=await call(runDoor+'/release',{version:review.version})
 assert.equal(release.status,409);assert.deepEqual(await release.json(),{error:'run_not_payable'})
 assert.deepEqual(await context.sql('SELECT * FROM env_run_approvals; SELECT * FROM env_audit'),before,'Unavailable payment has no write or invented receipt')
 const forms=c.base+'/industry-returns'
 const form=await data(forms,{id:'synthetic-envelope-without-ai-return',version:0,form:'941',taxYear:2026,quarter:4,
  checks:[{personId:p.id,id:check.id,version:check.version}],address:{street:'100 Main Street',city:'Austin',state:'TX',postalCode:'78701'},
  employeeCount:0,depositsCents:0,basis:'Reviewed regular cash wages and opening register; prepared federal fields only.'},201)
 assert.equal((await call(forms+'/'+form.id+'/download')).status,409)
 const exact=await data(forms+'/'+form.id+'/review')
 assert.equal(exact.data.export.filingStatus,'prepared-not-submitted')
 assert.equal(exact.data.totals.incomeTaxWithheldCents,7808)
 assert.equal(exact.data.totals.socialSecurityTaxCents,12400)
 assert.equal(exact.data.totals.medicareTaxCents,2900)
 await data(forms+'/'+form.id+'/decision',{version:exact.version,reviewToken:exact.reviewToken})
 const document=await call(forms+'/'+form.id+'/download');assert.equal(document.status,200)
 const xml=await document.text()
 assert.ok(xml.includes('<field name="f1_15[0]"><value>78</value></field>'))
 assert.ok(xml.includes('<field name="f1_16[0]"><value>08</value></field>'))
 await capture(forms.replace('/api/','/app/'),'payroll-without-ai-prepared-return')
 const classification=await data(api+'/classification',f.proposal(c,ordinaryFacts,{version:1,w4:{...check.data.input.w4,step4cExtraWithholdingCents:1000}}),201)
 await approve(c,p,'industry-classification',classification.id)
 assert.equal((await call(forms+'/'+form.id+'/download')).status,409,'Changed withholding invalidates the prepared return without AI')
 const corrected=await preview(c,p,{corrects:check.id,correctionReason:'Human reviewed an additional ten dollars of federal withholding.'})
 assert.equal(corrected.data.result.netCashCents,83542)
 assert.equal(corrected.data.amendment.netCashDifferenceCents,-1000)
 assert.equal(corrected.data.amendment.employeeTaxes.incomeTaxCents,1000)
 assert.equal((await data(api)).checks.find(row=>row.id===check.id).data.result.netCashCents,84542,'Original check survives a deterministic correction')
 await capture(ui,'payroll-without-ai-correction')
 const hr=c.base+'/people/'+p.id+'/hris'
 const source={provider:'bamboohr',type:'rate',version:0,sourceVersion:1,sourcePersonId:'synthetic-envelope-without-ai-worker',
  sourceEvidence:'Synthetic reviewed BambooHR salary export',sourceApprovedBy:'Synthetic HR reviewer',
  export:{id:'synthetic-envelope-without-ai-rate',payType:'Hourly',payPer:'Hour',payRate:'150.00',payRateEffectiveDate:'2026-10-19'}}
 const imported=await data(hr,source,201)
 const stale=await call(runDoor+'/release',{version:review.version})
 assert.equal(stale.status,409);assert.deepEqual(await stale.json(),{error:'run_sources_changed'})
 await capture(hr.replace('/api/','/app/'),'payroll-without-ai-source-review')
 const sourceReview=await data(hr+'/'+imported.id+'/review')
 await data(hr+'/'+imported.id+'/approve',{version:sourceReview.version,reviewToken:sourceReview.reviewToken})
 await data(hr,source,409)
 assert.equal((await data(hr)).filter(row=>row.id===imported.id).length,1,'Source replay does not duplicate the rate')
 const next=await data(c.base+'/pay-settings/earnings-run',{id:c.run.id,version:c.run.version,
  groupId:c.run.preview.groupId,periodStart:'2026-10-19',periodEnd:'2026-10-25',payDate:'2026-10-30',frequency:'weekly'},201)
 assert.equal(next.preview.grossCashCents,120000,'Reviewed source rate replaces base earnings')
 c.run=next
 const recalculated=await preview(c,p)
 assert.deepEqual(recalculated.data.result.employeeTaxes,{incomeTaxCents:11208,socialSecurityCents:7440,medicareCents:1740,additionalMedicareCents:0})
 assert.equal(recalculated.data.result.netCashCents,99612)
 assert.equal((await data(hr)).find(row=>row.id===imported.id).delivered,false,'Reviewed upload never claims live delivery')
 await capture(ui,'payroll-without-ai-source-recalculation')
 assert.equal((await context.sql(`SELECT secret_cipher FROM env_external_providers WHERE company_id='${companyId}' AND id='openai'`))[0].secret_cipher,'')
 console.log('PAYROLL-WITHOUT-AI passed: same-company calculation, exact human approvals, prepared 941 fields, changed-source refusal, linked correction and replay-safe reviewed BambooHR rate recalculation; unavailable release has no effects; 1440 and 390.')
}
