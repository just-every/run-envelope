import assert from 'node:assert/strict'
import {client,cookieOf,reviewerContexts,reviewerMail,negativeSponsors,login} from './native.mjs'
export default async function({request,origin,owner,label,sub,email}) {
  await reviewerContexts.get(origin).initialize(label,{cookie:owner.cookie})
  // A fresh native confirmation is returned directly, with its own real cookie.
  const response=await login({request,origin,email,mail:reviewerMail.get(origin+':'+label)})
  const session=await client({request,origin,cookie:cookieOf(response)})('/auth/session')
  const data=client({request,origin,cookie:owner.cookie})
  if(label==='inactive') await data('/auth/operator/status',{operatorId:session.operator.id,status:'inactive'})
  else assert.equal(label,'excluded') // active native teammate; no payroll company grant
  const subjects=negativeSponsors.get(origin)??{}
  subjects[label]={sub,email};negativeSponsors.set(origin,subjects)
  return response
}
