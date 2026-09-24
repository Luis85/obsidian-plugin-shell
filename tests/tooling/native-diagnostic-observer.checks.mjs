import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createNativeDiagnosticObserver, noteNativePhase } from '../../scripts/testing/native-diagnostic-observer.mjs';

function page(url = 'app://obsidian.md/index.html') {
  const emitter = new EventEmitter();
  emitter.url = () => url;
  return emitter;
}

test('native diagnostics retain every renderer error with stable page identity and receipt phase', () => {
  const report = { errors: [] };
  const observer = createNativeDiagnosticObserver(report);
  const main = page(); const sibling = page();
  observer.observe(main); observer.observe(main); observer.observe(sibling);
  noteNativePhase(report, 'popout-close');
  const error = new Error('illegal access'); error.stack = '';
  main.emit('pageerror', error); main.emit('pageerror', error); sibling.emit('pageerror', error);
  assert.deepEqual(report.errors, Array.from({ length: 3 }, () => ({
    message: 'illegal access', stack: '', url: 'app://obsidian.md/index.html', phase: 'popout-close',
  })));
  const receipts = report.nativeDiagnostics.events.filter(event => event.kind === 'pageerror');
  assert.deepEqual(receipts.map(event => [event.pageId, event.errorIndex, event.phase]),
    [[1, 0, 'popout-close'], [1, 1, 'popout-close'], [2, 2, 'popout-close']]);
  const transitions = report.nativeDiagnostics.events.filter(event => event.kind === 'phase');
  assert.deepEqual(transitions.map(event => event.phase), ['initial-smoke', 'popout-close']);
  assert.equal(report.phase, 'popout-close');
  assert.ok(report.nativeDiagnostics.events.every(event => Number.isFinite(Date.parse(event.at))));
  assert.ok(report.nativeDiagnostics.events.every((event, index, all) =>
    Number.isFinite(event.monotonicMs) && (index === 0 || event.monotonicMs >= all[index - 1].monotonicMs)));
  observer.dispose();
});

test('native diagnostic disposal retains closing errors and removes only owned listeners', () => {
  const report = { errors: [], status: 'passed' };
  const observer = createNativeDiagnosticObserver(report);
  const main = page(); let foreignCalls = 0;
  main.on('pageerror', () => { foreignCalls++; });
  observer.observe(main);
  noteNativePhase(report, 'host-cleanup');
  main.emit('close'); main.emit('pageerror', new Error('late close error'));
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0].message, 'late close error');
  assert.equal(report.errors[0].phase, 'host-cleanup');
  assert.deepEqual(report.nativeDiagnostics.events.slice(-2).map(event => event.kind), ['page-close', 'pageerror']);
  observer.dispose(); observer.dispose();
  assert.equal(main.listenerCount('pageerror'), 1);
  assert.equal(main.listenerCount('close'), 0);
  main.emit('pageerror', new Error('foreign later error'));
  assert.equal(foreignCalls, 2);
  assert.equal(report.errors.length, 1);
  assert.equal(report.nativeDiagnostics.events.filter(event => event.kind === 'observer-disposed').length, 1);
  assert.throws(() => observer.observe(page()), /NATIVE_DIAGNOSTICS_DISPOSED/);
  assert.throws(() => createNativeDiagnosticObserver(report), /NATIVE_DIAGNOSTICS_ALREADY_ATTACHED/);
});
