import type { Actor } from './access'
import type { Bindings } from '../auth.server'
import { PayrollError } from './security'

// Same ten-minute app-local proof as Base. Provider-issued identity, client MFA
// booleans and fresh cookie creation alone are never proof. Repeat at SQL write.
export function stepUpFence(actor: Actor) {
  const now = Date.now(),
    since = now - 600_000
  return {
    sql: `(EXISTS(SELECT 1 FROM oa_step_up_challenges p WHERE p.session_id=? AND p.operator_id=? AND p.operator_version=? AND p.consumed_at>=? AND p.consumed_at<=?)
   OR EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id WHERE s.id=? AND s.kind='native' AND t.kind IN ('magic','invite') AND t.consumed_at IS NOT NULL AND s.created_at>=? AND s.created_at<=?))`,
    args: [
      actor.session.id,
      actor.session.operator.id,
      actor.session.operator.version,
      since,
      now,
      actor.session.id,
      since,
      now,
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
