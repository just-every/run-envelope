import type { Actor } from '../access'
/** Held person data is available only to the owner acting as records custodian. */
export function retainedPersonAccess(actor:Actor,alias='env_people') {
  return actor.grant.role==='owner' ? '1' : retainedAgentAccess(alias)
}
export function retainedAgentAccess(alias='env_people') {
  return `NOT EXISTS(SELECT 1 FROM env_privacy_requests privacy WHERE privacy.company_id=${alias}.company_id AND privacy.person_id=${alias}.id AND privacy.state='held')`
}
