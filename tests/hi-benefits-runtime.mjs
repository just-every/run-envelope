import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { ordinaryW4 } from './industry-fixture.mjs'
import { privateValue } from './privacy-recorder.mjs'

// One native-door money sanity journey. Expected amounts are worked from the
// DLIR 2026 notice and PHC cost-sharing instructions, independently of rule data.
export async function hiBenefitsJourney({ origin, cookie, sql, settings, restart }) {
  const call = (path, body, who = cookie) => fetch(origin + path, { method:body === undefined ? 'GET' : 'POST', redirect:'manual',
    headers:{cookie:who, origin, 'content-type':['application','json'].join('/')}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) })
  const data = async (path, body, status = 200, who = cookie) => {
    const r = await call(path,body,who); assert.equal(r.status,status,path+' '+await r.clone().text()); return r.json()
  }
  privateValue('synthetic-envelope-9303')
  privateValue('Synthetic signed wage register for the exact proposed periods')
  const company = await data('/api/envelope/companies',{name:'Synthetic Hawaii employer',ein:'00-0009301'},201)
  const base = '/api/envelope/companies/'+company.id
  const location = await data(base+'/locations',{name:'Honolulu workplace',state:'HI'},201)
  const person = await data(base+'/people',{name:'Synthetic Hawaii worker',locationId:location.id},201)
  const door = base+'/people/'+person.id+'/hi-benefits'
  const premium = (period, extra = {}) => ({period,premiumCents:2000,dependentPremiumCents:0,grossBeforeCents:0,employeeBeforeCents:0,dependentEmployeeBeforeCents:0,
    evidence:'synthetic-envelope-9302 retained insurer invoice',accumulatorEvidence:'Reviewed opening register: no prior collected share or wages',...extra})
  const plan = (id, program, extra = {}) => ({id,version:0,program,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',ruleYear:2026,
    source:{kind:'insurer',reference:'synthetic-envelope-9303',evidence:'Retained source packet for native review; authenticity remains unverified.'},
    approvalEvidence:'Synthetic approved-plan designation document retained as evidence only',eligibility:'eligible',eligibilityEvidence:'Synthetic documented eligibility; not an independent coverage determination',
    employeeBasisPoints:5000,planType:program === 'tdi' ? 'tdi' : '7b',dependentEmployerBasisPoints:program === 'tdi' ? 10000 : 5000,
    waiver:null,premiums:program === 'tdi' ? [premium('2026-10-05'),premium('2026-10-12')] : [premium('2026-10',{premiumCents:60000,dependentPremiumCents:20000})],...extra})
  const approve = async id => {const review=await data(door+'/plans/'+id+'/review');await data(door+'/plans/'+id+'/approve',{version:review.version,reviewToken:review.reviewToken});return review}
  const save = async input => {await data(door+'/plans',input,201);await approve(input.id);return input}
  const tdi = await save(plan('synthetic-envelope-tdi','tdi'))
  const phc = await save(plan('synthetic-envelope-phc','phc'))
  const period = (grossCents, extra = {}) => ({from:'2026-10-05',through:'2026-10-11',payDate:'2026-10-16',weekFrom:'2026-10-05',grossCents,...extra})
  let sequence = 0
  const request = (p, periods, extra = {}) => ({id:'synthetic-envelope-hi-preview-'+(++sequence),version:0,personId:person.id,planId:p.id,planVersion:p.version+1,
    wageEvidence:'Synthetic signed wage register for the exact proposed periods',periods,...extra})
  const preview = (p, periods, extra = {}) => data(door+'/preview',request(p,periods,extra),201)
  const refuse = async (path, body, code, status = 409, who = cookie) => {
    const before = await sql('SELECT COUNT(*) AS n FROM env_workspace_versions')
    const r = await call(path,body,who);assert.equal(r.status,status,await r.clone().text());assert.equal((await r.json()).error,code)
    assert.deepEqual(await sql('SELECT COUNT(*) AS n FROM env_workspace_versions'),before,'A refused share or access attempt writes no business version')
  }
  // $100 at 0.5% = $0.50. $2,000 hits the retained 2026 $7.50
  // weekly ceiling. The actual $20 cost still requires at least $12.50 employer funding.
  const low = await preview(tdi,[period(10000)]), high = await preview(tdi,[period(200000)])
  assert.equal(low.proposedEmployeeCents,50);assert.equal(low.periods[0].employerRemainingPremiumCents,1950)
  assert.equal(high.proposedEmployeeCents,750);assert.equal(high.periods[0].employerRemainingPremiumCents,1250)
  assert.equal(high.coverageVerified,false);assert.equal(high.collectedCents,0);assert.equal(high.paymentReady,false);assert.equal(high.remittance,'unavailable')
  assert.equal(high.ruleYear,2026);assert.match(high.sources.year2026,/2026-Maximum-Weekly-Wage-Base\.pdf$/)
  const biweekly = await preview(tdi,[period(10000),period(200000,{from:'2026-10-12',through:'2026-10-18',payDate:'2026-10-23',weekFrom:'2026-10-12'})])
  assert.equal(biweekly.proposedEmployeeCents,800)
  const split = await preview(tdi,[period(100000,{through:'2026-10-07'}),period(100000,{from:'2026-10-08',payDate:'2026-10-16'})])
  assert.deepEqual(split.periods.map(p=>p.proposedEmployeeCents),[500,250]);assert.equal(split.proposedEmployeeCents,750)
  await refuse(door+'/preview',request(tdi,[period(200000,{requestedEmployeeCents:751})]),'hi_requested_share_above_cap')
  await refuse(door+'/plans',plan('synthetic-envelope-tdi-illegal','tdi',{employeeBasisPoints:5001}),'hi_unlawful_cost_share')
  const cost = await save(plan('synthetic-envelope-tdi-cost','tdi',{premiums:[premium('2026-10-05',{premiumCents:40})]}))
  assert.equal((await preview(cost,[period(200000)])).proposedEmployeeCents,20)
  const prior = await save(plan('synthetic-envelope-tdi-prior','tdi',{premiums:[premium('2026-10-05',{grossBeforeCents:100000,employeeBeforeCents:500})]}))
  assert.equal((await preview(prior,[period(100000)])).proposedEmployeeCents,250)
  // PHC employee-only premium uses its own monthly wage and cost ceiling.
  // Dependent cost is separately allocated under the actual plan designation.
  const monthly = await preview(phc,[period(100000),period(100000,{from:'2026-10-12',through:'2026-10-18',payDate:'2026-10-23'})])
  assert.deepEqual(monthly.periods.map(p=>p.proposedEmployeeCents),[1500,1500])
  assert.equal(monthly.periods[1].cumulativeEmployeeCents,3000);assert.equal(monthly.periods[1].employerRemainingPremiumCents,57000)
  assert.deepEqual(monthly.periods.map(p=>p.proposedDependentCents),[10000,0]);assert.equal(monthly.periods[1].employerRemainingDependentPremiumCents,10000)
  assert.equal((await preview(phc,[period(3000000)])).proposedEmployeeCents,30000)
  await refuse(door+'/preview',request(phc,[period(100000,{requestedEmployeeCents:1501})]),'hi_requested_share_above_cap')
  await refuse(door+'/preview',request(phc,[period(100000,{requestedDependentCents:10001})]),'hi_requested_share_above_cap')
  const a = await save(plan('synthetic-envelope-phc-a','phc',{planType:'7a',dependentEmployerBasisPoints:0}))
  assert.equal((await preview(a,[period(100000)])).proposedDependentCents,20000)
  await refuse(door+'/plans',plan('synthetic-envelope-phc-illegal','phc',{dependentEmployerBasisPoints:4999}),'hi_plan_allocation_required')
  const free = await save(plan('synthetic-envelope-phc-employer','phc',{employeeBasisPoints:0,dependentEmployerBasisPoints:10000}))
  const employer = await preview(free,[period(100000)])
  assert.equal(employer.proposedEmployeeCents,0);assert.equal(employer.proposedDependentCents,0);assert.equal(employer.periods[0].employerRemainingPremiumCents,60000)
  // Evidence gaps and waiver expiry remain owned correction work, never coverage.
  await refuse(door+'/preview',request({...tdi,id:'synthetic-envelope-missing'},[period(10000)]),'record_not_found',404)
  await refuse(door+'/preview',request(tdi,[period(10000,{weekFrom:'2026-10-19',from:'2026-10-19',through:'2026-10-25',payDate:'2026-10-30'})]),'hi_premium_evidence_missing')
  const unresolved = await save(plan('synthetic-envelope-tdi-unresolved','tdi',{eligibility:'unresolved'}))
  await refuse(door+'/preview',request(unresolved,[period(10000)]),'hi_eligibility_evidence_required')
  const waived = await save(plan('synthetic-envelope-phc-waiver','phc',{eligibility:'waived',waiver:{form:'HC-5',year:2026,from:'2026-01-01',through:'2026-09-30',evidence:'Retained HC-5 with expired alternative coverage'}}))
  await refuse(door+'/preview',request(waived,[period(100000)]),'hi_hc5_expired_or_inapplicable')
  await refuse(door+'/plans',plan('synthetic-envelope-old-year','tdi',{ruleYear:2025}),'hi_rule_year_unavailable')
  const currentWaiver = await save({...waived,version:1,correctionReason:'Replacement annual HC-5 evidence reviewed',waiver:{...waived.waiver,through:'2026-12-31'}})
  const waiverPreview = await preview(currentWaiver,[period(100000)])
  assert.equal(waiverPreview.proposedEmployeeCents,0);assert.equal(waiverPreview.proposedDependentCents,0)
  assert.equal(waiverPreview.periods[0].employerRemainingPremiumCents,null);assert.equal(waiverPreview.coverageVerified,false)
  await refuse(door+'/preview',request(currentWaiver,[period(100000,{requestedEmployeeCents:1})]),'hi_requested_share_above_cap')
  // Review binds the exact evidence version. A changed invoice invalidates
  // pending proposals while preserving their original amounts and sources.
  const pending = plan('synthetic-envelope-tdi-pending','tdi')
  await data(door+'/plans',pending,201)
  await refuse(door+'/preview',request(pending,[period(10000)]),'hi_exact_review_required')
  const stale = await data(door+'/plans/'+pending.id+'/review')
  await data(door+'/plans',{...pending,version:1,correctionReason:'Corrected source invoice',premiums:[premium('2026-10-05',{premiumCents:100})]},201)
  await refuse(door+'/plans/'+pending.id+'/approve',{version:stale.version,reviewToken:stale.reviewToken},'review_stale')
  await approve(pending.id)
  assert.equal((await preview({...pending,version:1},[period(200000)])).proposedEmployeeCents,50)
  const replay = request(tdi,[period(10000)])
  await data(door+'/preview',replay,201)
  await refuse(door+'/preview',replay,'input_or_authority_changed')
  await data(door+'/plans',{...tdi,version:1,correctionReason:'Invoice correction lowers actual cost',premiums:[premium('2026-10-05',{premiumCents:100})]},201)
  const history = await data(door)
  assert.equal(history.previews.find(p=>p.id===high.id).sourcesCurrent,0)
  assert.equal(history.previews.find(p=>p.id===high.id).data.proposedEmployeeCents,750)
  await refuse(door+'/preview',request(tdi,[period(10000)]),'hi_exact_review_required')
  await approve(tdi.id)
  const corrected = await preview({...tdi,version:1},[period(200000)])
  assert.equal(corrected.proposedEmployeeCents,50)
  // The existing calculation-preview door resolves evidence references itself;
  // client-supplied amounts cannot replace its gross wages or state holds.
  const calc = {edition:'2026-01',payDate:'2026-10-16',from:'2026-10-05',through:'2026-10-11',frequency:'weekly',workState:'HI',residentState:'HI',locality:'none',
    remuneration:{kind:'salary',exempt:true,cashCents:100000},w4:ordinaryW4,stateElection:{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},
    yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[],
    hiBenefits:request({...tdi,version:1},[period(100000)])}
  const calculation = await data(base+'/calculation-preview',calc)
  assert.equal(calculation.hiBenefits.proposedEmployeeCents,50);assert.equal(calculation.status,'held');assert.equal(calculation.netCashCents,null)
  assert.ok(calculation.holds.some(h=>h.code==='state-programs-unmapped'));assert.equal(calculation.paymentReady,false)
  await refuse(base+'/calculation-preview',{...calc,hiBenefits:request({...tdi,version:1},[period(10000)])},'hi_calculation_wages_mismatch')
  const beforeRestart = await data(door)
  await restart()
  assert.deepEqual(await data(door),beforeRestart,'Encrypted evidence, versions, decisions and proposed amounts survive restart without collecting funds')
  // Current sessions and company scope are required on every new door.
  const foreign = await data('/api/envelope/companies',{name:'Other synthetic employer',ein:'00-0009302'},201)
  await refuse('/api/envelope/companies/'+foreign.id+'/people/'+person.id+'/hi-benefits',undefined,'record_not_found',404)
  assert.equal((await call(door,undefined,'')).status,401)
  const native = (await sql("SELECT id,operator_id,operator_version FROM oa_sessions WHERE revoked_at IS NULL ORDER BY created_at LIMIT 1"))[0]
  const member = 'synthetic-envelope-hi-member', now=Date.now(), token=randomBytes(32).toString('base64url')
  const hash=await hashToken(settings.SESSION_SECRET,'session',token), memberCookie=cookie.split('=')[0]+'='+token
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic benefits preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hash}','${member}',1,'native',${now},${now+3600000})`)
  await data(base+'/grants',{operatorId:member,version:0,role:'preparer',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose','rates:approve']})
  for (const [path, body] of [[door,undefined],[door+'/plans',tdi],[door+'/plans/'+tdi.id+'/review',undefined],[door+'/plans/'+tdi.id+'/approve',{version:2,reviewToken:'synthetic-envelope-9304'}],[door+'/preview',request(phc,[period(100000)])]]) {
    assert.equal((await call(path,body,memberCookie)).status,403)
  }
  await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${member}'`)
  assert.equal((await call(door,undefined,memberCookie)).status,401)
  const ownerToken=randomBytes(32).toString('base64url'), ownerHash=await hashToken(settings.SESSION_SECRET,'session',ownerToken)
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-hi-owner','${ownerHash}','${native.operator_id}',${native.operator_version},'native',${now},${now+3600000})`)
  const ownerCookie=cookie.split('=')[0]+'='+ownerToken
  assert.equal((await call(door,undefined,ownerCookie)).status,200)
  await sql("UPDATE oa_sessions SET revoked_at=1 WHERE id='synthetic-envelope-hi-owner'")
  assert.equal((await call(door,undefined,ownerCookie)).status,401)
  assert.equal((await call(door+'/preview',request(phc,[period(100000)]),ownerCookie)).status,401)
  const audit = await data(base+'/audit')
  for (const action of ['workspace.hi-benefit-plan.recorded','workspace.hi-benefit-plan.reviewed','workspace.hi-benefit-plan.approved','workspace.hi-benefit-preview.recorded']) {
    const event = audit.find(e=>e.action===action)
    assert.ok(event,action);assert.equal(event.actorId,native.operator_id);assert.ok(event.occurredAt);assert.ok(event.version)
  }
  const stored=JSON.stringify(await sql("SELECT cipher FROM env_workspace_versions WHERE kind IN ('hi-benefit-plan','hi-benefit-preview')"))
  assert.ok(!stored.includes('synthetic-envelope-9303'));assert.ok(!stored.includes('Synthetic signed wage register'))
  // The native privacy inventory owns these new encrypted records too. An
  // explicit lawful synthetic release erases them; stale capture replay fails.
  const privacy = base+'/people/'+person.id+'/privacy'
  const inventory = await data(privacy)
  assert.ok(inventory.retained.some(r=>r.table==='env_workspace_versions' && r.key.object_id===tdi.id))
  assert.ok(inventory.retained.some(r=>r.table==='env_workspace_versions' && r.key.object_id===high.id))
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('synthetic-envelope-hi-proof','synthetic-envelope-9305','${native.id}','${native.operator_id}',${native.operator_version},'credentials:mint','/app',${Date.now()},${Date.now()+600000},${Date.now()})`)
  const select={fingerprint:inventory.fingerprint,records:inventory.retained.map(r=>r.id),consent:true,
    legalBasis:'Synthetic reviewed release of test evidence; no actual statutory hold',custodian:'Native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
  await data(privacy+'/request',{consent:true,fingerprint:inventory.fingerprint})
  await data(privacy+'/retain',select)
  await data(privacy+'/release',select)
  await data(base+'/people/'+person.id+'/erase',{version:inventory.version,...select})
  assert.equal((await call(door)).status,404)
  assert.equal((await call(door+'/plans',tdi)).status,404)
  assert.equal((await call(door+'/preview',replay)).status,404)
  const remaining=await sql(`SELECT COUNT(*) AS n FROM env_workspace_versions WHERE company_id='${company.id}' AND kind IN ('hi-benefit-plan','hi-benefit-preview')`)
  assert.equal(remaining[0].n,0,'Eligible erasure removes every retained plan version and proposed share')
  console.log('HI-BENEFITS passed: reviewed source-bound weekly and monthly caps, dependent allocations, exact corrections, unsafe refusals, replay, encrypted restart and current company authority; no coverage or remittance claim.')
}
