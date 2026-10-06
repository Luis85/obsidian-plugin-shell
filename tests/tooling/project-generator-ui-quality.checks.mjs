import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { projectModel } from '../../src/cli/compiler/emitters/model.ts';
import { uiQualityCode, uiQualityScripts, uiQualitySurfaces } from '../../src/cli/compiler/emitters/ui-quality-code.ts';
import { uiQualitySpec } from '../../src/cli/compiler/emitters/ui-quality-spec.ts';
import { parseBrowserStarter } from '../../src/cli/adapters/starters/browser.ts';
import { projectFiles } from '../support/project-render.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const showcase = parseBrowserStarter(await readFile(`${root}configs/starters/feature-showcase.json`, 'utf8')).generator.document;
const rootPackage = JSON.parse(await readFile(`${root}package.json`, 'utf8'));

function emit(document) {
  const files = new Map();
  uiQualityCode(projectModel(structuredClone(document)), (path, content, ownership) => files.set(path, { content, ownership }));
  return files;
}
const parse = (content, name) => {
  const source = ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(source.parseDiagnostics.map(item => item.messageText), []);
  return source;
};
/** The `surfaces` array literal, read from the syntax tree and evaluated as a pure literal. */
function surfacesOf(content) {
  const source = parse(content, 'spec.ts');
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'surfaces') found = new Function(`return ${node.initializer.getText(source)}`)();
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
/** The showcase plus one dialog, one action and one group, so non-page surfaces exist. */
function withNonPageSurfaces() {
  const document = structuredClone(showcase), base = document.design.nodes.find(node => node.id === 'node-3');
  document.design.nodes.push(...['modal', 'action', 'group'].map(kind => ({ ...base, id: `node-${kind}`, slug: `extra-${kind}`, label: `Extra ${kind}`, kind, nav: false, components: [] })));
  return document;
}

test('the three managed files are emitted, parse as TypeScript and name each other consistently', () => {
  const files = emit(showcase);
  assert.deepEqual([...files.keys()].sort(), ['playwright.config.ts', 'scripts/e2e/serve-clickdummy.mjs', 'tests/e2e/ui-quality.spec.ts']);
  for (const file of files.values()) assert.equal(file.ownership, 'managed');
  const config = files.get('playwright.config.ts').content;
  parse(config, 'playwright.config.ts');
  assert.match(config, /testDir: 'tests\/e2e'/);
  assert.match(config, /testMatch: \['ui-quality\.spec\.ts', 'journeys\/\*\*\/\*\.spec\.ts'\]/);
  assert.match(config, /\['json', \{ outputFile: 'reports\/e2e\/results\.json' \}\], \['html', \{ outputFolder: 'reports\/e2e\/html', open: 'never' \}\]/);
  assert.match(config, /process\.env\.SHELL_CHROMIUM \? \{ executablePath: process\.env\.SHELL_CHROMIUM \} : \{\}/);
  assert.match(config, /scripts\/e2e\/serve-clickdummy\.mjs/);
  const port = /const port = (\d+);/.exec(config)[1], server = files.get('scripts/e2e/serve-clickdummy.mjs').content;
  assert.match(server, new RegExp(`process\\.argv\\[2\\] \\?\\? ${port}`));
  assert.match(server, /server\.listen\(port, '127\.0\.0\.1'/);
  assert.match(server, /\['bin\/app', 'clickdummy', 'build', '--replace'\]/);
  assert.match(server, /resolve\(root, 'clickdummy\.html'\)/);
  assert.notEqual(port, '4180', 'the framework harness keeps port 4180');
});

test('the spec lists page surfaces in model order and leaves out dialogs, actions and groups', () => {
  const document = withNonPageSurfaces(), model = projectModel(structuredClone(document));
  const expected = model.screens.filter(screen => !['group', 'action', 'modal'].includes(screen.kind)).map(screen => screen.id);
  assert.ok(expected.length >= 2 && expected.length < model.screens.length, 'the showcase mixes page and non-page surfaces');
  assert.deepEqual(uiQualitySurfaces(model).map(surface => surface.id), expected);
  assert.deepEqual(surfacesOf(emit(document).get('tests/e2e/ui-quality.spec.ts').content).map(surface => surface.id), expected);
});

test('every surface is covered by light and dark axe scans, a 360px reflow check and a keyboard check', () => {
  const content = emit(showcase).get('tests/e2e/ui-quality.spec.ts').content;
  for (const phrase of ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', "const themes = ['light', 'dark']", 'width: 360', 'scrollWidth', 'clientWidth',
    "keyboard.press('Tab')", 'outlineStyle', 'boxShadow', 'theme-dark', 'theme-light', "'/#surface=' + encodeURIComponent(surface.id)",
    'known-upstream-issue', '[aria-hidden="true"]']) assert.ok(content.includes(phrase), phrase);
  assert.doesNotMatch(content, /toHaveScreenshot|toMatchSnapshot/, 'no screenshot baselines');
  // One loop body declares the tests, so each surface gets: one scan per theme, one reflow and one keyboard test.
  const source = parse(content, 'spec.ts'), titles = [];
  const visit = node => { if (ts.isCallExpression(node) && node.expression.getText(source) === 'test') titles.push(node.arguments[0].getText(source)); ts.forEachChild(node, visit); };
  visit(source);
  assert.equal(titles.length, 3);
  assert.ok(titles[0].includes('axe WCAG 2.1 A/AA in the '));
  assert.ok(titles.some(title => title.includes('360px reflow')) && titles.some(title => title.includes('keyboard reachable')));
});

