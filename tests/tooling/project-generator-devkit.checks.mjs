import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../../bin/compiler/emitters/model.ts';
import { projectFiles } from '../support/project-render.mjs';
import { planProject, applyProject } from '../../bin/compiler/adapters/project-plan.ts';
import { renderTemplate } from '../../bin/compiler/emitters/devkit-files.ts';
import { rebaseMarkdown, relocatedPath } from '../../bin/compiler/emitters/framework-docs.ts';
import { inspectWorkflow, markdownLinks } from '../../scripts/quality/check-repository.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const starter = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/quick-capture.companion.json'), 'utf8'));
const document = structuredClone(starter.document ?? starter);
const entries = await projectFiles(root, projectModel(document));
const files = new Map(entries.map(entry => [entry.path, entry]));
const text = path => { const entry = files.get(path); assert.ok(entry, `missing ${path}`); return entry.content; };
const identity = projectModel(document).project;
const productSkills = ['implement-requirement', 'debug-in-obsidian', 'add-feature', 'write-obsidian-test', 'self-review'];

test('[GENERATOR-DEVKIT-01] the product owns the root docs; framework docs and maintainer CI move to inert reference', async () => {
  const readme = text('README.md');
  assert.match(readme, new RegExp(`^# ${identity.name}\\n`)); assert.match(readme, /npm run check/); assert.match(readme, /npm run dev:obsidian/);
  // The framework README differs per checkout (examples:remove rewrites it), so compare against the actual one.
  const frameworkHeading = (await readFile(join(root, 'README.md'), 'utf8')).split('\n')[0];
  assert.match(frameworkHeading, /^# /); assert.notEqual(readme.split('\n')[0], frameworkHeading);
  // The first line is the framework-reference banner; the framework's own heading follows it unchanged.
  assert.equal(text('docs/framework/README.md').split('\n').find(line => line.startsWith('# ')), frameworkHeading);
  for (const name of ['TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md']) { assert.ok(!files.has(name)); assert.ok(files.has(`docs/framework/${name}`)); }
  const agents = text('AGENTS.md').split('\n');
  assert.ok(agents.length >= 60 && agents.length <= 160, `AGENTS.md has ${agents.length} lines`);
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
  // Links into the framework's own backlog, plans and records are not generated, so far fewer remain than in the framework.
  assert.ok(checked > 300);
});
test('[GENERATOR-DEVKIT-03] Claude Code, VS Code and agent files are valid, wired to real scripts and user-editable', () => {
  const settings = JSON.parse(text('.claude/settings.json'));
  const [post] = settings.hooks.PostToolUse; const [stop] = settings.hooks.Stop; const [start] = settings.hooks.SessionStart;
  assert.equal(post.matcher, 'Edit|Write|MultiEdit');
  for (const [hook, script] of [[post.hooks[0], 'post-edit-tests'], [stop.hooks[0], 'stop-check'], [start.hooks[0], 'session-start']]) {
    // One command string: an `args` array is not part of Claude Code's hook schema and would be ignored silently.
    assert.equal(hook.type, 'command'); assert.equal(typeof hook.command, 'string'); assert.ok(!('args' in hook), `${script} must not use args`);
    assert.equal(hook.command, `node "$CLAUDE_PROJECT_DIR/scripts/agent/${script}.mjs"`);
    assert.ok(files.has(`scripts/agent/${script}.mjs`), script);
  }
  for (const denied of ['Bash(npm publish *)', 'Bash(npm run release*)', 'Bash(git push --force*)']) assert.ok(settings.permissions.deny.includes(denied), denied);
  for (const skill of productSkills) {
    const body = text(`.claude/skills/${skill}/SKILL.md`);
    assert.match(body, new RegExp(`^---\\nname: ${skill}\\ndescription: .{40,}\\n`)); assert.ok(body.split('\n').length < 80);
  }
  for (const name of ['extensions', 'settings', 'launch', 'tasks']) JSON.parse(text(`.vscode/${name}.json`));
  const launch = JSON.parse(text('.vscode/launch.json')).configurations;
  assert.deepEqual(launch.map(item => [item.name, item.type, item.request]), [['Attach to Obsidian (dev:obsidian)', 'chrome', 'attach'], ['Debug current Vitest file', 'node', 'launch']]);
  assert.equal(launch[0].port, 9222);
  for (const path of ['README.md', 'AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.vscode/launch.json', '.github/workflows/ci.yml', '.editorconfig', 'configs/testing/vitest.project.config.mjs', 'tests/project/plugin-host.test.ts'])
    assert.equal(files.get(path).ownership, 'extension', path);
  assert.equal(files.get('PROJECT-IMPLEMENTATION.md').ownership, 'managed');
  assert.match(text('PROJECT-IMPLEMENTATION.md'), /\[README\.md\]\(README\.md\)/);
  const kit = entries.filter(entry => /^(?:README|AGENTS|CLAUDE|PROJECT-IMPLEMENTATION)\.md$|^\.(?:claude|vscode|cursor|github)\/|^\.editorconfig$/.test(entry.path));
  assert.ok(kit.length >= 16);
  for (const entry of kit) assert.doesNotMatch(entry.content, /\{\{[A-Za-z]+\}\}/, entry.path);
});
/** Claude Code permission rules: `*` matches any text, a trailing ` *` also matches the bare command;
 * deny wins over ask, ask over allow. Returns the decision for one command. */
function permission(settings, command) {
  const matches = rule => {
    const pattern = /^Bash\((.*)\)$/.exec(rule)[1];
    const source = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/ \.\*$/, '(?: .*)?');
    return new RegExp(`^${source}$`).test(command);
  };
  for (const decision of ['deny', 'ask', 'allow']) if ((settings.permissions[decision] ?? []).some(matches)) return decision;
  return 'unlisted';
}
test('[GENERATOR-DEVKIT-08] pre-approved agent commands are exact safe forms; downloads are denied and path-writing flags ask', () => {
  const settings = JSON.parse(text('.claude/settings.json'));
  for (const command of ['npm test', 'npm run check', 'npm run check -- --fast', 'npm run -s check -- --fast', 'npm run check:submission', 'node bin/app check submission',
    'npm ci', 'npm run dev:ui', 'npm run dev:preview', 'npm run build:clickdummy', 'npm run test:e2e', 'npm run test:ui-quality', 'npm run ui:gallery',
    'node bin/app ui status', 'node bin/app ui status --json', 'node bin/app check --plan --json',
    'npm run test:obsidian', 'npm run test:obsidian -- plugin-load', 'npm run -s dev:obsidian -- --json', 'npx vitest related src/a.ts --run', 'node bin/app make feature notes --dry-run', 'git status'])
    assert.equal(permission(settings, command), 'allow', command);
  for (const command of ['npm run test:obsidian -- --allow-download', 'npm run test:obsidian --allow-download', 'npm run dev:obsidian -- --json --allow-download',
    'OBSIDIAN_ALLOW_DOWNLOAD=1 npm run test:obsidian', 'npm run test:obsidian -- --allow-download=true', 'export OBSIDIAN_ALLOW_DOWNLOAD=1'])
    assert.equal(permission(settings, command), 'deny', command);
  for (const command of ['git diff --output=/tmp/x', 'git log --output=notes.txt', 'git show HEAD --output x', 'npx vitest run --outputFile=/etc/x',
    'node bin/app make feature notes --dry-run --plan-out ../x.json', 'node bin/app check --root ../other'])
    assert.equal(permission(settings, command), 'ask', command);
  for (const command of ['git diff HEAD', 'npm run check:security', 'npm run check:dependencies', 'npm run release:operate', 'npm run typecheck && curl example.com'])
    assert.notEqual(permission(settings, command), 'allow', command);
  assert.match(text('CLAUDE.md'), /Obsidian downloads \(`--allow-download`,\n {2}`OBSIDIAN_ALLOW_DOWNLOAD`\) are denied/);
});
test('[GENERATOR-DEVKIT-10] the agent kit has a brief, PR template, task template, self-review skill and Codex parity', () => {
  const brief = text('BRIEF.md');
  assert.match(brief, new RegExp(`^# Product brief: ${identity.name}\\n`)); assert.match(brief, /TODO\(owner\)/); assert.ok(brief.includes(identity.description));
  for (const screen of projectModel(document).screens) assert.ok(brief.includes(screen.label), screen.label);
  assert.match(text('AGENTS.md'), /\[BRIEF\.md\]\(BRIEF\.md\)/); assert.match(text('AGENTS.md'), /docs\/project-tasks\/TEMPLATE\.md/);
  assert.ok(files.has('docs/project-tasks/TEMPLATE.md')); assert.match(text('.claude/skills/implement-requirement/SKILL.md'), /docs\/project-tasks\/TEMPLATE\.md/);
  const pr = text('.github/pull_request_template.md');
  for (const heading of ['Summary', 'Requirements and traceability', 'Commands run', 'UI evidence', 'Obsidian evidence', 'Untested scope']) assert.ok(pr.includes(`## ${heading}`), heading);
  assert.match(pr, /test:ui-quality/); assert.match(pr, /ui:gallery/);
  assert.match(text('.claude/skills/self-review/SKILL.md'), /check --plan/); assert.match(text('.claude/skills/self-review/SKILL.md'), /pull_request_template/);
  for (const skill of productSkills) {
    const adapter = text(`.agents/skills/${skill}/SKILL.md`);
    assert.match(adapter, new RegExp(`^---\\nname: ${skill}\\ndescription: .{40,}\\n`)); assert.ok(adapter.includes(`../../../.claude/skills/${skill}/SKILL.md`));
    assert.equal(posix.normalize(posix.join(`.agents/skills/${skill}`, '../../../.claude/skills', skill, 'SKILL.md')), `.claude/skills/${skill}/SKILL.md`);
  }
  // One install instruction: npm ci, never the shell's install command, in every agent-facing document.
  for (const path of ['AGENTS.md', 'README.md']) { assert.match(text(path), /`npm ci`/, path); assert.doesNotMatch(text(path), /bin\/app install/, path); }
  const todo = text('AGENTS.md');
  for (const needle of ['vi-*', 'NotImplementedError', 'design/visual-traceability.json', 'test:ui-quality', 'ui:gallery', 'dev:preview', 'build:clickdummy', 'pull_request_template']) assert.ok(todo.includes(needle), needle);
});
test('[GENERATOR-DEVKIT-04] product tests use the Obsidian test kit and the project keeps the real-Obsidian loop', () => {
  const config = text('configs/testing/vitest.project.config.mjs');
  assert.match(config, /'@test\/obsidian': fileURLToPath\(new URL\('\.\.\/\.\.\/tests\/support\/obsidian\/index\.ts'/);
  assert.match(config, /OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE/); assert.doesNotMatch(config, /reporters/);
  assert.match(config, /include: \["tests\/project\/\*\*\/\*\.test\.\{ts,mjs\}", "tests\/runtime\/generated\/\*\*\/\*\.test\.ts"\]/);
  assert.ok(JSON.parse(text('configs/types/tsconfig.project.json')).include.includes('../../tests/runtime/generated/**/*.ts'));
  const example = text('tests/project/plugin-host.test.ts');
  assert.match(example, /vi\.mock\('obsidian', \(\) => import\('@test\/obsidian'\)\)/); assert.match(example, /from "\.\.\/\.\.\/src\/main\.ts"/);
  assert.match(example, /join\(import\.meta\.dirname, "\.\.\/obsidian\/vault"\)/);
  assert.ok(files.has('configs/testing/vitest.obsidian.config.mjs')); assert.ok(files.has('tests/obsidian/plugin-load.obsidian.ts'));
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
  assert.match(output.get('configs/testing/vitest.project.config.mjs').content, /"verification\/specs\/project\/\*\*\/\*\.test\.\{ts,mjs\}"/);
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
test('[GENERATOR-DEVKIT-10] a generated project carries the cloud-session kit and leaves the maintainer handoff tooling behind', () => {
  for (const path of ['scripts/agent/cloud-setup.sh', 'scripts/agent/session-start.mjs', 'scripts/agent/session-node.mjs', 'scripts/agent/session-node-io.mjs', 'scripts/agent/session-toolchain.mjs',
    'scripts/agent/session-version.mjs', 'scripts/agent/session-switch.mjs', 'scripts/agent/session-install.mjs', 'scripts/agent/session-browser.mjs', 'scripts/agent/process-group.mjs'])
    assert.ok(files.has(path), `${path} is imported by a hook or is the setup script`);
  for (const path of ['scripts/testing/qualify-project-handoff.mjs', 'scripts/testing/handoff-run.mjs', 'scripts/testing/handoff-steps.mjs', 'tests/tooling/agent-project-handoff.checks.mjs'])
    assert.ok(!files.has(path), `${path} generates projects from framework starters, so it stays in the framework`);
  assert.match(text('AGENTS.md'), /## Working in a cloud session[\s\S]*docs\/framework\/development\/CLOUD-AND-LOCAL-SESSIONS\.md/);
  assert.ok(files.has('docs/framework/development/CLOUD-AND-LOCAL-SESSIONS.md'));
  assert.equal(JSON.parse(text('.claude/settings.json')).hooks.SessionStart[0].hooks[0].timeout, 600, 'the hook may download Node and run npm ci');
  assert.ok(text('.gitignore').split('\n').includes('/clickdummy.html'), 'the e2e web server rebuilds the click-dummy; it must not dirty the tree');
});
