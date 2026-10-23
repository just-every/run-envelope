import type { ReactNode } from 'react'
import type { Person } from '../records'
import { Field, Hidden } from '../pages'
import type { ClaimData } from './types'
import { portalFieldSchema, separationReasons } from './portal'

export interface ClaimRepresentativeChoice { id: string; name: string }
export interface ClaimPayrollOption {
  kind: 'income-source'; id: string; version: number; personId: string
  label: string; from: string; through: string; grossCents: number
}
export const dollars = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
export const claimTime = (value: string | number, timeZone = 'UTC') => new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export const Multiline = ({ name, label, value, required = false, maxLength = 4000 }: { name: string; label: string; value?: string; required?: boolean; maxLength?: number }) => <label className="field"><span>{label}</span><textarea name={name} defaultValue={value} required={required} maxLength={maxLength} rows={3} /></label>
export const Check = ({ name, children, checked = false, required = false }: { name: string; children: ReactNode; checked?: boolean; required?: boolean }) => <label className="field"><span><input type="checkbox" name={name} value="true" defaultChecked={checked} required={required} /> {children}</span></label>
export const Choice = ({ name, label, options, value, required = true }: { name: string; label: string; options: { value: string; label: string }[]; value?: string; required?: boolean }) => <label className="field"><span>{label}</span><select name={name} defaultValue={value ?? ''} required={required}><option value="">Choose {label.toLowerCase()}</option>{options.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
export const Representative = ({ choices, name = 'representativeId', value }: { choices: ClaimRepresentativeChoice[]; name?: string; value?: string }) => <Choice name={name} label="Employer representative" value={value} options={choices.map(p => ({ value: p.id, label: p.name }))} />
export const FileField = ({ name, label, required = true, json = false }: { name: string; label: string; required?: boolean; json?: boolean }) => <label className="field"><span>{label} · up to 512 KB</span><input type="file" name={name} required={required} accept={json ? '.json,application/json' : '.pdf,.txt,.html,.csv,.png,.jpg,.jpeg,.tif,.tiff,.rtf,application/pdf,text/plain,text/html,text/csv,image/png,image/jpeg,image/tiff,application/rtf'} /></label>
export const RequestBinding = ({ data }: { data: ClaimData }) => <><Hidden name="requestIdentity" value={data.request.requestIdentity} /><Hidden name="responseDigest" value={data.responseDigest ?? ''} /><Hidden name="employerEin" value={data.request.employerEin} /><Hidden name="stateEmployerId" value={data.request.stateEmployerId} /><Hidden name="agency" value={data.request.agency} /><Hidden name="state" value={data.request.state} /></>
export function DeadlineFields({ timeZone, followUp = false }: { timeZone?: string; followUp?: boolean }) {
  return <>
    <Field name="dueOn" label={followUp ? 'Follow-up due date on agency correspondence' : 'Due date on agency request'} type="date" />
    <Field name="deadlineAt" label="Response cutoff (UTC)" type="datetime-local" />
    <Field name="timeZone" label="Agency time zone" value={timeZone} />
    <Choice name="deadlineBasis" label="Cutoff source" value="internal-cutoff-on-agency-due-date" options={[{ value: 'internal-cutoff-on-agency-due-date', label: 'Our cutoff on the agency due date' }, { value: 'agency-specified-instant', label: 'Exact time stated by the agency' }]} />
  </>
}
export function PayrollFields({ people, choices, data }: { people: Person[]; choices: ClaimPayrollOption[]; data: ClaimData }) {
  return <>
    <Choice name="personId" label="Payroll worker" value={data.worker?.id} options={people.map(p => ({ value: p.id, label: p.name }))} />
    <fieldset><legend>Retained payroll records</legend>{choices.length ? choices.map((p, index) => <label key={p.kind + ':' + p.id} className="field"><span><input type="checkbox" name={'payroll.' + index} value={`${p.kind}:${p.id}:${p.version}`} defaultChecked={data.payroll.some(s => s.kind === p.kind && s.id === p.id && s.version === p.version)} /> {people.find(person => person.id === p.personId)?.name ?? 'Worker'} · {p.label} · {p.from} to {p.through} · {dollars(p.grossCents)}</span></label>) : <p>No reviewed payroll records are available. Add and review the worker’s original wage register first.</p>}</fieldset>
  </>
}
export function WillowFields({ data }: { data: ClaimData }) {
  return <fieldset><legend>{data.willow ? 'Replace reviewed Willow evidence' : 'Review Willow separation evidence'}</legend>
    <p>Use the original employee export and native completion audit for this worker.</p>
    <FileField name="willowManifest" label="Willow export manifest" json required={!data.willow && data.request.exchange === 'separation'} />
    <FileField name="willowRecords" label="Willow employee records" json required={!data.willow && data.request.exchange === 'separation'} />
    <FileField name="willowAudit" label="Willow completion audit" json required={!data.willow && data.request.exchange === 'separation'} />
    <Field name="willowSourceRef" label="Willow evidence reference" value={data.willow?.sourceRef} required={false} maxLength={500} />
    <Field name="lastDayWorked" label="Actual last day worked, evidenced in the completed HR task" type="date" value={data.willow?.lastDayWorked} required={false} />
    <Choice name="portalReason" label="Reviewed employer separation category" value={data.willow?.portalReason} options={separationReasons.map(reason => ({ value: reason, label: reason }))} required={false} />
    <Check name="willowReviewed">I reviewed the original Willow facts and completion evidence for this worker.</Check>
  </fieldset>
}
export function MandateFields({ data }: { data: ClaimData }) {
  return <fieldset><legend>{data.mandate ? 'Replace employer mandate' : 'Review employer mandate'}</legend>
    <FileField name="mandateFile" label="Employer mandate document" required={!data.mandate} />
    <Field name="mandateSourceRef" label="Mandate evidence reference" value={data.mandate?.sourceRef} required={false} maxLength={500} />
    <Field name="effectiveFrom" label="Mandate effective from" type="date" value={data.mandate?.effectiveFrom} required={false} />
    <Field name="effectiveThrough" label="Mandate effective through" type="date" value={data.mandate?.effectiveThrough} required={false} />
    <Check name="mandateReviewed">I reviewed this employer’s effective authority for the named representative to answer this agency.</Check>
  </fieldset>
}
export function AnswerFields({ data }: { data: ClaimData }) {
  const fields = data.request.exchange === 'separation' ? ['employerReason', 'jobTitle', 'firstDayOfWork', 'lastDayWorked', 'seasonal', 'compensationAfterSeparation', 'pensionOr401k', 'workersCompensation'] : ['workedOrReceivedPayments', 'stillWorking', 'regularRate', 'payFrequency', 'payPeriodStart', 'payPeriodEarnings']
  const additional=data.answers.filter(a=>a.field.startsWith('agency-question:')), extraIds=additional.map(a=>a.field.slice(16));for(let index=1,added=0;added<6;index++)if(!extraIds.includes('extra-'+index)){extraIds.push('extra-'+index);added++}
  const citations = [...(data.willow ? [{ value: data.willow.artifactId, label: 'Reviewed Willow separation evidence' }] : []), ...data.payroll.map(p => ({ value: p.id, label: `${p.from} to ${p.through} · ${dollars(p.grossCents)} · ${p.sourceRef}` })), ...data.artifacts.filter(file => ['application/pdf', 'text/plain', 'text/csv', 'application/rtf', 'image/tiff'].includes(file.mediaType) && file.id !== data.willow?.artifactId).map(file => ({ value: file.id, label: 'Selected attachment: ' + file.name }))]
  if(data.activeFollowUp)return <><Hidden name="questionSourceRef" value={data.activeFollowUp.sourceRef} />{data.activeFollowUp.questions.map((question,index)=>{const id=String(index+1),prior=data.answers.find(a=>a.field==='agency-question:'+id);return <fieldset key={id}><legend>{question.question}</legend><Hidden name={'question.'+id} value={question.question} /><Multiline name={'response.'+id} label="Proposed answer" value={prior?.value} required /><Choice name={'questionCitation.'+id} label="Supporting evidence for this answer" value={prior?.citations[0]} options={citations} /></fieldset>})}</>
  return <>{fields.map(field => {
    const prior = data.answers.find(a => a.field === field), willowField = ['employerReason', 'lastDayWorked'].includes(field)
    const value = prior?.value ?? (field === 'employerReason' ? data.willow?.portalReason : field === 'lastDayWorked' ? data.willow?.lastDayWorked : undefined)
    return <fieldset key={field}><legend>{portalFieldSchema[field].label}</legend>
      {field === 'employerReason' ? <Choice name={'answer.' + field} label="Employer response" value={value} options={separationReasons.map(reason => ({ value: reason, label: reason }))} /> : ['seasonal', 'compensationAfterSeparation', 'workersCompensation', 'stillWorking', 'workedOrReceivedPayments'].includes(field) ? <Choice name={'answer.' + field} label="Employer response" value={value} options={['Yes', 'No'].map(v => ({ value: v, label: v }))} /> : <Field name={'answer.' + field} label="Employer response" value={value} type={['firstDayOfWork', 'lastDayWorked', 'payPeriodStart'].includes(field) ? 'date' : 'text'} maxLength={2000} />}
      <Choice name={'cite.' + field} label="Supporting evidence" value={prior?.citations[0] ?? (willowField ? data.willow?.artifactId : undefined)} options={willowField ? citations.filter(c => c.value === data.willow?.artifactId) : citations} />
    </fieldset>
  })}<details><summary>Additional questions on this agency request</summary><p>Copy every additional question from the original request and current portal, with its exact proposed answer and supporting evidence. Retain the complete original request. Changed questions or answers need a fresh review before submission.</p><Hidden name="questionSourceRef" value={data.request.sourceRef} />{extraIds.map((id,index)=>{const prior=additional.find(a=>a.field==='agency-question:'+id);return <fieldset key={id}><legend>Additional question {index+1}</legend><Field name={'question.'+id} label="Exact agency question" value={prior?.question} required={false} maxLength={1000} /><Multiline name={'response.'+id} label="Proposed answer" value={prior?.value} /><Choice name={'questionCitation.'+id} label="Supporting evidence for this answer" value={prior?.citations[0]} options={citations} required={false} /></fieldset>})}</details></>
}

export function AttachmentFields({ data }: { data: ClaimData }) {
  const files = data.artifacts.filter(file => ['application/pdf', 'text/plain', 'text/csv', 'application/rtf', 'image/tiff'].includes(file.mediaType))
  return <fieldset><legend>Original evidence to attach to this response</legend>{files.length ? files.map(file => <Check key={file.id} name={'attachment.' + file.id} checked={data.attachments?.some(attachment => attachment.id === file.id)}>{file.name} · {Math.ceil(file.bytes / 1024)} KB</Check>) : <p>No retained files have a format accepted for portal attachments.</p>}<p>When citing an attachment below, select that file here too. The selected originals remain part of the exact response review.</p></fieldset>
}
