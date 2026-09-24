import { isDeepStrictEqual } from 'node:util';

const itemCheck = 'native-items-independent-fault-ledger-exact-count-zero-loss-before-reconstruction';
const closeCheck = 'native-owned-notice-modal-expiry-timer-close-preserves-live-sibling-and-foreign-notice';
const unloadCheck = 'native-unload-releases-observed-plugin-handles-with-independent-zero-fault-ledger-and-retains-foreign-notice';
const progressCheck = 'native-delayed-progress-cancelled-before-display-on-owner-close';
const recoveryCheck = 'native-pending-recovery-action-closed-owner-rejects-retained-native-handler';
const unexecuted = ['native delayed progress: no public UI caller', 'native pending recovery availability: no public UI registry caller', 'forced late native callback: no mutation capability exposed by observer'];
const fail = () => { throw new Error('EVIDENCE_NATIVE_OWNERSHIP'); };
const equal = isDeepStrictEqual;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const token = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
function shape(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !equal(Object.keys(value).sort(), [...fields].sort())) fail();
}
function counters(value) {
  shape(value, ['sequence', 'errors', 'resources', 'observerFailures']);
  if (!Object.values(value).every(integer) || value.observerFailures !== 0 || value.sequence !== value.errors + value.resources) fail();
}
function resource(entry, active, seen) {
  shape(entry, ['resource', 'phase', 'owner', 'operation', 'id', 'count']);
  if (!['notice', 'timer', 'modal', 'action', 'availability'].includes(entry.resource) || !['acquired', 'released'].includes(entry.phase)
    || !token(entry.owner) || !token(entry.operation) || !integer(entry.id) || entry.id === 0 || !integer(entry.count)) fail();
  if (entry.resource !== 'action' && entry.count !== 1) fail();
  const key = `${entry.resource}:${entry.id}`;
  if (entry.phase === 'acquired') {
    if (seen.has(key)) fail();
    seen.add(key); active.set(key, entry);
  } else {
    const original = active.get(key);
    if (!original || !equal({ ...original, phase: 'released' }, entry)) fail();
    active.delete(key);
  }
}
function ledger(value, expectedErrors) {
  shape(value, ['baseline', 'current', 'events', 'lost', 'sequenceGaps', 'lastSequence']);
  counters(value.baseline); counters(value.current);
  if (value.baseline.errors !== 0 || value.lost !== 0 || value.sequenceGaps !== 0 || value.lastSequence !== value.current.sequence
    || !Array.isArray(value.events) || value.events.length > 4096 || value.events.length !== value.current.sequence - value.baseline.sequence) fail();
  const active = new Map(); const seen = new Set(); const faults = [];
  let sequence = value.baseline.sequence;
  for (const event of value.events) {
    shape(event, ['kind', 'sequence', 'entry']);
    if (event.sequence !== ++sequence) fail();
    if (event.kind === 'lifecycle') resource(event.entry, active, seen);
    else if (event.kind === 'error') {
      shape(event.entry, ['sequence', 'code', 'operation']);
      if (event.entry.sequence !== faults.length + 1) fail();
      faults.push({ code: event.entry.code, operation: event.entry.operation });
    } else fail();
  }
  if (!equal(faults, expectedErrors) || value.current.errors !== faults.length
    || value.current.resources - value.baseline.resources !== value.events.length - faults.length) fail();
  return [...active.values()];
}
function extendsLedger(previous, next) {
  if (!equal(previous.baseline, next.baseline) || next.events.length < previous.events.length
    || !equal(previous.events, next.events.slice(0, previous.events.length))) fail();
}
function remainClosed(previous, final, owners) {
  const later = final.events.slice(previous.events.length);
  if (later.some(event => event.kind === 'lifecycle' && event.entry.phase === 'acquired' && (!owners || owners.has(event.entry.owner)))) fail();
}
function passed(value, mode, fields) {
  shape(value, ['status', 'mode', ...fields]);
  if (value.status !== 'passed' || value.mode !== mode) fail();
}
function validateItems(value) {
  const display = value?.diagnostics !== undefined || value?.diagnosticSource !== undefined;
  passed(value, 'controlled-adapter-in-native-host', ['nativeDiskFailure', 'counts', 'independentObservation', 'finalObservation',
    ...(display ? ['diagnostics', 'diagnosticSource'] : [])]);
  if (value.nativeDiskFailure !== false || !equal(value.counts, { calls: 2, completed: 1, failed: 1 })) fail();
  const expected = [{ code: 'settings.write', operation: 'settings.save' }];
  ledger(value.independentObservation, expected); ledger(value.finalObservation, expected);
  extendsLedger(value.independentObservation, value.finalObservation);
  if (display) {
    const faults = value.independentObservation.events.filter(event => event.kind === 'error').map(event => event.entry);
    if (value.diagnosticSource !== 'independent-runtime-observer' || !equal(value.diagnostics, faults)) fail();
  }
}
function ownedPair(resources, owner) {
  const pair = resources.filter(entry => entry.owner === owner);
  if (!equal(pair.map(entry => entry.resource).sort(), ['notice', 'timer'])) fail();
  return pair;
}
function validateResources(value, enhanced) {
  passed(value, 'native-public-ui', ['unexecuted', 'opened', 'closed', 'unloaded', 'finalObservation',
    ...(enhanced ? ['cancelledProgress', 'replayed', 'retainedActionCalls'] : [])]);
  if (!equal(value.unexecuted, enhanced ? [] : unexecuted)) fail();
  const stages = [value.opened, value.closed, value.unloaded, value.finalObservation];
  const resources = stages.map(stage => ledger(stage, []));
  for (let index = 1; index < stages.length; index++) extendsLedger(stages[index - 1], stages[index]);
  const [opened, closed, unloaded, final] = resources;
  const kinds = enhanced ? ['action', 'availability', 'modal', 'notice', 'notice', 'notice', 'notice', 'timer', 'timer'] : ['modal', 'notice', 'notice', 'timer', 'timer'];
  if (!equal(opened.map(entry => entry.resource).sort(), kinds)) fail();
  const notices = opened.filter(entry => entry.resource === 'notice' && entry.operation === 'example');
  if (notices.length !== 2) fail();
  const first = notices[0]; const sibling = notices[1];
  if (first.owner === sibling.owner || !first.owner.endsWith(':showcase-notice')) fail();
  ownedPair(opened, first.owner); const retained = ownedPair(opened, sibling.owner);
  const modal = opened.find(entry => entry.resource === 'modal');
  const owner = `${first.owner.slice(0, -':showcase-notice'.length)}:${enhanced ? 'recovery' : 'modal'}`;
  if (modal.owner !== owner) fail();
  if (!equal(closed, retained) || unloaded.length || final.length) fail();
  remainClosed(value.closed, value.finalObservation, new Set([first.owner, owner]));
  remainClosed(value.unloaded, value.finalObservation);
  if (enhanced) validateRecovery(value, opened, owner);
}
function validateRecovery(value, opened, owner) {
  if (!equal(value.retainedActionCalls, { pending: 2, afterClose: 1 }) || !equal(value.closed, value.replayed)) fail();
  ledger(value.replayed, []);
  if (ledger(value.cancelledProgress, []).length) fail();
  extendsLedger(value.cancelledProgress, value.opened);
  const cancelled = value.cancelledProgress.events.filter(event => event.kind === 'lifecycle').map(event => event.entry);
  const acquired = cancelled.filter(entry => entry.phase === 'acquired');
  if (!equal(acquired.map(entry => entry.resource).sort(), ['action', 'modal', 'notice', 'timer'])
    || new Set(acquired.map(entry => entry.owner)).size !== 1) fail();
  remainClosed(value.cancelledProgress, value.finalObservation, new Set(acquired.map(entry => entry.owner)));
  if (acquired.find(entry => entry.resource === 'timer')?.operation !== 'progress'
    || acquired.some(entry => entry.resource === 'notice' && entry.operation === 'progress')) fail();
  const recovery = opened.filter(entry => entry.owner === owner);
  if (!equal(recovery.map(entry => entry.resource).sort(), ['action', 'availability', 'modal', 'notice', 'notice'])) fail();
  if (!equal(recovery.filter(entry => entry.resource === 'notice').map(entry => entry.operation).sort(), ['progress', 'review'])
    || recovery.find(entry => entry.resource === 'action')?.count !== 1 || recovery.find(entry => entry.resource === 'availability')?.operation !== 'review') fail();
  if (value.opened.events.filter(event => event.kind === 'lifecycle' && event.entry.resource === 'availability' && event.entry.owner === owner && event.entry.phase === 'acquired').length !== 1) fail();
  const progress = value.opened.events.filter(event => event.kind === 'lifecycle' && event.entry.owner === owner && event.entry.operation === 'progress');
  if (!equal(progress.map(event => `${event.entry.resource}:${event.entry.phase}`), ['timer:acquired', 'timer:released', 'notice:acquired'])) fail();
}

/** Validate new independent ownership evidence only when its checks are claimed. */
export function validateNativeOwnership(raw, expectedChecks) {
  if (expectedChecks.includes(itemCheck)) validateItems(raw.itemOwnership);
  const enhanced = expectedChecks.includes(progressCheck) || expectedChecks.includes(recoveryCheck);
  if (enhanced && (!expectedChecks.includes(progressCheck) || !expectedChecks.includes(recoveryCheck))) fail();
  if (enhanced || expectedChecks.includes(closeCheck) || expectedChecks.includes(unloadCheck)) {
    if (!expectedChecks.includes(closeCheck) || !expectedChecks.includes(unloadCheck)) fail();
    validateResources(raw.resourceOwnership, enhanced);
  }
}
