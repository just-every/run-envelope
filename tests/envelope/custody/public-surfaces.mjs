import assert from 'node:assert/strict'
import {mkdir,readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'
import AxeBuilder from '@axe-core/playwright'

export async function publicSurfaceJourney({browser,origin}) {
  const context=await browser.newContext(),page=await context.newPage(),requests=[],proof=process.env.ENVELOPE_PROOF_DIR??'test-results/envelope'
  page.on('request',r=>requests.push(r.url()))
  await mkdir(proof,{recursive:true})
  try {
    for(const path of ['/','/signin']) for(const width of [1440,390]) {
      await context.clearCookies()
      await page.setViewportSize({width,height:1000})
      const response=await page.goto(origin+path)
      assert.equal(response.status(),200,path)
      assert.equal((await response.allHeaders())['set-cookie'],undefined,'no visitor cookie before interaction')
      assert.deepEqual(await context.cookies(),[],'no visitor identifier before interaction')
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,path+' fits '+width)
      const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()).violations
      assert.deepEqual(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],path+' WCAG 2.2 AA '+width)
      assert.equal((await page.content()).includes('000-00-0001'),false)
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true,'keyboard reaches a native control')
      await page.screenshot({path:join(proof,'public-'+(path==='/'?'lobby':'signin')+'-'+width+'.png'),fullPage:true})
    }
    assert.ok(requests.every(url=>new URL(url).origin===origin),'public pages load no third-party resource')
    assert.equal((await page.request.get(origin+'/api/envelope/companies')).status(),401)
    assert.equal((await page.request.get(origin+'/app/envelope',{maxRedirects:0})).status(),303)
    const files=await readdir('dist/client',{recursive:true})
    for(const file of files.filter(p=>/\.(?:js|html|css|json)$/.test(p))) {
      const body=await readFile(join('dist/client',file),'utf8')
      for(const value of ['000-00-0001','000000002','synthetic-envelope-510','synthetic-envelope-512']) assert.equal(body.includes(value),false,'planted private value is absent from client bundle')
    }
    console.log('PUBLIC-CUSTODY passed: signed-out Lobby/sign-in at 1440/390, no visitor cookie or third-party load before interaction, no private API/document access, automated WCAG 2.2 AA and keyboard entry; planted values absent from client bundles')
  } finally {await context.close()}
}
