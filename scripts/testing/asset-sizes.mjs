import { resolve } from 'node:path';
import { candidateSizes } from './performance-report.mjs';

const flags = process.argv.slice(2);
if (flags.length === 1 && flags[0] === '--help') {
  console.log('Usage: node scripts/testing/asset-sizes.mjs [retained-asset-directory]\nRead-only minified uncompressed/gzip/Brotli sizes and hashes. Defaults to dist; never builds.');
} else {
  if (flags.length > 1 || flags.some(flag => flag.startsWith('--'))) throw new Error('ASSET_SIZES_ARGUMENTS');
  const report = await candidateSizes(resolve(flags[0] ?? 'dist'));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
}
