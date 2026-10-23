import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
export async function industryFormsJourney({f,context,proof,capture,page,farm,officeCheck,company,classify,preview,approve}) {
 const {data,call,path}=f
 const formInput=(c,check,form,extra={})=>({id:'synthetic-envelope-form-'+check.id,version:0,form,taxYear:c.year,...(form==='941'?{quarter:4}:{}),checks:[{personId:check.data.personId,id:check.id,version:check.version}],address:{street:'100 Main Street',city:'Austin',state:'TX',postalCode:'78701'},employeeCount:0,depositsCents:0,basis:'Complete retained October payroll and signed opening register; no wages in the form reference pay period.',...extra})
 const formApprove=async(c,id)=>{const base=c.base+'/industry-returns',r=await data(base+'/'+id+'/review');await data(base+'/'+id+'/decision',{version:r.version,reviewToken:r.reviewToken});return r}
 const inspect=async(c,id,key,expected)=>{
  const response=await call(c.base+'/industry-returns/'+id+'/download');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/xfdf/)
  const xml=await response.text();await writeFile(join(proof,key+'.xfdf'),xml)
  const fields=JSON.parse(execFileSync('python3',['-c',`import sys,json,xml.etree.ElementTree as E
r=E.fromstring(sys.stdin.read());n='{http://ns.adobe.com/xfdf/}';out={}
def walk(e,p=''):
 for f in e.findall(n+'field'):
  name=p+f.attrib['name'];v=f.find(n+'value')
  if v is not None:out[name]=v.text or ''
  walk(f,name+'.')
walk(r.find(n+'fields'));print(json.dumps(out))`],{input:xml,encoding:'utf8'}))
  const schema=JSON.parse(await readFile(new URL('./fixtures/irs-forms/'+key+'.json',import.meta.url)))
  for(const [name,value] of Object.entries(fields)){assert.ok(schema[name],key+' unknown official field '+name);if(schema[name].type==='/Btn')assert.ok(schema[name].states.map(s=>s.replace(/^\//,'')).includes(value),name+' checkbox value '+value)}
  for(const [field,value] of Object.entries(expected))assert.equal(fields[field],value,key+' '+field)
  await writeFile(join(proof,key+'-filled-fields.json'),JSON.stringify(fields,null,2));return fields
 }
 await approve(farm,farm.people[1],'industry-check',officeCheck.id)
 const ordinary=await data(farm.base+'/industry-returns',formInput(farm,officeCheck,'941',{seasonal:true}),201)
 assert.equal((await call(farm.base+'/industry-returns/'+ordinary.id+'/download')).status,409)
 await capture('industry-return-review',farm.base.replace('/api/','/app/')+'/industry-returns/'+ordinary.id+'/review')
 await page.getByRole('button',{name:'Approve these exact form fields',exact:true}).click();await page.waitForURL(context.origin+farm.base.replace('/api/','/app/')+'/industry-returns')
 await inspect(farm,ordinary.id,'f941-2026',{'topmostSubform[0].Page2[0].c2_3[0]':'1','topmostSubform[0].Page1[0].f1_13[0]':'1000','topmostSubform[0].Page1[0].f1_15[0]':'78','topmostSubform[0].Page1[0].f1_16[0]':'08','topmostSubform[0].Page1[0].f1_19[0]':'124','topmostSubform[0].Page1[0].f1_27[0]':'29'})
 await capture('industry-return-ready',farm.base.replace('/api/','/app/')+'/industry-returns')
 await capture('industry-return-form',farm.base.replace('/api/','/app/')+'/industry-returns','Prepare a return or correction')
 assert.equal((await call(farm.base+'/industry-returns',formInput(farm,officeCheck,'943'))).status,400,'unreleased final agricultural edition refuses')
 const prior=await company('Harvest Partners',['Luis Farmworker'],2025)
 const h2a={employerKind:'farm',entityType:'sole_proprietor',workKind:'agricultural',claims:[{kind:'h2a',immigrationStatus:'H-2A',services:'authorized_agricultural_labor',tinStatus:'provided'},{kind:'voluntary_withholding',agreement:'employer_employee',method:'w4'}]}
 await classify(prior,prior.people[0],h2a);const old=await preview(prior,prior.people[0]);await approve(prior,prior.people[0],'industry-check',old.id)
 const original943=await data(prior.base+'/industry-returns',formInput(prior,old,'943'),201);await formApprove(prior,original943.id)
 await inspect(prior,original943.id,'f943-2025',{'topmostSubform[0].Page1[0].f1_13[0]':'0','topmostSubform[0].Page1[0].f1_17[0]':'0'})
 await classify(prior,prior.people[0],{...h2a,claims:[]},{version:1})
 assert.equal((await call(prior.base+'/industry-returns/'+original943.id+'/download')).status,409,'classification change invalidates the prepared original')
 const changed=await preview(prior,prior.people[0],{corrects:old.id,correctionReason:'H-2A status did not apply during the original period; retain original FIT actually withheld.'});await approve(prior,prior.people[0],'industry-check',changed.id)
 assert.equal(changed.data.result.employeeTaxes.incomeTaxCents,old.data.result.employeeTaxes.incomeTaxCents)
 const corrected943=await data(prior.base+'/industry-returns',formInput(prior,changed,'943',{corrects:original943.id,discoveredOn:'2026-11-02',reason:'Correct FICA classification for Luis; voluntary income tax was withheld correctly.',process:'adjustment',w2FiledOrWillFile:true,certifications:[]}),201);await formApprove(prior,corrected943.id)
 const fields943x=await inspect(prior,corrected943.id,'f943x-2026',{})
 assert.ok(Object.values(fields943x).includes('153'))
 const current=await company('Town College Payroll',['Nina Assistant'])
 const student={employerKind:'school',entityType:'nonprofit',claims:[{kind:'school_student',enrollment:'at_least_half_time',relationship:'education_predominates',employerIsEnrolledSchool:true,scheduledWeeklyHours:20,professionalEmployee:false,socialSecurityCoverage:'no_section_218_coverage',attendance:'class_session'}]}
 await classify(current,current.people[0],student);const studentCheck=await preview(current,current.people[0]);await approve(current,current.people[0],'industry-check',studentCheck.id)
 const original941=await data(current.base+'/industry-returns',formInput(current,studentCheck,'941'),201);await formApprove(current,original941.id)
 await classify(current,current.people[0],{...student,claims:[]},{version:1});const taxable=await preview(current,current.people[0],{corrects:studentCheck.id,correctionReason:'School documentation corrected: education was not predominant in this period.'});await approve(current,current.people[0],'industry-check',taxable.id)
 const corrected941=await data(current.base+'/industry-returns',formInput(current,taxable,'941',{corrects:original941.id,discoveredOn:'2026-11-02',reason:'Correct FICA for Nina after exact review of employment evidence.',process:'adjustment',w2FiledOrWillFile:true,certifications:[]}),201);await formApprove(current,corrected941.id)
 await inspect(current,corrected941.id,'f941x-2026',{'topmostSubform[0].Page3[0].f3_51[0]':'153','topmostSubform[0].Page3[0].f3_52[0]':'00'})
 await capture('industry-corrected-return',current.base.replace('/api/','/app/')+'/industry-returns')
 const double=await call(current.base+'/industry-returns',formInput(current,taxable,'941',{id:'synthetic-envelope-duplicate-return',checks:[{personId:taxable.data.personId,id:taxable.id,version:1},{personId:studentCheck.data.personId,id:studentCheck.id,version:1}]}));assert.equal(double.status,409)
 assert.equal((await call(current.base+'/industry-returns/'+corrected941.id+'/download',undefined,'')).status,401)
}
