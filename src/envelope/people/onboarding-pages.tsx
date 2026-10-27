import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Actor } from '../access'
import type { Company, Person } from '../records'
import { page, Card, Field, Hidden, Select, Submit, companyPath } from '../pages'
import type { PaperOnboarding } from './onboarding'

type History = Awaited<ReturnType<PaperOnboarding['history']>>
export function paperOnboardingPage(session:Session,companies:Company[],actor:Actor,person:Person,rows:History,
  options:{workerType:string;federalForm:string;stateForm:string},review?:Awaited<ReturnType<PaperOnboarding['review']>>) {
  const base=companyPath(actor.company)+'/people/'+person.id+'/paper-onboarding'
  const latest=rows[0]
  const can=(action:string)=>actor.grant.role==='owner' || actor.grant.actions.includes(action)
  const renderForm=(prefix:string,form:History[number]['data']['federal']|null,version:number)=>form && <div className="evidence-text">
    <h3>{form.form} · effective {form.effectiveFrom}</h3>
    <dl>{Object.entries(form.fields).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{String(value)}</dd></div>)}</dl>
    <p>Signed by {form.original.signedBy} on {form.original.signedOn}. {can('paper:download') && <a href={base+'/original/'+version+'/'+prefix}>Download signed {prefix} original</a>}</p>
  </div>
  const originalFields=(prefix:string,label:string)=><>
    <Field name={prefix+'.effectiveFrom'} label={label+' effective date'} type="date"/>
    <Field name={prefix+'.signedBy'} label={label+' signer name'}/>
    <Field name={prefix+'.signedOn'} label={label+' signature date'} type="date"/>
    <label className="field"><span>{label} signed PDF (up to 384 KB)</span><input type="file" name={prefix+'.pdf'} accept=".pdf" required/></label>
    <label className="field"><span><input type="checkbox" name={prefix+'.signed'} value="true" required/> I inspected the {label.toLowerCase()} original and it is signed.</span></label>
  </>
  const amount=(name:string,label:string)=><Field name={name} label={label} type="number" step="1" value={0}/>
  return page(session,person.name+' · Paper onboarding',companies,actor.company,<>
    <Card title="Signed paper, reviewed by a person">
      <p>No email, phone or bank account is required for this paper-check election. Retain the signed originals and transcribe their elections below.</p>
      <p>Paper review does not authorize payroll. TIN matching, bank verification and payment remain unavailable. Entry, exact review and original downloads require separate permissions for this company, location and sensitive fields.</p>
      <p><a href={companyPath(actor.company)+'/people/'+person.id}>Back to worker</a></p>
    </Card>
    {review && <Card title={'Review exact paper version '+review.version}>
      <p>Worker {person.name}. Classification {review.data.workerType}. Hired {review.data.hiredOn}. TIN {review.data.tin}. Address {review.data.address}. Payment method: paper check.</p>
      {renderForm('federal',review.data.federal,review.version)}{renderForm('state',review.data.state,review.version)}
      <p>All fields entered by {review.data.enteredByName} ({review.createdBy}). Review the originals before recording your decision.</p>
      <form method="post" action={base+'/approve'}><Hidden name="version" value={review.version}/><Hidden name="reviewToken" value={review.reviewToken}/><Submit primary>Confirm exact paper review</Submit></form>
    </Card>}
    <Card title="Elections and retained history">
      {!rows.length && <p>No signed paper elections recorded.</p>}
      {rows.map((row,index)=><article key={row.version}>
        <h3>Version {row.version} · {index?'Historical':row.withdrawnBy?'Review withdrawn':row.paperworkReviewed?'Paper reviewed':'Needs human review'}</h3>
        <p>{row.data.workerType} · hired {row.data.hiredOn} · TIN {row.data.tin} · paper check. Payroll remains held.</p>
        <p>All fields entered by {row.data.enteredByName} ({row.createdBy}); reviewed by {row.approvedBy ?? 'no reviewer'}{row.withdrawnBy?'; review withdrawn by '+row.withdrawnBy:''}.</p>
        <details><summary>Inspect version {row.version} elections and originals</summary>{renderForm('federal',row.data.federal,row.version)}{renderForm('state',row.data.state,row.version)}</details>
        {can('paper:review') && index===0 && !row.approvedBy && !row.withdrawnBy && row.sourcesCurrent && !review && <a className="btn" href={base+'/review'}>Review exact paper version</a>}
        {can('paper:review') && index===0 && row.paperworkReviewed && <form method="post" action={base+'/withdraw'}><Hidden name="version" value={row.version}/><Submit>Withdraw paper review</Submit></form>}
      </article>)}
    </Card>
    {!review && can('paper:entry') && <>
      <Card title="Choose paper certificates"><form method="get" className="field" action={base}>
        <Select name="workerType" label="Worker classification" choices={['employee','contractor']} value={options.workerType}/>
        <Select name="federalForm" label="Federal paper form" choices={['W-4','W-4-pre2020','W-9']} value={options.federalForm}/>
        <Select name="stateForm" label="State paper certificate" choices={['OH-IT-4','PA-residency','none']} value={options.stateForm}/>
        <Submit>Choose certificate fields</Submit>
      </form></Card>
      <Card title={latest?'Record a new signed version':'Record signed paper elections'}><form method="post" encType={['multipart','form-data'].join('/')} className="field" action={base}>
        <Hidden name="version" value={latest?.version ?? 0}/><Hidden name="workerType" value={options.workerType}/>
        <Hidden name="paymentMethod" value="paper-check"/><Hidden name="federal.form" value={options.federalForm}/><Hidden name="state.form" value={options.stateForm}/>
        <p>Classification: {options.workerType}. Federal: {options.federalForm}. State: {options.stateForm}. Payment: paper check.</p>
        <Field name="hiredOn" label="Employment start date" type="date" value={latest?.data.hiredOn}/>
        <Field name="tin" label="Worker TIN (9 digits)" type="password" maxLength={9}/>
        <Field name="address" label="Worker mailing address" maxLength={500} value={latest?.data.address}/>
        <h3>Federal original and transcription</h3>{originalFields('federal','Federal')}
        {options.federalForm==='W-9'?<><Field name="federal.fields.taxClassification" label="W-9 tax classification"/><Field name="federal.fields.exemptPayeeCode" label="W-9 exempt payee code" required={false}/></>:<>
          <Select name="federal.fields.filingStatus" label="Federal filing status" choices={options.federalForm==='W-4'?['single','married','head-of-household']:['single','married','married-withhold-single']}/>
          {options.federalForm==='W-4'?<><Select name="federal.fields.multipleJobs" label="W-4 multiple jobs checkbox" choices={['no','yes']}/>{amount('federal.fields.dependentCreditCents','W-4 dependent credits in cents')}{amount('federal.fields.otherIncomeCents','W-4 other income in cents')}{amount('federal.fields.deductionsCents','W-4 deductions in cents')}</>:amount('federal.fields.allowances','Pre-2020 federal allowances')}
          {amount('federal.fields.additionalCents','Additional federal withholding in cents')}<Select name="federal.fields.exempt" label="Federal exemption claimed" choices={['no','yes']}/>
        </>}
        {options.stateForm!=='none' && <><h3>State original and transcription</h3>{originalFields('state','State')}
          <Field name="state.fields.residenceAddress" label="State certificate residence address" maxLength={500}/>
          {options.stateForm==='PA-residency'?<><Field name="state.fields.residencePsd" label="PA residence PSD" maxLength={6}/><Field name="state.fields.workAddress" label="PA work address" maxLength={500}/><Field name="state.fields.workPsd" label="PA work PSD" maxLength={6}/></>:<><Field name="state.fields.schoolDistrictName" label="Ohio school district name"/><Field name="state.fields.schoolDistrictNumber" label="Ohio school district number" maxLength={4}/>{amount('state.fields.allowances','Ohio allowances')}{amount('state.fields.additionalCents','Additional Ohio withholding in cents')}</>}
          <Select name="state.fields.localExemption" label="Local exemption claim" choices={['none','claimed']}/><Field name="state.fields.exemptionEvidence" label="Local exemption evidence (if claimed)" required={false} maxLength={500}/>
        </>}
        <label className="field"><span><input type="checkbox" name="attestTranscription" value="true" required/> I transcribed the signed originals accurately. This records sources and does not approve a payment.</span></label>
        <Submit primary>Record signed paper version</Submit>
      </form></Card>
    </>}
  </>)
}
