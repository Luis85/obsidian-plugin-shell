import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNativeOwnership } from '../../scripts/testing/native-resource-report.mjs';
import { nativeReport } from '../../scripts/testing/evidence-adapters.mjs';

const itemCheck = 'native-items-independent-fault-ledger-exact-count-zero-loss-before-reconstruction';
const closeCheck = 'native-owned-notice-modal-expiry-timer-close-preserves-live-sibling-and-foreign-notice';
const unloadCheck = 'native-unload-releases-observed-plugin-handles-with-independent-zero-fault-ledger-and-retains-foreign-notice';
const checks = [itemCheck, closeCheck, unloadCheck];
const enhancedChecks = [...checks, 'native-delayed-progress-cancelled-before-display-on-owner-close', 'native-pending-recovery-action-closed-owner-rejects-retained-native-handler'];
const first = 'view:first:showcase-notice'; const sibling = 'view:sibling:showcase-notice';
const receipt = (resource, id, owner, phase = 'acquired') => ({ resource, phase, owner, operation: 'example', id, count: 1 });
function observation(entries) {
  const events = entries.map((entry, index) => ({ kind: 'resource' in entry ? 'lifecycle' : 'error', sequence: index + 1, entry }));
  const errors = events.filter(event => event.kind === 'error').length;
  return { baseline: { sequence: 0, errors: 0, resources: 0, observerFailures: 0 },
    current: { sequence: events.length, errors, resources: events.length - errors, observerFailures: 0 },
    events, lost: 0, sequenceGaps: 0, lastSequence: events.length };
}
function fixture() {
  const entries = [receipt('notice', 1, first), receipt('timer', 2, first), receipt('notice', 3, sibling),
    receipt('timer', 4, sibling), receipt('modal', 1, 'view:first:modal')];
  const opened = observation(entries);
  entries.push({ ...entries[0], phase: 'released' }, { ...entries[1], phase: 'released' }, { ...entries[4], phase: 'released' });
  const closed = observation(entries);
  entries.push({ ...entries[2], phase: 'released' }, { ...entries[3], phase: 'released' });
  const unloaded = observation(entries);
  const fault = { sequence: 1, code: 'settings.write', operation: 'settings.save' };
  return {
    checks,
    itemOwnership: { status: 'passed', mode: 'controlled-adapter-in-native-host', nativeDiskFailure: false,
      counts: { calls: 2, completed: 1, failed: 1 }, independentObservation: observation([fault]), finalObservation: observation([fault]),
      diagnosticSource: 'independent-runtime-observer', diagnostics: [fault] },
    resourceOwnership: { status: 'passed', mode: 'native-public-ui',
      unexecuted: ['native delayed progress: no public UI caller', 'native pending recovery availability: no public UI registry caller', 'forced late native callback: no mutation capability exposed by observer'],
      opened, closed, unloaded, finalObservation: structuredClone(unloaded) },
  };
}
const rejects = change => {
  const value = fixture(); change(value);
  assert.throws(() => validateNativeOwnership(value, checks), /EVIDENCE_NATIVE_OWNERSHIP/);
};
function enhancedFixture() {
  const value = fixture(); const owner = 'view:first:recovery'; const cancelledOwner = 'view:cancelled:recovery';
  const owned = (resource, id, owner, operation) => ({ ...receipt(resource, id, owner), operation });
  const cancelled = [owned('modal', 1, cancelledOwner, 'confirm'), owned('action', 1, cancelledOwner, 'recovery'),
    owned('notice', 2, cancelledOwner, 'review'), owned('timer', 3, cancelledOwner, 'progress')];
  const entries = [...cancelled, ...cancelled.map(entry => ({ ...entry, phase: 'released' }))];
  const cancelledProgress = observation(entries);
  const ordinary = [receipt('notice', 4, first), receipt('timer', 5, first), receipt('notice', 6, sibling), receipt('timer', 7, sibling)];
  const recovery = [owned('modal', 2, owner, 'confirm'), owned('action', 8, owner, 'recovery'), owned('notice', 9, owner, 'review'), owned('availability', 12, owner, 'review')];
  const timer = owned('timer', 10, owner, 'progress'); const progress = owned('notice', 11, owner, 'progress');
  entries.push(...ordinary, ...recovery.slice(0, 3), timer, recovery[3], { ...timer, phase: 'released' }, progress);
  const opened = observation(entries);
  entries.push(...[ordinary[0], ordinary[1], ...recovery, progress].map(entry => ({ ...entry, phase: 'released' })));
  const closed = observation(entries);
  entries.push(...ordinary.slice(2).map(entry => ({ ...entry, phase: 'released' })));
  const unloaded = observation(entries);
  value.resourceOwnership = { status: 'passed', mode: 'native-public-ui', unexecuted: [], cancelledProgress, opened, closed,
    replayed: structuredClone(closed), unloaded, finalObservation: structuredClone(unloaded), retainedActionCalls: { pending: 2, afterClose: 1 } };
  return value;
}

