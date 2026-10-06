// @vitest-environment happy-dom
// Framework checkout only: loads the shell's own src/main.ts entry. A generated project replaces src/main.ts with its
// generated entry, so the generator does not ship this file (src/cli/compiler/emitters/framework-docs.ts maintainerFiles).
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App } from 'obsidian';
import ShellPlugin from '../../src/main';
import { SHOWCASE_VIEW, ShowcaseView } from '../../src/infrastructure/obsidian/showcase-view';
import { pluginIdentity } from '../../src/infrastructure/plugin-identity';
import { createTestApp, flushObsidian } from '@test/obsidian';
import manifest from '../../manifest.json';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
const dataPath = `.obsidian/plugins/${manifest.id}/data.json`;

it('loads the real shell entry: commands, ribbon, view, settings and host listeners register and unload cleanly', async () => {
  const app = new App(); const kit = createTestApp({ app, files: { 'Inbox.md': '# Inbox\n' } });
  const plugin = new ShellPlugin(app, manifest);
  await kit.loadPlugin(plugin);
  const ids = kit.commands().map(command => command.id);
  expect(ids).toEqual(expect.arrayContaining(['open-showcase', 'toggle-view-header', 'debug-toggle', 'debug-report'].map(id => `${manifest.id}:${id}`)));
  expect(kit.ribbons()).toHaveLength(1);
  expect(kit.vault.listenerCount('create')).toBe(1); expect(kit.metadataCache.listenerCount('changed')).toBe(1);
  expect(await kit.runCommand('open-showcase')).toBe(true);
  const [leaf, ...others] = kit.workspace.getLeavesOfType(SHOWCASE_VIEW);
  if (!leaf || !(leaf.view instanceof ShowcaseView)) throw new Error('SHOWCASE_VIEW_NOT_OPENED');
  expect(others).toEqual([]);
  expect(leaf.view.containerEl.querySelector('[data-testid="showcase"]')).not.toBeNull();
  await kit.clickRibbon(kit.ribbons()[0]?.title ?? ''); expect(kit.workspace.getLeavesOfType(SHOWCASE_VIEW)).toEqual([leaf]);
  const tab = kit.openSettings(plugin);
  const row = [...tab.containerEl.querySelectorAll('.setting-item')].find(item => item.querySelector('.setting-item-name')?.textContent === 'Hide Obsidian view header');
  const toggle = row?.querySelector<HTMLElement>('.checkbox-container');
  if (!toggle) throw new Error('HEADER_TOGGLE_NOT_RENDERED');
  const write = vi.spyOn(kit.vault.adapter, 'write');
  toggle.click(); await flushObsidian();
  expect(write).toHaveBeenCalledOnce(); expect(write.mock.calls[0]?.[0]).toBe(dataPath);
  expect(toggle.classList.contains('is-enabled')).toBe(true);
  expect(JSON.parse(kit.read(dataPath))).toMatchObject({ preferences: { hideObsidianViewHeader: true } });
  expect(leaf.view.containerEl.classList.contains(pluginIdentity.hiddenHeaderClass)).toBe(true);
  await kit.unloadPlugin(plugin);
  expect(kit.commands()).toEqual([]); expect(kit.ribbons()).toEqual([]); expect(kit.app.setting.pluginTabs).toEqual([]);
  expect(kit.workspace.getLeavesOfType(SHOWCASE_VIEW)).toEqual([leaf]);
  expect(leaf.view).not.toBeInstanceOf(ShowcaseView); expect(document.querySelector('[data-testid="showcase"]')).toBeNull();
  expect(document.querySelector(`.${pluginIdentity.hiddenHeaderClass}`)).toBeNull();
  expect(kit.vault.listenerCount('create')).toBe(0); expect(kit.metadataCache.listenerCount('changed')).toBe(0);
  expect(kit.errors).toEqual([]);
});
