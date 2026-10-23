import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { canonicalJson, makePart } from '@runeditrun/rer/modules/portability';
import { ArchiveVerifier, ContentVerifier } from '@runeditrun/rer/modules/portability/format';
import { fileRecords } from '@runeditrun/rer/modules/portability/files';

// An archive can be internally checksummed yet contain a broken business
// relationship. Exercise the actual import boundary with that distinct failure.
export async function unrelatedPersonArchive(records, destination) {
  const changed = structuredClone(records);
  const row = changed.flatMap(record => record.items ?? []).find(item => item.table === 'env_private_records');
  assert.ok(row, 'native private-record fixture is present');
  row.row.person_id = 'synthetic-envelope-missing-person';
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
