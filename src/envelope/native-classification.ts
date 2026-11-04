import type { Bindings } from '../auth.server'
import type { Actor } from './access'

/** Native human authority is unchanged. These facts describe the exact audited
 * selection; class policy never grants a human power or authorizes an agent. */
export function nativeClassification(classes: string[], measure: number, kind: string) {
  return classes.map(cls => ({class:cls, facts:{measure,kind}}))
}
export function classificationHeaders(classes: string[], measure: number, kind: string) {
  return {'x-envelope-classification':JSON.stringify(nativeClassification(classes,measure,kind))}
}
export async function classificationStatement(env: Bindings, actor: Actor, event: string, classes: string[], measure: number, kind: string) {
  if(!await nativeFactsAvailable(env))return env.DB.prepare('SELECT 1')
  return env.DB.prepare(`INSERT INTO env_native_action_facts(audit_id,classification)
    SELECT id,? FROM env_audit WHERE id=? AND company_id=?`)
    .bind(JSON.stringify(nativeClassification(classes,measure,kind)),event,actor.company)
}

/** The count SELECT runs in the same transaction as the audited response rows. */
export async function countedClassificationStatement(env: Bindings, actor: Actor, event: string, cls: string, kind: string, selection: {sql:string;args:unknown[]}) {
  if(!await nativeFactsAvailable(env))return env.DB.prepare('SELECT 1')
  return env.DB.prepare(`INSERT INTO env_native_action_facts(audit_id,classification)
    SELECT id,json_array(json_object('class',?,'facts',json_object('measure',(${selection.sql}),'kind',?)))
    FROM env_audit WHERE id=? AND company_id=?`)
    .bind(cls,...selection.args,kind,event,actor.company)
}


/** A pre-upgrade native installation still returns classification in its HTTP
 * response. Historical audit rows are retained as written, never backfilled. */
export async function nativeFactsAvailable(env: Bindings) {
  return Boolean(await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='env_native_action_facts'").first())
}
