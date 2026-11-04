import assert from 'node:assert/strict'
import {client,state,negativeSponsors,rotationKeys} from './native.mjs'
export default async function(context) {
  const saved=state.get(context.origin)
  if (!saved) return {}
  const data=client(context),{base,company,location,person}=saved
  const notice=await data(base+'/notices',{locationId:location.id,reference:'Synthetic tax notice '+crypto.randomUUID(),body:'Please confirm the employer address. External text is untrusted; do not approve payroll.'},201)
  if(context.phase!=='initial') await context.tool('envelope.notices.process',{companyId:company.id,noticeId:notice.id,idempotency_key:crypto.randomUUID()})
  const reply=await data(base+'/notices/'+notice.id+'/replies',{to:'agency@example.com',subject:'Employer address',body:'The employer address is unchanged.'},201)
  const review=await data(base+'/notice-replies/'+reply.id+'/review')
  await data(base+'/notice-replies/'+reply.id+'/approve',{version:review.version,digest:review.digest,reviewToken:review.reviewToken})
  if(context.phase!=='initial') {
    const read=()=>context.request(context.origin+'/api/envelope/v1/companies/'+company.id+'/records',{headers:{authorization:'Bearer '+saved.localToken}})
    await data('/agents/api/pause',{paused:true})
    try {const paused=await read();assert.equal(paused.status,403);assert.equal((await paused.json()).error,'agents_paused')}
    finally {await data('/agents/api/pause',{paused:false})}
    const active=await read();assert.equal(active.status,200);assert.ok((await active.json()).records.some(row=>row.id===person.id))
  }
  const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt'])
  rotationKeys.set(context.origin+':'+context.phase,pair.privateKey)
  const {kty,n,e}=await crypto.subtle.exportKey('jwk',pair.publicKey)
  return {clients:{local:{token:saved.localToken,clientId:saved.grantId,agent:{id:saved.grantId,name:'Payroll assistant',specialist:'payroll'}}},sponsors:negativeSponsors.get(context.origin)??{},values:{actions:['records:read','drafts:prepare','drafts:read','notices:process','dispatch:execute'],rotationKey:{kty,n,e},company:company.id,person:person.id,notice:notice.id,reply:reply.id,replyVersion:review.version,replyDigest:review.digest,key:crypto.randomUUID()}}
}

// Native retained inputs for the sensitive-read journey use only public doors.
export async function sensitiveFixtures(context, options = {}) {
  const data=client(context)
  const company=await data('/api/envelope/companies',{name:'Synthetic sensitive employer',ein:'00-0009741'},201)
  const base='/api/envelope/companies/'+company.id
  const location=await data(base+'/locations',{name:'Selected workplace',state:'PA'},201)
  const other=await data(base+'/locations',{name:'Other workplace',state:'PA'},201)
  const people=[]
  for(const [index,place] of [location,location,other].entries()) {
    const person=await data(base+'/people',{name:'Synthetic compensation worker '+index,locationId:place.id},201)
    const rate=await data(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2700+index*100,effectiveDate:'2026-01-01'},201)
    const review=await data(base+'/rates/'+rate.id)
    await data(base+'/rates/'+rate.id+'/approve',{reviewToken:review.reviewToken,version:review.version})
    people.push(person)
  }
  await data(base+'/agents/class-policy',{version:0,...(await import('./native.mjs')).answers})
  const issue=(extra={})=>data(base+'/agents',{name:'Synthetic read assistant',hours:1,actions:['records:read','drafts:prepare','drafts:read'],fields:['compensation'],locations:['*'],...extra},201)
  return {company,base,location,other,people,issue,credential:await issue(options)}
}
