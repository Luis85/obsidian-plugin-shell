// Structural contract of the handoff and delivery skills (.claude/skills/increment-handoff, feature-delivery and release)
// and their Codex adapters: frontmatter, a final AskUserQuestion close, and that every cited file, npm script, release
// and delivery script, workflow file and `node bin/app ci --job` target exists in this checkout. The command catalog
// comes from the real CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkAdapter, checkFile, checkSkill, loadCatalog, read, root, skillCorpus } from './agent-skill-fixture.mjs';

/** [skill, the skill its close section must offer next, phrases its hard rules must keep]. */
const SKILLS = [
  ['increment-handoff', 'feature-delivery', [/not permission to implement/, /explicit request in this conversation/, /Never weaken, disable or reconfigure a rule/, /refinement brief/]],
  ['feature-delivery', 'self-review', [/explicit request in this conversation/, /Never dispatch Release cut or Publish/, /merge commit/, /Never weaken a threshold/, /Never edit `configs\/delivery\/\*\*`/]],
  ['release', 'feature-delivery', [/Loading this skill authorizes nothing/, /Never move, delete or recreate a tag/, /explicit confirmation/, /blocked release profile/, /exempt from the Definition of Ready and Done/]],
];
/**
 * The Definition of Ready / Definition of Done contract the skills cite, in one place. The DoR/DoD change adds these
 * scripts, configuration files, workflows and release.yml alias jobs; in a checkout without that change the contract
 * test and the citation test report exactly these paths as missing, and nothing else.
 */
export const DOR_DOD = Object.freeze({
  scripts: ['scripts/delivery/increment.mjs', 'scripts/delivery/ready.mjs', 'scripts/delivery/done.mjs'],
  configs: ['configs/delivery/increment-handoff.template.md', 'configs/delivery/definition-of-ready.json', 'configs/delivery/definition-of-done.json'],
  jobs: [['definition-of-ready.yml', 'Definition of Ready'], ['definition-of-done.yml', 'Definition of Done'],
    ['release.yml', 'Definition of Ready'], ['release.yml', 'Definition of Done']],
});
const DELIVERY_SCRIPT = /node (scripts\/delivery\/[\w.-]+\.mjs)/g;

