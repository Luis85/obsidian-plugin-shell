/**
 * release:prepare for this repository: src/cli/tooling/release/prepare.mjs plus the generated, version-stamped
 * outputs the release root carries (tooling/release/generated-outputs.mjs), so the prepared tree passes their checks.
 *
 *   npm run release:prepare -- --version X.Y.Z [--date YYYY-MM-DD] [--notes-file notes.md] [--min-app-version A.B.C] [--dry-run]
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPrepare } from '../../src/cli/tooling/release/prepare.mjs';
import { releaseOutputs } from './generated-outputs.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let generated;
  try { generated = await releaseOutputs(process.cwd()); } catch (error) { console.error(error.message); process.exitCode = 1; }
  if (generated) process.exitCode = await runPrepare(process.argv.slice(2), { generated });
}
