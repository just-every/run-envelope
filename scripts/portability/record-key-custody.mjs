import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { privateDirectory, writePrivateFile } from '@runeditrun/rer/private-files';
import { canonicalRecordKey, loadRecordKey, RecordKeyError } from './record-key-settings.mjs';

export async function externalPrivatePath(root, input) {
  const requested = resolve(root, input), parent = await realpath(dirname(requested)), path = join(parent, basename(requested));
  const within = relative(root, path);
  if (!within || (within !== '..' && !within.startsWith('..' + sep))) throw new RecordKeyError('record_key_external_file_required');
  await privateParent(parent);
  return path;
}

async function privateParent(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const status = await handle.stat();
    if (!status.isDirectory() || (status.mode & 0o7777) !== 0o700 || (process.getuid && status.uid !== process.getuid())) throw new RecordKeyError('record_key_private_parent_required');
  } finally { await handle.close(); }
}

// Unlike a settings writer, reset's preflight must never repair permissions.
async function readOwnedPrivate(path, limit) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const status = await handle.stat();
    if (!status.isFile() || status.nlink !== 1 || (status.mode & 0o7777) !== 0o600 || status.size > limit || (process.getuid && status.uid !== process.getuid())) throw new RecordKeyError('record_key_private_file_required');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}

export async function recoverInput(path) {
  return canonicalRecordKey((await readOwnedPrivate(path, 128)).replace(/\r?\n$/, ''));
}

// This receipt contains only the independently held file's location, never its
// key. Reset reopens that file and compares it to the current private setting.
const receiptName = 'record-key-backup.json';
export async function rememberRecordKeyBackup(root, path, key) {
  if (await recoverInput(await externalPrivatePath(root, path)) !== key) throw new RecordKeyError('record_key_backup_mismatch');
  const directory = await privateDirectory(root, ['.rer', 'local']);
  await writePrivateFile(join(directory, receiptName), JSON.stringify({ version: 1, path }) + '\n');
}

export async function recordKeyResetPreflight({ root }) {
  // A pristine checkout has no key or data to lose. Any installation inventory
  // requires custody proof, including state whose private settings are missing.
  const paths = ['.dev.vars', '.dev.vars.previous', '.wrangler/state', '.seed/installer'];
  const present = await Promise.all(paths.map(path => lstat(join(root, path)).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  })));
  if (present.every(status => status === null)) return;
  try {
    // Validate before loadRecordKey so the native reader has no mode to repair.
    await readOwnedPrivate(join(root, '.dev.vars'), 1024 * 1024);
    const key = await loadRecordKey(root);
    await privateParent(join(root, '.rer'));
    await privateParent(join(root, '.rer', 'local'));
    const receipt = JSON.parse(await readOwnedPrivate(join(root, '.rer', 'local', receiptName), 4096));
    if (receipt.version !== 1 || typeof receipt.path !== 'string') throw new RecordKeyError('record_key_backup_required');
    const path = await externalPrivatePath(root, receipt.path);
    if (await recoverInput(path) !== key) throw new RecordKeyError('record_key_backup_mismatch');
  } catch {
    throw new RecordKeyError('record_key_backup_required: keep the original key in a private external file with rer run record-key -- backup --output PATH --yes before reset. Keep that file available; see docs/archive-recovery.md.');
  }
}
