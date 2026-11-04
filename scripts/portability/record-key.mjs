import { realpath } from 'node:fs/promises';
import { localOperation } from '@runeditrun/rer/local/operation';
import { recoverInterrupted } from '@runeditrun/rer/local/recovery';
import { writePrivateFile } from '@runeditrun/rer/private-files';
import { assertEmptyBusinessData, loadRecordKey, saveRecordKey, RecordKeyError } from './record-key-settings.mjs';
import { externalPrivatePath, recoverInput, rememberRecordKeyBackup } from './record-key-custody.mjs';

function argumentsFor(argv) {
  if (argv[0] === '--') argv = argv.slice(1);
  const [action, flag, path, yes, ...extra] = argv;
  if (!['backup', 'recover'].includes(action) || flag !== (action === 'backup' ? '--output' : '--input') || !path || path.startsWith('--') || yes !== '--yes' || extra.length)
    throw new RecordKeyError('record_key_usage');
  return { action, path };
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
      await rememberRecordKeyBackup(root, path, key);
      process.stdout.write('Record key backup saved to the private external file.\n');
    } else {
      const key = await recoverInput(path);
      await assertEmptyBusinessData(root);
      await saveRecordKey(root, key);
      await rememberRecordKeyBackup(root, path, key);
      process.stdout.write('Original record key recovered into this empty target.\n');
    }
  } finally { await operation.release(); }
}
try { await main(); }
catch (error) {
  const code = error instanceof RecordKeyError ? error.code : error?.code === 'EEXIST' ? 'record_key_output_exists' : error?.code === 'LOCAL_OPERATION_BUSY' ? 'record_key_operation_busy' : 'record_key_operation_refused';
  const message = code === 'record_key_usage'
    ? 'Usage: rer run record-key -- backup --output PATH --yes, or rer run record-key -- recover --input PATH --yes.'
    : `Record key operation refused (${code}).`;
  process.stderr.write(message + '\n');
  process.exitCode = code === 'record_key_usage' ? 2 : 1;
}
