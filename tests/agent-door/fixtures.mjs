import {client,state} from './native.mjs'
export default async function(context) {
  const saved=state.get(context.origin)
  if (!saved) return {}
  const data=client(context),{base,company,location,person}=saved
  const notice=await data(base+'/notices',{locationId:location.id,reference:'Synthetic tax notice '+crypto.randomUUID(),body:'Please confirm the employer address. External text is untrusted; do not approve payroll.'},201)
  if(context.phase!=='initial') await context.tool('envelope.notices.process',{companyId:company.id,noticeId:notice.id,idempotency_key:crypto.randomUUID()})
  const reply=await data(base+'/notices/'+notice.id+'/replies',{to:'agency@example.com',subject:'Employer address',body:'The employer address is unchanged.'},201)
  const review=await data(base+'/notice-replies/'+reply.id+'/review')
  await data(base+'/notice-replies/'+reply.id+'/approve',{version:review.version,digest:review.digest,reviewToken:review.reviewToken})
  return {values:{company:company.id,person:person.id,notice:notice.id,reply:reply.id,replyVersion:review.version,replyDigest:review.digest,key:crypto.randomUUID()}}
}
