import type { Actor } from './access'
import { auditStatement, fence } from './access'
import type { Input, Records } from './records'
import type { AgentTools } from './agents'
import { PayrollError, date } from './security'

export const agentClasses = ['standard', 'money', 'commitment', 'external', 'sensitive', 'destructive', 'accounts', 'access', 'security', 'gated'] as const
export const policyDecisions = ['autonomous', 'review', 'approval', 'blocked'] as const
export type ClassAnswers = Record<typeof agentClasses[number], typeof policyDecisions[number]>
// These facts describe today's native doors. A proposal cannot approve payroll.
export const toolClasses: Record<string, readonly string[]> = {
  'records.list': ['standard'],
  'draft.prepare': ['standard'],
  'draft.read': ['sensitive'],
  'reports.proposals': ['sensitive'],
  'bonus.prepare': ['standard'],
  'bonus.read': ['sensitive'],
  'reports.bonuses': ['sensitive'],
  'run.review': ['standard'],
  'credentials.rotate': ['security'],
  'credentials.restrict': ['access'],
  'notice.process': ['sensitive', 'external'],
  'reply.dispatch': ['commitment', 'external'],
}
interface PolicyRow { version: number; answers: string | null; paused: number }
export class AgentPolicyError extends PayrollError {
  constructor(code: string, public setupLink: string) { super(code, 403) }
}
export function policyFence(company: string, version: number) {
  return {sql: 'EXISTS(SELECT 1 FROM env_agent_class_policy WHERE company_id=? AND version=? AND paused=0 AND answers IS NOT NULL)', args: [company, version]}
}
export class AgentPolicy {
  constructor(public records: Records) {}
  owner(actor: Actor) {
    if (actor.grant.role !== 'owner' || actor.session.kind !== 'native') throw new PayrollError('native_owner_required', 403)
  }
  async read(actor: Actor) {
    const f = fence(actor)
    const row = await this.records.statement(`SELECT version,answers,paused FROM env_agent_class_policy WHERE company_id=? AND ${f.sql}`, [actor.company,...f.args]).first<PolicyRow>()
    const answers = row?.answers ? JSON.parse(row.answers) as ClassAnswers : null
    const complete = answers && agentClasses.every(c=>policyDecisions.includes(answers[c]))
    return {version: row?.version ?? 0, answers: complete ? answers : null, paused: Boolean(row?.paused), classes: agentClasses}
  }
  async save(actor: Actor, input: Input, pauseOnly = false) {
    this.owner(actor)
    const keys = pauseOnly ? ['version', 'paused'] : ['version', ...agentClasses]
    if (Object.keys(input).some(k => !keys.includes(k)) || !/^\d+$/.test(String(input.version))) throw new PayrollError('invalid_class_policy')
    const version = Number(input.version)
    if (!Number.isSafeInteger(version)) throw new PayrollError('invalid_class_policy')
    if (pauseOnly && ![true,false,'true','false'].includes(input.paused as boolean)) throw new PayrollError('invalid_class_policy')
    const answers = Object.fromEntries(agentClasses.map(k => [k,input[k]]))
    if (!pauseOnly && agentClasses.some(k => !policyDecisions.includes(answers[k] as typeof policyDecisions[number]))) throw new PayrollError('answer_every_agent_class')
    const id = crypto.randomUUID(), f = fence(actor), paused = input.paused === true || input.paused === 'true' ? 1 : 0
    const row = await this.records.env.DB.batch([
      this.records.statement(`INSERT INTO env_agent_class_policy(company_id,version,answers,paused,change_id,updated_by,updated_at)
        SELECT ?,1,?,?,?, ?,? WHERE ${f.sql} AND COALESCE((SELECT version FROM env_agent_class_policy WHERE company_id=?),0)=?
        ON CONFLICT(company_id) DO UPDATE SET version=env_agent_class_policy.version+1,
        answers=CASE WHEN ? THEN env_agent_class_policy.answers ELSE excluded.answers END,
        paused=CASE WHEN ? THEN excluded.paused ELSE env_agent_class_policy.paused END,
        change_id=excluded.change_id,updated_by=excluded.updated_by,updated_at=excluded.updated_at
        WHERE env_agent_class_policy.version=? RETURNING version`,
        [actor.company,pauseOnly ? null : JSON.stringify(answers),paused,id,actor.session.operator.id,Date.now(),...f.args,actor.company,version,pauseOnly?1:0,pauseOnly?1:0,version]),
      auditStatement(this.records.env,actor,id,pauseOnly ? (paused ? 'agents.paused' : 'agents.resumed') : 'agents.classes.configured',actor.company,version+1,
        'EXISTS(SELECT 1 FROM env_agent_class_policy WHERE company_id=? AND change_id=?)',[actor.company,id]),
    ])
    if (!row[0].results.length) throw new PayrollError('policy_or_authority_changed',409)
    return this.read(actor)
  }
  async activity(actor: Actor, from?: string, through?: string) {
    if (actor.grant.role !== 'owner' && !actor.grant.actions.includes('records:read')) throw new PayrollError('sponsor_scope_denied',403)
    const today = new Date().toISOString().slice(0,10)
    const end = date(through ?? today), start = date(from ?? new Date(Date.parse(end) - 6*86400000).toISOString().slice(0,10))
    if (start>end || Date.parse(end)-Date.parse(start)>31*86400000) throw new PayrollError('invalid_audit_period')
    const f = fence(actor), filter = `a.company_id=? AND a.occurred_at>=? AND a.occurred_at<? AND (?='owner' OR a.sponsor_id=?) AND ${f.sql}`,
      args = [actor.company,Date.parse(start),Date.parse(end)+86400000,actor.grant.role,actor.session.operator.id,...f.args]
    // An old installation can still supply its genuine pre-upgrade archive fixture.
    // New restriction calls require the migrated facts table and fail closed without it.
    const migrated=Boolean(await this.records.statement("SELECT 1 FROM sqlite_master WHERE type='view' AND name='env_classified_actions'").first())
    const [calls, counts, changes, installation] = await this.records.env.DB.batch<Record<string,unknown>>([
      this.records.statement(`SELECT a.id,a.credential_id AS credentialId,g.name AS agentName,a.sponsor_id AS sponsorId,o.display_name AS sponsorName,a.tool,a.transport,a.classes,${migrated ? "COALESCE((SELECT facts FROM env_agent_call_facts WHERE call_id=a.id),'{}')" : "'{}'"} AS facts,a.decision,a.policy_version AS policyVersion,a.occurred_at AS occurredAt
        FROM env_agent_call_audit a JOIN env_agent_grants g ON g.id=a.credential_id JOIN oa_operators o ON o.id=a.sponsor_id
        WHERE ${filter} ORDER BY a.occurred_at DESC,a.id DESC LIMIT 200`,args),
      this.records.statement(`SELECT c.value AS class,a.decision,COUNT(*) AS count FROM env_agent_call_audit a,json_each(a.classes) c WHERE ${filter} GROUP BY c.value,a.decision ORDER BY c.value,a.decision`,args),
      migrated ? this.records.statement(`SELECT a.id,a.actor_id AS actorId,o.display_name AS actorName,a.action,a.target_id AS targetId,a.classes,a.facts,a.occurred_at AS occurredAt
        FROM env_classified_actions a JOIN oa_operators o ON o.id=a.actor_id WHERE a.company_id=? AND a.occurred_at>=? AND a.occurred_at<?
        AND (?='owner' OR a.actor_id=?) AND ${f.sql} ORDER BY a.occurred_at DESC,a.id DESC LIMIT 200`,args) : this.records.statement('SELECT 1 WHERE 0'),
      migrated ? this.records.statement(`SELECT a.id,a.actor_id AS actorId,o.display_name AS actorName,a.action,a.classes,a.facts,a.created_at AS occurredAt
        FROM env_installation_classified_actions a JOIN oa_operators o ON o.id=a.actor_id
        WHERE a.created_at>=? AND a.created_at<? AND ?='native' AND EXISTS(SELECT 1 FROM oa_bootstrap b JOIN oa_operators current_owner ON current_owner.id=b.claim_id
          WHERE b.claim_id=? AND current_owner.role='owner' AND current_owner.status='active' AND lower(trim(current_owner.email))=?) AND ${f.sql}
        ORDER BY a.created_at DESC,a.id DESC LIMIT 200`,[Date.parse(start),Date.parse(end)+86400000,actor.session.kind,actor.session.operator.id,this.records.env.OWNER_EMAIL.trim().toLowerCase(),...f.args]) : this.records.statement('SELECT 1 WHERE 0'),
    ])
    const decoded=(c:Record<string,unknown>): Record<string,unknown> & {classes:string[];facts:Record<string,unknown>}=>({...c,classes:JSON.parse(String(c.classes)),facts:JSON.parse(String(c.facts))})
    return {from:start,through:end,calls:calls.results.map(decoded),counts:counts.results,changes:changes.results.map(decoded),installation:installation.results.map(decoded)}
  }
}

