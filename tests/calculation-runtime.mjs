import {randomBytes} from 'node:crypto'
import {hashToken} from '../src/modules/operator-auth/crypto.mjs'
import assert from 'node:assert/strict'
import { ordinaryW4 } from './industry-fixture.mjs'

// One public-door sanity journey: actual payroll arithmetic, refusal and coverage.
export async function calculationJourney({origin,cookie,sql,restart,settings}) {
 const call=(path,body,who=cookie)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':['application','json'].join('/')},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const data=async(path,body,status=200)=>{const r=await call(path,body);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const company=await data('/api/envelope/companies',{name:'Synthetic calculation employer',ein:'00-0009601'},201)
 const door='/api/envelope/companies/'+company.id+'/calculation-preview'
 const fixture={edition:'2026-01',payDate:'2026-10-30',from:'2026-10-19',through:'2026-10-25',frequency:'weekly',workState:'TX',residentState:'TX',locality:'none',
   remuneration:{kind:'salary',exempt:true,cashCents:100000},w4:ordinaryW4,stateElection:{},
   yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,suiWagesCents:0},tips:{heldCents:0,paycheckCents:0,furnishedCents:0},deductions:[]}
 const preview=await data(door,fixture)
 assert.deepEqual(preview.federal.employeeTaxes,{incomeTaxCents:7808,socialSecurityCents:6200,medicareCents:1450,additionalMedicareCents:0})
 assert.equal(preview.federal.netCashCents,84542)
 assert.equal(preview.federal.withholding.calculation.rateBasisPoints,1200)
 assert.equal(preview.federal.withholding.calculation.annualBracketFloorCents,1990000)
 assert.equal(preview.federal.withholding.calculation.adjustedAnnualWagesCents,4340000)
 assert.equal(preview.paymentReady,false);assert.equal(preview.dispatch,'unavailable')
 assert.equal(preview.coverage.total,51);assert.equal(preview.coverage.complete,false)
 assert.equal(new Set(preview.coverage.states.map(s=>s.state)).size,51)
 assert.deepEqual(preview.coverage.states.map(s=>s.state).sort(),'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ').sort(),'The independent fifty-state and DC denominator cannot shrink')
 for(const entry of preview.coverage.states){
   assert.equal(entry.programInventory.status,'unmapped')
   assert.equal(entry.programInventory.amountCents,null,'A reference UI floor cannot become an assigned employer tax')
   assert.ok(entry.programInventory.unemploymentReference.wageBaseDollars.length)
   assert.equal(entry.programInventory.otherPrograms,'unverified')
 }
 for(const [state,program] of [['WA','L&I'],['OR','Workers Benefit Fund'],['HI','TDI'],['NY','DBL'],['OH','BWC'],['ND','WSI'],['WY','DWS']])assert.ok(preview.coverage.states.find(s=>s.state===state).programInventory.requiredPrograms.some(p=>p.includes(program)),state+' mandatory non-withholding assessment is retained')
 const coverage=await data(door.replace('calculation-preview','calculation-coverage'))
 assert.deepEqual(coverage,preview.coverage)
 const cases=[
  ['TX',{},0],['AK',{},0],['FL',{},0],['NV',{},0],['SD',{},0],['TN',{},0],['WY',{},0],['CA',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},2777],
  ['NC',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},3100],
  ['KY',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},3274],
  ['MI',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},4250],
  ['IN',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},2950],
  ['HI',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},4834],
  ['RI',{filingStatus:'single',allowances:0,additionalCents:0},3750],
  ['LA',{standardDeduction:1,additionalCents:0},2325],
  ['WV',{table:'one-earner-one-job',allowances:0,additionalCents:0},3100],
  ['MT',{certificate:'MW-4-2026',filingStatus:'married_joint',additionalCents:0},1800],
  ['OK',{filingStatus:'single',allowances:0,additionalCents:0},3536],
  ['NM',{filingStatus:'single',allowances:0,additionalCents:0},3186],
  ['NE',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},3606],
  ['MS',{filingStatus:'S',exemptionCents:600000,additionalCents:0},2600],
  ['GA',{filingStatus:'single',dependents:0,additionalCents:0},3551],
  ['AL',{filingStatus:'S',dependents:0,additionalCents:0},4148],
  ['SC',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},4738],
  ['DC',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},5731],
  ['UT',{certificate:'modern-w4',filingStatus:'single'},4450],
  ['WI',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},4444],
  ['OR',{filingStatus:'single',allowances:0,additionalCents:0},6963],
  ['VA',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},4287],
  ['MN',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},5257],
  ['MO',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},2900],
  ['ND',{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},0],
  ['DE',{filingStatus:'single',allowances:0,additionalCents:0},4460],
  ['KS',{filingStatus:'single',allowances:0,additionalCents:0},5023],
  ['CO',{certificate:'w4-only',filingStatus:'single'},3935],
  ['ID',{filingStatus:'single',childAllowances:0,additionalCents:0},3657],
  ['IA',{formYear:2026,filingStatus:'other',annualAllowanceCents:0,additionalCents:0},2850],['WA',{},0],['NH',{},0],['PA',{},3070],
  ['IL',{allowances:1,additionalAllowances:1,additionalCents:0},4576],
  ['AZ',{rateBasisPoints:200,additionalCents:125},2125],
  ['NJ',{table:'A',allowances:0,additionalCents:0},2938],
  ['NY',{filingStatus:'single',allowances:0,additionalCents:0},4317],
 ]
 assert.deepEqual(coverage.states.filter(s=>s.withholding==='ordinary-cash-component').map(s=>s.state).sort(),cases.map(c=>c[0]).sort(),'Every mapped withholding component has an executed independent golden case')
 for(const [state,election,expected] of cases){
   const r=await data(door,{...fixture,workState:state,residentState:state,stateElection:election})
   assert.equal(r.state.withholdingCents,expected,state+' independently worked official-table amount')
   assert.equal(r.netCashCents,null,'Incomplete state programs must not manufacture a complete net')
 }
 // Published independent examples also exercise period-specific deductions
 // and separate credit rounding, rather than deriving expected tax from the rule data.
 for(const [frequency,wages,election,expected] of [
   ['biweekly',210000,{formYear:2026,filingStatus:'other',annualAllowanceCents:4000,additionalCents:0},5926],
   ['biweekly',210000,{formYear:2026,filingStatus:'joint-single-income',annualAllowanceCents:8000,additionalCents:0},3872],
   ['biweekly',210000,{formYear:2026,filingStatus:'head_household',annualAllowanceCents:16000,additionalCents:0},4515],
   ['monthly',500000,{formYear:2026,filingStatus:'other',annualAllowanceCents:4000,additionalCents:0},14550],
 ]){
   const r=await data(door,{...fixture,workState:'IA',residentState:'IA',frequency,remuneration:{kind:'salary',exempt:true,cashCents:wages},stateElection:election})
   assert.equal(r.state.withholdingCents,expected,'Iowa official 2026 worked example')
 }
 for(const [frequency,wages,standardDeduction,expected] of [['weekly',70000,1,1398],['biweekly',460000,2,11154]]){
   const official=await data(door,{...fixture,workState:'LA',residentState:'LA',frequency,remuneration:{kind:'salary',exempt:true,cashCents:wages},stateElection:{standardDeduction,additionalCents:0}})
   assert.equal(official.state.withholdingCents,expected,'Louisiana R-1306 official computer-formula example')
 }
 const hawaiiExample=await data(door,{...fixture,workState:'HI',residentState:'HI',remuneration:{kind:'salary',exempt:true,cashCents:50000},stateElection:{filingStatus:'single',allowances:3,additionalAllowances:0,additionalCents:0}})
 assert.equal(hawaiiExample.state.withholdingCents,958,'Hawaii Booklet A annual-method official example')
 const twoJobs=await data(door,{...fixture,workState:'WV',residentState:'WV',stateElection:{table:'two-earner-or-multiple-jobs',allowances:0,additionalCents:0}})
 assert.equal(twoJobs.state.withholdingCents,3400,'West Virginia separately elected two-job schedule')
 const nmExample=await data(door,{...fixture,workState:'NM',residentState:'NM',stateElection:{filingStatus:'married',allowances:0,additionalCents:2000}})
 assert.equal(nmExample.state.withholdingCents,4180,'New Mexico official weekly worked example including additional withholding')
 for(const [state,before,on,election] of [
   ['ID','2026-07-22','2026-07-23',{filingStatus:'single',childAllowances:0,additionalCents:0}],
   ['UT','2026-05-31','2026-06-01',{certificate:'modern-w4',filingStatus:'single'}],
 ]){
   const early=await data(door,{...fixture,from:'2026-05-18',through:'2026-05-24',payDate:before,workState:state,residentState:state,stateElection:election})
   const current=await data(door,{...fixture,from:'2026-05-18',through:'2026-05-24',payDate:on,workState:state,residentState:state,stateElection:election})
   assert.equal(early.state.withholdingCents,null);assert.ok(current.state.withholdingCents>0)
 }
 const mtAmbiguous=await data(door,{...fixture,workState:'MT',residentState:'MT',stateElection:{certificate:'MW-4-2026',filingStatus:'single',additionalCents:0}})
 assert.equal(mtAmbiguous.state.withholdingCents,null);assert.match(mtAmbiguous.state.reason,/rounding/)
 const nmOtherPeriod=await data(door,{...fixture,workState:'NM',residentState:'NM',frequency:'monthly',stateElection:{filingStatus:'single',allowances:0,additionalCents:0}})
 assert.equal(nmOtherPeriod.state.withholdingCents,null)
 const cashHeld=await data(door,{...fixture,w4:{...ordinaryW4,step4cExtraWithholdingCents:200000}})
 assert.equal(cashHeld.netCashCents,null);assert.equal(cashHeld.federal,null)
 assert.ok(cashHeld.holds.some(h=>h.code==='regular-wage-cash-insufficient'&&h.reason&&h.location))
 const capped=await data(door,{...fixture,yearToDate:{...fixture.yearToDate,socialSecurityWagesCents:18449900,medicareWagesCents:19999900,futaWagesCents:699900,suiWagesCents:899900}})
 assert.deepEqual(capped.federal.employeeTaxes,{incomeTaxCents:7808,socialSecurityCents:6,medicareCents:1450,additionalMedicareCents:899})
 assert.equal(capped.federal.employerTaxes.futaCents,6)
 assert.equal(capped.sui.amountCents,3)
 // Unknown state, local authority and cross-state sourcing remain named holds.
 for(const input of [{workState:'ZZ'},{locality:'synthetic-envelope-unknown-city'},{residentState:'PA'},{workState:'OH',residentState:'OH'}]){
   const held=await data(door,{...fixture,...input})
   assert.equal(held.status,'held');assert.equal(held.netCashCents,null)
   assert.ok(held.holds.some(h=>h.location && h.reason && h.nextAction))
   if(input.workState==='ZZ'||input.workState==='OH')assert.equal(held.state.withholdingCents,null)
 }
 const week={from:'2026-10-19',days:[
   {day:'2026-10-19',segments:[{hoursHundredths:1000,rateCents:2000}]},
   {day:'2026-10-20',segments:[{hoursHundredths:1000,rateCents:3000}]},
   {day:'2026-10-21',segments:[{hoursHundredths:1000,rateCents:2000}]},
   {day:'2026-10-22',segments:[{hoursHundredths:1000,rateCents:3000}]},
   {day:'2026-10-23',segments:[{hoursHundredths:500,rateCents:2000}]},
 ],productionBonusCents:9000,premiums:[]}
 const weighted=await data(door,{...fixture,remuneration:{kind:'hourly',weeks:[week]}})
 assert.deepEqual([weighted.earnings.weeks[0].straightCents,weighted.earnings.weeks[0].overtimeCents,weighted.grossCashCents],[110000,6611,125611])
 const caWeek={...week,days:week.days.map(d=>({...d,segments:[{hoursHundredths:800,rateCents:2000}]})),productionBonusCents:8000,
   premiums:[{day:'2026-10-19',kind:'meal',approvedBy:'Synthetic reviewer',sourceId:'synthetic-envelope-9602'},{day:'2026-10-20',kind:'rest',approvedBy:'Synthetic reviewer',sourceId:'synthetic-envelope-9603'}]}
 const premium=await data(door,{...fixture,workState:'CA',residentState:'CA',stateElection:{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},remuneration:{kind:'hourly',weeks:[caWeek]}})
 assert.deepEqual(premium.earnings.weeks[0].premiums.map(p=>p.amountCents),[2200,2200])
 assert.equal(premium.earnings.workedHoursHundredths,4000);assert.equal(premium.grossCashCents,92400)
 const daily=await data(door,{...fixture,workState:'CA',residentState:'CA',stateElection:{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},remuneration:{kind:'hourly',weeks:[{from:week.from,days:[{day:week.from,segments:[{hoursHundredths:1300,rateCents:2000}]}],productionBonusCents:0,premiums:[]}]}})
 assert.deepEqual([daily.earnings.weeks[0].overtimeHoursHundredths,daily.earnings.weeks[0].doubleTimeHoursHundredths,daily.grossCashCents],[400,100,32000])
 const seventh=await data(door,{...fixture,workState:'CA',residentState:'CA',stateElection:{filingStatus:'single',allowances:0,additionalAllowances:0,additionalCents:0},remuneration:{kind:'hourly',weeks:[{from:week.from,days:['19','20','21','22','23','24','25'].map(d=>({day:'2026-10-'+d,segments:[{hoursHundredths:800,rateCents:2000}]})),productionBonusCents:0,premiums:[]}]}})
 assert.deepEqual([seventh.earnings.weeks[0].overtimeHoursHundredths,seventh.earnings.weeks[0].doubleTimeHoursHundredths,seventh.grossCashCents],[1600,0,128000])
 const tips=await data(door,{...fixture,remuneration:{kind:'hourly',weeks:[{from:week.from,days:[{day:'2026-10-19',segments:[{hoursHundredths:1000,rateCents:213}]},{day:'2026-10-20',segments:[{hoursHundredths:1000,rateCents:213}]}],productionBonusCents:0,premiums:[]}]},tips:{heldCents:60000,paycheckCents:0,furnishedCents:0}})
 assert.equal(tips.grossCashCents,4260);assert.equal(tips.tipTaxes.netCashCents,0)
 assert.deepEqual(tips.tipTaxes.order.map(o=>o.kind),['regular-wage-taxes','tip-social-security-and-medicare','tip-income-tax'])
 assert.deepEqual(tips.tipTaxes.regular,{socialSecurityCents:264,medicareCents:62,additionalMedicareCents:0,incomeTaxCents:0})
 assert.deepEqual(tips.tipTaxes.collected,{socialSecurityCents:3188,medicareCents:746,additionalMedicareCents:0,incomeTaxCents:0})
 assert.deepEqual(tips.tipTaxes.uncollected,{socialSecurityCents:532,medicareCents:124,additionalMedicareCents:0,incomeTaxCents:3519})
 assert.deepEqual(tips.tipTaxes.reportingBasis.w2Box12,{A:532,B:124})
 assert.deepEqual(tips.tipTaxes.reportingBasis.form941,{line5bTipWagesCents:60000,line5bTaxCents:7440,line5cWagesCents:64260,line5cTaxCents:1864,line5dWagesCents:0,line5dTaxCents:0,line9AdjustmentCents:-656})
 assert.deepEqual(tips.federalEmployerTaxes,{socialSecurityCents:3984,medicareCents:932,futaCents:3856})
 assert.ok(!tips.holds.some(h=>h.code==='negative-net-deduction'))
 const garnished=await data(door,{...fixture,deductions:[{kind:'ordinary-creditor',amountCents:30000,authorizationRef:'synthetic-envelope-9604'}]})
 assert.equal(garnished.netCashCents,null);assert.ok(garnished.holds.some(h=>h.code==='unlawful-garnishment'))
 const negative=await data(door,{...fixture,deductions:[{kind:'voluntary-after-tax',amountCents:99999,authorizationRef:'synthetic-envelope-9605'}]})
 assert.equal(negative.netCashCents,null);assert.ok(negative.holds.some(h=>h.code==='negative-net-deduction'))
 for(const bad of [{edition:'2027-01'},{payDate:'2026-02-30'},{payDate:'2026-10-18'},{yearToDate:{}},{paymentReady:true},{stateElection:{exempt:true}},{remuneration:{kind:'salary',exempt:true,cashCents:1.5}}]){
   assert.equal((await call(door,{...fixture,...bad})).status,400)
 }
 const historicalInput={...fixture,edition:'2025-01',payDate:'2025-10-30',from:'2025-10-20',through:'2025-10-26'}
 const historical=await data(door,historicalInput)
 assert.ok(historical.coverage.states.every(s=>s.programInventory.futaCreditReduction.taxYear===2025 && s.programInventory.futaCreditReduction.status==='unmapped'))
 assert.equal(historical.coverage.mappedWithholdingComponents,0,'The 2026 state inventory is not carried into a historical tax year')
 assert.deepEqual(historical.federal.employeeTaxes,{incomeTaxCents:8080,socialSecurityCents:6200,medicareCents:1450,additionalMedicareCents:0})
 await data(door,fixture)
 assert.deepEqual(await data(door,historicalInput),historical,'The retained prior tax year reproduces after selecting the newer table edition')
 await restart()
 assert.deepEqual(await data(door,fixture),preview,'A restart retains the same dated rules, inputs and cent rounding')
 assert.equal((await call(door,fixture,'')).status,401)
 assert.equal((await fetch(origin+door,{method:'POST',headers:{origin,cookie,'content-type':['application','json'].join('/'),authorization:'Bearer synthetic-envelope-9606'},body:JSON.stringify(fixture)})).status,403)
 // A valid native session with a substantial payroll grant still cannot
 // acquire this owner-only hypothetical door. Revocation fences the same route.
 const member='synthetic-envelope-9610',token=randomBytes(32).toString('base64url'),hashed=await hashToken(settings.SESSION_SECRET,'session',token),now=Date.now()
 await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${member}','${member}','Synthetic calculation preparer','member','active',1,1); INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ('${member}','${hashed}','${member}',1,'native',${now},${now+3600000})`)
 await data('/api/envelope/companies/'+company.id+'/grants',{operatorId:member,version:0,role:'preparer',locations:['*'],fields:['compensation','tax'],actions:['records:read','records:write','rates:propose']})
 const memberCookie=cookie.split('=')[0]+'='+token
 assert.equal((await call(door,fixture,memberCookie)).status,403)
 assert.equal((await call(door.replace('calculation-preview','calculation-coverage'),undefined,memberCookie)).status,403)
 await sql(`UPDATE oa_sessions SET revoked_at=1 WHERE id='${member}'`)
 assert.equal((await call(door,fixture,memberCookie)).status,401)
 const before=await sql('SELECT COUNT(*) AS n FROM env_workspace_versions')
 await data(door,fixture)
 assert.deepEqual(await sql('SELECT COUNT(*) AS n FROM env_workspace_versions'),before,'A hypothetical preview creates no payroll authority or retained employee record')
 console.log('CALCULATION-CORPUS',JSON.stringify({states:coverage.total,withholdingGoldens:cases.length,completeStates:coverage.completeStates,complete:coverage.complete}))
 console.log('CALCULATION-PREVIEW passed: dated federal and bounded state components, weighted weekly earnings, approved California premiums, tip-tax shortage, explicit coverage holds and unsafe deductions through the native API')
}
