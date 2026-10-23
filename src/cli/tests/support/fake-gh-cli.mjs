/**
 * A file-backed `gh` stand-in for running the real publish CLI: every call loads the release-publish fixture state
 * from FAKE_GH_STATE, answers through the same fake routes the in-process tests use and saves the state back.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { publishFixture } from './release-publish-fixture.mjs';

const path = process.env.FAKE_GH_STATE;
const cleanups = [];
const fixture = await publishFixture({ after: cleanup => cleanups.push(cleanup) });
const saved = JSON.parse(readFileSync(path, 'utf8'));
Object.assign(fixture.state, saved, { onMain: new Set(saved.onMain) });
const args = process.argv.slice(2);
const input = args[args.indexOf('--input') + 1] === '-' ? readFileSync(0, 'utf8') : undefined;
const result = fixture.run('gh', args, input === undefined ? {} : { input });
writeFileSync(path, JSON.stringify({ ...fixture.state, onMain: [...fixture.state.onMain] }));
for (const cleanup of cleanups) await cleanup();
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exitCode = result.status ?? 1;
