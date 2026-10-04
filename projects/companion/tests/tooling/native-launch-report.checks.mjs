import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateNativeLaunch } from '../../scripts/testing/native-launch-report.mjs';
import { nativeReport } from '../../scripts/testing/evidence-adapters.mjs';
import { nativeLaunchFixture, nativeForeignNoticeFixture } from './native-launch-fixture.mjs';
import { nativeOwnershipFixture } from './native-ownership-fixture.mjs';

const marker = 'native-contained-config-fresh-launch-resource-snapshots';
const expected = [marker];
const fixture = (platform = 'linux') => ({ status: 'passed', ...nativeLaunchFixture(platform) });
const rejects = change => { const value = fixture(); change(value); assert.throws(() => validateNativeLaunch(value, expected), /EVIDENCE_NATIVE_LAUNCH_RESOURCES/); };

test('launch receipts require fresh ordered samples while historical reports remain explicitly unextended', () => {
  for (const platform of ['linux', 'win32', 'darwin']) assert.doesNotThrow(() => validateNativeLaunch(fixture(platform), expected));
  assert.doesNotThrow(() => validateNativeLaunch({ status: 'passed' }, ['historical-check']));
  for (const length of [0, 1, 2]) {
    const value = fixture(); value.status = 'failed'; value.launchResources.length = length;
    assert.doesNotThrow(() => validateNativeLaunch(value, expected));
  }
  const busy = fixture(); busy.launchResources[0].freeMemoryBytes = 0; busy.launchResources[0].loadAverage.values = [80, 90, 100];
  assert.doesNotThrow(() => validateNativeLaunch(busy, expected), 'A resource snapshot does not certify idle conditions');
});

test('launch receipts reject missing stages, reused samples, malformed fields and unsupported qualification claims', () => {
  for (const change of [
    value => { delete value.launchResources; },
    value => { value.launchResources = null; },
    value => { value.launchResources.length = 1; },
    value => { value.launchResources.push(structuredClone(value.launchResources[1])); },
    value => { value.launchResources.reverse(); },
    value => { value.launchResources[1].phase = 'initial'; },
    value => { value.launchResources[1].sampledAt = value.launchResources[0].sampledAt; },
    value => { value.launchResources[1].sampledAt = '2026-09-23T00:00:00.000Z'; },
    value => { value.launchResources[0].sampledAt = '2026-09-24'; },
    value => { value.launchResources[0].sampledAt = '2026-02-30T00:00:00.000Z'; },
    value => { value.launchResources[0].boundary = 'after-launch'; },
    value => { value.launchResources[0].classification = 'controlled-reference'; },
    value => { value.launchResources[0].idleReference = true; },
    value => { value.launchResources[0].platform = 'unknown'; },
    value => { value.launchResources[1].platform = 'darwin'; },
    value => { value.launchResources[0].totalMemoryBytes = Number.MAX_SAFE_INTEGER + 1; },
    value => { value.launchResources[0].totalMemoryBytes = 0; },
    value => { value.launchResources[0].freeMemoryBytes = value.launchResources[0].totalMemoryBytes + 1; },
    value => { value.launchResources[0].freeMemoryBytes = -1; },
    value => { value.launchResources[0].availableParallelism = 0; },
    value => { value.launchResources[0].availableParallelism = 1.5; },
    value => { value.launchResources[0].processMemory.rss = Infinity; },
    value => { value.launchResources[0].processMemory.heapUsed = -1; },
    value => { value.launchResources[0].processMemory.privatePath = 'unexpected'; },
    value => { value.launchResources[0].extra = true; },
  ]) rejects(change);
});

test('load-average receipts distinguish unsupported Windows observations from real zero or busy Unix measurements', () => {
  for (const change of [
    value => { value.launchResources[0].loadAverage.values = [0, 0]; },
    value => { value.launchResources[0].loadAverage.values = [0, NaN, 0]; },
    value => { value.launchResources[0].loadAverage.values = [0, -1, 0]; },
    value => { value.launchResources[0].loadAverage.values = [0, '0', 0]; },
    value => { value.launchResources[0].loadAverage.reason = 'unsupported-on-win32'; },
    value => { value.launchResources[0].loadAverage.supported = false; },
    value => { value.launchResources[0].loadAverage.extra = true; },
  ]) rejects(change);
  for (const loadAverage of [{ supported: true, values: [0, 0, 0], reason: null },
    { supported: false, values: [0, 0, 0], reason: 'unsupported-on-win32' }, { supported: false, values: null, reason: null }]) {
    const value = fixture('win32'); value.launchResources[0].loadAverage = loadAverage;
    assert.throws(() => validateNativeLaunch(value, expected), /EVIDENCE_NATIVE_LAUNCH_RESOURCES/);
  }
});

