import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { ordinaryW4 } from './industry-fixture.mjs'

/** A single native money-preparation journey; proposals never stand for actual collected contributions. */
export async function retirementBenefitsJourney({origin,cookie,sql,settings,restart}) {
 const call=(path,body,who=cookie,extra={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{origin,cookie:who,'content-type':['application','json'].join('/'),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const data=async(path,body,status=200,who=cookie)=>{const r=await call(path,body,who);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const company=await data('/api/envelope/companies',{name:'Retirement proposal workshop',ein:'00-0019019'},201),base='/api/envelope/companies/'+company.id
 const location=await data(base+'/locations',{name:'Texas workplace',state:'TX'},201)
 const person=await data(base+'/people',{name:'Near-limit retirement contributor',locationId:location.id},201)
 const door=base+'/people/'+person.id+'/retirement'
 const payroll=(year=2026,gross=100000)=>({edition:year+'-01',payDate:year+'-10-30',from:year+'-10-19',through:year+'-10-25',frequency:'weekly',workState:'TX',residentState:'TX',locality:'none',remuneration:{kind:'salary',cashCents:gross,exempt:true},w4:ordinaryW4,stateElection:{},yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[]})
 const election=(year=2026)=>({taxYear:year,effectiveFrom:year+'-01-01',effectiveThrough:year+'-12-31',birthDate:'1980-12-31',eligible:true,catchUpAllowed:true,rothAllowed:true,priorYearSponsorFicaWagesCents:0,traditionalCents:20000,rothCents:20000,
  match:{rateBasisPoints:10000,compensationBasisPoints:600,includesCatchUp:true},
  prior:{through:year+'-10-18',traditionalCents:0,rothCents:0,otherPlanDeferralsCents:0,catchUpCents:0,planAnnualAdditionsCents:0,planCompensationCents:10000000,sourceRef:'synthetic-envelope-19001'},
  evidence:{planRef:'synthetic-envelope-19002',electionRef:'synthetic-envelope-19003',eligibilityRef:'synthetic-envelope-19004'}})
 let version=0
 const save=async e=>{const r=await data(door,{version,election:e},201);version=r.version;return r}
 const approve=async()=>{const r=await data(door+'/review');await data(door+'/approve',{version:r.version,reviewToken:r.reviewToken});return r}
 const request=(sourceRef='synthetic-envelope-19005',pay=payroll(),extra={})=>({version:0,electionVersion:version,sourceRef,payroll:pay,...extra})
 const record=await save(election())
 assert.equal((await call(door+'/preview',request())).status,409,'unreviewed plan and election cannot prepare a deduction')
 const review=await data(door+'/review')
 assert.deepEqual(review.data.evidence,election().evidence)
 await data(door+'/approve',{version:record.version,reviewToken:review.reviewToken})
 const input=request(),first=await data(door+'/preview',input,201),amount=first.data.result.contribution
 assert.deepEqual([amount.traditionalCents,amount.rothCents,amount.employerMatchCents],[20000,20000,6000])
 assert.deepEqual([amount.proposedFederalIncomeTaxWagesCents,amount.proposedFicaWagesCents],[80000,100000])
 assert.equal(amount.collected,false);assert.equal(amount.providerAccepted,false);assert.equal(first.data.result.paymentReady,false);assert.equal(first.data.result.netCashCents,null)
 assert.equal(first.data.result.ordinaryPayrollPreview.netCashCents,null)
 assert.ok(first.data.result.ordinaryPayrollPreview.holds.some(h=>h.code==='sui-rate-review-required'))
 assert.ok(amount.sources.some(s=>s.url==='https://www.irs.gov/pub/irs-drop/n-25-67.pdf'))
 const beforeReplay=await data(door)
 assert.equal((await call(door+'/preview',input)).status,409)
 assert.equal((await call(door,{version:0,election:election()})).status,409)
 assert.deepEqual(await data(door),beforeReplay,'replayed source capture changes no retained version or proposal')
 // Correcting a reviewed source immediately makes pending proposals stale and requires exact new review.
 const changed={...election(),traditionalCents:10000,rothCents:5000,evidence:{...election().evidence,electionRef:'synthetic-envelope-19006'}}
 await save(changed)
 assert.equal((await data(door)).proposals[0].sourcesCurrent,0)
 assert.equal((await call(door+'/approve',{version:1,reviewToken:review.reviewToken})).status,409)
 assert.equal((await call(door+'/preview',request())).status,409)
 await approve()
 const corrected=await data(door+'/preview',request(input.sourceRef,input.payroll,{version:1,correctionReason:'Corrected exact signed election before collection'}),201)
 assert.equal(corrected.id,first.id);assert.equal(corrected.version,2)
 assert.deepEqual([corrected.data.result.contribution.employeeCents,corrected.data.result.contribution.employerMatchCents],[15000,6000])
 assert.equal(corrected.data.electionVersion,2)
 const history=await data(door)
 assert.equal(history.proposals.length,2);assert.equal(history.proposals.find(p=>p.version===1).data.result.contribution.employeeCents,40000)
 await restart();assert.deepEqual(await data(door),history,'encrypted source versions, exact decisions and proposal history survive restart')
 // Independent goldens from IRS Notices 2024-80 and 2025-67, not the implementation's tables.
 // Each case uses actual native election review and the calculation preview door.
 const cases=[
  {name:'2025 combined limit',year:2025,prior:{traditionalCents:2000000,rothCents:340000,planAnnualAdditionsCents:2340000},want:[10000,0,0,6000,30000]},
  {name:'2026 combined limit',prior:{traditionalCents:2000000,rothCents:440000,planAnnualAdditionsCents:2440000},want:[10000,0,0,6000,30000]},
  {name:'other employer shares individual limit',prior:{otherPlanDeferralsCents:2440000},want:[10000,0,0,6000,30000]},
  {name:'age fifty attained in December',e:{birthDate:'1976-12-31',traditionalCents:900000,rothCents:0},gross:1000000,prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[800000,0,800000,60000,100000]},
  {name:'2025 age fifty catch-up',year:2025,e:{birthDate:'1975-12-31',traditionalCents:900000,rothCents:0},gross:1000000,prior:{traditionalCents:2350000,planAnnualAdditionsCents:2350000},want:[750000,0,750000,60000,150000]},
  {name:'age sixty enhanced',e:{birthDate:'1966-12-31',traditionalCents:1200000,rothCents:0},gross:1500000,prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[1125000,0,1125000,90000,75000]},
  {name:'age sixty-three enhanced',e:{birthDate:'1963-01-01',traditionalCents:1200000,rothCents:0},gross:1500000,prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[1125000,0,1125000,90000,75000]},
  {name:'age sixty-four ordinary catch-up',e:{birthDate:'1962-01-01',traditionalCents:1200000,rothCents:0},gross:1500000,prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[800000,0,800000,90000,400000]},
  {name:'plan excludes catch-up',e:{birthDate:'1966-01-01',catchUpAllowed:false},prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[0,0,0,0,40000]},
  {name:'Roth wage boundary permits traditional',e:{birthDate:'1970-01-01',priorYearSponsorFicaWagesCents:15000000,traditionalCents:10000,rothCents:0},prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[10000,0,10000,6000,0]},
  {name:'high wages require elected Roth catch-up',e:{birthDate:'1970-01-01',priorYearSponsorFicaWagesCents:15000001,traditionalCents:10000,rothCents:20000},prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[0,20000,20000,6000,10000],rothRequired:true},
  {name:'prior catch-up consumes remaining room',e:{birthDate:'1970-01-01',traditionalCents:20000,rothCents:0},prior:{traditionalCents:3240000,catchUpCents:790000,planAnnualAdditionsCents:2450000},want:[10000,0,10000,6000,10000]},
  {name:'match respects annual compensation',prior:{planCompensationCents:35990000},want:[20000,20000,0,600,0]},
  {name:'match respects annual additions',prior:{planAnnualAdditionsCents:7199000},e:{traditionalCents:500,rothCents:0},want:[500,0,0,500,0]},
  {name:'plan excludes catch-up from match',e:{birthDate:'1970-01-01',traditionalCents:10000,rothCents:0,match:{rateBasisPoints:5000,compensationBasisPoints:600,includesCatchUp:false}},prior:{traditionalCents:2450000,planAnnualAdditionsCents:2450000},want:[10000,0,10000,0,0]},
  {name:'compensation caps proposed deductions',e:{traditionalCents:90000,rothCents:90000},want:[90000,10000,0,6000,80000]},
 ]
 for(const [i,c] of cases.entries()) {
  const y=c.year??2026,e=election(y);Object.assign(e,c.e);Object.assign(e.prior,c.prior)
  await save(e);await approve()
  const proposal=await data(door+'/preview',request('synthetic-envelope-case-'+i,payroll(y,c.gross??100000)),201),r=proposal.data.result.contribution
  assert.deepEqual([r.traditionalCents,r.rothCents,r.catchUpCents,r.employerMatchCents,r.unallocatedCents],c.want,c.name)
  assert.equal(r.rothCatchUpRequired,c.rothRequired??false,c.name)
  assert.equal(r.collected,false);assert.equal(r.providerAccepted,false)
 }
 // No custom limits, missing accumulators, unsupported plans or unreviewed source can bypass preparation.
 const invalid=[{...election(),taxYear:2027},{...election(),eligible:false},{...election(),prior:undefined},{...election(),annualLimitCents:99999999},{...election(),match:{...election().match,rateBasisPoints:10001}}]
 const preInvalid=await data(door)
 for(const e of invalid)assert.equal((await call(door,{version,election:e})).status,400)
 assert.deepEqual(await data(door),preInvalid)
 for(const e of [
  {...election(),effectiveFrom:'2026-11-01'},
  {...election(),effectiveThrough:'2026-10-24'},
  {...election(),prior:{...election().prior,through:'2026-10-19'}},
  {...election(),rothAllowed:false},
  {...election(),prior:{...election().prior,traditionalCents:2450001,planAnnualAdditionsCents:2450001}},
 ]) {
  await save(e);await approve()
  const n=(await data(door)).proposals.length
  assert.equal((await call(door+'/preview',request('synthetic-envelope-refusal-'+version))).status,400)
  assert.equal((await data(door)).proposals.length,n)
 }
 // Foreign company, agents, native non-owners and revoked sessions receive no data or writes.
 const foreign=await data('/api/envelope/companies',{name:'Separate employer',ein:'00-0019020'},201)
 const foreignDoor=door.replace(company.id,foreign.id)
 const retained=await data(door)
 for(const path of [foreignDoor,foreignDoor+'/review'])assert.equal((await call(path)).status,404)
 assert.equal((await call(foreignDoor,{version:0,election:election()})).status,404)
 assert.equal((await call(foreignDoor+'/preview',request())).status,404)
 assert.equal((await call(door,undefined,'')).status,401)
 assert.equal((await call(door,undefined,cookie,{authorization:'Bearer synthetic-envelope-19007'})).status,403)
 const member='synthetic-envelope-19008',token=randomBytes(32).toString('base64url'),hashed=await hashToken(settings.SESSION_SECRET,'session',token),now=Date.now()
 await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic benefit preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now+3600000})`)
 await data(base+'/grants',{operatorId:member,version:0,role:'payroll-admin',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose','rates:approve']})
 const memberCookie=cookie.split('=')[0]+'='+token
 for(const [path,body] of [[door,undefined],[door,{version,election:election()}],[door+'/review',undefined],[door+'/approve',{version,reviewToken:review.reviewToken}],[door+'/preview',request()]])assert.equal((await call(path,body,memberCookie)).status,403)
 await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${member}'`)
 assert.equal((await call(door,undefined,memberCookie)).status,401)
 assert.deepEqual(await data(door),retained)
 await save(election());await approve()
 await sql(`UPDATE env_grants SET version=version+1 WHERE company_id='${company.id}' AND role='owner'`)
 assert.equal((await call(door+'/preview',request('synthetic-envelope-revoked-review'))).status,401,'grant changes revoke the original session immediately')
 const ownerHash=await hashToken(settings.SESSION_SECRET,'session',cookie.split('=')[1])
 const freshToken=randomBytes(32).toString('base64url'),freshHash=await hashToken(settings.SESSION_SECRET,'session',freshToken),freshId='synthetic-envelope-19009'
 await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) SELECT '${freshId}','${freshHash}',operator_id,operator_version,'native',${Date.now()},${Date.now()+3600000} FROM oa_sessions WHERE token_hash='${ownerHash}'`)
 cookie=cookie.split('=')[0]+'='+freshToken
 assert.equal((await call(door+'/preview',request('synthetic-envelope-revoked-review'))).status,409,'a new current session cannot reuse review bound to earlier company authority')
 const proofToken=randomBytes(32).toString('base64url'),proofHash=await hashToken(settings.SESSION_SECRET,'link',proofToken)
 await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at) SELECT 'synthetic-envelope-retirement-proof','${proofHash}',id,operator_id,operator_version,'credentials:mint','/app',${Date.now()},${Date.now()+600000} FROM oa_sessions WHERE id='${freshId}'`)
 assert.equal((await call('/auth/confirm',{token:proofToken})).status,303)

 // Inventory and lawful local erasure include both encrypted sources and their derivative versions.
 const privacy=base+'/people/'+person.id+'/privacy',inventory=await data(privacy)
 assert.ok(inventory.retained.some(r=>r.table==='env_workspace_versions'&&r.key.kind==='retirement-election'))
 assert.ok(inventory.retained.some(r=>r.table==='env_workspace_versions'&&r.key.kind==='retirement-preview'))
 const selection={fingerprint:inventory.fingerprint,records:inventory.retained.map(r=>r.id),consent:true,legalBasis:'Synthetic reviewed lawful release; no statutory hold remains.',custodian:'Native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
 await data(privacy+'/retain',selection);await data(privacy+'/release',selection)
 await data(base+'/people/'+person.id+'/erase',{version:inventory.version,...selection})
 for(const [path,body] of [[door,undefined],[door,{version:0,election:election()}],[door+'/preview',input]])assert.equal((await call(path,body)).status,404)
 await restart();assert.equal((await call(door+'/preview',input)).status,404,'stale capture after restart cannot resurrect an erased worker')
 console.log('RETIREMENT-BENEFITS passed: exact reviewed effective elections; independently sourced combined limits, age and Roth catch-up, match caps; correction, replay, restart, authority and erasure through native doors')
}
