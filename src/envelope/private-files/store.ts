import type { Actor } from '../access'
import { requireAction, fence, auditStatement } from '../access'
import type { Input } from '../records'
import type { Notices } from '../notices'
import { PayrollError, text, integer, recordKey, seal, unseal } from '../security'

interface StoredFile { id:string;version:number;name:string;type:string;bytes:number;digest:string;createdBy:string;createdAt:number }
const limit=32768
const types=['application/pdf','text/html','text/plain']
const uuid=()=>crypto.randomUUID()
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),v=>v.toString(16).padStart(2,'0')).join('')
/** Immutable originals, never a public asset, inline HTML or a PDF preview. */
export class PrivateFiles {
  constructor(public notices:Notices) {}
  async list(actor:Actor,noticeId:string) {
    await this.notices.notice(actor,noticeId)
    const f=fence(actor)
    return (await this.notices.records.statement(`SELECT id,version,name,type,bytes,digest,created_by AS createdBy,created_at AS createdAt FROM env_private_files WHERE company_id=? AND notice_id=? AND ${f.sql} ORDER BY created_at,id,version`,[actor.company,noticeId,...f.args]).all<StoredFile>()).results
  }
  async save(actor:Actor,noticeId:string,input:Input) {
    await this.notices.notice(actor,noticeId,'notices:write')
    if(Object.keys(input).some(k=>!['file','id','version'].includes(k))) throw new PayrollError('invalid_file_input')
    const file=input.file
    if(!(file instanceof File) || !types.includes(file.type)) throw new PayrollError('unsupported_file_type',415)
    if(!file.size || file.size>limit) throw new PayrollError('file_too_large',413)
    const name=text(file.name,160)
    if(/[\\/]/.test(name)) throw new PayrollError('invalid_file_name')
    const bytes=new Uint8Array(await file.arrayBuffer())
    if(file.type==='application/pdf' && new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new PayrollError('invalid_pdf')
    if(file.type!=='application/pdf') {
      try { new TextDecoder('utf-8',{fatal:true}).decode(bytes) }
      catch { throw new PayrollError('invalid_utf8') }
    }
    const id=input.id ? text(input.id) : uuid(), version=input.version===0 || input.version==='0' ? 0 : integer(input.version),
      digest=await hash(bytes), f=fence(actor), event=uuid(), now=Date.now(),
      cipher=await seal(await recordKey(this.notices.records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'file',id,version+1]),btoa(String.fromCharCode(...bytes)))
    const result=await this.notices.records.env.DB.batch<Record<string,unknown>>([
      this.notices.records.statement(`INSERT INTO env_private_files(company_id,notice_id,id,version,name,type,bytes,digest,cipher,created_by,created_at,change_id)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${f.sql}
        AND COALESCE((SELECT MAX(version) FROM env_private_files WHERE company_id=? AND id=?),0)=?
        AND NOT EXISTS(SELECT 1 FROM env_private_files WHERE company_id=? AND id=? AND notice_id!=?) RETURNING id`,
        [actor.company,noticeId,id,version+1,name,file.type,bytes.length,digest,cipher,actor.session.operator.id,now,event,...f.args,actor.company,id,version,actor.company,id,noticeId]),
      auditStatement(this.notices.records.env,actor,event,'notice.file.stored',id,version+1,'EXISTS(SELECT 1 FROM env_private_files WHERE change_id=?)',[event]),
    ])
    if(!result[0].results.length) throw new PayrollError('file_or_authority_changed',409)
    return {id,version:version+1,digest,bytes:bytes.length}
  }
  async download(actor:Actor,noticeId:string,id:string,versionValue:string) {
    const notice=await this.notices.notice(actor,noticeId)
    requireAction(actor,'private:read',notice.locationId,'tax')
    const version=integer(versionValue), f=fence(actor), event=uuid(), records=this.notices.records
    const result=await records.env.DB.batch<Record<string,unknown>>([
      auditStatement(records.env,actor,event,'notice.file.read',id,version,'EXISTS(SELECT 1 FROM env_private_files WHERE company_id=? AND notice_id=? AND id=? AND version=?)',[actor.company,noticeId,id,version]),
      records.statement(`SELECT name,type,digest,cipher FROM env_private_files WHERE company_id=? AND notice_id=? AND id=? AND version=? AND ${f.sql} AND EXISTS(SELECT 1 FROM env_audit WHERE id=?)`,[actor.company,noticeId,id,version,...f.args,event]),
    ])
    const row=result[1].results[0]
    if(!row) throw new PayrollError('file_unavailable',404)
    const encoded=await unseal(await recordKey(records.env.ENVELOPE_RECORD_KEY),JSON.stringify([actor.company,'file',id,version]),String(row.cipher)), bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))
    if(await hash(bytes)!==row.digest) throw new PayrollError('file_integrity_failed',503)
    return {name:String(row.name),type:String(row.type),bytes}
  }
}
export function privateDownload(file:{name:string;type:string;bytes:Uint8Array}) {
  return new Response(new Uint8Array(file.bytes), {headers:{
    'content-type':'application/octet-stream','content-disposition':`attachment; filename="notice-original"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,
    'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    'content-security-policy':"sandbox; default-src 'none'; frame-ancestors 'none'",'x-robots-tag':'noindex, nofollow',
  }})
}
