#!/usr/bin/env node
// Dependency-free dispatch; the project compiler is shared TypeScript, not a shell script.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'generate') {
    if (!process.features.typescript && !process.execArgv.includes('--experimental-strip-types')) {
      const child = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {stdio:'inherit'});
      if (child.error) throw child.error;
      process.exitCode = child.status ?? 1;
    } else await (await import('./scripts/companion/compiler/cli.ts')).generatorCli(args);
  }
  else if (command === 'make') { process.argv = [process.argv[0], 'scripts/makers/cli.mjs', ...args]; await import('./scripts/makers/cli.mjs'); }
  else if (command === 'setup') { process.argv = [process.argv[0], 'scripts/setup.mjs', ...args]; await import('./scripts/setup.mjs'); }
  else if (command === '--help' || command === undefined) process.stdout.write('Shell framework\n  node shell.mjs setup [options]\n  node shell.mjs make <recipe> [options]\n  node shell.mjs generate --help\nUse npm run help for the existing build, test, maintenance and release commands.\n');
  else throw new Error('SHELL_USAGE: unknown command; use --help.');
} catch (error) { process.stderr.write((error instanceof Error ? error.message : 'SHELL_FAILED')+'\n'); process.exitCode = 1; }
