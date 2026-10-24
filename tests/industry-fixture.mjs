import assert from 'node:assert/strict'
export const ordinaryFacts={employerKind:'business',entityType:'corporation',workerRole:'employee',workKind:'nonagricultural',seasonal:false,taxResidency:'resident',claims:[]}
export const ordinaryW4={version:'2020_or_later',filingStatus:'single',step2Checked:false,step3AnnualCreditsCents:0,step4aOtherIncomeCents:0,step4bDeductionsCents:0,step4cExtraWithholdingCents:0}
export function industryFixture({origin,cookie,worker}) {
 const transport=worker ? (url,options)=>worker.fetch(url,options) : fetch
 const call=(path,body,who=cookie)=>transport(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':['application','json'].join('/')},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const data=async(path,body,status=200,who=cookie)=>{const r=await call(path,body,who);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 let sequence=0
 const company=async(name,names,year=2026,existingCompany)=>{
  const n=++sequence,c=existingCompany??await data('/api/envelope/companies',{name,ein:'00-'+String(3100+n).padStart(7,'0')},201),base='/api/envelope/companies/'+c.id
  const location=await data(base+'/locations',{name:'Texas workplace',state:'TX'},201),people=[]
  for(const name of names)people.push(await data(base+'/people',{name,locationId:location.id},201))
  const approve=async(kind,id)=>{const r=await data(base+'/pay-settings/review/'+kind+'/'+id);await data(base+'/pay-settings/'+kind+'/'+id+'/approve',{version:r.version,reviewToken:r.reviewToken})}
  const groupId='synthetic-envelope-industry-group-'+n
  await data(base+'/pay-settings/group',{id:groupId,version:0,name:'Weekly payroll',people:people.map(p=>p.id)},201);await approve('group',groupId)
  const changeId='synthetic-envelope-industry-rate-'+n
  await data(base+'/pay-settings/pay-change',{id:changeId,version:0,name:'Reviewed employment earnings',groupId,effectiveDate:year+'-01-01',items:people.map(p=>({personId:p.id,personVersion:p.version,rateCents:12500,basis:'hourly',employmentFrom:year+'-01-01',employmentThrough:year+'-12-31',unpaidDates:[]}))},201);await approve('pay-change',changeId)
  for(const [i,p] of people.entries())await data(base+'/people/'+p.id+'/allocations/work',{id:'synthetic-envelope-industry-work-'+n+'-'+i,version:0,day:year+'-10-19',state:'TX',locality:'Austin',minutes:480,earnedCents:100000,officeState:'TX',nyReason:'not-applicable',sourceRef:'Approved time register '+year},201)
  const run=await data(base+'/pay-settings/earnings-run',{id:'synthetic-envelope-industry-run-'+n,version:0,groupId,periodStart:year+'-10-19',periodEnd:year+'-10-25',payDate:year+'-10-30',frequency:'weekly'},201)
  return {...c,base,location,people,run,year}
 }
 const proposal=(c,facts,extra={})=>({version:0,effectiveFrom:c.year+'-01-01',effectiveThrough:c.year+'-12-31',facts:{...ordinaryFacts,...facts},w4:ordinaryW4,evidenceTitle:'Reviewed employer and worker classification documents',evidenceIssuer:'Employer payroll officer',evidenceReference:'synthetic-envelope-3101',evidenceText:'Employment agreement, actual services, tax residency analysis and signed withholding election reviewed for this named worker. '+JSON.stringify(facts),...extra})
 const path=(c,p)=>c.base+'/people/'+p.id+'/industry'
 const approve=async(c,p,kind,id)=>{const base=path(c,p),r=await data(base+'/review/'+kind+'/'+id);await data(base+'/decision/'+kind+'/'+id,{version:r.version,reviewToken:r.reviewToken});return r}
 const classify=async(c,p,facts,extra={})=>{const r=await data(path(c,p)+'/classification',proposal(c,facts,extra),201);await approve(c,p,'industry-classification',r.id);return r}
 const preview=async(c,p,extra={})=>{const r=await data(path(c,p)+'/checks',{id:'synthetic-envelope-check-'+(++sequence),version:0,runId:c.run.id,runVersion:c.run.version,housingAllowanceCents:0,shareholderHealthInsuranceCents:0,yearToDate:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0},yearToDateEvidence:'No prior wages in this tax year; signed opening register.',...extra},201);return (await data(path(c,p))).checks.find(x=>x.id===r.id)}
 return {call,data,company,proposal,path,approve,classify,preview}
}
