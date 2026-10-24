import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { claimsBrowser,safeInputsBrowser } from './claims-browser.mjs'
import { portalViewResponse,sidesSubmissionEdge } from './claims-portal-edge.mjs'
import { claimsFixture,claimArtifact } from './claims-fixture.mjs'
import { capturedWillowClaimsFixture } from './claims-willow-fixture.mjs'

export async function claimsJourney(context){
 const capture=JSON.parse(await readFile(new URL('./fixtures/sides/willow-native-capture.json',import.meta.url)))
 capture.originals=Object.fromEntries(Object.entries(capture.originals).map(([k,v])=>[k,{filename:v.filename,bytes:Buffer.from(v.base64,'base64')}]))
 capture.manifest=JSON.parse(capture.originals.manifest.bytes);capture.recordsText=capture.originals.records.bytes.toString();capture.audit=JSON.parse(capture.originals.audit.bytes)
 capturedWillowClaimsFixture(capture)
 const f=await claimsFixture(context,{willow:capture}),{data,call}=f
 const create=async(overrides={})=>data(f.claims+'/import',f.validRequest(overrides),201)
 await data(f.claims+'/import',f.validRequest({employerEin:'000006902'}),403)
 await safeInputsBrowser({context,f})
 const c=await create(),door=f.claims+'/'+c.id
 const get=()=>data(door)
 assert.equal((await create()).id,c.id)
 assert.equal((await data(f.claims)).length,2)
 assert.equal((await call(door,undefined,'')).status,401)
 let row=await get();assert.equal(row.data.status,'awaiting-evidence');assert.ok(row.data.escalations[0].beforeDeadline)
 const unrelated=await data(f.base+'/people',{name:'Jordan Reed',locationId:f.location.id},201)
 await data(f.base+'/people/'+unrelated.id+'/private',{kind:'ssn',version:0,value:'900-69-0002'},201)
 await data(door+'/evidence',f.evidence(row.version,{personId:unrelated.id}),403)
 assert.equal((await get()).version,row.version)
 const holds=await data(door+'/evidence',f.evidence(row.version,{willow:undefined,artifacts:[f.files.mandate,f.files.register]}))
 row=await get();assert.ok(row.data.holds.some(h=>h.includes('Willow')))
 await data(door+'/prepare',f.prepare(row.version));row=await get();assert.equal(row.data.status,'held');assert.ok(!row.data.packet)
 await data(door+'/review',undefined,409)
 await data(door+'/evidence',f.evidence(row.version,{disputed:true}));row=await get();assert.equal(row.data.status,'held');assert.ok(row.data.escalations.at(-1).beforeDeadline)
 await data(door+'/evidence',f.evidence(row.version),409)
 const resolution=claimArtifact('resolution-evidence','synthetic-employer-resolution.txt','Employer reviewed the original facts and resolved the dispute. Layoff remains the supported category.')
 await data(door+'/evidence',f.evidence(row.version,{artifacts:[...f.evidence(row.version).artifacts,resolution],disputeResolutionRef:resolution.id}));row=await get();assert.deepEqual(row.data.holds,[])
 assert.equal(row.data.willow.lastDayWorked,'2026-10-15');assert.equal(row.data.willow.separationDate,'2026-10-16')
 assert.equal(row.data.payroll[0].grossCents,100000)
 await data(door+'/prepare',f.prepare(row.version,{answers:f.prepare(row.version).answers.map((a,i)=>i? a:{...a,citations:['unknown-source']})}),400)
 await data(door+'/prepare',f.prepare(row.version));row=await get();assert.equal(row.data.status,'ready-for-review')
 const review=await data(door+'/review')
 await data(door+'/sign',f.signature(review,{responseDigest:'0'.repeat(64)}),409)
 await data(door+'/sign',f.signature(review),403)
 await f.stepUp()
 await data(door+'/sign',f.signature(review));row=await get();assert.equal(row.data.status,'signed')
 const packet=await call(door+'/packet');assert.equal(packet.status,200);const html=await packet.text();assert.ok(html.includes('***-**-0001'));assert.ok(!html.includes('900-69-0001'));assert.ok(html.includes('Alex Morgan'))
 await data(door+'/handoff',{version:row.version,responseDigest:row.data.responseDigest},409)
 const preview=portalViewResponse(row)
 await data(door+'/portal-review',{version:row.version,responseDigest:row.data.responseDigest,portalResponseArtifactId:preview.id,matchesReviewedResponse:false,artifacts:[preview]},409)
 await data(door+'/portal-review',{version:row.version,responseDigest:row.data.responseDigest,portalResponseArtifactId:preview.id,matchesReviewedResponse:true,artifacts:[preview]});row=await get()
 const transfer={version:row.version,responseDigest:row.data.responseDigest}
 await data(door+'/handoff',transfer);await data(door+'/handoff',transfer);row=await get();assert.equal(row.data.status,'human-portal-handoff');assert.equal(row.data.confirmations.length,0)
 const edge=sidesSubmissionEdge(),accepted=edge.submit(row);edge.submit(row);assert.equal(edge.count,1)
 const confirmation=f.confirmation(row,false,accepted)
 await data(door+'/confirmation',{...confirmation,confirmation:{...confirmation.confirmation,employerEin:'000006902'}},400)
 await data(door+'/confirmation',confirmation);row=await get();assert.equal(row.data.status,'confirmation-reported');assert.equal(row.data.confirmations[0].responseAccepted,false)
 await data(door+'/confirmation',{...confirmation,version:row.version,reviewEvidence:true});row=await get();assert.equal(row.data.confirmations[0].responseAccepted,true);assert.equal(row.data.confirmations[0].timeliness,'before-cutoff');assert.equal(row.data.independentlyVerifiedAgencyAcceptance,false)
 const revision=row.version;await data(door+'/confirmation',{...confirmation,reviewEvidence:true});assert.equal((await get()).version,revision)
 const follow=claimArtifact('agency-followup','synthetic-agency-followup.txt','Agency asks: Confirm the worker’s actual last day worked. Assigned to the employer representative.')
 const followUp={requestIdentity:row.data.request.requestIdentity,agencyReference:'synthetic-envelope-followup',employerEin:f.company.normalizedEin,stateEmployerId:f.stateEmployerId,receivedAt:new Date().toISOString(),dueOn:new Date(Date.parse(f.request.dueOn+'T12:00:00Z')+86400000).toISOString().slice(0,10),deadlineAt:new Date(Date.parse(f.request.deadlineAt)+86400000).toISOString(),timeZone:f.timeZone,deadlineBasis:f.request.deadlineBasis,questions:[{question:'Confirm the actual last day worked.',sourceRef:'Retained agency correspondence'}],sourceRef:'Retained agency correspondence',sourceSha256:follow.sha256,ownerId:f.operator.id}
 await data(door+'/follow-up',{version:row.version,followUp,artifacts:[follow]});row=await get();assert.equal(row.data.status,'follow-up-required');assert.ok(row.data.escalations.at(-1).beforeDeadline)
 await data(door+'/follow-up',{version:row.version,followUp,artifacts:[follow]});assert.equal((await get()).data.followUps.length,1)
 assert.equal((await call(door+'/artifacts/'+f.files.request.id)).status,200)
 assert.equal((await call(door+'/artifacts/'+f.files.request.id,undefined,'')).status,401)
 const wages=await create({requestId:'synthetic-envelope-wage-request',exchange:'earnings',claimantStatedReason:undefined,requestedWeeks:[{weekEnding:'2026-10-10'},{weekEnding:'2026-10-17'}]}),wageDoor=f.claims+'/'+wages.id
 await data(wageDoor+'/evidence',f.evidence(wages.version));let wageRow=await data(wageDoor)
 const wageAnswers={workedOrReceivedPayments:'Yes',stillWorking:'No',regularRate:'25.00',payFrequency:'Weekly',payPeriodStart:'2026-10-09',payPeriodEarnings:'Week ending 2026-10-10: 8 hours, $200.00; week ending 2026-10-17: 32 hours, $800.00. Date paid 2026-10-16.'}
 await data(wageDoor+'/prepare',f.prepare(wageRow.version,{answers:Object.entries(wageAnswers).map(([field,value])=>({field,value,citations:[f.payroll.id,f.files.register.id]}))}))
 const proof=await claimsBrowser({context,f,completedDoor:door,wageDoor,edge})
 const wageReview=await data(wageDoor+'/review');await data(wageDoor+'/sign',f.signature(wageReview));wageRow=await data(wageDoor)
 const wagePreview=portalViewResponse(wageRow);await data(wageDoor+'/portal-review',{version:wageRow.version,responseDigest:wageRow.data.responseDigest,portalResponseArtifactId:wagePreview.id,matchesReviewedResponse:true,artifacts:[wagePreview]});wageRow=await data(wageDoor)
 await data(wageDoor+'/handoff',{version:wageRow.version,responseDigest:wageRow.data.responseDigest});wageRow=await data(wageDoor)
 await data(wageDoor+'/confirmation',f.confirmation(wageRow,true,edge.submit(wageRow)));assert.equal((await data(wageDoor)).data.confirmations[0].responseAccepted,true)
 const retained=await get(),historicalPacket=door+'/versions/'+retained.data.previousResponses[0].version+'/packet'
 const packetPaths=[door+'/packet',historicalPacket,door+'/artifacts/'+f.files.request.id]
 const foreign=await data('/api/envelope/companies',{name:'Synthetic packet custody',ein:'00-0000578'},201)
 await data('/auth/invite',{email:'synthetic-envelope-578@example.com',displayName:'Synthetic packet reader',role:'member'},202)
 const invitation=new URL(context.edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;','&'))
 const admitted=await call('/auth/confirm',{token:invitation.searchParams.get('token')},'')
 assert.equal(admitted.status,303)
 const ungranted=admitted.headers.get('set-cookie').split(';')[0]
 for(const path of packetPaths) {
  const response=await call(path);assert.equal(response.status,200)
  assert.equal(response.headers.get('cache-control'),'no-store')
  assert.equal(response.headers.get('x-content-type-options'),'nosniff')
  assert.match(response.headers.get('content-disposition'),/^attachment;/)
  assert.equal((await call(path,undefined,'')).status,401)
  assert.equal((await call(path,undefined,ungranted)).status,403)
  assert.equal((await call(path.replace(f.base,'/api/envelope/companies/'+foreign.id))).status,404)
 }
 const pending=await create({requestId:'synthetic-envelope-authority-change'}),pendingDoor=f.claims+'/'+pending.id
 await data(pendingDoor+'/evidence',f.evidence(pending.version));let pendingRow=await data(pendingDoor)
 await data(pendingDoor+'/prepare',f.prepare(pendingRow.version));const pendingReview=await data(pendingDoor+'/review')
 await data(pendingDoor+'/sign',f.signature(pendingReview));pendingRow=await data(pendingDoor)
 const pendingPreview=portalViewResponse(pendingRow)
 await data(pendingDoor+'/portal-review',{version:pendingRow.version,responseDigest:pendingRow.data.responseDigest,portalResponseArtifactId:pendingPreview.id,matchesReviewedResponse:true,artifacts:[pendingPreview]});pendingRow=await data(pendingDoor)
 await data(f.registerDoor+'/income',{...f.incomeInput,version:f.payroll.version,grossCents:100100},201)
 await data(pendingDoor+'/handoff',{version:pendingRow.version,responseDigest:pendingRow.data.responseDigest},409)
 assert.equal((await data(pendingDoor)).data.handoff,undefined)
 assert.equal((await call('/auth/signout',{})).status,204)
 assert.equal((await call(door+'/packet')).status,401)
 assert.equal((await call(door+'/artifacts/'+f.files.request.id)).status,401)
 assert.equal((await call(historicalPacket)).status,401)
 assert.equal((await call(pendingDoor+'/handoff',{version:pendingRow.version,responseDigest:pendingRow.data.responseDigest})).status,401)
 console.log('Claims journey passed; screenshots: '+proof)
}
