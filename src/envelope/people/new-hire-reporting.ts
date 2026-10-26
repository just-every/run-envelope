import type { Actor } from '../access'
import { fence } from '../access'
import { date, text, integer, PayrollError, recordKey, unseal } from '../security'
import type { Input } from '../records'
import { WorkspaceStore, digest, revision, choice, currentSources, type Revision } from '../workspace/store'
import source from './new-hire-directories.json'

export const directories = source.directories
export function coverage() {
  return { source: source.source, sourceSha256: source.sha256, total: directories.length,
    passing: directories.filter(d => d.implemented).length,
    uncovered: directories.filter(d => !d.implemented).map(d => d.name),
    directories: directories.map(d => ({ code:d.code, name:d.name, updated:d.updated, schema:d.implemented ? 'Ohio portal employee fields' : 'unmapped', sourceText:d.sourceText })) }
}
export interface HireReport {
  eventType: string; hireDate: string; state: string; dueOn: string; repairOwner: string
  fields: Record<string,string>; electionId: string; electionVersion: number
  status: 'draft' | 'transferred' | 'accepted' | 'rejected'
  history: { receiptId:string; response:string; reportingDate:string; recordedBy:string; recordedAt:number }[]
}
const fieldNames = ['employeeFirstName','employeeMiddleName','employeeLastName','employeeAddress','employeeSsn','employeeDateOfBirth','employerName','employerAddress','employerFein'] as const
export class NewHireReporting {
  constructor(public store: WorkspaceStore) {}
  owner(actor: Actor) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner' || actor.grant.role !== 'owner'
      || actor.session.operator.email.toLowerCase() !== this.store.records.env.OWNER_EMAIL.toLowerCase()) throw new PayrollError('owner_required',403)
  }
  async reports(actor:Actor, person:string) {
    this.owner(actor)
    const rows=await this.store.list<HireReport>(actor,'new-hire-report',person)
    return rows.map(r=>({...r,overdue:r.data.status!=='accepted' && r.data.dueOn < new Date().toISOString().slice(0,10)}))
  }
  async elections(actor:Actor) { this.owner(actor); return this.store.list<Input>(actor,'new-hire-election') }
  async election(actor:Actor,input:Input) {
    this.owner(actor)
    const state=choice(input.state,directories.map(d=>d.code))
    if(state!=='OH') throw new PayrollError('directory_schema_unmapped',409)
    const effectiveFrom=date(input.effectiveFrom), confirmation=text(input.confirmation,500)
    // A retained federal registration confirmation is evidence, never generated here.
    return this.store.append(actor,'new-hire-election','multistate',revision(input.version),{state,effectiveFrom,confirmation,recordedBy:actor.session.operator.id})
  }
  async save(actor:Actor,person:string,input:Input,repairId?:string) {
    this.owner(actor)
    const eventType=choice(input.eventType,['hire','rehire']), hireDate=date(input.hireDate), state=choice(input.state,directories.map(d=>d.code))
    if(state!=='OH') throw new PayrollError('directory_schema_unmapped',409)
    const fields:Record<string,string>={}
    for(const field of fieldNames) fields[field]=field==='employeeMiddleName' && !input[field] ? '' : text(input[field],field.endsWith('Address')?500:120)
    date(fields.employeeDateOfBirth)
    if(!/^\d{9}$/.test(fields.employeeSsn) || !/^\d{9}$/.test(fields.employerFein)) throw new PayrollError('invalid_report_identifier')
    const company=await this.store.records.statement('SELECT ein_cipher FROM env_companies WHERE id=?',[actor.company]).first<{ein_cipher:string}>()
    const ein=await unseal(await recordKey(this.store.records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'ein']),company!.ein_cipher)
    if(fields.employerFein!==ein.replaceAll('-','')) throw new PayrollError('report_employer_mismatch',409)
    const repairOwner=actor.session.operator.id
    const id='nh-'+(await digest(JSON.stringify([person,hireDate]))).slice(0,40)
    const rows=await this.reports(actor,person),prior=rows.find(r=>r.id===id)
    const electionId=input.electionId ? text(input.electionId) : ''
    const election=electionId ? (await this.elections(actor)).find(e=>e.id===electionId) : undefined
    if(electionId && (!election?.approvedBy || election.withdrawnBy || election.data.state!==state || String(election.data.effectiveFrom)>hireDate)) throw new PayrollError('election_not_current',409)
    const dueOn=new Date(Date.parse(hireDate+'T00:00:00Z')+20*86400000).toISOString().slice(0,10)
    const data:HireReport={eventType,hireDate,state,dueOn,repairOwner,fields,electionId,electionVersion:election?.version ?? 0,status:'draft',history:prior?.data.history ?? []}
    if(prior && !repairId) {
      if(JSON.stringify({...prior.data,status:'draft',history:[]})===JSON.stringify({...data,history:[]})) return {id,version:prior.version,replayed:true}
      throw new PayrollError('hire_already_recorded',409)
    }
    if(repairId && (repairId!==id || prior?.data.status!=='rejected' || integer(input.version)!==prior.version)) throw new PayrollError('repair_requires_rejected_current_report',409)
    return this.store.append(actor,'new-hire-report',id,prior?.version ?? 0,data,person,false,{objects:election?[{kind:'new-hire-election',id:election.id,version:election.version,approved:true}]:[]})
  }
  async review(actor:Actor,person:string,id:string) { this.owner(actor);return this.store.review<HireReport>(actor,'new-hire-report',id,person) }
  async approve(actor:Actor,person:string,id:string,input:Input) {
    this.owner(actor)
    const row=await this.store.find<HireReport>(actor,'new-hire-report',id,person)
    if(row.data.status!=='draft') throw new PayrollError('review_stale',409)
    const result=await this.store.decide(actor,'new-hire-report',id,input,person)
    const f=fence(actor)
    await this.store.records.statement(`INSERT INTO env_new_hire_authority(company_id,person_id,report_id,version,session_id) SELECT ?,?,?,?,? WHERE ${f.sql}`,[actor.company,person,id,row.version,actor.session.id,...f.args]).run()
    return result
  }
  async transfer(actor:Actor,person:string,id:string,input:Input) {
    this.owner(actor)
    const row=await this.store.find<HireReport>(actor,'new-hire-report',id,person)
    if(row.data.status!=='draft' || !row.approvedBy || row.withdrawnBy || !row.sourcesCurrent || row.version!==integer(input.version)) throw new PayrollError('review_stale',409)
    const f=fence(actor)
    const active=await this.store.records.statement(`SELECT 1 FROM env_new_hire_authority a WHERE company_id=? AND person_id=? AND report_id=? AND version=? AND session_id=? AND ${f.sql}
      AND NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND person_id=? AND status='held')
      AND EXISTS(SELECT 1 FROM env_workspace_versions v WHERE v.company_id=a.company_id AND v.kind='new-hire-report' AND v.object_id=a.report_id AND v.version=a.version AND ${currentSources('v')})`,[actor.company,person,id,row.version,actor.session.id,...f.args,actor.company,person]).first()
    if(!active) throw new PayrollError('fresh_report_authority_required',409)
    await this.store.append(actor,'new-hire-report',id,row.version,{...row.data,status:'transferred'},person,false,{objects:[{kind:'new-hire-report',id,version:row.version,approved:true}]})
    return {directoryUrl:'https://oh-newhire.com',schema:'Ohio portal employee fields; OCSS updated 2026-04-08',fields:{...row.data.fields,hireDate:row.data.hireDate,stateOfHire:row.data.state},status:'portal-transfer-prepared',submissionClaimed:false}
  }
  async response(actor:Actor,person:string,id:string,input:Input) {
    this.owner(actor)
    const row=await this.store.find<HireReport>(actor,'new-hire-report',id,person)
    const receiptId=text(input.receiptId), response=choice(input.response,['accepted','rejected']),reportingDate=date(input.reportingDate)
    const replay=row.data.history.find(h=>h.receiptId===receiptId)
    if(replay) {
      if(replay.response!==response || replay.reportingDate!==reportingDate) throw new PayrollError('conflicting_directory_receipt',409)
      return {id,version:row.version,replayed:true}
    }
    if(row.data.status!=='transferred' || row.version!==integer(input.version) || reportingDate<row.data.hireDate || reportingDate>new Date().toISOString().slice(0,10)) throw new PayrollError('invalid_directory_response',409)
    const agencyResponse=text(input.agencyResponse,1000)
    return this.store.append(actor,'new-hire-report',id,row.version,{...row.data,status:response,history:[...row.data.history,{receiptId,response,reportingDate,agencyResponse,recordedBy:actor.session.operator.id,recordedAt:Date.now()}]},person)
  }
}
