import assert from 'node:assert/strict'
import { claimArtifact } from './claims-fixture.mjs'

// Test-only agency edge: the visible questions, View Response and confirmation
// stages are grounded in the retained official E-Response guide screenshots.
// This fixture is not an agency endpoint or a live employer submission.
export function portalViewResponse(row){
 const d=row.data,escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 return claimArtifact('portal-view-'+d.responseDigest.slice(0,40),'synthetic-sides-view-response.html',`<!doctype html><html lang="en"><head><title>SIDES E-Response · View Response</title></head><body><h1>View Response</h1>${d.activeFollowUp?`<p>Additional Fact Finding: ${escape(d.activeFollowUp.agencyReference)}</p>`:''}<p>Claim Number: ${escape(d.request.requestId)}</p><p>FEIN: ${escape(d.request.employerEin)} · SEIN: ${escape(d.request.stateEmployerId)}</p><p>Claimant: ${escape(d.request.claimantName)}</p><dl>${d.packet.fields.map(f=>`<dt>${escape(f.label)}</dt><dd>${escape(f.value)}</dd>`).join('')}</dl><p>Preparer: ${escape(d.preparer.name)}</p><p>Attachments: ${(d.attachments??[]).map(a=>escape(a.name)).join(', ')}</p></body></html>`,['text','html'].join('/'))
}
export function sidesSubmissionEdge(){
 const accepted=new Map()
 return {
  submit(row){
   assert.ok(row.data.signature&&row.data.portalReview&&row.data.handoff)
   const original=row.data.request.requestIdentity,identity=original+'|'+(row.data.activeFollowUp?.agencyReference??'original'),existing=accepted.get(identity)
   if(row.data.activeFollowUp)assert.ok(accepted.has(original+'|original'),'follow-up answers amend an already submitted agency case')
   if(existing){assert.equal(existing.digest,row.data.responseDigest,'changed submitted responses require an agency amendment');return{...existing,replayed:true}}
   const result={digest:row.data.responseDigest,confirmationNumber:'synthetic-envelope-sides-'+accepted.size,submittedAt:new Date().toISOString(),agencyMessage:'Your response has been accepted.'}
   accepted.set(identity,result);return result
  },
  get count(){return accepted.size},
 }
}
