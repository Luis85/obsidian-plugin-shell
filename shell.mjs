#!/usr/bin/env node
// Source launcher only. Release kits include TypeScript-compiled modules before installation.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
let compiled = join(root, '.framework/compiled/scripts/framework/cli.js');
let args = process.argv.slice(2);
if (args[0] === 'make' && args[1] === 'project') args = ['new', ...args.slice(2)];
if (args[0] === 'make' && args[1] === 'prototype') args = ['prototype', ...args.slice(2)];
// Keep `help new` on the original catalog; `new --help` describes the project-starter maker.
if (args[0] === 'help' && ['sketch', 'prototype', 'studio', 'settings', 'project-setup', 'first-run', 'brainstorm'].includes(args[1])) args = [args[1], '--help', ...args.slice(2)];
// `new <dir> --starter <id>` creates from file/Companion starters; `new [--starter <id>]` without a directory runs project starters.
const directoryFlags = ['--from', '--list', '--id', '--name', '--author', '--extension', '--extensions', '--install', '--inside-vault', '--storybook', '--storybook-stories', '--airship', '--no-airship', '--yes', '--dry-run', '--plan-out', '--timeout', '--values', '--answers', '--run', '--trust-processes'];
const legacyNew = args[0] === 'new' && ((args[1] && !args[1].startsWith('--') && !['starters', 'guide', 'validate'].includes(args[1])) || args.slice(1).some(arg => directoryFlags.includes(arg)));
let maker = !args.length || (args[0] === 'new' && !legacyNew) || ['studio', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run', 'brainstorm', '--ui', '--no-color'].includes(args[0]);
const memory = args[0] === 'memory' || (args[0] === 'help' && args[1] === 'memory');
const typescriptEnabled = () => Boolean(process.features.typescript || process.execArgv.includes('--experimental-strip-types'));
async function moduleFrom(compiledPath, sourcePath) {
  if (existsSync(compiledPath)) return import(pathToFileURL(compiledPath).href);
  if (typescriptEnabled()) return import(sourcePath);
  return null;
}
async function frameworkCommandRoots() {
  const module = await moduleFrom(join(root, '.framework/compiled/scripts/framework/catalog.js'), './scripts/framework/catalog.ts');
  return new Set((module?.commands ?? []).map(command => String(command.id).split(' ')[0]));
}
async function registeredPluginCommandIds() {
  const module = await moduleFrom(join(root, '.framework/compiled/plugins/runtime.js'), './plugins/runtime.ts');
  return new Set((module?.pluginCliCommands?.() ?? []).map(command => command.id));
}
try {
  if (!memory && !maker && args[0]) {
    const frameworkRoots = await frameworkCommandRoots();
    if (!frameworkRoots.has(args[0])) maker = (await registeredPluginCommandIds()).has(args[0]);
  }
  if (maker) compiled = join(root, '.framework/compiled/bin/shell.js');
  if (memory && typescriptEnabled()) {
    process.exitCode = await (await import('./scripts/hindsight/cli.ts')).main(args[0] === 'help' ? ['--help', ...args.slice(2)] : args.slice(1));
  } else if (!memory && existsSync(compiled)) process.exitCode = await (await import(pathToFileURL(compiled).href)).main(args, root);
  else if (!memory && typescriptEnabled()) {
    process.exitCode = await (await import(maker ? './bin/shell.ts' : './scripts/framework/cli.ts')).main(args, root);
  } else {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), ...args], { stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unable to start the framework CLI.';
  if (args.includes('--json')) process.stdout.write(JSON.stringify({ protocolVersion: 1, command: 'bootstrap', status: 'failed', data: null, diagnostics: [{ code: 'BOOTSTRAP_FAILED', message }] }) + '\n');
  else process.stderr.write(message + '\n');
  process.exitCode = 1;
}
