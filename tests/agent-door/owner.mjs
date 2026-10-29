import assert from 'node:assert/strict'
import {login,cookieOf} from './native.mjs'
export default async function(context) {
  const {request,origin,claim,displayName,returnTo}=context
  const bootstrap=await request(new URL(claim.path,origin).href,{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token:claim.token,displayName,returnTo})})
  assert.equal(bootstrap.status,303)
  const completed=await request(origin+'/setup',{method:'POST',redirect:'manual',headers:{origin,cookie:cookieOf(bootstrap),'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  assert.equal(completed.status,303)
  // Native email confirmation supplies the app's genuine recent human proof.
  return login(context)
}
