import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'

export async function accountingJourney({ origin, cookie, sql, settings, restart }) {
  const call = (path, body, who = cookie) => fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual', headers: { ...(who ? { cookie: who } : {}), origin, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = async (path, body, status = 200) => { const r = await call(path, body); assert.equal(r.status, status, await r.clone().text()); return r.json() }
  const company = await data('/api/envelope/companies', { name: 'Synthetic ledger company', ein: '00-0000830' }, 201)
  const base = '/api/envelope/companies/' + company.id, door = base + '/accounting', pay = base + '/pay-settings', screen = door.replace('/api/', '/app/')
  const location = await data(base + '/locations', { name: 'Synthetic office', state: 'WA' }, 201)
  const person = await data(base + '/people', { name: 'Synthetic worker', locationId: location.id }, 201)
  const group = 'synthetic-envelope-830'
  await data(pay + '/group', { id: group, version: 0, name: 'Synthetic crew', people: [person.id] }, 201)
  const approveSetup = async (kind, id) => { const review = await data(pay + '/review/' + kind + '/' + id); return data(pay + '/' + kind + '/' + id + '/approve', { version: review.version, reviewToken: review.reviewToken }) }
  await approveSetup('group', group)
  const allowance = { id: 'synthetic-envelope-831', version: 0, name: 'Taxable allowance', groupId: group, amountCents: 10000, taxCode: 'w2-cash-earning', effectiveDate: '2026-01-01', recurring: true }
  await data(pay + '/pay-item', allowance, 201); await approveSetup('pay-item', allowance.id)
  const period = { id: 'synthetic-envelope-832', version: 0, groupId: group, periodStart: '2026-10-19', periodEnd: '2026-10-25', payDate: '2026-10-30', frequency: 'weekly' }
  const run = await data(pay + '/earnings-run', period, 201)
  assert.equal(run.preview.grossCashCents, 10000)
  assert.equal(run.preview.netPay, null)
  const mapping = { id: 'synthetic-envelope-833', version: 0, name: 'Reviewed ledger map', ledger: 'QuickBooks Online', ledgerUrl: 'https://qbo.intuit.com/app/journal', enabled: true, closedThrough: '', repairOwner: 'Synthetic accountant', accounts: { wages: '5000', reimbursements: '5200', 'employer-tax': '5100', 'net-funding': '1000', 'tax-funding': '2100', deductions: '2200' } }
  const dims = { department: 'Operations', class: 'Hourly', location: 'Seattle', job: 'Installation' }
  const proposal = { id: 'synthetic-envelope-834', version: 0, connectionId: mapping.id, runId: run.id, runVersion: run.version, postingDate: '2026-10-30', proposedEmployeeTaxCents: 2000, proposedEmployerTaxCents: 1000, splits: [{ ...dims, amountCents: 6000 }, { ...dims, department: 'Service', job: 'Repair', amountCents: 4000 }] }
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext(); await context.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=')[1], url: origin }]); const page = await context.newPage()
  const proof = process.env.ENVELOPE_PROOF_DIR ?? 'test-results/envelope'; await mkdir(proof, { recursive: true })
  const capture = async (label, path = screen) => { for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + path); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label); for (const control of await page.locator('button,a').all()) assert.ok((await control.innerText()).trim(), 'all controls have visible words'); await page.screenshot({ path: join(proof, 'accounting-' + label + '-' + width + '.png'), fullPage: true }) } }
  const assertError = async (path, body, status, error) => { const r = await call(path, body); assert.equal(r.status, status); assert.equal((await r.json()).error, error) }
  try {
    await capture('empty')
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin + screen)
    const form = page.locator('form[action$="/connections"]')
    for (const [key, value] of Object.entries(mapping).filter(([key]) => key !== 'accounts')) {
      const field = form.locator('[name="' + key + '"]')
      if (key === 'ledger' || key === 'enabled') await field.selectOption(String(value))
      else await field.fill(typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
    for (const [key, value] of Object.entries(mapping.accounts)) await form.locator('[name="account-' + key + '"]').fill(value)
    await form.getByRole('button', { name: 'Save mapping', exact: true }).focus()
    const saved = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === screen + '/connections')
    await page.keyboard.press('Enter'); assert.equal((await saved).status(), 303); await page.waitForLoadState('networkidle')
    assert.equal((await data(door)).connections.length, 1)
    const missing = { ...mapping.accounts }; delete missing['tax-funding']
    await data(door + '/connections', { ...mapping, id: 'synthetic-envelope-835', accounts: missing })
    await assertError(door + '/preview', { ...proposal, connectionId: 'synthetic-envelope-835' }, 409, 'account_mapping_required')
    const repair = (await data(door)).connections.find(c => c.id === 'synthetic-envelope-835')
    assert.equal(repair.data.repairOwner, 'Synthetic accountant'); assert.equal(repair.data.accounts['tax-funding'], '')
    for (const ledgerUrl of ['https://qbo.intuit.com.evil.example/collect', 'https://qbo.intuit.com/app?token=synthetic-envelope-837', 'http://qbo.intuit.com/']) await assertError(door + '/connections', { ...mapping, id: 'synthetic-envelope-835', ledgerUrl }, 400, 'invalid_ledger_link')
    await assertError(door + '/preview', { ...proposal, splits: [{ ...dims, amountCents: 9999 }] }, 409, 'dimension_split_mismatch')
    await assertError(door + '/preview', { ...proposal, proposedEmployeeTaxCents: 10001 }, 409, 'accounting_allocation_exceeds_cash')
    await assertError(door + '/preview', { ...proposal, runVersion: 2 }, 409, 'run_version_superseded')
    const preview = await data(door + '/preview', proposal)
    assert.equal((await data(door)).journals.length, 0, 'preview cannot write a journal')
    assert.deepEqual(preview.lines, [
      { component: 'wages', account: '5000', debitCents: 6000, creditCents: 0, dimensions: dims },
      { component: 'wages', account: '5000', debitCents: 4000, creditCents: 0, dimensions: { ...dims, department: 'Service', job: 'Repair' } },
      { component: 'employer-tax', account: '5100', debitCents: 1000, creditCents: 0, dimensions: { department: '', class: '', location: '', job: '' } },
      { component: 'net-funding', account: '1000', debitCents: 0, creditCents: 8000, dimensions: { department: '', class: '', location: '', job: '' } },
      { component: 'tax-funding', account: '2100', debitCents: 0, creditCents: 3000, dimensions: { department: '', class: '', location: '', job: '' } },
    ])
    assert.deepEqual([preview.grossCashCents, preview.proposedEmployeeTaxCents, preview.proposedEmployerTaxCents, preview.proposedNetCents, preview.totalDebitCents, preview.totalCreditCents], [10000, 2000, 1000, 8000, 11000, 11000])
    const worksheet = page.locator('form[action$="/prepare"]')
    for (const [key, value] of Object.entries(proposal).filter(([key]) => key !== 'splits')) await worksheet.locator('[name="' + key + '"]').fill(String(value))
    for (const [i, split] of proposal.splits.entries()) for (const [key, value] of Object.entries(split)) await worksheet.locator('[name="split-' + i + '-' + key + '"]').fill(String(value))
    const previewed = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === screen + '/preview')
    await worksheet.getByRole('button', { name: 'Preview allocation', exact: true }).click(); assert.equal((await previewed).status(), 200); await page.waitForLoadState('networkidle')
    assert.equal(await page.getByRole('heading', { name: 'Allocation preview', exact: true }).count(), 1)
    assert.ok((await page.locator('body').innerText()).includes('proposed net $80.00'))
    assert.equal((await data(door)).journals.length, 0)
    for (const width of [1440, 390]) { await page.setViewportSize({width, height:1000}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.screenshot({path:join(proof,'accounting-preview-'+width+'.png'),fullPage:true}) }
    const prepared = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === screen + '/prepare')
    await worksheet.getByRole('button', { name: 'Prepare worksheet', exact: true }).click(); assert.equal((await prepared).status(), 303); await page.waitForLoadState('networkidle')
    await assertError(door + '/prepare', proposal, 409, 'input_or_authority_changed')
    const path = door + '/journals/' + proposal.id
    await assertError(path + '/post', { version: 1 }, 409, 'journal_review_required')
    let review = await data(path + '/review')
    await assertError(path + '/approve', { version: 1, reviewToken: 'synthetic-envelope-838' }, 409, 'review_stale')
    const otherToken = randomBytes(32).toString('base64url'), otherHash = await hashToken(settings.SESSION_SECRET, 'session', otherToken), ownerHash = await hashToken(settings.SESSION_SECRET, 'session', cookie.split('=')[1]), ownerNow = Date.now()
    await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) SELECT 'synthetic-envelope-848','${otherHash}',operator_id,operator_version,'native',${ownerNow},${ownerNow + 3600000} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
    assert.equal((await call(path + '/approve', {version:1,reviewToken:review.reviewToken}, cookie.split('=')[0] + '=' + otherToken)).status, 409, 'review is bound to its native owner session')
    await sql(`UPDATE env_workspace_reviews SET expires_at=${Date.now()-1} WHERE token_hash='${await (async()=>{const {createHash}=await import('node:crypto');return createHash('sha256').update(review.reviewToken).digest('hex')})()}'`)
    await assertError(path + '/approve', {version:1,reviewToken:review.reviewToken}, 409, 'review_stale')
    await capture('review', path.replace('/api/', '/app/') + '/review')
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin + path.replace('/api/', '/app/') + '/review')
    await page.getByRole('button', { name: 'Approve journal preparation', exact: true }).click(); await page.waitForURL(origin + screen)
    const original = (await data(door)).journals[0]
    assert.ok(original.approvedBy)
    assert.equal(original.data.postingState, 'unavailable')
    await assertError(path + '/post', { version: 1 }, 409, 'finalized_payroll_and_ledger_adapter_required')
    await capture('reviewed-unresolved')
    assert.equal(await page.getByRole('link', { name: 'Open ledger workspace', exact: true }).getAttribute('href'), mapping.ledgerUrl)
    assert.ok((await page.locator('body').innerText()).includes('Synthetic accountant'))
    await restart()
    assert.deepEqual((await data(door)).journals[0], original, 'restart preserves the exact journal and decision')
    const correction = { ...proposal, id: 'synthetic-envelope-839', correctionOf: proposal.id, correctionReason: 'Correct proposed tax classification', proposedEmployeeTaxCents: 2500 }
    await data(door + '/prepare', correction)
    review = await data(door + '/journals/' + correction.id + '/review')
    await data(door + '/journals/' + correction.id + '/approve', { version: 1, reviewToken: review.reviewToken })
    const corrected = (await data(door)).journals.find(r => r.id === correction.id)
    assert.equal(corrected.data.proposedNetCents, 7500)
    assert.equal(corrected.data.correctionOf, proposal.id)
    assert.equal(corrected.data.correctionReason, correction.correctionReason)
    assert.deepEqual(corrected.data.correctionLines.slice(0, 5), original.data.lines.map(l => ({ ...l, debitCents: l.creditCents, creditCents: l.debitCents })))
    assert.equal(corrected.data.correctionLines.reduce((sum, l) => sum + l.debitCents - l.creditCents, 0), 0)
    assert.equal(corrected.data.correctionLines.filter(l => l.component === 'net-funding').reduce((sum, l) => sum + l.creditCents - l.debitCents, 0), -500)
    assert.deepEqual((await data(door)).journals.find(r => r.id === proposal.id), original, 'correction retains its original')
    await capture('correction')
    const raced = await Promise.all([call(door + '/prepare', {...proposal,version:1,proposedEmployeeTaxCents:3000}),call(door + '/prepare', {...proposal,version:1,proposedEmployeeTaxCents:3500})])
    assert.deepEqual(raced.map(r => r.status).sort(), [200,409], 'concurrent append retains one exact journal revision')
    const versions = (await data(door)).journals.filter(r => r.id === proposal.id)
    assert.deepEqual(versions.map(r => r.version).sort(), [1,2])
    assert.equal(versions.find(r => r.version === 1).data.proposedNetCents, 8000)
    assert.equal(versions.find(r => r.version === 2).approvedBy, null, 'a revised worksheet inherits no preparation approval')
    await assertError(path + '/post',{version:1},409,'journal_sources_changed')
    // Mappings for each named ledger are native preparation settings, not tested provider adapters.
    for (const [index, ledger, ledgerUrl] of [[0, 'Pantry', 'https://ledger.example.com/'], [1, 'Xero', 'https://go.xero.com/'], [2, 'NetSuite', 'https://system.netsuite.com/'], [3, 'Sage Intacct', 'https://www.intacct.com/']]) {
      const id = 'synthetic-envelope-84' + index
      await data(door + '/connections', { ...mapping, id, ledger, ledgerUrl })
      const p = await data(door + '/preview', { ...proposal, connectionId: id })
      assert.equal(p.totalDebitCents, 11000); assert.equal(p.totalCreditCents, 11000); assert.equal(p.ledgerUrl, ledgerUrl)
    }
    await data(door + '/connections', { ...mapping, version: 1, enabled: false })
    await assertError(door + '/preview', proposal, 409, 'ledger_disconnected')
    await assertError(path + '/post', { version: 1 }, 409, 'journal_sources_changed')
    await data(door + '/connections', { ...mapping, version: 2, closedThrough: '2026-10-30' })
    await assertError(door + '/prepare', { ...proposal, id: 'synthetic-envelope-845' }, 409, 'ledger_period_closed')
    await data(door + '/preview', {...proposal,postingDate:'2026-10-31'})
    await capture('stale-mapping')
    // A changed payroll source refuses pending preparation review without rewriting it.
    const currentMapping = 'synthetic-envelope-841'
    await data(door + '/prepare', {...proposal,id:'synthetic-envelope-849',connectionId:currentMapping})
    const pendingReview = await data(door + '/journals/synthetic-envelope-849/review')
    await data(pay + '/pay-item', {...allowance,version:1,amountCents:12000},201)
    await assertError(door + '/journals/synthetic-envelope-849/approve',{version:1,reviewToken:pendingReview.reviewToken},409,'run_sources_changed')
    const stale = (await data(door)).journals.find(r => r.id === 'synthetic-envelope-849')
    assert.equal(stale.preparationCurrent, false); assert.equal(stale.blockedReason, 'run_sources_changed')
    await approveSetup('pay-item', allowance.id)
    for (const item of [
      {id:'synthetic-envelope-850',name:'Substantiated expense',taxCode:'accountable-reimbursement',amountCents:1000,evidenceRef:'Synthetic expense report',returnExcessBy:'2026-11-30'},
      {id:'synthetic-envelope-851',name:'Reviewed deduction',taxCode:'after-tax-deduction',amountCents:500},
    ]) { await data(pay+'/pay-item',{...item,version:0,groupId:group,effectiveDate:'2026-01-01',recurring:true},201); await approveSetup('pay-item',item.id) }
    const mixedRun = await data(pay+'/earnings-run',{...period,id:'synthetic-envelope-852'},201)
    assert.deepEqual([mixedRun.preview.taxableCashCents,mixedRun.preview.reimbursementCents,mixedRun.preview.afterTaxDeductionCents],[12000,1000,500])
    const mixedProposal = {...proposal,runId:mixedRun.id,runVersion:1,connectionId:currentMapping,splits:[{...dims,component:'wages',amountCents:12000},{...dims,component:'reimbursements',amountCents:1000}]}
    const mixed = await data(door+'/preview',mixedProposal)
    assert.deepEqual([mixed.proposedNetCents,mixed.totalDebitCents,mixed.totalCreditCents],[10500,14000,14000])
    assert.deepEqual(mixed.lines.filter(l => ['wages','reimbursements','deductions'].includes(l.component)).map(l => [l.component,l.account,l.debitCents,l.creditCents]),[['wages','5000',12000,0],['reimbursements','5200',1000,0],['deductions','2200',0,500]])
    await assertError(door+'/preview',{...mixedProposal,splits:[{...dims,amountCents:13000}]},409,'dimension_split_mismatch')
    const encrypted = await sql("SELECT cipher FROM env_workspace_versions WHERE kind IN ('ledger-connection','ledger-journal')")
    assert.ok(encrypted.length > 0)
    for (const row of encrypted) { assert.ok(!row.cipher.includes('Synthetic accountant')); assert.ok(!row.cipher.includes('Operations')); assert.ok(!row.cipher.includes('proposedEmployeeTaxCents')) }
    const another = await data('/api/envelope/companies', { name: 'Synthetic other company', ein: '00-0000846' }, 201)
    await assertError('/api/envelope/companies/' + another.id + '/accounting/preview', proposal, 404, 'record_not_found')
    const token = randomBytes(32).toString('base64url'), hashed = await hashToken(settings.SESSION_SECRET, 'session', token), now = Date.now(), member = 'synthetic-envelope-847'
    await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','synthetic-envelope-847@example.com','Synthetic accountant','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now + 3600000})`)
    await data(base + '/grants', { operatorId: member, version: 0, role: 'accountant', locations: ['*'], fields: ['compensation'], actions: ['records:read', 'records:write', 'rates:propose', 'rates:approve', 'export'] })
    const memberCookie = cookie.split('=')[0] + '=' + token, before = await data(door)
    for (const [p, body] of [[door, undefined], [door + '/connections', mapping], [door + '/preview', proposal], [door + '/prepare', proposal], [path + '/review', undefined], [path + '/approve', { version: 1, reviewToken: review.reviewToken }], [path + '/post', { version: 1 }]]) assert.equal((await call(p, body, memberCookie)).status, 403)
    assert.deepEqual(await data(door), before, 'refused member calls write no accounting rows')
    assert.equal((await call(door, undefined, '')).status, 401)
    await sql("UPDATE oa_sessions SET revoked_at=1 WHERE id='synthetic-envelope-848'")
    assert.equal((await call(door, undefined, cookie.split('=')[0]+'='+otherToken)).status, 401, 'revocation immediately removes private accounting reads')
    const audit = await data(base + '/audit')
    assert.ok(audit.some(a => a.action === 'workspace.ledger-journal.recorded'))
    assert.ok(audit.some(a => a.action === 'workspace.ledger-journal.approved'))
    for (const event of audit.filter(a => a.action.startsWith('workspace.ledger-journal.'))) { assert.ok(event.actorId); assert.ok(event.occurredAt > 0); assert.ok(event.version > 0); assert.ok(event.targetId) }
    assert.equal((await sql('SELECT COUNT(*) AS count FROM env_run_approvals'))[0].count, 0, 'worksheet approval never approves payroll')
    console.log('ACCOUNTING: balanced proposed allocations, dimensions, owned repair, exact review, corrections, restart, stale mappings, closed periods and access refusal passed; posting remains unavailable')
  } finally { await browser.close() }
}
