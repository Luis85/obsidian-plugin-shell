#!/usr/bin/env node
// Source launcher (also reached through bin/app and the legacy shell.mjs shim). Release kits include TypeScript-compiled modules before installation.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resultEnvelope } from './scripts/contracts/result-runtime.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const compiled = join(root, '.framework/compiled/bin/app.js');
const args = process.argv.slice(2);
try {
  if (existsSync(compiled)) process.exitCode = await (await import(pathToFileURL(compiled).href)).main(args, root);
  else if (process.features.typescript || process.execArgv.includes('--experimental-strip-types')) {
    process.exitCode = await (await import('./bin/app.ts')).main(args, root);
  } else {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), ...args], { stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unable to start the framework CLI.';
  if (args.includes('--json')) process.stdout.write(JSON.stringify(resultEnvelope('bootstrap', null, 'failed', [{ code: 'BOOTSTRAP_FAILED', message }])) + '\n');
  else process.stderr.write(message + '\n');
  process.exitCode = 1;
}
