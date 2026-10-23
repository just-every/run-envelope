import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PortabilityError } from '@runeditrun/rer/modules/portability';

const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const limit = 64 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const refuse = () => { throw new PortabilityError('archive_source_editions_invalid', 409); };
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const safePath = path => typeof path === 'string'
  && /^(?:migrations\/core\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.sql|src\/envelope\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.tsx?)$/.test(path);

async function directory(path, create = false) {
  if (create) try { await mkdir(path, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const status = await lstat(path);
  if (!status.isDirectory() || status.isSymbolicLink() || await realpath(path) !== path) refuse();
  return status;
}
async function sourceFiles(path, suffix) {
  await directory(join(root, path));
  const records = [];
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const relative = path + '/' + entry.name;
    if (entry.isSymbolicLink()) refuse();
    if (entry.isDirectory()) records.push(...await sourceFiles(relative, suffix));
    else if (suffix.test(entry.name)) {
      if (!safePath(relative)) refuse();
      const handle = await open(join(root, relative), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const status = await handle.stat();
        if (!status.isFile() || status.nlink !== 1 || status.size > limit) refuse();
        const bytes = await handle.readFile();
        records.push({ path: relative, sha256: digest(bytes), contentBase64: bytes.toString('base64') });
      } finally { await handle.close(); }
    }
  }
  return records;
}
async function produce() {
  const files = [...await sourceFiles('migrations/core', /\.sql$/), ...await sourceFiles('src/envelope', /\.tsx?$/)]
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const bytes = Buffer.from(JSON.stringify({ version: 1, files }));
  if (bytes.length > limit) refuse();
  verify(bytes);
  return bytes;
}
function verify(bytes) {
  let payload;
  try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { refuse(); }
  if (!keys(payload, ['version', 'files']) || payload.version !== 1 || !Array.isArray(payload.files)
    || !bytes.equals(Buffer.from(JSON.stringify(payload)))) refuse();
  let previous = '';
  for (const record of payload.files) {
    if (!keys(record, ['path', 'sha256', 'contentBase64']) || !safePath(record.path) || record.path <= previous
      || typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)
      || typeof record.contentBase64 !== 'string') refuse();
    const content = Buffer.from(record.contentBase64, 'base64');
    if (content.toString('base64') !== record.contentBase64 || digest(content) !== record.sha256) refuse();
    previous = record.path;
  }
  if (!payload.files.some(record => record.path.startsWith('migrations/core/'))
    || !payload.files.some(record => record.path.startsWith('src/envelope/'))) refuse();
}
async function retained(path, bytes) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const status = await handle.stat();
    if (!status.isFile() || status.nlink !== 1 || (status.mode & 0o7777) !== 0o600
      || status.size !== bytes.length || !(await handle.readFile()).equals(bytes)) refuse();
  } finally { await handle.close(); }
}
async function consume(stream, descriptor) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > limit) refuse();
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks), sha256 = digest(bytes);
  if (descriptor?.name !== 'envelope-source-editions' || descriptor.size !== size || descriptor.sha256 !== sha256) refuse();
  verify(bytes); // Validate every historical record before creating any directory.
  const privateRoot = join(root, '.rer'), target = join(privateRoot, 'archive-editions');
  await directory(privateRoot, true);
  const status = await directory(target, true);
  if ((status.mode & 0o7777) !== 0o700 || (process.getuid && status.uid !== process.getuid())) refuse();
  const path = join(target, sha256 + '.json'), temporary = join(target, randomUUID() + '.tmp');
  const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    await handle.writeFile(bytes); await handle.sync(); await handle.close();
    await directory(privateRoot); await directory(target);
    // Linking publishes a complete file atomically without replacing an existing entry.
    try { await link(temporary, path); }
    catch (error) { if (error.code !== 'EEXIST') throw error; await retained(path, bytes); }
  } finally { await handle.close(); await unlink(temporary); }
}

// Historical source remains a private JSON document; no recorded path is extracted.
export const sourceEditionPayload = { produce, consume };
