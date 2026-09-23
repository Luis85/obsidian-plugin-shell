import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareVersion, parsePrepareArguments } from '../../scripts/release/prepare.mjs';
import { parseRehearsalArguments } from '../../scripts/release/rehearse.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { collectAssets, retainCandidate, validateRetained, fixedSource, git, sha256, assetNames } from '../../scripts/release/candidate.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'release-rehearsal-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = { id: 'different-plugin', name: 'Different Plugin', version: '0.3.0', minAppVersion: '1.13.7', isDesktopOnly: true };
  const files = { 'manifest.json': manifest, 'package.json': { name: 'different-plugin', version: '0.3.0' },
    'package-lock.json': { version: '0.3.0', lockfileVersion: 3, packages: { '': { version: '0.3.0' } } },
    'versions.json': { '0.1.0': '1.13.7', '0.3.0': '1.13.7' } };
  for (const [name, content] of Object.entries(files)) await writeFile(join(root, name), JSON.stringify(content, null, 2) + '\n');
  await writeFile(join(root, 'CHANGELOG.md'), '# Changelog\n\n## 0.3.0\n\nExisting notes.\n');
  await writeFile(join(root, '.gitignore'), 'dist/\nreports/\n');
  git(root, ['init', '--quiet']); git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Create fixture']);
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist/main.js'), '/* retained license */ console.log("candidate");');
  await writeFile(join(root, 'dist/styles.css'), '.different-plugin { color: inherit; }');
  await writeFile(join(root, 'dist/manifest.json'), await readFile(join(root, 'manifest.json')));
  return { root, manifest, commit: git(root, ['rev-parse', 'HEAD']) };
}
test('prepare reviews all five files without writes then preserves history on apply', async t => {
  const { root } = await fixture(t);
  const before = await readFile(join(root, 'package.json'), 'utf8');
  const result = await prepareVersion(root, '0.4.0', 'Add a reviewed capability.');
  assert.equal(result.hostFloorChanged, false); assert.equal(result.plan.changes.length, 5);
  assert.equal(await readFile(join(root, 'package.json'), 'utf8'), before);
  await applyFilePlan(result.plan);
  assert.equal(JSON.parse(await readFile(join(root, 'package-lock.json'))).packages[''].version, '0.4.0');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'versions.json'))), { '0.1.0': '1.13.7', '0.3.0': '1.13.7', '0.4.0': '1.13.7' });
  assert.match(await readFile(join(root, 'CHANGELOG.md'), 'utf8'), /## 0\.4\.0[\s\S]*## 0\.3\.0/);
});
test('prepare rejects invalid, reused and lower versions, missing notes and conflicting metadata', async t => {
  const { root } = await fixture(t);
  for (const version of ['v0.4.0', '0.4.0-beta.1', '01.4.0', '0.4', '0.3.0', '0.1.0']) await assert.rejects(prepareVersion(root, version, 'Notes'));
  await assert.rejects(prepareVersion(root, '0.4.0', ''), /NOTES_REQUIRED/);
  const path = join(root, 'manifest.json'); const manifest = JSON.parse(await readFile(path));
  manifest.minAppVersion = '1.14.0'; await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(prepareVersion(root, '0.4.0', 'Notes'), /HOST_FLOOR_CHANGE/);
  manifest.version = '0.2.0'; await writeFile(path, JSON.stringify(manifest));
  await assert.rejects(prepareVersion(root, '0.4.0', 'Notes'), /SOURCE_VERSION_MISMATCH/);
});
async function retained(t) {
  const { root, commit } = await fixture(t); const version = '0.3.0';
  const input = join(root, 'dist'); const output = join(root, 'reports/release/candidate');
  const { bytes } = await collectAssets(root, input, version);
  const qualification = { status: 'passed', command: 'verify', sourceCommit: commit, npm: '11.19.1', assetHashes: Object.fromEntries(assetNames.map(name => [name, sha256(bytes[name])])) };
  return { root, commit, version, input, output, qualification };
}
test('retained package has exactly three assets, notes and hash-bound provenance; refuses retry overwrite', async t => {
  const options = await retained(t); const record = await retainCandidate(options);
  assert.equal(record.nativeAcceptance.status, 'not-run'); assert.equal(record.publication, 'not-authorized');
  assert.equal((await readdir(options.output)).length, 5);
  assert.equal((await validateRetained(options.output, options.commit, options.version)).identity, 'different-plugin');
  await assert.rejects(retainCandidate(options), /CANDIDATE_ALREADY_EXISTS/);
  assert.throws(() => fixedSource(options.root, 'HEAD'), /FIXED_COMMIT_REQUIRED/);
  assert.throws(() => fixedSource(options.root, 'f'.repeat(40)), /FIXED_COMMIT_REQUIRED/);
  await writeFile(join(options.root, 'unreviewed.txt'), 'change');
  assert.throws(() => fixedSource(options.root, options.commit), /SOURCE_NOT_CLEAN/);
});
test('candidate rejects unqualified or changed bytes and extra source files', async t => {
  const options = await retained(t);
  await assert.rejects(retainCandidate({ ...options, qualification: null }), /QUALIFICATION_REQUIRED/);
  await writeFile(join(options.input, 'main.js'), 'changed');
  await assert.rejects(retainCandidate(options), /QUALIFICATION_HASH_MISMATCH/);
  await writeFile(join(options.input, 'personal-note.md'), 'do not ship');
  await assert.rejects(collectAssets(options.root, options.input, options.version), /ASSET_SET_MISMATCH/);
});
test('retained validation rejects altered bytes, provenance, manifest and unexpected files', async t => {
  const options = await retained(t); await retainCandidate(options);
  const check = () => validateRetained(options.output, options.commit, options.version);
  await assert.rejects(validateRetained(options.output, 'f'.repeat(40), options.version), /PROVENANCE_MISMATCH/);
  await assert.rejects(validateRetained(options.output, options.commit, '0.4.0'), /PROVENANCE_MISMATCH/);
  const path = join(options.output, 'main.js'); const original = await readFile(path);
  await writeFile(path, 'tampered'); await assert.rejects(check(), /ASSET_HASH_MISMATCH/); await writeFile(path, original);
  const notes = join(options.output, 'release-notes.md'); await writeFile(notes, 'tampered'); await assert.rejects(check(), /NOTES_HASH_MISMATCH/);
  await writeFile(join(options.output, 'extra.js'), 'unexpected'); await assert.rejects(check(), /ASSET_SET_MISMATCH/);
});
test('retained validation fails closed on missing or invented qualification metadata', async t => {
  const options = await retained(t); await retainCandidate(options);
  const path = join(options.output, 'candidate.json'); const original = JSON.parse(await readFile(path));
  const check = () => validateRetained(options.output, options.commit, options.version);
  for (const [key, value] of [['tools', {}], ['lockHash', 'invalid'], ['nativeAcceptance', { status: 'passed' }], ['publication', 'approved'], ['qualification', { ...original.qualification, status: 'not-run' }]]) {
    await writeFile(path, JSON.stringify({ ...original, [key]: value }));
    await assert.rejects(check());
  }
  await writeFile(path, JSON.stringify(original));
  await rm(join(options.output, 'styles.css'));
  await assert.rejects(check(), /ASSET_SET_MISMATCH/);
});
test('metadata apply refuses stale reviewed bytes and source manifest mismatch', async t => {
  const { root } = await fixture(t);
  const reviewed = await prepareVersion(root, '0.4.0', 'Reviewed notes');
  await writeFile(join(root, 'CHANGELOG.md'), 'Concurrent human edit\n');
  await assert.rejects(applyFilePlan(reviewed.plan), /PLAN_STALE/);
  assert.equal(JSON.parse(await readFile(join(root, 'package.json'))).version, '0.3.0');
  assert.equal(await readFile(join(root, 'CHANGELOG.md'), 'utf8'), 'Concurrent human edit\n');
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ version: '0.4.0' }));
  await assert.rejects(collectAssets(root, join(root, 'dist'), '0.3.0'), /ASSET_MANIFEST_MISMATCH/);
});
test('version planning rejects concurrent edits before final hashes can adopt stale contents', async t => {
  const { root } = await fixture(t);
  await assert.rejects(prepareVersion(root, '0.4.0', 'Reviewed notes', { beforeFinalize: () => writeFile(join(root, 'CHANGELOG.md'), 'Human change during planning\n') }), /RELEASE_STALE_INPUT: CHANGELOG.md/);
  assert.equal(await readFile(join(root, 'CHANGELOG.md'), 'utf8'), 'Human change during planning\n');
  assert.equal(JSON.parse(await readFile(join(root, 'package.json'))).version, '0.3.0');
  const original = JSON.parse(await readFile(join(root, 'package.json')));
  await assert.rejects(prepareVersion(root, '0.4.0', 'Reviewed notes', { beforeFinalize: () => writeFile(join(root, 'package.json'), JSON.stringify({ ...original, description: 'Concurrent edit' })) }), /RELEASE_STALE_INPUT: package.json/);
  assert.equal(JSON.parse(await readFile(join(root, 'package.json'))).description, 'Concurrent edit');
});
test('release CLI argument policies expose help and reject missing, duplicate and malformed flags', () => {
  for (const parse of [parsePrepareArguments, parseRehearsalArguments]) {
    assert.deepEqual(parse([]), { help: true }); assert.deepEqual(parse(['--help']), { help: true });
    assert.throws(() => parse(['--version']), /MISSING_ARGUMENT_VALUE/);
    assert.throws(() => parse(['--version', '--help']), /MISSING_ARGUMENT_VALUE/);
    assert.throws(() => parse(['--version', '0.4.0', '--version', '0.5.0']), /DUPLICATE_ARGUMENT/);
    assert.throws(() => parse(['--help', '--version', '0.4.0']), /HELP_MUST_BE_USED_ALONE/);
    assert.throws(() => parse(['--unknown']), /UNKNOWN_ARGUMENT/);
  }
  assert.throws(() => parsePrepareArguments(['--version', '0.4.0']), /VERSION_AND_NOTES_FILE_REQUIRED/);
  assert.throws(() => parseRehearsalArguments(['--commit', 'main', '--version', '0.4.0']), /FIXED_COMMIT_REQUIRED/);
  assert.deepEqual(parsePrepareArguments(['--version', '0.4.0', '--notes-file', 'notes.md', '--dry-run']), { version: '0.4.0', notes: 'notes.md', dryRun: true });
  assert.deepEqual(parseRehearsalArguments(['--commit', 'a'.repeat(40), '--version', '0.4.0', '--check', 'candidate']), { commit: 'a'.repeat(40), version: '0.4.0', check: 'candidate' });
});
