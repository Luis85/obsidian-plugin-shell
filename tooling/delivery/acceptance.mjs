/**
 * Acceptance criterion test stubs for one Increment.
 *
 *   node tooling/delivery/acceptance.mjs stubs --increment <id|docs/increments/<id>.md> [--write] [--json]
 *
 * Without --write it lists the stubs it would create (a dry run). --write creates them from
 * configs/delivery/acceptance-stub.template.md, never overwriting a file, and sets an empty `Evidence:` of each
 * criterion to its stub. Stubs of criteria that no longer exist are reported as orphans and never deleted.
 * Exit codes: 0 done, 1 the increment does not exist, 2 usage or configuration error.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/cli/tooling/delivery/config.mjs';
import { readyRules } from '../../src/cli/tooling/delivery/rules-ready.mjs';
import { parseHandoff } from '../../src/cli/tooling/delivery/handoff.mjs';
import { incrementAt } from '../../src/cli/tooling/delivery/documents.mjs';
import { planStubs } from '../../src/cli/tooling/delivery/acceptance-stubs.mjs';
import { repositoryFiles } from '../../src/cli/tooling/delivery/repository.mjs';

const usage = `node tooling/delivery/acceptance.mjs stubs --increment <id|path> [--write] [--json]
Lists (or with --write creates) one pending acceptance test stub per criterion of the Increment; never overwrites.`;
const failure = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });

export function parseAcceptanceArguments(args) {
  const [command, ...rest] = args;
  if (!command || command === '--help') return { help: true };
  if (command !== 'stubs') throw failure('ACCEPTANCE_USAGE', `unknown command ${command}`);
  const options = {};
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (['--write', '--json'].includes(flag)) { options[flag.slice(2)] = true; continue; }
    if (flag !== '--increment') throw failure('ACCEPTANCE_USAGE', `unknown argument ${flag}`);
    const value = rest[++index];
    if (!value || value.startsWith('--')) throw failure('ACCEPTANCE_USAGE', '--increment needs a value');
    if (options.increment) throw failure('ACCEPTANCE_USAGE', 'duplicate --increment');
    options.increment = value;
  }
  if (!options.increment) throw failure('ACCEPTANCE_USAGE', 'stubs needs --increment <id>');
  return options;
}

/** Plans and (with --write) creates the stubs; returns { increment, created, planned, existing, orphans, evidence, written }. */
export async function acceptanceStubs(root, args, { files = repositoryFiles } = {}) {
  const options = parseAcceptanceArguments(args);
  if (options.help) return { help: usage };
  const { delivery } = await loadConfig(root, 'ready', readyRules);
  const listed = files(root);
  const increment = incrementAt(delivery, listed, () => null, options.increment);
  if (!increment.exists) throw failure('ACCEPTANCE_INCREMENT_MISSING', `${increment.path ?? options.increment} is not an Increment of ${delivery.handoff.glob}`);
  const text = await readFile(join(root, increment.path), 'utf8');
  const template = await readFile(join(root, delivery.acceptance.template), 'utf8').catch(() => { throw failure('DELIVERY_CONFIG_INVALID', `${delivery.acceptance.template} cannot be read`); });
  const plan = planStubs(delivery.acceptance, { incrementId: increment.id, incrementPath: increment.path, incrementText: text, model: parseHandoff(text), files: listed, template });
  const written = [];
  if (options.write) {
    for (const stub of plan.create) {
      await mkdir(dirname(join(root, stub.path)), { recursive: true });
      await writeFile(join(root, stub.path), stub.text, { flag: 'wx' }); written.push(stub.path);
    }
    if (plan.incrementText !== text) { await writeFile(join(root, increment.path), plan.incrementText); written.push(increment.path); }
  }
  return { increment: increment.path, planned: plan.create.map(stub => stub.path), existing: plan.existing, orphans: plan.orphans, evidence: plan.evidence, written, json: Boolean(options.json) };
}

function print(result) {
  const lines = [`Acceptance stubs for ${result.increment}:`];
  for (const path of result.planned) lines.push(`  ${result.written.includes(path) ? 'created' : 'would create'} ${path}`);
  for (const path of result.existing) lines.push(`  kept ${path}`);
  for (const path of result.orphans) lines.push(`  warning: orphan stub ${path} matches no acceptance criterion; delete or rename it`);
  if (result.evidence.length) lines.push(`  ${result.written.includes(result.increment) ? 'set' : 'would set'} Evidence of ${result.evidence.join(', ')} to the stub`);
  if (!result.written.length && (result.planned.length || result.evidence.length)) lines.push('Dry run: add --write to create them.');
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await acceptanceStubs(process.cwd(), process.argv.slice(2));
    if (result.help) console.log(result.help);
    else console.log(result.json ? JSON.stringify({ protocolVersion: 1, ...result, json: undefined }, null, 2) : print(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.code === 'ACCEPTANCE_INCREMENT_MISSING' ? 1 : ['ACCEPTANCE_USAGE', 'DELIVERY_CONFIG_INVALID'].includes(error.code) ? 2 : 1;
  }
}
