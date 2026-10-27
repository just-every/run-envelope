import { WorkspaceStore } from '../workspace/store'
import { PayItems } from '../workspace/pay-items'
import { fence, auditStatement, type Actor } from '../access'
import type { Input } from '../records'
import { PayrollError, text, date, integer, recordKey, seal, unseal } from '../security'
import { supportThreshold } from './clock'
export interface Policy { name:string; groupId:string; periodStart:string; periodEnd:string; payDate:string; prepareAt:string; cutoff:string; approver:string; backup:string; duty:string }
export interface Task { policy_id:string; occurrence:string; stage:string; recipient:string; due_at:number; delivery:string; disposed_by:string|null; disposed_at:number|null; reason:string|null }
const shift=(day:string,n:number)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10)
export class Automation {
  constructor(public store:WorkspaceStore) {}
  owner(actor:Actor) {
    if(actor.grant.role!=='owner' || actor.session.kind!=='native' || actor.session.operator.email.toLowerCase()!==this.store.records.env.OWNER_EMAIL.toLowerCase()) throw new PayrollError('native_owner_required',403)
  }
  async policies(actor:Actor) { this.owner(actor); const rows=await this.store.list<Policy>(actor,'automation-policy',undefined,true);return rows.filter((r,i)=>rows.findIndex(x=>x.id===r.id)===i) }
  async save(actor:Actor,input:Input) {
    this.owner(actor)
    const instant=(key:string)=>{const v=text(input[key],40);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)%60000)throw new PayrollError('deadline_offset_required');return new Date(v).toISOString()}
    const data:Policy={name:text(input.name),groupId:text(input.groupId),periodStart:date(input.periodStart),periodEnd:date(input.periodEnd),payDate:date(input.payDate),prepareAt:instant('prepareAt'),cutoff:instant('cutoff'),approver:text(input.approver),backup:text(input.backup),duty:text(input.duty)}
    if(Date.parse(data.periodEnd)-Date.parse(data.periodStart)!==6*86400000 || data.payDate<data.periodEnd || Date.parse(data.prepareAt)>Date.parse(data.cutoff)) throw new PayrollError('invalid_automation_period')
    // Names identify accountable tasks only. They confer neither grants nor service coverage.
    return this.store.append(actor,'automation-policy',text(input.id),input.version===0||input.version==='0'?0:integer(input.version),data,undefined,true)
  }
  async tasks(actor:Actor) {
    this.owner(actor);const f=fence(actor)
    const rows=(await this.store.records.statement(`SELECT policy_id,occurrence,stage,recipient,due_at,delivery,disposed_by,disposed_at,disposition_cipher FROM env_automation_tasks WHERE company_id=? AND ${f.sql} ORDER BY due_at,stage`,[actor.company,...f.args]).all<Omit<Task,'reason'>&{disposition_cipher:string|null}>()).results
    const key=await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY)
    return Promise.all(rows.map(async({disposition_cipher,...task})=>({...task,reason:disposition_cipher?await unseal(key,JSON.stringify([actor.company,task.policy_id,task.occurrence,task.stage]),disposition_cipher):null})))
  }
  async tick(actor:Actor) {
    this.owner(actor);const policies=await this.policies(actor),pay=new PayItems(this.store)
    for(const row of policies) {
      const p=row.data,now=Date.now()
      // Refuse oversized catch-up explicitly rather than dropping old obligations.
      if(now>=Date.parse(p.prepareAt)+364*86400000) throw new PayrollError('automation_catchup_review_required',409)
      for(let week=0;week<52;week++) {
        const days=week*7,prepareAt=Date.parse(p.prepareAt)+days*86400000
        if(prepareAt>now) break
        const occurrence=shift(p.periodStart,days),id='auto-'+row.id+'-'+occurrence
        let run=(await this.store.list(actor,'earnings-run',undefined,true,false)).find(r=>r.id===id)
        if(!run) {
          try { await pay.preview(actor,{id,version:0,groupId:p.groupId,periodStart:occurrence,periodEnd:shift(p.periodEnd,days),payDate:shift(p.payDate,days),frequency:'weekly'},true) }
          catch(error) {
            // Another current owner pass may have won the immutable version insert.
            run=(await this.store.list(actor,'earnings-run',undefined,true,false)).find(r=>r.id===id)
            if(!run) throw error
          }
        }
        const cutoff=Date.parse(p.cutoff)+days*86400000
        for(const [stage,recipient,due] of [ ['hours',p.approver,prepareAt],['approval',p.approver,prepareAt],['backup',p.backup,supportThreshold(cutoff,8)],['service',p.duty,supportThreshold(cutoff,4)] ] as const) {
          if(now<due)continue
          const f=fence(actor),event=crypto.randomUUID()
          await this.store.records.env.DB.batch([
            this.store.records.statement(`INSERT OR IGNORE INTO env_automation_tasks(company_id,policy_id,occurrence,stage,recipient,due_at,created_at,change_id) SELECT ?,?,?,?,?,?,?,? WHERE ${f.sql}`,[actor.company,row.id,occurrence,stage,recipient,due,now,event,...f.args]),
            auditStatement(this.store.records.env,actor,event,'automation.processed',id,row.version,'EXISTS(SELECT 1 FROM env_automation_tasks WHERE change_id=?)',[event]),
          ])
        }
      }
    }
    return {tasks:await this.tasks(actor),dispatchAuthority:false,delivery:'unavailable',scheduler:'explicit owner pass required',serviceCoverage:'unverified'}
  }
  async dispose(actor:Actor,input:Input) {
    this.owner(actor)
    const policy=text(input.policyId),occurrence=date(input.occurrence),stage=text(input.stage),reason=text(input.reason,1000),f=fence(actor),event=crypto.randomUUID(),now=Date.now()
    const cipher=await seal(await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,policy,occurrence,stage]),reason)
    const results=await this.store.records.env.DB.batch([
      this.store.records.statement(`UPDATE env_automation_tasks SET disposition_cipher=?,disposed_by=?,disposed_at=?,change_id=? WHERE company_id=? AND policy_id=? AND occurrence=? AND stage=? AND disposed_at IS NULL AND ${f.sql} RETURNING stage`,[cipher,actor.session.operator.id,now,event,actor.company,policy,occurrence,stage,...f.args]),
      auditStatement(this.store.records.env,actor,event,'automation.disposition',policy,1,'EXISTS(SELECT 1 FROM env_automation_tasks WHERE change_id=?)',[event]),
    ])
    if(!results[0].results.length) throw new PayrollError('task_changed',409)
    return {disposed:true}
  }
}