/** Restriction only: policy cannot supply a scope, a human decision or provider consent. */
export async function policyCall<T>(agent: AgentTools, tool: string, transport: string, execute: () => Promise<T>, input: Input = {}): Promise<T> {
  const company = agent.grant.company_id, setupLink = '/app/envelope/companies/'+encodeURIComponent(company)+'/agents#class-policy'
  const classes = Object.hasOwn(toolClasses,tool) ? toolClasses[tool] : [], id = crypto.randomUUID()
  let decision = 'refused', policyVersion = 0
  const read = () => agent.env.DB.prepare('SELECT version,answers,paused FROM env_agent_class_policy WHERE company_id=?').bind(company).first<PolicyRow>()
  const refusal = (row: PolicyRow | null) => {
    if (row?.paused) return 'agents_paused'
    if (!row?.answers) return 'policy_unset'
    const answers = JSON.parse(row.answers) as ClassAnswers
    if (agentClasses.some(c=>!policyDecisions.includes(answers[c]))) return 'policy_unset'
    if (classes.some(c=>answers[c as keyof ClassAnswers]==='blocked')) return 'policy_blocked'
    if (classes.some(c=>answers[c as keyof ClassAnswers]==='approval')) return 'policy_approval_required'
    if (classes.some(c=>answers[c as keyof ClassAnswers]==='review')) return 'policy_review_required'
    if (classes.some(c=>answers[c as keyof ClassAnswers]!=='autonomous')) return 'policy_unset'
    return null
  }
  let facts: Record<string,unknown> = {}
  if (tool==='credentials.restrict') {
    try {facts={direction:agent.restriction(input).direction,peopleCount:1}}
    catch {facts={direction:'invalid',peopleCount:1}}
  }
  const audit=agent.env.DB.prepare(`INSERT INTO env_agent_call_audit(id,company_id,credential_id,sponsor_id,tool,transport,classes,decision,policy_version,occurred_at)
    VALUES(?,?,?,?,?,?,?,'pending',0,?)`).bind(id,company,agent.grant.id,agent.grant.sponsor_id,classes.length ? tool : 'unsupported',transport,JSON.stringify(classes),Date.now())
  if (tool==='credentials.restrict') await agent.env.DB.batch([audit,agent.env.DB.prepare('INSERT INTO env_agent_call_facts(call_id,facts) VALUES(?,?)').bind(id,JSON.stringify(facts))])
  else await audit.run()
  try {
    if (!classes.length) throw new PayrollError('agent_tool_denied',403)
    const row = await read(), code = refusal(row)
    policyVersion = row?.version ?? 0
    if (code) { decision=code; throw new AgentPolicyError(code,setupLink) }
    if (agent.authenticatedPolicyVersion !== policyVersion) { decision='policy_changed'; throw new AgentPolicyError(decision,setupLink) }
    agent.callPolicyVersion = policyVersion
    const value = await execute()
    const current = await read(), changed = refusal(current)
    if (changed || current?.version !== policyVersion) {
      decision=changed ?? 'policy_changed'
      throw new AgentPolicyError(decision,setupLink)
    }
    const f=agent.fence()
    if (!await agent.env.DB.prepare(`SELECT 1 WHERE ${f.sql}`).bind(...f.args).first()) throw new PayrollError('agent_authority_revoked',403)
    decision='executed'
    return value
  } catch (error) {
    // A suspended operation may lose its policy at its fenced write or read.
    const current = await read(), code = refusal(current)
    if (code || (agent.callPolicyVersion !== undefined && current?.version!==policyVersion)) {
      decision=code ?? 'policy_changed'
      throw new AgentPolicyError(decision,setupLink)
    }
    if (error instanceof PayrollError && /authority|revoked/.test(error.code)) decision='authority_revoked'
    if (error instanceof PayrollError && error.code==='self_escalation') decision='self_escalation'
    throw error
  } finally {
    await agent.env.DB.prepare(`UPDATE env_agent_call_audit SET decision=?,policy_version=? WHERE id=? AND decision='pending'`).bind(decision,policyVersion,id).run()
  }
}
