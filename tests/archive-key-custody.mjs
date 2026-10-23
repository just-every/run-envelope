import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writePrivateFile } from '@runeditrun/rer/private-files';

// Generated keys belong only to this disposable native installation. The actual
// terminal door moves a private backup separately from the exported database.
export async function archiveKeyCustody({ source, target, corruptTarget, temporary, run, env, key }) {
  await writePrivateFile(join(source, '.dev.vars'), `ENVELOPE_RECORD_KEY=${key}\n`, true);
  const backup = join(temporary, 'original-record-key.txt');
  const wrongFile = join(temporary, 'unrelated-record-key.txt');
  const invalidFile = join(temporary, 'invalid-record-key.txt');
  const wrongKey = randomBytes(32).toString('base64');
  await writePrivateFile(wrongFile, wrongKey + '\n', true);
  await writePrivateFile(invalidFile, 'synthetic-envelope-1\n', true);
  const invoke = async (directory, verb, file) => {
    const result = await run(process.execPath, [join(directory, 'scripts', 'portability', 'record-key.mjs'),
      verb, verb === 'backup' ? '--output' : '--input', file, '--yes'], directory, env);
    for (const secret of [key, wrongKey]) assert.ok(!result.output.includes(secret), 'terminal output never prints record keys');
    return result;
  };
  assert.equal((await invoke(source, 'backup', backup)).code, 0, 'native terminal exports a separate private record-key backup');
  assert.equal(await readFile(backup, 'utf8'), key + '\n', 'the separate backup retains the original key');
  assert.equal((await lstat(backup)).mode & 0o777, 0o600, 'key backup is owner-only');
  assert.notEqual((await invoke(source, 'backup', backup)).code, 0, 'backup never overwrites an existing recovery key');
  assert.notEqual((await invoke(source, 'backup', join(source, 'record-key.txt'))).code, 0, 'key custody cannot accidentally enter the checkout');
  assert.notEqual((await invoke(target, 'recover', invalidFile)).code, 0, 'an invalid recovery key is refused');
  assert.equal(await lstat(join(target, '.dev.vars')).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error)), null,
    'invalid recovery does not initialize private settings');
  return {
    async wrong() {
      assert.equal((await invoke(target, 'recover', wrongFile)).code, 0, 'an empty installation can receive an independently held key');
    },
    async original() {
      for (const directory of [target, corruptTarget])
        assert.equal((await invoke(directory, 'recover', backup)).code, 0, 'the original key is recovered into native private settings');
    },
    async occupied() {
      const before = await readFile(join(target, '.dev.vars'), 'utf8');
      const result = await invoke(target, 'recover', wrongFile);
      assert.notEqual(result.code, 0, 'record-key recovery refuses to orphan populated business data');
      assert.ok(result.output.includes('record_key_target_not_empty'), 'the populated recovery refusal is explicit');
      assert.equal(await readFile(join(target, '.dev.vars'), 'utf8'), before, 'a populated target keeps its original encryption key');
    },
  };
}
