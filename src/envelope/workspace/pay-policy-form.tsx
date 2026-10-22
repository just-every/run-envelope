import { Field, Submit } from '../pages'
import type { ProrationPolicy } from './proration'
export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const methods = {
  'calendar-days': 'Calendar days',
  'scheduled-workdays': 'Scheduled workdays',
  'scheduled-hours': 'Scheduled hours',
}

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
    <label className="field"><span>Salary proration method</span>
      <select name="method" required>{Object.entries(methods).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
    </label>
    <fieldset><legend>Normal weekly schedule</legend>
      {weekDays.map((day,index) => <Field key={day} name={'scheduledMinutes' + index}
        label={day + ' scheduled minutes (0 for a day off)'} type="number" value={index === 0 || index === 6 ? 0 : 480} />)}
    </fieldset>
    <label className="field"><span>Workweek begins</span>
      <select name="weekStartsOn" defaultValue="1" required>{weekDays.map((day,index) => <option key={day} value={index}>{day}</option>)}</select>
    </label>
    <p>Review the method, schedule and effective date before adopting this policy. This setup decision cannot approve payroll.</p>
    <Submit>Propose proration policy</Submit>
  </form>
}
export function PayPolicyTerms({ policy }: {policy: ProrationPolicy}) {
  return <>
    <p>Pay group: {policy.groupName ?? policy.groupId}</p>
    <p>Effective {policy.effectiveDate} · {methods[policy.method]} · Workweek begins {weekDays[policy.weekStartsOn]}</p>
    <ul>{weekDays.map((day,index) => <li key={day}>{day}: {policy.weekMinutes[index] ? policy.weekMinutes[index] + ' scheduled minutes' : 'Day off'}</li>)}</ul>
    <p>Every salary preview remains held until work-state rules and complete payroll eligibility are resolved.</p>
  </>
}
