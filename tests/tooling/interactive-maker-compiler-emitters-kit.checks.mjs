const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { compileProject } from '../../bin/compiler/index.ts';
import { devkitFiles, renderTemplate, makerTests } from '../../bin/compiler/emitters/devkit-files.ts';
import { componentFile, relativeImport, rewriteTemplate, copiedTemplateTest, copiedTemplateMarker } from '../../bin/compiler/emitters/file-code.ts';
import { relocatedPath, maintainerOnly, rebaseMarkdown, relocateFrameworkDocuments } from '../../bin/compiler/emitters/framework-docs.ts';
import { projectModel, schema, symbol, literal, text, rows } from '../../bin/compiler/emitters/model.ts';
import { dataDocument, model, recorder, template } from './compiler-emitters-fixture.mjs';
import { starterDocument } from '../support/starter-documents.mjs';

// Developer kit (devkit-files.ts), file helpers (file-code.ts), framework document relocation (framework-docs.ts) and model validation (model.ts).
const invalid = message => ({ message: 'GENERATOR_INVALID: ' + message });

test('the developer kit renders every template, follows custom roots and owns its files as extensions', async () => {
  const document = await starterDocument('blank'); document.settings = { codebaseFolder: 'app', testsFolder: 'checks' }; document.project.description = '  Multi\n line  ';
  const out = recorder(); await devkitFiles(template, model(document), out.add);
  const skills = ['implement-requirement', 'debug-in-obsidian', 'add-feature', 'write-obsidian-test', 'self-review'];
  const rendered = ['README.md', 'AGENTS.md', 'CLAUDE.md', '.claude/settings.json', ...skills.map(skill => `.claude/skills/${skill}/SKILL.md`),
    'BRIEF.md', 'docs/project-tasks/TEMPLATE.md', '.github/pull_request_template.md',
    '.github/copilot-instructions.md', '.cursor/rules/project.mdc', '.vscode/extensions.json', '.vscode/settings.json', '.vscode/launch.json', '.vscode/tasks.json', '.editorconfig',
    '.github/workflows/ci.yml', '.github/workflows/obsidian.yml', ...skills.map(skill => `.agents/skills/${skill}/SKILL.md`)];
  // Only the prototype skill's offline click-dummy worker ships (under scripts/clickdummy/), never the maintainer skill itself.
  const clickdummyBuilder = ['build-single-file.mjs', 'lib/build-output.mjs', 'lib/build-worker.mjs', 'lib/io.mjs', 'lib/offline.mjs', 'lib/worker-output.mjs'].map(file => `scripts/clickdummy/${file}`);
  assert.deepEqual([...out.files.keys()], [...rendered, ...clickdummyBuilder, 'configs/testing/vitest.project.config.mjs', 'checks/project/ui-bootstrap.mjs',
    'tests/suites.json', 'checks/project/plugin-host.test.ts']);
  assert.ok(![...out.files.keys()].some(path => path.includes('companion-prototype-design')));
  assert.deepEqual([...out.files].filter(([, entry]) => entry.ownership !== 'extension').map(([path, entry]) => [path, entry.ownership]), [['checks/project/ui-bootstrap.mjs', 'managed'], ['tests/suites.json', 'framework']]);
  assert.ok(out.text('README.md').startsWith('# My Vault Tool\n\nMulti line\n'));
  assert.ok(!/\{\{[A-Za-z]+\}\}/.test(rendered.map(path => out.text(path)).join('\n')));
  const config = out.text('configs/testing/vitest.project.config.mjs');
  assert.ok(config.includes(`  include: ["checks/project/**/*.test.{ts,mjs}", "${makerTests}/**/*.test.ts"], environment: 'node', fileParallelism: false,\n  // Playwright specs (npm run test:e2e) run in a browser, never in Vitest.\n  exclude: [...configDefaults.exclude, 'tests/e2e/**'],\n  setupFiles: ["checks/project/ui-bootstrap.mjs"],\n`));
  assert.equal(out.text('checks/project/ui-bootstrap.mjs'), "// Install the actual locally bundled icons, not a mock or a remote provider.\nimport { addIcon } from '@iconify/vue';\nimport { init } from 'virtual:nuxt-ui-icons';\ninit(addIcon);\n");
  assert.equal(out.text('tests/suites.json'), (await template.text('tests/suites.json')).replaceAll('"tests/project', '"checks/project'));
  const host = out.text('checks/project/plugin-host.test.ts');
  assert.ok(host.includes('import GeneratedPlugin from "../../src/main.ts";\nimport manifest from "../../manifest.json";\n'));
  assert.ok(host.includes('  const files = loadVaultFixtures(join(import.meta.dirname, "../../tests/obsidian/vault"));\n'));
  const fallback = model(await starterDocument('blank')); fallback.project.name = ' '; delete fallback.project.description;
  const defaults = recorder(); await devkitFiles(template, fallback, defaults.add);
  assert.ok(defaults.text('README.md').startsWith('# my-vault-tool\n\nAn Obsidian plugin.\n'));
  assert.ok(!defaults.files.has('tests/suites.json'));
});

