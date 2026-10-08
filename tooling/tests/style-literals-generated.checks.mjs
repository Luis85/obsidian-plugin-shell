import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileProject, loadTemplateSnapshot } from '../../src/cli/compiler/index.ts';
import { parseBrowserStarter } from '../../src/shared/companion/starters/browser.ts';
import { evaluateStyleFiles, validateAllowlist, formatFindings } from '../styles/check-style-literals.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url)), template = await loadTemplateSnapshot(root);
const catalog = JSON.parse(await readFile(new URL('docs/design/obsidian-tokens.json', `file://${root}`), 'utf8'));
const allowlist = validateAllowlist(JSON.parse(await readFile(new URL('tooling/styles/generated-style-literal-allowlist.json', `file://${root}`), 'utf8')));
const emittedStyles = async (starter) => {
  const definition = parseBrowserStarter(await readFile(new URL(`configs/starters/${starter}.json`, `file://${root}`), 'utf8'));
  const result = await compileProject({ source: JSON.stringify(definition.generator.document), sourceName: starter + '.json', template });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  // Match the repository style gate: the standalone companion and simulated host palette were outside src before the split.
  return result.artifacts.filter((file) => /^src\/.*\.(?:vue|css)$/.test(file.path) && !file.path.startsWith('src/companion/') && !file.path.startsWith('src/plugin/harness/')).map(({ path, content }) => ({ path, content }));
};
for (const starter of ['feature-showcase', 'quick-capture']) {
  test(`[STYLE-10] ${starter}: emitted Vue/CSS has no raw colour outside the declared token and known-gap files`, async () => {
    const files = await emittedStyles(starter);
    assert.ok(files.some((file) => file.path.endsWith('.vue')) && files.some((file) => file.path.endsWith('.css')));
    const result = evaluateStyleFiles(files, allowlist, catalog);
    assert.deepEqual(formatFindings(result.findings), [], 'new generated raw colours must use Obsidian tokens (docs/design/OBSIDIAN-TOKENS.md)');
    const emitted = new Set(files.map((file) => file.path));
    assert.deepEqual(result.staleAllowlist.filter((path) => emitted.has(path)), [], 'a fixed known gap must leave tooling/styles/generated-style-literal-allowlist.json');
    assert.ok(result.allowlisted.every((path) => allowlist.some((entry) => entry.path === path)));
    assert.equal(result.findings.length, 0);
    if (starter === 'feature-showcase') assert.deepEqual(result.allowlisted.sort(), allowlist.map((entry) => entry.path).sort());
  });
}
test('[STYLE-11] a raw colour injected into an emitted Vue or CSS file fails the same generated-project check', async () => {
  const files = await emittedStyles('quick-capture');
  const vue = files.find((file) => file.path.endsWith('.vue') && /<style\b/.test(file.content)) ?? files.find((file) => file.path.endsWith('.vue'));
  const css = files.find((file) => file.path.endsWith('.css') && !allowlist.some((entry) => entry.path === file.path));
  const poison = (file, text) => files.map((item) => item === file ? { ...item, content: item.content + text } : item);
  for (const [file, text, literal] of [[vue, '\n<style scoped>.x { color: #ff0000; }</style>\n', '#ff0000'], [css, '\n.x { background: rgb(1, 2, 3); }\n', 'rgb(1, 2, 3)']]) {
    const result = evaluateStyleFiles(poison(file, text), allowlist, catalog);
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.findings.map((hit) => [hit.file, hit.literal]), [[file.path, literal]]);
    assert.ok(result.findings[0].suggestions.length > 0);
  }
});
