import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { analyzeInventory } from '../application/adoption/analyze.ts';
import { renderPlan } from '../domain/adoption/plan-render.ts';
import { screensRequest } from '../domain/adoption/plan-phases.ts';
import { bullets, code, document, fence, plain, table } from '../domain/adoption/plan-markdown.ts';
import { inventoryOf, targets } from './support/interactive-maker-adopt-fixture.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const repo = { present: true, dirty: false, remoteHost: null, dirtyNote: null };
const pkg = (dependencies = {}, extra = {}) => ({ name: 'sample', dependencies, ...extra });
const report = (files, options = {}, recordedAt = null) => analyzeInventory(inventoryOf(files, { git: repo, ...options }), targets, recordedAt);
const sha = text => createHash('sha256').update(text).digest('hex');
const routes = "export const routes = [{ path: 'orders' }, { path: 'orders/:id' }, { path: 'customer-accounts' }, { path: 'settings/profile' }];";
const angular = (major, extra = {}) => ({ 'package.json': pkg({ '@angular/core': `^${major}.0.0` }, { scripts: { build: 'x', test: 'y', lint: 'z' } }), 'angular.json': { projects: { app: { projectType: 'application', architect: { build: { builder: '@angular/build:application' } } } } },
  'package-lock.json': '{}', 'src/app/app.routes.ts': routes, '.github/workflows/ci.yml': 'x', ...extra });