test('the copied suite manifest classifies emitted journey specs and their helper, and nothing else changes', async () => {
  const out = recorder(); await devkitFiles(template, model(await starterDocument('feature-showcase')), out.add);
  const original = await template.text('tests/suites.json');
  assert.equal(out.text('tests/suites.json'), original.replace('"tests/e2e/*.spec.ts"', '"tests/e2e/*.spec.ts",\n        "tests/e2e/journeys/*.spec.ts"')
    .replace('"tests/e2e/control-metrics.ts"', '"tests/e2e/control-metrics.ts",\n        "tests/e2e/journeys/journey-support.ts"'));
  const suites = JSON.parse(out.text('tests/suites.json'));
  assert.ok(suites.suites.find(suite => suite.name === 'e2e').include.includes('tests/e2e/journeys/*.spec.ts'));
  assert.ok(suites.helpers.some(helper => helper.include.includes('tests/e2e/journeys/journey-support.ts')));
});

test('templates substitute known placeholders once and refuse unknown ones', () => {
  assert.equal(renderTemplate('{{name}} / {{id}} / {{name}} {{ name }}', { name: '{{id}}', id: 'x' }), '{{id}} / x / {{id}} {{ name }}');
  assert.throws(() => renderTemplate('{{missing}}', {}), { message: 'GENERATOR_TEMPLATE_PLACEHOLDER: missing' });
  assert.throws(() => renderTemplate('{{constructor}}', {}), { message: 'GENERATOR_TEMPLATE_PLACEHOLDER: constructor' });
});

test('file helpers name components, relativize imports and rewrite copied template text exactly', () => {
  assert.deepEqual([componentFile('list', 'component'), componentFile('task-list', 'screen'), componentFile('home', 'screen')], ['list-component', 'task-list', 'home-screen']);
  assert.deepEqual([relativeImport('src/a/b.ts', 'src/a/c.ts'), relativeImport('src/a/b.ts', 'src/d.ts'), relativeImport('tests/x.ts', 'src/y.ts')], ['./c.ts', '../d.ts', '../src/y.ts']);
  assert.equal(rewriteTemplate('a b a', [['a', 'c'], ['b', 'a']], 'x.ts'), 'c a c');
  assert.throws(() => rewriteTemplate('a', [['z', 'y']], 'x.ts'), invalid('Template x.ts no longer contains z.'));
  const copied = copiedTemplateMarker + "import { test } from 'node:test';\nimport { x } from '../../templates/companion/runtime/x.ts';\n";
  assert.equal(copiedTemplateTest(copied, [['../../templates/companion/runtime/x.ts', '../src/x.ts']], 'x.checks.mjs'), "import { test } from 'vitest';\nimport { x } from '../src/x.ts';\n");
  assert.throws(() => copiedTemplateTest("import { test } from 'node:test';\n", [], 'y.checks.mjs'), { message: /^GENERATOR_INVALID: Template y\.checks\.mjs no longer contains \/\/ Copied template text/ });
});