test('cleanup receipts preserve every diagnostic and the first failure without qualifying a failed run', () => {
  const value = fixture(); value.status = 'failed';
  value.cleanupFailures = [{ code: 'NATIVE_PROCESS_STOP_FAILED', message: 'first' }, { code: 'NATIVE_CONFIG_CLEANUP_FAILED', message: 'second' }];
  value.cleanupFailure = value.cleanupFailures[0].code;
  assert.doesNotThrow(() => validateNativeLaunch(value, expected));
  for (const change of [
    changed => { changed.cleanupFailure = changed.cleanupFailures[1].code; },
    changed => { delete changed.cleanupFailure; },
    changed => { delete changed.cleanupFailures; },
    changed => { changed.cleanupFailures[1].message = {}; },
    changed => { changed.cleanupFailures[0].code = ''; },
    changed => { changed.cleanupFailures[0].extra = true; },
    changed => { changed.cleanupFailures = []; },
    changed => { changed.cleanupFailures = null; },
    changed => { changed.status = 'passed'; },
  ]) { const changed = structuredClone(value); change(changed); assert.throws(() => validateNativeLaunch(changed, expected), /EVIDENCE_NATIVE_LAUNCH_RESOURCES/); }
  assert.doesNotThrow(() => validateNativeLaunch({ status: 'failed', cleanupFailure: 'historical-only-code' }, []));
});

test('current native profiles require launch provenance and exact separate foreign-fixture bytes only for ownership claims', async () => {
  const profiles = JSON.parse(await readFile(new URL('../../docs/testing/native-evidence-checks.json', import.meta.url), 'utf8')).profiles;
  for (const profile of ['showcase', 'foundation']) {
    assert.ok(profiles[profile].includes(marker));
    const assets = ['main.js', 'manifest.json', 'styles.css'].map(file => ({ file, sha256: 'a'.repeat(64) }));
    const value = { ...nativeOwnershipFixture(true), ...nativeLaunchFixture(), ...(profile === 'showcase' ? nativeForeignNoticeFixture() : {}),
      mode: 'native-obsidian', status: 'passed', profile, sourceCommit: 'd'.repeat(40), targetApp: '1.13.7',
      launcherVersion: '3.2.1', resolvedVersions: ['1.13.7', '1.13.7'], assets, installedAssets: assets, checks: profiles[profile], errors: [],
      items: { mode: 'real-native-io-with-read-only-call-observer', restartQueryWrites: { calls: 0, active: 0, maximumActive: 0, failures: 0 } } };
    assert.equal(nativeReport(value, profiles[profile]).frameworkPassed, true);
    const missing = structuredClone(value); delete missing.launchResources;
    assert.throws(() => nativeReport(missing, profiles[profile]), /EVIDENCE_NATIVE_LAUNCH_RESOURCES/);
    if (profile === 'foundation') continue;
    for (const change of [
      changed => { delete changed.foreignNoticeFixture; },
      changed => { changed.foreignNoticeFixture.id = 'candidate-plugin'; },
      changed => { changed.foreignNoticeFixture.assets.length = 1; },
      changed => { changed.foreignNoticeFixture.installedAssets[0].sha256 = 'e'.repeat(64); },
      changed => { changed.foreignNoticeFixture.installedAssets[1].bytes += 1; },
      changed => { changed.foreignNoticeFixture.assets[0].sha256 = 'not-a-hash'; },
      changed => { changed.foreignNoticeFixture.assets[0].bytes = 0; },
      changed => { changed.foreignNoticeFixture.installedAssets[1].file = 'main.js'; },
      changed => { changed.foreignNoticeFixture.extra = true; },
    ]) { const changed = structuredClone(value); change(changed); assert.throws(() => nativeReport(changed, profiles[profile]), /EVIDENCE_NATIVE_LAUNCH_RESOURCES/); }
    const reordered = structuredClone(value); reordered.foreignNoticeFixture.installedAssets.reverse();
    assert.equal(nativeReport(reordered, profiles[profile]).frameworkPassed, true);
  }
});
