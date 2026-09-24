import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const states = new Set(['planned', 'in-progress', 'blocked', 'in-review', 'done', 'superseded']);
function parseTask(text, filename) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)?.[1];
  assert.ok(front, 'TASK_FRONTMATTER_REQUIRED');
  const fields = new Map();
  for (const line of front.split(/\r?\n/)) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(line);
    assert.ok(match && !fields.has(match[1]), 'TASK_FRONTMATTER_FIELD');
    fields.set(match[1], match[2]);
  }
  const id = fields.get('task_id');
  assert.equal(`${id}.md`, filename, 'TASK_FILE_ID');
  assert.match(id, /^(SH|CX|CP|PUB)-\d{3}$/);
  assert.ok(states.has(fields.get('status')), 'TASK_STATUS');
  const dependencies = fields.get('depends_on');
  assert.match(dependencies, /^\[(?:(?:SH|CX|CP|PUB)-\d{3}(?:, (?:SH|CX|CP|PUB)-\d{3})*)?\]$/, 'TASK_DEPENDENCIES');
  assert.match(text, /## Acceptance criteria\r?\n/, 'TASK_ACCEPTANCE');
  assert.match(text, /- \[[ x]\] /, 'TASK_CRITERIA_REQUIRED');
  assert.match(text, /## Evidence and handoff\r?\n/, 'TASK_EVIDENCE');
  return { id, dependencies: dependencies.slice(1, -1).split(', ').filter(Boolean) };
}
function graph(tasks) {
  const nodes = new Map();
  for (const task of tasks) {
    assert.ok(!nodes.has(task.id), 'TASK_DUPLICATE'); nodes.set(task.id, task);
    assert.equal(new Set(task.dependencies).size, task.dependencies.length, 'TASK_DUPLICATE_DEPENDENCY');
  }
  const active = new Set(); const complete = new Set();
  function visit(id) {
    assert.ok(nodes.has(id), 'TASK_UNKNOWN_DEPENDENCY');
    assert.ok(!active.has(id), 'TASK_CYCLE');
    if (complete.has(id)) return;
    active.add(id);
    for (const dependency of nodes.get(id).dependencies) visit(dependency);
    active.delete(id); complete.add(id);
  }
  for (const id of nodes.keys()) visit(id);
  return nodes;
}
function ancestors(nodes, id, seen = new Set()) {
  for (const dependency of nodes.get(id).dependencies) {
    if (seen.has(dependency)) continue;
    seen.add(dependency); ancestors(nodes, dependency, seen);
  }
  return seen;
}
async function load() {
  const tasks = [];
  for (const phase of ['shell', 'concept', 'companion', 'publication']) {
    const folder = join(root, 'docs/tasks', phase);
    for (const name of (await readdir(folder)).filter(name => name.endsWith('.md'))) {
      tasks.push(parseTask(await readFile(join(folder, name), 'utf8'), name));
    }
  }
  return graph(tasks);
}

test('[TASK-01] real task graph preserves all stable IDs, is acyclic and covers shell/conversion gates', async () => {
  const nodes = await load();
  for (const [prefix, count] of [['SH', 22], ['CX', 7], ['CP', 10], ['PUB', 5]]) {
    for (let number = 1; number <= count; number++) assert.ok(nodes.has(`${prefix}-${String(number).padStart(3, '0')}`));
  }
  const shell = ancestors(nodes, 'SH-022');
  for (const id of nodes.keys()) if (id.startsWith('SH-') && id !== 'SH-022') assert.ok(shell.has(id), `SHELL_GATE_OMITS_${id}`);
  assert.ok(![...shell].some(id => id.startsWith('CP-') || id.startsWith('PUB-')), 'SHELL_GATE_AFTER_CONVERSION');
  const conversion = ancestors(nodes, 'CP-001');
  assert.ok(conversion.has('SH-022') && conversion.has('CX-007'), 'CONVERSION_BYPASSES_GATE');
  assert.ok(ancestors(nodes, 'PUB-004').has('CP-010'), 'PUBLICATION_BYPASSES_NATIVE');
});

test('[TASK-02] acceptance routing retains exact 96 legacy and 34 Nuxt IDs without replacing status/modes', async () => {
  const nodes = await load();
  const plan = JSON.parse(await readFile(join(root, 'docs/testing/test-plan.json'), 'utf8'));
  const crosswalk = JSON.parse(await readFile(join(root, 'docs/development/preconversion-acceptance-tasks.json'), 'utf8'));
  const nuxt = await readFile(join(root, 'docs/testing/NUXT-UI-ACCEPTANCE.md'), 'utf8');
  const ids = [...nuxt.matchAll(/^\| (NUI-\d{2}) \|/gm)].map(match => match[1]);
  assert.equal(crosswalk.schemaVersion, 1);
  assert.equal(plan.acceptance.length, 96); assert.equal(ids.length, 34);
  assert.deepEqual(Object.keys(crosswalk.legacyAcceptance).sort(), plan.acceptance.map(row => row.id).sort());
  assert.deepEqual(Object.keys(crosswalk.nuxtAcceptance).sort(), ids.sort());
  for (const routes of [crosswalk.legacyAcceptance, crosswalk.nuxtAcceptance]) {
    for (const tasks of Object.values(routes)) {
      assert.ok(Array.isArray(tasks) && tasks.length > 0);
      assert.equal(new Set(tasks).size, tasks.length);
      for (const id of tasks) assert.ok(nodes.has(id), 'ACCEPTANCE_UNKNOWN_TASK');
    }
  }
});

test('[TASK-03] negative controls reject cycles, missing nodes, duplicate metadata and unsupported states', () => {
  assert.throws(() => graph([{ id: 'SH-001', dependencies: ['SH-002'] }, { id: 'SH-002', dependencies: ['SH-001'] }]), /TASK_CYCLE/);
  assert.throws(() => graph([{ id: 'SH-001', dependencies: ['SH-999'] }]), /TASK_UNKNOWN_DEPENDENCY/);
  assert.throws(() => graph([{ id: 'SH-001', dependencies: [] }, { id: 'SH-001', dependencies: [] }]), /TASK_DUPLICATE/);
  assert.throws(() => graph([{ id: 'SH-001', dependencies: ['SH-001', 'SH-001'] }]), /TASK_DUPLICATE_DEPENDENCY/);
  const text = '---\ntask_id: SH-001\nstatus: planned\ndepends_on: []\n---\n## Acceptance criteria\n- [ ] Meaningful evidence\n## Evidence and handoff\n';
  assert.equal(parseTask(text, 'SH-001.md').id, 'SH-001');
  assert.throws(() => parseTask(text.replace('planned', 'complete'), 'SH-001.md'), /TASK_STATUS/);
  assert.throws(() => parseTask(text.replace('status: planned', 'status: planned\nstatus: done'), 'SH-001.md'), /TASK_FRONTMATTER_FIELD/);
  assert.throws(() => parseTask(text, 'SH-002.md'), /TASK_FILE_ID/);
});
