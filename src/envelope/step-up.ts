import type { Actor } from './access'
import type { Bindings } from '../auth.server'
import type { Session } from '../modules/operator-auth/index.mjs'
import { PayrollError } from './security'

// Same ten-minute app-local proof as Base. Provider-issued identity, client MFA
// booleans and fresh cookie creation alone are never proof. Repeat at SQL write.
export function stepUpFence(actor: Actor) {
  return sessionProofFence(actor.session)
}
export function sessionProofFence(session: Session) {
  return {
    sql: `(EXISTS(SELECT 1 FROM oa_step_up_challenges p WHERE p.session_id=? AND p.operator_id=? AND p.operator_version=? AND p.consumed_at>=unixepoch('subsec')*1000-600000 AND p.consumed_at<=unixepoch('subsec')*1000)
   OR EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id WHERE s.id=? AND s.kind='native' AND t.kind IN ('magic','invite') AND t.consumed_at IS NOT NULL AND t.revoked_at IS NULL AND t.operator_id=s.operator_id AND t.operator_version=s.operator_version AND s.created_at>=unixepoch('subsec')*1000-600000 AND s.created_at<=unixepoch('subsec')*1000))`,
    args: [
      session.id,
      session.operator.id,
      session.operator.version,
      session.id,
    ],
  }
}
export async function requirePayrollProof(env: Bindings, actor: Actor) {
  const proof = stepUpFence(actor)
  const row = await env.DB.prepare(`SELECT 1 AS fresh WHERE ${proof.sql}`)
    .bind(...proof.args)
    .first()
  if (!row) throw new PayrollError('step_up_required', 403)
}
