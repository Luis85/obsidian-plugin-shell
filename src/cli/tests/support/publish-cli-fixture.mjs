import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { publishFixture, repository, version } from './release-publish-fixture.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const shim = resolve(import.meta.dirname, 'fake-gh-cli.mjs');

/**
 * Runs `node tooling/release/publish.mjs` as a user would, with a fake `gh` first on PATH that serves the
 * release-publish fixture from a state file. `mutate(state, fixture)` adjusts the remote before the first run.
 */
export async function publishCli(t, mutate = () => {}) {
  const folder = await mkdtemp(join(tmpdir(), 'publish-cli-')); t.after(() => rm(folder, { recursive: true, force: true }));
  const fixture = await publishFixture(t); mutate(fixture.state, fixture);
  const statePath = join(folder, 'remote.json'), bin = join(folder, 'bin');
  await mkdir(bin);
  await writeFile(join(bin, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${shim}" "$@"\n`); await chmod(join(bin, 'gh'), 0o755);
  await writeFile(statePath, JSON.stringify({ ...fixture.state, onMain: [...fixture.state.onMain] }));
  // A private TMPDIR keeps the publish lock and work folders of parallel runs apart.
  const temp = join(folder, 'tmp'); await mkdir(temp);
  const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, FAKE_GH_STATE: statePath, TMPDIR: temp, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const state = async () => JSON.parse(await readFile(statePath, 'utf8'));
  const update = async change => { const current = await state(); change(current); await writeFile(statePath, JSON.stringify(current)); };
  const run = (...flags) => {
    const result = spawnSync(process.execPath, [join(root, 'tooling/release/publish.mjs'), '--version', version, '--repository', repository, '--json', ...flags],
      { cwd: root, env, encoding: 'utf8', timeout: 120_000 });
    const output = result.status === 1 ? JSON.parse(result.stderr) : JSON.parse(result.stdout);
    return { status: result.status, output, stderr: result.stderr };
  };
  return { fixture, run, state, update };
}
