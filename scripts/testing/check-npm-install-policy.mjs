// Actual npm regression in an isolated temp project; local tarballs, offline installation.
// CI explicitly supplies a provisioned modern npm CLI. No global configuration is modified.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectInstallEnvironment } from '../shared/npm-install.mjs';

const flags = process.argv.slice(2);
if (flags.length !== 2 || flags[0] !== '--npm-cli') {
  console.error('Usage: node scripts/testing/check-npm-install-policy.mjs --npm-cli <provisioned npm/bin/npm-cli.js>');
  process.exit(2);
}
const npm = resolve(flags[1]);
const scratch = await mkdtemp(join(tmpdir(), 'shell real npm ü-'));
const report = { status: 'not-run', sourceCommit: process.env.GITHUB_SHA ?? null, node: process.version, platform: process.platform, checks: [] };
const config = join(scratch, 'user.npmrc');
const helperUrl = pathToFileURL(resolve('scripts/shared/npm-install.mjs')).href;
const output = resolve('reports/setup-policy');
try {
  await access(npm);
  await writeFile(config, 'allow-scripts=unreviewed-fixture\n');
  const env = { ...projectInstallEnvironment().env, npm_config_userconfig: config };
  const call = (cwd, args, variables = env) => spawnSync(process.execPath, [npm, ...args], {
    cwd, env: variables, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024,
  });
  const ok = (cwd, args, variables) => {
    const result = call(cwd, args, variables);
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}\n${result.stdout}`);
    return result;
  };
  report.npm = ok(scratch, ['--version']).stdout.trim();
  assert.match(report.npm, /^(?:11|12)\./, 'This compatibility probe requires provisioned npm 11/12 with allowScripts support.');
  const tarballs = {};
  const identities = {};
  for (const kind of ['approved', 'denied', 'unreviewed']) {
    const name = `shell-fixture-${kind}`;
    const directory = join(scratch, name); await mkdir(directory);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0',
      scripts: { postinstall: 'node hook.cjs' } }));
    await writeFile(join(directory, 'hook.cjs'), "require('node:fs').writeFileSync(require('node:path').join(__dirname, 'hook-ran'), 'yes');\n");
    ok(directory, ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', scratch]);
    // Verify the actual controlled unscoped artifact, not a version-dependent JSON envelope.
    const filename = `${name}-1.0.0.tgz`;
    await access(join(scratch, filename));
    tarballs[name] = `file:../${filename}`;
    identities[kind] = `file:${join(scratch, filename)}`;
  }
  const project = join(scratch, 'project'); await mkdir(project);
  const pkg = { name: 'npm-policy-fixture', version: '1.0.0', private: true,
    dependencies: tarballs,
    // Match absolute native file identities across npm versions. Registry pins are tested by full setup.
    // The third hook starts explicitly denied, then becomes unreviewed in the strict negative control.
    allowScripts: { [identities.approved]: true, [identities.denied]: false, [identities.unreviewed]: false },
    scripts: { probe: 'node probe.mjs' } };
  await writeFile(join(project, 'package.json'), JSON.stringify(pkg, null, 2));
  await writeFile(join(project, 'probe.mjs'), `
    import assert from 'node:assert/strict';
    import {spawnSync} from 'node:child_process';
    import {writeFileSync} from 'node:fs';
    import {projectInstallEnvironment} from ${JSON.stringify(helperUrl)};
    const prepared = projectInstallEnvironment();
    assert.ok(prepared.removedKeys.length, 'Outer npm run must reproduce forwarded allow-scripts config.');
    const result = spawnSync(process.execPath, [${JSON.stringify(npm)}, 'ci', '--offline', '--no-audit', '--no-fund'],
      {env:prepared.env, encoding:'utf8'});
    writeFileSync('nested-result.json', JSON.stringify({status:result.status, removed:prepared.removedKeys,
      stderr:result.stderr, stdout:result.stdout, ignore:prepared.env.npm_config_ignore_scripts}));
    process.exit(result.status ?? 1);
  `);
  ok(project, ['install', '--package-lock-only', '--ignore-scripts', '--offline', '--no-audit', '--no-fund']);
  const before = await readFile(join(project, 'package-lock.json'), 'utf8');
  report.fixtureLock = JSON.parse(before).packages;
  for (const name of Object.keys(tarballs))
    assert.equal(report.fixtureLock[`node_modules/${name}`].hasInstallScript, true, `Fixture has no install hook: ${name}`);
  const broken = call(project, ['ci', '--offline', '--no-audit', '--no-fund'], { ...env, npm_config_allow_scripts: 'unreviewed-fixture' });
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /EALLOWSCRIPTS/);
  report.checks.push('actual-npm-reproduces-EALLOWSCRIPTS');
  ok(project, ['run', 'probe']);
  const nested = JSON.parse(await readFile(join(project, 'nested-result.json'), 'utf8'));
  report.fixtureOutput = { stdout: nested.stdout.slice(-6000), stderr: nested.stderr.slice(-6000), ignoreScripts: nested.ignore ?? null };
  assert.equal(nested.status, 0);
  assert.ok(nested.removed.length > 0);
  report.checks.push('nested-npm-run-ci-reloads-persistent-policy');
  await access(join(project, 'node_modules/shell-fixture-approved/hook-ran'));
  for (const kind of ['denied', 'unreviewed'])
    await assert.rejects(access(join(project, `node_modules/shell-fixture-${kind}/hook-ran`)), { code: 'ENOENT' });
  report.checks.push('only-explicit-source-approved-hook-executes');
  assert.equal(await readFile(join(project, 'package-lock.json'), 'utf8'), before);
  assert.equal(await readFile(config, 'utf8'), 'allow-scripts=unreviewed-fixture\n');
  report.checks.push('lockfile-and-user-config-preserved');
  delete pkg.allowScripts[identities.unreviewed];
  await writeFile(join(project, 'package.json'), JSON.stringify(pkg, null, 2));
  const strict = call(project, ['ci', '--offline', '--no-audit', '--no-fund', '--strict-allow-scripts']);
  assert.notEqual(strict.status, 0, 'Unreviewed hook must remain an error in strict mode.');
  assert.match(strict.stderr, /allowScripts|install.script|unreviewed/i);
  report.checks.push('stricter-unreviewed-policy-remains-blocking');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.reason = error.message; process.exitCode = 1;
} finally {
  await rm(scratch, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
