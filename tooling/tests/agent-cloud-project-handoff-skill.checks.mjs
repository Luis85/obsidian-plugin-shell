// Contract of the cloud-project-handoff skill (.claude/skills/cloud-project-handoff) and its Codex adapter: structure,
// cited commands and files, safety rules, a fully documented takeover prompt, and that the documented project-JSON
// recipe really produces a schema 6 project that `project validate` accepts and `new --from` plans without conflicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAdapter, checkFile, checkSkill, loadCatalog, read, root, skillCorpus } from './agent-skill-fixture.mjs';

const NAME = 'cloud-project-handoff';
const SKILL = `.claude/skills/${NAME}/SKILL.md`;
const RECIPE = `.claude/skills/${NAME}/references/project-json.md`;
const TAKEOVER = `.claude/skills/${NAME}/references/takeover-prompt.md`;
const ARGS = ['delivery-management', 'Delivery Management', 'Luis Mendez', 'Delivery management for Obsidian.', 'Delivery Management', 'resources planner'];

/** The JavaScript of the `node -e` recipe after the derive-project-json marker. */
export function recipeCode(text) {
  const block = /<!-- derive-project-json -->\n```sh\nnode -e '\n([\s\S]*?)\n' /.exec(text);
  assert.ok(block, 'the recipe keeps its marked node -e block');
  return block[1];
}
/** The takeover prompt (the fenced text block) and the placeholders its table documents. */
export function takeoverParts(text) {
  const prompt = /```text\n([\s\S]*?)\n```/.exec(text)?.[1] ?? '';
  const documented = new Set([...text.matchAll(/^\| `(<[^`]+>)`(?: \/ `(<[^`]+>)`)? \|/gm)].flatMap(match => match.slice(1).filter(Boolean)));
  return { prompt, documented };
}
/** Placeholders used in the prompt but missing from the table, and documented ones the prompt never uses. */
export function placeholderFailures({ prompt, documented }) {
  const used = new Set(prompt.match(/<[a-z][a-z ]*>/g) ?? []);
  return [...[...used].filter(name => !documented.has(name)).map(name => `undocumented ${name}`),
    ...[...documented].filter(name => !used.has(name)).map(name => `unused ${name}`)];
}
const runRecipe = (code, starter, out, args = ARGS) =>
  spawnSync(process.execPath, ['-e', code, join(root, starter), out, ...args], { cwd: root, encoding: 'utf8', timeout: 60_000 });
const app = (...args) => spawnSync(process.execPath, ['bin/app', ...args], { cwd: root, encoding: 'utf8', timeout: 180_000 });

test('the skill has matching frontmatter, a compact body and a final AskUserQuestion close naming increment-handoff', () => {
  assert.deepEqual(checkSkill({ name: NAME, next: 'increment-handoff', text: read(SKILL) }), []);
});
test('every cited references file, link, skill path and node bin/app command exists in the real CLI', () => {
  const files = skillCorpus(NAME);
  assert.equal(files.length, 3, 'SKILL.md and both references');
  assert.deepEqual(files.flatMap(file => checkFile(file, loadCatalog())), []);
  for (const command of ['node bin/app new', 'node bin/app project validate', 'node bin/app starters show']) assert.ok(read(SKILL).includes(command), command);
});
test('the skill keeps its authorization and safety rules, and the takeover prompt keeps the local limits', () => {
  const text = read(SKILL);
  for (const phrase of [/Loading this skill authorizes nothing outside the session scratchpad/, /Never write the generated project into this checkout/,
    /never weaken a gate/, /Never delete files by hand/, /Never commit to this checkout/]) assert.match(text, phrase);
  const { prompt } = takeoverParts(read(TAKEOVER));
  for (const phrase of [/Never run `npm install`/, /Do not add a git remote, push/, /never my personal vault/, /Do not start building features yet/,
    /`_handoff` subfolder/, /not a nested `<id>\\<id>`/, /Do not weaken thresholds or skip tests/]) assert.match(prompt, phrase);
});
test('every takeover placeholder is documented and every documented placeholder is used', () => {
  const parts = takeoverParts(read(TAKEOVER));
  assert.ok(parts.prompt.length > 1000 && parts.documented.size >= 12);
  assert.deepEqual(placeholderFailures(parts), []);
});
test('the skill has a thin Codex adapter pointing at its canonical SKILL.md', () => {
  assert.deepEqual(checkAdapter(NAME, read(`.agents/skills/${NAME}/SKILL.md`)), []);
});

test('the documented recipe derives a valid project from the blank starter that new --from plans without conflicts', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'cloud-handoff-'));
  try {
    const out = join(folder, 'delivery-management.companion.json');
    const derived = runRecipe(recipeCode(read(RECIPE)), 'configs/starters/blank.json', out);
    assert.equal(derived.status, 0, derived.stderr);
    const doc = JSON.parse(await readFile(out, 'utf8')), starter = JSON.parse(read('configs/starters/blank.json')).generator.document;
    assert.deepEqual(doc.project, { ...starter.project, id: ARGS[0], name: ARGS[1], author: ARGS[2], description: ARGS[3] });
    const view = doc.design.nodes.find(node => node.entry);
    assert.deepEqual([view.label, view.slug, view.ribbon, view.goal], ['Delivery Management', 'delivery-management', true,
      'Host the Delivery Management workspace; first feature: resources planner.']);
    assert.deepEqual(doc.design.nodes.slice(1), starter.design.nodes.slice(1), 'other nodes stay as the starter declares them');
    const validated = app('project', 'validate', '--input', out, '--json');
    assert.equal(validated.status, 0, validated.stdout);
    assert.deepEqual([JSON.parse(validated.stdout).data.valid, JSON.parse(validated.stdout).data.findings], [true, []]);
    const planned = app('new', join(folder, 'delivery-management'), '--from', out, '--dry-run', '--json');
    assert.equal(planned.status, 0, planned.stderr);
    const result = JSON.parse(planned.stdout);
    assert.deepEqual([result.status, result.data.conflicts, result.data.written], ['planned', [], false]);
    assert.equal(existsSync(join(folder, 'delivery-management')), false, 'a preview writes nothing');
    assert.match(result.data.planHash, /^[0-9a-f]{64}$/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('negative: the recipe refuses a project starter and an unusable view label, and the checkers catch drift', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'cloud-handoff-'));
  try {
    const code = recipeCode(read(RECIPE)), out = join(folder, 'out.json');
    const project = runRecipe(code, 'configs/starters/cli.json', out);
    assert.notEqual(project.status, 0);
    assert.match(project.stderr, /not a companion starter: cli/);
    const label = runRecipe(code, 'configs/starters/blank.json', out, [...ARGS.slice(0, 4), '!!', 'x']);
    assert.notEqual(label.status, 0);
    assert.match(label.stderr, /the view label needs at least one letter or digit/);
  } finally { await rm(folder, { recursive: true, force: true }); }
  assert.deepEqual(placeholderFailures({ prompt: 'Use <id> and <owner>.', documented: new Set(['<id>', '<target folder>']) }),
    ['undocumented <owner>', 'unused <target folder>']);
  assert.throws(() => recipeCode('```sh\nnode -e \'x\' a\n```'), /marked node -e block/);
  const skill = read(SKILL);
  assert.match(checkSkill({ name: NAME, next: 'increment-handoff', text: skill.replace('`increment-handoff`', '`feature-delivery`') }).join('\n'), /must name the next skill/);
  assert.match(checkFile({ path: SKILL, text: '`node bin/app nwe --dry-run`' }, loadCatalog()).join('\n'), /unknown command "nwe"/);
});
