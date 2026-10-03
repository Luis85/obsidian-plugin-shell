/** Explicit opt-in integration; never part of default install/build/verify. Uses only disposable generated projects. */
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { planProject, applyProject } from '../../bin/compiler/adapters/project-plan.ts';
import { migrateAuthoringDocument } from '../companion/authoring-contract.ts';
const root = fileURLToPath(new URL('../../', import.meta.url)), npm = process.env.QUALIFIED_NPM;
if (!npm) throw Error('QUALIFIED_NPM_REQUIRED: no implicit global installation.');
const output = join(root, 'reports/storybook-qualification'); await mkdir(output, { recursive: true });
const vault = await realpath(await mkdtemp(join(tmpdir(), 'optional-storybook-')));
const report = { schemaVersion: 1, status: 'failed', scope: 'Generated Storybook typecheck, static build, browser preview and axe accessibility audit of stories in both Obsidian themes; not business/native acceptance', steps: [] };
async function command(label, args, cwd) {
  const run = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 600000, maxBuffer: 30_000_000,
    env: { ...process.env, npm_execpath: resolve(npm), STORYBOOK_DISABLE_TELEMETRY: 'true' } });
  const text = (run.stdout ?? '') + (run.stderr ?? ''); await writeFile(join(output, label + '.log'), text); process.stdout.write(text);
  report.steps.push({ label, exit: run.status }); if (run.status !== 0) throw Error(label + ' failed: ' + (run.error?.message ?? run.status));
}
try {
  const document = migrateAuthoringDocument(JSON.parse(await readFile(join(root, 'tests/fixtures/companion/detail-v3.json'), 'utf8'))).document;
  document.tooling = { storybook: { enabled: true, generateStories: true } };
  const visual = document.design.visualDesigns;
  visual.components[0].scenarios.push({ id: 'vs-100', name: 'Narrow empty preview', state: 'empty', width: 'narrow', values: {}, bindings: [] });
  visual.nextId = Math.max(visual.nextId, 101);
  const input = join(vault, 'project.json'); await writeFile(input, JSON.stringify(document));
  const plan = await planProject({ input, vault, target: 'project', templateRoot: root }); await applyProject(plan, plan.hash);
  const target = join(vault, 'project'), shell = join(target, 'bin/app');
  const hash = async path => createHash('sha256').update(await readFile(join(target, path))).digest('hex');
  const rootLockBefore = await hash('package-lock.json');
  await command('project-install', [resolve(npm), 'ci', '--no-fund'], target);
  await command('optional-install', [shell, 'storybook', 'install', '--yes', '--json'], target);
  await command('optional-ci-replay', [shell, 'storybook', 'install', '--yes', '--json'], target);
  const optionalPackage = JSON.parse(await readFile(join(target, 'storybook/package.json'), 'utf8')).devDependencies;
  const optionalLock = JSON.parse(await readFile(join(target, 'storybook/package-lock.json'), 'utf8')).packages;
  if (optionalPackage['@storybook/addon-a11y'] !== optionalPackage.storybook || optionalLock['node_modules/@storybook/addon-a11y']?.version !== optionalPackage.storybook) throw Error('A11Y_ADDON_NOT_PINNED_TO_STORYBOOK');
  report.steps.push({ label: 'a11y-addon-matches-storybook', exit: 0 });
  await command('optional-typescript', [shell, 'storybook', 'check', '--json'], target);
  await command('optional-build', [shell, 'storybook', 'build', '--json'], target);
  await command('optional-browser', [join(root, 'scripts/compiler/verify-storybook.mjs'), target, output], root);
  if (await hash('package-lock.json') !== rootLockBefore) throw Error('ROOT_LOCK_CHANGED');
  await writeFile(join(output, 'optional-package-lock.json'), await readFile(join(target, 'storybook/package-lock.json')));
  report.steps.push({ label: 'root-lock-unchanged', exit: 0 });
  report.status = 'passed';
} finally {
  // Keep only generated source/configuration for diagnosis, never installed packages or font binaries.
  const target = join(vault, 'project');
  for (const folder of ['storybook', 'design']) {
    await cp(join(target, folder), join(output, 'generated', folder), { recursive: true,
      filter: path => !/(?:^|[/\\])(?:node_modules|storybook-static)(?:[/\\]|$)|\.(?:ttf|otf|woff2?)$/i.test(path),
    }).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  await writeFile(join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  await rm(vault, { recursive: true, force: true });
}
