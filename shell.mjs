#!/usr/bin/env node
// Source launcher only. Release kits include TypeScript-compiled modules before installation.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const compiled = join(root, '.framework/compiled/scripts/framework/cli.js');
try {
  if (existsSync(compiled)) process.exitCode = await (await import(pathToFileURL(compiled).href)).main(process.argv.slice(2), root);
  else if (process.features.typescript || process.execArgv.includes('--experimental-strip-types')) {
    process.exitCode = await (await import('./scripts/framework/cli.ts')).main(process.argv.slice(2), root);
  } else {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unable to start the framework CLI.';
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify({ protocolVersion: 1, command: 'bootstrap', status: 'failed', data: null, diagnostics: [{ code: 'BOOTSTRAP_FAILED', message }] }) + '\n');
  else process.stderr.write(message + '\n');
  process.exitCode = 1;
}
