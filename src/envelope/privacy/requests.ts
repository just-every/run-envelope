import type { Records, Input } from '../records'
import type { Actor } from '../access'
import { fence, auditStatement } from '../access'
import { requirePayrollProof, stepUpFence } from '../step-up'
import { PayrollError, text, date } from '../security'
import { digest } from '../workspace/store'
import { redact } from '../providers'
import { createPortability } from '@runeditrun/rer/modules/portability'
import policy from '../archive/policy.mjs'
const uuid=()=>crypto.randomUUID()
const keyFor=(company:string,person:string)=>digest(JSON.stringify([company,'erased-person',person]))
/** An explicit owner action; dates never start destructive work automatically. */
export class Privacy {
  constructor(public records:Records) {}
  owner(actor:Actor) {if(actor.grant.role!=='owner') throw new PayrollError('owner_required',403)}
  async list(actor:Actor) {
    this.owner(actor)
    const f=fence(actor)
    const rows=(await this.records.statement(`SELECT id,person_id AS personId,state,retained,requested_at AS requestedAt,completed_at AS completedAt FROM env_privacy_requests WHERE company_id=? AND ${f.sql} ORDER BY requested_at DESC LIMIT 100`,[actor.company,...f.args]).all<{id:string;personId:string|null;state:string;retained:string;requestedAt:number;completedAt:number|null}>()).results
    return Promise.all(rows.map(async r=>({...r,retained:r.state==='held' && r.personId ? {...await this.inventory(actor,r.personId),reason:JSON.parse(r.retained).reason} : JSON.parse(r.retained)})))
  }
  async inventory(actor:Actor,person:string) {
    await this.records.person(actor,person)
    const privateRows=(await this.records.statement('SELECT kind,version FROM env_private_records WHERE company_id=? AND person_id=?',[actor.company,person]).all<{kind:string;version:number}>()).results
    // Current payroll evidence is not guessed away as eligible. Its precise
    // references stay visible pending a category-specific lawful release plan.
    const history=(await this.records.statement(`SELECT 'rate-proposal' AS category,id AS reference FROM env_rate_proposals WHERE company_id=? AND person_id=?
      UNION ALL SELECT 'payroll-version',object_id FROM env_workspace_versions WHERE company_id=? AND person_id=?
      UNION ALL SELECT 'shared-payroll-version',object_id FROM env_workspace_people WHERE company_id=? AND person_id=?
      UNION ALL SELECT 'agent-draft',id FROM env_run_drafts WHERE company_id=? AND person_id=?`,[actor.company,person,actor.company,person,actor.company,person,actor.company,person]).all<{category:string;reference:string}>()).results
    const hold=await this.records.statement('SELECT kind,basis,custodian,release_date AS releaseDate FROM env_privacy_holds WHERE company_id=? AND person_id=? AND released_at IS NULL',[actor.company,person]).first<{kind:string;basis:string;custodian:string;releaseDate:string}>()
    return {fields:['person.name','person.location_id','person.version',...privateRows.map(r=>'private.'+r.kind+'@'+r.version)],history,hold}
  }
  async hold(actor:Actor,input:Input) {
    this.owner(actor);await requirePayrollProof(this.records.env,actor)
    const kind=input.kind??'statutory'
    if(typeof kind!=='string' || !['statutory','legal'].includes(kind)) throw new PayrollError('invalid_hold_kind')
    const person=text(input.personId),basis=redact(text(input.basis,500)),custodian=redact(text(input.custodian,200)),releaseDate=date(input.releaseDate),f=fence(actor),p=stepUpFence(actor)
    await this.records.person(actor,person)
    if(input.confirm!=='true' && input.confirm!==true) throw new PayrollError('explicit_hold_confirmation_required')
    const event=uuid(),fingerprint=await keyFor(actor.company,person),now=Date.now()
    const result=await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_privacy_holds(company_id,person_id,kind,basis,custodian,release_date,created_by,created_at)
        SELECT ?,?,?,?,?,?,?,? WHERE ${f.sql} AND ${p.sql} AND NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND fingerprint=?) RETURNING person_id`,[actor.company,person,kind,basis,custodian,releaseDate,actor.session.operator.id,now,...f.args,...p.args,actor.company,fingerprint]),
      this.records.statement(`INSERT INTO env_privacy_hold_events(id,company_id,fingerprint,action,kind,basis,custodian,release_date,evidence,actor_id,occurred_at)
        SELECT ?,?,?,'recorded',?,?,?,?,'',?,? WHERE ${f.sql} AND ${p.sql} AND EXISTS(SELECT 1 FROM env_privacy_holds WHERE company_id=? AND person_id=? AND created_at=? AND created_by=?)`,[event,actor.company,fingerprint,kind,basis,custodian,releaseDate,actor.session.operator.id,now,...f.args,...p.args,actor.company,person,now,actor.session.operator.id]),
    ])
    if(!result[0].results.length) throw new PayrollError('privacy_or_authority_changed',409)
    return {personId:person,held:true}
  }
  async erase(actor:Actor,input:Input) {
    this.owner(actor);await requirePayrollProof(this.records.env,actor)
    const person=text(input.personId),fingerprint=await keyFor(actor.company,person),f=fence(actor),p=stepUpFence(actor),id=uuid(),now=Date.now()
    if(input.confirm!=='true' && input.confirm!==true) throw new PayrollError('explicit_erasure_confirmation_required')
    const prior=await this.records.statement(`SELECT id,state FROM env_privacy_requests WHERE company_id=? AND fingerprint=? AND ${f.sql}`,[actor.company,fingerprint,...f.args]).first<{id:string;state:string}>()
    if(prior?.state==='complete') return {...prior,replayed:true}
    const inventory=await this.inventory(actor,person)
    if(inventory.hold || inventory.history.length) {
      const retained={...inventory,reason:inventory.hold?'statutory-or-legal-hold':'payroll-retention-review-required'}
      const saved=await this.records.statement(`INSERT INTO env_privacy_requests(id,company_id,person_id,fingerprint,state,retained,requested_by,requested_at)
        SELECT ?,?,?,?,'held',?,?,? WHERE ${f.sql} AND ${p.sql} ON CONFLICT(company_id,fingerprint) DO NOTHING RETURNING id`,[id,actor.company,person,fingerprint,JSON.stringify(retained),actor.session.operator.id,now,...f.args,...p.args]).all()
      if(!saved.results.length && !prior) throw new PayrollError('privacy_or_authority_changed',409)
      return {id:prior?.id??id,state:'held',retained}
    }
    const requestId=prior?.id??id, service=await createPortability({db:this.records.env.DB,policy}),
      keys=[{table:'env_people',key:{company_id:actor.company,id:person}},...(await this.records.statement('SELECT kind FROM env_private_records WHERE company_id=? AND person_id=?',[actor.company,person]).all<{kind:string}>()).results.map(r=>({table:'env_private_records',key:{company_id:actor.company,person_id:person,kind:r.kind}}))],
      tombstones=(await Promise.all(keys.map(k=>service.erasureStatements(k.table,k.key)))).flat(),checkpoint=await service.redactionStatements(),transfers=await service.invalidateTransfersStatements()
    // A CHECK guard and FK constraints make late references/hold changes roll the
    // entire cascade back. No deletion, anonymization or journal is half-applied.
    await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_privacy_guard(company_id,person_id,request_id,valid) SELECT ?,?,?,CASE WHEN ${f.sql} AND ${p.sql}
        AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=?)
        AND NOT EXISTS(SELECT 1 FROM env_privacy_holds WHERE company_id=? AND person_id=? AND released_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM env_workspace_versions WHERE company_id=? AND person_id=?)
        AND NOT EXISTS(SELECT 1 FROM env_workspace_people WHERE company_id=? AND person_id=?)
        AND NOT EXISTS(SELECT 1 FROM env_rate_proposals WHERE company_id=? AND person_id=?)
        THEN 1 ELSE 0 END`,[actor.company,person,requestId,...f.args,...p.args,actor.company,person,actor.company,person,actor.company,person,actor.company,person,actor.company,person]),
      this.records.statement(`INSERT INTO env_privacy_requests(id,company_id,person_id,fingerprint,state,retained,requested_by,requested_at,completed_at) VALUES(?,?,NULL,?,'complete','[]',?,?,?)
        ON CONFLICT(company_id,fingerprint) DO UPDATE SET person_id=NULL,state='complete',retained='[]',completed_at=excluded.completed_at`,[requestId,actor.company,fingerprint,actor.session.operator.id,now,now]),
      this.records.statement('UPDATE env_audit SET target_id=? WHERE company_id=? AND target_id=?',[fingerprint,actor.company,person]),
      this.records.statement('UPDATE env_agent_access SET target_id=? WHERE company_id=? AND target_id=?',[fingerprint,actor.company,person]),
      this.records.statement("UPDATE env_privacy_hold_events SET basis='',custodian='',evidence='' WHERE company_id=? AND fingerprint=?",[actor.company,fingerprint]),
      ...tombstones,...checkpoint,...transfers,
      this.records.statement('DELETE FROM env_private_records WHERE company_id=? AND person_id=?',[actor.company,person]),
      this.records.statement('DELETE FROM env_privacy_holds WHERE company_id=? AND person_id=? AND released_at IS NOT NULL',[actor.company,person]),
      this.records.statement('DELETE FROM env_people WHERE company_id=? AND id=?',[actor.company,person]),
      this.records.statement('INSERT INTO env_erasure_fences(company_id,person_id,fingerprint,erased_at) VALUES(?,?,?,?)',[actor.company,person,fingerprint,now]),
      auditStatement(this.records.env,actor,uuid(),'privacy.erased',fingerprint,1),
      this.records.statement('DELETE FROM env_privacy_guard WHERE company_id=? AND request_id=?',[actor.company,requestId]),
    ])
    return {id:requestId,state:'complete',completedAt:now,externalRecall:'Downloaded copies and already-filed agency records are outside local recall.'}
  }
  async release(actor:Actor,input:Input) {
    this.owner(actor);await requirePayrollProof(this.records.env,actor)
    const person=text(input.personId),evidence=redact(text(input.evidence,500)),f=fence(actor),p=stepUpFence(actor)
    if(input.confirm!=='true' && input.confirm!==true) throw new PayrollError('explicit_release_confirmation_required')
    const hold=await this.records.statement(`SELECT kind,release_date FROM env_privacy_holds WHERE company_id=? AND person_id=? AND released_at IS NULL AND ${f.sql}`,[actor.company,person,...f.args]).first<{kind:string;release_date:string}>()
    if(!hold) throw new PayrollError('hold_or_authority_changed',409)
    if(hold.kind==='statutory' && hold.release_date>new Date().toISOString().slice(0,10)) throw new PayrollError('statutory_retention_not_elapsed',409)
    const now=Date.now(),fingerprint=await keyFor(actor.company,person)
    const result=await this.records.env.DB.batch([
      this.records.statement(`UPDATE env_privacy_holds SET released_by=?,released_at=?,release_evidence=? WHERE company_id=? AND person_id=? AND released_at IS NULL AND (kind='legal' OR release_date<=strftime('%Y-%m-%d','now')) AND ${f.sql} AND ${p.sql} RETURNING person_id`,[actor.session.operator.id,now,evidence,actor.company,person,...f.args,...p.args]),
      this.records.statement(`INSERT INTO env_privacy_hold_events(id,company_id,fingerprint,action,kind,basis,custodian,release_date,evidence,actor_id,occurred_at)
        SELECT ?,company_id,?,'released',kind,basis,custodian,release_date,release_evidence,released_by,released_at FROM env_privacy_holds WHERE company_id=? AND person_id=? AND released_at=? AND released_by=? AND ${f.sql} AND ${p.sql}`,[uuid(),fingerprint,actor.company,person,now,actor.session.operator.id,...f.args,...p.args]),
    ])
    if(!result[0].results.length) throw new PayrollError('hold_or_authority_changed',409)
    return this.erase(actor,{personId:person,confirm:true})
  }
}
