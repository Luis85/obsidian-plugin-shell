/** Export the verified runtime host CSS to stdout for inspection/static harness provisioning. */
import { fileURLToPath } from 'node:url';
import { readVendor, runtimeVendorCss } from './vendor-policy.mjs';
try {
  if (process.argv.length !== 2) throw new Error('No options: redirect stdout to an explicit inspection file.');
  process.stdout.write(runtimeVendorCss(await readVendor(fileURLToPath(new URL('../../',import.meta.url)))));
} catch(error) { console.error(error.message); process.exitCode = 1; }
