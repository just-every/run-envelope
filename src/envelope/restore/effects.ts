import type { Actor } from '../access'
import { fence, auditStatement } from '../access'
import type { Records,Input } from '../records'
import { PayrollError,text,recordKey,unseal } from '../security'
import { requirePayrollProof,stepUpFence } from '../step-up'
import { Providers,providerSecret,type Provider } from '../providers'
import type { ReplyData } from '../notices'
import { digest } from '../workspace/store'
interface Dispatch {id:string;replyId:string;version:number;digest:string;state:string;providerReceipt:string|null;checkedAt:number|null;observedEvent:string|null}
export class RestoredEffects {
  constructor(public records:Records) {}
  async owner(actor:Actor) {
    if(actor.grant.role!=='owner') throw new PayrollError('owner_required',403)
    const f=fence(actor),row=await this.records.statement(`SELECT 1 FROM env_companies WHERE id=? AND restored=1 AND ${f.sql}`,[actor.company,...f.args]).first()
    if(!row) throw new PayrollError('inactive_restored_custody_required',409)
  }
  async list(actor:Actor) {
    await this.owner(actor)
    const f=fence(actor)
    const provider=await this.records.statement(`SELECT * FROM env_external_providers WHERE company_id=? AND id='resend' AND ${f.sql}`,[actor.company,...f.args]).first<Provider>()
    const effects=(await this.records.statement(`SELECT d.id,d.reply_id AS replyId,d.version,d.digest,d.state,d.provider_receipt AS providerReceipt,
      p.checked_at AS checkedAt,p.observed_event AS observedEvent FROM env_notice_dispatches d
      LEFT JOIN env_restore_receipts p ON p.company_id=d.company_id AND p.dispatch_id=d.id AND p.provider_change_id=?
      WHERE d.company_id=? AND ${f.sql} ORDER BY d.created_at,d.id`,[provider?.change_id??'',actor.company,...f.args]).all<Dispatch>()).results
    return {provider:provider?{version:provider.version,enabled:provider.enabled,sender:provider.sender,reconcileConsent:provider.reconcile_consent}:null,effects}
  }
  async connect(actor:Actor,input:Input) {
    await this.owner(actor)
    if(input.id!=='resend' || (['true',true].includes(input.enabled as string|boolean) && input.reconcileConsent!==true && input.reconcileConsent!=='true')) throw new PayrollError('explicit_restore_lookup_consent_required')
    return new Providers(this.records).save(actor,input)
  }
  async reconcile(actor:Actor,input:Input) {
    await this.owner(actor);await requirePayrollProof(this.records.env,actor)
    if(Object.keys(input).some(k=>k!=='dispatchId')) throw new PayrollError('invalid_reconciliation_input')
    const id=text(input.dispatchId),f=fence(actor),proof=stepUpFence(actor),
      row=await this.records.statement(`SELECT d.*,r.cipher FROM env_notice_dispatches d JOIN env_notice_replies r ON r.company_id=d.company_id AND r.id=d.reply_id AND r.version=d.version
      WHERE d.company_id=? AND d.id=? AND ${f.sql}`,[actor.company,id,...f.args]).first<{state:string;provider_receipt:string|null;reply_id:string;version:number;digest:string;cipher:string}>()
    if(!row) throw new PayrollError('dispatch_unavailable',404)
    if(row.state!=='accepted' || !row.provider_receipt) throw new PayrollError('unknown_original_id_requires_provider_investigation',409)
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.provider_receipt)) throw new PayrollError('invalid_original_provider_reference',409)
    const provider=await this.records.statement(`SELECT * FROM env_external_providers WHERE company_id=? AND id='resend' AND enabled=1 AND reconcile_consent=1 AND ${f.sql}`,[actor.company,...f.args]).first<Provider>()
    if(!provider) throw new PayrollError('fresh_provider_lookup_consent_required',409)
    const original:ReplyData=JSON.parse(await unseal(await recordKey(this.records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'reply',row.reply_id,row.version]),row.cipher)),secret=await providerSecret(this.records.env,actor.company,provider)
    let observed:{id:string;from:string;to:string[];subject:string;text:string;last_event:string}
    try {
      const response=await fetch('https://api.resend.com/emails/'+encodeURIComponent(row.provider_receipt),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{authorization:'Bearer '+secret,accept:'application/json'}})
      if(!response.ok || !response.body) throw 0
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
      try {for(;;) {const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>64000) throw 0;chunks.push(value)}}
      finally {await reader.cancel().catch(()=>{})}
      const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks) {bytes.set(chunk,at);at+=chunk.length}
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
      if(value.object!=='email' || value.id!==row.provider_receipt || value.from!==original.sender || !Array.isArray(value.to) || value.to.length!==1 || value.to[0]!==original.to || value.subject!==original.subject || value.text!==original.body || !['sent','delivered','delivery_delayed','bounced','complained','failed','opened','clicked'].includes(value.last_event)) throw 0
      observed={id:value.id,from:value.from,to:value.to,subject:value.subject,text:value.text,last_event:value.last_event}
    } catch {throw new PayrollError('original_provider_record_unverified',409)}
    const event=crypto.randomUUID(),now=Date.now(),responseDigest=await digest(JSON.stringify(observed)),finalFence=fence(actor)
    const result=await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_restore_receipts(company_id,dispatch_id,provider_change_id,provider_version,original_receipt,payload_digest,observed_event,response_digest,checked_by,checked_at)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${finalFence.sql} AND ${proof.sql}
        AND EXISTS(SELECT 1 FROM env_companies WHERE id=? AND restored=1)
        AND EXISTS(SELECT 1 FROM env_external_providers WHERE company_id=? AND id='resend' AND enabled=1 AND reconcile_consent=1 AND change_id=? AND version=?)
        AND EXISTS(SELECT 1 FROM env_notice_dispatches WHERE company_id=? AND id=? AND state='accepted' AND provider_receipt=? AND digest=?)
        ON CONFLICT(company_id,dispatch_id,provider_change_id) DO NOTHING RETURNING dispatch_id`,[actor.company,id,provider.change_id,provider.version,row.provider_receipt,row.digest,observed.last_event,responseDigest,actor.session.operator.id,now,...finalFence.args,...proof.args,actor.company,actor.company,provider.change_id,provider.version,actor.company,id,row.provider_receipt,row.digest]),
      auditStatement(this.records.env,actor,event,'archive.original.notice.checked',id,row.version,'EXISTS(SELECT 1 FROM env_restore_receipts WHERE company_id=? AND dispatch_id=? AND provider_change_id=? AND checked_at=?)',[actor.company,id,provider.change_id,now]),
    ])
    if(!result[0].results.length) throw new PayrollError('original_record_already_checked_or_authority_changed',409)
    return {dispatchId:id,originalReceipt:row.provider_receipt,observedEvent:observed.last_event,outbound:'paused',newDispatch:false}
  }
}
