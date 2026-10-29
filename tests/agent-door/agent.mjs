import {client,state,answers} from './native.mjs'
export default async function({agentId,request,origin}) {
  const data=client({request,origin})
  const company=await data('/api/envelope/companies',{name:'Synthetic Northstar Payroll',ein:'00-0000041'},201),base='/api/envelope/companies/'+company.id
  const location=await data(base+'/locations',{name:'Portland shop',state:'OR'},201)
  const person=await data(base+'/people',{name:'Morgan Rivera',locationId:location.id},201)
  const rate=await data(base+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2500,effectiveDate:'2026-01-01'},201)
  const review=await data(base+'/rates/'+rate.id)
  await data(base+'/rates/'+rate.id+'/approve',{reviewToken:review.reviewToken,version:review.version})
  for (const provider of ['openai','resend']) await data(base+'/providers',{id:provider,version:0,enabled:true,consent:true,secret:crypto.randomUUID(),...(provider==='resend'?{sender:'payroll@example.com'}:{})},201)
  await data(base+'/agents/class-policy',{version:0,...answers})
  const grant=await data(base+'/agents',{name:'Payroll assistant',businessAgentId:agentId,hours:24,actions:['records:read','drafts:prepare','drafts:read','notices:process','dispatch:execute'],fields:['compensation','tax'],locations:['*'],providers:['openai','resend'],models:['gpt-4.1-mini']},201)
  const saved={company,location,person,base,grantId:grant.id,localToken:grant.token}
  state.set(origin,saved)
}
