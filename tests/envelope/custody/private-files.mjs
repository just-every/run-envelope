import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

/** Real multipart upload and private immutable downloads on the emitted Worker. */
export async function privateFileJourney({origin,cookie,api,ui,noticeId,page,capture,limitedCookie,other,edge,sql}) {
  const path=api+'/notices/'+noticeId,view=ui+'/notices/'+noticeId
  const request=(suffix,who=cookie,options={})=>fetch(origin+path+suffix,{redirect:'manual',...options,headers:{cookie:who,origin,...options.headers}})
  const html='<html><script>globalThis.plantedNoticeScript=true;fetch("https://ungranted.example/script")</script><img src="https://ungranted.example/pixel"><p>SSN 000-00-0057</p></html>'
  const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n%'),Buffer.from([0xff,0xee,0xdd]),Buffer.from('\n1 0 obj <</OpenAction <</S /JavaScript /JS (app.alert("synthetic-envelope-570"))>>>> endobj\n%%EOF')])
  const upload=async(buffer,type,name='source.pdf',extra={},who=cookie)=>{
    const form=new FormData()
    form.set('file',new File([buffer],name,{type}))
    form.set('version','0')
    for(const [k,v] of Object.entries(extra)) form.set(k,String(v))
    return request('/files',who,{method:'POST',body:form})
  }
  const before=edge.calls.length
  // Use the native file control for the first hostile HTML original.
  await page.goto(origin+view)
  await page.getByLabel('Private notice file (PDF, HTML or text; 32 KB maximum)',{exact:true}).setInputFiles({name:'hostile.html',mimeType:'text/html',buffer:Buffer.from(html)})
  await page.getByRole('button',{name:'Upload private original',exact:true}).click()
  await page.waitForURL(origin+view)
  let details=await (await request('')).json()
  assert.equal(details.files.length,1)
  const original=details.files[0]
  assert.equal(original.digest,createHash('sha256').update(html).digest('hex'))
  assert.equal(await page.locator('iframe,object,embed').count(),0,'hostile originals never enter an active viewer')
  assert.equal(await page.evaluate(()=>globalThis.plantedNoticeScript),undefined)
  assert.equal(edge.calls.length,before,'uploads do not contact a provider')
  await capture(view,'private-hostile-original')
  const uploaded=await upload(pdf,'application/pdf')
  assert.equal(uploaded.status,201,await uploaded.clone().text())
  const stored=await uploaded.json()
  const version2=await upload(Buffer.from('<p>corrected source</p>'),'text/html','corrected.html',{id:original.id,version:1})
  assert.equal(version2.status,201,await version2.clone().text())
  assert.equal((await version2.json()).version,2)
  assert.equal((await upload(Buffer.from('stale'),'text/plain','stale.txt',{id:original.id,version:1})).status,409)
  for(const [item,expected] of [[original,Buffer.from(html)],[stored,pdf]]) {
    const suffix='/files/'+item.id+'/1',download=await request(suffix)
    assert.equal(download.status,200)
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),expected)
    assert.equal(download.headers.get('content-type'),'application/octet-stream')
    assert.match(download.headers.get('content-disposition'),/^attachment;/)
    assert.match(download.headers.get('content-security-policy'),/sandbox; default-src 'none'/)
    assert.equal(download.headers.get('cache-control'),'no-store')
    assert.equal(download.headers.get('x-content-type-options'),'nosniff')
    assert.equal((await request(suffix,limitedCookie)).status,403,'notice read is not private download authority')
    assert.equal((await request(suffix,'')).status,401)
    assert.equal((await fetch(origin+'/api/envelope/companies/'+other+'/notices/'+noticeId+suffix,{headers:{cookie}})).status,403)
  }
  assert.equal((await upload(Buffer.alloc(32769),'text/plain','large.txt')).status,413)
  assert.equal((await upload(Buffer.alloc(70000),'text/plain','very-large.txt')).status,413)
  assert.equal((await upload(Buffer.from('not pdf'),'application/pdf')).status,400)
  assert.equal((await upload(Buffer.from('active'),'application/javascript','active.js')).status,415)
  assert.equal((await upload(Buffer.from([255]),'text/plain','bad.txt')).status,400)
  assert.equal((await upload(Buffer.from('source'),'text/plain','source.txt',{unexpected:'value'})).status,400)
  for(const body of ['[]','null','{"bad":',new Uint8Array([255])]) {
    assert.equal((await request('',cookie,{method:'POST',headers:{'content-type':'application/json'},body})).status,400)
  }
  details=await (await request('')).json()
  assert.equal(details.files.length,3,'rejected/stale uploads create no version')
  const atRest=JSON.stringify(await sql('SELECT cipher FROM env_private_files'))
  assert.equal(atRest.includes('000-00-0057'),false)
  assert.equal(atRest.includes('OpenAction'),false)
  await capture(view,'private-version-history')
  assert.equal(edge.calls.length,before,'hostile HTML, PDF and refused input remain inert')
  console.log('PRIVATE-FILES passed: native hostile HTML/PDF upload, encrypted immutable versions/digests, stale/type/size/UTF-8/malformed input refusal, current private download authority and inert attachment-only originals at 1440/390')
}
