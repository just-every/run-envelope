import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { recordPublicSite } from './privacy-recorder.mjs'

// Finite native route inventory, read from the dispatch branches in the named
// files. Braces expand alternatives; identifiers come from retained fixtures.
// Each entry is exercised, rather than asserted as a fixed source-file list.
export function payrollDoors(f, claim, notice) {
 const company = '/companies/' + f.company.id, person = company + '/people/' + f.person.id
 const id = 'synthetic-envelope-579', routes = new Set()
 const expand = pattern => {
  const match = /\{([^{}]+)\}/.exec(pattern)
  return match ? match[1].split(',').flatMap(value => expand(pattern.replace(match[0], value))) : [pattern]
 }
 const add = (base, patterns) => patterns.forEach(pattern => expand(base + pattern).forEach(route => routes.add(route)))
 // ./src/envelope/http.ts: native and sponsored transport dispatchers.
 add('', ['/companies', '/workspace', '/firm', '/firm/prepare', '/protected-response', '/protected-response/{read,ack}',
  '/recovery', '/recovery/consents', '/recovery/' + id + '/tax-history', '/reports/combined-labor'])
 add(company, ['', '/{calculation-preview,calculation-coverage,funding-accounts,funding-plans,new-hire-coverage,operations,webhooks,workspace,schedules,rules,pay-settings,providers,notices,agents,drafts,setup,locations,paper-policy,grants,people,labor-actuals,privacy-provider-requests,privacy-requests,audit,export}',
  '/funding-plans/' + id + '/release', '/new-hire-elections', '/new-hire-elections/' + id + '/{review,approve}',
  '/webhooks/' + id + '/{revoke,deliver,recover}', '/hris-hires', '/hris-hires/' + id + '/{review,approve,apply}',
  '/rules/review/' + id, '/rules/' + id + '/{approve,withdraw}',
  '/pay-settings/{intake,intake-preview,preview,earnings-run,group,pay-item,pay-change,proration-policy,approval-policy,run-input}',
  '/pay-settings/intake/{template,preview,apply}', '/pay-settings/intake/' + id + '/{review,approve,withdraw}',
  '/pay-settings/earnings-template/{csv,xls,xlsx}', '/pay-settings/passkeys/{options,register}',
  '/pay-settings/earnings-run/' + id + '/{review,approve,release}',
  '/pay-settings/review/{group,pay-item,pay-change,proration-policy,approval-policy,run-input}/' + id,
  '/pay-settings/{group,pay-item,pay-change,proration-policy,approval-policy,run-input}/' + id + '/{approve,withdraw}',
  '/notices/' + notice.id, '/notices/' + notice.id + '/{people,replies,case}',
  '/notices/' + notice.id + '/case/{review,approve,evidence,link-rate}', '/notices/' + notice.id + '/case/original/1/0',
  '/notice-replies/' + id + '/{review,approve,withdraw}', '/agents/{policy,access}', '/agents/' + id + '/revoke',
  '/setup/{profile,jurisdictions}', '/privacy-provider-requests/' + id, '/rates/' + id, '/rates/' + id + '/approve',
  '/ny-dbl-plans', '/ny-dbl-plans/' + id + '/{review,approve}'])
 add(person, ['', '/{private,rates,hi-benefits,retirement,ny-dbl,withholding-instructions,new-hire-reports,paper-onboarding,verification,hris,earnings-sources,leave,allocations,privacy,erase}',
  '/private/{ssn,tax,bank}', '/hi-benefits/{plans,preview}', '/hi-benefits/plans/' + id + '/{review,approve}',
  '/retirement/{review,approve,preview}', '/ny-dbl/{evidence,proposals,remittance}', '/ny-dbl/evidence/{review,approve}',
  '/withholding-instructions/{review,approve}', '/withholding-instructions/original/1',
  '/new-hire-reports/' + id + '/{review,approve,repair,response,transfer}',
  '/paper-onboarding/{review,approve,withdraw}', '/paper-onboarding/original/{1,2}/{federal,state}',
  '/verification/{worker,income,consents,disclosures}', '/verification/consents/' + id + '/{revoke,corrections}',
  '/verification/{verification-worker,income-source,disclosure}/' + id + '/{review,approve,withdraw}', '/verification/disclosure/' + id + '/release',
  '/{hris,earnings-sources}/' + id + '/{review,approve,withdraw}', '/hris/' + id + '/{location-handoff,leave-handoff}',
  '/leave/{entries,review,approve,withdraw}', '/allocations/{tip-intake,tip-template,residence,work,election,tax-election,local-tax-input,tip}',
  '/privacy/{request,retain,release}', '/benefits/extended-retirement', '/benefits/extended-retirement/preview',
  '/benefits/extended-retirement/{review,decision}/' + id])
 // ./src/envelope/claims/http.ts: current and historical originals and actions.
 add(company, ['/claims', '/claims/import'])
 add(company + '/claims/' + claim.id, ['', '/{evidence,prepare,sign,portal-review,handoff,confirmation,follow-up,begin-follow-up,escalate,review,packet}',
  '/versions/1/packet', ...claim.artifacts.map(file => '/artifacts/' + file.id)])
 // ./src/envelope/industry/http.ts, ./src/envelope/accounting/http.tsx,
 // ./src/envelope/automation/http.tsx and ./src/envelope/firm/http.ts.
 add(company, ['/industry-returns', '/industry-returns/' + id + '/{review,decision,download}',
  '/accounting', '/accounting/{connections,preview,prepare}', '/accounting/journals/' + id + '/{review,approve,post}',
  '/automation', '/automation/{process,disposition}', '/{firm-work,firm-settings}', '/firm-work/' + id, '/firm-work/' + id + '/{delegate,handoff,acknowledge}'])
 add(person, ['/industry', '/industry/{classification,checks,tip-tax-previews,tip-tax-funds}',
  '/industry/{review,decision}/{industry-classification,industry-check}/' + id])
 const paths = [...routes].flatMap(path => ['/api/envelope' + path, '/app/envelope' + path])
 paths.push('/app', '/app/envelope', '/api/envelope/mcp')
 for (const resource of ['records', 'drafts', 'bonus-runs']) {
  paths.push('/api/envelope/v1' + company + '/' + resource)
  if (resource !== 'records') paths.push('/api/envelope/v1' + company + '/' + resource + '/' + id)
 }
 for (const report of ['proposals', 'bonus-runs']) paths.push('/api/envelope/v1' + company + '/reports/' + report)
 return [...new Set(paths)]
}

