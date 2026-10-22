import { Card, Field, Hidden, Select, Submit } from '../pages'
import type { LocalTaxInput } from './local-tax-inputs'
import type { Revision } from './store'

export function LocalTaxCard({base,rows,edit}: {base:string;rows:Revision<LocalTaxInput>[];edit?:{kind:string;id:string}}) {
  const row=edit?.kind==='local-tax-input' ? rows.find((r) => r.id===edit.id) : undefined
  const exemptionKeys:Record<string,string>={exemptionYear:'year',exemptionCertificateRef:'certificateRef',exemptionSupportingRef:'supportingEvidenceRef'}
  const value=(key:string) => (row?.data as unknown as Record<string,unknown>)?.[key] ??
    (row?.data.lst as unknown as Record<string,unknown>)?.[key] ??
    (row?.data.lst.exemption as unknown as Record<string,unknown>)?.[exemptionKeys[key] ?? key]
  const fields:[string,string][]=[
    ['courtesyElectionRef','Courtesy withholding evidence'],['principalWorkPsd','Principal LST worksite PSD'],
    ['principalEmploymentEvidenceRef','Principal employer/worksite evidence'],['payrollPeriodsPerYear','Established payroll periods per year'],
    ['priorCollectedCents','LST already collected before this period, cents'],['priorCollectionEvidenceRef','Prior LST collection evidence'],
    ['periodCollectedCents','LST already collected this period, cents'],['periodCollectionEvidenceRef','Current-period LST evidence'],
    ['employerPittsburghYtdCents','Pittsburgh year-to-date wages, cents'],['ytdEvidenceRef','Year-to-date wage evidence'],
    ['exemptionCatchupPeriods','Prior exempt installments to restore (0 if none)'],['catchupEvidenceRef','Missed exemption installments evidence'],
    ['restorationNoticeRef','Exemption restoration notice reference'],['eitRoundingEvidenceRef','Local cent-rounding determination reference'],
  ]
  const moneyFields=new Set(['priorCollectedCents','periodCollectedCents','employerPittsburghYtdCents','payrollPeriodsPerYear','exemptionCatchupPeriods'])
  return <Card title="Pittsburgh local period facts">
    <p>Actual residence/worksite PSDs and source evidence belong on the location records below. Record each period's principal employer and LST collections separately. Blank amounts are unknown. No exemption, missing balance or remaining-year catch-up is inferred.</p>
    {rows.map((r) => <p key={r.id+':'+r.version}>{r.data.from}–{r.data.through}, pays {r.data.payDate}, v{r.version} · {r.sourcesCurrent ? 'Current source' : 'Worker source changed'} · {r.data.owner}. <a href={base+'?edit=local-tax-input&id='+r.id}>Revise period facts</a></p>)}
    <details open={Boolean(row)}><summary>Record or revise local period facts</summary>
      <form className="field" method="post" action={base+'/local-tax-input'}>
        <Hidden name="id" value={row?.id ?? crypto.randomUUID()} /><Hidden name="version" value={row?.version ?? 0} />
        <Field name="from" label="Local tax period starts" type="date" value={row?.data.from} />
        <Field name="through" label="Local tax period ends" type="date" value={row?.data.through} />
        <Field name="payDate" label="Local tax pay date" type="date" value={row?.data.payDate} />
        <Select name="frequency" label="Local period frequency" choices={['weekly','biweekly','semimonthly','monthly']} value={row?.data.frequency} />
        <label className="field"><span><input type="checkbox" name="ordinaryCashOnly" value="true" defaultChecked={row?.data.ordinaryCashOnly} /> These allocations are ordinary PA-taxable cash wages</span></label>
        <Select name="employerState" label="Employer location for courtesy scope" choices={['unknown','NJ','PA']} value={row?.data.employerState} />
        <Select name="courtesyWithholding" label="Out-of-state courtesy EIT election" choices={['unknown','elected','declined']} value={row?.data.courtesyWithholding} />
        <Select name="principalEmployer" label="Principal LST employer" choices={['unknown','this','other']} value={row?.data.lst.principalEmployer} />
        <Select name="midyearEntry" label="New midyear LST entry" choices={['unknown','yes','no']} value={row?.data.midyearConfirmed ? row.data.lst.midyearEntry ? 'yes' : 'no' : 'unknown'} />
        <Select name="eitCentRounding" label="Documented local cent-rounding method" choices={['unknown','nearest-half-up']} value={row?.data.eitCentRounding} />
        {fields.map(([key,label]) => <Field key={key} name={key} label={label} type={moneyFields.has(key) ? 'number' : 'text'} value={value(key) as string|number|undefined} required={false} maxLength={500} />)}
        <Select name="exemptionStatus" label="LST exemption applicability" choices={['unknown','none','low-income','multiple-employers','active-duty','military-disability']} value={row?.data.exemptionKnown ? row.data.lst.exemption?.reason ?? 'none' : 'unknown'} />
        <details><summary>Claimed exemption or restoration evidence</summary>
          {[
            ['exemptionYear','Exemption tax year'],['exemptionCertificateRef','Exemption certificate reference'],
            ['exemptionSupportingRef','Exemption supporting evidence'],['expectedPittsburghAnnualCents','Expected Pittsburgh annual wages, cents'],
            ['principalPayStatementRef','Principal employer pay statement'],['principalEmployeeStatementRef','Principal employer employee statement'],
            ['principalPeriodLstCents','Principal employer current-period LST, cents'],
          ].map(([key,label]) => <Field key={key} name={key} label={label} value={value(key) as string|number|undefined} required={false} maxLength={500} />)}
          {[
            ['exemptionFiledEmployer','Exemption filing with employer confirmed'],['exemptionFiledCity','Exemption filing with city confirmed'],
            ['exemptionCurrentlyEligible','Exemption currently eligible'],
          ].map(([key,label]) => <label className="field" key={key}><span><input type="checkbox" name={key} value="true" defaultChecked={Boolean((row?.data.lst.exemption as unknown as Record<string,unknown>)?.[{exemptionFiledEmployer:'filedWithEmployer',exemptionFiledCity:'filedWithCity',exemptionCurrentlyEligible:'currentEligibility'}[key] ?? key])} /> {label}</span></label>)}
        </details>
        <Submit>Record local period facts</Submit>
      </form>
    </details>
  </Card>
}
