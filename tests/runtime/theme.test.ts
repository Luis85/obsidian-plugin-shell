// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { bindHostTheme } from '../../src/infrastructure/ui/host-theme';
afterEach(() => { document.body.replaceChildren(); document.body.className = ''; });
it('[THEME-02-01] host class changes propagate and cleanup restores only plugin-owned state', async () => {
  const root = document.createElement('div'); root.className = 'plugin-shell user-owned'; document.body.append(root);
  document.body.className = 'theme-dark'; const stop = bindHostTheme(root);
  expect(root.className).toBe('plugin-shell user-owned dark');
  document.body.className = 'theme-light'; await vi.waitFor(() => expect(root.classList.contains('light')).toBe(true));
  stop(); stop(); expect(root.className).toBe('plugin-shell user-owned');
  document.body.className = 'theme-dark'; await new Promise(resolve => setTimeout(resolve, 0));
  expect(root.className).toBe('plugin-shell user-owned');
});
it('[THEME-02-02] an existing view moved to a pop-out rebinds to the new document', async () => {
  document.body.className = 'theme-dark';
  const root = document.createElement('div'); document.body.append(root);
  let refresh = () => {}; const off = vi.fn();
  const stop = bindHostTheme(root, callback => { refresh = callback; return off; });
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const owner = iframe.contentDocument; if (!owner) throw new Error('MISSING_FRAME');
  owner.body.className = 'theme-light'; owner.body.append(owner.adoptNode(root)); refresh();
  expect(root.classList.contains('light')).toBe(true);
  owner.body.className = 'theme-dark'; await vi.waitFor(() => expect(root.classList.contains('dark')).toBe(true));
  document.body.className = 'theme-light'; await new Promise(resolve => setTimeout(resolve, 0));
  expect(root.classList.contains('dark')).toBe(true); stop(); expect(off).toHaveBeenCalledTimes(1);
});
it('[THEME-02-03] failed owner registration restores initial presentation', () => {
  const root = document.createElement('div'); root.className = 'plugin-shell light';
  document.body.className = 'theme-dark';
  expect(() => bindHostTheme(root, () => { throw new Error('registration'); })).toThrow('registration');
  expect(root.className).toBe('plugin-shell light');
});
