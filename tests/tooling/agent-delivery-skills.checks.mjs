// Structural contract of the delivery skills (.claude/skills/feature-delivery and release) and their Codex adapters:
// frontmatter, a final AskUserQuestion close, and that every cited file, npm script, release script, workflow file
// and `node bin/app ci --job` target exists in this checkout. The command catalog comes from the real CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkAdapter, checkFile, checkSkill, loadCatalog, read, root, skillCorpus } from './agent-skill-fixture.mjs';

/** [skill, the skill its close section must offer next, phrases its hard rules must keep]. */
const SKILLS = [
  ['feature-delivery', 'self-review', [/explicit request in this conversation/, /Never dispatch Release cut or Publish/, /merge commit/, /Never weaken a threshold/]],
  ['release', 'feature-delivery', [/Loading this skill authorizes nothing/, /Never move, delete or recreate a tag/, /explicit confirmation/, /blocked release profile/]],
];

/** Repository facts the citations are checked against: files on disk, npm scripts and workflow jobs. */
function loadFacts() {
  const scripts = new Set(Object.keys(JSON.parse(read('package.json')).scripts));
  const jobs = new Map(readdirSync(join(root, '.github/workflows')).filter(file => file.endsWith('.yml'))
    .map(file => [file, new Set(Object.keys(parse(read(`.github/workflows/${file}`)).jobs))]));
  return { exists: file => existsSync(join(root, file)), scripts, jobs };
}
/** Failures of one skill file's repository citations (beyond the shared checkFile rules). */
export function checkCitations({ path, text }, facts) {
  const failures = [];
  for (const [, file] of text.matchAll(/node (scripts\/[\w./-]+\.mjs)/g))
    if (!facts.exists(file)) failures.push(`${path}: missing ${file}`);
  for (const [, file] of text.matchAll(/(?<![\w/-])((?:docs|\.github)\/[\w./-]*\.(?:md|yml))/g))
    if (!facts.exists(file)) failures.push(`${path}: missing ${file}`);
  for (const [, name] of text.matchAll(/(?<![\w/.-])([a-z][a-z0-9-]*\.yml)\b/g))
    if (!facts.jobs.has(name)) failures.push(`${path}: unknown workflow ${name}`);
  // `npm run release*` names a pattern (the denied script family), not one script.
  for (const [, name] of text.matchAll(/npm run ([a-z][\w:-]*)(?![\w:*-])/g))
    if (!facts.scripts.has(name)) failures.push(`${path}: unknown npm script ${name}`);
  for (const [, workflow, job] of text.matchAll(/ci --job ([a-z][\w-]*)\/([a-z][\w-]*)/g))
    if (!facts.jobs.get(`${workflow}.yml`)?.has(job)) failures.push(`${path}: unknown CI job ${workflow}/${job}`);
  return failures;
}

let cached;
/** The real CLI catalog; a bare group root (`node bin/app release ...`) names that group. */
const catalog = () => {
  if (cached) return cached;
  const loaded = loadCatalog();
  return (cached = { ...loaded, ids: new Set([...loaded.ids, ...loaded.roots]) });
};

test('every delivery skill has matching frontmatter, a compact body and a final AskUserQuestion close naming the next skill', () => {
  for (const [name, next] of SKILLS) assert.deepEqual(checkSkill({ name, next, text: read(`.claude/skills/${name}/SKILL.md`) }), [], name);
});
test('every delivery skill keeps its authorization and safety rules', () => {
  for (const [name, , phrases] of SKILLS) {
    const text = read(`.claude/skills/${name}/SKILL.md`);
    for (const phrase of phrases) assert.match(text, phrase, name);
  }
});
test('every cited references file, link, skill path, node bin/app command, script, npm script, workflow and CI job exists', () => {
  const facts = loadFacts();
  const files = SKILLS.flatMap(([name]) => skillCorpus(name));
  assert.ok(files.length >= 4, 'each skill keeps its references');
  assert.deepEqual(files.flatMap(file => [...checkFile(file, catalog()), ...checkCitations(file, facts)]), []);
  const text = files.map(file => file.text).join('\n');
  for (const cited of ['release-cut.yml', 'publish.yml', 'scripts/release/cut.mjs', 'scripts/release/publish.mjs', 'scripts/release/changelog.mjs'])
    assert.ok(text.includes(cited), `the skills cite ${cited}`);
});
test('every delivery skill has a thin Codex adapter pointing at its canonical SKILL.md', () => {
  for (const [name] of SKILLS) assert.deepEqual(checkAdapter(name, read(`.agents/skills/${name}/SKILL.md`)), [], name);
});
test('the ideation chain hands off to feature-delivery', () => {
  assert.match(read('.claude/skills/ideation-boilerplate/SKILL.md'), /`feature-delivery`/);
  assert.match(read('.claude/skills/ideation-journey/references/chain.md'), /feature-delivery/);
});

test('negative: the checkers fail on missing scripts, unknown npm scripts, workflows and jobs, a lost rule and a missing close', () => {
  const facts = loadFacts();
  const file = { path: '.claude/skills/release/SKILL.md', text: [
    'Run `node scripts/release/absent.mjs` and `npm run release:absent`.',
    'Dispatch `absent-workflow.yml`, read `docs/development/ABSENT.md`, then `node bin/app ci --job publish/absent`.',
    'Denied: `npm run release*`; real: `npm run check:repository` and `node bin/app ci --job dev/fast`.',
  ].join('\n') };
  const failures = checkCitations(file, facts).join('\n');
  for (const expected of [/missing scripts\/release\/absent\.mjs/, /unknown npm script release:absent/, /unknown workflow absent-workflow\.yml/,
    /missing docs\/development\/ABSENT\.md/, /unknown CI job publish\/absent/]) assert.match(failures, expected);
  assert.equal(checkCitations(file, facts).length, 5, 'valid citations and the denied pattern pass');
  assert.match(checkFile({ path: file.path, text: '`node bin/app relaese check`' }, catalog()).join('\n'), /unknown command/);
  const valid = read('.claude/skills/release/SKILL.md');
  assert.match(checkSkill({ name: 'release', next: 'feature-delivery', text: valid.slice(0, valid.indexOf('## Close')) }).join('\n'), /missing the "## Close/);
  assert.doesNotMatch(valid.replace('Loading this skill authorizes nothing', 'Loading this skill is enough'), SKILLS[1][2][0]);
  assert.match(checkAdapter('release', '---\nname: release\ndescription: Codex adapter that points at the wrong canonical skill file.\n---\nRead ../../../.claude/skills/feature-delivery/SKILL.md\n').join('\n'), /must point at/);
});
