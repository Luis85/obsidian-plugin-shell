// Structural contract of the chained ideation skills (.claude/skills/ideation-*), their Codex adapters and the shared tool map.
// The command catalog is read from the real CLI (capabilities, maker help, memory help), never from a copied list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
/** [skill, the skill its close section must offer next]; the last step hands off to the separately owned delivery skill. */
export const CHAIN = [
  ['ideation-journey', 'ideation-brainstorm'], ['ideation-brainstorm', 'ideation-concept'], ['ideation-concept', 'ideation-design'],
  ['ideation-design', 'ideation-prototype'], ['ideation-prototype', 'ideation-boilerplate'], ['ideation-boilerplate', 'feature-delivery'],
];
const REQUIRED_GROUPS = ['brainstorm', 'concept', 'project', 'sketch', 'prototype', 'prototypes', 'new', 'starters', 'design', 'handout',
  'generate', 'plan', 'clickdummy', 'make', 'ui', 'check', 'status', 'doctor', 'memory'];
const CLOSE = '## Close: follow-up questions';
const WORD = /^[a-z][a-z0-9-]*$/;
/** A one-line YAML plain scalar: no block indicator, no `: ` mapping separator and no ` #` comment. */
const plainScalar = value => value.length >= 40 && !/^[>|&*!%@`'"[{]/.test(value) && !/: | #/.test(value);
const read = path => readFileSync(join(root, path), 'utf8');

function cli(...args) {
  const run = spawnSync(process.execPath, ['bin/app', ...args], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  assert.equal(run.error, undefined, `node bin/app ${args.join(' ')} did not start`);
  return run.stdout;
}
/** Every invocable command id: the framework catalog, the maker surface (from its own help) and the memory surface. */
export function loadCatalog() {
  const capabilities = JSON.parse(cli('capabilities', '--json')).data;
  const ids = new Set(capabilities.commands.map(entry => entry.id));
  const positional = new Set(capabilities.commands.filter(entry => entry.maxArgs > 0).map(entry => entry.id));
  for (const line of cli('brainstorm', '--help').split('\n')) {
    const [command, action] = (/^\s*node bin\/app\s+(.*)$/.exec(line)?.[1] ?? '').trim().split(/\s+/);
    if (!WORD.test(command ?? '')) continue;
    ids.add(command);
    if (WORD.test(action ?? '')) ids.add(`${command} ${action}`);
  }
  ids.add('memory');
  for (const line of cli('help', 'memory').split('\n')) {
    const names = /^ {2}([a-z][a-z-]*(?:\|[a-z][a-z-]*)*)(?:\s|$)/.exec(line)?.[1];
    for (const name of names?.split('|') ?? []) ids.add(`memory ${name}`);
  }
  return { ids, positional, recipes: new Set([...capabilities.makers.map(maker => maker.id), 'list', 'describe']),
    roots: new Set([...ids].map(id => id.split(' ')[0])) };
}
/** Token lists after each `node bin/app` in Markdown: up to a closing backtick, a shell comment or the end of the line. */
export function citations(text) {
  return [...text.matchAll(/node bin\/app([^`\n#]*)/g)].map(match => match[1].trim().split(/\s+/).filter(Boolean));
}
function resolveOne(command, action, catalog) {
  if (action === undefined || !WORD.test(action)) return catalog.ids.has(command) ? null : `unknown command "${command}"`;
  if (catalog.ids.has(`${command} ${action}`)) return null;
  if (command === 'make') return catalog.recipes.has(action) ? null : `unknown make recipe "${action}"`;
  return catalog.ids.has(command) && catalog.positional.has(command) ? null : `unknown command "${command} ${action}"`;
}
/** Null when the cited tokens name a real command, otherwise the reason. `help` validates the command it describes. */
export function resolveCitation(tokens, catalog) {
  const [command, action] = tokens;
  if (command === undefined) return null;
  if (command === 'help') return action === undefined || action.startsWith('<') || action.startsWith('-') ? null : resolveCitation(tokens.slice(1), catalog);
  if (!WORD.test(command)) return `unknown command "${command}"`;
  const actions = action?.includes('|') ? action.split('|') : [action];
  return actions.map(item => resolveOne(command, item, catalog)).find(Boolean) ?? null;
}
/** The catalog id a citation exercises: "group action" when that id exists, otherwise the root command. */
export function commandKey(tokens, catalog) {
  const [command, action] = tokens[0] === 'help' ? tokens.slice(1) : tokens;
  return action && catalog.ids.has(`${command} ${action}`) ? `${command} ${action}` : command;
}
function skillCorpus(name) {
  const references = join(root, '.claude/skills', name, 'references');
  const extra = existsSync(references) ? readdirSync(references).filter(file => file.endsWith('.md')).map(file => `.claude/skills/${name}/references/${file}`) : [];
  return [`.claude/skills/${name}/SKILL.md`, ...extra].map(path => ({ path, text: read(path) }));
}
/** Failures of one Markdown file of a skill: local references, links, repository skill paths and cited commands. */
export function checkFile({ path, text }, catalog, exists = file => existsSync(join(root, file))) {
  const failures = [], folder = posix.dirname(path), skillDir = path.split('/').slice(0, 3).join('/');
  for (const [, file] of text.matchAll(/(?<![\w./-])(references\/[\w./-]+\.md)/g))
    if (!exists(posix.join(skillDir, file))) failures.push(`${path}: missing ${file}`);
  for (const [, link] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g))
    if (!/^[a-z]+:/.test(link) && !exists(posix.normalize(posix.join(folder, link)))) failures.push(`${path}: broken link ${link}`);
  for (const [, file] of text.matchAll(/(\.claude\/skills\/[\w./-]*[\w-])/g))
    if (!exists(file)) failures.push(`${path}: missing ${file}`);
  for (const tokens of citations(text)) {
    const reason = resolveCitation(tokens, catalog);
    if (reason) failures.push(`${path}: node bin/app ${tokens.slice(0, 2).join(' ')}: ${reason}`);
  }
  return failures;
}
/** Failures of a chain SKILL.md: frontmatter, size, and a final close section that asks via AskUserQuestion and names the next skill. */
export function checkSkill({ name, next, text }) {
  const failures = [];
  const front = /^---\nname: (.*)\ndescription: (.*)\n(?:[a-z-]+: .*\n)*---\n/.exec(text);
  if (!front) failures.push(`${name}: frontmatter must start with name: then a single-line description:`);
  else {
    if (front[1] !== name) failures.push(`${name}: frontmatter name "${front[1]}" does not match the directory`);
    if (!plainScalar(front[2])) failures.push(`${name}: description must be one plain-scalar line of at least 40 characters`);
  }
  const lines = text.split('\n');
  if (lines.length > 150) failures.push(`${name}: ${lines.length} lines; keep SKILL.md at 150 lines and move detail to references/`);
  const start = lines.indexOf(CLOSE);
  if (start < 0) return [...failures, `${name}: missing the "${CLOSE}" close section`];
  const section = lines.slice(start + 1);
  if (section.some(line => /^#{1,2} /.test(line))) failures.push(`${name}: the close section must be the final section`);
  const body = section.join('\n');
  if (!body.includes('AskUserQuestion')) failures.push(`${name}: the close section must use the AskUserQuestion tool`);
  if (!body.includes(`\`${next}\``)) failures.push(`${name}: the close section must name the next skill \`${next}\``);
  if (!/\bwait\b/.test(body)) failures.push(`${name}: the close section must wait for the user's answer`);
  const questions = section.filter(line => /^\d+\. /.test(line)).length;
  if (questions < 2 || questions > 4) failures.push(`${name}: the close section must list 2-4 questions, found ${questions}`);
  return failures;
}
/** Failures of a thin Codex adapter: same name, a real description and the canonical relative path. */
export function checkAdapter(name, text) {
  const failures = [], target = `../../../.claude/skills/${name}/SKILL.md`;
  const description = new RegExp(`^---\\nname: ${name}\\ndescription: (.*)\\n`).exec(text)?.[1];
  if (!description || !plainScalar(description)) failures.push(`${name}: adapter frontmatter needs the name and a plain one-line description`);
  if (!text.includes(target)) failures.push(`${name}: adapter must point at ${target}`);
  else if (posix.normalize(posix.join(`.agents/skills/${name}`, target)) !== `.claude/skills/${name}/SKILL.md`) failures.push(`${name}: adapter path does not resolve`);
  if (text.split('\n').length > 40) failures.push(`${name}: adapter must stay thin`);
  return failures;
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
