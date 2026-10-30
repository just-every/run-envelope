import assert from 'node:assert/strict'
import {reviewerMail} from './native.mjs'
export default async function({request,origin,mail,label,email}) {
  const messages=await mail.read({limit:20})
  const link=messages.flatMap(message=>(message.text.match(/https?:\/\/[^\s<>]+/g)??[]).map(value=>new URL(value))).find(url=>url.searchParams.has('token'))
  assert.ok(link,'native roster invitation was delivered')
  const response=await request(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token:link.searchParams.get('token')})})
  assert.equal(response.status,303)
  reviewerMail.set(origin+':'+label,mail)
  return response
}
