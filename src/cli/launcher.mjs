#!/usr/bin/env node
// Built as bin/app. Runtime code is bundled; no TypeScript or source fallback.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const frameworkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
try {
  process.exitCode = await (await import('./app.js')).main(args, frameworkRoot);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unable to start the Workbench CLI.';
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ protocolVersion: 1, command: 'bootstrap', status: 'failed', data: null,
      diagnostics: [{ code: 'BOOTSTRAP_FAILED', message }] }) + '\n');
  } else process.stderr.write(message + '\n');
  process.exitCode = 1;
}
