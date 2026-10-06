#!/usr/bin/env node
/** One entrypoint; source kits use the same native TypeScript launch as bin/app. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { args, need, isMain } from './lib/io.mjs';
import { discoverTooling, shellOperation, npmOperation } from './lib/framework.mjs';

const usage = `Usage: npm run prototype:tools -- <operation> [options] [-- shell arguments]
  discover --repo <trusted-shell>             Live commands, makers, profiles and quality scripts
  shell --repo <trusted-shell> [--execute] -- <shell command and arguments>
  npm --repo <trusted-project> --script <quality-script> [--execute]
  new --repo <trusted-shell> --out <new-workspace> (--input <project.json> | --starter <id>)
      [--id <plugin-id>] [--name <name>] [--author <author>] [--execute --apply <hash>]
  build --repo <source> --entry <harness/prototype/main.ts> --project <project.json>
      --out <new.html> --title <title> --execute [--replace]
  save --repo <trusted-checkout> --package <delivery> --slug <concept-name>
      [--execute --apply <hash>]
  validate --repo <trusted-shell> --input <project.json>
  browser --root <delivery>                  Explicit offline browser execution
  offline --html <prototype.html>
  diff --before <baseline.json> --after <project.json>
  pack --root <delivery> --output <new.zip> --execute
Plans, fixture approvals and generated-file ownership remain the shell's responsibility.
No automatic install, native host, Git operation, publication or live companion import.`;

const delegates = { validate: 'validate-project.mjs', browser: 'verify-browser.mjs',
  offline: 'check-offline.mjs', diff: 'diff-project.mjs' };
function delegated(file, argv) {
  const outcome = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url)), ...argv], { stdio: 'inherit', windowsHide: true, timeout: 600000 });
  if (outcome.error) throw outcome.error;
  return outcome.status ?? 1;
}
function display(result) {
  console.log(JSON.stringify(result, null, 2));
  return ['failed', 'blocked', 'cancelled'].includes(result.status) ? 1 : 0;
}
export async function main(argv, { signal } = {}) {
  const [operation, ...rest] = argv;
  if (!operation || operation === '--help' || operation === 'help') { console.log(usage); return 0; }
  if (Object.hasOwn(delegates, operation)) return delegated(delegates[operation], rest);
  const divider = rest.indexOf('--');
  const flags = divider < 0 ? rest : rest.slice(0, divider);
  const tail = divider < 0 ? [] : rest.slice(divider + 1);
  const schemas = {
    discover: [['--repo'], []], shell: [['--repo'], ['--execute']],
    npm: [['--repo', '--script'], ['--execute']],
    new: [['--repo', '--out', '--input', '--starter', '--id', '--name', '--author', '--apply'], ['--execute']],
    build: [['--repo', '--entry', '--project', '--out', '--title'], ['--execute', '--replace']],
    save: [['--repo', '--package', '--slug', '--apply'], ['--execute']],
    pack: [['--root', '--output'], ['--execute']],
  };
  if (!Object.hasOwn(schemas, operation)) throw new Error(`PROTOTYPE_OPERATION: unknown operation ${operation}`);
  const [values, switches] = schemas[operation];
  const options = args(flags, values, switches);
  if (operation !== 'shell' && tail.length) throw new Error('PROTOTYPE_ARGUMENTS: only shell accepts trailing arguments');
  const settings = { execute: Boolean(options.execute), signal };
  if (operation === 'discover') return display(await discoverTooling(need(options, 'repo')));
  if (operation === 'shell') {
    if (!tail.length) throw new Error('PROTOTYPE_ARGUMENTS: supply a shell command after --');
    return display(await shellOperation(need(options, 'repo'), tail, settings));
  }
  if (operation === 'npm') return display(await npmOperation(need(options, 'repo'), need(options, 'script'), settings));
  if (operation === 'new') {
    if (Boolean(options.input) === Boolean(options.starter)) throw new Error('PROTOTYPE_INPUT: choose exactly one of --input or --starter');
    const command = ['new', need(options, 'out'), options.input ? '--from' : '--starter', options.input ?? options.starter];
    for (const key of ['id', 'name', 'author', 'apply']) if (options[key]) command.push('--' + key, options[key]);
    return display(await shellOperation(need(options, 'repo'), command, settings));
  }
  if (operation === 'build') {
    if (!options.execute) throw new Error('PROTOTYPE_APPROVAL: building executes trusted source; supply --execute');
    const { buildPrototype } = await import('./build-prototype.mjs');
    return display(await buildPrototype({ repo: need(options, 'repo'), entry: need(options, 'entry'),
      project: need(options, 'project'), out: need(options, 'out'), title: need(options, 'title'), replace: Boolean(options.replace), signal }));
  }
  if (operation === 'save') {
    const { saveConcept } = await import('./save-concept.mjs');
    return display(await saveConcept(need(options, 'repo'), need(options, 'package'), need(options, 'slug'), { ...settings, apply: options.apply }));
  }
  if (operation === 'pack') {
    if (!options.execute) throw new Error('PROTOTYPE_APPROVAL: ZIP creation requires --execute');
    const child = spawnSync(process.env.PYTHON || 'python3', ['-B', fileURLToPath(new URL('pack-concept.py', import.meta.url)),
      '--root', need(options, 'root'), '--output', need(options, 'output')], { stdio: 'inherit', windowsHide: true, timeout: 600000 });
    if (child.error) throw child.error;
    return child.status ?? 1;
  }
  throw new Error(`PROTOTYPE_OPERATION: unknown operation ${operation}`);
}
if (isMain(import.meta.url)) {
  if (!process.features.typescript && !process.execArgv.includes('--experimental-strip-types')) {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
    if (child.error) { console.error(child.error.message); process.exitCode = 1; } else process.exitCode = child.status ?? 1;
  } else {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    try { process.exitCode = await main(process.argv.slice(2), { signal: controller.signal }); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = controller.signal.aborted ? 130 : 1; }
    finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
  }
}