test('hostile ids and labels reach the spec only as escaped JSON data', () => {
  const surfaces = [{ id: 'a"; throw 1; //', label: 'Back`tick ${x} </script>' }, { id: "x'y\\z", label: 'Line\u2028break' }];
  const content = uiQualitySpec(surfaces);
  assert.deepEqual(surfacesOf(content), surfaces);
  assert.doesNotMatch(content, /<\/script>|\u2028/);
  // Nothing outside the array may contain the hostile text, so it cannot become code.
  const outside = content.replace(/^const surfaces: Surface\[\] = \[[\s\S]*?^\];$/m, '');
  assert.ok(!outside.includes('throw 1') && !outside.includes('${x}'));
});

test('output is deterministic and identical across emissions', () => {
  const first = [...emit(showcase)].map(([path, file]) => [path, file.content]), second = [...emit(structuredClone(showcase))].map(([path, file]) => [path, file.content]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(([path]) => path), ['playwright.config.ts', 'scripts/e2e/serve-clickdummy.mjs', 'tests/e2e/ui-quality.spec.ts']);
});

test('test:e2e runs the project specs and the framework harness specs keep a separate script', () => {
  const scripts = { 'test:e2e': 'playwright test --config configs/testing/playwright.config.ts' };
  uiQualityScripts(scripts);
  assert.deepEqual(scripts, { 'test:e2e': 'playwright test', 'test:e2e:framework': 'playwright test --config configs/testing/playwright.config.ts',
    'test:ui-quality': 'playwright test tests/e2e/ui-quality.spec.ts' });
  const bare = {};
  uiQualityScripts(bare);
  assert.deepEqual(Object.keys(bare).sort(), ['test:e2e', 'test:ui-quality']);
});

test('generated projects wire the scripts, the exact framework pins and a Vitest run that ignores Playwright specs', async () => {
  const entries = new Map((await projectFiles(root, projectModel(structuredClone(showcase)))).map(entry => [entry.path, entry]));
  const pkg = JSON.parse(entries.get('package.json').content), lock = JSON.parse(entries.get('package-lock.json').content);
  assert.equal(pkg.scripts['test:e2e'], 'playwright test');
  assert.equal(pkg.scripts['test:ui-quality'], 'playwright test tests/e2e/ui-quality.spec.ts');
  assert.match(pkg.scripts['test:e2e:framework'], /configs\/testing\/playwright\.config\.ts/);
  for (const name of ['@playwright/test', '@axe-core/playwright']) {
    assert.match(rootPackage.devDependencies[name], /^\d+\.\d+\.\d+$/, `${name} is pinned exactly in the repository`);
    assert.equal(pkg.devDependencies[name], rootPackage.devDependencies[name]);
    assert.equal(lock.packages[''].devDependencies[name], pkg.devDependencies[name]);
    assert.equal(lock.packages[`node_modules/${name}`].version, pkg.devDependencies[name]);
  }
  for (const path of ['playwright.config.ts', 'scripts/e2e/serve-clickdummy.mjs', 'tests/e2e/ui-quality.spec.ts']) assert.equal(entries.get(path)?.ownership, 'managed', path);
  const vitest = entries.get('configs/testing/vitest.project.config.mjs').content;
  assert.match(vitest, /exclude: \[\.\.\.configDefaults\.exclude, 'tests\/e2e\/\*\*'\]/);
  assert.match(vitest, /import \{ configDefaults, defineConfig \} from 'vitest\/config'/);
});
