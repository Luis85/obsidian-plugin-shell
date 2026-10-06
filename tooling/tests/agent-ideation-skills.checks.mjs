// Structural contract of the chained ideation skills (.claude/skills/ideation-*), their Codex adapters and the shared tool map.
// The command catalog is read from the real CLI (capabilities, maker help, memory help), never from a copied list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CLOSE, checkAdapter, checkFile, checkSkill, citations, loadCatalog, read, resolveCitation, root, skillCorpus } from './agent-skill-fixture.mjs';

/**
 * [skill, the skill its close section must offer next]; the last step hands off to the separately owned increment-handoff
 * skill (Definition of Ready), which agent-delivery-skills.checks.mjs covers together with feature-delivery.
 */
export const CHAIN = [
  ['ideation-journey', 'ideation-brainstorm'], ['ideation-brainstorm', 'ideation-concept'], ['ideation-concept', 'ideation-design'],
  ['ideation-design', 'ideation-prototype'], ['ideation-prototype', 'ideation-boilerplate'], ['ideation-boilerplate', 'increment-handoff'],
];
const REQUIRED_GROUPS = ['brainstorm', 'concept', 'project', 'sketch', 'prototype', 'prototypes', 'new', 'starters', 'design', 'handout',
  'generate', 'plan', 'clickdummy', 'make', 'ui', 'check', 'status', 'doctor', 'memory'];
/** The catalog id a citation exercises: "group action" when that id exists, otherwise the root command. */
export function commandKey(tokens, catalog) {
  const [command, action] = tokens[0] === 'help' ? tokens.slice(1) : tokens;
  return action && catalog.ids.has(`${command} ${action}`) ? `${command} ${action}` : command;
}
/** Tool-map rows of the "Used by the chain" table as { tokens, skills }. */
export function toolMapRows(text) {
  const used = text.split('\n## ')[1] ?? '';
  return used.split('\n').filter(line => line.startsWith('| `node bin/app')).map(line => {
    const [command, skills] = line.split(' | ');
    return { tokens: citations(command)[0], skills: [...skills.matchAll(/`(ideation-[a-z]+)`/g)].map(match => match[1]) };
  });
}
/** Failures of the tool map: each row's skills really cite that command, and every CLI root and required group is listed. */
export function checkToolMap(text, catalog, corpusKeys) {
  const failures = [], rows = toolMapRows(text);
  for (const { tokens, skills } of rows) {
    const key = commandKey(tokens, catalog);
    if (!skills.length) failures.push(`tool map: ${key} names no chain skill`);
    for (const skill of skills) if (!corpusKeys(skill).has(key)) failures.push(`tool map: ${skill} does not cite node bin/app ${key}`);
  }
  const usedRoots = new Set(rows.map(row => row.tokens[0]));
  for (const group of REQUIRED_GROUPS) if (!usedRoots.has(group)) failures.push(`tool map: required group ${group} is not used by the chain`);
  const listedRoots = new Set(citations(text).map(tokens => tokens[0]));
  for (const rootCommand of catalog.roots) if (!listedRoots.has(rootCommand)) failures.push(`tool map: CLI command ${rootCommand} is neither used nor listed outside the chain`);
  return failures;
}

let cached;
const catalog = () => (cached ??= loadCatalog());
const keysOf = name => new Set(skillCorpus(name).flatMap(file => citations(file.text)).map(tokens => commandKey(tokens, catalog())));

test('every chain skill has matching frontmatter, a compact body and a final AskUserQuestion close naming the next skill', () => {
  for (const [name, next] of CHAIN) assert.deepEqual(checkSkill({ name, next, text: read(`.claude/skills/${name}/SKILL.md`) }), [], name);
});
test('every cited references file, link, skill path and node bin/app command exists in the real CLI', () => {
  const failures = CHAIN.flatMap(([name]) => skillCorpus(name).flatMap(file => checkFile(file, catalog())));
  assert.deepEqual(failures, []);
  assert.ok(CHAIN.every(([name]) => citations(read(`.claude/skills/${name}/SKILL.md`)).length > 0));
});
test('every chain skill has a thin Codex adapter pointing at its canonical SKILL.md', () => {
  for (const [name] of CHAIN) assert.deepEqual(checkAdapter(name, read(`.agents/skills/${name}/SKILL.md`)), [], name);
});
test('the tool map covers every CLI command group and matches what each skill cites', () => {
  assert.deepEqual(checkToolMap(read('.claude/skills/ideation-journey/references/tool-map.md'), catalog(), keysOf), []);
});
test('the companion-prototype-design package is delegated to by reference, not copied', () => {
  for (const name of ['ideation-design', 'ideation-prototype']) assert.match(read(`.claude/skills/${name}/SKILL.md`), /\.claude\/skills\/companion-prototype-design\/SKILL\.md/, name);
  assert.ok(!existsSync(join(root, '.claude/skills/ideation-design/scripts')) && !existsSync(join(root, '.claude/skills/ideation-prototype/scripts')));
});

test('negative: the checkers fail on a missing close section, unknown commands, a wrong adapter and an unbacked tool-map row', () => {
  const valid = read('.claude/skills/ideation-concept/SKILL.md');
  const withoutClose = valid.slice(0, valid.indexOf(CLOSE));
  assert.match(checkSkill({ name: 'ideation-concept', next: 'ideation-design', text: withoutClose }).join('\n'), /missing the "## Close: follow-up questions" close section/);
  assert.match(checkSkill({ name: 'ideation-concept', next: 'ideation-prototype', text: valid }).join('\n'), /must name the next skill `ideation-prototype`/);
  assert.match(checkSkill({ name: 'ideation-concept', next: 'ideation-design', text: `${valid}\n## Later\n` }).join('\n'), /must be the final section/);
  assert.match(checkSkill({ name: 'ideation-other', next: 'ideation-design', text: valid }).join('\n'), /does not match the directory/);
  assert.match(checkSkill({ name: 'ideation-concept', next: 'ideation-design', text: valid.replace(/description: .*/, 'description: Step 2: converge a PRD into a validated definition here.') }).join('\n'), /plain-scalar/);
  for (const tokens of [['brainstrom', 'guide'], ['brainstorm', 'ideate'], ['make', 'widget', 'x'], ['help', 'prototypes'], ['prototypes', 'clone']])
    assert.notEqual(resolveCitation(tokens, catalog()), null, tokens.join(' '));
  for (const tokens of [['brainstorm', 'guide'], ['new', '../folio', '--from'], ['new', 'starters'], ['make', 'feature', 'notes'], ['memory', 'recall'], ['help', 'ui', 'gallery']])
    assert.equal(resolveCitation(tokens, catalog()), null, tokens.join(' '));
  const file = { path: '.claude/skills/ideation-concept/SKILL.md', text: 'See references/absent.md and `node bin/app sketch publish`.' };
  assert.deepEqual(checkFile(file, catalog(), () => false).length, 2);
  assert.match(checkAdapter('ideation-concept', '---\nname: ideation-concept\ndescription: Codex adapter that points at the wrong canonical file.\n---\nRead ../../../.claude/skills/ideation-design/SKILL.md\n').join('\n'), /must point at/);
  const row = '# Map\n\n## Used\n\n| `node bin/app clickdummy build` | `ideation-brainstorm` | process | x |\n';
  assert.match(checkToolMap(row, catalog(), keysOf).join('\n'), /ideation-brainstorm does not cite node bin\/app clickdummy build/);
  assert.match(checkToolMap(row, catalog(), keysOf).join('\n'), /required group brainstorm is not used/);
});
