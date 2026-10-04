import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunner } from '../../scripts/release/commands.mjs';

export const repositoryBase = 'https://github.com/Example/different-plugin';
export const template = '## Release {{version}}\n\nBranch `{{release_branch}}` from `{{base}}` at {{base_sha}} ({{date}}).\n\n{{changelog}}\n\n- [ ] Release result is green\n';
export function changelogText(unreleased = '### Added\n\n- Pending capability.\n\n') {
  return `# Changelog\n\n## [Unreleased]\n\n${unreleased}## [0.3.0] - 2026-09-01\n\nExisting notes.\n\n` +
    `[Unreleased]: ${repositoryBase}/compare/0.3.0...HEAD\n[0.3.0]: ${repositoryBase}/releases/tag/0.3.0\n`;
}

/** A real repository on main pushed to a local bare origin; `gh` is the only faked executable. */
export async function gitFixture(t, { unreleased, withTemplate = true } = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'release-git-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = join(folder, 'work'); const origin = join(folder, 'origin.git');
  await mkdir(root);
  const real = createRunner({ cwd: root });
  const git = (...args) => {
    const result = real('git', args);
    if (result.status !== 0) throw new Error(`fixture git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  const files = {
    'manifest.json': { id: 'different-plugin', name: 'Different Plugin', version: '0.3.0', minAppVersion: '1.13.7', isDesktopOnly: true },
    'package.json': { name: 'different-plugin', version: '0.3.0', dependencies: { alpha: '1.2.3' } },
    'package-lock.json': { version: '0.3.0', lockfileVersion: 3, packages: { '': { version: '0.3.0', dependencies: { alpha: '1.2.3' } }, 'node_modules/alpha': { version: '1.2.3' } } },
    'versions.json': { '0.3.0': '1.13.7' },
  };
  for (const [name, content] of Object.entries(files)) await writeFile(join(root, name), JSON.stringify(content, null, 2) + '\n');
  await writeFile(join(root, 'CHANGELOG.md'), changelogText(unreleased));
  if (withTemplate) { await mkdir(join(root, '.github/PULL_REQUEST_TEMPLATE'), { recursive: true }); await writeFile(join(root, '.github/PULL_REQUEST_TEMPLATE/release.md'), template); }
  real('git', ['init', '--quiet', '--bare', '--initial-branch=main', origin], { cwd: folder });
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'commit.gpgsign', 'false');
  git('add', '.'); git('commit', '--quiet', '-m', 'Create fixture');
  git('remote', 'add', 'origin', origin); git('push', '--quiet', 'origin', 'main'); git('fetch', '--quiet', 'origin');
  const gh = { calls: [], responses: {} };
  const run = (command, args, options) => {
    if (command !== 'gh') return real(command, args, options);
    gh.calls.push(args);
    const key = args.slice(0, 2).join(' ');
    const response = typeof gh.responses[key] === 'function' ? gh.responses[key](args) : gh.responses[key];
    return response ?? { status: 0, stdout: '', stderr: '' };
  };
  return { root, origin, git, run, gh };
}
