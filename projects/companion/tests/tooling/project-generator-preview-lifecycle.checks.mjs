import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clickdummyHostCode } from '../../bin/compiler/emitters/clickdummy-host-code.ts';

async function load(t) {
  const root = await mkdtemp(join(tmpdir(), 'preview-lifecycle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let source; clickdummyHostCode((_path, content) => { source = content; });
  const path = join(root, 'host.mts'); await writeFile(path, source);
  return import(pathToFileURL(path).href);
}
function windowEvents() {
  const window = new EventTarget();
  return { window, emit: name => window.dispatchEvent(new Event(name)) };
}
test('emitted preview lifecycle resumes one frame after pagehide and repeated pageshow', async t => {
  const { createPreviewLifecycle } = await load(t), { window, emit } = windowEvents();
  let mounted = 0, released = 0, dialogs = 0;
  const errors = [];
  const lifecycle = createPreviewLifecycle(window, {
    mount() { mounted++; return () => { released++; }; },
    closeDialogs() { dialogs++; }, error: message => errors.push(message),
  });
  assert.equal(mounted, 1); emit('pageshow'); assert.equal(mounted, 1);
  emit('pagehide'); emit('pagehide'); assert.equal(released, 1);
  emit('pageshow'); emit('pageshow'); assert.equal(mounted, 2);
  lifecycle.reset(); assert.equal(mounted, 3); assert.equal(released, 2);
  lifecycle.dispose(); lifecycle.dispose(); emit('pageshow'); emit('pagehide'); lifecycle.reset();
  assert.equal(mounted, 3); assert.equal(released, 3); assert.equal(dialogs, 4);
  assert.deepEqual(errors, []);
});
test('dialog cleanup failure does not prevent frame teardown or a clean retry', async t => {
  const { createPreviewLifecycle } = await load(t), { window, emit } = windowEvents();
  let releases = 0, mounts = 0; const errors = [];
  const lifecycle = createPreviewLifecycle(window, {
    mount() { mounts++; return () => { releases++; }; },
    closeDialogs() { throw new Error('/private/project/secret'); }, error: message => errors.push(message),
  });
  emit('pagehide'); assert.equal(releases, 1); emit('pageshow'); assert.equal(mounts, 2);
  lifecycle.dispose(); assert.equal(releases, 2);
  assert.deepEqual(errors, ['Preview dialog cleanup failed.', 'Preview dialog cleanup failed.']);
});
test('failed mount can retry on pageshow without exposing the raw cause', async t => {
  const { createPreviewLifecycle } = await load(t), { window, emit } = windowEvents();
  let attempts = 0, releases = 0; const errors = [];
  const lifecycle = createPreviewLifecycle(window, {
    mount() { if (++attempts === 1) throw new Error('private note'); return () => { releases++; }; },
    closeDialogs() {}, error: message => errors.push(message),
  });
  assert.equal(attempts, 1); emit('pageshow'); emit('pageshow'); assert.equal(attempts, 2);
  lifecycle.dispose(); assert.equal(releases, 1);
  assert.deepEqual(errors, ['Preview could not be opened. Reload the file to retry.']);
});
test('uncertain teardown is reported but never retains a stale release handle', async t => {
  const { createPreviewLifecycle } = await load(t), { window, emit } = windowEvents();
  let releases = 0, mounts = 0; const errors = [];
  const lifecycle = createPreviewLifecycle(window, {
    mount() { mounts++; return () => { releases++; throw new Error('sensitive'); }; },
    closeDialogs() {}, error: message => errors.push(message),
  });
  emit('pagehide'); emit('pagehide'); assert.equal(releases, 1);
  emit('pageshow'); assert.equal(mounts, 2); lifecycle.dispose();
  assert.equal(releases, 2); assert.equal(errors.length, 2);
  assert.ok(errors.every(message => message === 'Preview cleanup failed. Reset preview before continuing.'));
});
