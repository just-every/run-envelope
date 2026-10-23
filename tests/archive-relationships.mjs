import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { canonicalJson, makePart } from '@runeditrun/rer/modules/portability';
import { ArchiveVerifier, ContentVerifier } from '@runeditrun/rer/modules/portability/format';
import { fileRecords } from '@runeditrun/rer/modules/portability/files';
import { encryptedContext } from '../scripts/portability/encryption.mjs';

// An archive can be internally checksummed yet contain a broken business
// relationship. Exercise the actual import boundary with that distinct failure.
export async function unrelatedPersonArchive(records, destination) {
  const changed = structuredClone(records);
  const row = changed.flatMap(record => record.items ?? []).find(item => item.table === 'env_private_records');
  assert.ok(row, 'native private-record fixture is present');
  row.row.person_id = 'synthetic-envelope-missing-person';
  await rewrittenArchive(changed, destination);
}

export async function rewrittenArchive(changed, destination) {
  const manifest = changed.find(record => record.kind === 'manifest');
  const content = new ContentVerifier(manifest), archive = new ArchiveVerifier(manifest);
  const parts = [];
  for (const old of changed.filter(record => record.kind === 'part')) {
    const part = await makePart(old.index, old.items);
    for (const item of part.items) content.add(item);
    archive.add(part); parts.push(part);
  }
  const closing = { kind: 'closing', partCount: parts.length, contentHash: content.digest(), archiveHash: archive.digest() };
  await writeFile(destination, [manifest, ...parts, closing].map(canonicalJson).join('\n') + '\n', { mode: 0o600 });
  let count = 0;
  for await (const record of fileRecords(destination)) count++;
  assert.equal(count, changed.length, 'the altered archive passes native format and complete checksum validation');
}

// The encrypted bytes authenticate successfully; only the business link is wrong.
export async function unrelatedCorrectionArchive(records, destination, recordKey, correctionId) {
  const changed = structuredClone(records);
  const item = changed.flatMap(record => record.items ?? []).find(item =>
    item.table === 'env_workspace_versions' && item.row.kind === 'industry-check' && item.row.object_id === correctionId);
  assert.ok(item, 'a native reviewed correction exists before altering the archive');
  const row = item.row, key = await crypto.subtle.importKey('raw', Buffer.from(recordKey, 'base64'), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const cipher = JSON.parse(row.cipher), encoder = new TextEncoder();
  const additionalData = encoder.encode(JSON.stringify(encryptedContext(item.table, row, 'cipher')));
  const data = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM',
    iv: Buffer.from(cipher.iv, 'base64'), additionalData }, key, Buffer.from(cipher.data, 'base64'))));
  data.corrects = 'synthetic-envelope-899999';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, encoder.encode(JSON.stringify(data)));
  row.cipher = JSON.stringify({ v: 1, iv: Buffer.from(iv).toString('base64'), data: Buffer.from(sealed).toString('base64') });
  await rewrittenArchive(changed, destination);
}