test('framework documents and maintainer workflows move under docs/framework with rebased links', () => {
  assert.deepEqual(['README.md', 'AGENTS.md', '.github/workflows/ci.yml', 'docs/a.md', 'README.txt'].map(relocatedPath),
    ['docs/framework/README.md', 'docs/framework/AGENTS.md', 'docs/framework/workflows/ci.yml', 'docs/a.md', 'README.txt']);
  for (const path of ['configs/starters/blank.json',
    '.github/workflows/starter-distribution.yml', '.github/scripts/run.mjs', 'tests/tooling/qualification-trigger.checks.mjs', 'docs/concepts/sitemap-editor/x.md',
    'tests/tooling/project-generator-native-starters.checks.mjs', 'docs/concepts/jev-prompt-editor/a', 'tests/tooling/jev-concept-distribution.checks.mjs'])
    assert.equal(maintainerOnly(path), true, path);
  // The retired schema 5 concept data and the removed native source handoff are no longer special-cased.
  for (const path of ['docs/concepts/companion/companion-project.json', 'docs/concepts/companion/starters/x.json', 'docs/concepts/native-file-integration-handoff/a.md'])
    assert.equal(maintainerOnly(path), false, path);
  assert.equal(maintainerOnly('docs/concepts/companion/editor/main.ts'), false);
  const markdown = ['See [agents](AGENTS.md#rules), [guide](docs/guide.md?x=1), <[angled](<docs/a b.md>)>.', '```md', '[inside](AGENTS.md)', '````',
    '[web](https://example.invalid) [anchor](#top) [root](/abs.md) [bad](%E0%A4%A.md) ![seed](docs/concepts/sitemap-editor/a.png) [empty](?q)', '~~~', '[tilde](README.md)', '~~~', '[ci](.github/workflows/ci.yml)'].join('\n');
  assert.equal(rebaseMarkdown(markdown, 'README.md', 'docs/framework/README.md'), ['See [agents](AGENTS.md#rules), [guide](../guide.md?x=1), <[angled](<../a%20b.md>)>.', '```md', '[inside](AGENTS.md)', '````',
    '[web](https://example.invalid) [anchor](#top) [root](/abs.md) [bad](%E0%A4%A.md) seed (maintainer-only asset, not included) [empty](?q)', '~~~', '[tilde](README.md)', '~~~', '[ci](workflows/ci.yml)'].join('\n'));
  assert.equal(rebaseMarkdown('[readme](../README.md) [same](other.md)', 'docs/x.md', 'docs/x.md'), '[readme](framework/README.md) [same](other.md)');
  const entries = new Map([['README.md', { path: 'README.md', content: '[a](AGENTS.md)', ownership: 'framework' }], ['docs/x.md', { path: 'docs/x.md', content: 'plain', ownership: 'framework' }],
    ['docs/y.md', { path: 'docs/y.md', content: '[r](../README.md)', ownership: 'framework' }], ['logo.png.md', { path: 'logo.png.md', content: 'AA', encoding: 'base64', ownership: 'framework' }],
    ['.github/workflows/ci.yml', { path: '.github/workflows/ci.yml', content: 'on: push', ownership: 'framework' }], ['AGENTS.md', { path: 'AGENTS.md', content: 'own', ownership: 'extension' }]]);
  relocateFrameworkDocuments(entries);
  assert.deepEqual([...entries].map(([path, entry]) => [path, entry.path, entry.content]), [['docs/x.md', 'docs/x.md', 'plain'], ['docs/y.md', 'docs/y.md', '[r](framework/README.md)'], ['logo.png.md', 'logo.png.md', 'AA'], ['AGENTS.md', 'AGENTS.md', 'own'],
    ['docs/framework/README.md', 'docs/framework/README.md', "> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**\n\n[a](AGENTS.md)"],
    ['docs/framework/workflows/ci.yml', 'docs/framework/workflows/ci.yml', 'on: push']]);
});

test('model schemas keep supported JSON Schema and refuse silent weakening', () => {
  assert.deepEqual(schema({ type: ['string', 'null'] }), { type: ['string', 'null'] });
  assert.deepEqual(schema({ type: 'object', properties: { a: { type: 'array', items: { type: 'string', format: 'email', enum: ['a@b.c'] } } }, additionalProperties: false }),
    { type: 'object', properties: { a: { type: 'array', items: { type: 'string', enum: ['a@b.c'], format: 'email' } } }, required: [], additionalProperties: false });
  const refuse = (value, message) => assert.throws(() => schema(value), invalid(message));
  refuse({ type: 'date' }, 'Unsupported schema type.'); refuse({ type: [] }, 'Unsupported schema type.'); refuse({ type: 'string', pattern: 'x' }, 'Unsupported JSON Schema keyword; no silent weakening.');
  refuse({ type: ['object', 'null'] }, 'Only primitive schema unions are supported.'); refuse({ type: 'string', enum: [] }, 'Invalid enum.'); refuse({ type: 'string', enum: [{}] }, 'Invalid enum.');
  refuse({ type: 'number', format: 'date' }, 'Unsupported string format.'); refuse({ type: 'string', format: 'ipv4' }, 'Unsupported string format.');
  refuse({ type: 'object', properties: { constructor: { type: 'string' } } }, 'Unsafe property name.'); refuse({ type: 'object', required: ['a'] }, 'Missing required property definition.');
  refuse({ type: 'object', additionalProperties: {} }, 'Unsupported additionalProperties schema.'); refuse({ type: 'string', required: [] }, 'Object constraints on non-object.');
  refuse({ type: 'string', items: { type: 'string' } }, 'Array constraints on non-array.'); refuse({ type: 'integer', enum: [1.5] }, 'Enum does not match its type/format.');
  refuse({ type: 'object', properties: Object.fromEntries(Array.from({ length: 41 }, (_, i) => ['p' + i, { type: 'string' }])) }, 'Too many schema properties.');
  let deep = { type: 'string' }; for (let i = 0; i < 7; i++) deep = { type: 'array', items: deep };
  refuse(deep, 'Schema exceeds its complexity limit.'); refuse([], 'Expected object.');
  assert.equal(symbol('task-list'), 'GTaskList'); assert.equal(literal('<  >'), '"\\u003c\\u2028\\u2029\\u003e"');
  assert.throws(() => text(1), invalid('Expected bounded text.')); assert.throws(() => rows({}), invalid('Expected bounded collection.'));
});

