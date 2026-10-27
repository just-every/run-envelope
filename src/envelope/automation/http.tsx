import type { Records, Company, Input } from '../records'
import type { Session } from '../../modules/operator-auth/index.mjs'
import { page, Card, Field, Hidden, Submit, companyPath } from '../pages'
import { WorkspaceStore } from '../workspace/store'
import { Automation } from './work'
import { PayrollError } from '../security'
interface Context {ui:boolean;post:boolean;parts:string[];value:Input;records:Records;session:Session;companies:Company[]}
export async function automationResponse({ui,post,parts,value,records,session,companies}:Context) {
  if(parts[0]!=='companies'||parts[2]!=='automation') return null
  const actor=await records.actor(parts[1]),work=new Automation(new WorkspaceStore(records)),base=companyPath(actor.company)+'/automation'
  let result:unknown
  if(post) {
    if(parts.length===3) result=await work.save(actor,value)
    else if(parts.length===4 && parts[3]==='process')result=await work.tick(actor)
    else if(parts.length===4 && parts[3]==='disposition')result=await work.dispose(actor,value)
    else throw new PayrollError('not_found',404)
    if(!ui)return Response.json(result,{headers:{'cache-control':'no-store'}})
    return new Response(null,{status:303,headers:{location:base,'cache-control':'no-store'}})
  }
  if(parts.length!==3)throw new PayrollError('not_found',404)
  const policies=await work.policies(actor),tasks=await work.tasks(actor)
  if(!ui)return Response.json({policies,tasks,delivery:'unavailable',serviceCoverage:'unverified',scheduler:'explicit authorized pass required',dispatchAuthority:false},{headers:{'cache-control':'no-store'}})
  const owner=actor.grant.role==='owner',canPrepare=owner||(actor.grant.actions.includes('automation:prepare')&&actor.grant.actions.includes('rates:propose')),canDispose=owner||actor.grant.actions.includes('automation:dispose')
  return page(session,'Automation settings',companies,actor.company,<>
    <Card title="Preparation and follow-up"><p>Weekly earnings drafts need exact human review. Tax calculation and payment release remain held. Processing requires a currently authorized preparer; background scheduling is unavailable.</p><p>Task delivery is unavailable. No task confirms receipt or staffed service coverage. Cutoffs repeat at the configured UTC time; verify each bank or agency deadline separately.</p>
      {canPrepare&&<form method="post" action={base+'/process'}><Submit>Process due work</Submit></form>}
      {policies.map(p=><p key={p.id}>{p.data.name} · version {p.version} · weekly · {p.data.cutoff} cutoff</p>)}
    </Card>
    {owner&&<Card title="Weekly preparation"><form method="post" action={base} className="field">
      <Field name="id" label="Schedule reference"/><Hidden name="version" value="0"/>
      <Field name="name" label="Schedule name"/><Field name="groupId" label="Reviewed pay group reference"/>
      <Field name="periodStart" label="First period starts" type="date"/><Field name="periodEnd" label="First period ends" type="date"/><Field name="payDate" label="First pay date" type="date"/>
      <Field name="prepareAt" label="First preparation instant with UTC offset"/><Field name="cutoff" label="First official cutoff with UTC offset"/>
      <Field name="approver" label="Responsible approver"/><Field name="backup" label="Backup approver"/><Field name="duty" label="Service duty contact"/>
      <Submit>Save weekly preparation</Submit>
    </form></Card>}
    <Card title={tasks.length?'Retained follow-up':'No follow-up tasks yet'}>{tasks.map(t=><div key={t.policy_id+t.occurrence+t.stage} className="field"><p>{t.occurrence} · {t.stage} · {t.recipient} · due {new Date(t.due_at).toISOString()} · delivery {t.delivery} · {t.disposed_at?'Disposition recorded':'Open obligation'}</p>{t.reason&&<p>{t.reason}</p>}{!t.disposed_at&&canDispose&&<form method="post" action={base+'/disposition'} className="field"><Hidden name="policyId" value={t.policy_id}/><Hidden name="occurrence" value={t.occurrence}/><Hidden name="stage" value={t.stage}/><Field name="reason" label="Justified disposition" maxLength={1000}/><Submit>Record disposition</Submit></form>}</div>)}</Card>
  </>)
}
