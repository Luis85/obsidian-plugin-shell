#!/usr/bin/env node
import { resultEnvelope } from './contracts/result-runtime.mjs';
// Compatibility entry: the integrated CLI owns validation, reviewed plans and result envelopes.
// --write remains the generate-only legacy spelling of --yes.
const [command, ...args] = process.argv.slice(2);
const writeCount = args.filter(value => value === '--write').length;
const invalid = !['generate', 'validate', 'inspect'].includes(command)
  ? 'Use generate, validate or inspect; refresh uses the integrated reviewed-plan command.'
  : writeCount > 1 ? 'Repeated option: --write'
  : writeCount && command !== 'generate' ? 'Validation and inspection never write.'
  : writeCount && args.includes('--dry-run') ? '--write and --dry-run are mutually exclusive.'
  : null;
if (invalid) {
  // Preserve the standalone entry's machine-readable argument error contract.
  console.log(JSON.stringify(resultEnvelope('handout ' + (command ?? 'unknown'), null, 'failed', [{ code: 'HANDOUT_ARGUMENT', message: invalid }])));
  process.exitCode = 1;
} else {
  process.argv.splice(2, process.argv.length - 2, 'handout', command, ...args.map(arg => arg === '--write' ? '--yes' : arg));
  await import('../app.mjs');
}
