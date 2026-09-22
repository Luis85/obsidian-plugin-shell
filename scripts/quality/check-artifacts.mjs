import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
const expected = ['main.js', 'manifest.json', 'styles.css'];
const files = (await readdir('dist')).sort();
if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error(`UNEXPECTED_ARTIFACT_SET: ${files}`);
const js = await readFile('dist/main.js', 'utf8');
if (!js.includes('Plugin Shell — bundled dependency notices') || !js.includes('Copyright (c) 2023 Nuxt')) throw new Error('MISSING_DEPENDENCY_NOTICES');
const css = await readFile('dist/styles.css', 'utf8');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) throw new Error('MANIFEST_IDENTITY');
if (!/module\.exports/.test(js) || !/require\(["']obsidian["']\)/.test(js)) throw new Error('CJS_HOST_ENTRY');
for (const marker of ['__SHELL_TEST__', 'harness-native-notice', 'original-host-style-simulation', 'CSS.startRuleUsageTracking']) if (js.includes(marker) || css.includes(marker)) throw new Error(`DEVELOPMENT_LEAK:${marker}`);
if (Buffer.byteLength(js) > 1024 * 1024 || Buffer.byteLength(css) > 100 * 1024) throw new Error('ARTIFACT_SIZE_BUDGET');
const root = postcss.parse(css);
root.walkAtRules(rule => { if (['import', 'font-face'].includes(rule.name)) throw new Error(`UNSHIPPED_CSS_RESOURCE:${rule.name}`); if (rule.name === 'property' && !rule.params.startsWith('--ps-')) throw new Error(`GLOBAL_PROPERTY:${rule.params}`); });
root.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
  if (!rule.selector.includes('data-plugin-ui') && !rule.selector.includes('.plugin-shell')) throw new Error(`UNSCOPED_RULE:${rule.selector}`);
});
const report = [];
for (const file of expected) { const bytes = await readFile(`dist/${file}`); report.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }); }
console.log(JSON.stringify({ mode: 'artifact-static', nativeHostTested: false, assets: report }, null, 2));
