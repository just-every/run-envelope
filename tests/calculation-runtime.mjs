import assert from 'node:assert/strict'
import { ordinaryW4 } from './industry-fixture.mjs'

// One public-door sanity journey: actual payroll arithmetic, refusal and coverage.
export async function calculationJourney({origin,cookie,sql,restart}) {
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
 assert.equal(preview.paymentReady,false);assert.equal(preview.dispatch,'unavailable')
 assert.equal(preview.coverage.total,51);assert.equal(preview.coverage.complete,false)
 assert.equal(new Set(preview.coverage.states.map(s=>s.state)).size,51)
 const coverage=await data(door.replace('calculation-preview','calculation-coverage'))
 assert.deepEqual(coverage,preview.coverage)
 const cases=[
  ['TX',{},0],['WA',{},0],['NH',{},0],['PA',{},3070],
  ['IL',{allowances:1,additionalAllowances:1,additionalCents:0},4576],
  ['AZ',{rateBasisPoints:200,additionalCents:125},2125],
  ['NJ',{table:'A',allowances:0,additionalCents:0},2938],
  ['NY',{filingStatus:'single',allowances:0,additionalCents:0},4317],
 ]
 for(const [state,election,expected] of cases){
   const r=await data(door,{...fixture,workState:state,residentState:state,stateElection:election})
   assert.equal(r.state.withholdingCents,expected,state+' independently worked official-table amount')
   assert.equal(r.netCashCents,null,'Incomplete state programs must not manufacture a complete net')
 }
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
 const premium=await data(door,{...fixture,workState:'CA',residentState:'CA',remuneration:{kind:'hourly',weeks:[caWeek]}})
 assert.deepEqual(premium.earnings.weeks[0].premiums.map(p=>p.amountCents),[2200,2200])
 assert.equal(premium.earnings.workedHoursHundredths,4000);assert.equal(premium.grossCashCents,92400)
 const tips=await data(door,{...fixture,remuneration:{kind:'hourly',weeks:[{from:week.from,days:[{day:'2026-10-19',segments:[{hoursHundredths:1000,rateCents:213}]},{day:'2026-10-20',segments:[{hoursHundredths:1000,rateCents:213}]}],productionBonusCents:0,premiums:[]}]},tips:{heldCents:100000,paycheckCents:0,furnishedCents:0}})
 assert.equal(tips.grossCashCents,4260);assert.equal(tips.tipTaxes.netCashCents,0)
 assert.deepEqual(tips.tipTaxes.order.map(o=>o.kind),['regular-wage-taxes','tip-social-security-and-medicare','tip-income-tax'])
 assert.ok(tips.tipTaxes.uncollected.socialSecurityCents+tips.tipTaxes.uncollected.medicareCents>0)
 assert.ok(!tips.holds.some(h=>h.code==='negative-net-deduction'))
 const garnished=await data(door,{...fixture,deductions:[{kind:'ordinary-creditor',amountCents:30000,authorizationRef:'synthetic-envelope-9604'}]})
 assert.equal(garnished.netCashCents,null);assert.ok(garnished.holds.some(h=>h.code==='unlawful-garnishment'))
 const negative=await data(door,{...fixture,deductions:[{kind:'voluntary-after-tax',amountCents:99999,authorizationRef:'synthetic-envelope-9605'}]})
 assert.equal(negative.netCashCents,null);assert.ok(negative.holds.some(h=>h.code==='negative-net-deduction'))
 for(const bad of [{edition:'2027-01'},{payDate:'2026-02-30'},{yearToDate:{}},{paymentReady:true},{stateElection:{exempt:true}},{remuneration:{kind:'salary',exempt:true,cashCents:1.5}}]){
   assert.equal((await call(door,{...fixture,...bad})).status,400)
 }
 await restart()
 assert.deepEqual(await data(door,fixture),preview,'A restart retains the same dated rules, inputs and cent rounding')
 assert.equal((await call(door,fixture,'')).status,401)
 assert.equal((await fetch(origin+door,{method:'POST',headers:{origin,cookie,'content-type':['application','json'].join('/'),authorization:'Bearer synthetic-envelope-9606'},body:JSON.stringify(fixture)})).status,403)
 const before=await sql('SELECT COUNT(*) AS n FROM env_workspace_versions')
 await data(door,fixture)
 assert.deepEqual(await sql('SELECT COUNT(*) AS n FROM env_workspace_versions'),before,'A hypothetical preview creates no payroll authority or retained employee record')
 console.log('CALCULATION-PREVIEW passed: dated federal and bounded state components, weighted weekly earnings, approved California premiums, tip-tax shortage, explicit coverage holds and unsafe deductions through the native API')
}
