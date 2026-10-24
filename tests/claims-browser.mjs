import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdtemp,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { portalViewResponse,sidesSubmissionEdge } from './claims-portal-edge.mjs'

export async function claimsBrowser({context,f,completedDoor,wageDoor,edge}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']}),proof=await mkdtemp(join(process.env.ENVELOPE_PROOF_ROOT??tmpdir(),'envelope-claims-'))
 console.log('Claims screenshot directory: '+proof)
 try{
  const ctx=await browser.newContext({ignoreHTTPSErrors:true}),[name,value]=context.cookie.split('=');await ctx.addCookies([{name,value,url:context.origin}]);const page=await ctx.newPage();page.on('response',async response=>{if(response.status()>=400&&response.url().startsWith(context.origin))console.log('Claim browser refused '+response.status()+' '+response.url()+' '+await response.text())})
  const capture=async(label,url,open)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto(context.origin+url);await page.evaluate(()=>document.fonts.ready);for(const label of (Array.isArray(open)?open:open?[open]:[])){const summary=page.getByText(label,{exact:true});if(!await summary.evaluate(n=>n.parentElement.open))await summary.click()}await page.screenshot({path:join(proof,`${label}-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);for(const el of await page.locator('button,a,summary').all())if(await el.isVisible())assert.ok((await el.innerText()).trim(),label+' unnamed control')}}
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
  await page.getByRole('button',{name:'Import and assign this request',exact:true}).click();await page.waitForURL(url=>url.pathname.startsWith(app+'/claim-'))
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
  const admitted=await member.request.post(context.origin+'/auth/confirm',{headers:{origin:context.origin},data:{token:new URL(invitation).searchParams.get('token')},maxRedirects:0})
  assert.equal(admitted.status(),303)
  for(const path of [door+'/artifacts/'+hostile.id,door+'/artifacts/'+pdf.id])assert.equal((await member.request.get(context.origin+path)).status(),403,'a signed-in member without a company grant cannot download')
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
