// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { componentFixture, click, field, input, settle } from './component-fixture';
import { modalDecision } from './items-fixture';
import { deferred } from './helpers';

describe('Item panel with production components and services', () => {
  it('renders empty, invalid, populated and committed CRUD states with field-specific feedback', async () => {
    const f = await componentFixture();
    try {
      await click(f.root, 'Documents');
      const panel = f.root.querySelector<HTMLElement>('[data-testid="items-repository"]'); if (!panel) throw new Error('Missing items panel');
      expect(panel.textContent).toContain('No items yet.');
      await click(panel, 'Create item'); expect(panel.querySelector('[role="alert"]')?.textContent).toContain('1–120 characters');
      expect(field(panel, 'item-label').getAttribute('aria-invalid')).toBe('true'); expect(f.save).not.toHaveBeenCalled();
      await input(field(panel, 'item-label'), '  Example  '); await click(panel, 'Create item');
      expect(panel.querySelector('[role="status"]')?.textContent).toBe('Item created.');
      await click(panel, 'Edit item'); await input(field(panel, 'item-rename'), ''); await click(panel, 'Rename item');
      expect(field(panel, 'item-rename').getAttribute('aria-invalid')).toBe('true'); expect(field(panel, 'item-label').getAttribute('aria-invalid')).toBe('false');
      await input(field(panel, 'item-rename'), 'Renamed'); await click(panel, 'Rename item');
      expect(panel.textContent).toContain('Editing item: Renamed');
      await click(panel, 'Reload items'); expect(panel.textContent).toContain('Your drafts are retained');
      await click(panel, 'Delete item…'); await modalDecision(true); await settle();
      expect(panel.textContent).toContain('Item deleted.'); expect(panel.textContent).toContain('No items yet.'); expect(f.save).toHaveBeenCalledTimes(3);
      expect(f.write).not.toHaveBeenCalled(); expect(f.observe).not.toHaveBeenCalled();
    } finally { f.dispose(); }
  });
  it('keeps pending and uncertain outcomes visible and retains a draft across panel navigation', async () => {
    const f = await componentFixture(); const gate = deferred();
    try {
      await click(f.root, 'Documents');
      const panel = f.root.querySelector<HTMLElement>('[data-testid="items-repository"]'); if (!panel) throw new Error('Missing items panel');
      await input(field(panel, 'item-label'), 'Do not discard'); f.save.mockImplementationOnce(() => gate.promise);
      await click(panel, 'Create item'); expect(panel.textContent).toContain('Waiting for this action'); expect(field(panel, 'item-label').disabled).toBe(true);
      gate.reject(new Error('Storage failure')); await settle();
      expect(panel.querySelector('[role="alert"]')?.textContent).toContain('save outcome is uncertain');
      expect(panel.querySelector('[role="status"]')).toBeNull(); expect(field(panel, 'item-label').value).toBe('Do not discard');
      await click(f.root, 'Overview'); await click(f.root, 'Documents');
      expect(field(f.root, 'item-label').value).toBe('Do not discard'); expect(field(f.root, 'item-label').disabled).toBe(true);
      expect(f.save).toHaveBeenCalledOnce(); expect(f.observe).toHaveBeenCalledExactlyOnceWith({ code: 'settings.write', operation: 'settings.save', sequence: 1 });
    } finally { f.dispose(); }
  });
});
