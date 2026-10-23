import { PortabilityError } from '@runeditrun/rer/modules/portability';
import { archiveRecordKey, decryptArchivedRecord } from './encryption.mjs';
import { validateRelationships, quote } from './relationships.mjs';

const fail = code => { throw new PortabilityError(code, 409); };
const parsed = text => {
  try { return JSON.parse(text); } catch { fail('archive_record_invalid'); }
};
const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), byte => byte.toString(16).padStart(2, '0')).join('');

// Retained claim originals are part of the encrypted workspace record, rather
// than a bucket. Check their actual bytes as well as the outer archive digest.
async function validateClaimArtifacts(data) {
  if (!Array.isArray(data.artifacts)) fail('archive_record_invalid');
  const identities = new Set();
  for (const artifact of data.artifacts) {
    if (!artifact || typeof artifact.id !== 'string' || identities.has(artifact.id) ||
        typeof artifact.contentBase64 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) fail('archive_artifact_invalid');
    identities.add(artifact.id);
    let content;
    try { content = Uint8Array.from(atob(artifact.contentBase64), character => character.charCodeAt(0)); } catch { fail('archive_artifact_invalid'); }
    if (content.length !== artifact.bytes || await sha256(content) !== artifact.sha256) fail('archive_artifact_invalid');
  }
}

export async function validateEnvelopeArchive(staged, getKey) {
  await validateRelationships(staged);
  let key;
  const { db, tables, manifest } = staged;
  for (const table of manifest.tables) {
    const encrypted = table.columns.filter(column => /(?:^|_)cipher$/.test(column.name));
    if (!encrypted.length) continue;
    // One row at a time bounds the transport for records containing originals.
    for (let offset = 0; offset < table.count; offset++) {
      const row = (await db.prepare(`SELECT * FROM ${quote(tables[table.name])} LIMIT 1 OFFSET ?`).bind(offset).first());
      if (!row) fail('archive_record_missing');
      key ??= await archiveRecordKey(await getKey());
      for (const column of encrypted) {
        if (row[column.name] === null) continue;
        const plaintext = await decryptArchivedRecord(key, table.name, row, column.name);
        if (table.name === 'env_notices' &&
            await sha256(new TextEncoder().encode(plaintext)) !== row.digest) fail('archive_record_digest_invalid');
        if (table.name === 'env_notice_replies') {
          const notice = await db.prepare(`SELECT digest FROM ${quote(tables.env_notices)} WHERE company_id=? AND id=?`).bind(row.company_id, row.notice_id).first();
          const bound = JSON.stringify([row.company_id, row.notice_id, notice?.digest, Number(row.provider_version), parsed(plaintext)]);
          if (!notice || await sha256(new TextEncoder().encode(bound)) !== row.digest) fail('archive_record_digest_invalid');
        }
        if (table.name === 'env_workspace_versions') {
          const data = parsed(plaintext);
          if (row.kind === 'ui-claim') await validateClaimArtifacts(data);
        } else if (['env_company_setup', 'env_jurisdictions', 'env_notice_analysis', 'env_notice_replies', 'env_verification_consents', 'env_firm_work', 'env_firm_work_history'].includes(table.name)) parsed(plaintext);
      }
    }
  }
  return true;
}
