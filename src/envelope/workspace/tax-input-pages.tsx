import { Card, Field, Hidden, Select, Submit } from '../pages'
import type { Allocations } from './allocations'
import type { TaxElection } from './tax-elections'
import type { Revision } from './store'

export function WithholdingPreview({base,preview}: {
  base:string;preview?:Awaited<ReturnType<Allocations['preview']>>
}) {
  const tax=preview?.withholding
  return <Card title="Ordinary cash withholding preview">
    <p>Use one actual pay period and pay date. NJ, PA and NY state tables and Pittsburgh local inputs cover recorded ordinary cash wages. Taxability exclusions, other jurisdictions and full net pay remain unresolved.</p>
    <form className="field" method="get" action={base}>
      <Field name="from" label="Withholding period starts" type="date" value={preview?.from} />
      <Field name="through" label="Withholding period ends" type="date" value={preview?.through} />
      <Field name="payDate" label="Actual withholding pay date" type="date" value={tax?.payDate} />
      <Select name="frequency" label="Withholding pay frequency" choices={['weekly','biweekly','semimonthly','monthly']} value={tax?.frequency} />
      <Submit>Calculate ordinary cash withholding</Submit>
    </form>
    {tax && <div className="field evidence-text">
      <h3>State-only calculation · {tax.from}–{tax.through}</h3>
      <p>Paid {tax.payDate} ({tax.frequency}). This preview cannot authorize a deduction or payment. Net pay remains unknown.</p>
      {tax.states.map((state) => <article key={state.state}>
        <h3>{state.state} state withholding</h3>
        <p>Candidate taxable/report wages ${(state.taxableWagesCents/100).toFixed(2)} · withholding <strong>{state.withholdingCents===null ? 'Unknown' : '$'+(state.withholdingCents/100).toFixed(2)}</strong>.</p>
        <p><a href={state.source.url} rel="noreferrer">{state.source.title}</a> · {state.determination}</p>
        {state.holds.map((reason,index) => <p key={index}>{reason} Owner: {tax.owner}.</p>)}
        <details><summary>{state.state} calculation and source inputs</summary>
          <p>{state.explanation}</p>
          {state.inputRef && <p>Withholding input {state.inputRef}.</p>}
          {state.calculation!==undefined && <dl>{Object.entries(state.calculation as Record<string,unknown>).map(([key,value]) => <div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{String(value)}</dd></div>)}</dl>}
        </details>
      </article>)}
      <article>
        <h3>Pittsburgh local withholding</h3>
        <p>EIT: <strong>{tax.local.eitCents===null ? 'Unknown' : '$'+(tax.local.eitCents/100).toFixed(2)}</strong> · gross local liability {tax.local.eitLiabilityCents===null ? 'Unknown' : '$'+(tax.local.eitLiabilityCents/100).toFixed(2)} · LST: <strong>{tax.local.lstCents===null ? 'Unknown' : '$'+(tax.local.lstCents/100).toFixed(2)}</strong>.</p>
        <p><a href={tax.local.provenance.sources.register} rel="noreferrer">Official DCED 2026 register · Pittsburgh PSD 700102</a></p>
        {tax.local.holds.map((hold,index) => <p key={index}>{hold.reason} Owner: {tax.owner}.</p>)}
        {tax.local.detail.map((detail,index) => <p key={index}>{detail}</p>)}
      </article>
    </div>}
  </Card>
}
export function TaxElectionCard({base,rows,edit}: {
  base:string;rows:Revision<TaxElection>[];edit?:{kind:string;id:string}
}) {
  const row=edit?.kind==='tax-election' ? rows.find((r) => r.id===edit.id) : undefined
  return <Card title="Sourced state withholding inputs">
    <p>Record the actual NJ-W4 / NY IT-2104 inputs. A reference is not verified signed-form custody or approval to pay.</p>
    {rows.map((r) => <p key={r.id+':'+r.version}>{r.data.state}, {r.data.from}–{r.data.through}, v{r.version} · {r.sourcesCurrent ? 'Current source' : 'Worker source changed'} · entered by {r.data.owner}. <a href={base+'?edit=tax-election&id='+r.id}>Revise these inputs</a></p>)}
    <details open={Boolean(row)}><summary>Record or revise state withholding inputs</summary>
      <form className="field" method="post" action={base+'/tax-election'}>
        <Hidden name="id" value={row?.id ?? crypto.randomUUID()} /><Hidden name="version" value={row?.version ?? 0} />
        <Field name="from" label="State inputs effective from" type="date" value={row?.data.from} />
        <Field name="through" label="State inputs effective through" type="date" value={row?.data.through} />
        <Select name="state" label="State withholding election" choices={['NJ','NY']} value={row?.data.state} />
        <Select name="table" label="NJ-W4 table (NJ only)" choices={['A','B','C','D','E']} value={row?.data.table} />
        <Select name="filingStatus" label="IT-2104 table (NY only)" choices={['single','head-of-household','married','married-withhold-single']} value={row?.data.filingStatus} />
        <Field name="allowances" label="Elected state allowances (NY may be negative)" type="number" value={row?.data.allowances} />
        <Field name="additionalCents" label="Additional state withholding in cents" type="number" value={row?.data.additionalCents} />
        <Field name="evidenceRef" label="State form evidence reference" value={row?.data.evidenceRef} maxLength={500} />
        <Submit>Record sourced state inputs</Submit>
      </form>
    </details>
  </Card>
}