test('native ownership parser accepts matching independent checkpoints and preserves historical fixture-only parsing', () => {
  assert.doesNotThrow(() => validateNativeOwnership(fixture(), checks));
  assert.doesNotThrow(() => validateNativeOwnership({}, ['fixture-only']));
  assert.doesNotThrow(() => validateNativeOwnership({ itemOwnership: { diagnostics: [] } }, ['native-items-controlled-adapter-rejection-retains-draft-no-success']));
  const withoutDisplay = fixture(); delete withoutDisplay.itemOwnership.diagnostics; delete withoutDisplay.itemOwnership.diagnosticSource;
  assert.doesNotThrow(() => validateNativeOwnership(withoutDisplay, checks));
  assert.throws(() => validateNativeOwnership(fixture(), [closeCheck]), /EVIDENCE_NATIVE_OWNERSHIP/);
});

test('native ownership parser rejects missing checkpoints, wrong provenance and concealed cleanup failures', () => {
  for (const change of [
    value => { delete value.itemOwnership; },
    value => { delete value.itemOwnership.finalObservation; },
    value => { value.itemOwnership.counts.failed = 0; },
    value => { value.itemOwnership.nativeDiskFailure = true; },
    value => { value.itemOwnership.mode = 'real-native-io'; },
    value => { value.itemOwnership.diagnosticSource = 'production-ring'; },
    value => { delete value.itemOwnership.diagnosticSource; },
    value => { delete value.itemOwnership.diagnostics; },
    value => { value.itemOwnership.diagnostics[0] = { sequence: 1, code: 'other', operation: 'other' }; },
    value => { value.itemOwnership.observationCleanupFailure = 'retained failure'; },
    value => { delete value.resourceOwnership; },
    value => { value.resourceOwnership.status = 'failed'; },
    value => { value.resourceOwnership.mode = 'controlled-adapter-in-native-host'; },
    value => { value.resourceOwnership.cleanupFailures = ['retained failure']; },
    value => { value.resourceOwnership.unexecuted = []; },
    value => { delete value.resourceOwnership.finalObservation; },
  ]) rejects(change);
});

test('native ownership parser rejects actual sequence gaps, lost delivery, counter disagreement and unexpected faults in final ledgers', () => {
  for (const change of [
    value => { value.itemOwnership.independentObservation.events[0].sequence = 2; },
    value => { value.itemOwnership.independentObservation.events[0].entry.sequence = 2; },
    value => { value.itemOwnership.finalObservation.lost = 1; },
    value => { value.itemOwnership.finalObservation.sequenceGaps = 1; },
    value => { value.itemOwnership.finalObservation.current.observerFailures = 1; },
    value => { value.itemOwnership.finalObservation.baseline.errors = 1; },
    value => { value.itemOwnership.finalObservation.current.resources = 1; },
    value => { value.itemOwnership.finalObservation.lastSequence = 99; },
    value => { value.itemOwnership.finalObservation.events[0].entry.code = 'notice.action'; },
    value => { value.itemOwnership.finalObservation.events[0].entry.privateBody = 'must not be accepted'; },
    value => { value.resourceOwnership.closed.events[1].sequence = 1; },
    value => { value.resourceOwnership.finalObservation = observation([{ sequence: 1, code: 'notice.sink', operation: 'notice.dismiss' }]); },
    value => { value.resourceOwnership.finalObservation.current.sequence = Number.NaN; },
    value => { value.resourceOwnership.finalObservation.events[0].kind = 'unrecognized'; },
  ]) rejects(change);
});

test('native ownership parser rejects forged resource cleanup, changed owners, active leftovers and rewritten history', () => {
  for (const change of [
    value => { value.resourceOwnership.opened.events[0].entry.count = 2; },
    value => { value.resourceOwnership.opened.events[0].entry.owner = '../private'; },
    value => { value.resourceOwnership.opened.events[1].entry.id = 0; },
    value => { value.resourceOwnership.opened.events[4].entry.owner = 'view:sibling:modal'; },
    value => { value.resourceOwnership.closed.events[5].entry.owner = sibling; },
    value => { value.resourceOwnership.closed.events[5].entry.phase = 'acquired'; },
    value => { value.resourceOwnership.closed.events[5].entry.id = 99; },
    value => { value.resourceOwnership.closed = structuredClone(value.resourceOwnership.opened); },
    value => { value.resourceOwnership.unloaded = structuredClone(value.resourceOwnership.closed); },
    value => { value.resourceOwnership.finalObservation = structuredClone(value.resourceOwnership.closed); },
    value => {
      for (const stage of ['opened', 'closed', 'unloaded', 'finalObservation']) value.resourceOwnership[stage].events[0].entry.resource = 'action';
    },
    value => { value.resourceOwnership.finalObservation.events[0].entry.operation = 'rewritten'; },
    value => {
      value.resourceOwnership.finalObservation.events[0].entry.operation = 'consistent-rewrite';
      value.resourceOwnership.finalObservation.events[5].entry.operation = 'consistent-rewrite';
    },
  ]) rejects(change);
});

