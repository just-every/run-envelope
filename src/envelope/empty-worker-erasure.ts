// @ts-expect-error Base publishes this runtime journal subpath without declarations.
import { erasureStatements, invalidateTransfersStatements } from '@runeditrun/rer/modules/portability/journal'
import { fence, type Actor } from './access'
import type { Input, Records } from './records'
import { integer, PayrollError, text } from './security'
import { stepUpFence } from './step-up'

const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
const retention = () => new PayrollError('erasure_retention_review_required', 409)

/** Only an unused worker row can be removed; all dependent evidence blocks this door. */
export class EmptyWorkerErasure {
  constructor(public records: Records) {}

  async erase(actor: Actor, personId: string, input: Input) {
    if (actor.session.kind !== 'native' || actor.session.operator.role !== 'owner'
      || actor.grant.role !== 'owner' || actor.session.id !== this.records.session.id
      || actor.session.operator.email.trim().toLowerCase() !== this.records.env.OWNER_EMAIL.trim().toLowerCase())
      throw new PayrollError('owner_required', 403)
    if (input.consent !== true) throw new PayrollError('consent_required', 400)
    const person = text(personId), expectedVersion = integer(input.version)
    const current = fence(actor), proof = stepUpFence(actor)
    const owner = {
      sql: `${current.sql} AND EXISTS(SELECT 1 FROM env_companies c
        JOIN oa_operators o ON o.id=c.created_by
        JOIN oa_sessions s ON s.operator_id=o.id
        JOIN env_grants g ON g.company_id=c.id AND g.operator_id=o.id
        WHERE c.id=? AND c.created_by=? AND o.role='owner' AND o.status='active'
        AND s.id=? AND s.kind='native' AND g.role='owner' AND g.version=? AND g.revoked_at IS NULL
        AND lower(trim(o.email))=?)`,
      args: [...current.args, actor.company, actor.session.operator.id, actor.session.id, actor.grant.version, this.records.env.OWNER_EMAIL.trim().toLowerCase()],
    }
    if (!await this.records.statement(`SELECT 1 WHERE ${owner.sql}`, owner.args).first())
      throw new PayrollError('owner_required', 403)
    if (!await this.records.statement(`SELECT 1 WHERE ${proof.sql}`, proof.args).first())
      throw new PayrollError('step_up_required', 403)
    const personExists = 'EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=? AND version=?)'
    const personArgs = [actor.company, person, expectedVersion]
    if (!await this.records.statement(`SELECT 1 WHERE ${personExists}`, personArgs).first())
      throw new PayrollError('person_version_changed', 409)

    const tables = (await this.records.statement(
      "SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'env_*' AND name!='env_people' ORDER BY name",
    ).all<{ name: string }>()).results
    const dependencies: string[] = [], dependencyArgs: unknown[] = []
    for (const table of tables) {
      const columns = (await this.records.statement(`PRAGMA table_info(${quote(table.name)})`)
        .all<{ name: string }>()).results.map(column => column.name)
      if (columns.includes('company_id') && columns.includes('person_id')) {
        dependencies.push(`NOT EXISTS(SELECT 1 FROM ${quote(table.name)} WHERE company_id=? AND person_id=?)`)
        dependencyArgs.push(actor.company, person)
      }
    }
    const unused = dependencies.length ? dependencies.join(' AND ') : '1'
    if (!await this.records.statement(`SELECT 1 WHERE ${unused}`, dependencyArgs).first()) throw retention()
    const condition = `${owner.sql} AND ${proof.sql} AND ${personExists} AND ${unused}`
    const conditionArgs = [...owner.args, ...proof.args, ...personArgs, ...dependencyArgs]
    // Journal preparation may initialize Base state. Check every refusal before invoking it.
    if (!await this.records.statement(`SELECT 1 WHERE ${condition}`, conditionArgs).first()) throw retention()
    const db = this.records.env.DB
    const transfers: D1PreparedStatement[] = await invalidateTransfersStatements(db)
    const journal: D1PreparedStatement[] = await erasureStatements(db, 'env_people', { company_id: actor.company, id: person })
    const event = crypto.randomUUID(), anonymousLabel = 'erased-' + crypto.randomUUID()
    try {
      await db.batch([
        this.records.statement(
          `INSERT INTO rer_erasure_guard(value) SELECT CASE WHEN (${condition}) THEN 1 ELSE 0 END`, conditionArgs,
        ),
        ...transfers, ...journal,
        this.records.statement(`DELETE FROM env_people WHERE company_id=? AND id=? AND ${condition}`,
          [actor.company, person, ...conditionArgs]),
        this.records.statement(
          'INSERT INTO rer_erasure_guard(value) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM env_people WHERE company_id=? AND id=?) THEN 1 ELSE 0 END',
          [actor.company, person],
        ),
        this.records.statement(
          `INSERT INTO env_audit(id,company_id,actor_id,action,target_id,version,occurred_at)
           VALUES(?,?,?,'privacy.unused-worker.erased',?,?,?)`,
          [event, actor.company, actor.session.operator.id, anonymousLabel, expectedVersion, Date.now()],
        ),
        this.records.statement('DELETE FROM rer_erasure_guard'),
      ])
    } catch { throw retention() }
    return { id: anonymousLabel, erased: true }
  }
}
