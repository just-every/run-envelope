import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {hashToken} from '../src/modules/operator-auth/crypto.mjs'
import {ordinaryW4} from './industry-fixture.mjs'

// One public-door journey for reviewed salary reductions and their unsafe paths.
export async function commuterBenefitsJourney({origin,cookie,sql,restart,settings}) {
  const call=(path,body,who=cookie,extra={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{origin,cookie:who,'content-type':['application','json'].join('/'),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data=async(path,body,status=200)=>{const r=await call(path,body);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const company=await data('/api/envelope/companies',{name:'Synthetic benefits employer',ein:'00-0009101'},201)
  const base='/api/envelope/companies/'+company.id
  const location=await data(base+'/locations',{name:'Texas workplace',state:'TX'},201)
  const person=await data(base+'/people',{name:'Synthetic benefit participant',locationId:location.id},201)
  const door=base+'/people/'+person.id+'/pretax-benefits',previewDoor=base+'/calculation-preview'
  const fixture={edition:'2026-01',payDate:'2026-10-30',from:'2026-10-19',through:'2026-10-25',frequency:'weekly',workState:'TX',residentState:'TX',locality:'none',
    remuneration:{kind:'salary',exempt:true,cashCents:100000},w4:ordinaryW4,stateElection:{},
    yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[]}
  const approve=async(collection,id)=>{const r=await data(door+'/'+collection+'/'+id+'/review');await data(door+'/'+collection+'/'+id+'/decision',{version:r.version,reviewToken:r.reviewToken});return r}
  const election=(category,taxYear=2026,extra={})=>({category,taxYear,version:0,electedOn:taxYear+'-01-01',effectiveFrom:taxYear+'-01-01',effectiveThrough:taxYear+'-12-31',electedCents:category==='dependent-care'?800000:100000,evidenceReference:'synthetic-envelope-election-9101',...extra})
  const accumulator=(category,taxYear=2026,entries=[],extra={})=>({category,taxYear,version:0,through:taxYear+'-10-15',entries,evidenceReference:'synthetic-envelope-opening-register-9102',...extra})
  const prior=(date,amount,excluded=amount,deducted=amount)=>({date,sourceId:'synthetic-envelope-'+date,benefitCents:amount,excludedCents:excluded,deductionCents:deducted})
  const save=async(collection,input)=>{const row=await data(door+'/'+collection,input,201);await approve(collection,row.id);return row}
  const request=(category,amountCents,electionVersion=1,accumulatorVersion=1)=>({category,amountCents,electionVersion,accumulatorVersion})
  const input=(requests,extra={})=>({...fixture,benefits:{personId:person.id,sourceId:'synthetic-envelope-proposal-9110',requests},...extra})
  assert.deepEqual(await data(door),{elections:[],accumulators:[]})
  const transit=await data(door+'/elections',election('transit'),201)
  await save('accumulators',accumulator('transit',2026,[prior('2026-10-15',20000)]))
  assert.equal((await call(previewDoor,input([request('transit',20000)]))).status,409,'An unreviewed election cannot change taxable wages')
  assert.equal((await call(door+'/elections/'+transit.id+'/decision',{version:1,reviewToken:'synthetic-envelope-forged-review'})).status,409)
  await approve('elections',transit.id)
  await save('elections',election('parking'))
  await save('accumulators',accumulator('parking'))
  const requests=[request('transit',20000),request('parking',40000)]
  const split=await data(previewDoor,input(requests))
  assert.deepEqual(split.benefits.rows.map(r=>[r.category,r.proposedPretaxDeductionCents,r.taxableExcessCents,r.remainingExclusionCents]),
    [['transit',14000,6000,0],['parking',34000,6000,0]],'IRS 2026 independent monthly categories: prior $200 transit leaves $140; parking retains its own $340')
  assert.equal(split.benefits.proposedDeductionCents,60000)
  assert.equal(split.benefits.federalWageReductionCents,48000)
  assert.deepEqual(split.federal.wages,{incomeTaxWagesCents:52000,w2Box1WagesCents:52000,socialSecurityWagesCents:52000,medicareWagesCents:52000,additionalMedicareWagesCents:0,futaWagesCents:52000})
  assert.equal(split.federal.employeeTaxes.socialSecurityCents,3224)
  assert.equal(split.federal.employeeTaxes.medicareCents,754)
  assert.equal(split.federalEmployerTaxes.futaCents,3120)
  assert.equal(split.state.withholdingCents,null);assert.equal(split.sui,null);assert.equal(split.netCashCents,null)
  assert.equal(split.paymentReady,false);assert.equal(split.dispatch,'unavailable')
  assert.ok(split.holds.some(h=>h.code==='benefit-eligibility-review-required'))
  assert.ok(split.holds.some(h=>h.code==='state-withholding-unmapped'))
  assert.ok(split.benefits.rows.every(r=>r.source.title==='IRS Publication 15-B (2026)'&&r.source.url.includes('irs.gov')))
  assert.equal(split.benefits.collected,false);assert.equal(split.benefits.reimbursed,false);assert.equal(split.benefits.remitted,false)
  const beforeReplay=await data(door)
  assert.deepEqual(await data(previewDoor,input(requests)),split)
  await restart()
  assert.deepEqual(await data(previewDoor,input(requests)),split,'Restart and replay use retained reviewed totals without recording another deduction')
  assert.deepEqual(await data(door),beforeReplay)
  const november=await data(previewDoor,input([request('transit',34001),request('parking',34001)],{from:'2026-11-02',through:'2026-11-08',payDate:'2026-11-13'}))
  assert.deepEqual(november.benefits.rows.map(r=>[r.proposedPretaxDeductionCents,r.taxableExcessCents]),[[34000,1],[34000,1]],'Monthly allowances reset without carrying unused allowance forward')
  // The cap is shared with employer benefits too: prior $100 employer parking
  // was excluded even though no salary deduction was collected.
  await save('accumulators',accumulator('parking',2026,[prior('2026-10-15',10000,10000,0)],{version:1}))
  const employer=await data(previewDoor,input([request('parking',30000,1,2)]))
  assert.deepEqual([employer.benefits.rows[0].proposedPretaxDeductionCents,employer.benefits.rows[0].taxableExcessCents],[24000,6000])
  // An actual completed first period is imported explicitly; merely preparing
  // it above did not turn a proposal into collection evidence.
  await save('accumulators',accumulator('transit',2026,[prior('2026-10-15',20000),prior('2026-10-23',20000,14000)],{version:1,through:'2026-10-23'}))
  const exhausted=await data(previewDoor,input([request('transit',10000,1,2)]))
  assert.deepEqual([exhausted.benefits.rows[0].proposedPretaxDeductionCents,exhausted.benefits.rows[0].taxableExcessCents],[0,10000])
  const staleReview=await data(door+'/elections',election('transit',2026,{version:1,electedCents:90000}),201)
  const review=await data(door+'/elections/'+staleReview.id+'/review')
  await data(door+'/elections',election('transit',2026,{version:2,electedCents:80000}),201)
  assert.equal((await call(door+'/elections/'+staleReview.id+'/decision',{version:2,reviewToken:review.reviewToken})).status,409,'Correcting the election invalidates pending exact review')
  assert.equal((await call(previewDoor,input([request('transit',10000,1,2)]))).status,409)
  await approve('elections',staleReview.id)
  assert.equal((await call(previewDoor,input([request('transit',10000,1,2)]))).status,409,'Old source pins cannot silently select a newly approved election')
  assert.equal((await data(previewDoor,input([request('transit',10000,3,2)]))).benefits.rows[0].election.version,3)
  const facts={filingStatus:'married-joint',employeeEarnedIncomeCents:5000000,spouseEarnedIncomeCents:5000000,otherExcludedCents:0}
  await save('elections',election('dependent-care',2026,{dependentCare:facts}))
  await save('accumulators',accumulator('dependent-care',2026,[prior('2026-10-15',740000)]))
  const dependent=await data(previewDoor,input([request('dependent-care',20000)]))
  assert.deepEqual([dependent.benefits.rows[0].proposedPretaxDeductionCents,dependent.benefits.rows[0].taxableExcessCents,dependent.benefits.rows[0].proposedW2Box10Cents],[10000,10000,760000],
    'IRS 2026: $7,400 previously excluded plus $200 yields $100 taxable excess and $7,600 proposed Box 10')
  await save('elections',election('dependent-care',2026,{version:1,dependentCare:{...facts,filingStatus:'married-separate'}}))
  await save('accumulators',accumulator('dependent-care',2026,[prior('2026-10-15',370000)],{version:1}))
  const separate=await data(previewDoor,input([request('dependent-care',10000,2,2)]))
  assert.deepEqual([separate.benefits.rows[0].proposedPretaxDeductionCents,separate.benefits.rows[0].taxableExcessCents],[5000,5000],'2026 married filing separately has its own $3,750 annual ceiling')
  await save('elections',election('dependent-care',2026,{version:2,dependentCare:{...facts,employeeEarnedIncomeCents:500000,spouseEarnedIncomeCents:400000,otherExcludedCents:25000}}))
  const incomeLimited=await data(previewDoor,input([request('dependent-care',10000,3,2)]))
  assert.deepEqual([incomeLimited.benefits.rows[0].effectiveLimitCents,incomeLimited.benefits.rows[0].proposedPretaxDeductionCents],[400000,5000],'Spouse earnings and other excluded household benefits reduce the available exclusion')
  const historical={edition:'2025-01',from:'2025-10-20',through:'2025-10-26',payDate:'2025-10-30'}
  await save('elections',election('transit',2025));await save('accumulators',accumulator('transit',2025))
  await save('elections',election('dependent-care',2025,{dependentCare:facts}));await save('accumulators',accumulator('dependent-care',2025,[prior('2025-10-15',490000)]))
  const old=await data(previewDoor,input([request('transit',34000),request('dependent-care',20000)],historical))
  assert.deepEqual(old.benefits.rows.map(r=>[r.proposedPretaxDeductionCents,r.taxableExcessCents]),[[32500,1500],[10000,10000]],'The 2025 rules remain $325 monthly and $5,000 annually')
  await save('elections',election('dependent-care',2025,{version:1,dependentCare:{...facts,filingStatus:'married-separate'}}))
  const priorExcess=await data(previewDoor,input([request('dependent-care',0,2,1)],historical))
  assert.equal(priorExcess.benefits.rows[0].priorExcessRequiringCorrectionCents,240000)
  assert.ok(priorExcess.holds.some(h=>h.code==='prior-benefit-excess-correction-required'))
  const unchanged=await data(door)
  for(const bad of [election('parking',2026,{version:1,electedOn:'2026-02-01'}),election('dependent-care',2027,{dependentCare:facts})])
    assert.equal((await call(door+'/elections',bad)).status,400)
  const duplicate=prior('2026-10-15',100)
  assert.equal((await call(door+'/accumulators',accumulator('parking',2026,[duplicate,duplicate],{version:2}))).status,409)
  assert.equal((await call(previewDoor,input([request('parking',100001,1,2)]))).status,409)
  assert.equal((await call(previewDoor,input([request('parking',100,1,2),request('parking',100,1,2)]))).status,400)
  assert.equal((await call(previewDoor,input([request('parking',100,1,2)],{payDate:'2026-10-14'}))).status,409)
  assert.deepEqual(await data(door),unchanged,'Refused corrections and previews change no retained source or decision')
  const foreign=await data('/api/envelope/companies',{name:'Synthetic separate employer',ein:'00-0009102'},201)
  assert.equal((await call(door.replace(company.id,foreign.id))).status,404)
  assert.equal((await call('/api/envelope/companies/'+foreign.id+'/calculation-preview',input([request('parking',100,1,2)]))).status,404)
  assert.equal((await call(door,undefined,'')).status,401)
  assert.equal((await call(door+'/elections',election('parking'),cookie,{authorization:'Bearer synthetic-envelope-9103'})).status,403)
  const member='synthetic-envelope-benefit-member',token=randomBytes(32).toString('base64url'),hashed=await hashToken(settings.SESSION_SECRET,'session',token),now=Date.now()
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic benefit preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now+3600000})`)
  await data(base+'/grants',{operatorId:member,version:0,role:'payroll-admin',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose','rates:approve','private:read','private:write']})
  const memberCookie=cookie.split('=')[0]+'='+token
  assert.equal((await call(door,undefined,memberCookie)).status,403)
  assert.equal((await call(door+'/accumulators',accumulator('parking'),memberCookie)).status,403)
  const owner=(await sql(`SELECT s.id,g.version FROM oa_sessions s JOIN env_grants g ON g.operator_id=s.operator_id WHERE g.company_id='${company.id}' AND g.role='owner'`))[0]
  await sql(`UPDATE env_grants SET revoked_at=1 WHERE company_id='${company.id}' AND role='owner'`)
  assert.equal((await call(previewDoor,input([request('parking',100,1,2)]))).status,401,'Revoking the grant revokes existing sessions too')
  await sql(`UPDATE oa_sessions SET revoked_at=NULL WHERE id='${owner.id}'`)
  assert.equal((await call(previewDoor,input([request('parking',100,1,2)]))).status,403)
  assert.equal((await call(door+'/elections',election('parking',2026,{version:1}))).status,403)
  await sql(`UPDATE env_grants SET revoked_at=NULL WHERE company_id='${company.id}' AND role='owner'`)
  assert.equal((await call(door)).status,401,'Regranting alone never resurrects a revoked session')
  await sql(`UPDATE oa_sessions SET revoked_at=NULL WHERE id='${owner.id}'`)
  const stored=await sql(`SELECT cipher FROM env_workspace_versions WHERE company_id='${company.id}'`)
  assert.ok(stored.length>10);assert.ok(stored.every(r=>!r.cipher.includes('synthetic-envelope-election-9101')&&!r.cipher.includes('employeeEarnedIncomeCents')))
  const audit=await data(base+'/audit')
  for(const action of ['workspace.pretax-election.recorded','workspace.pretax-election.approved','workspace.pretax-accumulator.read'])
    assert.ok(audit.some(e=>e.action===action&&e.actorId&&e.version),'Attributed evidence and review audit: '+action)
  console.log('COMMUTER-BENEFITS passed: reviewed dated salary reductions, independent IRS boundaries, corrected sources, replay, restart and current authority')
}
