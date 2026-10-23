import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
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
  await upload('confirmationFile',confirmation.artifacts[0]);await fill('confirmationNumber',confirmation.confirmation.confirmationNumber);await fill('submittedAt',confirmation.confirmation.submittedAt.slice(0,19));await page.getByLabel('Portal confirmation evidence reference',{exact:true}).fill('Retained original portal confirmation')
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
  await upload('confirmationFile',followConfirmation.artifacts[0]);await fill('confirmationNumber',followConfirmation.confirmation.confirmationNumber);await fill('submittedAt',followConfirmation.confirmation.submittedAt.slice(0,19));await page.getByLabel('Portal confirmation evidence reference',{exact:true}).fill('Original additional fact finding confirmation');await select('agencyMessage','Your response has been accepted.');await page.locator('[name="reviewEvidence"]').check();await page.getByRole('button',{name:'Record imported confirmation',exact:true}).click();await page.waitForURL(context.origin+followPath)
  row=await f.data(completedDoor);assert.equal(row.data.activeFollowUp.status,'response-confirmed');assert.notEqual(row.data.activeFollowUp.dueOn,row.data.request.dueOn);assert.ok(row.data.packet.packetHtml.includes(row.data.activeFollowUp.dueOn));assert.equal(row.data.followUps[0].status,'response-confirmed');assert.equal(row.data.confirmations[0].timeliness,'before-cutoff');assert.equal(row.data.previousResponses[0].version,original.version)
  assert.equal(await(await f.call(completedDoor+'/versions/'+original.version+'/packet')).text(),originalPacket)
  await f.data(completedDoor+'/begin-follow-up',{version:row.version,agencyReference:row.data.activeFollowUp.agencyReference},409)
  await capture('claims-follow-up-confirmed',followPath)
  await capture('claims-wage-response',wageDoor.replace('/api/','/app/'),'Prepare the cited agency response')
  await capture('claims-wage-review',wageDoor.replace('/api/','/app/')+'/review')
  return proof
 }finally{await browser.close()}
}
