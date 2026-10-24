import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {deploymentSpec} from './delivery/base/spec.mjs';

const config = JSON.parse(await readFile(new URL('../packaging.json', import.meta.url), 'utf8'));
const spec = await deploymentSpec(process.cwd(), config.artifact.specInputs);
const path = new URL('../management/integration/deployment-spec.json', import.meta.url);
const bytes = JSON.stringify(spec, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (await readFile(path, 'utf8') !== bytes) throw Error('Stale deployment specification; run pnpm delivery:spec after building.');
  console.log('Deployment specification is current.');
} else {
  await mkdir(new URL('.', path), {recursive: true});
  await writeFile(path, bytes);
  console.log('Wrote deployment specification.');
}
