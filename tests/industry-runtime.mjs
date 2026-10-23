import assert from 'node:assert/strict'
import { mkdir,writeFile,readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
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
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const ctx=await browser.newContext({ignoreHTTPSErrors:true});const [name,value]=context.cookie.split('=');await ctx.addCookies([{name,value,url:context.origin}]);const page=await ctx.newPage()
  const capture=async(label,url,open)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(context.origin+url);await page.evaluate(()=>document.fonts.ready);if(open)await page.getByText(open,{exact:true}).click();await page.screenshot({path:join(proof,`${label}-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);for(const el of await page.locator('button,a,summary').all())if(await el.isVisible())assert.ok((await el.innerText()).trim(),label+' unnamed control')};return page}
  for(const [label,c,p] of [['farm',farm,farm.people[0]],['office',farm,farm.people[1]],['h2a',farm,farm.people[2]],['nonprofit',nonprofit,nonprofit.people[0]],['minister',church,church.people[0]],['secretary',church,church.people[1]],['owner-correction',scorp,scorp.people[0]],['student',school,school.people[0]]])await capture('industry-'+label,path(c,p).replace('/api/','/app/'))
  await capture('industry-person-entry',farm.base.replace('/api/','/app/')+'/people/'+farm.people[0].id)
  await capture('industry-classification-form',path(nonprofit,nonprofit.people[0]).replace('/api/','/app/'),'Change classification with new evidence');await page.getByLabel('Evidence title',{exact:true}).fill('Updated signed charitable employer determination');await page.getByRole('button',{name:'Propose classification',exact:true}).click();await page.waitForURL(context.origin+path(nonprofit,nonprofit.people[0]).replace('/api/','/app/'));await page.getByRole('link',{name:'Review exact classification',exact:true}).click();await capture('industry-classification-review',new URL(page.url()).pathname);await page.getByRole('button',{name:'Approve this exact version',exact:true}).click();await page.waitForURL(context.origin+path(nonprofit,nonprofit.people[0]).replace('/api/','/app/'))
  await capture('industry-exact-check-review',path(farm,farm.people[0]).replace('/api/','/app/')+'/review/industry-check/'+farmCheck.id)
  await page.getByRole('button',{name:'Approve this exact version',exact:true}).click();await page.waitForURL(context.origin+path(farm,farm.people[0]).replace('/api/','/app/'))
  const forms=await import('./industry-forms-journey.mjs');await forms.industryFormsJourney({f,context,proof,capture,page,farm,officeCheck,nonprofit,charitable,scorp,ownerCheck,corrected,company,classify,preview,approve})
 }finally{await browser.close()}
 console.log('Industry journey: reviewed farm, office, H-2A, charity, clergy, shareholder, resident, student and family federal checks; original and corrected official forms; current authority passed.')
}
