import type { AuthAuditEvent, AuthAuditStatement } from '../modules/operator-auth/index.mjs'

/** Base supplies the before and after authority witnesses around these statements. */
export function identityAudit(event: AuthAuditEvent): AuthAuditStatement[] {
  const {action,subjectId,actorId,detail,now}=event
  const access=action.startsWith('operators.') || action.startsWith('domains.') || action==='sessions.revoke'
  const security=!action.startsWith('operators.') || ['operators.invite','operators.cancel-invite'].includes(action)
  const classes=[...(access?['access']:[]),...(security?['security']:[])]
  const direction=action==='operators.invite'||action==='operators.reactivate' ? 'grant'
    : action==='operators.cancel-invite'||action==='operators.deactivate' ? 'revoke'
      : action==='operators.role' ? (detail==='owner'?'widen':'narrow')
        : action==='domains.rule.lift' ? 'widen' : access ? 'narrow' : undefined
  const value=JSON.stringify({event:action,subjectId,classes,...(direction?{direction,peopleCount:1}:{})})
  // Domain policy affects current non-owner identities in that domain; never
  // retain the domain, mailbox or provider credential in the class facts.
  const domain=action.startsWith('domains.')
  return [[`INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,'envelope.identity',
    ${domain ? "json_set(?,'$.peopleCount',(SELECT COUNT(*) FROM oa_operators WHERE role!='owner' AND status='active' AND lower(substr(email,instr(email,char(64))+1))=?))" : '?'},?)`,
  [crypto.randomUUID(),actorId,value,...(domain?[detail]:[]),now]]]
}
