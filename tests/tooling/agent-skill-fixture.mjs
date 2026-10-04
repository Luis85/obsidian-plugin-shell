// Shared structural checks for the agent skills under .claude/skills (frontmatter, close section, Codex adapters,
// cited files and `node bin/app` commands). The command catalog is read from the real CLI, never from a copied list.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const CLOSE = '## Close: follow-up questions';
const WORD = /^[a-z][a-z0-9-]*$/;
/** A one-line YAML plain scalar: no block indicator, no `: ` mapping separator and no ` #` comment. */
const plainScalar = value => value.length >= 40 && !/^[>|&*!%@`'"[{]/.test(value) && !/: | #/.test(value);
export const read = path => readFileSync(join(root, path), 'utf8');

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
  // Three-word commands (`increment ac add`, `pr task set`) are only valid as a whole.
  const third = tokens[2];
  if (WORD.test(action ?? '') && WORD.test(third ?? '') && catalog.ids.has(`${command} ${action} ${third}`)) return null;
  const actions = action?.includes('|') ? action.split('|') : [action];
  return actions.map(item => resolveOne(command, item, catalog)).find(Boolean) ?? null;
}
export function skillCorpus(name) {
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