/** Repository facts the citations are checked against: files on disk, npm scripts and workflow jobs (ids and names). */
function loadFacts() {
  const scripts = new Set(Object.keys(JSON.parse(read('package.json')).scripts));
  const parsed = readdirSync(join(root, '.github/workflows')).filter(file => file.endsWith('.yml'))
    .map(file => [file, parse(read(`.github/workflows/${file}`)).jobs]);
  const jobs = new Map(parsed.map(([file, entries]) => [file, new Set(Object.keys(entries))]));
  const names = new Map(parsed.map(([file, entries]) => [file, Object.values(entries).map(job => job?.name)]));
  return { exists: file => existsSync(join(root, file)), scripts, jobs, jobNames: file => names.get(file) ?? [] };
}
/** Failures of one skill file's repository citations (beyond the shared checkFile rules). */
export function checkCitations({ path, text }, facts) {
  const failures = [];
  for (const [, file] of text.matchAll(/node (scripts\/[\w./-]+\.mjs)/g))
    if (!facts.exists(file)) failures.push(`${path}: missing ${file}`);
  for (const [, file] of text.matchAll(/(?<![\w/-])((?:docs|\.github|configs)\/[\w./-]*\.(?:md|yml|json))/g))
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
/**
 * Failures of the DoR/DoD contract: every cited delivery script belongs to it, its files and named jobs exist, and each
 * row of the tool map's delivery table is cited by every skill it names. `corpus` is [{ skill, text }].
 */
export function checkDeliveryContract({ corpus, toolMap, contract, facts }) {
  const failures = [], cites = new Map();
  for (const { skill, text } of corpus) for (const [, file] of text.matchAll(DELIVERY_SCRIPT)) {
    if (!contract.scripts.includes(file)) failures.push(`${skill}: ${file} is not part of the DoR/DoD contract`);
    if (!cites.has(skill)) cites.set(skill, new Set());
    cites.get(skill).add(file);
  }
  for (const file of [...contract.scripts, ...contract.configs]) if (!facts.exists(file)) failures.push(`missing ${file}`);
  for (const [workflow, name] of contract.jobs) if (!facts.jobNames(workflow).includes(name)) failures.push(`${workflow}: no job named "${name}"`);
  const rows = (toolMap.split('\n## ').find(part => part.startsWith('Increment handoff')) ?? '').split('\n').filter(line => line.startsWith('| `node scripts/delivery/'));
  for (const script of contract.scripts) if (!rows.some(row => row.includes(`node ${script}`))) failures.push(`tool map: no row for ${script}`);
  for (const row of rows) {
    const [command, skills = ''] = row.split(' | ');
    const script = /node (scripts\/delivery\/[\w.-]+\.mjs)/.exec(command)?.[1];
    for (const [, skill] of skills.matchAll(/`([a-z][a-z-]*)`/g)) if (!cites.get(skill)?.has(script)) failures.push(`tool map: ${skill} does not cite node ${script}`);
  }
  return failures;
}
/** Every skill's own text (SKILL.md and references, without the tool map that only lists commands). */
function allSkillTexts() {
  return readdirSync(join(root, '.claude/skills')).filter(name => existsSync(join(root, '.claude/skills', name, 'SKILL.md')))
    .flatMap(skill => skillCorpus(skill).filter(file => !file.path.endsWith('/tool-map.md')).map(file => ({ skill, text: file.text })));
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
  assert.ok(files.length >= 7, 'each skill keeps its references');
  assert.deepEqual(files.flatMap(file => [...checkFile(file, catalog()), ...checkCitations(file, facts)]), []);
  const text = files.map(file => file.text).join('\n');
  for (const cited of ['release-cut.yml', 'publish.yml', 'scripts/release/cut.mjs', 'scripts/release/publish.mjs', 'scripts/release/changelog.mjs',
    ...DOR_DOD.scripts, ...DOR_DOD.configs, 'definition-of-ready.yml', 'definition-of-done.yml'])
    assert.ok(text.includes(cited), `the skills cite ${cited}`);
});
test('the Definition of Ready and Done contract the skills cite exists, and the tool map rows match their citations', () => {
  const failures = checkDeliveryContract({ corpus: allSkillTexts(), toolMap: read('.claude/skills/ideation-journey/references/tool-map.md'), contract: DOR_DOD, facts: loadFacts() });
  assert.deepEqual(failures, []);
});
/** The increment CLI each delivery skill drives as its primary path (scripts/delivery stay the fallback). */
const CLI_PATHS = [
  ['increment-handoff', ['increment new', 'increment check', 'increment edit', 'increment ac add', 'increment status', 'issue new', 'pr publish', 'pr sync']],
  ['feature-delivery', ['increment check', 'pr new', 'pr task add', 'pr task set', 'pr publish', 'pr sync', 'pr amend', 'increment ac set']],
];
test('the delivery skills drive the increment CLI, keep remote writes behind an explicit request and link the increment docs', () => {
  for (const [name, commands] of CLI_PATHS) {
    const text = skillCorpus(name).map(file => file.text).join('\n');
    for (const command of commands) assert.ok(text.includes(`node bin/app ${command}`), `${name} cites node bin/app ${command}`);
    assert.match(read(`.claude/skills/${name}/SKILL.md`), /`pr publish`, `pr sync`[^.]*explicit request in this conversation/, `${name}: remote writes need an explicit request`);
    for (const doc of ['docs/development/FIRST-INCREMENT.md', 'docs/development/DEFINITION-OF-READY-AND-DONE.md']) assert.ok(text.includes(doc), `${name} links ${doc}`);
  }
  assert.match(read('.claude/skills/increment-handoff/SKILL.md'), /increment status <slug> Ready/);
  assert.match(read('.claude/skills/feature-delivery/SKILL.md'), /`e2e: required`, add the `e2e` label/);
});
test('every delivery skill has a thin Codex adapter pointing at its canonical SKILL.md', () => {
  for (const [name] of SKILLS) assert.deepEqual(checkAdapter(name, read(`.agents/skills/${name}/SKILL.md`)), [], name);
});
test('the ideation chain hands off to increment-handoff, which hands off to feature-delivery', () => {
  assert.match(read('.claude/skills/ideation-boilerplate/SKILL.md'), /`increment-handoff`/);
  const chain = read('.claude/skills/ideation-journey/references/chain.md');
  assert.ok(chain.indexOf('-> increment-handoff') > 0 && chain.indexOf('-> increment-handoff') < chain.indexOf('-> feature-delivery'), 'chain order');
  assert.match(read('.claude/skills/ideation-journey/references/stage-detection.md'), /docs\/increments\/<slug>\.md[\s\S]*`increment-handoff`/);
  assert.match(read('.claude/skills/ideation-journey/SKILL.md'), /`increment-handoff`/);
  assert.match(read('.claude/skills/feature-delivery/SKILL.md'), /switch to the `increment-handoff` skill/);
});

