import { privateValue } from './privacy-recorder.mjs'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { ordinaryW4 } from './industry-fixture.mjs'

// One company benefit preparation journey. Expected cents below come from IRS
// Notice 2025-67, Notice 2024-80, Publication 571 worksheets and W-2 instructions.
// They are independent of the application's limit table and reporting mapping.
export async function extendedRetirementJourney({origin,cookie,sql,settings,restart}) {
  const call=(path,body,who=cookie,extra={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':['application','json'].join('/'),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data=async(path,body,status=200,who=cookie)=>{const r=await call(path,body,who);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const company=await data('/api/envelope/companies',{name:'Synthetic extended retirement employer',ein:'00-0009201'},201)
  const base='/api/envelope/companies/'+company.id
  const location=await data(base+'/locations',{name:'Texas workplace',state:'TX'},201)
  const worker=await data(base+'/people',{name:'Synthetic retirement employee',locationId:location.id},201)
  const door=base+'/people/'+worker.id+'/benefits/extended-retirement'
  let serial=0
  const initial={arrangement:'403b',year:2026,effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',eligible:true,workerKind:'employee',employerType:'501c3',compensationCents:20000000,
    ageAtYearEnd:55,priorYearFicaWagesCents:10000000,allowsRoth:true,allowsAgeCatchUp:true,
    planReference:'synthetic-envelope-9202 signed plan permits stated elections',electionReference:'synthetic-envelope-9203 signed employee election',eligibilityReference:'synthetic-envelope-9204 nonprofit employment and qualified service',accumulatorReference:'synthetic-envelope-9205 reconciled opening register',aggregationReference:'synthetic-envelope-9206 all shared elective plans and controlled-business additions reviewed',
    opening:{electiveCents:0,planElectiveCents:0,serviceCents:0,ageCents:0,annualAdditionsCents:0},
    service:{enabled:true,qualifyingEmployer:'school',yearsOfService:15,lifetimeUsedBeforeYearCents:0,employerDeferralsBeforeYearCents:7000000}}
  for(const key of ['planReference','electionReference','eligibilityReference','accumulatorReference','aggregationReference'])privateValue(initial[key])
  const save=async(input,approve=true)=>{
    const body={...input,id:input.id??'synthetic-envelope-retirement-'+(++serial),version:input.version??0}
    const r=await data(door,body,201)
    if(approve){const reviewed=await data(door+'/review/'+r.id);assert.equal(reviewed.data.planReference,body.planReference);await data(door+'/decision/'+r.id,{version:r.version,reviewToken:reviewed.reviewToken})}
    return {...r,body}
  }
  const request=(traditionalCents,rothCents=0,employerCents=0,payDate='2026-10-30')=>({payDate,traditionalCents,rothCents,employerCents})
  const body=(setup,r,extra={})=>({id:'synthetic-envelope-proposal-'+(++serial),version:0,setupId:setup.id,setupVersion:setup.version,request:r,...extra})
  const preview=async(setup,r)=>data(door+'/preview',body(setup,r),201)
  const unchanged=async(fn)=>{const before=await data(door);await fn();assert.deepEqual(await data(door),before,'Refused preparation changes no retained setup, proposal, source or decision')}
  const refused=async(setup,r,error)=>unchanged(async()=>assert.deepEqual(await data(door+'/preview',body(setup,r),400),{error}))

  const s=await save(initial)
  const max=await preview(s,request(2750000,800000,4450000))
  assert.deepEqual(max.result.allocation,{ordinaryCents:2450000,serviceCents:300000,ageCents:800000,specialCents:0})
  assert.deepEqual(max.result.reporting.box12,[{code:'E',amountCents:2750000},{code:'BB',amountCents:800000}])
  assert.equal(max.result.annualLimitCents,7200000)
  assert.equal(max.result.sources.year,2026);assert.match(max.result.sources.notice,/n-25-67\.pdf$/)
  assert.equal(max.result.employeeDeductionCents,0);assert.equal(max.result.collectedCents,0);assert.equal(max.result.providerAcceptance,'unavailable')
  await refused(s,request(2750001,800000),'combined_403b_elective_limit_exceeded')
  await refused(s,request(2750000,800000,4450001),'combined_annual_additions_limit_exceeded')
  const y25=await save({...initial,year:2025,effectiveFrom:'2025-01-01',effectiveThrough:'2025-12-31'})
  const old=await preview(y25,request(2650000,750000,4350000,'2025-10-30'))
  assert.deepEqual(old.result.allocation,{ordinaryCents:2350000,serviceCents:300000,ageCents:750000,specialCents:0})
  assert.equal(old.result.annualLimitCents,7000000);assert.match(old.result.sources.notice,/n-24-80\.pdf$/)
  await refused(y25,request(2650000,750001,0,'2025-10-30'),'combined_403b_elective_limit_exceeded')
  const superAge=await save({...initial,ageAtYearEnd:61})
  assert.equal((await preview(superAge,request(2750000,1125000))).result.allocation.ageCents,1125000)
  const highIncome=await save({...initial,priorYearFicaWagesCents:15000001})
  await refused(highIncome,request(3550000),'age_catch_up_must_be_roth')
  assert.equal((await preview(highIncome,request(2750000,800000))).result.rothCents,800000)
  const threshold=await save({...initial,priorYearFicaWagesCents:15000000})
  assert.equal((await preview(threshold,request(3550000))).result.allocation.ageCents,800000)
  // The remaining lifetime and service formula, not a fixed extra allowance,
  // limits the first catch-up before any age catch-up can be allocated.
  const exhausted=await save({...initial,service:{...initial.service,lifetimeUsedBeforeYearCents:1400000,employerDeferralsBeforeYearCents:7480000}})
  const limited=await preview(exhausted,request(2470000,800000))
  assert.deepEqual(limited.result.allocation,{ordinaryCents:2450000,serviceCents:20000,ageCents:800000,specialCents:0})
  await refused(exhausted,request(2470001,800000),'combined_403b_elective_limit_exceeded')
  const shared=await save({...initial,allowsAgeCatchUp:false,service:{...initial.service,enabled:false},opening:{electiveCents:2400000,planElectiveCents:1000000,serviceCents:0,ageCents:0,annualAdditionsCents:1000000}})
  assert.equal((await preview(shared,request(50000))).result.employeeElectiveCents,50000)
  await refused(shared,request(50001),'combined_403b_elective_limit_exceeded')
  const noAge=await save({...initial,ageAtYearEnd:49,service:{...initial.service,enabled:false}})
  await refused(noAge,request(2450001),'combined_403b_elective_limit_exceeded')

  const {service,...withoutService}=initial
  const gov={...withoutService,arrangement:'governmental-457b',employerType:'government',catchUpMode:'special',special:{enabled:true,normalRetirementAge:57,unusedDeferralsCents:1200000},opening:{contributionsCents:0,ageCents:0,specialCents:0}}
  const g=await save(gov)
  const special=await preview(g,request(3650000))
  assert.deepEqual(special.result.allocation,{ordinaryCents:2450000,serviceCents:0,ageCents:0,specialCents:1200000})
  assert.deepEqual(special.result.reporting.box12,[{code:'G',amountCents:3650000}])
  await refused(g,request(3650001),'combined_457_contribution_limit_exceeded')
  const twice=await save({...gov,special:{...gov.special,unusedDeferralsCents:10000000}})
  assert.equal((await preview(twice,request(4900000))).result.employeeElectiveCents,4900000)
  await refused(twice,request(4900001),'combined_457_contribution_limit_exceeded')
  const age=await save({...gov,ageAtYearEnd:61,catchUpMode:'age'})
  const roth=await preview(age,request(2450000,1125000))
  assert.deepEqual(roth.result.reporting.box12,[{code:'G',amountCents:2450000},{code:'EE',amountCents:1125000}])
  assert.equal(roth.result.allocation.specialCents,0)
  await refused(age,request(2450000,1125001),'combined_457_contribution_limit_exceeded')
  const prior457=await save({...gov,catchUpMode:'none',opening:{contributionsCents:2400000,ageCents:0,specialCents:0}})
  assert.deepEqual((await preview(prior457,request(20000,10000,20000))).result.reporting.box12,[{code:'G',amountCents:40000},{code:'EE',amountCents:10000}])
  await refused(prior457,request(20000,10000,20001),'combined_457_contribution_limit_exceeded')
  const nongov=await save({...gov,arrangement:'nongovernmental-457b',employerType:'tax-exempt',allowsAgeCatchUp:false,allowsRoth:false})
  assert.equal((await preview(nongov,request(3650000))).result.allocation.specialCents,1200000)
  await refused(nongov,request(100,100),'roth_not_available_for_arrangement')
  const noRoth=await save({...gov,catchUpMode:'age',allowsRoth:false,priorYearFicaWagesCents:15000001})
  await refused(noRoth,request(2450001),'combined_457_contribution_limit_exceeded')
  const lowComp=await save({...gov,compensationCents:2000000})
  assert.equal((await preview(lowComp,request(2000000))).result.employeeElectiveCents,2000000)
  await refused(lowComp,request(2000001),'combined_457_contribution_limit_exceeded')

  const sep={...withoutService,arrangement:'sep',employerType:'business',allowsRoth:false,allowsAgeCatchUp:false,opening:{employerCents:0,annualAdditionsCents:0}}
  const e=await save(sep), employer=await preview(e,request(0,0,5000000))
  assert.equal(employer.result.employerContributionCents,5000000);assert.equal(employer.result.employeeElectiveCents,0);assert.equal(employer.result.employeeDeductionCents,0)
  assert.deepEqual(employer.result.reporting.box12,[]);assert.match(employer.result.reporting.sepTreatment,/Employer SEP/)
  await refused(e,request(0,0,5000001),'sep_combined_employer_limit_exceeded')
  await refused(e,request(1),'sep_employer_contribution_is_not_elective')
  const cappedSep=await save({...sep,compensationCents:40000000,opening:{employerCents:1000000,annualAdditionsCents:7100000}})
  assert.equal((await preview(cappedSep,request(0,0,100000))).result.employerContributionCents,100000)
  await refused(cappedSep,request(0,0,100001),'sep_combined_employer_limit_exceeded')
  const fullSep=await save({...sep,compensationCents:40000000})
  assert.equal((await preview(fullSep,request(0,0,7200000))).result.employerContributionCents,7200000)
  await refused(fullSep,request(0,0,7200001),'sep_combined_employer_limit_exceeded')

  // Unsupported eligibility, wrong-plan rules and custom reporting inputs
  // cannot turn an unreviewed record into an exception to a limit.
  for(const bad of [{...initial,eligible:false},{...initial,year:2027},{...initial,opening:{}},{...initial,service:{...initial.service,yearsOfService:14}},{...initial,customCode:'G'},
    {...gov,service:initial.service},{...gov,catchUpMode:'special',ageAtYearEnd:57},{...gov,catchUpMode:'special',opening:{contributionsCents:2500000,ageCents:50000,specialCents:0}},
    {...gov,arrangement:'nongovernmental-457b',employerType:'tax-exempt',catchUpMode:'age'}, {...sep,workerKind:'self-employed'}])await unchanged(async()=>assert.equal((await call(door,{...bad,id:'synthetic-envelope-invalid-'+(++serial),version:0})).status,400))
  await refused(s,{...request(1),code:'EE'},'unsupported_retirement_input')
  await refused(s,request(1,0,0,'2027-01-01'),'retirement_evidence_outside_effective_period')
  const pending=await save(initial,false)
  await unchanged(async()=>assert.equal((await call(door+'/preview',body(pending,request(10000)))).status,409))
  const exact=await data(door+'/review/'+pending.id)
  const corrected=await save({...pending.body,version:1,electionReference:'synthetic-envelope-9290 corrected signed election'},false)
  assert.equal((await call(door+'/decision/'+pending.id,{version:1,reviewToken:exact.reviewToken})).status,409)
  const exact2=await data(door+'/review/'+pending.id)
  await data(door+'/decision/'+pending.id,{version:2,reviewToken:exact2.reviewToken})
  assert.equal((await preview(corrected,request(10000))).setupVersion,2)
  // A later proposed correction invalidates even formerly reviewed proposals.
  await save({...s.body,version:1,accumulatorReference:'synthetic-envelope-9291 corrected opening register'},false)
  const stale=(await data(door)).proposals.find(row=>row.id===max.id)
  assert.equal(stale.sourcesCurrent,0);assert.equal(stale.sourceStatus,'changed-repreview-required')
  await unchanged(async()=>assert.equal((await call(door+'/preview',body(s,request(1)))).status,409))
  const replay=body(e,request(0,0,10000));await data(door+'/preview',replay,201)
  await unchanged(async()=>assert.equal((await call(door+'/preview',replay)).status,409))
  await unchanged(async()=>assert.equal((await call(door,e.body)).status,409))
  const beforeRestart=await data(door);await restart();assert.deepEqual(await data(door),beforeRestart)

  const fixture={edition:'2026-01',payDate:'2026-10-30',from:'2026-10-19',through:'2026-10-25',frequency:'weekly',workState:'TX',residentState:'TX',locality:'none',remuneration:{kind:'salary',exempt:true,cashCents:100000},w4:ordinaryW4,stateElection:{},yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[],extendedRetirement:{personId:worker.id,setupId:e.id,setupVersion:e.version,request:request(0,0,10000)}}
  const payroll=await data(base+'/calculation-preview',fixture)
  assert.equal(payroll.extendedRetirement.employeeDeductionCents,0);assert.equal(payroll.extendedRetirement.employerContributionCents,10000)
  assert.deepEqual(payroll.deductions,[]);assert.equal(payroll.federal.netCashCents,84542);assert.equal(payroll.netCashCents,null);assert.equal(payroll.paymentReady,false)
  assert.ok(payroll.holds.some(h=>h.code==='retirement-payroll-integration-pending'));assert.ok(payroll.holds.some(h=>h.code==='sui-rate-review-required'))
  const other=await data('/api/envelope/companies',{name:'Synthetic foreign retirement employer',ein:'00-0009207'},201)
  const foreign='/api/envelope/companies/'+other.id+'/people/'+worker.id+'/benefits/extended-retirement'
  await unchanged(async()=>assert.equal((await call(foreign,initial)).status,404))
  await unchanged(async()=>assert.equal((await call(door+'/preview',body(e,request(0,0,1)),cookie,{authorization:'Bearer synthetic-envelope-9292'})).status,403))
  assert.equal((await call(door,undefined,'')).status,401)
  const member='synthetic-envelope-9293',token=randomBytes(32).toString('base64url'),hashed=await hashToken(settings.SESSION_SECRET,'session',token),now=Date.now()
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic retirement preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now+3600000})`)
  await data(base+'/grants',{operatorId:member,version:0,role:'payroll-admin',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose','rates:approve','private:read','private:write']})
  const who=cookie.split('=')[0]+'='+token
  for(const [path,input] of [[door,undefined],[door,initial],[door+'/review/'+e.id,undefined],[door+'/decision/'+e.id,{version:1,withdraw:true}],[door+'/preview',body(e,request(0,0,1))],[base+'/calculation-preview',fixture]])assert.equal((await call(path,input,who)).status,403)
  await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${member}'`)
  assert.equal((await call(door,undefined,who)).status,401)
  const ownerToken=randomBytes(32).toString('base64url'),ownerHash=await hashToken(settings.SESSION_SECRET,'session',ownerToken),ownerSession='synthetic-envelope-9294'
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) SELECT '${ownerSession}','${ownerHash}',id,version,'native',${now},${now+3600000} FROM oa_operators WHERE role='owner' LIMIT 1`)
  const ownerCookie=cookie.split('=')[0]+'='+ownerToken
  assert.equal((await call(door,undefined,ownerCookie)).status,200)
  await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${ownerSession}'`)
  await unchanged(async()=>{assert.equal((await call(door+'/preview',body(e,request(0,0,1)),ownerCookie)).status,401);assert.equal((await call(door,undefined,ownerCookie)).status,401)})
  const stored=await sql("SELECT cipher FROM env_workspace_versions WHERE kind='extended-retirement'")
  assert.ok(stored.length);assert.ok(stored.every(row=>!row.cipher.includes('signed plan')&&!row.cipher.includes('signed employee')))
  const audit=await data(base+'/audit');assert.ok(audit.some(row=>row.action==='workspace.extended-retirement.approved'));assert.ok(audit.some(row=>row.action==='workspace.extended-retirement-preview.recorded'))
  // The new encrypted record kinds join the existing local custody graph.
  // Classification and release are explicit owner actions; there is no timer.
  const erasing=await data(base+'/people',{name:'Synthetic retirement custody employee',locationId:location.id},201)
  const erasedDoor=base+'/people/'+erasing.id+'/benefits/extended-retirement',planId='synthetic-envelope-erased-retirement'
  await data(erasedDoor,{...initial,id:planId,version:0},201)
  const review=await data(erasedDoor+'/review/'+planId)
  await data(erasedDoor+'/decision/'+planId,{version:1,reviewToken:review.reviewToken})
  const captured={id:'synthetic-envelope-erased-proposal',version:0,setupId:planId,setupVersion:1,request:request(10000)}
  await data(erasedDoor+'/preview',captured,201)
  const privacy=base+'/people/'+erasing.id+'/privacy',inventory=await data(privacy)
  for(const kind of ['extended-retirement','extended-retirement-preview'])assert.ok(inventory.retained.some(row=>row.table==='env_workspace_versions'&&row.key.kind===kind))
  const ownerSessionHash=await hashToken(settings.SESSION_SECRET,'session',cookie.split('=')[1]),proofToken=randomBytes(32).toString('base64url'),proofHash=await hashToken(settings.SESSION_SECRET,'link',proofToken),proofId='synthetic-envelope-retirement-proof'
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at) SELECT '${proofId}','${proofHash}',id,operator_id,operator_version,'credentials:mint','/app',${Date.now()},${Date.now()+600000} FROM oa_sessions WHERE token_hash='${ownerSessionHash}'`)
  assert.equal((await call('/auth/confirm',{token:proofToken})).status,303)
  await data(privacy+'/request',{consent:true,fingerprint:inventory.fingerprint})
  const select={consent:true,fingerprint:inventory.fingerprint,records:inventory.retained.map(row=>row.id),legalBasis:'Synthetic reviewed eligible local records; no remaining statutory hold.',custodian:'Native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
  assert.equal((await call(base+'/people/'+erasing.id+'/erase',{version:inventory.version,...select})).status,409,'Unclassified benefit evidence remains held')
  await data(privacy+'/retain',select);await data(privacy+'/release',select)
  assert.equal((await data(base+'/people/'+erasing.id+'/erase',{version:inventory.version,...select})).erased,true)
  assert.equal((await call(erasedDoor)).status,404)
  assert.equal((await call(erasedDoor+'/preview',captured)).status,404)
  assert.equal((await call(erasedDoor,{...initial,id:planId,version:0})).status,404)
  const replacement=await data(base+'/people',{name:'Synthetic new retirement employee',locationId:location.id},201),replacementDoor=base+'/people/'+replacement.id+'/benefits/extended-retirement'
  assert.equal((await call(replacementDoor,{...initial,id:planId,version:0})).status,409,'Erased source identifiers cannot be captured again for another worker')
  assert.deepEqual(await data(replacementDoor),{setups:[],proposals:[]})
  const erasedAudit=await data(base+'/audit');assert.ok(!erasedAudit.some(row=>row.targetId===erasing.id||row.targetId===planId||row.targetId===captured.id))
  console.log('EXTENDED-RETIREMENT passed: reviewed year-specific 403(b), both 457(b) arrangements and SEP proposals, combined limits, ordering, reporting, unchanged refusals, source corrections, replay, restart and current private authority')
}
