import {populatedPayrollJourney} from '../custody/populated-payroll.mjs'
import assert from 'node:assert/strict'

/** Real case doors with immutable private source files; agency text is synthetic evidence. */
export async function noticeCaseJourney({origin,cookie,api,ui,noticeId,page,capture,ownerId,limitedCookie,sql}) {
  const path=api+'/notices/'+noticeId,view=ui+'/notices/'+noticeId,
    call=(suffix,body,who=cookie)=>fetch(origin+path+suffix,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),
    data=async(suffix,body,status=200,who=cookie)=>{const r=await call(suffix,body,who);assert.equal(r.status,status,await r.clone().text());return r.json()}
  const upload=async(name,body)=>{
    const form=new FormData();form.set('file',new File([body],name,{type:'text/plain'}));form.set('version','0')
    const response=await fetch(origin+path+'/files',{method:'POST',headers:{cookie,origin},body:form});assert.equal(response.status,201,await response.clone().text());return response.json()
  }
  const proof=await upload('deposit-proof.txt','Synthetic bank evidence format\nEmployer reference: synthetic-envelope-250\nEFTPS confirmation: synthetic-envelope-251\nTax period: 2026-Q3\nAmount: USD 1,250.00\nThis fixture is not a live bank or agency receipt.')
  const disposition=await upload('agency-disposition.txt','Synthetic agency correspondence format\nDepartment of the Treasury — Internal Revenue Service\nNotice reference: CP161 synthetic-envelope-250\nTax period: 2026-Q3\nApplied deposit: USD 1,250.00\nPenalty abated: USD 25.00\nRemaining balance: USD 50.00\nThis fixture is not a live agency receipt.')
  await page.goto(origin+view)
  await page.getByLabel('Issuing agency',{exact:true}).fill('Internal Revenue Service')
  await page.getByLabel('EIN read from the original',{exact:true}).fill('00-0000999')
  await page.getByLabel('Notice period',{exact:true}).fill('2026-Q3')
  await page.getByLabel('Responsible human operator ID',{exact:true}).fill(ownerId)
  await page.getByLabel('Response deadline in UTC (YYYY-MM-DDTHH:mm:ssZ)',{exact:true}).fill('2026-01-15T17:00:00Z')
  await page.getByLabel('Reported amount in cents',{exact:true}).fill('125000')
  await page.getByRole('button',{name:'Assign notice case',exact:true}).click()
  await page.waitForURL(origin+view)
  let current=await data('/case')
  assert.equal(current.latest.version,1)
  assert.equal(current.latest.data.state,'needs-review')
  assert.equal(current.latest.data.remainingLiabilityCents,null,'unmatched notice never invents a zero balance')
  assert.equal(current.overdue,true)
  assert.equal(current.deadlineBreached,true)
  await capture(view,'notice-case-wrong-ein-overdue')
  const event=async(action,extra={},status=200,who=cookie)=>{
    const latest=(await data('/case')).latest
    return data('/case',{version:latest.version,action,fileId:proof.id,fileVersion:1,note:'Human-verified source: synthetic-envelope-251.',...extra},status,who)
  }
  await event('agency-close',{fileId:disposition.id,confirm:true,remainingLiabilityCents:5000,actualAbatementCents:0},409)
  await event('ocr-correction',{ein:'00-0000999',reportedAmountCents:125000},409)
  await event('ocr-correction',{ein:'00-0000052',reportedAmountCents:130000})
  current=await data('/case')
  assert.equal(current.latest.data.state,'open')
  assert.equal(current.latest.data.reportedAmountCents,130000)
  assert.equal(current.history[1].data.reportedAmountCents,125000,'incorrect extraction remains immutable evidence')
  assert.equal(current.history[1].data.einMatched,false)
  await event('deposit-proof')
  await event('claimed-abatement',{claimedAbatementCents:2500})
  await event('agency-close',{fileId:disposition.id,remainingLiabilityCents:5000,actualAbatementCents:2500},409)
  await event('agency-close',{fileId:disposition.id,confirm:true,remainingLiabilityCents:5000,actualAbatementCents:5000},409)
  await event('agency-close',{fileId:'synthetic-envelope-252',confirm:true,remainingLiabilityCents:5000,actualAbatementCents:2500},409)
  // A preparer with write scope cannot record an approved agency disposition.
  await event('agency-close',{fileId:disposition.id,confirm:true,remainingLiabilityCents:5000,actualAbatementCents:2500},403,limitedCookie)
  await capture(view,'notice-case-proof-and-claim')
  await page.locator('select[name="action"]').selectOption('agency-close')
  await page.getByLabel('Supporting private file ID',{exact:true}).fill(disposition.id)
  await page.getByLabel('Evidence note and source citation',{exact:true}).fill('Reviewed original agency disposition, synthetic-envelope-250.')
  await page.getByLabel('Agency-supported abatement in cents',{exact:true}).fill('2500')
  await page.getByLabel('Agency-supported remaining liability in cents',{exact:true}).fill('5000')
  await page.getByLabel('I verified this agency disposition and its remaining balance from the cited original.',{exact:true}).check()
  await page.getByRole('button',{name:'Append cited case event',exact:true}).click()
  await page.waitForURL(origin+view)
  current=await data('/case')
  assert.equal(current.latest.data.state,'resolved')
  assert.equal(current.latest.data.remainingLiabilityCents,5000,'resolution preserves the actual nonzero balance')
  assert.equal(current.latest.data.claimedAbatementCents,2500)
  assert.equal(current.latest.data.actualAbatementCents,2500)
  assert.equal(current.deadlineBreached,true,'closure never erases a missed deadline')
  await capture(view,'notice-case-agency-disposition')
  await event('deposit-proof',{},409)
  await event('agency-reopen',{fileId:disposition.id,note:'Agency requests further deposit allocation proof; reopen synthetic-envelope-250.'})
  current=await data('/case')
  assert.equal(current.latest.data.state,'open')
  assert.equal(current.latest.data.remainingLiabilityCents,null)
  assert.equal(current.overdue,true)
  assert.equal(current.history.some(h=>h.data.state==='resolved'),true)
  assert.ok(current.latest.data.events.every(e=>e.actorId && e.at))
  assert.equal(current.latest.data.events.at(-1).file.digest,disposition.digest)
  const stale=await data('/case',{version:1,action:'deposit-proof',fileId:proof.id,fileVersion:1,note:'Stale append must fail.'},409)
  assert.equal(stale.error,'notice_case_changed')
  const raw=JSON.stringify(await sql('SELECT cipher FROM env_notice_case_versions'))
  assert.equal(raw.includes('130000'),false,'case amounts and evidence notes remain encrypted')
  await capture(view,'notice-case-agency-reopened')
  // A real second source follows the already-built human rule door. No case
  // flag, source text or model proposal can approve its SUI rate.
  const request=async(path,body,status=200)=>{
    const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(r.status,status,await r.clone().text());return r.json()
  }
  const source='Synthetic DE 2088 format — State of California Employment Development Department. Notice of Contribution Rates and Statement of UI Reserve Account. Calendar year 2026. Federal EIN 00-0000052. UI contribution rate 3.40 percent effective January 1, 2026. Human review is required; this is not a live agency determination.'
  const sui=await request(api+'/notices',{reference:'Synthetic DE 2088 rate letter',locationId:(await data('')).locationId,body:source},201),suiPath=api+'/notices/'+sui.id,
    suiDetail=await request(suiPath),backup='synthetic-envelope-253'
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('${backup}','synthetic-envelope-253@example.com','Notice rate backup','member','active',1,1)`)
  await request(api+'/grants',{operatorId:backup,version:0,role:'approver',locations:['*'],fields:['compensation','tax'],actions:['records:read','rates:approve']})
  await request(suiPath+'/case',{version:0,action:'intake',kind:'sui-rate',agency:'California Employment Development Department',ein:'00-0000052',period:'2026',ownerId,deadline:'2026-12-01T17:00:00Z',reportedAmountCents:0})
  const form=new FormData();form.set('file',new File([source],'de-2088-source.txt',{type:'text/plain'}));form.set('version','0')
  const originalFile=await fetch(origin+suiPath+'/files',{method:'POST',headers:{cookie,origin},body:form});assert.equal(originalFile.status,201)
  const suiFile=await originalFile.json(),ruleId='synthetic-envelope-256',rule={id:ruleId,version:0,name:'Reviewed synthetic DE 2088 SUI rate',family:'sui',state:'CA',locality:'',effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',publishedDate:'2025-12-15',sourceUrl:'https://edd.ca.gov/en/payroll_taxes/notice_of_contribution_rates/',sourceTitle:'DE 2088 Notice of Contribution Rates and Statement of UI Reserve Account',sourceRef:'notice:'+sui.id+':'+suiDetail.digest,edition:'synthetic-envelope-255',taxYear:2026,determination:'final',value:'3.4',unit:'percent',details:{},ownerId,backupId:backup,approvalDue:'2026-01-04T12:00:00Z',wageDeadline:'2026-01-05T12:00:00Z'}
  await request(api+'/rules',rule,201)
  const link={version:1,action:'rate-applied',fileId:suiFile.id,fileVersion:1,note:'Human-reviewed source letter and current approved rule.',reference:ruleId}
  await request(suiPath+'/case',link,409)
  const review=await request(api+'/rules/review/'+ruleId)
  await request(api+'/rules/'+ruleId+'/approve',{version:review.version,reviewToken:review.reviewToken})
  await request(suiPath+'/case',link)
  const linked=await request(suiPath+'/case')
  assert.equal(linked.latest.data.events.at(-1).reference,ruleId+'@1')
  const rules=await request(api+'/rules')
  assert.ok(JSON.stringify(rules).includes(rule.sourceRef),'applied rule retains the immutable notice source')
  await capture(ui+'/notices/'+sui.id,'notice-sui-reviewed-rule-linked')
  await populatedPayrollJourney({origin,cookie,api,locationId:suiDetail.locationId,ui,capture})
  console.log('NOTICE-CASES passed: native case intake, wrong-EIN ambiguity and OCR repair, immutable provenance/owner/deadline, deposit proof and distinct claimed/actual abatement, current human-approved source-backed nonzero agency disposition, retained missed deadline, reopening and stale/unauthorized refusal at 1440/390')
}
