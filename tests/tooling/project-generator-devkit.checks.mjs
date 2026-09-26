import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { planProject, applyProject } from '../../scripts/companion/compiler/plan.ts';
import { renderTemplate } from '../../scripts/companion/compiler/devkit-files.ts';
import { rebaseMarkdown, relocatedPath } from '../../scripts/companion/compiler/framework-docs.ts';
import { inspectWorkflow, markdownLinks } from '../../scripts/quality/check-repository.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const starter = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/quick-capture.companion.json'), 'utf8'));
const document = structuredClone(starter.document ?? starter);
const entries = await projectFiles(root, projectModel(document));
const files = new Map(entries.map(entry => [entry.path, entry]));
const text = path => { const entry = files.get(path); assert.ok(entry, `missing ${path}`); return entry.content; };
const identity = projectModel(document).project;

test('[GENERATOR-DEVKIT-01] the product owns the root docs; framework docs and maintainer CI move to inert reference', async () => {
  const readme = text('README.md');
  assert.match(readme, new RegExp(`^# ${identity.name}\\n`)); assert.match(readme, /npm run check/); assert.match(readme, /npm run dev:obsidian/);
  // The framework README differs per checkout (examples:remove rewrites it), so compare against the actual one.
  const frameworkHeading = (await readFile(join(root, 'README.md'), 'utf8')).split('\n')[0];
  assert.match(frameworkHeading, /^# /); assert.notEqual(readme.split('\n')[0], frameworkHeading);
  assert.equal(text('docs/framework/README.md').split('\n')[0], frameworkHeading);
  for (const name of ['TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md']) { assert.ok(!files.has(name)); assert.ok(files.has(`docs/framework/${name}`)); }
  const agents = text('AGENTS.md').split('\n');
  assert.ok(agents.length >= 60 && agents.length <= 120, `AGENTS.md has ${agents.length} lines`);
  assert.match(text('AGENTS.md'), /npm run check/); assert.match(text('AGENTS.md'), /design\/traceability\.json/); assert.match(text('AGENTS.md'), /test:tdd/);
  assert.match(text('docs/framework/AGENTS.md'), /# Repository instructions/);
  assert.match(text('CLAUDE.md'), /^@AGENTS\.md\n/);
  const workflows = [...files.keys()].filter(path => path.startsWith('.github/workflows/')).sort();
  assert.deepEqual(workflows, ['.github/workflows/ci.yml', '.github/workflows/obsidian.yml']);
  for (const path of workflows) assert.ok(inspectWorkflow(text(path)).jobs >= 1);
  assert.ok(files.has('docs/framework/workflows/candidate-qualification.yml'));
  assert.ok(files.has('.github/dependabot.yml')); assert.ok(![...files.keys()].some(path => path.startsWith('.github/scripts/')));
  assert.ok(!files.has('tests/tooling/qualification-trigger.checks.mjs'));
});
test('[GENERATOR-DEVKIT-02] every local Markdown link in the generated project resolves to a generated file', () => {
  let checked = 0;
  for (const [path, entry] of files) {
    if (!path.endsWith('.md') || entry.encoding || !(path.startsWith('docs/') || !path.includes('/'))) continue;
    for (const link of markdownLinks(entry.content)) {
      const target = posix.normalize(posix.join(posix.dirname(path), link));
      assert.ok(files.has(target) || [...files.keys()].some(file => file.startsWith(target.replace(/\/$/, '') + '/')), `${path} -> ${link}`);
      checked++;
    }
  }
  assert.ok(checked > 500);
});
test('[GENERATOR-DEVKIT-03] Claude Code, VS Code and agent files are valid, wired to real scripts and user-editable', () => {
  const settings = JSON.parse(text('.claude/settings.json'));
  const [post] = settings.hooks.PostToolUse; const [stop] = settings.hooks.Stop;
  assert.equal(post.matcher, 'Edit|Write|MultiEdit');
  for (const hook of [post.hooks[0], stop.hooks[0]]) {
    assert.equal(hook.type, 'command'); assert.equal(hook.command, 'node');
    const script = hook.args[0].replace('${CLAUDE_PROJECT_DIR}/', ''); assert.ok(files.has(script), script);
  }
  assert.ok(settings.permissions.allow.includes('Bash(npm run check*)'));
  for (const denied of ['Bash(npm publish *)', 'Bash(npm run release*)', 'Bash(git push --force*)']) assert.ok(settings.permissions.deny.includes(denied), denied);
  for (const skill of ['implement-requirement', 'debug-in-obsidian', 'add-feature', 'write-obsidian-test']) {
    const body = text(`.claude/skills/${skill}/SKILL.md`);
    assert.match(body, new RegExp(`^---\\nname: ${skill}\\ndescription: .{40,}\\n`)); assert.ok(body.split('\n').length < 80);
  }
  for (const name of ['extensions', 'settings', 'launch', 'tasks']) JSON.parse(text(`.vscode/${name}.json`));
  const launch = JSON.parse(text('.vscode/launch.json')).configurations;
  assert.deepEqual(launch.map(item => [item.name, item.type, item.request]), [['Attach to Obsidian (dev:obsidian)', 'chrome', 'attach'], ['Debug current Vitest file', 'node', 'launch']]);
  assert.equal(launch[0].port, 9222);
  for (const path of ['README.md', 'AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.vscode/launch.json', '.github/workflows/ci.yml', '.editorconfig', 'vitest.project.config.mjs', 'tests/project/plugin-host.test.ts'])
    assert.equal(files.get(path).ownership, 'extension', path);
  assert.equal(files.get('PROJECT-IMPLEMENTATION.md').ownership, 'managed');
  assert.match(text('PROJECT-IMPLEMENTATION.md'), /\[README\.md\]\(README\.md\)/);
  const kit = entries.filter(entry => /^(?:README|AGENTS|CLAUDE|PROJECT-IMPLEMENTATION)\.md$|^\.(?:claude|vscode|cursor|github)\/|^\.editorconfig$/.test(entry.path));
  assert.ok(kit.length >= 16);
  for (const entry of kit) assert.doesNotMatch(entry.content, /\{\{[A-Za-z]+\}\}/, entry.path);
});
test('[GENERATOR-DEVKIT-04] product tests use the Obsidian test kit and the project keeps the real-Obsidian loop', () => {
  const config = text('vitest.project.config.mjs');
  assert.match(config, /'@test\/obsidian': fileURLToPath\(new URL\('\.\/tests\/support\/obsidian\/index\.ts'/);
  assert.match(config, /OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE/); assert.doesNotMatch(config, /reporters/);
  assert.match(config, /include: \["tests\/project\/\*\*\/\*\.test\.\{ts,mjs\}", "tests\/runtime\/generated\/\*\*\/\*\.test\.ts"\]/);
  assert.ok(JSON.parse(text('tsconfig.project.json')).include.includes('tests/runtime/generated/**/*.ts'));
  const example = text('tests/project/plugin-host.test.ts');
  assert.match(example, /vi\.mock\('obsidian', \(\) => import\('@test\/obsidian'\)\)/); assert.match(example, /from "\.\.\/\.\.\/src\/main\.ts"/);
  assert.match(example, /join\(import\.meta\.dirname, "\.\.\/obsidian\/vault"\)/);
  assert.ok(files.has('vitest.obsidian.config.mjs')); assert.ok(files.has('tests/obsidian/plugin-load.obsidian.ts'));
  const scripts = JSON.parse(text('package.json')).scripts;
  for (const name of ['check', 'check:fast', 'test', 'test:watch', 'test:tdd', 'test:obsidian', 'dev:obsidian', 'dev:ui', 'typecheck:project', 'verify:project', 'doctor']) assert.ok(scripts[name], name);
  assert.match(text('src/generated/bootstrap/install.ts'), /createDebugCommands/);
  assert.match(text('src/generated/bootstrap/install.ts'), /'-view-project-workbench'/);
});
test('[GENERATOR-DEVKIT-07] custom test folders keep the example test, Vitest config and suite manifest aligned', async () => {
  const custom = structuredClone(document); custom.settings = { codebaseFolder: 'product/code', testsFolder: 'verification/specs' };
  const output = new Map((await projectFiles(root, projectModel(custom))).map(entry => [entry.path, entry]));
  assert.ok(output.has('verification/specs/project/plugin-host.test.ts'));
  assert.match(output.get('verification/specs/project/plugin-host.test.ts').content, /from "\.\.\/\.\.\/\.\.\/src\/main\.ts"/);
  assert.match(output.get('vitest.project.config.mjs').content, /"verification\/specs\/project\/\*\*\/\*\.test\.\{ts,mjs\}"/);
  const suites = JSON.parse(output.get('tests/suites.json').content);
  assert.ok(suites.roots.some(entry => entry.path === 'verification/specs/project'));
  assert.deepEqual(suites.suites.find(suite => suite.name === 'project').include, ['verification/specs/project/**/*.test.ts', 'verification/specs/project/**/*.test.mjs']);
  assert.ok(!output.get('tests/suites.json').content.includes('"tests/project'));
  assert.equal(text('tests/suites.json'), await readFile(join(root, 'tests/suites.json'), 'utf8'));
});
test('[GENERATOR-DEVKIT-05] templates and link rebasing are exact and fail closed', () => {
  assert.equal(renderTemplate('# {{name}} ${{ github.ref }}', { name: 'X' }), '# X ${{ github.ref }}');
  assert.throws(() => renderTemplate('{{missing}}', {}), /GENERATOR_TEMPLATE_PLACEHOLDER: missing/);
  assert.equal(relocatedPath('README.md'), 'docs/framework/README.md');
  assert.equal(relocatedPath('.github/workflows/a.yml'), 'docs/framework/workflows/a.yml'); assert.equal(relocatedPath('docs/x.md'), 'docs/x.md');
  const source = 'See [guide](docs/a.md#part), [agents](AGENTS.md), [site](https://x.test/README.md), [anchor](#top), [spaced](<docs/b c.md>).\n```\n[code](docs/a.md)\n```\n';
  assert.equal(rebaseMarkdown(source, 'README.md', 'docs/framework/README.md'),
    'See [guide](../a.md#part), [agents](AGENTS.md), [site](https://x.test/README.md), [anchor](#top), [spaced](<../b%20c.md>).\n```\n[code](docs/a.md)\n```\n');
  assert.equal(rebaseMarkdown('[r](../../README.md) [w](../../.github/workflows/ci.yml) [s](other.md)', 'docs/dev/x.md', 'docs/dev/x.md'),
    '[r](../framework/README.md) [w](../framework/workflows/ci.yml) [s](other.md)');
});
test('[GENERATOR-DEVKIT-06] regeneration keeps an edited README and AGENTS.md; a changed template never overwrites them', async () => {
  const vault = await mkdtemp(join(tmpdir(), 'generator-devkit-'));
  try {
    const input = join(vault, 'project.json'); await writeFile(input, JSON.stringify(document));
    const options = { input, vault, target: 'plugin' };
    const first = await planProject(options); await applyProject(first, first.hash);
    const readme = join(vault, 'plugin/README.md'); const custom = '# My own README\n';
    await writeFile(readme, custom); await writeFile(join(vault, 'plugin/AGENTS.md'), '# Team rules\n');
    const replay = await planProject(options);
    assert.deepEqual(replay.conflicts, []); assert.ok(replay.preserved.includes('README.md')); assert.ok(replay.preserved.includes('AGENTS.md'));
    await applyProject(replay, replay.hash); assert.equal(await readFile(readme, 'utf8'), custom);
    const renamed = structuredClone(document); renamed.project.name = 'Renamed Capture'; await writeFile(input, JSON.stringify(renamed));
    const changed = await planProject(options);
    assert.ok(changed.conflicts.some(conflict => conflict.startsWith('README.md:')));
    await assert.rejects(applyProject(changed, changed.hash), /conflicts/); assert.equal(await readFile(readme, 'utf8'), custom);
  } finally { await rm(vault, { recursive: true, force: true }); }
});
