// Envelope currently provides the Base foundation, with no payroll records.
// Complete its real first-run state after Base has created the demo owner.
import type { Bindings } from './auth.server'

export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  await env.DB.prepare("INSERT INTO oa_first_run (singleton, completed_by, completed_at) SELECT 1, id, ? FROM oa_operators WHERE email = ? AND role = 'owner' ON CONFLICT(singleton) DO NOTHING").bind(now.getTime(), ownerEmail).run()
}