const unfenced = markdown => markdown.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1$/gm, '');
const headings = markdown => unfenced(markdown).split('\n').filter(line => /^#{2,3} /.test(line));
const json = markdown => JSON.parse([...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => match[1]).find(text => text.includes('"operations"')));

test('a plan has every required section in order, states it is a plan and keeps phases ordered', () => {
  const markdown = renderPlan(report(angular(22)));
  const top = headings(markdown).filter(line => line.startsWith('## '));
  assert.deepEqual(top, ['## 1. Summary and recommendation', '## 2. Current state', '## 3. Integration strategy options', '## 4. Phased steps', '## 5. Conflicts and risks', '## 6. What stays untouched', '## 7. Verification gates', '## 8. Rollback', '## 9. Open questions for the owner']);
  const phases = headings(markdown).filter(line => line.startsWith('### Phase'));
  assert.deepEqual(phases.map(line => line.slice(0, 9)), ['### Phase', '### Phase', '### Phase', '### Phase', '### Phase', '### Phase', '### Phase']);
  assert.deepEqual(phases.map(line => /Phase (\d)/.exec(line)[1]), ['0', '1', '2', '3', '4', '5', '6']);
  assert.match(markdown, /^# Workbench adoption plan: sample\n/); assert.match(markdown, /This is a plan, not a completed integration/); assert.match(markdown, /release, qualification and publication are separate/i);
  for (const label of ['**Goal.**', '**Commands**', '**Files to add or change**', '**Acceptance checks**']) assert.equal(markdown.split(label).length - 1, 7, label);
  assert.ok(markdown.endsWith('\n') && !markdown.endsWith('\n\n'));
});
test('the same report always renders the same bytes and the report time is the only date in the body', () => {
  const first = report(angular(21), {}, '2026-02-03T04:05:06.000Z'), second = JSON.parse(JSON.stringify(first));
  const a = renderPlan(first), b = renderPlan(second);
  assert.equal(sha(a), sha(b)); assert.equal(a, b);
  assert.equal([...a.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g)].length, 1); assert.match(a, /Report recorded: `2026-02-03T04:05:06\.000Z`/);
  const inline = renderPlan(report(angular(21)));
  assert.doesNotMatch(inline, /\d{4}-\d{2}-\d{2}T/); assert.match(inline, /computed inline when this plan was generated \(not stored\)/);
  const reordered = report({ ...Object.fromEntries(Object.entries(angular(21)).reverse()) }); assert.equal(renderPlan(reordered), inline);
  assert.notEqual(renderPlan(report(angular(20))), inline);
});
test('the recommendation follows the findings: A in range, B across a gap or another stack, C for plugins', () => {
  const strategy = markdown => /Recommended strategy: \*\*([ABC])\*\*/.exec(markdown)[1];
  assert.equal(strategy(renderPlan(report(angular(22)))), 'A'); assert.equal(strategy(renderPlan(report(angular(21)))), 'A');
  const gap = renderPlan(report(angular(18)));
  assert.equal(strategy(gap), 'B'); assert.match(gap, /Blocking findings/); assert.match(gap, /`ANGULAR_TARGET_GAP`/); assert.match(gap, /### Option A: .*\(not advised for this project\)/);
  assert.equal(strategy(renderPlan(report({ 'package.json': pkg({ react: '18' }) }))), 'B');
  const plugin = renderPlan(report({ 'manifest.json': { id: 'p', version: '1.0.0', minAppVersion: '1.5.0' }, 'package.json': pkg({ obsidian: 'latest' }) }));
  assert.equal(strategy(plugin), 'C'); assert.match(plugin, /### Option C: .*\(recommended\)/); assert.match(plugin, /check submission/); assert.doesNotMatch(plugin, /new guide --starter/);
  assert.match(renderPlan(report({ 'package.json': pkg({ vue: '3' }) })), /new guide --starter webapp-nuxtui/); assert.match(renderPlan(report(angular(22))), /new guide --starter webapp-angular/);
});
test('findings, evidence paths and facts from the report are rendered in the current-state section', () => {
  const markdown = renderPlan(report(angular(18, { '.nvmrc': 'v16.1.0', 'tslint.json': '{}', 'src/app/x.component.ts': "@Component({ template: '' }) class X {}", '.cursorrules': 'x' })));
  for (const text of ['`NODE_MAJOR_DIFFERS`', '`ANGULAR_TARGET_GAP`', '`TOOL_CONFIG_CONFLICT`', '`.nvmrc`', '`angular.json`', '`src/app/app.routes.ts`', '`.cursorrules`']) assert.ok(markdown.includes(text), text);
  assert.match(markdown, /\| block \| `ANGULAR_TARGET_GAP` \|/); assert.match(markdown, /Version: `18\.0\.0`; Workbench target `22\.0\.0`/);
  assert.match(markdown, /Routing: 4 route entries \(estimate\)/); assert.match(markdown, /1 components \(0 standalone, estimate\)/);
  assert.match(markdown, /Frameworks\n\| Framework/); assert.match(markdown, /Workbench is qualified on `24\.21\.0`/);
  const bare = renderPlan(report({ 'README.md': 'x' }, { git: { present: false, dirty: null, remoteHost: null, dirtyNote: null } }));
  assert.match(bare, /not a Git repository/); assert.match(bare, /_none detected_/); assert.match(bare, /git init/);
  const unknown = renderPlan(report({ 'README.md': 'x' }, { git: { present: true, dirty: null, remoteHost: 'github.com', dirtyNote: 'n' } }));
  assert.match(unknown, /state not determined, origin on github\.com/);
  assert.match(renderPlan(report({ 'README.md': 'x' }, { git: { present: true, dirty: true, remoteHost: null, dirtyNote: null } })), /commit or stash them before the branch is created/);
  assert.match(renderPlan(report({ 'package.json': pkg() }, { scan: { truncated: true } })), /stopped at the limit/);
});
test('commands use the project package manager, a CI snippet only for GitHub Actions and the legacy gates are kept', () => {
  const yarn = renderPlan(report(angular(22, { 'package.json': pkg({ '@angular/core': '22' }, { packageManager: 'yarn@4.1.0', scripts: { build: 'x', test: 'y', e2e: 'z' } }) })));
  assert.match(yarn, /^yarn build /m); assert.match(yarn, /^yarn test /m); assert.match(yarn, /^yarn e2e/m);
  assert.match(renderPlan(report(angular(22, { 'package.json': pkg({}, { packageManager: 'pnpm@9', scripts: { test: 'x' } }) }))), /^pnpm run test /m);
  assert.match(renderPlan(report(angular(22, { 'package.json': pkg({}, { packageManager: 'bun@1', scripts: { test: 'x' } }) }))), /^bun run test /m);
  const none = renderPlan(report({ 'package.json': pkg() }));
  assert.match(none, /No lint\/test\/build scripts were found/); assert.match(none, /legacy gates: unchanged \(none detected as scripts\)/); assert.doesNotMatch(none, /name: workbench-app/);
  const hosted = renderPlan(report(angular(22)));
  assert.match(hosted, /name: workbench-app/); assert.match(hosted, /node-version: '24\.21\.0'/); assert.match(hosted, /working-directory: apps\/workbench-app\/source/);
  const { '.github/workflows/ci.yml': _workflow, ...withoutActions } = angular(22);
  assert.doesNotMatch(renderPlan(report({ ...withoutActions, '.gitlab-ci.yml': 'x' })), /name: workbench-app/);
});
test('a detected Azure Pipelines definition gets its own separate pipeline snippet, queued by branch policy', () => {
  const { '.github/workflows/ci.yml': _workflow, ...withoutActions } = angular(22);
  const azure = renderPlan(report({ ...withoutActions, 'azure-pipelines.yml': 'x' }));
  assert.match(azure, /Azure Pipelines detected/); assert.doesNotMatch(azure, /name: workbench-app|GitHub Actions detected/);
  assert.match(azure, /^trigger: none$/m); assert.match(azure, /build-validation branch policy with the path filter \/apps\/workbench-app\/\*/);
  assert.match(azure, /versionSpec: '24\.21\.0'/); assert.match(azure, /workingDirectory: apps\/workbench-app\/source/);
  const both = renderPlan(report({ ...angular(22), 'azure-pipelines.yml': 'x' }));
  assert.match(both, /GitHub Actions detected/); assert.match(both, /Azure Pipelines detected/);
  assert.doesNotMatch(renderPlan(report(angular(22))), /Azure Pipelines detected|NodeTool@0/);
});
test('phase 3 derives a sketch request from the routes: titles, unique aliases and a bounded page list', () => {
  const request = json(renderPlan(report(angular(22))));
  assert.equal(request.schemaVersion, 1); assert.equal(request.title, 'sample');
  assert.deepEqual(request.operations.map(item => [item.title, item.as]), [['Orders', 'orders'], ['Customer Accounts', 'customer-accounts'], ['Settings Profile', 'settings-profile']]);
  assert.ok(request.operations.every(item => item.op === 'page.add'));
  assert.deepEqual(JSON.parse(screensRequest(report({ 'package.json': pkg() }))).operations, [{ op: 'page.add', title: 'Overview', as: 'overview' }]);
  const many = Object.fromEntries([['package.json', pkg({ '@angular/core': '22' })], ['src/app.routes.ts', Array.from({ length: 14 }, (_, index) => `{ path: 'screen-${String.fromCharCode(97 + index)}' }`).join(',')]]);
  assert.equal(JSON.parse(screensRequest(report(many))).operations.length, 10);
  const odd = JSON.parse(screensRequest(report({ 'package.json': pkg({ '@angular/core': '22' }), 'src/app.routes.ts': "{ path: 'a-b' }, { path: 'a_b' }, { path: '.' }, { path: '-' }" }))).operations;
  assert.deepEqual(odd.map(item => item.as), ['a-b']);
  assert.equal(JSON.parse(screensRequest(report({ 'package.json': pkg() }, { name: '' }))).title, 'Existing project');
});
test('report-derived text cannot inject headings, table cells, fences or html into the plan', () => {
  const data = report(angular(22));
  const evil = '# injected heading\n| a | b |\n```\n<script>alert(1)</script> [x](javascript:alert(1)) *bold* `tick`';
  data.target.name = evil; data.findings.push({ id: 'EVIL', severity: 'warn', message: evil, evidence: [evil] }); data.frameworks.push({ id: evil, version: evil, detail: evil, evidence: [evil] });
  data.angular.routing.paths = [evil]; data.agents.files = [evil]; data.workbench = { present: true, kitPath: null, evidence: [evil] };
  const markdown = renderPlan(data);
  const prose = unfenced(markdown).replace(/\\[\s\S]/g, '').replace(/`[^`\n]*`/g, '');
  assert.doesNotMatch(markdown, /^# injected heading/m); assert.doesNotMatch(markdown, /^\| a \| b \|$/m); assert.doesNotMatch(prose, /<script>|(?<!\\)\]\(javascript:/);
  assert.equal(markdown.match(/^(`{3,})/gm).length % 2, 0);
  for (const line of markdown.split('\n').filter(item => item.startsWith('| warn | `EVIL`'))) assert.equal(line.replace(/\\\|/g, '').split('|').length, 6);
  assert.equal(unfenced(markdown).split('\n').filter(line => /^# /.test(line)).length, 1);
});
test('markdown helpers escape, fence and tabulate defensively', () => {
  assert.equal(code('a`b\nc'), "`a'b c`"); assert.equal(code(null), '``'); assert.equal(plain('a*b_c[d]<e>#~\\'), 'a\\*b\\_c\\[d\\]\\<e\\>\\#\\~\\\\');
  assert.deepEqual(fence('x\n````y', 'md'), ['`````md', 'x', '````y', '`````']); assert.deepEqual(fence('plain'), ['```sh', 'plain', '```']);
  assert.deepEqual(table(['a|b'], [['c|d']]), ['| a\\|b |', '| --- |', '| c\\|d |']); assert.deepEqual(bullets(['x']), ['- x']);
  assert.equal(document([['a'], [], ['b']]), 'a\n\nb\n');
});
test('the risks, untouched, gates, rollback and question sections reflect the report', () => {
  const clean = renderPlan(report(angular(22, { '.nvmrc': '24.21.0' })));
  assert.match(clean, /Everything this plan adds is confined to/); assert.match(clean, /## 7\. Verification gates[\s\S]*Does not prove/); assert.match(clean, /git revert -m 1 <merge commit>/);
  assert.match(clean, /Which feature-flag mechanism/); assert.match(clean, /Is `apps\/workbench-app` the right location\?/);
  const nx = renderPlan(report({ 'package.json': pkg({ nx: '21', '@angular/core': '18', '@ngrx/store': '18', '@angular/ssr': '18' }, { scripts: { build: 'x' } }), 'nx.json': '{}', 'AGENTS.md': 'x', '.nvmrc': '16' }, { git: { present: true, dirty: true, remoteHost: null, dirtyNote: null } }));
  for (const text of ['join the Nx project graph', 'Is upgrading Angular', 'Server-side rendering is configured', 'How should generated screens read the existing store', 'Who commits or stashes', 'Which of the existing agent files', 'get Node 24']) assert.ok(nx.includes(text), text);
  const react = renderPlan(report({ 'package.json': pkg({ react: '18' }) })); assert.match(react, /Workbench has no starter for the detected frontend/);
  assert.match(renderPlan(report({ 'manifest.json': { id: 'p', minAppVersion: '1.0.0' } })), /No warnings or blockers|NOT_AN_OBSIDIAN/);
});
