import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../tooling/delivery/config.mjs';
import { readyRules } from '../../tooling/delivery/rules-ready.mjs';
import { doneRules } from '../../tooling/delivery/rules-done.mjs';
import { evaluate } from '../../tooling/delivery/run.mjs';
import { parseHandoff } from '../../tooling/delivery/handoff.mjs';
import { documentState } from '../../tooling/delivery/documents.mjs';
import { categories } from '../../tooling/release/changelog.mjs';

export const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
export const handoffPath = 'docs/increments/sample-increment.md';

/** A handoff that passes every Definition of Ready rule against `baseContext`. */
export function readyHandoff({ status = 'In progress', e2e = 'optional', checked = false } = {}) {
  const box = checked ? 'x' : ' ';
  // An existing test as evidence satisfies the acceptance-stub rule before implementation, too.
  const evidence = id => ` Evidence: \`tests/greeting.checks.mjs\`${checked && id === 2 ? ', `docs/guide.md#usage`' : ''}`;
  return `---
type: Increment
id: sample-increment
title: "Sample increment"
owner: "Maintainer"
size: S
status: ${status}
e2e: ${e2e}
refs: [docs/prds/MVP.md, "#12", WB-PBI-001]
---

# Sample increment

<!-- Guidance comments are ignored: <placeholder> TBD -->

## Summary

Adds a greeting command to the plugin shell for new users.

## Outcome

Users can run the greeting command from the command palette.

## Scope

### In scope

- The greeting command and its test.

### Out of scope

- Translations of the greeting text.

## Acceptance criteria

- [${box}] AC-1: The palette lists the greeting command.${evidence(1)}
- [${box}] AC-2: A failing notice reports the error without a partial write.${evidence(2)}

## Affected areas

- \`src/features/greeting/**\`: the new command.
- \`tests/greeting.checks.mjs\`: its test.
- \`docs/guide.md\`: the usage page.

## Test plan

- Suite \`release\`: proves the command wiring.
- Gate \`npm run check\`: diff-scoped checks.
- Gate \`node scripts/tool.mjs --flag\`: the tool check.
- New test \`tests/greeting.checks.mjs\`: command behavior.
- E2E: optional because no rendered view changes.

## Docs impact

- \`docs/guide.md\` (how-to): explains the command.

## Changelog

- Added: A greeting command in the palette.

## Risks and rollback

Low risk; revert the single commit to roll it back.

## Dependencies

None.

## Open questions

None.
`;
}

export const changelog = `# Changelog

## [Unreleased]

### Added

- A greeting command in the palette.

## [0.1.0] - 2026-09-01

First notes.

[Unreleased]: https://github.com/Example/plugin/compare/0.1.0...HEAD
[0.1.0]: https://github.com/Example/plugin/releases/tag/0.1.0
`;
export const docsIndex = '# Documentation\n\n## Tutorials\n\n| Page | What |\n| --- | --- |\n| [Start](start.md) | Begin. |\n\n## How-to guides\n\n| Page | Task |\n| --- | --- |\n| [Guide](guide.md) | Use it. |\n\n## Reference\n\n| Page | Facts |\n| --- | --- |\n\n## Explanation\n\nProse only.\n';

export async function configs() {
  const ready = await loadConfig(repositoryRoot, 'ready', readyRules);
  const done = await loadConfig(repositoryRoot, 'done', doneRules);
  return { delivery: ready.delivery, ready: ready.rules, done: done.rules };
}

/** A pure rule context; `text` is the handoff, `overrides` replace any field. */
export function baseContext(config, text = readyHandoff(), overrides = {}) {
  const texts = { [handoffPath]: text, 'CHANGELOG.md': changelog, 'docs/guide.md': '# Guide\n\n> Type: how-to · Part of the index\n', 'docs/README.md': docsIndex, ...(overrides.texts ?? {}) };
  const diff = overrides.diff ?? [
    { path: handoffPath, status: 'A', added: [] },
    { path: 'src/features/greeting/command.ts', status: 'A', added: [{ line: 1, text: 'export const greet = () => "hi";' }] },
    { path: 'tests/greeting.checks.mjs', status: 'A', added: [{ line: 1, text: 'test("greets", () => {});' }] },
    { path: 'CHANGELOG.md', status: 'M', added: [{ line: 7, text: '- A greeting command in the palette.' }] },
    { path: 'docs/guide.md', status: 'A', added: [] }, { path: 'docs/README.md', status: 'M', added: [] }];
  const files = [...new Set(['docs/prds/MVP.md', 'docs/requirements/WB-PBI-001.md', 'scripts/tool.mjs', 'src/features/existing.ts', 'src/plugin/presentation/view.vue', 'tests/greeting.checks.mjs', 'docs/guide.md',
    ...diff.filter(file => file.status !== 'D').map(file => file.path), ...Object.keys(overrides.texts ?? {}).filter(path => !['CHANGELOG.md', 'docs/README.md'].includes(path))])].sort();
  const readText = path => texts[path] ?? null;
  const handoff = { path: handoffPath, source: 'diff', text, model: parseHandoff(text) };
  const state = documentState(config.delivery, { files, diff, readText, refs: overrides.refs ?? { base: '', head: '' } }, handoff);
  return { delivery: config.delivery, categories, suites: ['release', 'quality'], scripts: { check: 'node bin/app check' },
    files, diff, labels: null, readText, handoffProblem: null, readyFailures: [], handoff, ...state, ...overrides };
}

/** Rule results by id for the ready or done rules. */
export function results(kind, config, context) {
  const outcome = kind === 'ready' ? evaluate(readyRules, config.ready, context) : evaluate(doneRules, config.done, context);
  return Object.fromEntries(outcome.map(rule => [rule.id, rule]));
}
export const read = path => readFile(join(repositoryRoot, path), 'utf8');

/** A PullRequest document of sample-increment; `kind: change` defaults to the increment branch as base. */
export function pullRequestDoc({ id = 'sample-increment-1', kind = 'change', status = 'Draft', base, head, delivers = ['AC-1'], tasks = ['- [ ] T-1: Add the command.'], issues, extra = '' } = {}) {
  const branches = { base: base ?? (kind === 'kickoff' ? 'main' : 'increment/sample-increment'), head: head ?? (kind === 'kickoff' ? 'increment/sample-increment' : `pr/sample-increment/${id}`) };
  return `---
type: PullRequest
id: ${id}
title: "Pull request ${id}"
increment: sample-increment
status: ${status}
kind: ${kind}
base: ${branches.base}
head: "${branches.head}"
${delivers ? `delivers: [${delivers.join(', ')}]\n` : ''}${issues ? `issues: [${issues.join(', ')}]\n` : ''}---

# Pull request ${id}

## Summary

Part of [[docs/increments/sample-increment|Sample increment]].

## Scope

### In scope

- The greeting command.

### Out of scope

- Translations.

## Tasks

${tasks.join('\n')}
${extra}`;
}
/** An Issue document of sample-increment. */
export const issueDoc = ({ id = 'sample-issue', status = 'In progress', increment = 'sample-increment' } = {}) =>
  `---\ntype: Issue\nid: ${id}\ntitle: "Issue ${id}"\nstatus: ${status}\nincrement: ${increment}\n---\n\n# Issue ${id}\n\n## Summary\n\nSee [[MVP]].\n`;
/** readyHandoff with the increment lists of its documents. */
export const linkedHandoff = ({ pullRequests = [], issues = [], ...options } = {}) =>
  readyHandoff(options).replace('refs: [', `pullRequests: [${pullRequests.join(', ')}]\nissues: [${issues.join(', ')}]\nrefs: [`);
