#!/usr/bin/env node
// Source launcher (also reached through bin/app and the legacy shell.mjs shim). An extracted kit runs the bundled .framework/compiled/app.js.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const bundle = join(root, '.framework/compiled/app.js');
const args = process.argv.slice(2);
let runtime = null;
try {
  if (existsSync(bundle)) {
    // An extracted kit starts without node_modules or TypeScript stripping: only app.js is executable.
    runtime = await import(pathToFileURL(bundle).href);
    process.exitCode = await runtime.main(args, root);
  } else if (process.features.typescript || process.execArgv.includes('--experimental-strip-types')) {
    process.exitCode = await (await import('./bin/app.ts')).main(args, root);
  } else {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), ...args], { stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unable to start the framework CLI.';
  if (args.includes('--json')) {
    // The shared envelope comes from the bundle in a kit and from source in a checkout; the literal is only the last resort.
    const resultEnvelope = runtime?.resultEnvelope ?? (await import('./scripts/contracts/result-runtime.mjs').catch(() => null))?.resultEnvelope;
    const diagnostics = [{ code: 'BOOTSTRAP_FAILED', message }];
    process.stdout.write(JSON.stringify(resultEnvelope ? resultEnvelope('bootstrap', null, 'failed', diagnostics)
      : { protocolVersion: 1, command: 'bootstrap', status: 'failed', data: null, diagnostics }) + '\n');
  } else process.stderr.write(message + '\n');
  process.exitCode = 1;
}
