import { Field, Select, Submit } from '../pages'

export function PayPolicyForm({ base, groups }: {
  base: string; groups: {id: string; name: string}[]
}) {
  return <form className="field" method="post" action={base + '/proration-policy'}>
    <Field name="id" label="Proration policy ID" />
    <Field name="version" label="Previous policy version (0 for new)" type="number" value={0} />
    <Field name="name" label="Proration policy name" />
    <label className="field"><span>Proration pay group</span>
      <select name="groupId" required>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
    </label>
    <Field name="effectiveDate" label="Proration effective date" type="date" />
    <Select name="method" label="Salary proration method"
      choices={['calendar-days', 'scheduled-workdays', 'scheduled-hours']} />
    <Field name="weekMinutes" label="Scheduled minutes, Sunday through Saturday (JSON array)"
      value="[0,480,480,480,480,480,0]" maxLength={80} />
    <Field name="weekStartsOn" label="Workweek starts (0 Sunday through 6 Saturday)" type="number" value={1} />
    <p>Review the method, schedule and effective date before adopting this policy. This setup decision cannot approve payroll.</p>
    <Submit>Propose proration policy</Submit>
  </form>
}
