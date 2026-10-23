import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { parseJsonc } from '@runeditrun/rer/jsonc';
import { readSettings, replaceSavedSetting } from '@runeditrun/rer/adapter-settings';
import { privateDirectory, writePrivateFile } from '@runeditrun/rer/private-files';

// These are operatorInstaller's native settings defaults in this seed.
export const recordKeySettings = Object.freeze({ file: '.dev.vars', format: 'dotenv' });
export class RecordKeyError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function canonicalRecordKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new RecordKeyError('record_key_invalid');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== value) throw new RecordKeyError('record_key_invalid');
  return value;
}
export async function loadRecordKey(root) {
  const saved = await readSettings(root, recordKeySettings);
  if (!saved.values.ENVELOPE_RECORD_KEY) throw new RecordKeyError('record_key_missing');
  return canonicalRecordKey(saved.values.ENVELOPE_RECORD_KEY);
}
export async function saveRecordKey(root, value) {
  const key = canonicalRecordKey(value), saved = await readSettings(root, recordKeySettings);
  if (saved.text === undefined) {
    await writePrivateFile(join(root, recordKeySettings.file), `ENVELOPE_RECORD_KEY=${key}\n`, true);
    return;
  }
  if (!Object.hasOwn(saved.values, 'ENVELOPE_RECORD_KEY')) throw new RecordKeyError('record_key_assignment_missing');
  try { await replaceSavedSetting(root, recordKeySettings, 'ENVELOPE_RECORD_KEY', key); }
  catch { throw new RecordKeyError('record_key_settings_refused'); }
}
export async function assertEmptyBusinessData(root) {
  const config = parseJsonc(await readFile(join(root, 'wrangler.jsonc'), 'utf8'));
  const database = config.d1_databases?.find(entry => entry.binding === 'DB');
  if (!database) throw new RecordKeyError('record_key_database_binding_missing');
  const directory = await privateDirectory(root, ['.wrangler']);
  const path = join(directory, `record-key-check-${randomUUID()}.json`);
  const declaration = Object.fromEntries(['name', 'compatibility_date', 'compatibility_flags'].filter(key => config[key] !== undefined).map(key => [key, config[key]]));
  declaration.d1_databases = [database];
  await writePrivateFile(path, JSON.stringify(declaration), true);
  let proxy;
  try {
    const { getPlatformProxy } = createRequire(join(root, 'package.json'))('wrangler');
    proxy = await getPlatformProxy({ configPath: path, persist: { path: join(root, '.wrangler', 'state', 'v3') }, remoteBindings: false });
    const db = proxy.env.DB;
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'env_*' ORDER BY name").all();
    for (const table of tables.results) {
      const name = '"' + table.name.replaceAll('"', '""') + '"';
      if (await db.prepare(`SELECT 1 AS present FROM ${name} LIMIT 1`).first()) throw new RecordKeyError('record_key_target_not_empty');
    }
  } finally {
    try { await proxy?.dispose(); }
    finally { await unlink(path); }
  }
}
