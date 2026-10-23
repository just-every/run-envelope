import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page,Card,Field,Hidden,Submit,companyPath } from '../pages'
import type { Revision } from '../workspace/store'
import type { EarningsRun } from '../workspace/pay-items'
import type { ClassificationRecord,IndustryCheck } from './records'
import { claims } from './form-input'
export const words=(s:string)=>s.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ')
const money=(n:number)=>'$'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
export const Choice=({name,label,options,value}:{name:string;label:string;options:string[];value?:string})=><label className="field"><span>{label}</span><select name={name} aria-label={label} defaultValue={value}>{options.map(o=><option key={o} value={o}>{words(o)}</option>)}</select></label>
const Check=({name,label,checked=false,value='true'}:{name:string;label:string;checked?:boolean;value?:string})=><label><input type="checkbox" name={name} value={value} defaultChecked={checked}/>{' '}{label}</label>
const Area=({name,label,value}:{name:string;label:string;value?:string})=><label className="field"><span>{label}</span><textarea name={name} aria-label={label} rows={5} required maxLength={12000} defaultValue={value}/></label>
export function Facts({value}:{value:unknown}) {
 if(Array.isArray(value))return <>{value.map((v,i)=><article key={i}><Facts value={v}/></article>)}</>
 if(value&&typeof value==='object')return <dl className="evidence-text">{Object.entries(value).filter(([k,v])=>!['reviewedBy','reviewedAt','documentId'].includes(k)&&v!==undefined&&v!=='').map(([k,v])=><div key={k}><dt>{words(k)}</dt><dd><Facts value={v}/></dd></div>)}</dl>
 return <>{typeof value==='boolean'?(value?'Yes':'No'):String(value??'')}</>
}
export function ClassificationFields({row}:{row?:Revision<ClassificationRecord>}) {
 const d=row?.data
 return <>
  <Hidden name="version" value={row?.version??0}/>
  <Field name="effectiveFrom" label="Effective from" type="date" value={d?.effectiveFrom}/><Field name="effectiveThrough" label="Effective through" type="date" value={d?.effectiveThrough}/>
  <Choice name="employerKind" label="Employer activity" options={['business','farm','nonprofit','church','school']} value={d?.facts.employerKind}/>
  <Choice name="entityType" label="Legal entity" options={['corporation','sole_proprietor','partnership','s_corporation','nonprofit']} value={d?.facts.entityType}/>
  <Choice name="workerRole" label="Worker capacity" options={['employee','corporate_officer','sole_proprietor','partner','distribution']} value={d?.facts.workerRole}/>
  <Choice name="workKind" label="Actual services" options={['nonagricultural','agricultural']} value={d?.facts.workKind}/>
  <Choice name="taxResidency" label="Federal tax residency" options={['resident','nonresident']} value={d?.facts.taxResidency}/>
  <Field name="birthDate" label="Birth date for age-dependent treatment" type="date" required={false} value={d?.facts.birthDate}/><Check name="seasonal" label="Seasonal employer" checked={d?.facts.seasonal}/>
  <h3>Individual exemptions and benefits</h3><p>Select only treatment supported by the evidence below. Church employment and citizenship alone never exempt a worker. Ministry housing also requires the ministry selection.</p>
  {claims.map(c=>{const previous=d?.facts.claims.find(p=>p.kind===c.kind) as unknown as Record<string,unknown>|undefined;return <details key={c.kind} open={Boolean(previous)}><summary>{c.label}</summary><Check name="claimKinds" value={c.kind} label={'Apply: '+c.label} checked={Boolean(previous)}/>{c.fields.map(f=>f.boolean?<Check key={f.key} name={c.kind+'.'+f.key} label={f.label} checked={previous?.[f.key]===true}/>:f.options?<Choice key={f.key} name={c.kind+'.'+f.key} label={f.label} options={f.options} value={String(previous?.[f.key]??f.options[0])}/>:<Field key={f.key} name={c.kind+'.'+f.key} label={f.label} type={f.date?'date':f.number?'number':'text'} value={previous?.[f.key] as string|number|undefined} required={false}/>)}</details>})}
  <h3>Withholding election</h3><Choice name="w4Version" label="W-4 edition" options={['2020_or_later','2019_or_earlier']} value={d?.w4.version}/><Choice name="filingStatus" label="Filing status" options={['single','married_joint','head_household']} value={d?.w4.filingStatus}/>
  <Check name="step2Checked" label="W-4 Step 2 checkbox selected" checked={d?.w4.version==='2020_or_later'&&d.w4.step2Checked}/>
  {[['step3AnnualCreditsCents','Step 3 annual credits'],['step4aOtherIncomeCents','Step 4(a) annual other income'],['step4bDeductionsCents','Step 4(b) annual deductions'],['step4cExtraWithholdingCents','Step 4(c) extra withholding each check']].map(([name,label])=><Field key={name} name={name} label={label+' (cents)'} type="number" value={d?.w4.version==='2020_or_later'?(d.w4 as unknown as Record<string,number>)[name]:0}/>)}
  <details><summary>Earlier W-4 details</summary><Check name="firstPaidBefore2020" label="Worker first paid before 2020"/><Field name="allowances" label="Withholding allowances" type="number" value={0}/><Field name="extraWithholdingCents" label="Extra withholding (cents)" type="number" value={0}/></details>
  <h3>Evidence for the exact classification and election</h3>
  <Field name="evidenceTitle" label="Evidence title" value={d?.evidenceTitle}/><Field name="evidenceIssuer" label="Issued or confirmed by" value={d?.evidenceIssuer}/><Field name="evidenceReference" label="Document reference" value={d?.evidenceReference}/><Area name="evidenceText" label="Evidence text and factual basis" value={d?.evidenceText}/>
  <p>Changes retain the prior classification. A named payroll reviewer must approve this exact evidence and its effective dates before calculation.</p><Submit primary>Propose classification</Submit>
 </>
}
export function industryPersonPage(session:Session,companies:Company[],actor:Actor,person:Person,data:{classifications:Revision<ClassificationRecord>[];checks:Revision<IndustryCheck>[]},runs:Revision<EarningsRun>[]) {
 const base=companyPath(actor.company)+'/people/'+person.id+'/industry',current=data.classifications[0]
 return page(session,'Industry payroll treatment',companies,actor.company,<>
  <Card title={person.name}><p>Review documented federal tax treatment and calculate a check from retained earnings. These previews do not release wages or submit returns.</p><a href={companyPath(actor.company)+'/industry-returns'}>Company employment tax forms</a></Card>
  {data.classifications.map(c=><Card key={c.version} title={'Classification v'+c.version}><p>{c.data.effectiveFrom} to {c.data.effectiveThrough} · {c.withdrawnBy?'withdrawn':c.approvedBy?'reviewed':'awaiting review'} · {c.sourcesCurrent?'current source':'source changed'}</p><Facts value={c.data.facts}/><p>{c.data.evidenceTitle} — {c.data.evidenceIssuer}</p>{!c.approvedBy&&!c.withdrawnBy&&c.sourcesCurrent?<a href={base+'/review/industry-classification/'+c.id}>Review exact classification</a>:null}</Card>)}
  <details><summary>{current?'Change classification with new evidence':'Record worker classification'}</summary><Card title="Classification and evidence"><form className="field" method="post" action={base+'/classification'}><ClassificationFields row={current}/></form></Card></details>
  <Card title="Calculate from a retained run"><form className="field" method="post" action={base+'/checks'}><Hidden name="id" value={crypto.randomUUID()}/><Hidden name="version" value={0}/><label className="field"><span>Retained earnings run</span><select aria-label="Retained earnings run" name="runSelection" required>{runs.filter(r=>r.data.people.some(p=>p.id===person.id)).map(r=><option key={r.id+':'+r.version} value={r.id+':'+r.version}>{r.data.periodStart} to {r.data.periodEnd} · pays {r.data.payDate} · v{r.version}</option>)}</select></label>
   <Field name="housingAllowanceCents" label="Housing included in cash gross (cents)" type="number" value={0}/><Field name="shareholderHealthInsuranceCents" label="Employer-paid health benefit (cents)" type="number" value={0}/>
   <h3>Wages before this check in the same tax year</h3>{['socialSecurity','medicare','futa'].map(k=><Field key={k} name={k+'WagesCents'} label={words(k)+' wages before this check (cents)'} type="number"/>)}<Field name="housingExcludedCents" label="Housing already excluded in this tax year (cents)" type="number" value={0}/><Field name="yearToDateEvidence" label="Year-to-date register or opening-balance reference"/>
   <Field name="corrects" label="Prior check ID being corrected, if any" required={false}/><Field name="correctionReason" label="Reason for correction" required={false}/><Submit primary>Calculate federal check</Submit></form></Card>
  {data.checks.map(c=><Card key={c.id+':'+c.version} title={'Check for '+c.data.result.payDate}><CheckResult check={c.data}/><p className="evidence-text">Check {c.id} · v{c.version} · {c.approvedBy?'reviewed':'awaiting exact review'} · {c.sourcesCurrent?'current sources':'historical sources changed'}</p>{!c.approvedBy&&!c.withdrawnBy&&c.sourcesCurrent?<a href={base+'/review/industry-check/'+c.id}>Review exact check and tax treatment</a>:null}</Card>)}
 </>)
}
export function CheckResult({check}:{check:IndustryCheck}) {
 const r=check.result
 return <><dl><div><dt>Cash gross</dt><dd>{money(r.cashGrossCents)}</dd></div><div><dt>Federal employee taxes</dt><dd>{money(r.totalEmployeeTaxCents)}</dd></div><div><dt>Cash after federal taxes</dt><dd>{money(r.netCashCents)}</dd></div><div><dt>Federal employer taxes</dt><dd>{money(r.totalEmployerTaxCents)}</dd></div><div><dt>Employment return assignment</dt><dd>Form {r.formAssignment}</dd></div></dl><Facts value={{taxableWages:r.wages,employeeTaxes:r.employeeTaxes,employerTaxes:r.employerTaxes}}/>{r.classification.exclusions.map((e,i)=><p key={i}>{words(e.tax)}: {e.reason}</p>)}{r.classification.selfEmploymentNotice&&<p>{r.classification.selfEmploymentNotice}</p>}<p>State taxes, deductions, payment and filing remain separate; this is a federal calculation.</p>{check.amendment&&<><h3>Correction consequences</h3><Facts value={check.amendment}/><p>Original remains retained. Review a corrected employment return and any required W-2c; no prior payment or filing is rewritten.</p></>}<details><summary>Official rule sources</summary>{r.sources.map(s=><p key={s.id}><a href={s.url}>{s.title}</a> · {s.section}</p>)}</details></>
}
export function industryReviewPage(session:Session,companies:Company[],actor:Actor,person:Person,row:Revision<ClassificationRecord|IndustryCheck>&{reviewToken:string}) {
 const data=row.data,base=companyPath(actor.company)+'/people/'+person.id+'/industry'
 return page(session,'Review exact payroll treatment',companies,actor.company,<Card title={person.name+' · v'+row.version}>{row.kind==='industry-classification'?<><Facts value={data}/></>:<CheckResult check={data as IndustryCheck}/>}<p>Approve only after checking this worker’s evidence, effective dates, earnings and individual tax treatment. Approval creates no payment or filing.</p><form method="post" action={base+'/decision/'+row.kind+'/'+row.id}><Hidden name="version" value={row.version}/><Hidden name="reviewToken" value={row.reviewToken}/><Submit primary>Approve this exact version</Submit></form><a href={base}>Return without approving</a></Card>)
}
