// Run approval journey: exact versions, distinct people, voided approvals, no effects.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { credentialResponse } from './human-proof-fixture.mjs'
import { chromium } from '@playwright/test'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { localCookieName } from '../src/modules/operator-auth/http.mjs'

/** RUN-APPROVALS: preview/approve/release doors bind one exact current run version. */
export async function approvalJourney({ origin, cookie, sql, settings }) {
  const call = (path, body, who = cookie, extra = {}) =>
    fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'manual',
      headers: { ...(who ? { cookie: who } : {}), origin, 'content-type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  const data = async (path, body, status = 200, who = cookie) => {
    const r = await call(path, body, who)
    assert.equal(r.status, status, await r.clone().text())
    return r.json()
  }
  const effects = () =>
    sql(
      'SELECT (SELECT COUNT(*) FROM env_run_approvals) AS approvals,(SELECT COUNT(*) FROM env_audit) AS audit,(SELECT COUNT(*) FROM rer_mail_development_outbox) AS outbox',
    )
  // Every refusal names its reason and leaves no approval, audit or outbound message.
  const refused = async (path, body, error, who = cookie, extra = {}, status = 409) => {
    const before = await effects()
    const r = await call(path, body, who, extra)
    assert.equal(r.status, status, path)
    assert.deepEqual(await r.json(), { error }, path)
    assert.deepEqual(await effects(), before, error + ' has zero effects')
  }
  const humans = {}
  for (const name of ['approver-a', 'approver-b', 'admin', 'clerk']) {
    const token = randomBytes(32).toString('base64url'),
      id = 'synthetic-envelope-run-' + name,
      session = 'synthetic-envelope-run-session-' + name,
      now = Date.now()
    const hash = await hashToken(settings.SESSION_SECRET, 'session', token)
    await sql(
      `INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${id}','${id}@example.com','Synthetic ${name}','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${session}','${hash}','${id}',1,'native',${now},${now + 3600000}); INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('${session}','${randomBytes(16).toString('hex')}','${session}','${id}',1,'payroll:sensitive','/app',${now},${now + 600000},${now})`,
    )
    humans[name] = { id, cookie: `${localCookieName('operator_session_local', origin)}=${token}` }
  }
  const owner = (await sql("SELECT id FROM oa_operators WHERE email='owner@example.com'"))[0].id
  const company = await data('/api/envelope/companies', { name: 'Synthetic approval company', ein: '00-0000340' }, 201),
    base = '/api/envelope/companies/' + company.id,
    door = base + '/pay-settings',
    screen = door.replace('/api/', '/app/')
  const grant = (who, role, fields, actions, version = 0) =>
    data(base + '/grants', { operatorId: humans[who].id, version, role, locations: ['*'], fields, actions })
  await grant('approver-a', 'approver', ['compensation'], ['records:read', 'pay:approve', 'rates:approve'])
  await grant('admin', 'payroll-admin', ['compensation', 'bank'],
    ['records:read', 'records:write', 'rates:propose', 'private:write', 'bank:edit'])
  const wa = await data(base + '/locations', { name: 'Synthetic Seattle shop', state: 'WA' }, 201),
    ca = await data(base + '/locations', { name: 'Synthetic Oakland shop', state: 'CA' }, 201)
  const person = (name, loc) => data(base + '/people', { name, locationId: loc.id }, 201)
  const w1 = await person('Synthetic Seattle cook', wa),
    w2 = await person('Synthetic Seattle server', wa),
    c1 = await person('Synthetic Oakland cook', ca)
  const approveSetup = async (kind, id) => {
    const r = await data(door + '/review/' + kind + '/' + id)
    return data(door + '/' + kind + '/' + id + '/approve', { version: r.version, reviewToken: r.reviewToken })
  }
  const terms = (p, rateCents = 2500) => ({
    personId: p.id, personVersion: p.version, rateCents, basis: 'hourly',
    employmentFrom: '2026-01-01', employmentThrough: '2026-12-31', unpaidDates: [],
  })
  const setup = async (n, name, members) => {
    const group = { id: 'synthetic-envelope-' + n, version: 0, name, people: members.map((m) => m.id) }
    await data(door + '/group', group, 201)
    await approveSetup('group', group.id)
    const change = { id: 'synthetic-envelope-' + (n + 1), version: 0, name: name + ' rates', groupId: group.id,
      effectiveDate: '2026-01-01', items: members.map((m) => terms(m)) }
    await data(door + '/pay-change', change, 201)
    await approveSetup('pay-change', change.id)
    return { group, change }
  }
  const waSetup = await setup(343, 'Seattle hourly crew', [w1, w2]),
    caSetup = await setup(345, 'Oakland hourly crew', [c1])
  const work = (p, n, state, minutes = 480, version = 0, day = '2026-03-02') =>
    data(base + '/people/' + p.id + '/allocations/work', {
      id: 'synthetic-envelope-' + n, version, day, state, locality: state === 'WA' ? 'Seattle' : 'Oakland',
      minutes, earnedCents: minutes * 2500 / 60, officeState: state, nyReason: 'not-applicable',
      sourceRef: 'synthetic-envelope-source-' + n,
    }, 201)
  await work(w1, 347, 'WA')
  await work(w2, 348, 'WA')
  await work(c1, 349, 'CA')
  // A fresh app-local step-up (Base's ten-minute proof) precedes each sensitive admin action.
  const stepUp = () => {
    const now = Date.now(), session = 'synthetic-envelope-run-session-admin'
    return sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('${randomBytes(8).toString('hex')}','${randomBytes(16).toString('hex')}','${session}','synthetic-envelope-run-admin',1,'payroll:sensitive','/app',${now},${now + 600000},${now})`)
  }
  const bank = async (p, version) => {
    await stepUp()
    return data(base + '/people/' + p.id + '/private', { kind: 'bank', value: 'synthetic-envelope-bank-' + p.id + '-' + version, version }, 201, humans.admin.cookie)
  }
  for (const p of [w1, w2, c1]) await bank(p, 0)
  const period = { periodStart: '2026-03-01', periodEnd: '2026-03-07', payDate: '2026-03-13', frequency: 'weekly' }
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
  try {
    const contexts = {}
    for (const [who, value] of [['owner', cookie], ['approver-a', humans['approver-a'].cookie], ['approver-b', humans['approver-b'].cookie]]) {
      contexts[who] = await browser.newContext()
      const [name, token] = value.split('=')
      await contexts[who].addCookies([{ name, value: token, url: origin }])
    }
    const pages = Object.fromEntries(await Promise.all(Object.entries(contexts).map(async([who,context])=>[who,await context.newPage()])))
    const authenticators={}
    for(const [who,page] of Object.entries(pages)) {
      const cdp=await contexts[who].newCDPSession(page)
      await cdp.send('WebAuthn.enable')
      authenticators[who]={cdp,...await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}})}
      await page.goto(origin+screen)
    }
    const enroll=async who=>{
      const {id,options}=await data(door+'/passkeys/options',{},200,humans[who]?.cookie??cookie)
      const response=await credentialResponse(pages[who],options,true)
      await data(door+'/passkeys/register',{id,response},200,humans[who]?.cookie??cookie)
      await refused(door+'/passkeys/register',{id,response},'human_challenge_stale',humans[who]?.cookie??cookie)
    }
    const ownerNow=Date.now()
    await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) SELECT '${randomBytes(8).toString('hex')}','${randomBytes(16).toString('hex')}',s.id,s.operator_id,s.operator_version,'payroll:sensitive','/app',${ownerNow},${ownerNow+600000},${ownerNow} FROM oa_sessions s WHERE s.operator_id='${owner}' AND s.revoked_at IS NULL`)
    for(const who of ['owner','approver-a']) await enroll(who)
    const proof=async(r,who)=>({gesture:'approve-exact-run',humanChallenge:r.humanProof.id,
      assertion:await credentialResponse(pages[who],r.humanProof.options)})

    const folder = process.env.ENVELOPE_PROOF_DIR ?? 'test-results/envelope'
    const capture = async (label, path, who = 'owner') => {
      const page = pages[who]
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(origin + path)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label)
        await page.keyboard.press('Tab')
        assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'A', 'keyboard reaches native app navigation')
        for (const control of await page.locator('button,a').all())
          assert.ok((await control.innerText()).trim(), label + ': every control has visible words')
        await page.screenshot({ path: join(folder, `${label}-${width}.png`), fullPage: true })
      }
      return page
    }

    // ENV-028: the owner grants real run approval from settings, independently
    // of export, bank-edit and release. Role labels alone confer none of them.
    const grantsScreen = base.replace('/api/', '/app/') + '/grants'
    let grantPage = await capture('payroll-grant-powers', grantsScreen)
    await grantPage.getByLabel('Person', { exact: true }).selectOption(humans['approver-b'].id)
    await grantPage.getByLabel('Role label', { exact: true }).selectOption('approver')
    for (const label of ['All locations', 'compensation', 'View people', 'Approve exact earnings runs'])
      await grantPage.getByLabel(label, { exact: true }).check()
    assert.equal(await grantPage.getByLabel('Request payroll release (held)', { exact: true }).isChecked(), false)
    await grantPage.getByRole('button', { name: 'Save this grant', exact: true }).click()
    await grantPage.waitForURL(origin + grantsScreen)
    const savedGrant = (await data(base + '/grants')).find(g => g.operatorId === humans['approver-b'].id)
    assert.deepEqual(JSON.parse(savedGrant.actions).sort(), ['pay:approve', 'records:read'])
    await capture('payroll-grant-powers-saved', grantsScreen)
    await enroll('approver-b')

    // The owner alone sets the two-person threshold, through exact review.
    const policy = { id: 'synthetic-envelope-340', version: 0, name: 'Two people from $300', secondApprovalAtCents: 30000 }
    await refused(door + '/approval-policy', policy, 'owner_required', humans['approver-a'].cookie, {}, 403)
    await data(door + '/approval-policy', policy, 201)
    let page = await capture('run-approval-policy-review', screen + '/review/approval-policy/' + policy.id)
    await page.getByRole('button', { name: 'Approve this exact setup', exact: true }).click()
    await page.waitForURL(origin + screen)

    const run = async (id, version, group, overrides = {}) =>
      (await data(door + '/earnings-run', { ...period, ...overrides, groupId: group.id, id, version }, 201)).version
    const status = async (id) => {
      const view = await data(door)
      const latest = view.runs.find((r) => r.id === id)
      return view.approvals.find((a) => a.runId === id && a.version === latest.version)
    }
    const review = (id, who) => data(door + '/earnings-run/' + id + '/review', undefined, 200, humans[who]?.cookie ?? cookie)
    const approve = async (id, who) => {
      const r = await review(id, who)
      return data(door + '/earnings-run/' + id + '/approve', { version: r.version, reviewToken: r.reviewToken, ...await proof(r,who) }, 200, humans[who]?.cookie ?? cookie)
    }
    const release = (id, version, error, extra = {}) => refused(door + '/earnings-run/' + id + '/release', { version, ...extra }, error)

    const waRun = 'synthetic-envelope-341'
    let version = await run(waRun, 0, waSetup.group)
    let settingsResult = await data(door)
    const retained = settingsResult.runs.find((r) => r.id === waRun)
    assert.equal(retained.data.grossCashCents, 40000)
    assert.deepEqual(retained.data.destinations.map((d) => d.bankVersion), [1, 1], 'each payee destination version is bound')
    assert.equal(JSON.stringify(retained.data).includes('synthetic-envelope-bank'), false, 'bank details never enter the run')
    assert.equal((await status(waRun)).required, 2, '$400 reaches the owner threshold')
    await release(waRun, version, 'approval_required')

    // Threshold bypass, self-second-approval, copied review and agent approval all fail closed.
    await refused(door + '/earnings-run/' + waRun + '/release', { version }, 'payroll_access_denied', humans['approver-b'].cookie, {}, 403)
    await refused(base + '/export', undefined, 'payroll_access_denied', humans['approver-b'].cookie, {}, 403)
    await refused(base + '/people/' + w1.id + '/private', {kind:'bank',version:1,value:'synthetic-envelope-380'}, 'payroll_access_denied', humans['approver-b'].cookie, {}, 403)
    const reviewAuditBefore = (await sql("SELECT COUNT(*) AS n FROM env_audit WHERE action='run.reviewed'"))[0].n
    const firstReview = await review(waRun, 'approver-a')
    const sensitiveRead = (await data(base + '/audit')).find(e => e.action === 'run.reviewed')
    assert.deepEqual([sensitiveRead.actorId, sensitiveRead.targetId, sensitiveRead.version], [humans['approver-a'].id, waRun, version])
    assert.ok(sensitiveRead.occurredAt > 0)
    assert.equal((await sql("SELECT COUNT(*) AS n FROM env_audit WHERE action='run.reviewed'"))[0].n, reviewAuditBefore + 1)
    assert.doesNotMatch(JSON.stringify(sensitiveRead), /40000|synthetic-envelope-bank|reviewToken|cipher/)
    assert.ok((await data(base + '/audit')).some(e => e.action === 'workspace.approval-policy.reviewed' && e.targetId === policy.id && e.version === 1))
    const firstBody={version,reviewToken:firstReview.reviewToken}
    for(const extra of [{yes:'yes'},{human:true,approved:true},{confirmation:true},{gesture:'approve-exact-run'}])
      await refused(door+'/earnings-run/'+waRun+'/approve',{...firstBody,...extra},'human_step_up_required',humans['approver-a'].cookie,{},403)
    const firstProof=await proof(firstReview,'approver-a')
    const earlierToken=randomBytes(32).toString('base64url'), earlierHash=await hashToken(settings.SESSION_SECRET,'session',earlierToken), earlierNow=Date.now()
    await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('synthetic-envelope-earlier-session','${earlierHash}','${humans['approver-a'].id}',1,'native',${earlierNow-60000},${earlierNow+3600000})`)
    await refused(door+'/earnings-run/'+waRun+'/approve',{...firstBody,...firstProof},'review_stale',localCookieName('operator_session_local',origin)+'='+earlierToken)
    const badOrigin=structuredClone(firstProof)
    const clientData=JSON.parse(Buffer.from(badOrigin.assertion.response.clientDataJSON,'base64url'))
    clientData.origin='https://foreign.example.com'
    badOrigin.assertion.response.clientDataJSON=Buffer.from(JSON.stringify(clientData)).toString('base64url')
    await refused(door+'/earnings-run/'+waRun+'/approve',{...firstBody,...badOrigin},'human_proof_invalid',humans['approver-a'].cookie,{},403)
    await sql(`UPDATE env_human_challenges SET expires_at=1 WHERE id='${firstProof.humanChallenge}'`)
    await refused(door+'/earnings-run/'+waRun+'/approve',{...firstBody,...firstProof},'human_challenge_stale',humans['approver-a'].cookie)
    const freshFirst=await review(waRun,'approver-a')
    await data(door+'/earnings-run/'+waRun+'/approve',{version,reviewToken:freshFirst.reviewToken,...await proof(freshFirst,'approver-a')},200,humans['approver-a'].cookie)
    await release(waRun, version, 'second_approval_required')
    await release(waRun, version, 'second_approval_required', { approvals: 2, thresholdCents: 99999999, secondApproverId: owner, approved: true })
    await refused(door + '/earnings-run/' + waRun + '/review', undefined, 'second_approver_must_differ', humans['approver-a'].cookie)
    await refused(door + '/earnings-run/' + waRun + '/approve', { version, reviewToken: firstReview.reviewToken }, 'second_approver_must_differ', humans['approver-a'].cookie)
    await refused(door + '/earnings-run/' + waRun + '/approve', { version, reviewToken: firstReview.reviewToken }, 'review_stale', humans['approver-b'].cookie)
    await stepUp()
    const agent = await data(base + '/agents', { name: 'synthetic-envelope-342', hours: 1, actions: ['records:read', 'drafts:prepare', 'drafts:read'],
      locations: ['*'], fields: ['compensation'], providers: [], models: [] }, 201, humans.admin.cookie)
    const mcp = (method, params) => fetch(origin + '/api/envelope/mcp', { method: 'POST',
      headers: { authorization: 'Bearer ' + agent.token, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 34, method, params }) })
    const tools = (await (await mcp('tools/list', {})).json()).result.tools.map((t) => t.name)
    assert.equal(tools.some((t) => /approve|release/.test(t)), false, 'no agent tool can approve or release a run')
    const before = await effects()
    const viaMcp = await mcp('tools/call', { name: 'run.approve', arguments: { companyId: company.id, runId: waRun, version } })
    assert.equal(viaMcp.status, 403)
    assert.equal((await viaMcp.json()).error.message, 'agent_tool_denied')
    assert.deepEqual(await effects(), before, 'an MCP approval attempt has zero effects')
    await refused(door + '/earnings-run/' + waRun + '/approve', { version, reviewToken: firstReview.reviewToken }, 'human_session_required', '',
      { authorization: 'Bearer ' + agent.token }, 403)
    await capture('run-approval-pending', screen)
    const presentedReply=await mcp('tools/call',{name:'run.review',arguments:{companyId:company.id,runId:waRun}})
    assert.equal(presentedReply.status,200)
    const presented=JSON.parse((await presentedReply.json()).result.content[0].text)
    assert.equal(presented.approval,'requires-separate-human-proof')
    assert.equal(presented.version,version)
    const presentedPath=new URL(presented.reviewUrl).pathname+new URL(presented.reviewUrl).search
    page = await capture('run-approval-review', presentedPath, 'approver-b')
    assert.ok((await page.locator('main').innerText()).includes('bank record v1 on file (masked)'))
    const expiredChallenge=await page.locator('[data-human-approval]').getAttribute('data-challenge')
    await sql(`UPDATE env_human_challenges SET expires_at=1 WHERE id='${expiredChallenge}'`)
    await page.getByRole('button', { name: 'Approve this exact run version', exact: true }).click()
    await page.getByRole('alert').filter({hasText:'This identity review expired.'}).waitFor()
    assert.equal((await status(waRun)).current,1,'an expired browser ceremony records no second approval')
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      await page.screenshot({path:join(folder,`run-human-proof-expired-${width}.png`),fullPage:true})
    }
    page=await capture('run-human-proof-fresh',presentedPath,'approver-b')
    await page.getByRole('button', { name: 'Approve this exact run version', exact: true }).click()
    await page.waitForURL(origin + screen)
    let current = await status(waRun)
    assert.equal(current.current, 2)
    assert.deepEqual(current.approvals.map((a) => a.approverId), [humans['approver-a'].id, humans['approver-b'].id])
    assert.deepEqual(current.approvals.map(a=>a.presentingClient),['native-envelope',agent.id])
    assert.ok(current.approvals.every(a=>a.proofMethod==='passkey-uv'))
    assert.ok(current.approvals.every((a) => a.contentDigest.length === 64 && a.grantVersion === 1 && a.role === 'approver'))
    // Two distinct current people pass every binding; payment is still unavailable.
    await release(waRun, version, 'run_not_payable')
    page = pages.owner
    await capture('run-approvals-complete', screen)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(origin + screen)
      await page.getByRole('button', { name: `Release ${waRun} v${version}`, exact: true }).click()
      assert.match(await page.locator('main').innerText(), /tax obligations, net pay and an authorized payment rail do not exist yet/)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: join(folder, `run-release-refused-${width}.png`), fullPage: true })
    }

    const pendingPresentation=await data(door+'/earnings-run/'+waRun+'/review'+new URL(presented.reviewUrl).search)
    const pendingProof=await proof(pendingPresentation,'owner')
    await data(base+'/agents/'+agent.id+'/revoke',{version:1},200,humans.admin.cookie)
    await refused(door+'/earnings-run/'+waRun+'/approve',{version,reviewToken:pendingPresentation.reviewToken,...pendingProof},'presenting_client_revoked',cookie,{},403)

    // A changed date is a new version; a restored identical version needs fresh approval.
    version = await run(waRun, version, waSetup.group, { payDate: '2026-03-14' })
    await release(waRun, version - 1, 'run_version_superseded')
    await release(waRun, version, 'approval_required')
    version = await run(waRun, version, waSetup.group)
    await release(waRun, version, 'approval_required')
    assert.equal((await status(waRun)).approvals.length, 0, 'identical restored content does not restore approval')

    // Each material edit voids a current approval before release.
    const caRun = 'synthetic-envelope-350'
    let caVersion = 0
    const approvedCa = async () => {
      caVersion = await run(caRun, caVersion, caSetup.group)
      await approve(caRun, 'approver-a')
      await release(caRun, caVersion, 'run_not_payable')
    }
    await approvedCa()
    await data(door + '/pay-change', { ...caSetup.change, version: 1, items: [terms(c1, 2600)] }, 201)
    await release(caRun, caVersion, 'run_sources_changed')
    await approveSetup('pay-change', caSetup.change.id)
    await approvedCa()
    await work(c1, 349, 'CA', 420, 1)
    await release(caRun, caVersion, 'run_sources_changed')
    await approvedCa()
    await work(c1, 351, 'CA', 60, 0, '2026-03-03')
    await release(caRun, caVersion, 'run_sources_changed')
    await approvedCa()
    await bank(c1, 1)
    await release(caRun, caVersion, 'run_destination_changed')
    // Release and approval racing an edit: whichever lands first, the edit voids the version.
    await approvedCa()
    const raced = await Promise.all([
      call(door + '/earnings-run/' + caRun + '/release', { version: caVersion }),
      work(c1, 349, 'CA', 450, 2),
    ])
    assert.equal(raced[0].status, 409)
    assert.ok(['run_not_payable', 'run_sources_changed'].includes((await raced[0].json()).error))
    await release(caRun, caVersion, 'run_sources_changed')
    caVersion = await run(caRun, caVersion, caSetup.group)
    const racedReview = await review(caRun, 'approver-a')
    await Promise.all([
      call(door + '/earnings-run/' + caRun + '/approve', { version: caVersion, reviewToken: racedReview.reviewToken, ...await proof(racedReview,'approver-a') }, humans['approver-a'].cookie),
      work(c1, 349, 'CA', 480, 3),
    ])
    await release(caRun, caVersion, 'run_sources_changed')
    await approvedCa()

    // A WA risk class or final FUTA edition voids only the runs it governs.
    await approve(waRun, 'approver-a')
    await approve(waRun, 'approver-b')
    await release(waRun, version, 'run_not_payable')
    const rule = {
      version: 0, locality: '', effectiveFrom: '2026-01-01', effectiveThrough: '2026-12-31', publishedDate: '2026-02-01',
      sourceTitle: 'Synthetic official-source fixture', sourceRef: 'synthetic-envelope-352', edition: '2026', taxYear: 2026,
      determination: 'final', value: '1.8', unit: 'cents/hour', ownerId: owner, backupId: humans['approver-a'].id,
      approvalDue: '2026-02-20T17:00:00Z', wageDeadline: '2026-03-13T23:59:59Z',
    }
    const publish = async (proposal) => {
      await data(base + '/rules', proposal, 201)
      const r = await data(base + '/rules/review/' + proposal.id)
      await data(base + '/rules/' + proposal.id + '/approve', { version: r.version, reviewToken: r.reviewToken })
    }
    await publish({ ...rule, id: 'synthetic-envelope-353', name: 'WA L&I revised risk class', family: 'wa-li', state: 'WA',
      sourceUrl: 'https://www.lni.wa.gov/insurance/rates-risk-classes/',
      details: { riskClass: 'synthetic-envelope-354', totalRate: '1.9', employeeRate: '0.4', hoursMethod: 'actual' } })
    await release(waRun, version, 'run_rules_changed')
    await release(caRun, caVersion, 'run_not_payable')
    await publish({ ...rule, id: 'synthetic-envelope-355', name: 'Final CA FUTA credit reduction', family: 'futa', state: 'CA',
      value: '1.2', unit: 'percent', sourceUrl: 'https://oui.doleta.gov/unemploy/futa_credit.asp',
      details: { reduction: '1.2', bcr: '0', addOn: '0', finalNoticeRef: 'synthetic-envelope-356' } })
    await release(caRun, caVersion, 'run_rules_changed')
    caVersion = await run(caRun, caVersion, caSetup.group)
    await release(caRun, caVersion, 'approval_required')

    // A changed approver grant voids that person's approval.
    await approve(caRun, 'approver-a')
    await grant('approver-a', 'approver', ['compensation'], ['records:read', 'pay:approve'], 1)
    await release(caRun, caVersion, 'approval_authority_changed')
    current = await status(caRun)
    assert.equal(current.current, 0)
    assert.equal(current.approvals[0].current, false)
    // Undo before dispatch: withdrawing the reviewed rate setup voids the pending approval.
    caVersion = await run(caRun, caVersion, caSetup.group)
    await approve(caRun, 'approver-b')
    await release(caRun, caVersion, 'run_not_payable')
    await data(door + '/pay-change/' + caSetup.change.id + '/withdraw', { version: 2 })
    await release(caRun, caVersion, 'run_sources_changed')
    await capture('run-approval-voided', screen)

    // Each tip's settlement type and employee-furnished funds bind the approved version.
    const t1 = await person('Synthetic Seattle bartender', wa)
    const tipSetup = await setup(370, 'Seattle tipped crew', [t1])
    await work(t1, 372, 'WA')
    await bank(t1, 0)
    const tipPath = base + '/people/' + t1.id + '/allocations/tip',
      tipBody = (n, settlement, amountCents, furnishedCents, version) => ({ id: 'synthetic-envelope-' + n, version, day: '2026-03-02',
        amountCents, settlement, furnishedCents, sourceRef: 'synthetic-envelope-tip-' + n })
    const tip = (n, settlement, amountCents, furnishedCents, version = 0, who = cookie) =>
      data(tipPath, tipBody(n, settlement, amountCents, furnishedCents, version), 201, who)
    await tip(373, 'cash', 5000, 1000)
    await tip(374, 'paycheck', 3000, 0)
    // Adding people does not authorize tip amounts: recording or revising a tip needs compensation access.
    await grant('clerk', 'preparer', [], ['records:read', 'records:write'])
    await refused(tipPath, tipBody(376, 'paycheck', 25000, 0, 0), 'payroll_access_denied', humans.clerk.cookie, {}, 403)
    await refused(tipPath, tipBody(374, 'paycheck', 25000, 0, 1), 'payroll_access_denied', humans.clerk.cookie, {}, 403)
    const tipRun = 'synthetic-envelope-375'
    let tipVersion = await run(tipRun, 0, tipSetup.group)
    const tipData = async () => (await data(door)).runs.find((r) => r.id === tipRun).data
    let tipped = await tipData()
    assert.equal(tipped.grossCashCents, 23000, 'paycheck tips are paid; cash tips were already received')
    assert.deepEqual([tipped.people[0].cashTipsCents, tipped.people[0].paycheckTipsCents, tipped.people[0].tipFundsCents], [5000, 3000, 1000])
    await approve(tipRun, 'approver-b')
    await release(tipRun, tipVersion, 'run_not_payable')
    await tip(374, 'cash', 3000, 0, 1, humans.admin.cookie)
    await release(tipRun, tipVersion, 'run_sources_changed')
    tipVersion = await run(tipRun, tipVersion, tipSetup.group)
    tipped = await tipData()
    assert.equal(tipped.grossCashCents, 20000, 'a revised payout is a new version')
    await release(tipRun, tipVersion, 'approval_required')
    page = await capture('run-tip-binding', screen + '/earnings-run/' + tipRun + '/review', 'approver-b')
    assert.ok((await page.locator('main').innerText()).includes('$30.00 cash, employee-furnished funds $0.00'))
    await page.getByRole('button', { name: 'Approve this exact run version', exact: true }).click()
    await page.waitForURL(origin + screen)
    await release(tipRun, tipVersion, 'run_not_payable')
    await tip(373, 'cash', 5000, 1500, 1)
    await release(tipRun, tipVersion, 'run_sources_changed')
    // Official OIDC ID-token schema edge: a pinned issuer signs fresh, nonce-bound MFA.
    const signing=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
    const jwk={...await crypto.subtle.exportKey('jwk',signing.publicKey),kid:'synthetic-envelope-822',alg:'ES256',use:'sig'}
    const issuer='https://auth.example.com', audience='synthetic-envelope-823', subject='synthetic-envelope-824'
    const now=Date.now()
    await sql(`INSERT INTO oa_identity_providers(provider_id,preset,status,issuer,client_id,jwks_uri,authorization_endpoint,token_endpoint,algorithms,token_auth_method,response_iss,interface_version,linked_at,jwks) VALUES('auth','auth','linked','${issuer}','${audience}','${issuer}/jwks','${issuer}/authorize','${issuer}/token','["ES256"]','private_key_jwt',1,'1.0.0',${now},'${JSON.stringify({keys:[jwk]})}'); INSERT INTO rer_dependency_link(interface,issuer,client_id,metadata,linked_at) VALUES('oidc-provider@1','${issuer}','${audience}','{}',${now}); UPDATE oa_auth_settings SET idp_sign_in=1 WHERE singleton=1; INSERT INTO oa_external_identities(issuer,subject,operator_id) VALUES('${issuer}','${subject}','${owner}')`)
    tipVersion=await run(tipRun,tipVersion,tipSetup.group)
    const oidcReview=await review(tipRun,'owner')
    const token=async extra=>{
      const time=Math.floor(Date.now()/1000)
      const claims={iss:issuer,aud:audience,sub:subject,iat:time,exp:time+300,auth_time:time,nonce:oidcReview.humanProof.options.challenge,amr:['pwd','mfa'],...extra}
      const input=Buffer.from(JSON.stringify({alg:'ES256',kid:jwk.kid,typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')
      return input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signing.privateKey,new TextEncoder().encode(input))).toString('base64url')
    }
    const mfaBody=async extra=>({version:tipVersion,reviewToken:oidcReview.reviewToken,gesture:'approve-exact-run',humanChallenge:oidcReview.humanProof.id,assertion:{idToken:await token(extra)}})
    for(const invalid of [{amr:['pwd']},{auth_time:1},{nonce:'synthetic-envelope-825'},{aud:'synthetic-envelope-826'},{sub:'synthetic-envelope-827'},{exp:1}])
      await refused(door+'/earnings-run/'+tipRun+'/approve',await mfaBody(invalid),'human_proof_invalid',cookie,{},403)
    await sql("UPDATE rer_dependency_link SET needs_relink=1 WHERE interface='oidc-provider@1'")
    await refused(door+'/earnings-run/'+tipRun+'/approve',await mfaBody({}),'human_mfa_unavailable',cookie,{},403)
    await sql("UPDATE rer_dependency_link SET needs_relink=0 WHERE interface='oidc-provider@1'")
    await data(door+'/earnings-run/'+tipRun+'/approve',await mfaBody({}))
    const mfaStatus=await status(tipRun)
    assert.equal(mfaStatus.approvals[0].approverId,owner)
    assert.equal(mfaStatus.approvals[0].proofMethod,'oidc-mfa')
    assert.equal(mfaStatus.approvals[0].presentingClient,'native-envelope')
    await release(tipRun,tipVersion,'run_not_payable')
    const audit = await sql("SELECT COUNT(*) AS n FROM env_audit WHERE action='run.approved'")
    assert.equal(audit[0].n, (await sql('SELECT COUNT(*) AS n FROM env_run_approvals'))[0].n, 'every approval is audited once')
    const trail = (await data(base + '/audit')).filter((e) => e.action === 'run.approved')
    assert.deepEqual([trail[0].actorId, trail[0].targetId, trail[0].version], [owner, tipRun, tipVersion],
      'the audit door names the latest approver and exact version')
    await sql(`DELETE FROM oa_identity_providers WHERE client_id='${audience}'; DELETE FROM rer_dependency_link WHERE client_id='${audience}'; DELETE FROM oa_external_identities WHERE issuer='${issuer}' AND subject='${subject}'; UPDATE oa_auth_settings SET idp_sign_in=0 WHERE singleton=1`)
    console.log(
      'RUN-APPROVALS passed: owner two-person threshold; exact run versions bind payees, bank-record versions, dates, earnings and rules; threshold bypass, self-second-approval, copied review, restored version and MCP/bearer agent approval refused with zero effects; rate, hours, new hours, bank, date, approver-grant, setup-withdrawal and tip settlement or furnished-funds edits void approval; adding people alone cannot record or revise a tip; a WA risk class and final CA FUTA void only their runs; fresh passkey user verification and signed nonce-bound OIDC MFA, separate human and MCP presenter, old-session and stale-challenge refusal, and revoked presentation links; fully approved release still refuses without tax obligations or an authorized rail; 1440/390.',
    )
  } finally {
    await browser.close()
  }
}
