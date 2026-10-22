import type { PayChange } from './pay-items'
const dollars = (value: number | null | undefined) => value == null ? 'Unknown' :
  (value / 100).toLocaleString('en-US', {style:'currency',currency:'USD'})
const basis = (value?: string | null) => value === 'hourly' ? 'per hour' : value === 'annual-salary' ? 'per year' : ''

export function PayChangeTerms({ change }: {change: PayChange}) {
  return <>
    <p>Pay group {change.groupId} · Effective {change.effectiveDate}</p>
    {change.items.map((item) => {
      const diff = change.diff?.people.find((p) => p.personId === item.personId)
      return <article key={item.personId}>
        <h3>{item.personName}</h3>
        <p>Rate: {dollars(diff?.beforeRateCents)} {basis(diff?.beforeBasis)} → <strong>{dollars(item.rateCents)} {basis(item.basis)}</strong></p>
        <p>Employment: {item.employmentFrom}–{item.employmentThrough}. Salary classification: {item.salaryType ?? 'unverified'}.</p>
        {diff?.firstPeriod ? <>
          <p>First affected period: {diff.firstPeriod.periodStart}–{diff.firstPeriod.periodEnd}, pays {diff.firstPeriod.payDate} ({diff.firstPeriod.frequency}).</p>
          <p>Base earnings: {dollars(diff.beforeEarningsCents)} → <strong>{dollars(diff.afterEarningsCents)}</strong>. Change: {dollars(diff.deltaCents)}.</p>
        </> : <p>First affected period and earnings are unknown until a current worker schedule is recorded.</p>}
        <p>{diff?.eligibility === 'earnings-preview-only' ? 'Base earnings preview only. Taxes, net pay and lawful payment eligibility remain unresolved.' : 'Inputs need review before this comparison is complete.'}</p>
        {diff?.holds.map((reason,index) => <p key={index}>{reason}</p>)}
        {item.unpaidDates.length > 0 && <p>Untyped unpaid dates (no salary deduction authority): {item.unpaidDates.join(', ')}.</p>}
        {item.unpaidLeave?.map((leave) => <p key={leave.day}>Unpaid leave: {leave.day}, {leave.minutes} minutes, {leave.reason}. Evidence: {leave.evidenceRef || 'Missing'}.</p>)}
        <details><summary>Source references for {item.personName}</summary>
          <p>Person {item.personId}, version {item.personVersion}. Pay group version {change.groupVersion}.</p>
          {diff?.firstPeriod && <p>Schedule {diff.firstPeriod.scheduleId}, version {diff.firstPeriod.scheduleVersion}.</p>}
        </details>
      </article>
    })}
    {change.diff && <>
      <h3>Total first-period base earnings</h3>
      <p>{dollars(change.diff.totals.beforeEarningsCents)} → <strong>{dollars(change.diff.totals.afterEarningsCents)}</strong>. Change: {dollars(change.diff.totals.deltaCents)}.</p>
      <p>{change.diff.scope}</p>
    </>}
  </>
}
