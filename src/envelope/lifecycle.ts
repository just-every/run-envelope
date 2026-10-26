import type { Records, Input } from './records'
import seed from '../../seed.json'
import { fence, auditStatement, type Actor } from './access'
import { requirePayrollProof, stepUpFence } from './step-up'
import { PayrollError, recordKey, seal, unseal } from './security'

export function webhookDestination(env: Records['env']) {
    const configured = env.ENVELOPE_WEBHOOK_URL
    if (!configured) throw new PayrollError('webhook_destination_unavailable', 503)
    let url: URL
    try { url = new URL(configured) } catch { throw new PayrollError('invalid_webhook_destination', 503) }
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(env.AUTH_LOCAL === 'true' && url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname))))
      throw new PayrollError('invalid_webhook_destination', 503)
    return url.href
  }

// Explicit owner sends only: no scheduler, provider receipt or payroll authority.
export class Lifecycle {
  constructor(public records: Records) {}
  owner(actor: Actor) {
    if (actor.grant.role !== 'owner' || actor.session.kind !== 'native' ||
        actor.session.operator.email.toLowerCase() !== this.records.env.OWNER_EMAIL.toLowerCase())
      throw new PayrollError('native_owner_required', 403)
  }
  destination() { return webhookDestination(this.records.env) }
  async health(actor: Actor) {
    this.owner(actor)
    const checkedAt = Date.now()
    const probe = async <T>(read: () => Promise<T>) => {
      const started = Date.now()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const value = await Promise.race([read(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('probe_timeout')), 2000)
        })])
        return {state:'reachable' as const, durationMs:Date.now()-started, value}
      } catch {
        // Never return database diagnostics, credentials or private record values.
        return {state:'unavailable' as const, durationMs:Date.now()-started, value:null}
      } finally { clearTimeout(timer) }
    }
    const f = fence(actor)
    const [database, storage, queue, providerConfiguration] = await Promise.all([
      probe(() => this.records.statement('SELECT 1 AS reachable').first()),
      probe(() => this.records.statement(`SELECT COUNT(*) AS records FROM env_private_records WHERE company_id=? AND ${f.sql}`,
        [actor.company,...f.args]).first()),
      probe(() => this.records.statement(`SELECT COUNT(*) AS obligations,
        COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS pending,
        COALESCE(SUM(CASE WHEN status='sending' THEN 1 ELSE 0 END),0) AS sending,
        COALESCE(SUM(CASE WHEN status='unknown' THEN 1 ELSE 0 END),0) AS unknown,
        COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),0) AS failed,
        COALESCE(SUM(CASE WHEN status='sending' AND started_at<? THEN 1 ELSE 0 END),0) AS expiredLeases
        FROM env_webhook_jobs WHERE company_id=? AND ${f.sql}`,
        [checkedAt-30000,actor.company,...f.args]).first<Record<string,number>>()),
      probe(() => this.records.statement(`SELECT id,enabled FROM env_external_providers WHERE company_id=? AND ${f.sql}`,
        [actor.company,...f.args]).all<{id:string;enabled:number}>()),
    ])
    // Probe completion never revives a revoked owner session or company grant.
    const current = fence(actor)
    if (!await this.records.statement(`SELECT 1 WHERE ${current.sql}`,current.args).first())
      throw new PayrollError('payroll_access_denied',403)
    let custody = 'unavailable'
    try { await recordKey(this.records.env.ENVELOPE_RECORD_KEY); custody = 'key format valid; stored ciphertext not validated' } catch { /* fail closed */ }
    let receiver = 'unavailable'
    try { this.destination(); receiver = 'configured; delivery not verified' } catch { /* no health success inferred */ }
    const providers = seed.externals.map(provider => {
      let state = provider.availability === 'unavailable' ? 'unavailable' : 'not probed'
      if (provider.id === 'cloudflare') state = 'local bindings probed; provider control plane not probed'
      if (provider.id === 'proposal-webhooks') state = receiver
      if (provider.id === 'identity-provider') state = this.records.env.IDENTITY_PROVIDER ? 'configured; not probed' : 'unavailable'
      if (provider.id === 'openai' || provider.id === 'resend') state = providerConfiguration.value?.results.some(row => row.id === provider.id && row.enabled === 1)
        ? 'configured; not probed' : providerConfiguration.state === 'unavailable' ? 'configuration unavailable' : 'unavailable'
      return {id:provider.id,state,delivery:'not established'}
    })
    return {checkedAt,database:database.state,scope:'native proposal webhook jobs only',jobs:queue.value,
      checks:{database:{state:database.state,durationMs:database.durationMs},
        storage:{state:storage.state,durationMs:storage.durationMs,backend:'D1 encrypted private records',content:'not validated'},
        queue:{state:queue.state,durationMs:queue.durationMs,backend:'D1 proposal outbox'},
        providerConfiguration:{state:providerConfiguration.state,durationMs:providerConfiguration.durationMs}},
      dependencies:{receiver,recordCustody:custody,storage:storage.state,queue:queue.state,
        scheduler:'unavailable; explicit owner sends only',payment:'unavailable',filing:'unavailable',
        nativeMail:!this.records.env.MAIL_PROVIDER ? 'unavailable' : this.records.env.MAIL_PROVIDER === 'development'
          ? 'local development; no provider delivery' : 'configured; not probed'},providers,
      // Unimplemented required dependencies always need attention, even with no jobs.
      status:'attention-required',providerDelivery:'not established',automaticRetry:false,
      nextAction:queue.state === 'unavailable' || storage.state === 'unavailable'
        ? 'restore dependency access; inspect retained obligations before any explicit send'
        : custody === 'unavailable' ? 'restore separately held record key; inspect retained jobs before any send'
        : receiver === 'unavailable' ? 'configure administrator-pinned receiver; obtain explicit owner consent before sending'
        : 'inspect jobs and receiver; explicitly retry permitted events; payment and filing remain unavailable'}
  }

  async subscribe(actor: Actor, input: Input) {
    this.owner(actor)
    if (Object.keys(input).some(k => k !== 'consent') || input.consent !== true)
      throw new PayrollError('explicit_webhook_consent_required')
    await requirePayrollProof(this.records.env, actor)
    const destination = this.destination(), id = crypto.randomUUID(), f = fence(actor), p = stepUpFence(actor)
    const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    const cipher = await seal(await recordKey(this.records.env.ENVELOPE_RECORD_KEY), 'webhook:' + id, secret)
    const result = await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_webhooks(id,company_id,owner_id,owner_version,grant_version,destination,created_at)
        SELECT ?,?,?,?,?,?,? WHERE ${f.sql} AND ${p.sql} RETURNING id`,
        [id,actor.company,actor.session.operator.id,actor.session.operator.version,actor.grant.version,destination,Date.now(),...f.args,...p.args]),
      this.records.statement('INSERT INTO env_webhook_keys(id,secret_cipher) SELECT ?,? WHERE EXISTS(SELECT 1 FROM env_webhooks WHERE id=?)',[id,cipher,id]),
      auditStatement(this.records.env,actor,id,'webhook.consented',id,1,'EXISTS(SELECT 1 FROM env_webhooks WHERE id=?)',[id]),
    ])
    if (!result[0].results.length) throw new PayrollError('authority_or_proof_changed',409)
    return {id,secret,destination,eventTypes:['run.proposal.created'],payment:'unavailable',filing:'unavailable'}
  }
  async read(actor: Actor) {
    this.owner(actor)
    const f = fence(actor)
    const [subscriptions,jobs,attempts] = await this.records.env.DB.batch([
      this.records.statement(`SELECT id,destination,active,created_at AS createdAt FROM env_webhooks WHERE company_id=? AND ${f.sql} ORDER BY id LIMIT 100`,[actor.company,...f.args]),
      this.records.statement(`SELECT id,webhook_id AS webhookId,event_id AS eventId,status,attempt,started_at AS startedAt,finished_at AS finishedAt,
        CASE WHEN status='sending' THEN started_at+30000 ELSE NULL END AS leaseExpiresAt,
        NULL AS deadline,
        CASE WHEN status='delivered' THEN 'none' WHEN status='sending' THEN 'wait; recover after lease expires' WHEN attempt>=5 THEN 'retry limit reached; owner investigation required' WHEN status='unknown' THEN 'inspect receiver; explicitly replay same event' ELSE 'explicit owner delivery' END AS nextAction
        FROM env_webhook_jobs WHERE company_id=? AND ${f.sql} ORDER BY id LIMIT 100`,[actor.company,...f.args]),
      this.records.statement(`SELECT a.job_id AS jobId,a.attempt,a.started_at AS startedAt,a.finished_at AS finishedAt,a.outcome,a.http_status AS httpStatus FROM env_webhook_attempts a JOIN env_webhook_jobs j ON j.id=a.job_id WHERE j.company_id=? AND ${f.sql} ORDER BY a.started_at DESC,a.id LIMIT 200`,[actor.company,...f.args]),
    ])
    return {subscriptions:subscriptions.results,jobs:jobs.results,attempts:attempts.results,payment:'unavailable',filing:'unavailable',automaticRetry:false,deadlinePolicy:'reference events have no payroll deadline; lease expiry only permits explicit unknown-state recovery'}
  }
  async revoke(actor: Actor, id: string) {
    this.owner(actor)
    const f = fence(actor), event = crypto.randomUUID()
    const result = await this.records.env.DB.batch([
      this.records.statement(`UPDATE env_webhooks SET active=0 WHERE id=? AND company_id=? AND ${f.sql} RETURNING id`,[id,actor.company,...f.args]),
      auditStatement(this.records.env,actor,event,'webhook.revoked',id,1, 'EXISTS(SELECT 1 FROM env_webhooks WHERE id=? AND company_id=? AND active=0)',[id,actor.company]),
    ])
    if (!result[0].results.length) throw new PayrollError('webhook_unavailable',403)
    return {id,active:false}
  }
  async recover(actor: Actor, id: string) {
    this.owner(actor)
    const f = fence(actor), now = Date.now(), event = crypto.randomUUID()
    const result = await this.records.env.DB.batch([
      this.records.statement(`UPDATE env_webhook_jobs SET status='unknown',finished_at=? WHERE id=? AND company_id=? AND status='sending' AND started_at<? AND ${f.sql} RETURNING claim_id`,[now,id,actor.company,now-30000,...f.args]),
      this.records.statement(`UPDATE env_webhook_attempts SET outcome='unknown',finished_at=? WHERE id=(SELECT claim_id FROM env_webhook_jobs WHERE id=? AND company_id=? AND status='unknown' AND finished_at=?)`,[now,id,actor.company,now]),
      auditStatement(this.records.env,actor,event,'webhook.recovered',id,1,'EXISTS(SELECT 1 FROM env_webhook_jobs WHERE id=? AND company_id=? AND finished_at=?)',[id,actor.company,now]),
    ])
    if (!result[0].results.length) throw new PayrollError('job_not_recoverable',409)
    return {id,status:'unknown',nextAction:'inspect receiver; explicitly replay same event'}
  }
  async deliver(actor: Actor, id: string, input: Input) {
    this.owner(actor)
    if (Object.keys(input).some(k => !['consent','replay'].includes(k)) || input.consent !== true)
      throw new PayrollError('explicit_webhook_consent_required')
    const destination = this.destination(), f = fence(actor), now = Date.now(), claim = crypto.randomUUID()
    f.sql += ` AND NOT EXISTS(SELECT 1 FROM env_privacy_requests WHERE company_id=? AND status='held')`
    f.args.push(actor.company)
    const job = await this.records.statement(`SELECT j.*,w.destination,k.secret_cipher,e.proposal_id,e.occurred_at FROM env_webhook_jobs j
      JOIN env_webhooks w ON w.id=j.webhook_id JOIN env_webhook_keys k ON k.id=w.id JOIN env_lifecycle_events e ON e.id=j.event_id
      WHERE j.id=? AND j.company_id=? AND w.active=1 AND w.destination=? AND w.owner_id=? AND w.owner_version=? AND w.grant_version=? AND ${f.sql}`,
      [id,actor.company,destination,actor.session.operator.id,actor.session.operator.version,actor.grant.version,...f.args]).first<Record<string, unknown>>()
    if (!job) throw new PayrollError('job_or_authority_unavailable',403)
    if (job.status === 'delivered' && input.replay !== true) return {id,status:'delivered',duplicate:true}
    const secret = await unseal(await recordKey(this.records.env.ENVELOPE_RECORD_KEY),'webhook:' + job.webhook_id,String(job.secret_cipher))
    const payload = JSON.stringify({id:job.event_id,type:'run.proposal.created',companyId:actor.company,proposalId:job.proposal_id,occurredAt:job.occurred_at,status:'uncalculated-proposal'})
    const timestamp = String(Math.floor(now/1000))
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+payload))),b=>b.toString(16).padStart(2,'0')).join('')
    const result = await this.records.env.DB.batch([
      this.records.statement(`UPDATE env_webhook_jobs SET status='sending',attempt=attempt+1,started_at=?,finished_at=NULL,claim_id=? WHERE id=? AND company_id=? AND status=? AND status!='sending' AND attempt=? AND attempt<5 AND ${f.sql}
        AND EXISTS(SELECT 1 FROM env_webhooks WHERE id=webhook_id AND active=1 AND destination=? AND owner_id=? AND owner_version=? AND grant_version=?) RETURNING attempt`,
        [now,claim,id,actor.company,job.status,job.attempt,...f.args,destination,actor.session.operator.id,actor.session.operator.version,actor.grant.version]),
      this.records.statement(`INSERT INTO env_webhook_attempts(id,company_id,job_id,attempt,started_at,outcome) SELECT ?,company_id,id,attempt,?,'sending' FROM env_webhook_jobs WHERE id=? AND claim_id=?`,[claim,now,id,claim]),
      auditStatement(this.records.env,actor,claim,'webhook.delivery',id,Number(job.attempt)+1,'EXISTS(SELECT 1 FROM env_webhook_jobs WHERE id=? AND claim_id=?)',[id,claim]),
    ])
    if (!result[0].results.length) throw new PayrollError('job_or_authority_changed',409)
    // A final current-owner fence immediately precedes the only outbound call.
    const current = await this.records.statement(`SELECT 1 FROM env_webhook_jobs j JOIN env_webhooks w ON w.id=j.webhook_id WHERE j.id=? AND j.claim_id=? AND j.status='sending' AND w.active=1 AND ${f.sql}`,[id,claim,...f.args]).first()
    let status = 'unknown', httpStatus: number | null = null
    if (!current) status = 'failed'
    else try {
      const response = await fetch(destination,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'content-type':['application','json'].join('/'),'envelope-event-id':String(job.event_id),'envelope-timestamp':timestamp,'envelope-signature':'v1='+signature},body:payload})
      httpStatus = response.status
      status = response.ok ? 'delivered' : response.status >= 400 && response.status < 500 ? 'failed' : 'unknown'
      await response.body?.cancel()
    } catch { /* A lost acknowledgement is unknown; never automatic retry. */ }
    const finished = Date.now()
    await this.records.env.DB.batch([
      this.records.statement(`UPDATE env_webhook_jobs SET status=?,finished_at=? WHERE id=? AND claim_id=? AND status='sending'`,[status,finished,id,claim]),
      this.records.statement(`UPDATE env_webhook_attempts SET outcome=?,http_status=?,finished_at=? WHERE id=? AND outcome='sending'`,[status,httpStatus,finished,claim]),
    ])
    return {id,status,attempt:Number(job.attempt)+1,eventId:job.event_id}
  }
}
