import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fakeGh } from './fake-gh.mjs';
import { publishFixture, repository, version } from './release-publish-fixture.mjs';

const root = resolve(import.meta.dirname, '../../../..');

/**
 * Runs `node tooling/release/publish.mjs` as a user would, with its `gh` calls served by the release-publish
 * fixture from a state file (fake-gh.mjs). `mutate(state, fixture)` adjusts the remote before the first run.
 */
export async function publishCli(t, mutate = () => {}) {
  const folder = await mkdtemp(join(tmpdir(), 'publish-cli-')); t.after(() => rm(folder, { recursive: true, force: true }));
  const fixture = await publishFixture(t); mutate(fixture.state, fixture);
  const statePath = join(folder, 'remote.json');
  await writeFile(statePath, JSON.stringify({ ...fixture.state, onMain: [...fixture.state.onMain] }));
  // A private TMPDIR keeps the publish lock and work folders of parallel runs apart.
  const temp = join(folder, 'tmp'); await mkdir(temp);
  const env = { ...process.env, FAKE_GH_STATE: statePath, FAKE_GH_PRELOAD: '1', TMPDIR: temp, TEMP: temp, TMP: temp, NODE_OPTIONS: '' };
  delete env.NODE_TEST_CONTEXT;
  const state = async () => JSON.parse(await readFile(statePath, 'utf8'));
  const update = async change => { const current = await state(); change(current); await writeFile(statePath, JSON.stringify(current)); };
  const run = (...flags) => {
    const result = spawnSync(process.execPath, ['--import', fakeGh, join(root, 'tooling/release/publish.mjs'), '--version', version, '--repository', repository, '--json', ...flags],
      { cwd: root, env, encoding: 'utf8', timeout: 120_000 });
    const output = result.status === 1 ? JSON.parse(result.stderr) : JSON.parse(result.stdout);
    return { status: result.status, output, stderr: result.stderr };
  };
  return { fixture, run, state, update };
}
