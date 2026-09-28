#!/usr/bin/env node
// Source launcher only. Release kits include TypeScript-compiled modules before installation.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
let compiled = join(root, '.framework/compiled/scripts/framework/cli.js');
let args = process.argv.slice(2);
if (args[0] === 'make' && args[1] === 'prototype') args = ['prototype', ...args.slice(2)];
if (args[0] === 'help' && ['sketch', 'prototype', 'studio'].includes(args[1])) args = [args[1], '--help', ...args.slice(2)];
const maker = !args.length || ['studio', 'sketch', 'prototype', '--ui', '--no-color'].includes(args[0]);
if (maker) compiled = join(root, '.framework/compiled/bin/shell.js');
const memory = args[0] === 'memory' || (args[0] === 'help' && args[1] === 'memory');
try {
  if (memory && (process.features.typescript || process.execArgv.includes('--experimental-strip-types'))) {
    process.exitCode = await (await import('./scripts/hindsight/cli.ts')).main(args[0] === 'help' ? ['--help', ...args.slice(2)] : args.slice(1));
  } else if (!memory && existsSync(compiled)) process.exitCode = await (await import(pathToFileURL(compiled).href)).main(args, root);
  else if (!memory && (process.features.typescript || process.execArgv.includes('--experimental-strip-types'))) {
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
