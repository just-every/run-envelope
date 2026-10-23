import assert from 'node:assert/strict'

/** Populate archive resources through their existing public payroll doors. */
export async function populatedPayrollJourney({origin,cookie,api,locationId,ui,capture}) {
  const request=async(path,body,status=200)=>{const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(r.status,status,await r.clone().text());return r.json()}
  let person=await request(api+'/people',{name:'Synthetic retained payroll history worker',locationId},201)
  for(const [kind,value] of [['ssn','000-00-0257'],['bank','synthetic-envelope-258'],['tax','synthetic-envelope-259']]) await request(api+'/people/'+person.id+'/private',{kind,value,version:0},201)
  const rate=await request(api+'/people/'+person.id+'/rates',{version:person.version,hourlyCents:2400,effectiveDate:'2026-01-01'},201),review=await request(api+'/rates/'+rate.id)
  await request(api+'/rates/'+rate.id+'/approve',{reviewToken:review.reviewToken})
  person=await request(api+'/people/'+person.id)
  const grant=await request(api+'/agents',{name:'synthetic-envelope-260',hours:1,actions:['drafts:prepare','drafts:read'],fields:['compensation'],locations:[locationId]},201)
  const rpc=await fetch(origin+'/api/envelope/mcp',{method:'POST',headers:{origin,authorization:'Bearer '+grant.token,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:53,method:'tools/call',params:{name:'draft.prepare',arguments:{companyId:api.split('/').at(-1),personId:person.id,minutes:480,periodStart:'2026-01-05',periodEnd:'2026-01-11',payDate:'2026-01-12',sourceRef:'synthetic-envelope-261 reviewed input',requestKey:'synthetic-envelope-262'}}})})
  assert.equal(rpc.status,200,await rpc.clone().text())
  assert.equal(JSON.parse((await rpc.json()).result.content[0].text).status,'uncalculated-proposal')
  const work={id:'synthetic-envelope-263',version:0,day:'2026-01-05',state:'CA',locality:'Oakland',minutes:480,earnedCents:19200,officeState:'CA',nyReason:'not-applicable',sourceRef:'synthetic-envelope-264 reviewed actual time'}
  await request(api+'/people/'+person.id+'/allocations/work',work,201)
  const door=api+'/pay-settings',group='synthetic-envelope-265',change='synthetic-envelope-266',run='synthetic-envelope-267'
  const approve=async(kind,id)=>{const r=await request(door+'/review/'+kind+'/'+id);return request(door+'/'+kind+'/'+id+'/approve',{version:r.version,reviewToken:r.reviewToken})}
  await request(door+'/group',{id:group,version:0,name:'Archive source group',people:[person.id]},201);await approve('group',group)
  await request(door+'/pay-change',{id:change,version:0,name:'Archive source rate',groupId:group,effectiveDate:'2026-01-01',items:[{personId:person.id,personVersion:person.version,rateCents:2400,basis:'hourly',employmentFrom:'2026-01-01',employmentThrough:'2026-12-31',unpaidDates:[]}]},201);await approve('pay-change',change)
  const period={id:run,version:0,groupId:group,periodStart:'2026-01-05',periodEnd:'2026-01-11',payDate:'2026-01-12',frequency:'weekly'},first=await request(door+'/earnings-run',period,201)
  assert.equal(first.preview.people[0].earningsCents,19200)
  await request(api+'/people/'+person.id+'/allocations/work',{...work,version:1,minutes:600,earnedCents:24000,sourceRef:'synthetic-envelope-268 corrected reviewed actual time'},201)
  const corrected=await request(door+'/earnings-run',{...period,version:1},201)
  assert.equal(corrected.version,2);assert.equal(corrected.preview.people[0].earningsCents,24000)
  assert.equal(corrected.preview.paymentReady,false);assert.equal(corrected.preview.taxAmounts,null);assert.equal(corrected.preview.netPay,null)
  const exact=await request(door+'/earnings-run/'+run+'/review')
  await request(door+'/earnings-run/'+run+'/approve',{version:2,reviewToken:exact.reviewToken})
  const release=await fetch(origin+door+'/earnings-run/'+run+'/release',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({version:2})})
  assert.equal(release.status,409,'no complete calculation or authorized rail means no pretend payroll payment')
  await capture(ui+'/pay-settings','archive-populated-corrected-payroll')
  console.log('ARCHIVE-PAYROLL passed: real encrypted private records, reviewed rate, attributed MCP draft, approved group/pay terms, immutable 19200-to-24000 earnings correction and named human approval; tax/net/payment remain unavailable with AI disabled')
}
