import type { AgentTools } from './agents'
import type { Bindings } from '../auth.server'
import type { Input } from './records'
import type { EarningsRun } from './workspace/pay-items'
import { reviewInputFence } from './workspace/review-inputs'
import { currentSources, digest } from './workspace/store'
import { PayrollError, date, integer, text, recordKey, seal, unseal } from './security'

export interface BonusPreparation {
  credentialId: string
  requestFingerprint: string
  sourceRef: string
  amountCents: number
}
function authority(agent: AgentTools, input: Input, action: string) {
  agent.allow(action, input.companyId)
  if (!JSON.parse(agent.grant.fields).includes('compensation') || !JSON.parse(agent.grant.locations).includes('*'))
    throw new PayrollError('agent_scope_denied', 403)
}
export async function readBonus(agent: AgentTools, input: Input) {
  authority(agent, input, 'drafts:read')
  if (Object.keys(input).some(k => !['companyId','runId'].includes(k))) throw new PayrollError('invalid_bonus_input')
  const runId = text(input.runId,80), f = agent.fence()
  const rows = await agent.env.DB.batch<Record<string,unknown>>([
    agent.log('bonus.read',runId),
    agent.env.DB.prepare(`SELECT v.cipher,(${currentSources('v')}) AS sourcesCurrent FROM env_workspace_versions v
      WHERE v.company_id=? AND v.kind='earnings-run' AND v.object_id=? AND v.version=1 AND ${f.sql}
      AND EXISTS(SELECT 1 FROM env_agent_access a WHERE a.company_id=v.company_id AND a.credential_id=? AND a.action='bonus.prepared' AND a.target_id=v.object_id)
      AND EXISTS(SELECT 1 FROM env_people p WHERE p.company_id=v.company_id AND p.id=(SELECT person_id FROM env_workspace_people WHERE company_id=v.company_id AND kind=v.kind AND object_id=v.object_id AND version=v.version))`)
      .bind(agent.grant.company_id,runId,...f.args,agent.grant.id),
  ])
  const row=rows[1].results[0]
  if (!rows[0].meta.changes || !row) throw new PayrollError('bonus_or_authority_unavailable',403)
  const data=JSON.parse(await unseal(await recordKey(agent.env.ENVELOPE_RECORD_KEY),JSON.stringify([agent.grant.company_id,'earnings-run',runId,1]),String(row.cipher))) as EarningsRun
  // Repeat authority after decrypting private compensation.
  const current=agent.fence()
  if (!await agent.env.DB.prepare(`SELECT 1 WHERE ${current.sql}`).bind(...current.args).first()) throw new PayrollError('agent_authority_revoked',403)
  return {id:runId,version:1,preview:data,sourcesCurrent:Boolean(row.sourcesCurrent),status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'}
}
export async function prepareBonus(agent: AgentTools, input: Input) {
  authority(agent,input,'drafts:prepare')
  if(Object.keys(input).some(k=>!['companyId','personId','amountCents','periodStart','periodEnd','payDate','sourceRef','requestKey'].includes(k))) throw new PayrollError('invalid_bonus_input')
  const personId=text(input.personId,80), amountCents=integer(input.amountCents), periodStart=date(input.periodStart),periodEnd=date(input.periodEnd),payDate=date(input.payDate),sourceRef=text(input.sourceRef,240),requestKey=text(input.requestKey,120)
  if(amountCents>100000000 || periodStart>periodEnd || payDate<periodEnd || (Date.parse(periodEnd)-Date.parse(periodStart))/86400000>30) throw new PayrollError('invalid_bonus_input')
  const runId=await digest(JSON.stringify(['bonus',agent.grant.company_id,agent.grant.id,requestKey]))
  const requestFingerprint=await digest(JSON.stringify([personId,amountCents,periodStart,periodEnd,payDate,sourceRef]))
  const f=agent.fence(), key=await recordKey(agent.env.ENVELOPE_RECORD_KEY)
  const existing=await agent.env.DB.prepare(`SELECT cipher FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=? AND version=1 AND ${f.sql}`).bind(agent.grant.company_id,runId,...f.args).first<{cipher:string}>()
  if(existing) {
    const retained=JSON.parse(await unseal(key,JSON.stringify([agent.grant.company_id,'earnings-run',runId,1]),existing.cipher)) as EarningsRun
    if(retained.bonusPreparation?.requestFingerprint!==requestFingerprint) throw new PayrollError('bonus_idempotency_conflict',409)
    return readPrepared(agent,runId,requestFingerprint)
  }
  const person=await agent.env.DB.prepare(`SELECT p.id,p.version,p.name,l.state_code AS state,
    COALESCE((SELECT version FROM env_private_records WHERE company_id=p.company_id AND person_id=p.id AND kind='bank'),0) AS bankVersion
    FROM env_people p JOIN env_locations l ON l.company_id=p.company_id AND l.id=p.location_id WHERE p.company_id=? AND p.id=? AND ${f.sql}`)
    .bind(agent.grant.company_id,personId,...f.args).first<{id:string;version:number;name:string;state:string;bankVersion:number}>()
  if(!person) throw new PayrollError('bonus_or_authority_unavailable',403)
  const counts=await agent.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM env_workspace_versions WHERE company_id=? AND kind='rule' AND person_id IS NULL) AS versions,
    (SELECT COUNT(*) FROM env_workspace_decisions WHERE company_id=? AND kind='rule') AS decisions WHERE ${f.sql}`).bind(agent.grant.company_id,agent.grant.company_id,...f.args).first<{versions:number;decisions:number}>()
  if(!counts) throw new PayrollError('agent_authority_revoked',403)
  const rules=reviewInputFence(agent.grant.company_id,[{kind:'rule',personId:'',exceptId:'',...counts}])
  const preview:EarningsRun={periodStart,periodEnd,payDate,frequency:'off-cycle bonus',groupId:'',
    people:[{id:person.id,name:person.name,earningsCents:amountCents,taxableCashCents:amountCents,reimbursementCents:0,afterTaxDeductionCents:0,cashTipsCents:0,paycheckTipsCents:0,tipFundsCents:0,
      details:[`Bonus: ${amountCents} cents. Source: ${sourceRef}`,`Prepared by scoped credential ${agent.grant.id}; human approval is separate.`]}],
    holds:[{personId:person.id,code:'bonus-calculation-incomplete',reason:'Supplemental withholding, bonus-related overtime, full tax obligations and net pay are not calculated. No payment or filing can be released.'}],
    destinations:[{personId:person.id,bankVersion:person.bankVersion}],grossCashCents:amountCents,taxableCashCents:amountCents,reimbursementCents:0,afterTaxDeductionCents:0,taxAmounts:null,netPay:null,paymentReady:false,
    setupFingerprint:'',locationStates:[person.state],ruleFingerprint:'',ruleSources:[],
    bonusPreparation:{credentialId:agent.grant.id,requestFingerprint,sourceRef,amountCents}}
  const cipher=await seal(key,JSON.stringify([agent.grant.company_id,'earnings-run',runId,1]),JSON.stringify(preview)), event=crypto.randomUUID(), now=Date.now()
  // The record, custody pin and credential attribution commit in one transaction.
  const result=await agent.env.DB.batch([
    agent.env.DB.prepare(`INSERT INTO env_workspace_versions(company_id,kind,object_id,version,person_id,person_version,cipher,created_by,created_at,change_id)
      SELECT ?,'earnings-run',?,1,NULL,NULL,?,?,?,? WHERE ${f.sql}
      AND EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)
      AND COALESCE((SELECT version FROM env_private_records WHERE company_id=? AND person_id=? AND kind='bank'),0)=?
      AND NOT EXISTS(SELECT 1 FROM env_privacy_source_fences WHERE company_id=? AND source_hash=?) AND ${rules.sql}
      ON CONFLICT(company_id,kind,object_id,version) DO NOTHING RETURNING object_id`)
      .bind(agent.grant.company_id,runId,cipher,agent.grant.sponsor_id,now,event,...f.args,agent.grant.company_id,person.id,person.version,agent.grant.company_id,person.id,person.bankVersion,agent.grant.company_id,await digest(JSON.stringify(['earnings-run',runId])),...rules.args),
    agent.env.DB.prepare(`INSERT INTO env_workspace_people(company_id,kind,object_id,version,person_id,person_version)
      SELECT ?,'earnings-run',?,1,?,? WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`).bind(agent.grant.company_id,runId,person.id,person.version,event),
    agent.env.DB.prepare(`INSERT INTO env_workspace_review_inputs(company_id,kind,object_id,version,source_kind,source_person_id,except_id,versions,decisions)
      SELECT ?,'earnings-run',?,1,'rule','','',?,? WHERE EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)`).bind(agent.grant.company_id,runId,counts.versions,counts.decisions,event),
    agent.log('bonus.prepared',runId,'EXISTS(SELECT 1 FROM env_workspace_versions WHERE change_id=?)',[event]),
  ])
  if(!result[0].results.length && !await agent.env.DB.prepare(`SELECT 1 FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=? AND ${f.sql}`).bind(agent.grant.company_id,runId,...f.args).first()) throw new PayrollError('bonus_input_or_authority_changed',409)
  return readPrepared(agent,runId,requestFingerprint)
}
async function readPrepared(agent: AgentTools, runId:string, fingerprint:string) {
  // Preparation-only grants receive a reference, never an implicit read power.
  const f=agent.fence()
  const row=await agent.env.DB.prepare(`SELECT cipher FROM env_workspace_versions WHERE company_id=? AND kind='earnings-run' AND object_id=? AND version=1 AND ${f.sql}`).bind(agent.grant.company_id,runId,...f.args).first<{cipher:string}>()
  if(!row) throw new PayrollError('agent_authority_revoked',403)
  const data=JSON.parse(await unseal(await recordKey(agent.env.ENVELOPE_RECORD_KEY),JSON.stringify([agent.grant.company_id,'earnings-run',runId,1]),row.cipher)) as EarningsRun
  if(data.bonusPreparation?.credentialId!==agent.grant.id || data.bonusPreparation.requestFingerprint!==fingerprint) throw new PayrollError('bonus_idempotency_conflict',409)
  if(!await agent.env.DB.prepare(`SELECT 1 WHERE ${f.sql}`).bind(...f.args).first()) throw new PayrollError('agent_authority_revoked',403)
  return {id:runId,version:1,status:'uncalculated-earnings-run',approval:'requires-separate-human-proof',dispatch:'unavailable'}
}

/** A report of retained native bonus earnings, never a paid register. */
export async function bonusReport(agent: AgentTools, input: Input) {
  authority(agent,input,'drafts:read')
  if(Object.keys(input).some(k=>!['companyId','limit','after'].includes(k))) throw new PayrollError('invalid_report_query')
  const limit=input.limit===undefined ? 100 : integer(input.limit)
  if(limit>100) throw new PayrollError('invalid_report_query')
  const after=input.after===undefined ? '' : text(input.after,80), f=agent.fence()
  const rows=await agent.env.DB.batch<{id:string}>([
    agent.log('reports.bonuses',agent.grant.company_id),
    agent.env.DB.prepare(`SELECT v.object_id AS id FROM env_workspace_versions v
      WHERE v.company_id=? AND v.kind='earnings-run' AND v.version=1 AND v.object_id>? AND ${f.sql}
      AND EXISTS(SELECT 1 FROM env_agent_access a WHERE a.company_id=v.company_id AND a.credential_id=? AND a.action='bonus.prepared' AND a.target_id=v.object_id)
      AND EXISTS(SELECT 1 FROM env_workspace_people pin JOIN env_people p ON p.company_id=pin.company_id AND p.id=pin.person_id
        WHERE pin.company_id=v.company_id AND pin.kind=v.kind AND pin.object_id=v.object_id AND pin.version=v.version)
      ORDER BY v.object_id LIMIT ?`).bind(agent.grant.company_id,after,...f.args,agent.grant.id,limit+1),
  ])
  if(!rows[0].meta.changes) throw new PayrollError('agent_authority_revoked',403)
  const selected=rows[1].results.slice(0,limit), bonuses=[]
  for(const row of selected) {
    const run=await readBonus(agent,{companyId:agent.grant.company_id,runId:row.id})
    bonuses.push({id:run.id,version:run.version,personId:run.preview.people[0].id,amountCents:run.preview.grossCashCents,
      periodStart:run.preview.periodStart,periodEnd:run.preview.periodEnd,payDate:run.preview.payDate,sourcesCurrent:run.sourcesCurrent,status:run.status})
  }
  if(!await agent.env.DB.prepare(`SELECT 1 WHERE ${f.sql}`).bind(...f.args).first()) throw new PayrollError('agent_authority_revoked',403)
  return {kind:'bonus-earnings-preparations',bonuses,limit,next:rows[1].results.length>limit ? selected.at(-1)!.id : null,payroll:'uncalculated',payment:'unavailable',filing:'unavailable'}
}
