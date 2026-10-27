import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { privateValue } from './privacy-recorder.mjs'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { localCookieName } from '../src/modules/operator-auth/http.mjs'

export async function taxNoticeJourney({origin,cookie,sql,settings,advanceClock}) {
 const call=(path,body,who=cookie)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':['application','json'].join('/')},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const data=async(path,body,status=200,who=cookie)=>{const r=await call(path,body,who);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const company=await data('/api/envelope/companies',{name:'Synthetic notice employer',ein:'00-0002525'},201),base='/api/envelope/companies/'+company.id
 const location=await data(base+'/locations',{name:'Ohio notice workplace',state:'OH'},201)
 const original=Buffer.from('%PDF-1.7\nSynthetic CP161. Employer 00-0002525. Q3 2026 deposit mismatch: $1,234.56 principal, $45.00 proposed penalty. Respond by October 28, 2026.\n%%EOF')
 const pdf=original.toString('base64')
 const notice=await data(base+'/notices',{locationId:location.id,reference:'Synthetic CP161 deposit notice',body:original.toString()},201),door=base+'/notices/'+notice.id+'/case',screen=door.replace('/api/','/app/')
 const input={version:0,type:'deposit-mismatch',agency:'IRS',employerEin:'00-0002525',periodStart:'2026-07-01',periodEnd:'2026-09-30',dueOn:'2026-10-28',principalCents:123456,proposedPenaltyCents:4500,pdf,quote:'CP161: principal $1,234.56; proposed penalty $45.00.',rawExtraction:'OCR: principal 1234.56; period mistakenly read as Q2.',verifiedExtraction:true}
 const get=async()=> (await data(door))[0]
 const proof=process.env.ENVELOPE_PROOF_DIR ?? '/tmp/envelope-tax-notices';await mkdir(proof,{recursive:true})
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try {
  const context=await browser.newContext(),[name,value]=cookie.split('=');await context.addCookies([{name,value,url:origin}]);const page=await context.newPage()
  const capture=async (label,target=screen)=>{
   for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});await page.goto(origin+target);await page.locator('h1').waitFor()
    if(label==='sui-review-ready') await page.getByText('Link an exact reviewed SUI edition',{exact:true}).click()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' has no page overflow')
    assert.equal(await page.locator('button').evaluateAll(nodes=>nodes.every(n=>n.textContent.trim().length>1)),true,'Notice controls have visible labels')
    await page.screenshot({path:join(proof,'notice-'+label+'-'+width+'.png'),fullPage:true})
   }
  }
  await capture('empty')
  await data(door,{...input,employerEin:'00-0002526'},409)
  await data(door,{...input,verifiedExtraction:false},409)
  await data(door,{...input,principalCents:''},400)
  await data(door,{...input,pdf:Buffer.from('not a PDF').toString('base64')},400)
  assert.deepEqual(await data(door),[],'Unsafe intake creates no case')
  // Exercise the real native multipart upload and keyboard submission at one width.
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+screen)
  const form=page.locator('form[action$="/case"]')
  await form.locator('[name="type"]').selectOption('deposit-mismatch')
  for(const key of ['agency','employerEin','periodStart','periodEnd','dueOn','principalCents','proposedPenaltyCents','quote','rawExtraction']) await form.locator('[name="'+key+'"]').fill(String(input[key]))
  await form.locator('[name="pdf"]').setInputFiles({name:'synthetic-envelope-2525.pdf',mimeType:['application','pdf'].join('/'),buffer:original})
  await form.locator('[name="verifiedExtraction"]').check();await form.getByRole('button',{name:'Save verified case version',exact:true}).focus();const [submitted]=await Promise.all([page.waitForResponse(r=>r.request().method()==='POST' && r.url()===origin+screen),page.waitForNavigation({waitUntil:'load'}),page.keyboard.press('Enter')]);assert.equal(submitted.status(),303);await page.waitForLoadState('load')
  let row=await get();assert.equal(row.version,1);assert.equal(row.data.residualCents,null);assert.equal(row.data.assessedPenaltyCents,null);assert.equal(row.resolved,false);assert.equal(row.overdue,false);assert.equal(row.payrollChanged,false)
  assert.equal(row.data.facts.principalCents,123456);assert.equal(row.data.facts.proposedPenaltyCents,4500);assert.ok(row.data.ownerId)
  const download=await call(door+'/original/1/0');assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),original);assert.equal(download.headers.get('cache-control'),'no-store')
  await capture('verified')
  const staleReview=await data(door+'/review'),correction={...input,version:1,correctionReason:'Human checks the original: Q3, not the raw OCR Q2.'};delete correction.pdf;delete correction.rawExtraction
  await data(door,correction,201)
  await data(door+'/approve',{version:staleReview.version,reviewToken:staleReview.reviewToken},409)
  await data(door,{...correction,version:2,pdf},409)
  row=await get();assert.equal(row.data.rawExtraction,input.rawExtraction);assert.equal(row.data.correctionReason,correction.correctionReason);assert.equal((await data(door)).length,2)
  await capture('case-exact-review',screen+'/review')
  const review=await data(door+'/review');await data(door+'/approve',{version:review.version,reviewToken:review.reviewToken})
  assert.ok((await get()).approvedBy)
  const evidence={version:2,kind:'deposit',reference:'synthetic-envelope-deposit-2525',employerEin:input.employerEin,periodStart:input.periodStart,periodEnd:input.periodEnd,pdf,quote:'Synthetic deposit confirmation: Q3, $1,234.56.',amountCents:123456}
  await data(door+'/evidence',{...evidence,periodStart:'2026-04-01'},409)
  await data(door+'/evidence',{...evidence,employerEin:'00-0002526'},409)
  await data(door+'/evidence',evidence)
  const afterEvidence=await get();assert.equal(afterEvidence.data.evidence[0].amountCents,123456);assert.equal(afterEvidence.approvedBy,null,'New evidence requires new exact review');assert.equal(afterEvidence.data.residualCents,null,'Deposit proof never fabricates a zero balance')
  assert.equal((await data(door+'/evidence',evidence)).replayed,true)
  await data(door+'/evidence',{...evidence,amountCents:999},409)
  await advanceClock('2026-10-29T00:00:30Z')
  row=await get();assert.equal(row.overdue,true);assert.match(row.nextAction,/Urgent/);assert.equal(row.data.facts.dueOn,'2026-10-28')
  const closure={...evidence,version:3,kind:'agency-response',reference:'synthetic-envelope-agency-2525',quote:'Synthetic agency report: principal reconciled; assessed $45, abated $40, remaining $5.',residualCents:500,assessedPenaltyCents:4500,abatedPenaltyCents:4000,reviewedAgencyEvidence:true}
  await data(door+'/evidence',{...closure,reviewedAgencyEvidence:false},409)
  await data(door+'/evidence',{...closure,residualCents:undefined},400)
  await data(door+'/evidence',{...closure,abatedPenaltyCents:4600},409)
  await data(door+'/evidence',closure)
  row=await get();assert.equal(row.data.status,'closure-reported');assert.equal(row.data.residualCents,500);assert.equal(row.data.assessedPenaltyCents,4500);assert.equal(row.data.abatedPenaltyCents,4000);assert.equal(row.resolved,false);assert.equal(row.independentlyVerifiedAgencyDisposition,false);assert.equal(row.overdue,true)
  assert.equal((await data(door+'/evidence',closure)).replayed,true)
  await data(door+'/evidence',{...closure,residualCents:0},409)
  await capture('reported-closure')
  await data(door+'/evidence',{...evidence,version:4,reference:'synthetic-envelope-late-deposit'},409)
  await data(door+'/evidence',{...evidence,version:4,kind:'reopening',reference:'synthetic-envelope-reopened-2525',quote:'Synthetic agency requests further proof; earlier disposition reopened.'})
  row=await get();assert.equal(row.data.status,'reopened');assert.equal(row.data.residualCents,null);assert.equal(row.data.evidence.length,3);assert.equal(row.data.evidence[1].disposition.residualCents,500);assert.equal(row.data.facts.proposedPenaltyCents,4500);assert.equal(row.data.facts.dueOn,'2026-10-28')
  const retained=await call(door+'/original/4/2');assert.deepEqual(Buffer.from(await retained.arrayBuffer()),original)
  await capture('reopened')
  // A separately reviewed official-source SUI edition can be linked, never self-approved by a notice.
  const owner=(await data(base+'/grants')).find(g=>g.role==='owner').operatorId,backup='synthetic-envelope-2526',token=randomBytes(32).toString('base64url'),hash=await hashToken(settings.SESSION_SECRET,'session',token)
  await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${backup}','synthetic-envelope-2526@example.com','Notice backup','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('synthetic-envelope-notice-session','${hash}','${backup}',1,'native',${Date.parse('2026-10-27T00:00:00Z')},${Date.parse('2026-11-01T00:00:00Z')})`)
  await data(base+'/grants',{operatorId:backup,version:0,role:'payroll-admin',locations:['*'],fields:['tax','compensation'],actions:['records:read','records:write','rates:propose','rates:approve','notices:read','notices:write','notices:approve']})
  const who=localCookieName('operator_session_local',origin)+'='+token
  for(const path of [door,door+'/review',door+'/original/1/0']) assert.equal((await call(path,undefined,who)).status,403,'Delegated notice scope does not gain the conservative owner case permission')
  const sui=await data(base+'/notices',{locationId:location.id,reference:'Synthetic Ohio SUI rate letter',body:'Synthetic Ohio SUI rate 2.7%, effective January 1, 2026.'},201),suiDoor=base+'/notices/'+sui.id+'/case'
  await data(suiDoor,{...input,type:'sui-rate',agency:'Ohio unemployment',state:'OH',ratePercent:'2.7',effectiveFrom:'2026-01-01',principalCents:0,proposedPenaltyCents:0},201)
  let sr=(await data(suiDoor))[0]
  const rule={id:'synthetic-envelope-notice-sui',version:0,name:'Ohio SUI assigned rate',family:'sui',state:'OH',locality:'',effectiveFrom:'2026-01-01',effectiveThrough:'2026-12-31',publishedDate:'2025-12-01',sourceUrl:'https://jfs.ohio.gov/',sourceTitle:'Synthetic agency rate letter',sourceRef:'notice:'+sui.id+':'+sr.data.original.sha256,edition:'2026',taxYear:2026,determination:'final',value:'2.7',unit:'percent',ownerId:owner,backupId:backup,approvalDue:'2026-10-28T12:00:00Z',wageDeadline:'2026-10-30T12:00:00Z'}
  await data(base+'/rules',rule,201)
  await data(suiDoor+'/link-rate',{version:1,ruleId:rule.id,ruleVersion:1},409)
  const suiReview=await data(suiDoor+'/review');await data(suiDoor+'/approve',{version:suiReview.version,reviewToken:suiReview.reviewToken})
  await data(suiDoor+'/link-rate',{version:1,ruleId:rule.id,ruleVersion:1},401,'')
  await data(suiDoor+'/link-rate',{version:1,ruleId:rule.id,ruleVersion:1},409)
  const ruleReview=await data(base+'/rules/review/'+rule.id);await data(base+'/rules/'+rule.id+'/approve',{version:ruleReview.version,reviewToken:ruleReview.reviewToken})
  await capture('sui-review-ready',suiDoor.replace('/api/','/app/'))
  await data(suiDoor+'/link-rate',{version:1,ruleId:rule.id,ruleVersion:1})
  sr=(await data(suiDoor))[0];assert.deepEqual(sr.data.rate,{id:rule.id,version:1});assert.equal(sr.payrollChanged,false);assert.equal(sr.sourcesCurrent,1)
  await capture('sui-reviewed-link',suiDoor.replace('/api/','/app/'))
  const linkedEvidence={...evidence,version:2,reference:'synthetic-envelope-current-rule'}
  await data(suiDoor+'/evidence',linkedEvidence)
  sr=(await data(suiDoor))[0];assert.equal(sr.version,3);assert.equal(sr.sourcesCurrent,1);assert.deepEqual(sr.data.rate,{id:rule.id,version:1})
  await data(base+'/rules/'+rule.id+'/withdraw',{version:1})
  assert.equal((await data(suiDoor))[0].sourcesCurrent,0)
  await data(suiDoor+'/evidence',{...linkedEvidence,version:3,reference:'synthetic-envelope-withdrawn-rule'},409)
  assert.equal((await data(suiDoor))[0].version,3)
  await data(base+'/rules',{...rule,version:1,value:'2.8'},201)
  assert.equal((await data(suiDoor))[0].sourcesCurrent,0,'Changed SUI rule cannot remain current on the case')
  const staleEvidence={...evidence,version:3,reference:'synthetic-envelope-stale-rule'}
  await data(suiDoor+'/evidence',staleEvidence,409)
  assert.equal((await data(suiDoor))[0].version,3,'Stale linked evidence cannot manufacture a current version')
  await data(suiDoor+'/review',undefined,409)
  // Worker-specific legacy lock-in settings constrain the existing public paper-election door.
  const person=await data(base+'/people',{name:'Synthetic lock-in employee',locationId:location.id},201),instructionDoor=base+'/people/'+person.id+'/withholding-instructions',paperDoor=base+'/people/'+person.id+'/paper-onboarding'
  await data(base+'/people/'+person.id+'/private',{kind:'ssn',version:0,value:'900-25-2525'},201)
  const lockPdf=Buffer.from('%PDF-1.7\nDepartment of the Treasury, Internal Revenue Service. Letter 2800C. Employer 00-0002525. Employee 900-25-2525. Letter date August 1, 2026. Begin withholding single, maximum 1 allowance, effective September 30, 2026.\n%%EOF').toString('base64')
  privateValue('900-25-2525');privateValue('900252525');privateValue(lockPdf)
  const instruction={version:0,kind:'2800C',pdf:lockPdf,quote:'Letter 2800C: single, maximum 1 allowance, effective September 30, 2026.',employerEin:'00-0002525',workerSsn:'900-25-2525',letterOn:'2026-08-01',receivedOn:'2026-08-03',effectiveFrom:'2026-09-30',filingStatus:'single',maximumAllowances:1,minimumAdditionalCents:0,authenticated:true,authenticationMethod:'verified-agency-correspondence',authenticationReference:'Synthetic separately checked IRS correspondence reference'}
  await data(instructionDoor,{...instruction,authenticated:false},409)
  await data(instructionDoor,{...instruction,workerSsn:'900-25-2526'},409)
  await data(instructionDoor,{...instruction,effectiveFrom:'2026-09-29'},400)
  await capture('instruction-empty',instructionDoor.replace('/api/','/app/'))
  await data(instructionDoor,instruction,201)
  await capture('instruction-pending',instructionDoor.replace('/api/','/app/'))
  const paperOriginal={signed:true,signedBy:'Synthetic lock-in employee',signedOn:'2019-12-01',pdf}
  const paper={version:0,attestTranscription:true,workerType:'employee',hiredOn:'2019-01-01',paymentMethod:'paper-check',tin:'900252525',address:'1 Synthetic Street, Columbus OH 43215',federal:{form:'W-4-pre2020',effectiveFrom:'2026-10-01',original:paperOriginal,fields:{filingStatus:'single',allowances:1,additionalCents:0,exempt:'no'}},state:{form:'OH-IT-4',effectiveFrom:'2026-10-01',original:{...paperOriginal,signedOn:'2026-10-01'},fields:{residenceAddress:'1 Synthetic Street, Columbus OH 43215',schoolDistrictName:'Synthetic Columbus',schoolDistrictNumber:'2503',allowances:1,additionalCents:0,localExemption:'none'}}}
  await data(paperDoor,paper,409)
  // A pending stricter modification remains a hold beneath a pending release.
  const pendingPerson=await data(base+'/people',{name:'Synthetic pending instruction employee',locationId:location.id},201)
  const pendingDoor=base+'/people/'+pendingPerson.id+'/withholding-instructions',pendingPaper=base+'/people/'+pendingPerson.id+'/paper-onboarding'
  await data(base+'/people/'+pendingPerson.id+'/private',{kind:'ssn',version:0,value:'900-25-2525'},201)
  await data(pendingDoor,instruction,201)
  const pr=await data(pendingDoor+'/review');await data(pendingDoor+'/approve',{version:pr.version,reviewToken:pr.reviewToken})
  const pendingModification={...instruction,version:1,kind:'modification',letterOn:'2026-10-29',receivedOn:'2026-10-29',effectiveFrom:'2026-10-29',maximumAllowances:0}
  await data(pendingDoor,pendingModification,201)
  await data(pendingDoor,{...pendingModification,version:2,kind:'release'},201)
  const pendingElection={...paper,federal:{...paper.federal,effectiveFrom:'2026-10-29'}}
  await data(pendingPaper,pendingElection,409)
  assert.deepEqual(await data(pendingPaper),[],'A pending release cannot hide a stricter pending instruction')
  const pendingReleaseReview=await data(pendingDoor+'/review')
  await data(pendingDoor+'/approve',{version:pendingReleaseReview.version,reviewToken:pendingReleaseReview.reviewToken})
  await data(pendingPaper,pendingElection,201)
  assert.equal((await data(pendingPaper))[0].data.federal.fields.allowances,1,'An exact approved release supersedes the pending modification')
  assert.equal((await data(pendingPaper))[0].payable,false)
  // Private identity changes invalidate both review preparation and an issued token.
  const identityPerson=await data(base+'/people',{name:'Synthetic changed identity employee',locationId:location.id},201)
  const identityDoor=base+'/people/'+identityPerson.id+'/withholding-instructions',privateDoor=base+'/people/'+identityPerson.id+'/private'
  await data(privateDoor,{kind:'ssn',version:0,value:'900-25-2525'},201)
  await data(identityDoor,instruction,201)
  const identityReview=await data(identityDoor+'/review')
  await data(privateDoor,{kind:'ssn',version:1,value:'900-25-2526'},201)
  await data(identityDoor+'/approve',{version:identityReview.version,reviewToken:identityReview.reviewToken},409)
  await data(identityDoor+'/review',undefined,409)
  await data(privateDoor,{kind:'ssn',version:2,value:'900-25-2525'},201)
  await data(identityDoor+'/approve',{version:identityReview.version,reviewToken:identityReview.reviewToken},409)
  assert.equal((await data(identityDoor))[0].approvedBy,null,'Restoring the same SSN does not revive old review authority')
  assert.equal((await data(identityDoor))[0].sourcesCurrent,0)
  await capture('instruction-exact-review',instructionDoor.replace('/api/','/app/')+'/review')
  const ir=await data(instructionDoor+'/review');await data(instructionDoor+'/approve',{version:ir.version,reviewToken:ir.reviewToken})
  await capture('instruction-approved',instructionDoor.replace('/api/','/app/'))
  const election=fields=>({...paper,federal:{...paper.federal,fields:{...paper.federal.fields,...fields}}})
  for(const fields of [{allowances:2},{filingStatus:'married'},{exempt:'yes'}]) await data(paperDoor,election(fields),409)
  await data(paperDoor,{...paper,tin:'900252526'},409)
  assert.deepEqual(await data(paperDoor),[],'Unsupported lower elections create no paper version')
  await data(paperDoor,election({allowances:0,additionalCents:2500}),201)
  let paperRows=await data(paperDoor);assert.equal(paperRows[0].data.federal.fields.allowances,0);assert.equal(paperRows[0].data.federal.fields.additionalCents,2500);assert.equal(paperRows[0].payable,false)
  const source=await call(instructionDoor+'/original/1');assert.deepEqual(Buffer.from(await source.arrayBuffer()),Buffer.from(lockPdf,'base64'))
  for(const target of [instructionDoor,instructionDoor+'/original/1',paperDoor]) assert.equal((await call(target,undefined,who)).status,403)
  await advanceClock('2026-10-30T00:00:30Z')
  const modification={...instruction,pdf:Buffer.from('%PDF-1.7\nSynthetic IRS Letter 2808C. Employee 900-25-2525. Single, maximum 3 allowances, effective on receipt October 30, 2026.\n%%EOF').toString('base64'),version:1,kind:'modification',letterOn:'2026-10-30',receivedOn:'2026-10-30',effectiveFrom:'2026-10-30',maximumAllowances:3,quote:'Synthetic authenticated IRS modification permits 3 allowances immediately on receipt.'}
  await data(instructionDoor,modification,201)
  await data(paperDoor+'/review',undefined,409)
  await data(paperDoor,{...election({allowances:3}),version:1,federal:{...paper.federal,effectiveFrom:'2026-10-30',fields:{...paper.federal.fields,allowances:3}}},401,'')
  await data(paperDoor,{...election({allowances:3}),version:1,federal:{...paper.federal,effectiveFrom:'2026-10-30',fields:{...paper.federal.fields,allowances:3}}},409)
  const mr=await data(instructionDoor+'/review');await data(instructionDoor+'/approve',{version:mr.version,reviewToken:mr.reviewToken})
  await data(paperDoor,{...election({allowances:3}),version:1,federal:{...paper.federal,effectiveFrom:'2026-10-30',fields:{...paper.federal.fields,allowances:3}}},201)
  const release={...modification,pdf:Buffer.from('%PDF-1.7\nSynthetic authenticated IRS written release of this employee lock-in effective on receipt October 30, 2026.\n%%EOF').toString('base64'),version:2,kind:'release',quote:'Synthetic independently checked IRS release on receipt.'}
  await data(instructionDoor,release,201)
  await data(paperDoor,{...election({allowances:5}),version:2,federal:{...paper.federal,effectiveFrom:'2026-10-30',fields:{...paper.federal.fields,allowances:5}}},409)
  const rr=await data(instructionDoor+'/review');await data(instructionDoor+'/approve',{version:rr.version,reviewToken:rr.reviewToken})
  await data(paperDoor,{...election({allowances:5}),version:2,federal:{...paper.federal,effectiveFrom:'2026-10-30',fields:{...paper.federal.fields,allowances:5}}},201)
  await data(base+'/people/'+person.id+'/private',{kind:'ssn',version:1,value:'900-25-2526'},201)
  await data(paperDoor,{...election({allowances:5}),version:3,federal:{...paper.federal,effectiveFrom:'2026-10-30',fields:{...paper.federal.fields,allowances:5}}},409)
  await data(instructionDoor,{...release,version:3,workerSsn:'900-25-2526'},409)
  const instructions=await data(instructionDoor);assert.deepEqual(instructions.map(r=>r.data.kind),['release','modification','2800C']);assert.ok(instructions.every(r=>r.createdBy===owner && r.approvedBy===owner && Number.isFinite(r.createdAt) && Number.isFinite(r.approvedAt)));assert.equal(instructions[2].data.maximumAllowances,1);assert.equal(instructions[0].data.priorVersion,2)
  for(const width of [1440,390]) {await page.setViewportSize({width,height:1000});await page.goto(origin+instructionDoor.replace('/api/','/app/'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(proof,'withholding-instruction-history-'+width+'.png'),fullPage:true})}
  const foreign=await data('/api/envelope/companies',{name:'Synthetic foreign notice employer',ein:'00-0002526'},201)
  assert.equal((await call(door.replace(company.id,foreign.id))).status,403)
  assert.equal((await call(door,undefined,'')).status,401)
  assert.equal((await call(door+'/original/1/0',undefined,'')).status,401)
  const bearer=await fetch(origin+instructionDoor,{headers:{authorization:'Bearer synthetic-envelope-2525'}});assert.equal(bearer.status,403)
  const mixed=await fetch(origin+door,{headers:{cookie,authorization:'Bearer synthetic-envelope-2525'}});assert.equal(mixed.status,403)
  await call('/auth/signout',{})
  for(const target of [door,door+'/original/1/0',instructionDoor,instructionDoor+'/original/1']) assert.equal((await call(target)).status,401,'Sign-out immediately denies each new case and original transport')
  const counts=await sql(`SELECT (SELECT COUNT(*) FROM env_notice_dispatches) AS dispatches,(SELECT COUNT(*) FROM env_workspace_versions WHERE kind='earnings-run') AS runs`)
  assert.deepEqual(counts,[{dispatches:0,runs:0}],'Case evidence creates no send or payroll run')
 } finally {await browser.close()}
 console.log('TAX-NOTICE-CASES passed: original custody, checked extraction and correction, exact review, deposit evidence, honest nonzero disposition, replay, overdue and reopening, exact reviewed SUI linkage and current owner refusals; legacy worker-matched IRS instruction review, lower-election refusal, higher elections and reviewed modification or release; selected screens at 1440 and 390. Payroll and independent agency closure remain unproved.')
}
