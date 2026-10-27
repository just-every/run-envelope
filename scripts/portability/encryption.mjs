import { PortabilityError } from '@runeditrun/rer/modules/portability';

const fail = code => { throw new PortabilityError(code, 409); };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const bytes = value => {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(value)) fail('archive_cipher_invalid');
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
};
const version = value => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) fail('archive_cipher_context');
  return result;
};

// Match the application's authenticated contexts. Unknown encrypted tables
// refuse recovery until their actual context has been declared here.
export function encryptedContext(table, row, column) {
  const company = row.company_id;
  if (table === 'env_companies' && column === 'ein_cipher') return [row.id, 'ein'];
  if (table === 'env_automation_tasks' && column === 'disposition_cipher') return [company, row.policy_id, row.occurrence, row.stage];
  if (column !== 'cipher') fail('archive_cipher_context');
  switch (table) {
    case 'env_private_records': return [company, row.person_id, row.kind];
    case 'env_company_setup': return [company, table, '', version(row.version)];
    case 'env_jurisdictions': return [company, table, row.code, version(row.version)];
    case 'env_workspace_versions': return [company, row.kind, row.object_id, version(row.version)];
    case 'env_notices': return [company, 'notice', row.id];
    case 'env_notice_analysis': return [company, 'analysis', row.id];
    case 'env_notice_replies': return [company, 'reply', row.id, version(row.version)];
    case 'env_verification_consents': return [company, 'verification-consent', row.id];
    case 'env_verification_corrections': return [company, 'verification-correction', row.id];
    case 'env_firm_work': return [company, 'firm-work', row.id];
    case 'env_firm_work_history': return [company, 'firm-work', row.work_id];
    default: fail('archive_cipher_context');
  }
}

export async function archiveRecordKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+\/]{43}=$/.test(value)) fail('archive_record_key_required');
  return crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['decrypt']);
}

export async function decryptArchivedRecord(key, table, row, column) {
  try {
    const cipher = JSON.parse(row[column]);
    if (cipher.v !== 1 || Object.keys(cipher).sort().join(',') !== 'data,iv,v') fail('archive_cipher_invalid');
    const iv = bytes(cipher.iv), data = bytes(cipher.data);
    if (iv.length !== 12 || data.length < 16) fail('archive_cipher_invalid');
    return decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv,
      additionalData: encoder.encode(JSON.stringify(encryptedContext(table, row, column))) }, key, data));
  } catch (error) {
    if (error instanceof PortabilityError) throw error;
    fail('archive_record_key_or_cipher_invalid');
  }
}
