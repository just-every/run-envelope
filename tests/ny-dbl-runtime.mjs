import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { ordinaryW4 } from './industry-fixture.mjs'
import { privateValue } from './privacy-recorder.mjs'

// One money and custody sanity journey through the native setup and preview doors.
export async function nyDblJourney({origin,cookie,sql,settings,restart}) {
  const call=(path,body,who=cookie,extra={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':['application','json'].join('/'),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data=async(path,body,status=200)=>{const r=await call(path,body);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const company=await data('/api/envelope/companies',{name:'Synthetic DBL employer',ein:'00-0009401'},201)
  const base='/api/envelope/companies/'+company.id, plans=base+'/ny-dbl-plans'
  const location=await data(base+'/locations',{name:'New York workplace',state:'NY'},201)
  const plan={id:'synthetic-envelope-9401',version:0,program:'NY-DBL',type:'statutory',effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',
    recipient:{kind:'carrier',name:'Synthetic disability insurer',reference:'synthetic-envelope-9402'},
    source:{origin:'carrier',reference:'synthetic-envelope-9403',version:'synthetic-envelope-9404'},employeeContributions:true,ruleEdition:'WCL-209-2026-10'}
  privateValue(plan.source.reference)
  const savedPlan=await data(plans,plan,201)
  const reviewPlan=async()=>{const r=await data(plans+'/'+savedPlan.id+'/review');await data(plans+'/'+savedPlan.id+'/approve',{version:r.version,reviewToken:r.reviewToken});return r}
  const snapshot=()=>sql("SELECT * FROM env_workspace_versions ORDER BY company_id,kind,object_id,version; SELECT * FROM env_workspace_decisions ORDER BY company_id,kind,object_id,version; SELECT * FROM env_workspace_reviews ORDER BY token_hash; SELECT * FROM env_audit ORDER BY id")
  const refused=async(path,body,status=400,who=cookie,extra={})=>{const before=await snapshot(),r=await call(path,body,who,extra);assert.equal(r.status,status,await r.clone().text());assert.deepEqual(await snapshot(),before,'unsafe DBL request writes nothing');return r}
  for(const bad of [{program:'NY-PFL'},{type:'enhanced'},{type:'self-insured'},{recipient:{...plan.recipient,kind:'tax-agency'}},{rateBasisPoints:100},{weeklyCapCents:100}]) await refused(plans,{...plan,id:'synthetic-envelope-refused',...bad},bad.program||bad.type?409:400)
  let seq=0
  const person=async(name='Synthetic DBL worker')=>{
    const p=await data(base+'/people',{name,locationId:location.id},201)
    return {...p,door:base+'/people/'+p.id+'/ny-dbl'}
  }
  const week=(wagesCents,extra={})=>({from:'2026-10-19',wagesCents,priorCollectedCents:0,concurrent:null,...extra})
  const evidence=(weeks,extra={})=>({version:0,planId:savedPlan.id,planVersion:1,source:{origin:'migration',reference:'synthetic-envelope-9410',version:'synthetic-envelope-9411'},premiumReference:'synthetic-envelope-9412',attributablePremiumCents:1000,priorPremiumOffsetCents:0,weeks,...extra})
  const approveEvidence=async(p,input)=>{const r=await data(p.door+'/evidence',input,201),review=await data(p.door+'/evidence/review');await data(p.door+'/evidence/approve',{version:review.version,reviewToken:review.reviewToken});return r}
  const proposal=(amount,extra={})=>({id:'synthetic-envelope-proposal-'+(++seq),version:0,evidenceVersion:1,checks:[{reference:'synthetic-envelope-check-'+seq,weekFrom:'2026-10-19',wagesCents:amount}],...extra})
  const p=await person()
  await refused(p.door+'/evidence',evidence([week(20000)]),409)
  const planReview=await reviewPlan()
  assert.equal(planReview.data.source.version,plan.source.version)
  await data(p.door+'/evidence',evidence([week(20000)]),201)
  await refused(p.door+'/proposals',proposal(10000),409)
  const exactReview=await data(p.door+'/evidence/review')
  await refused(p.door+'/evidence/approve',{version:1,reviewToken:'synthetic-envelope-unreviewed'},409)
  await data(p.door+'/evidence/approve',{version:exactReview.version,reviewToken:exactReview.reviewToken})
  const firstInput=proposal(10000),first=await data(p.door+'/proposals',firstInput,201)
  assert.equal(first.result.proposedCents,50,'WCB half of one percent: 100 dollars proposes 50 cents')
  assert.equal(first.result.rows[0].weeklyCeilingCents,60)
  assert.equal(first.result.collectedCents,null);assert.equal(first.result.coverageEstablished,false)
  assert.equal(first.result.program,'NY-DBL');assert.equal(first.result.recipient.kind,'carrier')
  assert.equal(first.result.remittance,'unavailable');assert.equal(first.result.paymentReady,false)
  const countBeforeReplay=(await data(p.door)).proposals.length
  await restart()
  const replay=await data(p.door+'/proposals',firstInput,201)
  assert.equal(replay.replayed,true);assert.deepEqual(replay.result,first.result)
  assert.equal((await data(p.door)).proposals.length,countBeforeReplay)
  const split=await data(p.door+'/proposals',proposal(10000),201)
  assert.equal(split.result.proposedCents,10,'second same-week check shares the original 60-cent ceiling after restart')
  assert.equal(first.result.proposedCents+split.result.proposedCents,60)
  await refused(p.door+'/proposals',proposal(1),409)
  await refused(p.door+'/proposals',{...firstInput,id:'synthetic-envelope-duplicate-check'},409)
  // Independent WCL 209 and WCB-derived goldens, never expectations from product constants.
  for(const [wages,expected] of [[10000,50],[20000,60],[199,0],[200,1]]) {
    const worker=await person();await approveEvidence(worker,evidence([week(wages)]))
    const result=await data(worker.door+'/proposals',proposal(wages),201)
    assert.equal(result.result.proposedCents,expected)
  }
  const biweekly=await person()
  await approveEvidence(biweekly,evidence([week(20000),week(20000,{from:'2026-10-26'})]))
  const twoWeeks=await data(biweekly.door+'/proposals',proposal(20000,{checks:[{reference:'synthetic-envelope-9420',weekFrom:'2026-10-19',wagesCents:20000},{reference:'synthetic-envelope-9421',weekFrom:'2026-10-26',wagesCents:20000}]}),201)
  assert.equal(twoWeeks.result.proposedCents,120)
  assert.deepEqual(twoWeeks.result.rows.map(w=>w.proposedCents),[60,60])
  const premium=await person();await approveEvidence(premium,evidence([week(20000)],{attributablePremiumCents:100,priorPremiumOffsetCents:75}))
  const premiumResult=await data(premium.door+'/proposals',proposal(20000),201)
  assert.equal(premiumResult.result.proposedCents,25);assert.equal(premiumResult.result.remainingAttributablePremiumCents,0)
  const switched=await person();await approveEvidence(switched,evidence([week(20000,{priorCollectedCents:40})],{priorPremiumOffsetCents:40}))
  assert.equal((await data(switched.door+'/proposals',proposal(20000),201)).result.proposedCents,20)
  const concurrent=[]
  for(const [wages,other,expected] of [[20000,10000,40],[10000,20000,20]]) {
    const worker=await person(),input=evidence([week(wages,{concurrent:{requestReference:'synthetic-envelope-9430',verifiedEarningsReference:'synthetic-envelope-9431',otherWagesCents:other}})])
    await refused(worker.door+'/evidence',{...input,weeks:[{...input.weeks[0],concurrent:{...input.weeks[0].concurrent,verifiedEarningsReference:''}}]})
    await refused(worker.door+'/evidence',{...input,weeks:[{...input.weeks[0],concurrent:{...input.weeks[0].concurrent,companyId:company.id}}]})
    await approveEvidence(worker,input)
    const result=await data(worker.door+'/proposals',proposal(wages),201)
    assert.equal(result.result.proposedCents,expected);assert.equal(result.result.rows[0].concurrentAdjustment,true)
    concurrent.push(result.result.proposedCents)
  }
  assert.equal(concurrent[0]+concurrent[1],60)
  // Real calculation door consumes the retained proposal, preserving all tax holds.
  const calc={edition:'2026-01',payDate:'2026-10-30',from:'2026-10-19',through:'2026-10-25',frequency:'weekly',workState:'NY',residentState:'NY',locality:'none',
    remuneration:{kind:'salary',exempt:true,cashCents:10000},w4:ordinaryW4,stateElection:{filingStatus:'single',allowances:0,additionalCents:0},yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[],nyDbl:{personId:p.id,proposalId:first.id,version:1}}
  const calculated=await data(base+'/calculation-preview',calc)
  assert.equal(calculated.nyDbl.proposedCents,50);assert.equal(calculated.netCashCents,null);assert.equal(calculated.status,'held')
  assert.ok(calculated.holds.some(h=>h.code==='state-programs-unmapped'));assert.ok(calculated.holds.some(h=>h.code==='ny-dbl-preparation-only'))
  await refused(p.door+'/remittance',{proposalId:first.id},409)
  await refused(p.door+'/proposals',{...proposal(100),requestedCents:100})
  // Corrections retain history and invalidate the old source review and preparation.
  const correction=evidence([week(20000)],{version:1,source:{origin:'migration',reference:'synthetic-envelope-9440',version:'synthetic-envelope-9441'}})
  await data(p.door+'/evidence',correction,201)
  await refused(p.door+'/evidence/approve',{version:1,reviewToken:exactReview.reviewToken},409)
  await refused(base+'/calculation-preview',calc,400)
  await refused(p.door+'/proposals',proposal(100),409)
  const correctedReview=await data(p.door+'/evidence/review')
  await data(p.door+'/evidence/approve',{version:2,reviewToken:correctedReview.reviewToken})
  const corrected=await data(p.door+'/proposals',{...firstInput,version:1,evidenceVersion:2},201)
  assert.equal(corrected.version,2);assert.equal(corrected.result.proposedCents,50)
  const history=await data(p.door)
  assert.deepEqual(history.evidence.map(r=>r.version),[2,1]);assert.equal(history.proposals.filter(r=>r.id===first.id).length,2)
  // A foreign person's identifier cannot be resolved through this company's doors.
  const foreign=await data('/api/envelope/companies',{name:'Synthetic unrelated employer',ein:'00-0009402'},201)
  const foreignBase='/api/envelope/companies/'+foreign.id,foreignLoc=await data(foreignBase+'/locations',{name:'Other workplace',state:'NY'},201)
  const foreignPerson=await data(foreignBase+'/people',{name:'Synthetic private worker',locationId:foreignLoc.id},201)
  await refused(base+'/people/'+foreignPerson.id+'/ny-dbl',undefined,404)
  await refused(foreignBase+'/people/'+foreignPerson.id+'/ny-dbl/evidence',evidence([week(20000)]),404)
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM env_workspace_versions WHERE company_id='${foreign.id}'`))[0].n,0)
  const member='synthetic-envelope-9450',token=randomBytes(32).toString('base64url'),hashed=await hashToken(settings.SESSION_SECRET,'session',token),now=Date.now()
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic DBL preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now+3600000})`)
  await data(base+'/grants',{operatorId:member,version:0,role:'payroll-admin',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose','rates:approve']})
  const memberCookie=cookie.split('=')[0]+'='+token
  for(const [path,body] of [[plans,undefined],[p.door,undefined],[p.door+'/evidence',correction],[p.door+'/proposals',firstInput]]) await refused(path,body,403,memberCookie)
  await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${member}'`)
  await refused(p.door,undefined,401,memberCookie)
  await refused(p.door,undefined,401,'')
  await refused(p.door,undefined,403,cookie,{authorization:'Bearer synthetic-envelope-9451'})
  const stored=await sql("SELECT cipher FROM env_workspace_versions WHERE kind='ny-dbl-plan'")
  assert.ok(stored.length);assert.ok(stored.every(r=>!r.cipher.includes(plan.source.reference)))
  const audit=await data(base+'/audit')
  assert.ok(audit.some(r=>r.action==='workspace.ny-dbl-evidence.approved'))
  assert.ok(audit.some(r=>r.action==='workspace.ny-dbl-proposal.recorded'))
  // Employer-paid plans propose zero; reviewed source changes cannot revive old proposals.
  await data(plans,{...plan,version:1,employeeContributions:false,source:{...plan.source,version:'synthetic-envelope-9460'}},201)
  await refused(p.door+'/proposals',{...firstInput,version:2,evidenceVersion:2},409)
  await reviewPlan()
  const paid=await person();await approveEvidence(paid,evidence([week(20000)],{planVersion:2}))
  assert.equal((await data(paid.door+'/proposals',proposal(20000),201)).result.proposedCents,0)
  await restart()
  assert.equal((await data(plans))[0].version,2)
  // Existing legal custody doors erase this new record graph and fence stale replay.
  const ownerSession=(await sql('SELECT id,operator_id,operator_version FROM oa_sessions WHERE revoked_at IS NULL ORDER BY created_at LIMIT 1'))[0]
  await sql(`INSERT INTO oa_step_up_challenges(id,token_hash,session_id,operator_id,operator_version,action,return_to,created_at,expires_at,consumed_at) VALUES ('synthetic-envelope-dbl-proof','synthetic-envelope-9461','${ownerSession.id}','${ownerSession.operator_id}',${ownerSession.operator_version},'credentials:mint','/app',${Date.now()},${Date.now()+600000},${Date.now()})`)
  const privacy=base+'/people/'+paid.id+'/privacy',inventory=await data(privacy)
  assert.ok(inventory.retained.some(r=>r.key.kind==='ny-dbl-evidence'))
  assert.ok(inventory.retained.some(r=>r.key.kind==='ny-dbl-proposal'))
  const selection={fingerprint:inventory.fingerprint,records:inventory.retained.map(r=>r.id),consent:true,legalBasis:'Synthetic reviewed eligible release with no active hold.',custodian:'Native owner',earliestReleaseAt:'2000-01-01T00:00:00.000Z'}
  await data(privacy+'/retain',selection);await data(privacy+'/release',selection)
  await data(base+'/people/'+paid.id+'/erase',{version:inventory.version,...selection})
  await refused(paid.door,undefined,404)
  await refused(paid.door+'/evidence',evidence([week(20000)],{planVersion:2}),404)
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM env_workspace_versions WHERE person_id='${paid.id}'`))[0].n,0)
  assert.ok(!(await data(base+'/audit')).some(r=>r.targetId===paid.id),'erased DBL audit targets are anonymized')
  const ownerToken=randomBytes(32).toString('base64url'),ownerHash=await hashToken(settings.SESSION_SECRET,'session',ownerToken)
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-dbl-owner-session','${ownerHash}','${ownerSession.operator_id}',${ownerSession.operator_version},'native',${Date.now()},${Date.now()+3600000})`)
  const ownerCookie=cookie.split('=')[0]+'='+ownerToken
  assert.equal((await call(plans,undefined,ownerCookie)).status,200,'this synthetic owner credential is initially authorized')
  await sql("UPDATE oa_sessions SET revoked_at=1 WHERE id='synthetic-envelope-dbl-owner-session'")
  for(const [path,body] of [[plans,undefined],[p.door,undefined],[plans,{...plan,version:2}],[p.door+'/proposals',firstInput]]) await refused(path,body,401,ownerCookie)
  console.log('NY-DBL passed: reviewed statutory preparation, weekly and premium caps, split checks, concurrent earnings, migrated collections, source corrections, replay, restart, scoped refusals and unavailable remittance')
}
