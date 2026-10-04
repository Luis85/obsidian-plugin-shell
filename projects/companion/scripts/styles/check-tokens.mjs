/** Verify the pinned host input and starter aliases offline. No downloads or repairs. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readVendor, upstreamBlob, runtimeVendorCss } from './vendor-policy.mjs';
import { declaredTokenNames, validateAliases } from './token-contract.mjs';
export async function checkTokens(root) {
  const raw = await readVendor(root);
  const read = (path) => readFile(resolve(root,path),'utf8');
  const source = JSON.parse(await read('harness/styles/vendor/provenance.json'));
  if (source.sourceBlob !== upstreamBlob || source.sha256 !== createHash('sha256').update(raw).digest('hex') || source.bytes !== raw.length || source.sourceAppVersion !== null)
    throw new Error('VENDOR_PROVENANCE_MISMATCH');
  if (source.runtimeCssSha256 !== createHash('sha256').update(runtimeVendorCss(raw)).digest('hex')) throw new Error('VENDOR_RUNTIME_HASH_MISMATCH');
  const catalog = JSON.parse(await read('docs/design/obsidian-tokens.json'));
  const inventory = JSON.parse(await read('harness/styles/vendor/token-inventory.json'));
  const observed = declaredTokenNames(raw.toString('utf8'));
  if (inventory.sourceBlob !== upstreamBlob || JSON.stringify(inventory.names) !== JSON.stringify(observed)) throw new Error('TOKEN_INVENTORY_DRIFT');
  const reviewed = catalog.groups.flatMap((g) => g.names);
  if (new Set(reviewed).size !== reviewed.length || reviewed.some((name) => !observed.includes(name))) throw new Error('TOKEN_REFERENCE_MISMATCH');
  const aliases = validateAliases(await read('src/styles/tokens.css'),catalog,observed);
  const hostEntry = await read('harness/styles/obsidian.css');
  const imports = [...hostEntry.matchAll(/@import '([^']+)';/g)].map((m) => m[1]);
  if (JSON.stringify(imports) !== JSON.stringify(['./vendor/obsidian.css','./host-adapter.css'])) throw new Error('HOST_CSS_ORDER');
  const pluginEntry = await read('src/styles/index.css');
  if (!pluginEntry.includes("@import './tokens.css';") || /harness|vendor\//.test(pluginEntry)) throw new Error('HOST_CSS_IN_PRODUCTION_ENTRY');
  return { status:'passed', observedTokenNames:observed.length, reviewedTokenNames:reviewed.length, aliases:aliases.length, vendorBlob:upstreamBlob, nativeVerified:false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 2) throw new Error('UNKNOWN_ARGUMENT');
    console.log(JSON.stringify(await checkTokens(fileURLToPath(new URL('../../',import.meta.url)))));
  } catch(error) { console.error(JSON.stringify({status:'failed',reason:error.message})); process.exitCode=1; }
}
