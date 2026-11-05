import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {hashToken} from '../src/modules/operator-auth/crypto.mjs'
import {answers} from './agent-door/native.mjs'
import {decisionMeta, preparedBonus, preparedBonusValue, pendingBonus, refusedDecision} from './agent-door/decisions.mjs'

/** One persistent sanity journey through MCP and native person decisions. */
export async function agentPolicyDecisionsJourney({origin, cookie, settings, sql, restart, advanceClock}) {
  let instant = '2026-10-28T12:00:00.000Z', sequence = 0
  const contentType = ['application','json'].join('/')
  const owner = async (path, body, {who=cookie, method=body===undefined?'GET':'POST', status=200, headers={}}={}) => {
    const response = await fetch(origin+path, {method, redirect:'manual', headers:{cookie:who, origin, 'content-type':contentType, ...headers}, ...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(response.status, status, path+' '+await response.clone().text())
    return response.json()
  }
  // Reuse the existing operator-auth fixture seam for recent owner proof and
  // a native email link. No shared door table is written by this journey.
  const ownerHash = await hashToken(settings.SESSION_SECRET, 'session', cookie.split('=')[1]), now = Date.parse(instant)
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at)
    SELECT 'synthetic-envelope-decisions-proof',token_hash,id,operator_id,operator_version,'credentials:mint','/app',${now},${now+600000},${now} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
  const reviewerId = 'synthetic-envelope-decisions-reviewer', linkToken = randomBytes(32).toString('base64url')
  const linkHash = await hashToken(settings.SESSION_SECRET, 'link', linkToken)
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at)
    VALUES('${reviewerId}','synthetic-envelope-decisions'||char(64)||'example.test','Synthetic named reviewer','member','active',1,${now});
    INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at)
    VALUES('synthetic-envelope-decisions-link','${linkHash}','magic','${reviewerId}',1,'/agents',${now},${now+600000})`)
  const company = await owner('/api/envelope/companies', {name:'Synthetic decisions employer', ein:'00-0009851'}, {status:201})
  const base = '/api/envelope/companies/'+company.id
  const location = await owner(base+'/locations', {name:'Synthetic decisions workplace', state:'PA'}, {status:201})
  const person = await owner(base+'/people', {name:'Synthetic decisions worker', locationId:location.id}, {status:201})
  await owner(base+'/grants', {operatorId:reviewerId, version:0, role:'viewer', locations:['*'], fields:[], actions:['records:read']})
  let nativePolicy = await owner(base+'/agents/class-policy', {version:0, ...answers})
  const credential = await owner(base+'/agents', {name:'Synthetic decisions agent', hours:4, actions:['records:read','drafts:prepare','drafts:read'], fields:['compensation'], locations:['*']}, {status:201})
  const wire = async (args, {name='envelope.bonus.prepare', path='/mcp'}={}) => {
    const id = ++sequence
    const response = await fetch(origin+path, {method:'POST', headers:{origin, authorization:'Bearer '+credential.token, 'content-type':contentType, 'MCP-Protocol-Version':'2026-07-28', 'Mcp-Method':'tools/call', 'Mcp-Name':name}, body:JSON.stringify({jsonrpc:'2.0', id, method:'tools/call', params:{name, arguments:args, _meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28', 'io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}}}}})})
    const body = await response.json()
    assert.equal(body.id, id)
    return {...body, httpStatus:response.status}
  }
  const input = (amountCents=25000) => ({companyId:company.id, personId:person.id, amountCents, periodStart:'2026-10-01', periodEnd:'2026-10-07', payDate:'2026-10-09', sourceRef:'synthetic-envelope-decisions-source', requestKey:crypto.randomUUID(), idempotency_key:crypto.randomUUID()})
  const effects = async () => (await sql(`SELECT
    (SELECT COUNT(*) FROM env_workspace_versions WHERE company_id='${company.id}' AND kind='earnings-run') AS runs,
    (SELECT COUNT(*) FROM env_agent_access WHERE company_id='${company.id}' AND action='bonus.prepared') AS preparations,
    (SELECT COUNT(*) FROM env_run_approvals WHERE company_id='${company.id}') AS payrollApprovals,
    (SELECT COUNT(*) FROM env_notice_dispatches WHERE company_id='${company.id}') AS dispatches`))[0]
  const audit = async key => {
    const result = await owner('/agents/api/audit?agent='+credential.id)
    assert.equal(result.differs_from_policy, 0)
    return result.rows.filter(row=>row.idempotency_key===key)
  }
  const policy = async disposition => {
    const result = await owner('/agents/api/policy', {document:{schema:'rer-agent-policy/1', catalogue:'rer-agent-classes/1', rules:[{id:'other-classes', class:'*', do:'autonomous'}, {id:'bonus-standard', class:'standard', do:disposition, ...(disposition==='approval'?{approver:['person:'+reviewerId], wait:'PT1H'}:{})}], reviewers:['sponsor'], spend:{none:true}}}, {method:'PUT'})
    return result.revision
  }
  const readApproval = async id => (await owner('/agents/api/approvals/'+id)).approval
  const exact = approval => ({revision:approval.revision, summary_sha256:approval.summary_sha256})
  const unchanged = async (before, message) => assert.deepEqual(await effects(), before, message)
  const onePreparation = async (before, result, args) => {
    assert.deepEqual(await effects(), {...before, runs:before.runs+1, preparations:before.preparations+1}, 'one real uncalculated bonus, no payroll approval or dispatch')
    const native = await owner(base+'/pay-settings/earnings-run/'+result.id+'/review')
    assert.equal(native.data.grossCashCents, args.amountCents)
    assert.equal(native.data.people[0].id, person.id)
    assert.equal(native.data.bonusPreparation.credentialId, credential.id)
    assert.equal(native.data.taxAmounts, null)
    assert.equal(native.data.netPay, null)
    assert.equal(native.data.paymentReady, false)
    assert.ok(native.data.holds.some(hold=>hold.code==='bonus-calculation-incomplete'))
  }
  const checkAudit = async (args, disposition, revision, outcome, code=null) => {
    const row = (await audit(args.idempotency_key)).at(-1)
    assert.ok(row)
    assert.equal(row.tool, 'envelope.bonus.prepare')
    assert.equal(row.agent.id, credential.id)
    assert.equal(row.sponsor.id, credential.sponsorId)
    assert.equal(row.revision, revision)
    assert.equal(row.decision, disposition)
    assert.equal(row.outcome, outcome)
    assert.equal(row.code, code)
    assert.deepEqual(row.classes, [{class:'standard', facts:{measure:1}}])
    assert.deepEqual(row.rules, [{class:'standard', rule:'bonus-standard', do:disposition}])
    return row
  }

  let revision = await policy('autonomous'), args = input(), before = await effects()
  let response = await wire(args)
  decisionMeta(response, 'autonomous', revision)
  const autonomous = preparedBonus(response)
  await onePreparation(before, autonomous, args)
  assert.equal((await checkAudit(args, 'autonomous', revision, 'done')).review, null)
  console.log('PROBE BASE-AGENT-007 1 autonomous: MCP bonus preparation -> one retained uncalculated run, no native payroll approval or dispatch')

  revision = await policy('review'); args = input(26000); before = await effects()
  response = await wire(args, {path:'/api/envelope/mcp'})
  const reviewDecision = decisionMeta(response, 'review', revision), reviewed = preparedBonus(response)
  await onePreparation(before, reviewed, args)
  const reviewId = response.result._meta['com.runeditrun/review'].id
  const reviews = (await owner('/agents/api/reviews')).reviews
  assert.deepEqual(reviews.map(row=>row.id), [reviewId], 'only the review disposition enters the review feed')
  assert.equal(reviews[0].decision_id, reviewDecision.id)
  assert.equal(reviews[0].summary.amount.value, 260)
  assert.equal(reviews[0].summary.target.id, person.id)
  assert.equal((await checkAudit(args, 'review', revision, 'done')).review.id, reviewId)
  console.log('PROBE BASE-AGENT-007 1 review: alias MCP bonus preparation -> one retained run and the exact linked review in the person feed')

  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless:true, args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  try {
    const reviewer = await browser.newContext(), ownerContext = await browser.newContext()
    await ownerContext.addCookies([{name:cookie.split('=')[0], value:cookie.split('=')[1], url:origin}])
    const signed = await reviewer.request.post(origin+'/auth/confirm', {headers:{origin}, data:{token:linkToken}, maxRedirects:0})
    assert.equal(signed.status(), 303, 'the named person signs in using the native confirmation door')
    const identity = await (await reviewer.request.get(origin+'/auth/session')).json()
    assert.equal(identity.operator.id, reviewerId)
    assert.notEqual(identity.operator.id, credential.sponsorId, 'the approver is a separately signed-in person')
    const page = await reviewer.newPage(), ownerPage = await ownerContext.newPage()
    await page.setViewportSize({width:1440, height:1000})
    await ownerPage.setViewportSize({width:1440, height:1000})
    const proof = process.env.ENVELOPE_PROOF_DIR ?? './test-results/envelope'
    await mkdir(proof, {recursive:true})
    const capture = async (target, name) => {
      for (const width of [1440,390]) {
        await target.setViewportSize({width, height:1000})
        await target.screenshot({path:join(proof, name+'-'+width+'.png'), fullPage:true})
      }
      await target.setViewportSize({width:1440, height:1000})
    }
    await ownerPage.goto(origin+'/agents')
    assert.equal(await ownerPage.locator('[data-review-id="'+reviewId+'"]').count(), 1)
    await capture(ownerPage, 'bonus-policy-review')

    revision = await policy('approval'); args = input(27000); before = await effects()
    response = await wire(args)
    const pendingDecision = decisionMeta(response, 'approval', revision), pending = pendingBonus(response, instant)
    await unchanged(before, 'approval waits without creating a native preparation')
    const saved = await readApproval(pending.id)
    assert.equal(saved.state, 'pending')
    assert.equal(saved.decision_id, pendingDecision.id)
    assert.equal(saved.revision, revision)
    assert.equal(saved.expires_at, pending.expires_at)
    assert.deepEqual(saved.classes, [{class:'standard', facts:{measure:1}}])
    assert.deepEqual(saved.approvers, ['person:'+reviewerId])
    assert.deepEqual(saved.summary.target, {id:person.id, name:person.name})
    assert.deepEqual(saved.summary.amount, {value:270, currency:'USD'})
    assert.ok(saved.summary.items.includes('Uncalculated bonus preparation'))
    assert.equal((await checkAudit(args, 'approval', revision, 'pending')).approval.id, pending.id)
    const decisionPath = '/agents/api/approvals/'+pending.id+'/approve'
    await owner(decisionPath, exact(saved), {status:403})
    await owner(decisionPath, exact(saved), {who:'', status:403, headers:{authorization:'Bearer '+credential.token}})
    for (const body of [{...exact(saved), revision:revision-1}, {...exact(saved), summary_sha256:'synthetic-envelope-stale-summary'}]) {
      const stale = await reviewer.request.post(origin+decisionPath, {headers:{origin}, data:body})
      assert.equal(stale.status(), 409, 'only the exact saved policy revision and summary can be approved')
    }
    assert.equal((await readApproval(pending.id)).state, 'pending')
    await unchanged(before, 'wrong person, agent and stale approval cannot prepare')
    refusedDecision(await wire({...args, amountCents:27001}), 'idempotency_conflict')
    assert.deepEqual(await readApproval(pending.id), saved, 'changed pending inputs cannot replace the exact saved action')
    await unchanged(before, 'changed pending inputs need a fresh approval')
    await page.goto(pending.url)
    assert.equal(await page.locator('[data-approval-summary]').count(), 1)
    assert.ok((await page.locator('[data-approval-summary]').innerText()).includes('270.00'))
    assert.equal(await page.locator('time').first().getAttribute('datetime'), pending.expires_at)
    assert.equal(await page.getByRole('button', {name:'Approve', exact:true}).count(), 1)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), true)
    for (const control of await page.locator('button,a,summary').all()) if (await control.isVisible()) assert.ok((await control.innerText()).trim(), 'all controls have visible text')
    await capture(page, 'bonus-policy-pending')
    // Restart the actual Worker while the approval remains pending.
    await restart(); await advanceClock(instant)
    assert.deepEqual(await readApproval(pending.id), saved)
    await unchanged(before, 'restart does not execute a pending action')
    await page.getByRole('button', {name:'Approve', exact:true}).click()
    await page.locator('[data-approval-state="executed"]').waitFor()
    const approved = await readApproval(pending.id)
    assert.deepEqual(approved.approvals.map(mark=>mark.person), [reviewerId])
    response = await wire(args, {path:'/api/envelope/mcp'})
    const completed = preparedBonus(response), receipt = response.result._meta['com.runeditrun/receipt']
    assert.equal(receipt.approval_id, pending.id)
    assert.deepEqual(receipt.approved_by, [reviewerId])
    assert.equal(receipt.prepared_by.agent.id, credential.id)
    assert.equal(receipt.prepared_by.for.id, credential.sponsorId)
    await onePreparation(before, completed, args)
    const once = await effects()
    await page.reload(); await capture(page, 'bonus-policy-approved')
    const repeated = await reviewer.request.post(origin+decisionPath, {headers:{origin}, data:exact(saved)})
    assert.equal(repeated.status(), 200)
    assert.deepEqual(preparedBonus(await wire(args)), completed)
    await unchanged(once, 'repeated human decision and agent retry prepare exactly once')
    console.log('PROBE BASE-AGENT-007 5 exact approval: native signed-in named reviewer, stale evidence and restart -> pending facts and expiry retained; exact browser approval prepares once; retry returns its receipt')

    const changed = {...args, amountCents:28000}
    refusedDecision(await wire(changed), 'idempotency_conflict')
    await unchanged(once, 'changed arguments cannot reuse the completed approval')
    const freshArgs = {...changed, requestKey:crypto.randomUUID(), idempotency_key:crypto.randomUUID()}
    const fresh = pendingBonus(await wire(freshArgs), instant), freshSaved = await readApproval(fresh.id)
    assert.notEqual(fresh.id, pending.id)
    assert.notEqual(freshSaved.summary_sha256, saved.summary_sha256)
    const oldEvidence = await reviewer.request.post(origin+'/agents/api/approvals/'+fresh.id+'/approve', {headers:{origin}, data:exact(saved)})
    assert.equal(oldEvidence.status(), 409)
    await unchanged(once, 'new arguments wait for a new exact approval')
    await page.goto(fresh.url)
    await page.getByRole('button', {name:'Approve', exact:true}).click()
    await page.locator('[data-approval-state="executed"]').waitFor()
    await onePreparation(once, preparedBonus(await wire(freshArgs)), freshArgs)
    console.log('PROBE BASE-AGENT-007 5 changed input: changed amount with old key -> conflict; fresh key -> different pending summary, old approval refused, fresh human approval required')

    // Even an unchanged policy document creates a new revision. Approval of
    // the previous revision cannot silently authorize the newly current one.
    const supersededArgs = input(28500), supersededBefore = await effects()
    const superseded = pendingBonus(await wire(supersededArgs), instant)
    const supersededSaved = await readApproval(superseded.id)
    const previousApprovalRevision = revision
    revision = await policy('approval')
    assert.equal(revision, previousApprovalRevision+1)
    const oldRevision = await reviewer.request.post(origin+'/agents/api/approvals/'+superseded.id+'/approve', {headers:{origin}, data:exact(supersededSaved)})
    assert.equal(oldRevision.status(), 200)
    const refusedApproval = (await oldRevision.json()).approval
    assert.equal(refusedApproval.state, 'refused')
    assert.equal(refusedApproval.code, 'approval_evidence_changed')
    refusedDecision(await wire(supersededArgs), 'approval_required')
    await unchanged(supersededBefore, 'an exact old approval cannot execute under a changed policy revision')
    const replacementArgs = {...supersededArgs, requestKey:crypto.randomUUID(), idempotency_key:crypto.randomUUID()}
    const replacement = pendingBonus(await wire(replacementArgs), instant)
    const replacementSaved = await readApproval(replacement.id)
    assert.notEqual(replacement.id, superseded.id)
    assert.equal(replacementSaved.revision, revision)
    const staleRevision = await reviewer.request.post(origin+'/agents/api/approvals/'+replacement.id+'/approve', {headers:{origin}, data:exact(supersededSaved)})
    assert.equal(staleRevision.status(), 409)
    await unchanged(supersededBefore, 'a replacement action still needs the current exact revision')
    const replacementDecision = await reviewer.request.post(origin+'/agents/api/approvals/'+replacement.id+'/approve', {headers:{origin}, data:exact(replacementSaved)})
    assert.equal(replacementDecision.status(), 200)
    assert.equal((await replacementDecision.json()).approval.state, 'executed')
    await onePreparation(supersededBefore, preparedBonus(await wire(replacementArgs)), replacementArgs)
    console.log('PROBE BASE-AGENT-007 5 policy revision: unchanged document saved as a new revision -> prior pending approval refused without preparation; fresh pending revision needs a fresh exact human decision')

    const rejectedArgs = input(29000), rejectedBefore = await effects(), rejected = pendingBonus(await wire(rejectedArgs), instant)
    await page.goto(rejected.url)
    await page.getByRole('button', {name:'Decline', exact:true}).click()
    await page.locator('[data-approval-state="rejected"]').waitFor()
    refusedDecision(await wire(rejectedArgs), 'approval_rejected')
    await checkAudit(rejectedArgs, 'approval', revision, 'replayed', 'approval_rejected')
    await unchanged(rejectedBefore, 'rejection leaves no native preparation')
    const expiredArgs = input(30000), expired = pendingBonus(await wire(expiredArgs), instant)
    instant = '2026-10-28T13:00:00.001Z'
    await advanceClock(instant); await restart(); await advanceClock(instant)
    assert.equal((await readApproval(expired.id)).state, 'expired')
    await page.goto(expired.url)
    assert.equal(await page.getByRole('button', {name:'Approve', exact:true}).count(), 0)
    const late = await reviewer.request.post(origin+'/agents/api/approvals/'+expired.id+'/approve', {headers:{origin}, data:exact(await readApproval(expired.id))})
    assert.equal(late.status(), 409)
    refusedDecision(await wire(expiredArgs), 'approval_expired')
    await checkAudit(expiredArgs, 'approval', revision, 'replayed', 'approval_expired')
    await unchanged(rejectedBefore, 'controlled-clock expiry and restart leave no preparation')
    console.log('PROBE BASE-AGENT-007 5 rejection and expiry: person decline and controlled clock beyond saved expiry, across restart -> approval_rejected and approval_expired; no preparation')

    revision = await policy('blocked'); args = input(); before = await effects()
    response = await wire(args)
    decisionMeta(response, 'blocked', revision); refusedDecision(response, 'policy_blocked')
    assert.deepEqual(response.result._meta['com.runeditrun/error'], {code:'policy_blocked', class:'standard', rule:'bonus-standard', revision})
    await unchanged(before, 'blocked policy has no native preparation')
    await checkAudit(args, 'blocked', revision, 'refused', 'policy_blocked')
    console.log('PROBE BASE-AGENT-007 1 blocked: MCP bonus preparation -> policy_blocked naming standard class, rule and revision, no preparation')

    // Native company policy is an additional restrictive floor, never a way
    // for shared approval to manufacture a native payroll permission.
    for (const shared of ['autonomous','review','approval']) {
      revision = await policy(shared)
      for (const [disposition, code] of [['review','policy_review_required'], ['approval','policy_approval_required'], ['blocked','policy_blocked']]) {
        nativePolicy = await owner(base+'/agents/class-policy', {version:nativePolicy.version, ...answers, standard:disposition})
        const floorArgs = input()
        const reviewIds = (await owner('/agents/api/reviews')).reviews.map(row=>row.id)
        const floorResponse = await wire(floorArgs)
        refusedDecision(floorResponse, code)
        assert.equal(floorResponse.result.requestState, undefined, 'the native floor refuses before opening shared approval')
        assert.equal(floorResponse.result._meta['com.runeditrun/approval'], undefined)
        await unchanged(before, 'the native '+disposition+' floor survives a shared '+shared+' answer')
        assert.deepEqual((await owner('/agents/api/reviews')).reviews.map(row=>row.id), reviewIds, 'a native refusal never becomes a completed review item')
      }
    }
    nativePolicy = await owner(base+'/agents/class-policy', {version:nativePolicy.version, ...answers})
    revision = await policy('approval')
    const heldArgs = input(), held = pendingBonus(await wire(heldArgs), instant)
    nativePolicy = await owner(base+'/agents/pause', {version:nativePolicy.version, paused:true})
    const heldDecision = await reviewer.request.post(origin+'/agents/api/approvals/'+held.id+'/approve', {headers:{origin}, data:exact(await readApproval(held.id))})
    assert.equal(heldDecision.status(), 200)
    assert.equal((await heldDecision.json()).approval.state, 'refused', 'a current native Pause prevents pending execution')
    await unchanged(before, 'a shared policy approval cannot bypass current company authority')
    nativePolicy = await owner(base+'/agents/pause', {version:nativePolicy.version, paused:false})
    console.log('PROBE BASE-AGENT-007 native floor: shared autonomous, review and approval under native review, approval or blocked -> refusal before shared approval; approval after native Pause -> no preparation')

    // The installed integration route reaches the same decision function with
    // its own public request-key contract and the same native company floor.
    for (const disposition of ['autonomous','review','approval','blocked']) {
      revision = await policy(disposition)
      const restInput = input(31000), {companyId, idempotency_key, ...payload} = restInput
      const send = () => fetch(origin+'/api/envelope/v1/companies/'+companyId+'/bonus-runs', {method:'POST', headers:{origin, authorization:'Bearer '+credential.token, 'content-type':contentType}, body:JSON.stringify(payload)})
      const restBefore = await effects(), reviewIds = (await owner('/agents/api/reviews')).reviews.map(row=>row.id)
      let result = await send(), value = await result.json()
      const auditArgs = {...restInput, idempotency_key:'rest:envelope.bonus.prepare:'+payload.requestKey}
      if (disposition === 'blocked') {
        assert.equal(result.status, 403)
        assert.deepEqual(value, {error:'policy_blocked', class:'standard', rule:'bonus-standard', revision})
        await unchanged(restBefore, 'blocked integration call prepares nothing')
        await checkAudit(auditArgs, disposition, revision, 'refused', 'policy_blocked')
      } else {
        if (disposition === 'approval') {
          assert.equal(result.status, 403)
          assert.equal(value.error, 'approval_required')
          assert.ok(value.approval.id)
          assert.equal(Date.parse(value.approval.expires_at), Date.parse(instant)+3600000)
          await unchanged(restBefore, 'integration approval waits without native preparation')
          const saved = await readApproval(value.approval.id)
          assert.equal(saved.revision, revision)
          assert.deepEqual(saved.summary.amount, {value:310, currency:'USD'})
          assert.deepEqual(saved.summary.target, {id:person.id, name:person.name})
          await checkAudit(auditArgs, disposition, revision, 'pending')
          const approved = await reviewer.request.post(origin+'/agents/api/approvals/'+value.approval.id+'/approve', {headers:{origin}, data:exact(saved)})
          assert.equal(approved.status(), 200)
          assert.equal((await approved.json()).approval.state, 'executed')
          result = await send(); value = await result.json()
        }
        assert.equal(result.status, 201)
        const prepared = preparedBonusValue(value)
        await onePreparation(restBefore, prepared, restInput)
        const recorded = await effects(), repeated = await send()
        assert.equal(repeated.status, 201)
        assert.deepEqual(await repeated.json(), prepared)
        await unchanged(recorded, 'integration retry cannot create another preparation')
        const row = await checkAudit(auditArgs, disposition, revision, 'replayed')
        if (disposition === 'review') {
          assert.ok(row.review.id)
          const reviews = (await owner('/agents/api/reviews')).reviews
          assert.deepEqual(reviews.filter(item=>!reviewIds.includes(item.id)).map(item=>item.id), [row.review.id])
          assert.equal(reviews.find(item=>item.id===row.review.id).summary.target.id, person.id)
        }
      }
    }
    console.log('PROBE BASE-AGENT-007 6 native integration: REST bonus preparation under all four shared dispositions -> MCP-equivalent preparation, linked review, pending named-person approval or unchanged-state refusal')

    revision = await policy('autonomous'); args = input(); before = await effects()
    await onePreparation(before, preparedBonus(await wire(args)), args)
    const retained = await effects(), previousRevision = revision
    instant = '2026-10-28T13:00:59.001Z'
    assert.equal(await advanceClock(instant), instant)
    revision = await policy('blocked')
    assert.equal(revision, previousRevision+1)
    const next = input()
    response = await wire(next, {path:'/api/envelope/mcp'})
    refusedDecision(response, 'policy_blocked'); decisionMeta(response, 'blocked', revision)
    const latest = await checkAudit(next, 'blocked', revision, 'refused', 'policy_blocked')
    assert.equal(latest.at, instant, 'the very next call records the changed policy revision within 60 seconds')
    await unchanged(retained, 'the changed policy blocks the next native effect')
    console.log('PROBE BASE-AGENT-007 7 policy change: native person PUT followed immediately by alias MCP -> new blocked revision and matching audit at the controlled instant, no additional run')
  } finally { await browser.close() }
  console.log('AGENT-POLICY-DECISIONS passed: bonus dispositions, linked review, exact distinct-person approval, changed inputs, rejection, expiry, current company floor and next-revision audit; browser proof at 1440 and 390')
}