test('negative: the checkers fail on missing scripts, unknown npm scripts, workflows and jobs, a lost rule and a missing close', () => {
  const facts = loadFacts();
  const file = { path: '.claude/skills/release/SKILL.md', text: [
    'Run `node scripts/release/absent.mjs` and `npm run release:absent`.',
    'Dispatch `absent-workflow.yml`, read `docs/development/ABSENT.md`, then `node bin/app ci --job publish/absent`.',
    'Denied: `npm run release*`; real: `npm run check:repository` and `node bin/app ci --job dev/fast`.',
    'Configured by `configs/absent/rules.json`; real: `configs/quality/thresholds.json`.',
  ].join('\n') };
  const failures = checkCitations(file, facts).join('\n');
  for (const expected of [/missing scripts\/release\/absent\.mjs/, /unknown npm script release:absent/, /unknown workflow absent-workflow\.yml/,
    /missing docs\/development\/ABSENT\.md/, /unknown CI job publish\/absent/, /missing configs\/absent\/rules\.json/]) assert.match(failures, expected);
  assert.equal(checkCitations(file, facts).length, 6, 'valid citations and the denied pattern pass');
  assert.match(checkFile({ path: file.path, text: '`node bin/app relaese check`' }, catalog()).join('\n'), /unknown command/);
  assert.deepEqual(checkFile({ path: file.path, text: '`node bin/app increment ac set x AC-1` and `node bin/app pr task add x "t"`' }, catalog()), [], 'three-word commands resolve');
  assert.match(checkFile({ path: file.path, text: '`node bin/app increment ac drop x`' }, catalog()).join('\n'), /unknown command "increment ac"/);
  const valid = read('.claude/skills/release/SKILL.md');
  assert.match(checkSkill({ name: 'release', next: 'feature-delivery', text: valid.slice(0, valid.indexOf('## Close')) }).join('\n'), /missing the "## Close/);
  assert.doesNotMatch(valid.replace('Loading this skill authorizes nothing', 'Loading this skill is enough'), SKILLS[2][2][0]);
  assert.match(checkAdapter('release', '---\nname: release\ndescription: Codex adapter that points at the wrong canonical skill file.\n---\nRead ../../../.claude/skills/feature-delivery/SKILL.md\n').join('\n'), /must point at/);
});
test('negative: the contract checker fails on an unlisted script, a missing file or job and an unbacked tool-map row', () => {
  const contract = { scripts: ['scripts/delivery/ready.mjs'], configs: ['configs/delivery/rules.json'], jobs: [['ready.yml', 'Ready']] };
  const toolMap = '# Map\n\n## Increment handoff and delivery checks\n\n| `node scripts/delivery/ready.mjs --json` | `feature-delivery`, `increment-handoff` | read | x |\n';
  const corpus = [{ skill: 'increment-handoff', text: 'Run `node scripts/delivery/ready.mjs` then `node scripts/delivery/absent.mjs`.' }];
  const present = { exists: () => true, jobNames: () => ['Ready'] }, absent = { exists: () => false, jobNames: () => [] };
  const failures = checkDeliveryContract({ corpus, toolMap, contract, facts: absent }).join('\n');
  for (const expected of [/increment-handoff: scripts\/delivery\/absent\.mjs is not part of the DoR\/DoD contract/, /missing scripts\/delivery\/ready\.mjs/,
    /missing configs\/delivery\/rules\.json/, /ready\.yml: no job named "Ready"/, /tool map: feature-delivery does not cite node scripts\/delivery\/ready\.mjs/]) assert.match(failures, expected);
  assert.match(checkDeliveryContract({ corpus, toolMap: '# Map\n', contract, facts: present }).join('\n'), /tool map: no row for scripts\/delivery\/ready\.mjs/);
  const clean = { corpus: [{ skill: 'feature-delivery', text: '`node scripts/delivery/ready.mjs`' }, { skill: 'increment-handoff', text: '`node scripts/delivery/ready.mjs`' }] };
  assert.deepEqual(checkDeliveryContract({ ...clean, toolMap, contract, facts: present }), []);
});