export async function payrollSnapshot(sql) {
 const tables = await sql("SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'env_*' OR name GLOB 'oa_*') ORDER BY name")
 const digest = createHash('sha256')
 for (const {name} of tables) {
  assert.match(name, /^(?:env|oa)_[a-z_]+$/)
  digest.update(name).update(JSON.stringify(await sql('SELECT * FROM ' + name + ' ORDER BY rowid')))
 }
 return digest.digest('hex')
}

export async function visitorStorage(context, page) {
 assert.deepEqual(await context.cookies(), [], 'a public visit creates no visitor cookie')
 assert.deepEqual(await page.evaluate(async () => ({local: Object.keys(localStorage), session: Object.keys(sessionStorage),
  databases: (await indexedDB.databases()).map(db => db.name), caches: await caches.keys(),
  workers: (await navigator.serviceWorker.getRegistrations()).map(worker => worker.scope)})),
 {local: [], session: [], databases: [], caches: [], workers: []}, 'public documents leave browser storage empty')
}

// Use the real site build, then enumerate its emitted documents. No copied HTML
// or hand-maintained documentation subset can conceal an added public page.
export async function publicSiteBrowser({browser, privateValues, proof, audits, axe}) {
 execFileSync(process.execPath, ['node_modules/@runeditrun/rer/global/rer.mjs', 'build', '--site'], {stdio: 'pipe', timeout: 120000})
 const root = './dist/site', files = new Map()
 async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
   const relative = prefix + entry.name
   if (entry.isDirectory()) await collect(join(directory, entry.name), relative + '/')
   else files.set('/' + relative, join(directory, entry.name))
  }
 }
 await collect(root)
 const documents = [...files.keys()].filter(path => path.endsWith('.html')).map(path => path === '/index.html' ? '/' : path.slice(0, -5))
 const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2'}
 const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname, file = files.get(path === '/' ? '/index.html' : path) ?? files.get(path + '.html')
  if (!file) {response.writeHead(404);response.end();return}
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'})
  response.end(request.method === 'HEAD' ? undefined : await readFile(file))
 })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const origin = 'http://127.0.0.1:' + server.address().port, unregister = recordPublicSite(origin), visitor = await browser.newContext(), requests = [], cookies = []
 visitor.on('request', request => requests.push(request.url()))
 visitor.on('response', response => {if (response.headers()['set-cookie']) cookies.push(new URL(response.url()).pathname)})
 try {
  const page = await visitor.newPage()
  for (const path of documents) {
   const head = await visitor.request.head(origin + path)
   assert.equal(head.status(), 200);assert.equal(head.headers()['set-cookie'], undefined);assert.equal((await head.body()).length, 0)
   for (const width of [1440, 390]) {
    await page.setViewportSize({width, height:1000})
    const response = await page.goto(origin + path)
    assert.equal(response.status(), 200)
    const html = await page.content()
    for (const value of privateValues) assert.ok(!html.includes(value), 'built public document contains no planted payroll value: ' + path)
    await visitorStorage(visitor, page)
    if (width === 1440) {
     await page.evaluate(axe.source)
     const audit = await page.evaluate(async () => axe.run(document, {runOnly:{type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
     audits.push({label:'built-site' + path, violations:audit.violations.map(v => ({id:v.id,nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary}))}))})
    }
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({path:join(proof, 'public-site-' + (path.slice(1).replaceAll('/', '-') || 'home') + '-' + width + '.png'), fullPage:true})
   }
  }
  assert.deepEqual(cookies, [], 'no public resource sets a cookie')
  assert.ok(requests.every(url => new URL(url).origin === origin), 'built public pages make no third-party request before interaction')
  console.log('Public built documents exercised: ' + documents.join(', '))
 } finally {await visitor.close();await new Promise(resolve => server.close(resolve));unregister()}
}
