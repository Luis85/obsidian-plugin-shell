import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('plugin views in real Obsidian', () => {
  test('opens every view type the plugin registers and renders content', async ({ obsidian }) => {
    const rendered: string[] = [];
    for (const type of obsidian.pluginViewTypes) {
      const view = await obsidian.openView(type);
      await expect.poll(() => view.locator('.view-content').evaluate(element => element.childElementCount), { message: type }).toBeGreaterThan(0);
      await expect.poll(() => view.locator('.view-content').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(0);
      rendered.push(type);
      await obsidian.screenshot(`view-${type}`);
    }
    // A plugin without views passes trivially; every registered view must render.
    expect(rendered).toEqual(obsidian.pluginViewTypes);
    expect(obsidian.errors()).toEqual([]);
  });
});
