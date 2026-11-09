import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { ordinaryW4 } from './industry-fixture.mjs'
import { privateValue } from './privacy-recorder.mjs'

const source = {version:0,taxYear:2026,state:'OR',sourceEdition:'OR-WBF-2026-order-25-054-period-rounding',rounding:'nearest-cent-per-pay-period-half-up',reference:'synthetic-envelope-wbf-source'}
const hours = (from,through,value,extra={}) => ({version:0,taxYear:2026,state:'OR',subject:true,from,through,payDate:through,frequency:'weekly',hours:value,actualHoursTracked:true,method:'actual',reference:'synthetic-envelope-wbf-'+from,methodReference:'synthetic-envelope-approved-time-'+from,methodExplanation:'Exact covered work hours including fractional hours, with no leave or standby.',...extra})
const request = periods => ({version:0,taxYear:2026,quarter:1,sourceVersion:1,periods})
const selection = (person,from,version=1) => ({personId:person.id,from,version})
const native = ({origin,cookie,worker}) => (path,body,who=cookie,extra={}) => {
 const init={method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':['application','json'].join('/'),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}
 return worker?worker.fetch(origin+path,init):fetch(origin+path,init)
}
const reader = call => async(path,body,status=200) => {const r=await call(path,body);assert.equal(r.status,status,path+' '+await r.clone().text());assert.equal(r.headers.get('cache-control'),'no-store');return r.json()}
const approve = async(data,door) => {const review=await data(door+'/review');await data(door+'/approve',{version:review.version,reviewToken:review.reviewToken});return review}
const previewInput = (person,from,through,version=1,extra={}) => ({edition:'2026-01',payDate:through,from,through,frequency:'weekly',workState:'OR',residentState:'OR',locality:'none',
 remuneration:{kind:'salary',exempt:true,cashCents:100000},w4:ordinaryW4,stateElection:{filingStatus:'single',allowances:0,additionalCents:0},
 yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[],
 orWbf:{taxYear:2026,quarter:1,version,personId:person.id,from},...extra})

/** One native money and custody journey, independently worked from adopted OAR 436-070-0020. */
export async function orWbfJourney(context) {
 privateValue(source.reference)
 const {cookie,sql,settings,restart,outboundCount}=context,call=native(context),data=reader(call),outbound=outboundCount()
 const company=await data('/api/envelope/companies',{name:'Synthetic Oregon WBF employer',ein:'00-0009606'},201)
 const base='/api/envelope/companies/'+company.id,sources=base+'/or-wbf-sources',door=base+'/or-wbf-preparations/2026/1',preview=base+'/calculation-preview'
 const location=await data(base+'/locations',{name:'Oregon covered workplace',state:'OR'},201)
 const person=await data(base+'/people',{name:'Synthetic covered Oregon worker',locationId:location.id},201)
 const period=p=>base+'/people/'+person.id+'/or-wbf-hours/'+p
 const state=()=>Promise.all([
  "SELECT * FROM env_workspace_versions ORDER BY company_id,kind,object_id,version",
  "SELECT * FROM env_workspace_decisions ORDER BY company_id,kind,object_id,version,decision",
  "SELECT * FROM env_workspace_reviews ORDER BY token_hash",
 ].map(sql))
 const authority=()=>Promise.all([
  'SELECT * FROM env_run_approvals ORDER BY company_id,run_id,version',
  'SELECT * FROM env_notice_dispatches ORDER BY company_id,reply_id,version',
  "SELECT * FROM env_workspace_versions WHERE kind NOT LIKE 'or-wbf-%' AND kind!='rule' ORDER BY company_id,kind,object_id,version",
  'SELECT * FROM env_lifecycle_events ORDER BY id',
 ].map(sql))
 const untouched=await authority()
 const refused=async(path,body,status=409,who=cookie,extra={})=>{
  const before=await state(),r=await call(path,body,who,extra)
  assert.equal(r.status,status,path+' '+await r.clone().text())
  assert.deepEqual(await state(),before,'refusal leaves source, period, preparation, decisions and challenges unchanged')
  assert.deepEqual(await authority(),untouched,'refusal never changes payroll or external authority')
  return r
 }
 for(const bad of [{taxYear:2025},{state:'WA'},{sourceEdition:'440-4999-COM-12-25'},{rounding:'nearest-cent-per-report'},{sourceEdition:'OR-WBF-2027'}]) await refused(sources,{...source,...bad})
 await data(sources,source,201)
 const first=hours('2026-01-01','2026-01-07','10.5'),second=hours('2026-01-08','2026-01-14','10.6')
 await data(period(first.from),first,201);await data(period(second.from),second,201)
 privateValue(first.reference);privateValue(first.methodReference)
 const capture=request([selection(person,first.from),selection(person,second.from)])
 await refused(door,capture)
 const reviewedSource=await approve(data,sources)
 assert.equal(reviewedSource.data.edition.taxYear,2026)
 assert.ok(reviewedSource.data.edition.sources[0].sections.includes('436-070-0020(3)'))
 assert.match(reviewedSource.data.edition.sources[0].url,/wcd\.oregon\.gov/)
 assert.equal(reviewedSource.data.edition.rounding,'nearest-cent-per-pay-period-half-up')
 await refused(door,capture)
 await approve(data,period(first.from));await approve(data,period(second.from))
 for(const bad of [
  {method:'wa-160-month',hours:'160',actualHoursTracked:false},
  {method:'flat',hours:'160',actualHoursTracked:false},
  {method:'flat',hours:'40',actualHoursTracked:true},
  {method:'contract',actualHoursTracked:false,methodReference:''},
  {method:'reasonable',actualHoursTracked:false,methodExplanation:''},
  {hours:10.6},{hours:'10.0000001'},{taxYear:2025},{state:'WA'},{subject:false},{payDate:'2025-01-07'},
 ]) await refused(period('2026-02-01'),hours('2026-02-01','2026-02-07','10.5',bad),bad.hours===10.6||bad.hours==='10.0000001'||bad.methodReference===''||bad.methodExplanation===''?400:409)
 await refused(period('2026-01-05'),hours('2026-01-05','2026-01-11','1'))
 const prepared=await data(door,capture,201),result=prepared.result
 // OAR: 10.5 x .009 dollars = .0945 -> .09; 10.6 x .009 = .0954 -> .10.
 assert.deepEqual(result.rows.map(r=>[r.hours,r.employeeCents,r.employerCents,r.totalCents]),[['10.5',9,9,18],['10.6',10,10,20]])
 assert.equal(result.employeeCents,19);assert.equal(result.employerCents,19);assert.equal(result.totalCents,38)
 assert.deepEqual(result.combinedReportWorksheet,{form:'OQ',taxYear:2026,quarter:1,subjectHours:'21.1',proposedEmployeeCents:19,proposedEmployerCents:19,proposedAssessmentCents:38,status:'unsigned-unfiled-worksheet'})
 assert.equal(result.collectedEmployeeCents,null);assert.equal(result.paidEmployerCents,null);assert.equal(result.payrollApproval,null)
 assert.equal(result.paymentReady,false);assert.equal(result.unsigned,true);assert.equal(result.unfiled,true)
 assert.equal(result.filing,'unavailable');assert.equal(result.payment,'unavailable')
 assert.deepEqual((await data(door+'/review')).data.result,result)
 const beforeReplay=await state();await restart()
 const replay=await data(door,capture,201)
 assert.equal(replay.replayed,true);assert.deepEqual(replay.result,result);assert.deepEqual(await state(),beforeReplay,'restart and lost-response replay never add a preparation')
 for(const action of ['approve','pay','file','remit']) await refused(door+'/'+action,{version:1})
 await refused(door,{...capture,periods:[...capture.periods,capture.periods[0]]})
 await refused(door,{...capture,periods:capture.periods.slice(0,1)})
 const ordinary=previewInput(person,first.from,first.through),withWbf=await data(preview,ordinary)
 const without={...ordinary};delete without.orWbf
 const baseline=await data(preview,without)
 assert.deepEqual(withWbf.federal,baseline.federal);assert.deepEqual(withWbf.state,baseline.state);assert.deepEqual(withWbf.deductions,baseline.deductions)
 assert.equal(withWbf.orWbf.employeeCents,9);assert.equal(withWbf.orWbf.employerCents,9)
 assert.equal(withWbf.netCashCents,null);assert.equal(withWbf.paymentReady,false);assert.equal(withWbf.approval,'unavailable');assert.equal(withWbf.dispatch,'unavailable')
 assert.ok(withWbf.holds.some(h=>h.code==='or-wbf-preparation-only'))
 await refused(preview,{...ordinary,through:'2026-01-08'})
 await refused(preview,{...ordinary,workState:'WA'})
 await refused(preview,{...ordinary,orWbf:{...ordinary.orWbf,version:2}})
 console.log('PROBE ENV-096 1: current native source and exact period review, preparation and calculation-preview -> 10.5 hours gives 9 employee cents and 9 employer cents; 10.6 gives 10 each; unsigned OQ worksheet and unchanged ordinary payroll')

 // 0.5 hour x .009 dollars = .0045 dollars: each period rounds to zero.
 // Aggregating the two hours first would incorrectly produce .01 dollars each.
 const rounding=await data(base+'/people',{name:'Synthetic period-rounding worker',locationId:location.id},201)
 const roundingPeriods=[]
 for(const [from,through] of [['2026-01-01','2026-01-07'],['2026-01-08','2026-01-14']]) {
  const p=base+'/people/'+rounding.id+'/or-wbf-hours/'+from
  await data(p,hours(from,through,'0.5',{reference:'synthetic-envelope-round-'+from}),201);await approve(data,p);roundingPeriods.push(selection(rounding,from))
 }
 const periodRounded=await data(door,{...request(roundingPeriods),version:1},201)
 assert.equal(periodRounded.result.hours,'1');assert.equal(periodRounded.result.employeeCents,0);assert.equal(periodRounded.result.employerCents,0)
 assert.equal(periodRounded.result.combinedReportWorksheet.proposedAssessmentCents,0)
 assert.deepEqual(periodRounded.result.rows.map(r=>r.employeeCents),[0,0])
 // Explicit half-cent boundary: 5 hours x .9 cents = 4.5 cents -> 5 cents.
 const monthly=await data(base+'/people',{name:'Synthetic untracked-hours monthly worker',locationId:location.id},201)
 const monthDoor=base+'/people/'+monthly.id+'/or-wbf-hours/2026-02-01'
 const month=hours('2026-02-01','2026-02-28','173.33',{frequency:'monthly',method:'flat',actualHoursTracked:false,reference:'synthetic-envelope-monthly',methodReference:'synthetic-envelope-flat-election',methodExplanation:'Untracked monthly hours, explicitly elect Oregon 173.33-hour flat method.'})
 await refused(monthDoor,{...month,hours:'160'})
 await refused(monthDoor,{...month,actualHoursTracked:true})
 await data(monthDoor,month,201);await approve(data,monthDoor)
 const monthlyPrepared=await data(door,{...request([selection(monthly,month.from)]),version:2},201)
 assert.deepEqual([monthlyPrepared.result.employeeCents,monthlyPrepared.result.employerCents,monthlyPrepared.result.totalCents],[156,156,312])
 const monthlyPreview=await data(preview,previewInput(monthly,month.from,month.through,3,{frequency:'monthly'}))
 assert.deepEqual([monthlyPreview.orWbf.employeeCents,monthlyPreview.orWbf.employerCents,monthlyPreview.orWbf.totalCents],[156,156,312])
 assert.equal(monthlyPreview.orWbf.combinedReportWorksheet.subjectHours,'173.33')
 console.log('PROBE ENV-096 2 calculation: reviewed untracked monthly flat method and 173.33 hours -> 156 employee cents, 156 employer cents and 312 total; copied Washington 160-hour default refuses without writes')

 // Immutable correction invalidates both prepared reporting data and preview.
 await data(monthDoor,{...month,version:1,method:'contract',hours:'5',methodReference:'synthetic-envelope-contract-5-hours',methodExplanation:'Retained contract specifies five covered hours for this period.'},201)
 await refused(door+'/review',undefined);await refused(preview,previewInput(monthly,month.from,month.through,3,{frequency:'monthly'}))
 await refused(door,{...request([selection(monthly,month.from)]),version:3})
 await approve(data,monthDoor)
 const correctedCapture={...request([selection(monthly,month.from,2)]),version:3},corrected=await data(door,correctedCapture,201)
 assert.deepEqual([corrected.result.employeeCents,corrected.result.employerCents],[5,5])
 let history=await data(door)
 assert.equal(history.filter(r=>r.current).length,1);assert.equal(history.find(r=>r.version===3).data.result.totalCents,312)
 assert.equal(history.find(r=>r.version===1).data.result.totalCents,38)
 await data(sources,{...source,version:1,reference:'synthetic-envelope-corrected-official-review'},201)
 await refused(door+'/review',undefined);await refused(door,correctedCapture)
 await refused(sources+'/approve',{version:1,reviewToken:reviewedSource.reviewToken})
 await approve(data,sources)
 const freshCapture={...correctedCapture,version:4,sourceVersion:2},fresh=await data(door,freshCapture,201)
 assert.equal(fresh.result.sourceVersion,2);assert.equal(fresh.result.totalCents,10)
 await restart();assert.equal((await data(door,freshCapture,201)).replayed,true)
 // Wrong-year and different-quarter sources cannot inherit the reviewed rate.
 await refused(base+'/or-wbf-preparations/2025/1',freshCapture)
 await refused(base+'/or-wbf-preparations/2026/2',{...freshCapture,quarter:2})
 const foreign=await data('/api/envelope/companies',{name:'Synthetic other WBF employer',ein:'00-0009607'},201),foreignBase='/api/envelope/companies/'+foreign.id
 await refused(foreignBase+'/people/'+person.id+'/or-wbf-hours',undefined,404)
 await refused(foreignBase+'/or-wbf-preparations/2026/1',freshCapture,404)
 await refused(door,undefined,401,'');await refused(sources,source,403,cookie,{authorization:'Bearer synthetic-envelope-wbf-agent'})
 const now=Date.now(),owner=(await sql("SELECT id,operator_id,operator_version FROM oa_sessions WHERE revoked_at IS NULL AND operator_id IN (SELECT id FROM oa_operators WHERE role='owner') ORDER BY created_at LIMIT 1"))[0]
 const member='synthetic-envelope-wbf-member',token=randomBytes(32).toString('base64url'),hash=await hashToken(settings.SESSION_SECRET,'session',token)
 await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic WBF staff','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hash}','${member}',1,'native',${now},${now+3600000})`)
 await data(base+'/grants',{operatorId:member,version:0,role:'payroll-admin',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose','rates:approve']})
 const staffCookie=cookie.split('=')[0]+'='+token
 for(const [path,body] of [[sources,undefined],[sources+'/review',undefined],[door,freshCapture],[preview,ordinary],[period(first.from),first]]) await refused(path,body,403,staffCookie)
 const revokedToken=randomBytes(32).toString('base64url'),revokedHash=await hashToken(settings.SESSION_SECRET,'session',revokedToken),revokedId='synthetic-envelope-wbf-revoked'
 await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${revokedId}','${revokedHash}','${owner.operator_id}',${owner.operator_version},'native',${now},${now+3600000})`)
 const revokedCookie=cookie.split('=')[0]+'='+revokedToken
 assert.equal((await call(sources,undefined,revokedCookie)).status,200)
 await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${revokedId}'`)
 for(const [path,body] of [[sources,undefined],[door,freshCapture],[door+'/review',undefined],[preview,ordinary]]) await refused(path,body,401,revokedCookie)
 // Privacy inventory must follow exact period evidence into every derivative.
 await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('synthetic-envelope-wbf-proof','synthetic-envelope-wbf-proof-hash','${owner.id}','${owner.operator_id}',${owner.operator_version},'credentials:mint','/app',${now},${now+600000},${now})`)
 const privacy=base+'/people/'+monthly.id+'/privacy',inventory=await data(privacy)
 assert.ok(inventory.retained.some(r=>r.key.kind==='or-wbf-hours'))
 assert.ok(inventory.retained.some(r=>r.key.kind==='or-wbf-preparation'))
 assert.ok(!inventory.retained.some(r=>r.key.kind==='or-wbf-source'))
 await data(privacy+'/request',{fingerprint:inventory.fingerprint,consent:true})
 for(const [path,body] of [[sources,undefined],[door,undefined],[door,freshCapture],[door+'/review',undefined],[preview,ordinary],[monthDoor,{...month,version:2}]]) await refused(path,body)
 const held=await data(privacy)
 const release={fingerprint:held.fingerprint,records:held.retained.map(r=>r.id),consent:true,legalBasis:'Synthetic release after explicit retention review',custodian:'Synthetic native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
 await data(privacy+'/retain',release);await data(privacy+'/release',release)
 await data(base+'/people/'+monthly.id+'/erase',{version:held.version,...release})
 await refused(door,freshCapture,404)
 // The retired derivative identity does not prevent new permitted preparation.
 const afterErasure=await data(door,{...request([selection(person,first.from)]),sourceVersion:2},201)
 assert.notEqual(afterErasure.id,prepared.id);assert.equal(afterErasure.version,1);assert.equal(afterErasure.result.employeeCents,9)
 // Current reviewed source version must be used after the source correction.
 assert.equal(afterErasure.result.sourceVersion,2)
 assert.equal((await sql("SELECT COUNT(*) AS n FROM env_workspace_versions WHERE kind='or-wbf-hours' AND person_id='"+monthly.id+"'"))[0].n,0)
 const encrypted=await sql("SELECT cipher FROM env_workspace_versions WHERE kind='or-wbf-source'")
 assert.ok(encrypted.every(row=>!row.cipher.includes(source.reference)))
 assert.deepEqual(await authority(),untouched,'all WBF outcomes leave payroll approvals, paid deductions, payments, filings and reference deliveries unchanged')
 assert.equal(outboundCount(),outbound,'all WBF preparation paths send no outbound request')
 console.log('OR-WBF passed: independent OAR goldens, period versus aggregate rounding, source and period corrections, exact review, replay and restart, authority and custody refusals, erasure and unchanged money authority')
}

/** Existing real archive export and import retains evidence with authority inactive. */
export async function orWbfArchiveFixture(context,companyId) {
 const data=reader(native(context)),base='/api/envelope/companies/'+companyId,sources=base+'/or-wbf-sources',door=base+'/or-wbf-preparations/2026/1'
 const location=await data(base+'/locations',{name:'Synthetic archived Oregon workplace',state:'OR'},201)
 const person=await data(base+'/people',{name:'Synthetic archived WBF worker',locationId:location.id},201)
 await data(sources,source,201);await approve(data,sources)
 const input=hours('2026-01-01','2026-01-07','10.6'),period=base+'/people/'+person.id+'/or-wbf-hours/'+input.from
 await data(period,input,201);await approve(data,period)
 const capture=request([selection(person,input.from)]),prepared=await data(door,capture,201)
 assert.equal(prepared.result.employeeCents,10);assert.equal(prepared.result.employerCents,10)
 await data(door+'/review')
 return {door,capture,companyId,personId:person.id,result:prepared.result}
}
