/** Adapter to the installed shell API. The shell owns parsing, plans, writes and processes. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { noLinks, readBytes, readJson } from './io.mjs';

export async function framework(directory) {
  const root = noLinks(directory);
  readBytes(path.join(root, 'shell.mjs'));
  const compiled = path.join(root, '.framework/compiled');
  const distribution = fs.existsSync(path.join(compiled, 'scripts/framework/operations.js'));
  const moduleRoot = distribution ? compiled : root;
  const extension = distribution ? 'js' : 'ts';
  const load = name => import(pathToFileURL(noLinks(path.join(moduleRoot, `scripts/framework/${name}.${extension}`))).href);
  const [operations, catalog, processes, contracts] = await Promise.all([
    load('operations'), load('catalog'), load('process'), load('contracts'),
  ]);
  return { root, distribution: distribution ? 'compiled-kit' : 'source',
    context: { root, frameworkRoot: root, progress: text => process.stderr.write(text) },
    ...operations, ...catalog, ...processes, ...contracts };
}

const forbidden = new Set(['framework pack', 'framework upgrade', 'plugin install', 'dev']);
/** Added safety for design work; never broadens the shell's permissions or invents a plan. */
export function checkPrototypeAuthority(request, descriptor, execute) {
  const { command, args, options } = request;
  if (command.startsWith('release ') || forbidden.has(command)) throw new Error('PROTOTYPE_SCOPE: use the separately approved native/release workflow');
  if (['native', 'obsidian'].includes(options.profile)) throw new Error('PROTOTYPE_SCOPE: native acceptance is a separate explicit workflow');
  for (const key of ['root', 'trust-custom', 'install', 'authorize']) {
    if (Object.hasOwn(options, key)) throw new Error(`PROTOTYPE_OPTION: --${key} is not allowed through this adapter`);
  }
  if (options.input === '-') throw new Error('PROTOTYPE_INPUT: save reviewed JSON to a file first');
  if (options.yes && command !== 'install') throw new Error('PROTOTYPE_APPROVAL: use the exact --apply hash, not --yes');
  if ((options.apply || options['plan-out'] || options.yes) && !execute) throw new Error('PROTOTYPE_APPROVAL: --execute is required for writes');
  const fixtureWrite = ['data apply', 'data reset'].includes(command);
  const planWrite = command === 'plan apply' || fixtureWrite;
  if (planWrite && (!execute || !options.apply)) throw new Error('PROTOTYPE_APPROVAL: explicit execution and the reviewed hash are required');
  const discovery = options.help || command === 'help' || (command === 'make' && (!args.length || options.list || ['list', 'describe'].includes(args[0])));
  const process = !discovery && (descriptor.effect === 'process' || command === 'check');
  return process && !execute ? { ...request, options: { ...options, 'dry-run': true } } : request;
}

export async function shellOperation(directory, argv, { execute = false, signal } = {}) {
  const api = await framework(directory);
  const parsed = api.parseCliArguments(argv);
  // Match shell.mjs terminal path semantics without changing process-global cwd.
  if (parsed.command === 'new') {
    if (parsed.args[0]) parsed.args[0] = path.resolve(parsed.args[0]);
    if (typeof parsed.options.from === 'string') parsed.options.from = path.resolve(parsed.options.from);
  }
  const request = checkPrototypeAuthority(parsed, api.descriptor(parsed.command), execute);
  if (request.command === 'plan inspect' || request.command === 'plan apply') {
    if (!request.args[0]) throw new Error('PROTOTYPE_PLAN: saved plan filename required');
    // Preflight the stored request's scope; the shell still validates canonical form,
    // root, source/target freshness and exact approvals when it reconstructs the plan.
    const saved = readJson(path.resolve(api.root, request.args[0]), 1_048_576);
    const nested = api.validateRequest(saved.request);
    if (nested.command.startsWith('plan ')) throw new Error('PROTOTYPE_PLAN: nested saved plans are not supported');
    checkPrototypeAuthority(nested, api.descriptor(nested.command), false);
  }
  return api.executeOperation(request, { ...api.context, signal });
}

export const qualityScripts = Object.freeze([
  'typecheck', 'typecheck:project', 'typecheck:generator', 'typecheck:framework', 'lint',
  'check:architecture', 'check:presentation', 'check:source', 'check:tokens',
  'check:artifacts', 'check:maintainability', 'check:analyzer', 'check:test-quality',
  'check:repository', 'check:dependencies', 'events:check', 'entities:check',
  'test:coverage', 'test:coverage:production', 'test:ui-effects', 'testdata:check',
  'test:generator', 'test:visual', 'test:makers', 'test:prototypes', 'test:prototypes:python',
  'test:companion', 'test:companion:browser', 'harness:build',
]);

export async function npmOperation(directory, name, { execute = false, signal } = {}) {
  const api = await framework(directory);
  const scripts = readJson(path.join(api.root, 'package.json')).scripts ?? {};
  if (!qualityScripts.includes(name) || typeof scripts[name] !== 'string') throw new Error(`PROTOTYPE_SCRIPT: unavailable or unapproved script ${name}`);
  if (!execute) return api.result('prototype npm', { script: name, implementation: scripts[name], execution: 'not-run', requires: '--execute' }, 'planned');
  try {
    const execution = await api.runNode({ ...api.context, signal }, await api.npmEntry(), ['run', name], 600000);
    if (execution.truncated) throw new Error('PROTOTYPE_OUTPUT_LIMIT: no verification claim from truncated process output');
    return api.result('prototype npm', { script: name, execution, productAcceptance: 'not-inferred' });
  } catch (error) { return api.failure('prototype npm', error); }
}

export async function discoverTooling(directory) {
  const api = await framework(directory);
  const result = await api.executeOperation({ command: 'capabilities', args: [], options: {} }, api.context);
  if (result.status !== 'ok') return result;
  const pkg = readJson(path.join(api.root, 'package.json'));
  return { ...result, command: 'prototype discover', data: { ...result.data,
    distribution: api.distribution, profiles: api.profiles, packageManager: pkg.packageManager,
    node: { actual: process.version, required: pkg.engines?.node ?? null },
    scripts: Object.fromEntries(qualityScripts.filter(key => pkg.scripts?.[key]).map(key => [key, pkg.scripts[key]])),
    adapterPolicy: 'Read/plan by default; --execute for processes, plus exact --apply for planned writes. Native/release work is separate.',
  } };
}
