import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { localOperation } from '@runeditrun/rer/local/operation';
import { recoverInterrupted } from '@runeditrun/rer/local/recovery';
import { readPrivateFile, writePrivateFile } from '@runeditrun/rer/private-files';
import { assertEmptyBusinessData, canonicalRecordKey, loadRecordKey, saveRecordKey, RecordKeyError } from './record-key-settings.mjs';

function argumentsFor(argv) {
  const [action, flag, path, yes, ...extra] = argv;
  if (!['backup', 'recover'].includes(action) || flag !== (action === 'backup' ? '--output' : '--input') || !path || path.startsWith('--') || yes !== '--yes' || extra.length)
    throw new RecordKeyError('record_key_usage');
  return { action, path };
}
async function externalPrivatePath(root, input) {
  const requested = resolve(root, input), parent = await realpath(dirname(requested)), path = join(parent, basename(requested));
  const within = relative(root, path);
  if (!within || (within !== '..' && !within.startsWith('..' + sep))) throw new RecordKeyError('record_key_external_file_required');
  const handle = await open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const status = await handle.stat();
    if (!status.isDirectory() || (status.mode & 0o7777) !== 0o700 || (process.getuid && status.uid !== process.getuid())) throw new RecordKeyError('record_key_private_parent_required');
  } finally { await handle.close(); }
  return path;
}
async function recoverInput(path) {
  const status = await lstat(path);
  if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1 || (status.mode & 0o7777) !== 0o600 || status.size > 128 || (process.getuid && status.uid !== process.getuid())) throw new RecordKeyError('record_key_private_file_required');
  const value = await readPrivateFile(path);
  return canonicalRecordKey(value.replace(/\r?\n$/, ''));
}
async function main() {
  const options = argumentsFor(process.argv.slice(2)), root = await realpath(process.cwd());
  const path = await externalPrivatePath(root, options.path);
  const operation = await localOperation(root);
  try {
    await recoverInterrupted(root, operation);
    if (options.action === 'backup') {
      const key = await loadRecordKey(root);
      await writePrivateFile(path, key + '\n', true);
      process.stdout.write('Record key backup saved to the private external file.\n');
    } else {
      const key = await recoverInput(path);
      await assertEmptyBusinessData(root);
      await saveRecordKey(root, key);
      process.stdout.write('Original record key recovered into this empty target.\n');
    }
  } finally { await operation.release(); }
}
try { await main(); }
catch (error) {
  const code = error instanceof RecordKeyError ? error.code : error?.code === 'EEXIST' ? 'record_key_output_exists' : error?.code === 'LOCAL_OPERATION_BUSY' ? 'record_key_operation_busy' : 'record_key_operation_refused';
  const message = code === 'record_key_usage'
    ? 'Usage: node ./scripts/portability/record-key.mjs backup --output PATH --yes, or recover --input PATH --yes.'
    : `Record key operation refused (${code}).`;
  process.stderr.write(message + '\n');
  process.exitCode = code === 'record_key_usage' ? 2 : 1;
}
