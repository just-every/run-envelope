import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

// A test-only Worker wrapper pins civil time without adding a product clock door.
export async function newHireClockWorker() {
  const configPath = resolve('dist/server/wrangler.json')
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const target = './' + config.main.replace(/^\.\//, '')
  const entrypoint = join(dirname(configPath), 'new-hire-test-clock.mjs')
  await writeFile(entrypoint, `
import worker from ${JSON.stringify(target)}
export * from ${JSON.stringify(target)}
const SystemDate = Date
let instant = SystemDate.parse('2026-10-27T23:59:30Z')
globalThis.Date = class extends SystemDate {
  constructor(...args) { super(...(args.length ? args : [instant])) }
  static now() { return instant }
}
export default {
  ...worker,
  fetch(request, env, context) {
    const next = request.headers.get('x-synthetic-clock')
    if (next) instant = SystemDate.parse(next)
    return worker.fetch(request, env, context)
  }
}
`)
  return entrypoint
}