test('project models refuse unsafe roots, identities and dangling references', async () => {
  const refuse = async (edit, message) => { const document = await dataDocument(); edit(document); assert.throws(() => projectModel(document), message instanceof RegExp ? { message } : invalid(message)); };
  await refuse(d => { d.settings.codebaseFolder = 'scripts/app'; }, 'Generated roots overlap framework tooling.');
  await refuse(d => { d.design.semantic.entities[1].slug = 'starter-task'; }, 'Duplicate identity: starter-task');
  await refuse(d => { d.design.semantic.entities[0].properties.push({ id: 'p9', key: 'id', type: 'text', required: false }); }, 'Duplicate/reserved entity property: id');
  await refuse(d => { d.design.semantic.relationships[0].key = 'title'; }, 'Relationship/property collision.');
  await refuse(d => { d.design.semantic.relationships[0].targetCard = '2'; }, 'Unsupported relationship cardinality.');
  await refuse(d => { d.design.semantic.relationships[0].target = 'er-missing'; }, 'Dangling relationship.');
  await refuse(d => { d.design.nodes[1].parent = 'node-404'; }, /^A parent surface is missing\.$/);
  await refuse(d => { d.design.dataSources.sources[0].operations[1].input.mode = 'unspecified'; }, 'Finish unspecified source shapes before generating.');
  await refuse(d => { d.design.dataSources.sources[2].kind = 'smtp'; }, 'Unsupported source adapter kind.');
  await refuse(d => { d.design.dataSources.sources[1].kind = 'collection'; d.design.dataSources.sources[1].collectionPath = 'Other'; d.design.dataSources.sources[1].entity = 'er-entity-1'; },
    'Collection needs one safe vault-relative path matching its declared entity folder.');
  await refuse(d => { d.design.dataSources.flows[0].operation = 'ds-operation-9'; }, 'Dangling or incompatible source flow.');
  await refuse(d => { d.design.dataSources.sources[1].kind = 'collection'; d.design.dataSources.sources[1].collectionPath = 'Starter/Task'; d.design.dataSources.sources[1].entity = 'er-entity-1';
    d.design.dataSources.sources[1].operations[3].implementation.operation = 'update'; }, 'Collection requires managed List/Create/Update/Delete note operations for its entity.');
  const typed = await dataDocument([['seen', 'datetime'], ['score', 'number', true]]); typed.design.semantic.relationships[0].targetCard = '1';
  const entity = projectModel(typed).entities[0];
  assert.deepEqual([entity.schema.properties.seen, entity.schema.required], [{ type: 'string', format: 'date-time' }, ['id', 'type', 'title', 'score', 'project_ref']]);
  const m = model(await dataDocument());
  assert.deepEqual(m.sources[0].operations[1].input, { type: 'object', properties: { id: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['id'], additionalProperties: true });
  assert.equal(m.warnings.length, 4);
  const unvisual = await dataDocument(); delete unvisual.design.visualDesigns;
  assert.deepEqual(projectModel(unvisual).warnings, [m.warnings[0], m.warnings[1], m.warnings[3]]);
});

test('a one-or-more relationship compiles to a required reference array and a malformed cardinality is refused', async () => {
  const fixture = starterDocument('companion-plugin');
  const relationship = fixture.design.semantic.relationships.find(item => item.key === 'screen_refs');
  relationship.targetCard = '1..*';
  const compiled = await compileProject({ source: JSON.stringify(fixture), sourceName: 'companion-plugin.json' });
  assert.equal(compiled.status, 'ok', JSON.stringify(compiled.diagnostics));
  const requirement = compiled.model.entities.find(entity => entity.slug === 'requirement').schema;
  assert.deepEqual(requirement.properties.screen_refs, { type: 'array', items: { type: 'string' } });
  assert.ok(requirement.required.includes('screen_refs'));
  relationship.targetCard = '1..+';
  const refused = await compileProject({ source: JSON.stringify(fixture), sourceName: 'companion-plugin.json' });
  assert.equal(refused.status, 'failed'); assert.ok(!refused.model);
});
