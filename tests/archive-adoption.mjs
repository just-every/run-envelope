import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function archiveAdoption(context, fixture) {
  const { worker, origin, settings, edge } = context
  const call = (path, body, cookie = '') => worker.fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), origin, 'content-type': ['application', 'json'].join('/') },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const previousMail = edge.mails.length
  const magic = await call('/auth/magic-link', { email: settings.OWNER_EMAIL, returnTo: '/app/envelope' })
  assert.equal(magic.status, 202)
  assert.equal(edge.mails.length, previousMail + 1, 'the recovered owner signs in through new native mail proof')
  const link = new URL(edge.mails.at(-1).text.match(/https?:[^\s"<>]+/)[0].replaceAll('&amp;', '&'))
  assert.equal(link.origin, origin)
  const confirmed = await call('/auth/confirm', { token: link.searchParams.get('token') })
  assert.equal(confirmed.status, 303)
  const cookie = confirmed.headers.get('set-cookie').split(';')[0]
  assert.ok(cookie.startsWith('__Host-operator_session='))
  const setup = await worker.fetch(origin + '/setup', { method: 'POST', redirect: 'manual',
    headers: { cookie, origin, 'content-type': ['application', 'x-www-form-urlencoded'].join('/') },
    body: 'confirm=yes' })
  assert.equal(setup.status, 303)
  const company = '/api/envelope/companies/' + fixture.companies[0]
  assert.equal((await call(company, undefined, cookie)).status, 403, 'new native sign-in alone grants no restored payroll access')
  const eligible = await call('/api/envelope/recovery', undefined, cookie)
  assert.equal(eligible.status, 200)
  assert.ok((await eligible.json()).some(row => row.id === fixture.companies[0]))
  const consentMissing = await call('/api/envelope/recovery', { companyId: fixture.companies[0] }, cookie)
  assert.equal(consentMissing.status, 400)
  assert.equal((await call(company, undefined, cookie)).status, 403, 'adoption requires an explicit owner gesture')
  const adopted = await call('/api/envelope/recovery', { companyId: fixture.companies[0], consent: true }, cookie)
  assert.equal(adopted.status, 201, await adopted.clone().text())
  const grant = await adopted.json()
  assert.equal(grant.role, 'viewer')
  const nativeIdentity = await (await call('/auth/session', undefined, cookie)).json()
  const adoptionAudit = (await (await call(company + '/audit', undefined, cookie)).json())
    .filter(event => event.action === 'archive.history.adopted')
  assert.equal(adoptionAudit.length, 1, 'one explicit adoption records one durable attributed event')
  assert.equal(adoptionAudit[0].actorId, nativeIdentity.operator.id)
  assert.equal(adoptionAudit[0].targetId, fixture.companies[0])
  assert.equal((await call(company, undefined, cookie)).status, 200)
  const nativeCompany = await (await call(company, undefined, cookie)).json()
  const person = nativeCompany.people[0]
  assert.ok(person, 'restricted history includes retained native payroll people')
  for (const [path, body] of [
    [company + '/people', { name: 'Refused restored write', locationId: person.locationId }],
    [company + '/people/' + person.id + '/private', { kind: 'bank', version: 0, value: 'synthetic-envelope-8801' }],
    [company + '/providers', { id: 'resend', version: 0, enabled: true, consent: true, secret: 'synthetic-envelope-8802', sender: 'payroll@example.com' }],
    [company + '/pay-settings/earnings-run/' + fixture.years[0].monthlyChecks[0].data.runId + '/release', { version: 1 }],
  ]) assert.equal((await call(path, body, cookie)).status, 403, 'history adoption never permits mutation or outbound authority')
  assert.equal((await call(company + '/people/' + fixture.retainedPersonId + '/privacy', undefined, cookie)).status, 403, 'a restored history viewer cannot inspect the owner-only retained set')
  assert.equal((await call(company + '/export', undefined, cookie)).status, 403, 'history access does not confer independent export rights')
  const replay = await call('/api/envelope/recovery', { companyId: fixture.companies[0], consent: true }, cookie)
  assert.equal(replay.status, 409, 'adoption cannot replay or replace a current company grant')
  assert.deepEqual((await (await call(company + '/audit', undefined, cookie)).json()).filter(event => event.action === 'archive.history.adopted'), adoptionAudit,
    'refused replay and denied mutations never create another adoption or rewrite its attribution')
  assert.equal((await call('/api/envelope/companies/' + fixture.companies[1], undefined, cookie)).status, 403,
    'adopting one employer grants no access to another restored employer')

  const {default:axe}=await import('axe-core')
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
  try {
    const session = await browser.newContext({ ignoreHTTPSErrors: true })
    const separator = cookie.indexOf('=')
    await session.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: origin, secure: true }])
    const page = await session.newPage(), proof = process.env.ENVELOPE_PROOF_DIR ?? 'test-results/envelope'
    await mkdir(proof, { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(origin + company.replace('/api/', '/app/'))
      await page.locator('h1').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.ok((await page.locator('main').innerText()).includes(person.name))
      await page.evaluate(axe.source)
      const audit=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}))
      await writeFile(join(proof,'archive-adopted-history-'+width+'.accessibility.json'),JSON.stringify(audit.violations,null,2))
      assert.deepEqual(audit.violations.filter(v=>v.id!=='color-contrast').map(v=>v.id),[],'restored company structural accessibility')
      for(const control of await page.locator('button,a,summary').all())
        if(await control.isVisible())assert.ok((await control.innerText()).trim(),'restored controls have visible words')
      await page.keyboard.press('Tab')
      assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY')
      assert.equal(await page.evaluate(()=>globalThis.syntheticEnvelope586),undefined,'restored hostile text never executes')
      assert.equal(await page.locator('img[src^="https://ungranted.example"]').count(),0,'archive restore never turns retained text into a remote image')
      await page.screenshot({ path: join(proof, 'archive-adopted-history-' + width + '.png'), fullPage: true })
    }
    await session.close()
  } finally { await browser.close() }
  assert.equal(edge.mails.length, previousMail + 1, 'all restored-history refusals and reads cause no outbound work beyond the fresh sign-in proof')
}
