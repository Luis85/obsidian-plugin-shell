// Real npm regression with synthetic registry packages. Only a loopback server is used.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectInstallEnvironment } from '../shared/npm-install.mjs';
import { startFixtureRegistry } from './local-npm-registry.mjs';

const flags = process.argv.slice(2);
if (flags.length !== 2 || flags[0] !== '--npm-cli') {
  console.error('Usage: node scripts/testing/check-npm-install-policy.mjs --npm-cli <provisioned npm/bin/npm-cli.js>');
  process.exit(2);
}
const npm = resolve(flags[1]);
const scratch = await mkdtemp(join(tmpdir(), 'shell real npm ü-'));
const report = { status: 'not-run', sourceCommit: process.env.GITHUB_SHA ?? null,
  node: process.version, platform: process.platform, checks: [] };
const config = join(scratch, 'user.npmrc');
const helperUrl = pathToFileURL(resolve('scripts/shared/npm-install.mjs')).href;
let registry;
try {
  await access(npm);
  await writeFile(config, 'allow-scripts=unreviewed-fixture\n');
  const env = { ...projectInstallEnvironment().env, npm_config_userconfig: config,
    npm_config_update_notifier: 'false', npm_config_cache: join(scratch, 'cache') };
  const call = (cwd, args, variables = env) => spawnSync(process.execPath, [npm, ...args], {
    cwd, env: variables, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024,
  });
  const ok = (cwd, args, variables) => {
    const result = call(cwd, args, variables);
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}\n${result.stdout}`);
    return result;
  };
  report.npm = ok(scratch, ['--version']).stdout.trim();
  assert.match(report.npm, /^(?:11|12)\./, 'Provision npm 11/12 with allowScripts support.');
  const packages = [];
  for (const kind of ['approved', 'denied', 'unreviewed']) {
    const name = `shell-fixture-${kind}`;
    const directory = join(scratch, name); await mkdir(directory);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0',
      scripts: { postinstall: 'node hook.cjs' } }));
    await writeFile(join(directory, 'hook.cjs'), "require('node:fs').writeFileSync(require('node:path').join(__dirname, 'hook-ran'), 'yes');\n");
    ok(directory, ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', scratch]);
    const tarball = join(scratch, `${name}-1.0.0.tgz`);
    await access(tarball); packages.push({ name, tarball });
  }
  // Registry identities match production dependencies; avoid npm's platform-dependent file spec matching.
  registry = await startFixtureRegistry(packages);
  env.npm_config_registry = registry.url;
  const project = join(scratch, 'project'); await mkdir(project);
  const pkg = { name: 'npm-policy-fixture', version: '1.0.0', private: true,
    dependencies: Object.fromEntries(packages.map(({ name }) => [name, '1.0.0'])),
    allowScripts: { 'shell-fixture-approved@1.0.0': true,
      'shell-fixture-denied': false, 'shell-fixture-unreviewed': false },
    scripts: { probe: 'node probe.mjs' } };
  await writeFile(join(project, 'package.json'), JSON.stringify(pkg, null, 2));
  await writeFile(join(project, 'probe.mjs'), `
    import assert from 'node:assert/strict';
    import {spawnSync} from 'node:child_process';
    import {writeFileSync} from 'node:fs';
    import {projectInstallEnvironment} from ${JSON.stringify(helperUrl)};
    const prepared = projectInstallEnvironment();
    assert.ok(prepared.removedKeys.length, 'Outer npm run must forward the original setting.');
    const result = spawnSync(process.execPath, [${JSON.stringify(npm)}, 'ci', '--no-audit', '--no-fund'],
      {env:prepared.env, encoding:'utf8', timeout:30000});
    writeFileSync('nested-result.json', JSON.stringify({status:result.status, removed:prepared.removedKeys,
      stderr:result.stderr, stdout:result.stdout}));
    process.exit(result.status ?? 1);
  `);
  ok(project, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
  const before = await readFile(join(project, 'package-lock.json'), 'utf8');
  const lock = JSON.parse(before);
  for (const { name } of packages) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.hasInstallScript, true);
    assert.ok(entry.resolved.startsWith(`${registry.url}/`), 'No external registry or missing fixture');
  }
  const broken = call(project, ['ci', '--no-audit', '--no-fund'],
    { ...env, npm_config_allow_scripts: 'unreviewed-fixture' });
  assert.notEqual(broken.status, 0); assert.match(broken.stderr, /EALLOWSCRIPTS/);
  report.checks.push('actual-npm-reproduces-EALLOWSCRIPTS');
  ok(project, ['run', 'probe']);
  const nested = JSON.parse(await readFile(join(project, 'nested-result.json'), 'utf8'));
  assert.equal(nested.status, 0); assert.ok(nested.removed.length > 0);
  report.checks.push('nested-npm-run-ci-reloads-persistent-policy');
  await access(join(project, 'node_modules/shell-fixture-approved/hook-ran'));
  for (const kind of ['denied', 'unreviewed'])
    await assert.rejects(access(join(project, `node_modules/shell-fixture-${kind}/hook-ran`)), { code: 'ENOENT' });
  report.checks.push('version-approved-hook-runs-explicit-denials-do-not');
  assert.equal(await readFile(join(project, 'package-lock.json'), 'utf8'), before);
  assert.equal(await readFile(config, 'utf8'), 'allow-scripts=unreviewed-fixture\n');
  report.checks.push('lockfile-and-user-config-preserved');
  // npm 11 warns for unreviewed scripts by default; require strict mode for this assertion in both lanes.
  delete pkg.allowScripts['shell-fixture-unreviewed'];
  await writeFile(join(project, 'package.json'), JSON.stringify(pkg, null, 2));
  const strict = call(project, ['ci', '--no-audit', '--no-fund', '--strict-allow-scripts']);
  assert.notEqual(strict.status, 0, 'Strict policy must reject the unreviewed hook.');
  assert.match(strict.stderr, /allowScripts|install.script|unreviewed/i);
  await assert.rejects(access(join(project, 'node_modules/shell-fixture-unreviewed/hook-ran')), { code: 'ENOENT' });
  report.checks.push('strict-unreviewed-hook-blocked');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.reason = error.message; process.exitCode = 1;
} finally {
  if (registry) await registry.close();
  await rm(scratch, { recursive: true, force: true });
  const output = resolve('reports/setup-policy'); await mkdir(output, { recursive: true });
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
