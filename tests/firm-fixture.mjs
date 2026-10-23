import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../src/modules/operator-auth/crypto.mjs'
import { localCookieName } from '../src/modules/operator-auth/http.mjs'

export async function firmFixture({origin,cookie,sql,settings}) {
  const call = (path,body,who=cookie) => fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{cookie:who,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const data = async(path,body,status=200,who=cookie) => {const r=await call(path,body,who);assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const people = { firm:{id:'synthetic-envelope-2901',name:'Jordan Lee'}, backup:{id:'synthetic-envelope-2902',name:'Morgan Chen'}, stranger:{id:'synthetic-envelope-2903',name:'Sam Rivera'} }
  const signIn = async person => {
    const token=randomBytes(32).toString('base64url'),id=randomBytes(16).toString('hex'),now=Date.now(),hash=await hashToken(settings.SESSION_SECRET,'session',token)
    await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) SELECT '${id}','${hash}',id,version,'native',${now},${now+3600000} FROM oa_operators WHERE id='${person.id}' AND status='active'`)
    person.cookie=localCookieName('operator_session_local',origin)+'='+token
    return person.cookie
  }
  for(const p of Object.values(people)) {await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ('${p.id}','${p.id}@example.com','${p.name}','member','active',1,1)`);await signIn(p)}
  const owner=(await sql("SELECT id FROM oa_operators WHERE email='owner@example.com'"))[0].id
  const names=['Rosa Bakery','Kessler Plumbing','Brightside Studio','Northpaw Veterinary','Arch City Cafe','Redwood Dental','Harbor Repair','Juniper Market','Cedar Design','Willow Landscaping','Summit Electric','Maple Catering','Riverbend Books','Mesa Consulting','Orchard Therapy','Beacon Hardware','Meadow Fitness','Copper Print','Elm Woodworks','Sage Accounting','Private Client']
  const states=['CA','PA','NJ','CO','WA','OR','NY']
  const clients=[]
  const period={periodStart:'2026-10-19',periodEnd:'2026-10-25',payDate:'2026-10-30',frequency:'weekly'}
  for(let i=0;i<names.length;i++) {
    const company=await data('/api/envelope/companies',{name:names[i],ein:'00-'+String(2900+i).padStart(7,'0')},201),base='/api/envelope/companies/'+company.id
    const location=await data(base+'/locations',{name:names[i]+' workplace',state:states[i%states.length]},201)
    const worker=await data(base+'/people',{name:['Alex Rivera','Priya Shah','Diego Cruz','Taylor Brooks'][i%4],locationId:location.id},201)
    const groupId='synthetic-envelope-group-'+i, changeId='synthetic-envelope-change-'+i
    const approve = async(kind,id) => {const r=await data(base+'/pay-settings/review/'+kind+'/'+id);await data(base+'/pay-settings/'+kind+'/'+id+'/approve',{version:r.version,reviewToken:r.reviewToken})}
    await data(base+'/pay-settings/group',{id:groupId,version:0,name:'Weekly crew',people:[worker.id]},201);await approve('group',groupId)
    await data(base+'/pay-settings/pay-change',{id:changeId,version:0,name:'Reviewed October rates',groupId,effectiveDate:'2026-01-01',items:[{personId:worker.id,personVersion:worker.version,rateCents:2500+i*100,basis:'hourly',employmentFrom:'2026-01-01',employmentThrough:'2026-12-31',unpaidDates:[]}]},201);await approve('pay-change',changeId)
    await data(base+'/people/'+worker.id+'/allocations/work',{id:'synthetic-envelope-work-'+i,version:0,day:'2026-10-19',state:states[i%states.length],locality:'Workplace',minutes:480,earnedCents:(2500+i*100)*8,officeState:states[i%states.length],nyReason:'not-applicable',sourceRef:'synthetic-envelope-time-'+i},201)
    const run=await data(base+'/pay-settings/earnings-run',{...period,id:'synthetic-envelope-run-'+i,version:0,groupId},201)
    const notice=await data(base+'/notices',{locationId:location.id,reference:'Agency response due for '+names[i],body:'Review the October deposit inquiry. The account number is synthetic-envelope-'+i+'.'},201)
    await data(base+'/setup/jurisdictions',{code:'STATE-WH',version:0,effectiveDate:'2026-01-01',kind:'withholding',state:states[i%states.length],agency:'State revenue department',registrationStatus:'pending',account:'',exemptionBasis:'',rate:'0',rateBasis:'official-table',wageBaseCents:0,depositFrequency:'monthly',returnFrequency:'quarterly',employeeRate:'0',hoursMethod:'not-applicable',authority:'pending',authorityEvidence:'',sourceUrl:'https://www.irs.gov/businesses/small-businesses-self-employed/employment-taxes',sourceTitle:'Employer registration source',sourceDate:'2026-10-01'},201)
    for(const p of i<20?[people.firm,people.backup]:[]) {
      const restricted=i===19 && p===people.firm
      await data(base+'/grants',{operatorId:p.id,version:0,role:'accountant',locations:['*'],fields:restricted?[]:['compensation','tax'],actions:restricted?['records:read']:['records:read','records:write','rates:propose','pay:approve','pay:release','notices:read','notices:write']})
    }
    const task=await data(base+'/firm-work',{workKind:'notice',sourceKind:'notice',sourceId:notice.id,sourceVersion:1,title:'Respond to October inquiry',details:'Review payroll evidence and prepare the response for the client.',dueDate:i%2?'2026-10-31':period.payDate,dueTime:'16:00',timeZone:'America/New_York',evidenceRef:'Agency notice received 19 October',assigneeId:i<19?people.firm.id:owner,backupId:owner},201)
    clients.push({...company,base,location,worker,groupId,run,notice,task})
  }
  return {call,data,clients,people,owner,period,signIn}
}
