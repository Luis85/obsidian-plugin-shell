/**
 * Temporary delivery workspaces for the increment, pr and issue command tests: a scratch git repository with one
 * commit on main (and optionally a local bare `origin`), the framework root of this checkout and injectable
 * services (clock, hosting remote, lock folder). Never contacts a network host.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../src/cli/adapters/framework/operations.ts';

const frameworkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const identity = ['-c', 'user.name=Workbench Test', '-c', 'user.email=test@workbench.invalid', '-c', 'commit.gpgsign=false'];
const git = (cwd, ...args) => execFileSync('git', [...identity, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * A scratch project. `delivery` copies configs/delivery from this checkout (optionalKeys widened with the CLI's
 * extension keys unless `narrow`); `git: false` leaves it without a repository; `origin` adds a local bare remote.
 */
export function createWorkspace({ delivery = false, narrow = false, git: withGit = true, origin = false } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'workbench-increments-')), root = join(base, 'project');
  mkdirSync(root, { recursive: true });
  if (delivery) {
    cpSync(join(frameworkRoot, 'configs/delivery'), join(root, 'configs/delivery'), { recursive: true });
    const path = join(root, 'configs/delivery/delivery.json'), config = JSON.parse(readFileSync(path, 'utf8'));
    config.handoff.optionalKeys = narrow ? ['refs', 'pullRequests'] : ['refs', 'pullRequests', 'branch', 'base', 'issues'];
    writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
    writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n[Unreleased]: https://github.com/octo/demo/commits/HEAD\n');
  }
  writeFileSync(join(root, 'README.md'), '# Scratch\n');
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'tests/suites.json'), JSON.stringify({ schemaVersion: 1, suites: [{ name: 'cli' }] }) + '\n');
  if (withGit) {
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'init');
    if (origin) {
      // The origin names a GitHub repository (hosting resolution) but pushes go to a local bare repository.
      git(base, 'init', '-q', '--bare', 'origin.git');
      git(root, 'remote', 'add', 'origin', 'https://github.com/octo/demo.git');
      git(root, 'config', 'remote.origin.pushurl', join(base, 'origin.git'));
      git(root, 'push', '-q', 'origin', 'main');
    }
  }
  const services = { now: () => new Date('2026-10-04T12:00:00.000Z'), lockDirectory: join(base, 'locks') };
  mkdirSync(services.lockDirectory);
  const context = { root, frameworkRoot, increments: services };
  return {
    base, root, context, services,
    run: (command, args = [], options = {}) => executeOperation({ command, args, options }, context),
    read: path => readFileSync(join(root, path), 'utf8'),
    exists: path => existsSync(join(root, path)),
    write: (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); },
    git: (...args) => git(root, ...args),
    branches: () => git(root, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean).sort(),
    pushed: () => git(join(base, 'origin.git'), 'branch', '--format=%(refname:short)').split('\n').filter(Boolean).sort(),
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
}
/** Applies a plan through its reviewed hash, asserting the preview first wrote nothing. */
export async function planThenApply(workspace, command, args = [], options = {}) {
  const preview = await workspace.run(command, args, options);
  if (preview.status !== 'planned') return preview;
  return workspace.run(command, args, { ...options, apply: preview.data.planHash });
}
/** The Ready-quality body of an increment fragment: every DoR section filled, two criteria, no open questions. */
export const readyFragment = `# Delivery pipeline

## Summary

Adds a reviewed publish command for planned pull requests.

## Outcome

Maintainers publish a planned pull request as a draft without leaving the terminal.

## Scope

### In scope

- The publish command

### Out of scope

- Merging pull requests

## Acceptance criteria

- [ ] AC-1: Given a planned pull request When it is published Then a draft exists
- [ ] AC-2: A missing head branch is refused without a push

## Affected areas

- \`README.md\`: documents the command

## Test plan

- Suite \`cli\`: proves the command plans and applies
- New test \`tests/acceptance/delivery/ac-1.checks.mjs\`: proves the first criterion
- E2E: optional because the change has no rendered UI

## Docs impact

- None — the scratch project has no documentation pages

## Changelog

- Added: The publish command for planned pull requests.

## Risks and rollback

Low risk; revert the commit to roll the change back.

## Dependencies

None.

## Open questions

None.
`;
