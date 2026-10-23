import type { Input } from '../records'
import type { Actor } from '../access'
import type { FirmSettings, WorkData } from './work-types'
import { PayrollError, text } from '../security'

function human(actor: Actor) {
  if (!['native', 'oidc', 'password', 'dev'].includes(actor.session.kind))
    throw new PayrollError('human_session_required', 403)
}
export function handoffInput(actor: Actor, input: Input, settings: FirmSettings): NonNullable<WorkData['handoff']> {
  human(actor)
  if (!settings.blotterOrigin) throw new PayrollError('blotter_origin_required', 409)
  const raw = text(input.jobUrl, 500)
  let url: URL
  try { url = new URL(raw) } catch { throw new PayrollError('invalid_blotter_job') }
  const jobId = url.searchParams.get('job') || ''
  if (url.origin !== settings.blotterOrigin || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/app' || url.hash || !/^[A-Za-z0-9][-A-Za-z0-9_]{0,79}$/.test(jobId) || url.search !== `?job=${jobId}` || raw !== `${url.origin}/app?job=${jobId}`)
    throw new PayrollError('invalid_blotter_job')
  return { jobUrl: raw, jobId, recipientId: text(input.recipientId), evidenceRef: text(input.evidenceRef, 1000), recordedBy: actor.session.operator.id, recordedAt: Date.now() }
}
export function acknowledgementInput(actor: Actor, input: Input): NonNullable<WorkData['acknowledgement']> {
  human(actor)
  return { evidenceRef: text(input.evidenceRef, 1000), actorId: actor.session.operator.id, occurredAt: Date.now() }
}
