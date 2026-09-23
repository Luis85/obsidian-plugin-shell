import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('[GATE-03-04] build/check parsing remains development-only while direct and transitive runtime imports fail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'template-dependency-role-'));
  const fallow = resolve('node_modules/fallow/bin/fallow');
  try {
    for (const directory of ['src', 'scripts/quality', 'scripts/bundling', 'tests/tooling']) await mkdir(join(root, directory), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'dependency-role-fixture', type: 'module', devDependencies: { 'postcss-selector-parser': '7.1.6' }, scripts: { 'check:artifacts': 'node scripts/quality/check-artifacts.mjs' } }));
    const config = { entry: ['src/main.ts'], plugins: ['scripts/quality/fallow-node-tests.json'], rules: { 'policy-violation': 'off', 'dev-dependencies-in-production': 'error' } };
    await writeFile(join(root, '.fallowrc.json'), JSON.stringify(config));
    await writeFile(join(root, 'scripts/quality/fallow-node-tests.json'), await readFile('scripts/quality/fallow-node-tests.json', 'utf8'));
    await writeFile(join(root, 'src/main.ts'), 'console.log("plugin runtime");');
    await writeFile(join(root, 'scripts/bundling/css-identity.mjs'), await readFile('scripts/bundling/css-identity.mjs', 'utf8'));
    await writeFile(join(root, 'scripts/bundling/css-ownership.mjs'), await readFile('scripts/bundling/css-ownership.mjs', 'utf8'));
    await writeFile(join(root, 'tests/tooling/styles.test.mjs'), 'import { test } from "node:test"; import { cssOwnership } from "../../scripts/bundling/css-ownership.mjs"; test("actual build adapter", () => { cssOwnership("fixture"); });');
    await writeFile(join(root, 'scripts/quality/check-artifacts.mjs'), 'import parser from "postcss-selector-parser"; import { assertCssOwnership, ownsSelector } from "../bundling/css-identity.mjs"; console.log(parser, assertCssOwnership, ownsSelector);');
    function analyze() {
      const run = spawnSync(process.execPath, [fallow, '--format', 'json', 'dead-code'], { cwd: root, encoding: 'utf8', timeout: 20000 });
      assert.equal(run.error, undefined, run.error?.message); return { status: run.status, report: JSON.parse(run.stdout) };
    }
    const supported = analyze(); assert.equal(supported.status, 0); assert.equal(supported.report.summary.total_issues, 0);
    await writeFile(join(root, 'src/main.ts'), 'import parser from "postcss-selector-parser"; console.log(parser);');
    const direct = analyze(); assert.equal(direct.status, 1);
    assert.deepEqual(direct.report.dev_dependencies_in_production.map(item => item.package_name), ['postcss-selector-parser']);
    await writeFile(join(root, 'src/main.ts'), 'import { cssOwnership } from "../scripts/bundling/css-ownership.mjs"; console.log(cssOwnership("runtime-leak"));');
    const transitive = analyze(); assert.equal(transitive.status, 1);
    assert.deepEqual(transitive.report.dev_dependencies_in_production.map(item => item.package_name), ['postcss-selector-parser']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
