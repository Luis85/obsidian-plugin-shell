/**
 * Preloaded with `node --import` into the real publish CLI: every `gh` call runs fake-gh-cli.mjs with the same
 * Node binary instead, so the test needs no executable on PATH and runs alike on Windows and POSIX.
 */
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';

const shim = join(import.meta.dirname, 'fake-gh-cli.mjs');
const spawnSync = childProcess.spawnSync;
childProcess.spawnSync = (command, args = [], options) => command === 'gh' ? spawnSync(process.execPath, [shim, ...args], options) : spawnSync(command, args, options);
syncBuiltinESMExports();
