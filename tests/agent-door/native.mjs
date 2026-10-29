import assert from 'node:assert/strict'
export const state=new Map()
export const cookieOf=r=>r.headers.getSetCookie().map(v=>v.split(';',1)[0]).join('; ')
export function client({request,origin,cookie}) {
  return async(path,body,status=200)=> {
    const r=await request(new URL(path,origin).href,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{origin,...(cookie?{cookie}:{}),'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(r.status,status,'native door '+path)
    return r.json()
  }
}
export async function login({request,origin,email,mail}) {
  const post=(path,body)=>request(new URL(path,origin).href,{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
  const issued=await post('/auth/magic-link',{email,returnTo:'/app'});assert.equal(issued.status,202)
  const messages=await mail.read({limit:20}),text=messages.at(-1)?.text ?? ''
  const match=text.match(/https?:\/\/[^\s<>]+/g)?.map(value=>new URL(value)).find(url=>url.searchParams.has('token'))
  assert.ok(match,'native email link')
  const response=await post('/auth/confirm',{token:match.searchParams.get('token')})
  assert.equal(response.status,303)
  return response
}
export const answers={standard:'autonomous',money:'autonomous',commitment:'autonomous',external:'autonomous',sensitive:'autonomous',destructive:'autonomous',accounts:'autonomous',access:'autonomous',security:'autonomous',gated:'autonomous'}
