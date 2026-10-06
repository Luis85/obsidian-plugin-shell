/** Synthetic parser data only. These records are never native execution evidence. */
const basic = [
  'native-items-independent-fault-ledger-exact-count-zero-loss-before-reconstruction',
  'native-owned-notice-modal-expiry-timer-close-preserves-live-sibling-and-foreign-notice',
  'native-unload-releases-observed-plugin-handles-with-independent-zero-fault-ledger-and-retains-foreign-notice',
];
export const nativeOwnershipChecks = { basic, enhanced: [...basic,
  'native-delayed-progress-cancelled-before-display-on-owner-close',
  'native-pending-recovery-action-closed-owner-rejects-retained-native-handler'] };
const first = 'view:first:showcase-notice'; const sibling = 'view:sibling:showcase-notice';
const receipt = (resource, id, owner, phase = 'acquired') => ({ resource, phase, owner, operation: 'example', id, count: 1 });
export function nativeOwnershipObservation(entries) {
  const events = entries.map((entry, index) => ({ kind: 'resource' in entry ? 'lifecycle' : 'error', sequence: index + 1, entry }));
  const errors = events.filter(event => event.kind === 'error').length;
  return { baseline: { sequence: 0, errors: 0, resources: 0, observerFailures: 0 },
    current: { sequence: events.length, errors, resources: events.length - errors, observerFailures: 0 },
    events, lost: 0, sequenceGaps: 0, lastSequence: events.length };
}
function legacyResources() {
  const entries = [receipt('notice', 1, first), receipt('timer', 2, first), receipt('notice', 3, sibling),
    receipt('timer', 4, sibling), receipt('modal', 1, 'view:first:modal')];
  const opened = nativeOwnershipObservation(entries);
  entries.push({ ...entries[0], phase: 'released' }, { ...entries[1], phase: 'released' }, { ...entries[4], phase: 'released' });
  const closed = nativeOwnershipObservation(entries);
  entries.push({ ...entries[2], phase: 'released' }, { ...entries[3], phase: 'released' });
  const unloaded = nativeOwnershipObservation(entries);
  return { status: 'passed', mode: 'native-public-ui',
    unexecuted: ['native delayed progress: no public UI caller', 'native pending recovery availability: no public UI registry caller', 'forced late native callback: no mutation capability exposed by observer'],
    opened, closed, unloaded, finalObservation: structuredClone(unloaded) };
}
function enhancedResources() {
  const owner = 'view:first:recovery'; const cancelledOwner = 'view:cancelled:recovery';
  const owned = (resource, id, owner, operation) => ({ ...receipt(resource, id, owner), operation });
  const cancelled = [owned('modal', 1, cancelledOwner, 'confirm'), owned('action', 1, cancelledOwner, 'recovery'),
    owned('notice', 2, cancelledOwner, 'review'), owned('timer', 3, cancelledOwner, 'progress')];
  const entries = [...cancelled, ...cancelled.map(entry => ({ ...entry, phase: 'released' }))];
  const cancelledProgress = nativeOwnershipObservation(entries);
  const ordinary = [receipt('notice', 4, first), receipt('timer', 5, first), receipt('notice', 6, sibling), receipt('timer', 7, sibling)];
  const recovery = [owned('modal', 2, owner, 'confirm'), owned('action', 8, owner, 'recovery'), owned('notice', 9, owner, 'review'), owned('availability', 12, owner, 'review')];
  const timer = owned('timer', 10, owner, 'progress'); const progress = owned('notice', 11, owner, 'progress');
  entries.push(...ordinary, ...recovery.slice(0, 3), timer, recovery[3], { ...timer, phase: 'released' }, progress);
  const opened = nativeOwnershipObservation(entries);
  entries.push(...[ordinary[0], ordinary[1], ...recovery, progress].map(entry => ({ ...entry, phase: 'released' })));
  const closed = nativeOwnershipObservation(entries);
  entries.push(...ordinary.slice(2).map(entry => ({ ...entry, phase: 'released' })));
  const unloaded = nativeOwnershipObservation(entries);
  return { status: 'passed', mode: 'native-public-ui', unexecuted: [], cancelledProgress, opened, closed,
    replayed: structuredClone(closed), unloaded, finalObservation: structuredClone(unloaded), retainedActionCalls: { pending: 2, afterClose: 1 } };
}
export function nativeOwnershipFixture(enhanced = false) {
  const fault = { sequence: 1, code: 'settings.write', operation: 'settings.save' };
  return { checks: [...(enhanced ? nativeOwnershipChecks.enhanced : nativeOwnershipChecks.basic)],
    itemOwnership: { status: 'passed', mode: 'controlled-adapter-in-native-host', nativeDiskFailure: false,
      counts: { calls: 2, completed: 1, failed: 1 }, independentObservation: nativeOwnershipObservation([fault]), finalObservation: nativeOwnershipObservation([fault]),
      diagnosticSource: 'independent-runtime-observer', diagnostics: [fault] },
    resourceOwnership: enhanced ? enhancedResources() : legacyResources() };
}