test('native ownership parser independently enforces its collection cap even when a packet claims zero loss', () => {
  rejects(value => {
    value.itemOwnership.finalObservation = observation(Array.from({ length: 4097 }, (_, index) => ({ sequence: index + 1, code: 'settings.write', operation: 'settings.save' })));
  });
});

test('trusted native producer accepts independently derived legacy diagnostics and rejects hidden final-ledger loss', () => {
  const value = fixture();
  const legacy = 'native-items-controlled-adapter-rejection-retains-draft-no-success';
  const expected = [...checks, legacy];
  const assets = ['main.js', 'manifest.json', 'styles.css'].map(file => ({ file, sha256: 'a'.repeat(64) }));
  const raw = { ...value, mode: 'native-obsidian', status: 'passed', sourceCommit: 'b'.repeat(40), targetApp: '1.13.7',
    launcherVersion: '3.2.1', resolvedVersions: ['1.13.7', '1.13.7'], assets, installedAssets: assets, checks: expected, errors: [],
    items: { mode: 'real-native-io-with-read-only-call-observer', restartQueryWrites: { calls: 0, active: 0, maximumActive: 0, failures: 0 } } };
  assert.equal(nativeReport(raw, expected).frameworkPassed, true);
  for (const field of ['itemOwnership', 'resourceOwnership']) {
    for (const key of ['error', 'unknown']) {
      const altered = structuredClone(raw); altered[field][key] = 'concealed';
      assert.throws(() => nativeReport(altered, expected), /EVIDENCE_NATIVE_OWNERSHIP/);
    }
  }
  const rewritten = structuredClone(raw);
  rewritten.resourceOwnership.finalObservation.events[0].entry.operation = 'consistent-rewrite';
  rewritten.resourceOwnership.finalObservation.events[5].entry.operation = 'consistent-rewrite';
  assert.throws(() => nativeReport(rewritten, expected), /EVIDENCE_NATIVE_OWNERSHIP/);
  raw.itemOwnership.finalObservation.lost = 1;
  assert.throws(() => nativeReport(raw, expected), /EVIDENCE_NATIVE_OWNERSHIP/);
});

test('enhanced native recovery claims require cancelled progress, pending availability and an unchanged retained-handler replay', () => {
  assert.doesNotThrow(() => validateNativeOwnership(enhancedFixture(), enhancedChecks));
  assert.throws(() => validateNativeOwnership(fixture(), enhancedChecks), /EVIDENCE_NATIVE_OWNERSHIP/);
  for (const change of [
    value => { delete value.resourceOwnership.cancelledProgress; },
    value => { value.resourceOwnership.retainedActionCalls.pending = 1; },
    value => { value.resourceOwnership.retainedActionCalls.afterClose = 0; },
    value => { value.resourceOwnership.replayed = structuredClone(value.resourceOwnership.opened); },
    value => { value.resourceOwnership.cancelledProgress.events[3].entry.operation = 'not-progress'; },
    value => { value.resourceOwnership.opened.events.find(event => event.entry.resource === 'availability').entry.operation = 'unrelated'; },
    value => { value.resourceOwnership.opened.events.find(event => event.entry.resource === 'action' && event.entry.owner === 'view:first:recovery').entry.count = 0; },
    value => { value.resourceOwnership.unexecuted = ['pending recovery']; },
  ]) {
    const value = enhancedFixture(); change(value);
    assert.throws(() => validateNativeOwnership(value, enhancedChecks), /EVIDENCE_NATIVE_OWNERSHIP/);
  }
});

test('trusted native producer accepts enhanced recovery evidence and rejects a false retained-handler invocation count', () => {
  const value = enhancedFixture(); const expected = [...enhancedChecks, 'native-items-controlled-adapter-rejection-retains-draft-no-success'];
  const assets = ['main.js', 'manifest.json', 'styles.css'].map(file => ({ file, sha256: 'a'.repeat(64) }));
  const raw = { ...value, mode: 'native-obsidian', status: 'passed', sourceCommit: 'b'.repeat(40), targetApp: '1.13.7',
    launcherVersion: '3.2.1', resolvedVersions: ['1.13.7', '1.13.7'], assets, installedAssets: assets, checks: expected, errors: [],
    items: { mode: 'real-native-io-with-read-only-call-observer', restartQueryWrites: { calls: 0, active: 0, maximumActive: 0, failures: 0 } } };
  assert.equal(nativeReport(raw, expected).frameworkPassed, true);
  raw.resourceOwnership.retainedActionCalls.afterClose = 0;
  assert.throws(() => nativeReport(raw, expected), /EVIDENCE_NATIVE_OWNERSHIP/);
});
