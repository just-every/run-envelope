import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canonicalJson, makePart } from '@runeditrun/rer/modules/portability'
import { ArchiveVerifier, ContentVerifier } from '@runeditrun/rer/modules/portability/format'

const hash = value => createHash('sha256').update(value).digest('hex')
export async function archiveEditions(records, source, destination) {
  const manifest = records.find(record => record.kind === 'manifest')
  const descriptor = manifest.payloads.find(payload => payload.name === 'envelope-source-editions')
  assert.ok(descriptor, 'the native archive packages its implemented source editions')
  const items = records.flatMap(record => record.items ?? []).filter(item => item.kind === 'payload' && item.name === descriptor.name)
  const bytes = Buffer.concat(items.map(item => Buffer.from(item.data, 'base64')))
  assert.equal(hash(bytes), descriptor.sha256, 'the archived edition bytes match the transport digest')
  const edition = JSON.parse(bytes)
  assert.ok(edition.files.some(file => file.path.endsWith('nj-withholding.ts')), 'the implemented withholding source is retained')
  assert.ok(edition.files.some(file => file.path.endsWith('.sql')), 'the applied schema source is retained')
  for (const file of edition.files) {
    const original = await readFile(join(source, file.path))
    assert.deepEqual(Buffer.from(file.contentBase64, 'base64'), original, 'retained source bytes match the source installation')
    assert.equal(file.sha256, hash(original), 'each retained source has its own digest')
  }
  const changed = structuredClone(records)
  edition.files[0].contentBase64 = (edition.files[0].contentBase64.startsWith('A') ? 'B' : 'A') + edition.files[0].contentBase64.slice(1)
  const damaged = Buffer.from(JSON.stringify(edition))
  const altered = changed.find(record => record.kind === 'manifest')
  Object.assign(altered.payloads.find(payload => payload.name === descriptor.name), { size: damaged.length, sha256: hash(damaged) })
  const payloadItems = changed.flatMap(record => record.items ?? []).filter(item => item.kind === 'payload' && item.name === descriptor.name)
  let offset = 0
  for (const [index, item] of payloadItems.entries()) {
    const size = index === payloadItems.length - 1 ? damaged.length - offset : Buffer.from(item.data, 'base64').length
    item.offset = offset
    item.data = damaged.subarray(offset, offset + size).toString('base64')
    offset += size
  }
  const content = new ContentVerifier(altered), archive = new ArchiveVerifier(altered), parts = []
  for (const old of changed.filter(record => record.kind === 'part')) {
    const part = await makePart(old.index, old.items)
    for (const item of part.items) content.add(item)
    archive.add(part); parts.push(part)
  }
  await writeFile(destination, [altered, ...parts, { kind: 'closing', partCount: parts.length,
    contentHash: content.digest(), archiveHash: archive.digest() }].map(canonicalJson).join('\n') + '\n', { mode: 0o600 })
  return { descriptor, bytes }
}
