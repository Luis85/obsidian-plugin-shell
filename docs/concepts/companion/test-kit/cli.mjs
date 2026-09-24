/** Run from scripts/test-data after exporting the kit. Default is a read-only plan. */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planFixtures, applyFixtures } from './storage.mjs';
import { startFixtureServer } from './server.mjs';
export async function runTestData(args, { root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), manifestPath = new URL('./manifest.json', import.meta.url) } = {}) {
  const command = args[0] || 'plan';
  if (!['plan', 'apply', 'reset-plan', 'reset', 'serve'].includes(command)) throw new Error('Use plan, apply --approve HASH, reset-plan, reset --approve HASH, or serve.');
  if (args.length > 1 && (!['apply', 'reset'].includes(command) || args.length !== 3 || args[1] !== '--approve' || !/^[a-f0-9]{64}$/.test(args[2]))) throw new Error('Invalid arguments. Apply/reset require the exact plan hash.');
  const text = await readFile(manifestPath, 'utf8');
  if (text.length > 2000000) throw new Error('Test-data manifest exceeds 2 MB.');
  const manifest = JSON.parse(text);
  if (command === 'serve') {
    const server = await startFixtureServer(manifest);
    console.log(JSON.stringify({ mode: 'local-test-only', url: server.url, token: server.token, note: 'Use this session token only for the loopback test adapter; no real credentials.' }, null, 2));
    const stop = () => server.close().catch(e => { console.error(e.message); process.exitCode = 1; });
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    return server;
  }
  const options = { reset: command.startsWith('reset') };
  if (['apply', 'reset'].includes(command)) return applyFixtures(root, manifest, args[2], options);
  const plan = await planFixtures(root, manifest, options);
  return { mode: plan.mode, target: plan.target, approval: plan.approval, blockers: plan.blockers, changes: plan.changes, bytes: plan.bytes, note: 'No data written. Apply/reset revalidate this exact plan and ownership.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runTestData(process.argv.slice(2)).then(result => { if (process.argv[2] !== 'serve') console.log(JSON.stringify(result, null, 2)); }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
