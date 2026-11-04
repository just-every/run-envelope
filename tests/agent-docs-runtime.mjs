import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

/** A populated installation's public documentation remains public declarations only. */
export async function agentDocsJourney({origin,cookie,settings}) {
  const privateName='synthetic-envelope-docs-private-9936 <img src=x onerror=alert(1)>'
  const companyResponse=await fetch(origin+'/api/envelope/companies',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({name:privateName,ein:'00-0009936'})})
  assert.equal(companyResponse.status,201)
  const company=await companyResponse.json()
  const json=await fetch(origin+'/docs/agents',{headers:{accept:'application/json'}})
  assert.equal(json.status,200)
  const reference=await json.json()
  const htmlResponse=await fetch(origin+'/docs/agents'),html=await htmlResponse.text()
  const signedIn=await fetch(origin+'/docs/agents',{headers:{cookie}})
  assert.equal(await signedIn.text(),html,'signed-in identity never enters public documentation')
  for(const privateValue of [privateName,company.id,'00-0009936',settings.SESSION_SECRET,settings.ENVELOPE_RECORD_KEY,cookie])assert.equal(html.includes(privateValue),false,'private installation values stay absent')
  assert.ok(html.includes('&lt;agent&gt; for &lt;person&gt;'),'attribution syntax is escaped as text')
  assert.ok(html.includes('&lt;policy&gt;'),'computed-test placeholders are escaped as text')
  assert.equal((await fetch(origin+'/docs/agents',{method:'HEAD'})).status,200)
  assert.equal((await fetch(origin+'/docs/agents',{method:'POST',body:'synthetic-envelope-9937'})).status,405)
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  try {
    const context=await browser.newContext(),page=await context.newPage(),requests=[]
    page.on('request',request=>requests.push(request.url()))
    const proof=process.env.ENVELOPE_PROOF_DIR??'./test-results/envelope'
    await mkdir(proof,{recursive:true})
    await page.setViewportSize({width:1440,height:1000})
    await page.goto(origin+'/docs/agents')
    await page.evaluate(()=>document.fonts.ready)
    assert.deepEqual(await page.locator('[data-tool]').evaluateAll(nodes=>nodes.map(node=>node.dataset.tool).sort()),reference.tools.map(tool=>tool.name).sort())
    for(const tool of reference.tools) {
      const article=page.locator('[data-tool="'+tool.name+'"]')
      assert.equal(await article.locator('[data-scope]').innerText(),tool._meta['com.runeditrun/scope'])
      assert.deepEqual(await article.locator('[data-class]').evaluateAll(nodes=>nodes.map(node=>node.dataset.class)),tool._meta['com.runeditrun/classes'])
    }
    assert.equal(await page.locator('agent,person,policy,script').count(),0,'escaped declaration text creates no elements or executable code')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    assert.equal(await page.locator('body').evaluate(body=>[...body.querySelectorAll('h1,h2,h3,h4,p,a,dt,dd,li,code,summary')].every(node=>parseFloat(getComputedStyle(node).fontSize)>=13)),true)
    await page.keyboard.press('Tab')
    assert.equal(await page.locator(':focus').getAttribute('href'),'#main')
    await page.keyboard.press('Enter')
    assert.equal(await page.locator(':focus').getAttribute('id'),'main')
    const summary=page.locator('summary').first()
    await summary.focus();await page.keyboard.press('Enter')
    assert.equal(await summary.evaluate(node=>node.parentElement.open),true,'schemas open using the keyboard')
    await page.evaluate(await readFile('node_modules/axe-core/axe.min.js','utf8'))
    const axe=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))
    assert.deepEqual(axe.violations.filter(issue=>['serious','critical'].includes(issue.impact)).map(issue=>issue.id),[])
    await summary.focus();await page.keyboard.press('Enter')
    await page.screenshot({path:join(proof,'agent-docs-1440.png'),fullPage:true})
    await page.setViewportSize({width:390,height:1000})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone smoke has no page overflow')
    await page.screenshot({path:join(proof,'agent-docs-390.png'),fullPage:true})
    assert.ok(requests.every(url=>new URL(url).origin===origin),'documentation sends no outbound request')
  } finally {await browser.close()}
  console.log('AGENT-DOCS browser passed: public populated installation, escaped text, no private values, keyboard and accessibility at 1440; phone smoke and proof at 390')
}
