import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
export async function newHireJourney({origin,cookie}) {
 const call=(path,body,who=cookie)=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:who,origin,'content-type':'application/json'},redirect:'manual',...(body===undefined?{}:{body:JSON.stringify(body)})})
 const data=async(path,body,status=200)=>{const r=await call(path,body);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const company=await data('/api/envelope/companies',{name:'Synthetic Ohio employer',ein:'00-0001717'},201),base='/api/envelope/companies/'+company.id
 const location=await data(base+'/locations',{name:'Ohio workplace',state:'OH'},201)
 const person=await data(base+'/people',{name:'Synthetic new employee',locationId:location.id},201),door=base+'/people/'+person.id+'/new-hire-reports',screen=door.replace('/api/','/app/')
 const proof=process.env.ENVELOPE_PROOF_DIR ?? '/tmp/envelope-new-hire-proof';await mkdir(proof,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 try {
 const context=await browser.newContext();const [name,value]=cookie.split('=');await context.addCookies([{name,value,url:origin}]);const page=await context.newPage()
 const capture=async(label)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(origin+screen);await page.getByRole('heading',{name:'Reports and repair',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement?.tagName==='A'));await page.screenshot({path:join(proof,label+'-'+width+'.png'),fullPage:true})}}
 await capture('empty')
 const coverage=await data(base+'/new-hire-coverage');assert.equal(coverage.total,51);assert.equal(coverage.passing,1);assert.ok(coverage.uncovered.includes('California'))
 const election=await data(base+'/new-hire-elections',{state:'OH',version:0,effectiveFrom:'2026-01-01',confirmation:'Synthetic federal election registration reference'},201)
 const er=await data(base+'/new-hire-elections/'+election.id+'/review');await data(base+'/new-hire-elections/'+election.id+'/approve',{version:er.version,reviewToken:er.reviewToken})
 const input={eventType:'hire',state:'OH',hireDate:'2026-01-01',employeeFirstName:'Synthetic',employeeMiddleName:'',employeeLastName:'Employee',employeeAddress:'1 Synthetic Street, Columbus OH 43215',employeeSsn:'900171717',employeeDateOfBirth:'1990-01-01',employerName:'Synthetic Ohio employer',employerAddress:'2 Synthetic Street, Columbus OH 43215',employerFein:'000001717',electionId:election.id}
 const report=await data(door,input,201),item=door+'/'+report.id
 assert.equal((await data(door,input,201)).replayed,true)
 let row=(await data(door))[0];assert.equal(row.data.dueOn,'2026-01-21');assert.equal(row.overdue,true);assert.ok(row.data.repairOwner)
 await data(item+'/transfer',{version:1},409)
 const review=await data(item+'/review');await data(item+'/approve',{version:review.version,reviewToken:review.reviewToken})
 const packet=await data(item+'/transfer',{version:1});assert.equal(packet.submissionClaimed,false);assert.equal(packet.fields.employeeSsn,input.employeeSsn);assert.equal(Object.hasOwn(packet.fields,'compensation'),false)
 await data(item+'/transfer',{version:1},409)
 await capture('transferred-overdue')
 const rejected={version:2,receiptId:'synthetic-envelope-1717',response:'rejected',reportingDate:'2026-01-22',agencyResponse:'Synthetic Ohio portal rejection: correct employee address.'}
 await data(item+'/response',rejected);assert.equal((await data(item+'/response',rejected)).replayed,true)
 await capture('rejected')
 await data(item+'/repair',{...input,version:3,employeeAddress:'3 Synthetic Street, Columbus OH 43215'})
 const repaired=await data(item+'/review');await data(item+'/approve',{version:repaired.version,reviewToken:repaired.reviewToken});await data(item+'/transfer',{version:4})
 await data(item+'/response',{version:5,receiptId:'synthetic-envelope-1718',response:'accepted',reportingDate:'2026-01-23',agencyResponse:'Synthetic Ohio portal confirmation retained by owner.'})
 row=(await data(door))[0];assert.equal(row.data.status,'accepted');assert.equal(row.data.history.length,2);assert.equal(row.overdue,false)
 await capture('accepted')
 const rehire=await data(door,{...input,eventType:'rehire',hireDate:'2026-07-01'},201);assert.notEqual(rehire.id,report.id)
 await data(door,{...input,state:'CA'},409)
 assert.equal((await call(door,undefined,'')).status,401)
 console.log('New-hire reporting public-door journey passed: exact review, election, overdue, rejection repair, duplicate replay and both widths; nationwide coverage remains incomplete.')
 } finally {await browser.close()}
}
