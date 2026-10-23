import type { Session } from '../../modules/operator-auth/index.mjs'
import type { Company } from '../records'
import type { RestoredCustody } from './custody'
import { page, Card, Hidden, Submit } from '../pages'
export function restoredCustodyPage(session:Session,companies:Company[],restored:Awaited<ReturnType<RestoredCustody['list']>>) {
  return page(session,'Restored archive custody',companies,undefined,<>
    <Card title="Fresh custody, inactive work">
      <p className="evidence-text">No sessions, company grants, agent credentials or provider keys were imported. The original company creator who is still a current native owner may explicitly adopt historical read custody after fresh confirmation. Adoption is recorded for this company and grants read access to its payroll records, historical approvals, notices, private original files and provider references; provider lookup requires separate consent. This never resumes schedules, payments, filings, correspondence or agent execution. All changes remain held until fresh connection and original-effect reconciliation are implemented.</p>
      <form method="post" action="/auth/step-up"><Hidden name="action" value="credentials:mint" /><Hidden name="returnTo" value="/app/envelope/restored" /><Submit>Send custody confirmation</Submit></form>
    </Card>
    {restored.length ? restored.map(c=><Card key={c.id} title={c.name}>
      <p className="evidence-text">EIN ending {c.einSuffix}. Historical archive company; outbound work paused.</p>
      <form method="post" action={'/app/envelope/restored/'+c.id+'/adopt'}>
        <label className="field"><span><input type="checkbox" name="confirm" value="true" required /> I consent to recorded read access to this company’s archived payroll records, historical approvals, notices, private original files and provider references. Changes remain paused; provider lookup needs separate consent.</span></label>
        <Submit>Adopt historical read custody</Submit>
      </form>
    </Card>) : <Card title="No restored companies for this owner"><p className="evidence-text">No inactive imported company created by this current owner is available.</p></Card>}
  </>)
}
