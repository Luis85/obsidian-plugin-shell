import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkTokens } from '../../scripts/styles/check-tokens.mjs';
import { assertVendor, vendorPath, vendorArchive, readVendor, runtimeVendorCss, decodeVendor } from '../../scripts/styles/vendor-policy.mjs';
import { aliasPairs, validateAliases } from '../../scripts/styles/token-contract.mjs';
import { inlineSpecimen } from '../../scripts/testing/browser-input.mjs';
import { sourceInputs, lineLimit } from '../../scripts/testing/source-inputs.mjs';
import { assertProfile } from '../../scripts/harness/style-profile.mjs';
const root = fileURLToPath(new URL('../../',import.meta.url));
const read = async (path) => path === vendorPath ? (await readVendor(root)).toString('utf8') : readFile(new URL(`../../${path}`,import.meta.url),'utf8');
const catalog = JSON.parse(await read('docs/design/obsidian-tokens.json'));
const inventory = JSON.parse(await read('harness/styles/vendor/token-inventory.json'));
const aliases = await read('src/styles/tokens.css');
test('[TOK-01] pinned source and token catalogs agree with starter aliases', async () => {
  const result = await checkTokens(root); assert.equal(result.status,'passed');
  assert.ok(result.observedTokenNames > 900); assert.ok(result.reviewedTokenNames > 120); assert.equal(result.aliases,38);
});
test('[TOK-02] any vendor byte change fails integrity rather than becoming a line exemption', async () => {
  const bytes = Buffer.from(await read(vendorPath)); assertVendor(bytes);
  bytes[bytes.length-2] ^= 1; assert.throws(() => assertVendor(bytes), /SNAPSHOT_MISMATCH/);
  assert.equal(lineLimit('harness/styles/vendor/other.css'),400);
  const manifest = await sourceInputs(root); const vendor = manifest.files.find((f) => f.path === vendorArchive);
  assert.equal(vendor.limit,null); assert.ok(vendor.lines > 400); assert.ok(vendor.sha256);
});
test('[TOK-03] defaults are not redefined in production aliases', () => {
  assert.equal(aliasPairs(aliases).length,38);
  assert.throws(() => aliasPairs(aliases.replace(':where(.plugin-shell)',':root')), /SCOPE/);
  assert.throws(() => aliasPairs(aliases.replace('--plugin-shell-text:', '--text-normal:')), /GRAMMAR/);
  assert.throws(() => aliasPairs(aliases.replace('var(--text-normal)', '#ffffff')), /GRAMMAR/);
});
test('[TOK-04] misspelled deprecated and missing host tokens fail the same validator', () => {
  assert.throws(() => validateAliases(aliases.replace('var(--text-normal)','var(--text-normla)'),catalog,inventory.names),/UNKNOWN/);
  assert.throws(() => validateAliases(aliases.replace('var(--text-normal)','var(--color-red-rgb)'),catalog,inventory.names),/DEPRECATED/);
  assert.throws(() => validateAliases(aliases,catalog,inventory.names.filter((n) => n !== '--text-normal')),/MISSING_IN_SNAPSHOT/);
});
test('[TOK-05] host then plugin then gallery load order is explicit', async () => {
  const html = await read('harness/style-fixture/index.html');
  const positions = ['../styles/obsidian.css','../../src/styles/index.css','fixture.css'].map((name) => html.indexOf(`href="${name}"`));
  assert.ok(positions.every((n) => n >= 0)); assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  assert.match(html,/data-host-style="extracted"/); assert.match(html,/data-density="native"/);
  assert.doesNotMatch(html,/href="[^"]*simulated.css/);
});
test('[TOK-06] provenance keeps unknown app version and third-party rights explicit', async () => {
  const p = JSON.parse(await read('harness/styles/vendor/provenance.json'));
  assert.equal(p.sourceAppVersion,null); assert.equal(p.nativeComparison,null);
  assert.equal(p.copyMode,'byte-identical'); assert.equal(p.fontsIncluded,false);
  assert.equal(p.productionBundleAllowed,false); assert.match(p.license,/not relicensed/);
});
test('[TOK-07] default inline rendering includes extraction not original simulator tokens', async () => {
  const html = await inlineSpecimen(root,'extracted');
  assert.match(html,/rp-obsidian-compatibility-floor/); assert.match(html,/data-plugin-tokens/);
  assert.doesNotMatch(html,/--harness-overlay-z:/);
  await assert.rejects(() => inlineSpecimen(root,'unknown'),/UNKNOWN_HOST_STYLE_PROFILE/);
  assert.throws(() => assertProfile('__proto__'),/UNKNOWN_HOST_STYLE_PROFILE/);
});
test('[TOK-08] original simulation is a separate explicit profile', async () => {
  const html = await inlineSpecimen(root,'simulated');
  assert.match(html,/Original CSS simulation/); assert.doesNotMatch(html,/rp-obsidian-compatibility-floor/);
  assert.match(html,/data-host-style="simulated"/); assert.match(html,/data-plugin-tokens/);
});
test('[TOK-09] extraction and adapter have no font assets or remote stylesheet imports', async () => {
  for (const p of [vendorPath,'harness/styles/host-adapter.css']) {
    const css = await read(p); assert.doesNotMatch(css,/@font-face|url\(\s*['"]?(?:https?:|data:font)/i);
    assert.doesNotMatch(css,/@import/);
  }
});
test('[TOK-10] new duplicate alias does not silently override an existing contract', () => {
  const bad = aliases.replace(/}\s*$/, '  --plugin-shell-text: var(--text-error);\n}');
  assert.throws(() => aliasPairs(bad),/DUPLICATE/);
});

test('[TOK-11] runtime normalization changes only the documented malformed header comment', async () => {
  const raw = await readVendor(root); const served = runtimeVendorCss(raw);
  assert.equal(served.replace('--page-* / --scale-factor','--page-*/--scale-factor'),raw.toString('utf8'));
  assert.doesNotMatch(served,/--page-\*\//); assert.match(served,/:root \{\n  --h1-weight: 700;/);
  const packed = await readFile(new URL('../../harness/styles/vendor/obsidian.css.gz',import.meta.url));
  assert.throws(() => decodeVendor(Buffer.concat([packed,packed])));
});
