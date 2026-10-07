// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { defineComponent, h } from 'vue';
import { App, Plugin } from 'obsidian';
import { createTestApp, hostInstance, type TestApp } from '@test/obsidian';
import { bindNativeIntegrations } from '../../src/infrastructure/obsidian/native-integrations';
import { CustomFileView, type MountNativeFileEditor } from '../../src/infrastructure/obsidian/custom-file-view';
import { createServices } from '../../src/bootstrap/services';
import { nativeFileEditorMounts } from '../../src/bootstrap/mount-file-editor';
import { useNativeFile } from '../../src/presentation/context/native-file-context';
import type { NativeFileEditorSession } from '../../src/application/native-file-editor';
import type { NativeFileDefinition } from '../../src/domain/native-integrations';
import { host } from './helpers';
import { memoryStorage } from './memory-storage';
import manifest from '../../manifest.json';
const board: NativeFileDefinition = { id: 'board', name: 'Board', extension: 'board', format: 'json', initialContent: '{}\n' };
class FixturePlugin extends Plugin {}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
async function fixture(mount: MountNativeFileEditor | Map<string, MountNativeFileEditor>) {
  const kit = createTestApp({ files: { 'a.board': '{"title":"A"}', 'bad.board': '{oops' } });
  const plugin = new FixturePlugin(hostInstance(kit.app, App), manifest);
  await kit.loadPlugin(plugin);
  const report = vi.fn();
  const editors = mount instanceof Map ? mount : new Map([['board', mount]]);
  const stop = bindNativeIntegrations(plugin, [board], [], report, editors);
  return { kit, plugin, report, stop };
}
async function open(kit: TestApp, path: string): Promise<CustomFileView> {
  const leaf = kit.workspace.getLeaf('tab');
  await leaf.openFile(kit.file(path));
  if (!(leaf.view instanceof CustomFileView)) throw Error('EXPECTED_CUSTOM_FILE_VIEW');
  return leaf.view;
}
function recordingEditor() {
  const sessions: NativeFileEditorSession[] = [];
  const released = vi.fn();
  const mount: MountNativeFileEditor = (root, session) => {
    sessions.push(session);
    root.createEl('p', { cls: 'probe', text: session.current().content });
    const stop = session.subscribe(() => {
      root.querySelector('.probe')!.textContent = session.current().content;
    });
    return () => {
      stop();
      released();
    };
  };
  return { mount, sessions, released };
}
it('mounts the registered editor instead of the raw textarea and saves session updates through the host', async () => {
  const editor = recordingEditor();
  const { kit, plugin, report } = await fixture(editor.mount);
  const view = await open(kit, 'a.board');
  expect(view.contentEl.querySelector('textarea')).toBeNull();
  expect(view.contentEl.querySelector('.probe')?.textContent).toBe('{"title":"A"}');
  const session = editor.sessions[0]!;
  expect(session.current()).toEqual({
    content: '{"title":"A"}',
    file: { path: 'a.board', name: 'a.board', basename: 'a' },
    validation: null,
    editable: true,
  });
  session.update('{"title":"Edited"}');
  await kit.flush();
  expect(kit.read('a.board')).toBe('{"title":"Edited"}');
  expect(view.contentEl.querySelector('.probe')?.textContent).toBe('{"title":"Edited"}');
  session.update('{broken');
  expect(session.current().validation).toContain('Invalid JSON');
  await kit.flush();
  expect(kit.read('a.board')).toBe('{broken');
  expect(report).not.toHaveBeenCalled();
  await kit.unloadPlugin(plugin);
});
it('stops editing on disposal, keeps the buffer for the final save and releases the editor once', async () => {
  const editor = recordingEditor();
  const { kit, plugin, stop } = await fixture(editor.mount);
  const view = await open(kit, 'a.board');
  const session = editor.sessions[0]!;
  stop();
  expect(editor.released).toHaveBeenCalledOnce();
  expect(session.current().editable).toBe(false);
  session.update('ignored');
  await kit.flush();
  expect(view.getViewData()).toBe('{"title":"A"}');
  expect(kit.read('a.board')).toBe('{"title":"A"}');
  stop();
  expect(editor.released).toHaveBeenCalledOnce();
  await kit.unloadPlugin(plugin);
});
it('releases the editor when its leaf closes', async () => {
  const editor = recordingEditor();
  const { kit, plugin } = await fixture(editor.mount);
  const view = await open(kit, 'a.board');
  view.leaf.detach();
  await kit.flush();
  expect(editor.released).toHaveBeenCalledOnce();
  await kit.unloadPlugin(plugin);
});
it('falls back to the raw editor when the custom editor fails to mount', async () => {
  const { kit, plugin, report } = await fixture(() => {
    throw new Error('private failure');
  });
  const view = await open(kit, 'bad.board');
  expect(report).toHaveBeenCalledWith('native.file.editor-mount');
  expect(view.contentEl.querySelector('textarea')?.value).toBe('{oops');
  expect(view.contentEl.textContent).toContain('Invalid JSON');
  await kit.unloadPlugin(plugin);
});
it('refuses an editor registered for an unknown file type before any host change', async () => {
  const kit = createTestApp();
  const plugin = new FixturePlugin(hostInstance(kit.app, App), manifest);
  await kit.loadPlugin(plugin);
  const editors = new Map<string, MountNativeFileEditor>([['missing', () => () => {}]]);
  expect(() => bindNativeIntegrations(plugin, [board], [], vi.fn(), editors)).toThrow('NATIVE_EDITOR_UNKNOWN_FILE_TYPE');
  expect(kit.commands()).toHaveLength(0);
  await kit.unloadPlugin(plugin);
});
it('mounts a Vue editor through the bootstrap registry with live file state and one write path', async () => {
  let id = 0;
  const services = await createServices({ documents: memoryStorage().storage, host: host(), settings: { load: async () => null, save: async () => undefined },
    local: { get: () => null, set() {} }, newId: () => `editor-${++id}`, now: () => '2026-10-06T12:00:00.000Z', observeError: vi.fn() });
  const Editor = defineComponent({
    setup() {
      const file = useNativeFile();
      return () => h('button', { class: 'vue-probe', onClick: () => file.update('{"title":"Vue"}') }, file.state.value.content);
    },
  });
  expect(() => nativeFileEditorMounts(services, [{ id: 'board', component: Editor }, { id: 'board', component: Editor }])).toThrow('NATIVE_EDITOR_DUPLICATE');
  const { kit, plugin } = await fixture(nativeFileEditorMounts(services, [{ id: 'board', component: Editor }]) as Map<string, MountNativeFileEditor>);
  try {
    const view = await open(kit, 'a.board');
    const button = view.contentEl.querySelector<HTMLButtonElement>('.vue-probe');
    expect(button?.textContent).toBe('{"title":"A"}');
    button?.click();
    await kit.flush();
    expect(kit.read('a.board')).toBe('{"title":"Vue"}');
    expect(view.contentEl.querySelector('.vue-probe')?.textContent).toBe('{"title":"Vue"}');
    view.leaf.detach();
    await kit.flush();
    expect(view.contentEl.querySelector('.vue-probe')).toBeNull();
  } finally {
    await kit.unloadPlugin(plugin);
    services.dispose();
  }
});
