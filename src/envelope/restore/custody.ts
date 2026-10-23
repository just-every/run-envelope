import type { Records, Input } from '../records'
import { sessionFence, actions, fields, type Actor } from '../access'
import { requirePayrollProof, stepUpFence } from '../step-up'
import { PayrollError, text } from '../security'

/** Fresh owner consent adopts historical read custody; no provider/work is resumed. */
export class RestoredCustody {
  constructor(public records:Records) {}
  owner() {if(this.records.session.operator.role!=='owner') throw new PayrollError('owner_required',403)}
  async list() {
    this.owner()
    const f=sessionFence(this.records.session)
    return (await this.records.statement(`SELECT id,name,ein_suffix AS einSuffix FROM env_companies WHERE restored=1 AND created_by=? AND ${f.sql} ORDER BY name,id`,[this.records.session.operator.id,...f.args]).all<{id:string;name:string;einSuffix:string}>()).results
  }
  async adopt(company:string,input:Input) {
    this.owner()
    if(Object.keys(input).some(k=>k!=='confirm') || (input.confirm!==true && input.confirm!=='true')) throw new PayrollError('explicit_custody_confirmation_required')
    company=text(company)
    const session=this.records.session,actor:Actor={session,company,grant:{role:'owner',locations:['*'],fields:[...fields],actions:[...actions],version:0}},
      f=sessionFence(session),proof=stepUpFence(actor),event=crypto.randomUUID()
    await requirePayrollProof(this.records.env,actor)
    const result=await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_grants(company_id,operator_id,role,locations,fields,actions,version,change_id)
        SELECT ?,?,'owner','["*"]',?,?,1,? WHERE ${f.sql} AND ${proof.sql}
        AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')
        AND EXISTS(SELECT 1 FROM env_companies WHERE id=? AND restored=1 AND created_by=?)
        ON CONFLICT(company_id,operator_id) DO NOTHING RETURNING company_id`,[company,session.operator.id,JSON.stringify(fields),JSON.stringify(actions),event,...f.args,...proof.args,session.operator.id,company,session.operator.id]),
      this.records.statement(`INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
        SELECT ?,?,?,'archive.custody.adopted',?,1,? WHERE EXISTS(SELECT 1 FROM env_grants WHERE company_id=? AND operator_id=? AND change_id=?)`,[event,company,session.operator.id,company,Date.now(),company,session.operator.id,event]),
    ])
    if(!result[0].results.length) throw new PayrollError('restored_custody_or_authority_changed',409)
    return {id:company,mode:'historical-read-only',outbound:'paused',reconciliation:'required-before-any-future-activation'}
  }
}
