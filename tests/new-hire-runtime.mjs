import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { privateValue } from './privacy-recorder.mjs'
import { join } from 'node:path'
export async function newHireJourney({origin,cookie,advanceClock}) {
 const call=(path,body,who=cookie)=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:who,origin,'content-type':['application','json'].join('/')},redirect:'manual',...(body===undefined?{}:{body:JSON.stringify(body)})})
 const data=async(path,body,status=200)=>{const r=await call(path,body);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const company=await data('/api/envelope/companies',{name:'Synthetic Ohio employer',ein:'00-0001717'},201),base='/api/envelope/companies/'+company.id
 const location=await data(base+'/locations',{name:'Ohio workplace',state:'OH'},201)
 const person=await data(base+'/people',{name:'Synthetic new employee',locationId:location.id},201),door=base+'/people/'+person.id+'/new-hire-reports',screen=door.replace('/api/','/app/')
 const proof=process.env.ENVELOPE_PROOF_DIR ?? '/tmp/envelope-new-hire-proof';await mkdir(proof,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try {
 const context=await browser.newContext();const [name,value]=cookie.split('=');await context.addCookies([{name,value,url:origin}]);const page=await context.newPage()
 const capture=async(label,target=screen,prepare)=>{
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});await page.goto(origin+target);await page.locator('h1').waitFor()
   await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement?.tagName==='A'))
   if(prepare) await prepare()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   assert.equal(await page.locator('button,a').evaluateAll(controls=>controls.every(control=>control.textContent.trim().length>1)),true,'Reporting controls have visible labels')
   await page.screenshot({path:join(proof,label+'-'+width+'.png'),fullPage:true})
  }
 }
 await capture('empty')
 await capture('coverage',base.replace('/api/','/app/')+'/new-hire-coverage')
 await capture('election-empty',base.replace('/api/','/app/')+'/new-hire-elections')
 const coverage=await data(base+'/new-hire-coverage');assert.equal(coverage.total,51);assert.equal(coverage.passing,51);assert.equal(coverage.complete,false);assert.ok(coverage.remainingFailures.length)
 const election=await data(base+'/new-hire-elections',{state:'OH',workStates:['OH','CA'],version:0,effectiveFrom:'2026-01-01',confirmation:'Synthetic federal election registration reference'},201)
 await capture('election-review',base.replace('/api/','/app/')+'/new-hire-elections/'+election.id+'/review')
 const er=await data(base+'/new-hire-elections/'+election.id+'/review');await data(base+'/new-hire-elections/'+election.id+'/approve',{version:er.version,reviewToken:er.reviewToken})
 const input={eventType:'hire',state:'OH',hireDate:'2026-01-01',employeeFirstName:'Synthetic',employeeMiddleName:'',employeeLastName:'Employee',employeeAddress:'1 Synthetic Street, Columbus OH 43215',employeeSsn:'900171717',employeeDateOfBirth:'1990-01-01',employerName:'Synthetic Ohio employer',employerAddress:'2 Synthetic Street, Columbus OH 43215',employerFein:'000001717',electionId:election.id}
 privateValue(input.employeeSsn)
 const inventory=JSON.parse(await readFile('src/envelope/people/new-hire-directories.json','utf8')), scratch=await mkdtemp(join(tmpdir(),'envelope-coverage-'))
 try {
 const probe=async value=>{const path=join(scratch,'source.json');await writeFile(path,JSON.stringify(value));const result=spawnSync(process.execPath,['scripts/compliance/new-hire-coverage.mjs','--source',path],{encoding:'utf8'});assert.equal(result.status,1);return JSON.parse(result.stdout)}
 assert.ok((await probe({...inventory,directories:inventory.directories.filter(d=>d.code!=='OH')})).missing.includes('Ohio directory'))
 assert.ok((await probe({...inventory,directories:inventory.directories.map(d=>d.code==='OH'?{...d,schemaCases:['hire']}:d)})).missing.includes('Ohio rehire schema case'))
 } finally {await rm(scratch,{recursive:true,force:true})}
 await data(door,{...input,employerFein:'000001718'},409)
 const boundary=await data(door,{...input,hireDate:'2026-10-07'},201)
 assert.equal((await data(door)).find(r=>r.id===boundary.id).overdue,false)
 await advanceClock('2026-10-28T00:00:30Z')
 assert.equal((await data(door)).find(r=>r.id===boundary.id).overdue,true)
 const report=await data(door,input,201),item=door+'/'+report.id
 assert.equal((await data(door,input,201)).replayed,true)
 let row=(await data(door)).find(r=>r.id===report.id);assert.equal(row.data.dueOn,'2026-01-21');assert.equal(row.overdue,true);assert.ok(row.data.repairOwner)
 await data(item+'/transfer',{version:1},409)
 const foreign=await data('/api/envelope/companies',{name:'Synthetic foreign employer',ein:'00-0001718'},201)
 await data('/api/envelope/companies/'+foreign.id+'/people/'+person.id+'/new-hire-reports',undefined,404)
 await capture('report-review',item.replace('/api/','/app/')+'/review')
 const review=await data(item+'/review');await data(item+'/approve',{version:review.version,reviewToken:review.reviewToken})
 const packet=await data(item+'/transfer',{version:1});assert.equal(packet.submissionClaimed,false);assert.equal(packet.fields.employeeSsn,input.employeeSsn);assert.equal(Object.hasOwn(packet.fields,'compensation'),false)
 await data(item+'/transfer',{version:1},409)
 await capture('transferred-overdue')
 const rejected={version:2,receiptId:'synthetic-envelope-1717',response:'rejected',reportingDate:'2026-01-22',agencyResponse:'Synthetic Ohio portal rejection: correct employee address.'}
 await data(item+'/response',rejected);assert.equal((await data(item+'/response',rejected)).replayed,true)
 await data(item+'/response',{...rejected,response:'accepted'},409)
 await capture('rejected')
 await capture('repair-form',screen+'?directory=OH&repair='+report.id)
 await page.getByRole('textbox',{name:'Employee complete mailing address',exact:true}).fill('3 Synthetic Street, Columbus OH 43215')
 await page.getByRole('button',{name:'Prepare repaired version',exact:true}).click()
 await page.waitForURL(origin+screen)
 const repaired=await data(item+'/review');await data(item+'/approve',{version:repaired.version,reviewToken:repaired.reviewToken});await data(item+'/transfer',{version:4})
 await data(item+'/response',{version:5,receiptId:'synthetic-envelope-1718',response:'accepted',reportingDate:'2026-01-23',agencyResponse:'Synthetic Ohio portal confirmation retained by owner.'})
 row=(await data(door)).find(r=>r.id===report.id);assert.equal(row.data.status,'accepted');assert.equal(row.data.history.length,2);assert.equal(row.overdue,false)
 await capture('accepted')
 const cross=await data(door,{...input,eventType:'rehire',hireDate:'2026-08-01',workState:'CA'},201),crossDoor=door+'/'+cross.id
 const crossReview=await data(crossDoor+'/review');await data(crossDoor+'/approve',{version:crossReview.version,reviewToken:crossReview.reviewToken})
 await page.goto(origin+screen);await page.getByRole('button',{name:'Prepare approved portal transfer',exact:true}).click();await page.getByRole('heading',{name:'Exact portal transfer prepared',exact:true}).waitFor()
 assert.ok((await page.locator('body').innerText()).includes('CA'))
 for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(proof,'approved-packet-'+width+'.png'),fullPage:true})}
 await data(crossDoor+'/response',{version:2,receiptId:'synthetic-envelope-cross-1717',response:'accepted',reportingDate:'2026-08-02',agencyResponse:'Synthetic Ohio confirmation for elected California hire'})
 const rehire=await data(door,{...input,eventType:'rehire',hireDate:'2026-07-01'},201);assert.notEqual(rehire.id,report.id)
 const rr=await data(door+'/'+rehire.id+'/review');await data(door+'/'+rehire.id+'/approve',{version:rr.version,reviewToken:rr.reviewToken})
 await data(base+'/new-hire-elections',{state:'OH',workStates:['OH','CA'],version:1,effectiveFrom:'2026-01-01',confirmation:'Synthetic changed election'},201)
 await data(door+'/'+rehire.id+'/transfer',{version:rr.version},409)
 assert.equal((await data(door)).find(r=>r.id===rehire.id).canTransfer,false)
 await capture('source-held')
 const renewedElection=await data(base+'/new-hire-elections/'+election.id+'/review');await data(base+'/new-hire-elections/'+election.id+'/approve',{version:renewedElection.version,reviewToken:renewedElection.reviewToken})
 await data(door+'/'+rehire.id+'/repair',{...input,eventType:'rehire',hireDate:'2026-07-01',version:1})
 const renewedReport=await data(door+'/'+rehire.id+'/review');await data(door+'/'+rehire.id+'/approve',{version:renewedReport.version,reviewToken:renewedReport.reviewToken})
 assert.equal((await data(door)).find(r=>r.id===rehire.id).canTransfer,true)
 await data(door+'/'+rehire.id+'/transfer',{version:renewedReport.version})
 await data(door+'/'+rehire.id+'/response',{version:3,receiptId:'synthetic-envelope-renewed-1717',response:'accepted',reportingDate:'2026-07-02',agencyResponse:'Synthetic Ohio confirmation after fresh election and exact report review'})

 // Execute every mapped directory through the real people API and exact review door.
 const goldenDays={AL:7,GA:10,IA:15,ME:7,MA:14,MS:15,RI:14,VT:10,WV:14}
 const optionalSourceValues={stateEmployerId:'synthetic-envelope-state-1717',employerPhone:'6145550100',employerContactName:'Synthetic Owner',employerContactPhone:'6145550100',workerType:'employee',healthInsuranceAvailable:'no',dependentHealthInsuranceAvailable:'no',healthInsuranceEligibleOn:'not-eligible',jobTitle:'Synthetic Clerk',occupationCode:'43-9061',startingSalary:'1000.00',payRate:'25.00',withholdingAddress:'2 Synthetic Street, Columbus OH 43215',occupation:'Synthetic Clerk',gender:'not-disclosed',salary:'1000.00',payFrequency:'weekly',payrollAddress:'2 Synthetic Street, Columbus OH 43215',employerFax:'6145550101',employeeHomeAddress:'1 Synthetic Street, Helena MT 59601'}
 let cases=0
 for(const entry of inventory.directories.filter(d=>d.implemented)) {
  const worker=await data(base+'/people',{name:'Synthetic '+entry.name+' employee',locationId:location.id},201),matrixDoor=base+'/people/'+worker.id+'/new-hire-reports'
  for(const eventType of ['hire','rehire']) {
   const month=eventType==='hire'?'01':'07',fields=Object.fromEntries(entry.requiredFields.map(k=>[k,input[k] ?? optionalSourceValues[k]])),payload={...fields,eventType,state:entry.code,workState:entry.code,hireDate:'2026-'+month+'-01'}
   if(entry.code==='PA') {
    payload.employerContactName='Synthetic Pennsylvania reporting owner'
    const {employerContactName,...withoutContactName}=payload
    assert.equal((await call(matrixDoor,withoutContactName)).status,400,'Pennsylvania refuses a missing employer contact name')
    await data(matrixDoor,{...payload,employerContactPhone:''},400)
    await data(matrixDoor,{...payload,employeeAddress:'PO Box 1, Harrisburg PA 17101'},400)
    await data(matrixDoor,{...payload,employerAddress:'PO Box 2, Harrisburg PA 17101'},400)
   }
   if(entry.code==='NH') {
    assert.equal((await call(matrixDoor,{...payload,employeeFirstName:'Alexandermichaelchristopherbenjaminjames'})).status,400,'New Hampshire refuses an overlength first name')
    assert.equal((await call(matrixDoor,{...payload,employeeLastName:'Montgomerywellingtonfitzgeraldharrington'})).status,400,'New Hampshire refuses an overlength last name')
    payload.employeeFirstName='Alexandermichaelchristopherbenjamin'
    payload.employeeLastName='Montgomerywellingtonfitzgerald'
    await data(matrixDoor,{...payload,stateEmployerId:''},400)
    await data(matrixDoor,{...payload,workerType:'contractor'},409)
    await data(matrixDoor,{...payload,employeeAddress:'PO Box 1, Concord NH 03301'},400)
   }
   const created=await data(matrixDoor,{...payload,employeeDateOfBirth:'1990-01-01'},201),path=matrixDoor+'/'+created.id
   const saved=(await data(matrixDoor)).find(r=>r.id===created.id)
   assert.equal(saved.data.dueOn,'2026-'+month+'-'+String((goldenDays[entry.code] ?? 20)+1).padStart(2,'0'),entry.name+' deadline')
   if(entry.code==='NH') {
    await data(path+'/repair',{...payload,employeeFirstName:'Alexandermichaelchristopherbenjaminjames',version:1},400)
    if(eventType==='hire') await capture('new-hampshire-review',path.replace('/api/','/app/')+'/review')
   }
   const exact=await data(path+'/review');await data(path+'/approve',{version:exact.version,reviewToken:exact.reviewToken})
   const edge=await data(path+'/transfer',{version:1})
   assert.deepEqual(Object.keys(edge.fields).sort(),[...entry.requiredFields,'hireDate',...(entry.includeWorkState?['stateOfHire']:[])].sort(),entry.name+' minimal schema fields')
   assert.equal(edge.directoryUrl,entry.directoryUrl);assert.equal(edge.submissionClaimed,false)
   if(entry.code==='PA') {assert.equal(edge.fields.employerContactName,'Synthetic Pennsylvania reporting owner','Pennsylvania transfers the reviewed employer contact name');assert.equal(edge.fields.employerContactPhone,'6145550100');assert.equal(edge.fields.stateOfHire,'PA');assert.equal(Object.hasOwn(edge.fields,'employeeDateOfBirth'),false)}
   if(entry.code==='NH') {assert.equal(edge.fields.employeeFirstName,payload.employeeFirstName,'New Hampshire preserves the reviewed first name');assert.equal(edge.fields.employeeLastName,payload.employeeLastName,'New Hampshire preserves the reviewed last name');assert.equal(edge.directoryUrl,'https://www2.nhes.nh.gov/webtax/');assert.equal(edge.fields.workerType,'employee');assert.equal(edge.fields.stateEmployerId,optionalSourceValues.stateEmployerId)}
   await data(path+'/response',{version:2,receiptId:'synthetic-envelope-matrix-'+entry.code+'-'+eventType,response:'accepted',reportingDate:'2026-'+month+'-02',agencyResponse:'Synthetic observed portal confirmation at the directory boundary'})
   assert.equal((await data(matrixDoor)).find(r=>r.id===created.id).data.status,'accepted');cases++
  }
 }
 assert.equal(cases,102)
 console.log('Directory matrix executed '+cases+' hire and rehire cases; official transport evidence remains explicitly incomplete.')
 const afterMatrix=await data(base+'/new-hire-coverage');assert.equal(afterMatrix.complete,false,'Human-attested confirmations cannot certify nationwide execution');assert.equal(afterMatrix.passing,51)
 await capture('state-fields',screen+'?directory=IN')
 await capture('pennsylvania-fields',screen+'?directory=PA');await capture('new-hampshire-fields',screen+'?directory=NH',async()=>{
  for(const [field,value] of Object.entries({hireDate:'2026-07-01',employeeFirstName:'Alexandermichaelchristopherbenjamin',employeeLastName:'Montgomerywellingtonfitzgerald',employeeAddress:'1 Synthetic Street, Concord NH 03301',employeeSsn:input.employeeSsn,employerName:'Synthetic Ohio employer',employerAddress:'2 Synthetic Street, Concord NH 03301',employerFein:input.employerFein,stateEmployerId:optionalSourceValues.stateEmployerId,workerType:'employee'})) {
   await page.locator('input[name="'+field+'"]').fill(value)
   assert.equal(await page.locator('input[name="'+field+'"]').inputValue(),value,'New Hampshire form preserves entered '+field)
  }
 })
 await capture('person-navigation',base.replace('/api/','/app/')+'/people/'+person.id)

 assert.equal((await call(door,undefined,'')).status,401)
 console.log('New-hire reporting public-door journey passed: exact review, election, overdue, rejection repair, duplicate replay and both widths; nationwide coverage remains incomplete.')
 } finally {await browser.close()}
}
