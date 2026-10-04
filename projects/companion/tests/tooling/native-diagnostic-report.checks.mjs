import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { nativeReport } from '../../scripts/testing/evidence-adapters.mjs';
import { createNativeDiagnosticObserver, noteNativePhase } from '../../scripts/testing/native-diagnostic-observer.mjs';

function fixture(withErrors = false) {
  const assets = ['main.js', 'manifest.json', 'styles.css'].map(file => ({ file, sha256: 'a'.repeat(64) }));
  const report = { mode: 'native-obsidian', status: 'passed', sourceCommit: 'b'.repeat(40), targetApp: '1.13.7',
    launcherVersion: '3.2.1', resolvedVersions: ['1.13.7', '1.13.7'], assets, installedAssets: assets,
    checks: ['fixture-only'], errors: [] };
  const observer = createNativeDiagnosticObserver(report); const page = new EventEmitter();
  page.url = () => 'app://obsidian.md/index.html'; observer.observe(page);
  noteNativePhase(report, 'popout-close');
  if (withErrors) { const error = new Error('illegal access'); error.stack = ''; page.emit('pageerror', error); page.emit('pageerror', error); }
  noteNativePhase(report, 'cleanup'); page.emit('close'); observer.dispose();
  return report;
}

test('native parser rejects contradictory or malformed diagnostic receipts instead of accepting a false green', () => {
  const parse = value => nativeReport(value, ['fixture-only']);
  const clean = fixture(); assert.equal(parse(clean).frameworkPassed, true);
  const legacy = structuredClone(clean); delete legacy.nativeDiagnostics;
  assert.equal(parse(legacy).frameworkPassed, true, 'historical absent supplement is distinct from invalid supplied data');
  const failed = fixture(true); assert.equal(parse(failed).frameworkPassed, false);
  for (const mutate of [
    value => { value.nativeDiagnostics.schemaVersion = 999; },
    value => { value.nativeDiagnostics.clock = 'renderer throw time'; },
    value => { value.nativeDiagnostics.events[0].unknown = true; },
    value => { value.nativeDiagnostics.events[0].monotonicMs = -1; },
    value => { value.nativeDiagnostics.events[1].monotonicMs = 0; },
    value => { value.nativeDiagnostics.events[0].at = 'invalid'; },
    value => { value.nativeDiagnostics.events[1].pageId = 2; },
    value => { value.nativeDiagnostics.events.at(-2).pageId = 99; },
    value => { value.nativeDiagnostics.events.at(-2).phase = 'other'; },
    value => { value.nativeDiagnostics.events.pop(); },
    value => { value.nativeDiagnostics.events.push(value.nativeDiagnostics.events[0]); },
    value => { value.phase = 'other'; },
  ]) {
    const changed = structuredClone(clean); mutate(changed);
    assert.throws(() => parse(changed), /EVIDENCE_NATIVE_DIAGNOSTICS/);
  }
  for (const mutate of [
    value => { value.errors = []; },
    value => { value.errors.pop(); },
    value => { value.errors[0].url = 'about:blank'; },
    value => { value.errors[0].phase = 'other'; },
    value => { value.nativeDiagnostics.events.find(event => event.kind === 'pageerror').errorIndex = 1; },
    value => { value.nativeDiagnostics.events = value.nativeDiagnostics.events.filter(event => event.kind !== 'pageerror'); },
  ]) {
    const changed = structuredClone(failed); mutate(changed);
    assert.throws(() => parse(changed), /EVIDENCE_NATIVE_DIAGNOSTICS/);
  }
  assert.equal(parse(clean).frameworkPassed, true);
  assert.equal(parse(failed).frameworkPassed, false);
});
