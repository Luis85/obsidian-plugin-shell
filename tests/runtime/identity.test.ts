// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('../../manifest.json', () => ({ default: { id: 'field-notes', name: 'Field @ {Notes}', version: '1.2.3' } }));
import { componentFixture, click, settle } from './component-fixture';
import { pluginIdentity } from '../../src/infrastructure/plugin-identity';
import { bindViewHeader, SHOWCASE_VIEW } from '../../src/infrastructure/obsidian/view-header';

it('[IDENTITY-01] a renamed plugin uses its own DOM, view and storage identity and treats display names as text', async () => {
  const f = await componentFixture();
  try {
    expect(pluginIdentity.id).toBe('field-notes'); expect(SHOWCASE_VIEW).toBe('field-notes-showcase');
    expect(f.root.dataset.pluginUi).toBe('field-notes');
    expect(f.root.classList.contains('field-notes')).toBe(true); expect(f.root.classList.contains('plugin-shell')).toBe(false);
    expect(f.root.textContent).toContain('Field @ {Notes}'); expect(f.root.textContent).toContain('v1.2.3');
    await click(f.root, 'Documents');
    const ids = Array.from(f.root.querySelectorAll('[id]')).map(el => el.id);
    expect(ids.length).toBeGreaterThan(0); expect(ids.every(id => id.startsWith('field-notes-'))).toBe(true);
    await f.services.preferences.update({ locale: 'de' }); await settle();
    expect(f.root.textContent).toContain('Field @ {Notes}'); expect(f.observe).not.toHaveBeenCalled();
    const frame = document.createElement('div'); frame.dataset.type = SHOWCASE_VIEW;
    frame.innerHTML = '<div class="view-header"></div>'; document.body.append(frame);
    const close = bindViewHeader(frame, f.services.preferences, f.services.diagnostics);
    await f.services.preferences.update({ hideObsidianViewHeader: true });
    expect(frame.classList.contains('field-notes-native-header-hidden')).toBe(true);
    expect(frame.classList.contains('plugin-shell-native-header-hidden')).toBe(false);
    close(); expect(frame.classList.contains('field-notes-native-header-hidden')).toBe(false); frame.remove();
  } finally { f.dispose(); }
});
