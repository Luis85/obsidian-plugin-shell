// Increment: [[docs/increments/agent-plugin-scaffold-journey]]
// AC-4: An unapproved `new` preview writes nothing and names the exact `--apply <planHash>` rerun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const app = (cwd, args) => spawnSync(process.execPath, [join(root, 'bin/app'), 'new', ...args], { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 50_000_000 });

test('[AC-4] a new preview writes nothing and tells the agent the exact apply command', { timeout: 300000 }, async t => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'scaffold-preview-')));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  await cp(join(root, 'configs'), join(cwd, 'configs'), { recursive: true });
  const machine = app(cwd, ['board-tools', '--starter', 'custom-file-view', '--extension', 'board', '--json']);
  assert.equal(machine.status, 0, machine.stderr);
  const result = JSON.parse(machine.stdout);
  assert.equal(result.status, 'planned');
  assert.equal(result.data.written, false);
  assert.match(result.data.planHash, /^[a-f0-9]{64}$/);
  assert.equal(result.data.next, `No files or processes changed. Review the plan, then rerun the same command with --apply ${result.data.planHash} (or --yes) to create the project.`);
  const human = app(cwd, ['board-tools', '--starter', 'custom-file-view', '--extension', 'board']);
  assert.equal(human.status, 0, human.stderr);
  assert.ok(human.stdout.includes(`--apply ${result.data.planHash}`), 'the terminal view shows the same rerun');
  assert.deepEqual(await readdir(cwd), ['configs'], 'nothing was written');
});
