import { mkdir, rm, readFile, access, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyFilePlan, createFilePlan } from '../shared/file-plan.mjs';
import { runNode } from '../shared/process.mjs';
import { projectInstallEnvironment } from '../shared/npm-install.mjs';
import { savedOptions } from './options.mjs';
import { writeJournal, inputFingerprint, stageIsCurrent, artifactHashes, digest } from './journal.mjs';
import { planMigration } from './migration.mjs';

function activeToolchain(options) {
  const npm = process.env.npm_execpath;
  let version = 'not-selected';
  if (npm) {
    const result = spawnSync(process.execPath, [npm, '--version'], { encoding: 'utf8', timeout: 10000 });
    version = result.stdout?.trim();
    if (result.status !== 0 || !/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Selected npm launcher did not report a valid version');
    const [major, minor, patch] = version.split('.').map(Number);
    if (major < 11 || major >= 13 || (major === 11 && (minor < 19 || (minor === 19 && patch < 1)))) throw new Error('npm 11.19.1 or supported npm 12 is required');
  } else if (!options['skip-install']) throw new Error('Run setup through npm run setup so the active npm launcher is known');
  return { node: process.version, npm: version, platform: process.platform, architecture: process.arch };
}
export function setupStages(options) {
  return [
    { id: 'install', selected: !options['skip-install'], command: ['active-npm', 'ci', '--no-fund'] },
    { id: 'browser-provision', selected: Boolean(options['provision-browser']), command: ['node_modules/@playwright/test/cli.js', 'install', 'chromium'] },
    { id: 'verify', selected: !options['defer-verify'], command: ['scripts/quality/verify.mjs'] },
    { id: 'native-install', selected: options.profile === 'native', command: ['scripts/dev/install-local.mjs', '--no-build'] },
  ];
}
export async function executeSetup(root, options, planned, previous, { run = runNode } = {}) {
  const lock = join(root, '.template-setup.lock');
  await createFilePlan(root, []);
  await mkdir(lock).catch(error => { if (error.code === 'EEXIST') throw new Error('SETUP_LOCKED: another setup or interrupted run owns .template-setup.lock; inspect it before manual recovery'); throw error; });
  let journal;
  let journalHash = previous?.sourceHash ?? null;
  const saveJournal = async () => { journalHash = await writeJournal(root, journal, journalHash); };
  try {
    const toolchain = activeToolchain(options);
    journal = { version: 1, identity: planned.identity, options: savedOptions(options), fingerprint: await inputFingerprint(root, toolchain, options), toolchain,
      status: 'running', migration: null, stages: setupStages(options).map(stage => ({ ...stage, status: stage.selected ? 'pending' : 'skipped' })) };
    await saveJournal(); // Record desired public options before the first identity write, so interruption can resume.
    await applyFilePlan(planned.plan);
    const fingerprint = await inputFingerprint(root, toolchain, options); journal.fingerprint = fingerprint;
    journal.lockHash = digest(await readFile(join(root, 'package-lock.json')));
    const compatible = previous?.fingerprint === fingerprint;
    await saveJournal();
    if (planned.migration) {
      // Revalidate disabled state and source/destination data immediately before this separate stage.
      const migration = await planMigration(root, { from: planned.migration.from, to: planned.identity.id, previousId: planned.identity.id, profile: options.profile,
        expectedManifest: planned.manifest, previousManifest: planned.manifest, receipt: previous?.migration });
      if (JSON.stringify(migration.plan.changes) !== JSON.stringify(planned.migration.plan.changes)) throw new Error('Migration inputs changed after review; review a new plan');
      await applyFilePlan(migration.plan);
      journal.migration = { from: migration.from, to: migration.to, status: 'verified', oldInstallationPreserved: true };
      await saveJournal();
    }
    const env = projectInstallEnvironment().env;
    for (const stage of journal.stages) {
      if (!stage.selected) continue;
      const prior = compatible && previous.stages.find(item => item.id === stage.id);
      if (options.resume && prior && await stageIsCurrent(root, prior, planned.identity)) {
        Object.assign(stage, { status: 'verified', resumed: true, exitCode: prior.exitCode, ...(prior.outputHash ? { outputHash: prior.outputHash } : {}), ...(prior.assets ? { assets: prior.assets } : {}) });
        await saveJournal(); continue;
      }
      stage.status = 'running'; await saveJournal();
      const [entry, ...args] = stage.command;
      const path = entry === 'active-npm' ? process.env.npm_execpath : entry;
      try {
        if (stage.id === 'native-install') await planMigration(root, { from: planned.migration?.from, to: planned.identity.id, previousId: planned.previousManifest.id,
          profile: options.profile, expectedManifest: planned.manifest, previousManifest: planned.previousManifest, receipt: journal.migration });
        if (entry !== 'active-npm') await access(join(root, path));
        stage.executed = [process.execPath, path, ...args];
        await run(path, args, { cwd: root, env, ...(options.json ? { stdio: ['inherit', process.stderr, 'inherit'] } : {}) });
        stage.exitCode = 0;
        if (stage.id === 'install') {
          const hidden = join(root, 'node_modules/.package-lock.json'); const stat = await lstat(hidden);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Installed lockfile is missing or unsafe');
          stage.outputHash = digest(await readFile(hidden));
        }
        if (stage.id === 'verify' || stage.id === 'native-install') {
          stage.assets = await artifactHashes(root, stage.id === 'native-install' ? planned.identity.id : undefined);
          if (!stage.assets) throw new Error('Required complete artifact set is missing');
          const base = stage.id === 'native-install' ? `.dev-vault/.obsidian/plugins/${planned.identity.id}` : 'dist';
          const candidate = JSON.parse(await readFile(join(root, base, 'manifest.json'), 'utf8'));
          if (candidate.id !== planned.identity.id || candidate.version !== planned.identity.version) throw new Error('Artifact identity does not match the reviewed identity');
        }
        stage.status = 'verified';
      } catch (error) { stage.status = 'failed'; stage.exitCode ??= Number.isInteger(error.exitCode) ? error.exitCode : null; if (error.signal) stage.signal = error.signal; throw error; }
      await saveJournal();
    }
    if (await inputFingerprint(root, toolchain, options) !== fingerprint) throw new Error('Setup inputs changed during execution; rerun to verify the current source');
    journal.status = 'verified'; await saveJournal();
    return journal;
  } catch (error) {
    if (journal) { journal.status = 'failed'; journal.failure = { code: 'setup.failed', recovery: 'Preserved completed stages; inspect the failed step and use --resume after correction' }; await saveJournal().catch(() => {}); }
    throw error;
  } finally { await rm(lock, { recursive: true }); }
}
