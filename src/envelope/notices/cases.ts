import type { Actor } from '../access'
import { fence, requireAction, auditStatement } from '../access'
import type { Notices } from '../notices'
import type { Input } from '../records'
import { PayrollError, text, integer, recordKey, seal, unseal } from '../security'
import { redact } from '../providers'
import { requirePayrollProof, stepUpFence } from '../step-up'
import { digest } from '../workspace/store'
import { instant } from '../workspace/rules'
const uuid=()=>crypto.randomUUID()
const cents=(value:unknown)=>value===0 || value==='0' ? 0 : integer(value)
const optional=(v:unknown,max=500)=>v===undefined || v==='' ? '' : redact(text(v,max))
export interface CaseData {
  kind:string;agency:string;period:string;ownerId:string;deadline:string;einMatched:boolean;
  reportedAmountCents:number;remainingLiabilityCents:number|null;claimedAbatementCents:number;actualAbatementCents:number;
  state:'open'|'needs-review'|'resolved';sourceDigest:string;extractionProvenance:string;
  events:{action:string;actorId:string;at:number;note:string;file?:{id:string;version:number;digest:string};reference?:string}[];
}
/** Evidence tracking never turns a sent reply or a model claim into agency closure. */
export class NoticeCases {
  constructor(public notices:Notices) {}
  async read(actor:Actor,id:string) {
    await this.notices.notice(actor,id)
    const records=this.notices.records,f=fence(actor),key=await recordKey(records.env.ENVELOPE_RECORD_KEY),
      rows=(await records.statement(`SELECT version,cipher,digest,created_by AS createdBy,created_at AS createdAt FROM env_notice_case_versions WHERE company_id=? AND notice_id=? AND ${f.sql} ORDER BY version DESC`,[actor.company,id,...f.args]).all<{version:number;cipher:string;digest:string;createdBy:string;createdAt:number}>()).results,
      history=await Promise.all(rows.map(async r=>({...r,cipher:undefined,data:JSON.parse(await unseal(key,JSON.stringify([actor.company,'notice-case',id,r.version]),r.cipher)) as CaseData})))
    const latest=history[0]
    return {latest,history,overdue:latest ? latest.data.state!=='resolved' && Date.parse(latest.data.deadline)<Date.now() : false,
      deadlineBreached:latest ? Date.parse(latest.data.deadline)<(latest.data.events.find(e=>e.action==='agency-close')?.at??Date.now()) : false}
  }
  async save(actor:Actor,id:string,input:Input) {
    const notice=await this.notices.notice(actor,id,'notices:write'),records=this.notices.records,now=Date.now(),
      version=input.version===0 || input.version==='0' ? 0 : integer(input.version),action=text(input.action),prior=(await this.read(actor,id)).latest
    if((prior?.version??0)!==version) throw new PayrollError('notice_case_changed',409)
    let data:CaseData
    let sensitive=false
    if(!prior) {
      if(action!=='intake' || typeof input.kind!=='string' || !['sui-rate','irs-deposit','irs-lock-in','other'].includes(input.kind)) throw new PayrollError('invalid_notice_case')
      const ownerId=text(input.ownerId),f=fence(actor),
        owner=await records.statement(`SELECT 1 FROM env_grants g JOIN oa_operators o ON o.id=g.operator_id WHERE g.company_id=? AND g.operator_id=? AND g.revoked_at IS NULL AND o.status='active'
        AND (g.role='owner' OR (EXISTS(SELECT 1 FROM json_each(g.actions) WHERE value='notices:write') AND EXISTS(SELECT 1 FROM json_each(g.fields) WHERE value='tax') AND EXISTS(SELECT 1 FROM json_each(g.locations) WHERE value='*' OR value=?))) AND ${f.sql}`,[actor.company,ownerId,notice.locationId,...f.args]).first()
      if(!owner) throw new PayrollError('current_notice_owner_required',403)
      const row=await records.statement('SELECT ein_cipher FROM env_companies WHERE id=?',[actor.company]).first<{ein_cipher:string}>(),
        ein=await unseal(await recordKey(records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'ein']),row!.ein_cipher),matched=text(input.ein,10)===ein
      data={kind:String(input.kind),agency:redact(text(input.agency,160)),period:redact(text(input.period,120)),ownerId,deadline:instant(input.deadline),einMatched:matched,
        reportedAmountCents:cents(input.reportedAmountCents),remainingLiabilityCents:null,claimedAbatementCents:0,actualAbatementCents:0,
        state:matched?'open':'needs-review',sourceDigest:notice.digest,extractionProvenance:'Human transcription of immutable notice '+notice.digest,
        events:[{action:'intake',actorId:actor.session.operator.id,at:now,note:matched?'Company EIN matched. Amount remains reported, not a reconciled liability.':'Wrong EIN — identity review required; no payroll or liability change.'}]}
    } else {
      data=structuredClone(prior.data)
      const allowed=['deposit-proof','ocr-correction','claimed-abatement','agency-close','agency-reopen','rate-applied','correspondence']
      if(!allowed.includes(action)) throw new PayrollError('invalid_notice_case_action')
      if(data.state==='resolved' && action!=='agency-reopen') throw new PayrollError('resolved_case_requires_agency_reopening',409)
      const fileId=text(input.fileId),fileVersion=integer(input.fileVersion),f=fence(actor),
        file=await records.statement(`SELECT id,version,digest FROM env_private_files WHERE company_id=? AND notice_id=? AND id=? AND version=? AND ${f.sql}`,[actor.company,id,fileId,fileVersion,...f.args]).first<{id:string;version:number;digest:string}>()
      if(!file) throw new PayrollError('notice_source_file_required',409)
      const note=redact(text(input.note,1000)),event:{action:string;actorId:string;at:number;note:string;file:typeof file;reference?:string}={action,actorId:actor.session.operator.id,at:now,note,file}
      if(action==='ocr-correction') {
        const row=await records.statement('SELECT ein_cipher FROM env_companies WHERE id=?',[actor.company]).first<{ein_cipher:string}>(),ein=await unseal(await recordKey(records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'ein']),row!.ein_cipher)
        if(text(input.ein,10)!==ein) throw new PayrollError('notice_ein_mismatch',409)
        data.einMatched=true;data.state='open';data.reportedAmountCents=cents(input.reportedAmountCents)
      } else if(action==='claimed-abatement') data.claimedAbatementCents=cents(input.claimedAbatementCents)
      else if(action==='agency-close') {
        sensitive=true
        if(!data.einMatched || (input.confirm!==true && input.confirm!=='true')) throw new PayrollError('verified_agency_disposition_required',409)
        data.remainingLiabilityCents=cents(input.remainingLiabilityCents);data.actualAbatementCents=cents(input.actualAbatementCents)
        if(data.actualAbatementCents>data.claimedAbatementCents) throw new PayrollError('actual_abatement_exceeds_claim',409)
        data.state='resolved'
      } else if(action==='agency-reopen') {data.state='open';data.remainingLiabilityCents=null}
      else if(action==='rate-applied') {
        sensitive=true
        if(data.kind!=='sui-rate' || !data.einMatched) throw new PayrollError('matched_sui_notice_required',409)
        const reference=text(input.reference),row=await records.statement(`SELECT v.cipher,v.version FROM env_workspace_versions v JOIN env_workspace_decisions d ON d.company_id=v.company_id AND d.kind=v.kind AND d.object_id=v.object_id AND d.version=v.version AND d.decision='approved'
          WHERE v.company_id=? AND v.kind='rule' AND v.object_id=? AND v.version=(SELECT MAX(version) FROM env_workspace_versions WHERE company_id=v.company_id AND kind=v.kind AND object_id=v.object_id)
          AND NOT EXISTS(SELECT 1 FROM env_workspace_decisions x WHERE x.company_id=v.company_id AND x.kind=v.kind AND x.object_id=v.object_id AND x.version=v.version AND x.decision='withdrawn') AND ${f.sql}`,[actor.company,reference,...f.args]).first<{cipher:string;version:number}>()
        if(!row) throw new PayrollError('reviewed_rate_source_required',409)
        const rule=JSON.parse(await unseal(await recordKey(records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'rule',reference,row.version]),row.cipher))
        if(rule.family!=='sui' || rule.sourceRef!==`notice:${id}:${notice.digest}`) throw new PayrollError('reviewed_rate_source_required',409)
        event.reference=reference+'@'+row.version
      } else if(action==='correspondence') {
        const reference=text(input.reference),receipt=await records.statement(`SELECT provider_receipt FROM env_notice_dispatches d JOIN env_notice_replies r ON r.company_id=d.company_id AND r.id=d.reply_id AND r.version=d.version WHERE d.company_id=? AND r.notice_id=? AND d.id=? AND d.state='accepted' AND ${f.sql}`,[actor.company,id,reference,...f.args]).first()
        if(!receipt) throw new PayrollError('accepted_correspondence_receipt_required',409)
        event.reference=reference
      }
      data.events.push(event)
    }
    if(sensitive) {requireAction(actor,'notices:approve',notice.locationId,'tax');await requirePayrollProof(records.env,actor)}
    const cipher=await seal(await recordKey(records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'notice-case',id,version+1]),JSON.stringify(data)),hash=await digest(JSON.stringify(data)),f=fence(actor),p=sensitive?stepUpFence(actor):{sql:'1',args:[]},change=uuid()
    const result=await records.env.DB.batch([
      records.statement(`INSERT INTO env_notice_case_versions(company_id,notice_id,version,cipher,digest,created_by,created_at,change_id)
        SELECT ?,?,?,?,?,?,?,? WHERE ${f.sql} AND ${p.sql} AND COALESCE((SELECT MAX(version) FROM env_notice_case_versions WHERE company_id=? AND notice_id=?),0)=? RETURNING version`,[actor.company,id,version+1,cipher,hash,actor.session.operator.id,now,change,...f.args,...p.args,actor.company,id,version]),
      auditStatement(records.env,actor,change,'notice.case.'+action,id,version+1,'EXISTS(SELECT 1 FROM env_notice_case_versions WHERE change_id=?)',[change]),
    ])
    if(!result[0].results.length) throw new PayrollError('notice_case_or_authority_changed',409)
    return {version:version+1,state:data.state,digest:hash}
  }
}
