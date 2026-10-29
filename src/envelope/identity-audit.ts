import type { AuthAuditEvent, AuthAuditStatement } from '../modules/operator-auth/index.mjs'

/** Base supplies the before and after authority witnesses around these statements. */
export async function identityAudit(db: D1Database, event: AuthAuditEvent): Promise<AuthAuditStatement[]> {
  const {action,subjectId,actorId,detail,now}=event
  const access=action.startsWith('operators.') || action.startsWith('domains.') || action==='sessions.revoke'
  const security=!action.startsWith('operators.') || ['operators.invite','operators.cancel-invite'].includes(action)
  const classes=[...(access?['access']:[]),...(security?['security']:[])]
  // Base checks the target version in the same batch as the role write and audit.
  // Read its prior rank before that batch; a changed snapshot refuses the write.
  const ranks=['member','admin','owner']
  const prior=action==='operators.role' ? await db.prepare('SELECT role FROM oa_operators WHERE id=?').bind(subjectId).first<{role:string}>() : null
  if (action==='operators.role' && (!prior || !ranks.includes(prior.role) || !ranks.includes(detail??''))) throw new Error('identity_audit_role_unavailable')
  const direction=action==='operators.invite'||action==='operators.reactivate' ? 'grant'
    : action==='operators.cancel-invite'||action==='operators.deactivate' ? 'revoke'
      : action==='operators.role' ? (ranks.indexOf(detail!)>ranks.indexOf(prior!.role)?'widen':ranks.indexOf(detail!)<ranks.indexOf(prior!.role)?'narrow':'unchanged')
        : action==='domains.rule.lift' ? 'widen' : access ? 'narrow' : undefined
  const value=JSON.stringify({event:action,subjectId,classes,...(direction?{direction,peopleCount:1}:{})})
  // Domain policy affects current non-owner identities in that domain; never
  // retain the domain, mailbox or provider credential in the class facts.
  const domain=action.startsWith('domains.')
  return [[`INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,'envelope.identity',
    ${domain ? "json_set(?,'$.peopleCount',(SELECT COUNT(*) FROM oa_operators WHERE role!='owner' AND status='active' AND lower(substr(email,instr(email,char(64))+1))=?))" : '?'},?)`,
  [crypto.randomUUID(),actorId,value,...(domain?[detail]:[]),now]]]
}
