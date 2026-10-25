import { PortabilityError } from '@runeditrun/rer/modules/portability';

export const quote = name => '"' + name.replaceAll('"', '""') + '"';
const refuse = () => { throw new PortabilityError('archive_relationship_invalid', 409); };
const all = async (db, sql) => (await db.prepare(sql).all()).results;

export async function validateRelationships({ db, tables, manifest }) {
  const inventory = new Map(manifest.tables.map(table => [table.name, table]));
  const staged = table => {
    if (!Object.hasOwn(tables, table)) refuse();
    return quote(tables[table]);
  };
  const absent = async (table, condition) => {
    if ((await all(db, `SELECT 1 FROM ${staged(table)} c WHERE ${condition} LIMIT 1`)).length) refuse();
  };
  for (const table of manifest.tables) {
    const columns = new Set(table.columns.map(column => column.name));
    if (columns.has('company_id')) await absent(table.name,
      `c.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${staged('env_companies')} p WHERE p.id=c.company_id)`);
    // Some payroll mappings predate their SQL foreign key declarations.
    if (columns.has('company_id') && columns.has('person_id')) await absent(table.name,
      `c.person_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${staged('env_people')} p WHERE p.company_id=c.company_id AND p.id=c.person_id)`);
    const groups = new Map();
    for (const key of await all(db, `PRAGMA foreign_key_list(${quote(table.name)})`)) {
      const group = groups.get(key.id) ?? [];
      group.push(key); groups.set(key.id, group);
    }
    for (const keys of groups.values()) {
      keys.sort((a, b) => a.seq - b.seq);
      const parent = inventory.get(keys[0].table);
      if (!parent) refuse();
      const primary = parent.columns.filter(column => column.pk).sort((a, b) => a.pk - b.pk);
      const present = keys.map(key => `c.${quote(key.from)} IS NOT NULL`).join(' AND ');
      const match = keys.map((key, index) => `p.${quote(key.to || primary[index]?.name || '')}=c.${quote(key.from)}`).join(' AND ');
      await absent(table.name, `${present} AND NOT EXISTS(SELECT 1 FROM ${staged(parent.name)} p WHERE ${match})`);
    }
    if (columns.has('company_id') && columns.has('credential_id')) await absent(table.name,
      `c.credential_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${staged('env_agent_grants')} p WHERE p.id=c.credential_id AND p.company_id=c.company_id)`);
  }
  for (const table of ['env_notice_approvals', 'env_notice_dispatches']) if (tables[table]) await absent(table,
    `NOT EXISTS(SELECT 1 FROM ${staged('env_notice_replies')} p WHERE p.company_id=c.company_id AND p.id=c.reply_id AND p.version=c.version AND p.digest=c.digest)`);
  if (tables.env_archive_adoptions) await absent('env_archive_adoptions',
    `NOT EXISTS(SELECT 1 FROM ${staged('env_audit')} p WHERE p.id=c.event_id
      AND p.company_id=c.company_id AND p.action='archive.history.adopted' AND p.target_id=c.company_id)`);
  if (tables.env_firm_work) {
    const sources = [
      `c.source_kind='notice' AND EXISTS(SELECT 1 FROM ${staged('env_notices')} p WHERE p.company_id=c.company_id AND p.id=c.source_id AND c.source_version=1)`,
      `c.source_kind='registration' AND EXISTS(SELECT 1 FROM ${staged('env_jurisdictions')} p WHERE p.company_id=c.company_id AND p.code=c.source_id AND p.version=c.source_version)`,
      `c.source_kind='earnings-run' AND EXISTS(SELECT 1 FROM ${staged('env_workspace_versions')} p WHERE p.company_id=c.company_id AND p.kind='earnings-run' AND p.object_id=c.source_id AND p.version=c.source_version)`,
    ];
    await absent('env_firm_work', `NOT (${sources.join(' OR ')})`);
  }
}
