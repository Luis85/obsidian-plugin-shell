/**
 * A file-backed `gh` for running the real publish CLI. Imported, it only names itself (fakeGh). Preloaded with
 * `node --import` while FAKE_GH_PRELOAD is set, it sends every `spawnSync('gh', ...)` to itself with the same Node
 * binary, so no executable is needed on PATH on Windows or POSIX. Run as a script, it is one `gh` call: it loads the
 * release-publish fixture state from FAKE_GH_STATE, answers through the in-process fake routes and saves it back.
 */
import childProcess from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishFixture } from './release-publish-fixture.mjs';

export const fakeGh = import.meta.url;
const self = fileURLToPath(import.meta.url);

async function answer(args) {
  const path = process.env.FAKE_GH_STATE;
  const cleanups = [];
  const fixture = await publishFixture({ after: cleanup => cleanups.push(cleanup) });
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  Object.assign(fixture.state, saved, { onMain: new Set(saved.onMain) });
  const input = args[args.indexOf('--input') + 1] === '-' ? readFileSync(0, 'utf8') : undefined;
  const result = fixture.run('gh', args, input === undefined ? {} : { input });
  writeFileSync(path, JSON.stringify({ ...fixture.state, onMain: [...fixture.state.onMain] }));
  for (const cleanup of cleanups) await cleanup();
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === self) await answer(process.argv.slice(2));
else if (process.env.FAKE_GH_PRELOAD === '1') {
  const spawnSync = childProcess.spawnSync;
  childProcess.spawnSync = (command, args = [], options) => command === 'gh' ? spawnSync(process.execPath, [self, ...args], options) : spawnSync(command, args, options);
  syncBuiltinESMExports();
}
