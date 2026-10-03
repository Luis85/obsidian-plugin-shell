import { literal, type Model } from '../../../scripts/companion/compiler/model.ts';
import { relativeImport, type Add } from '../../../scripts/companion/compiler/file-code.ts';

/** Real-host acceptance is explicit and runs only in the existing copied-vault fixture. */
export function journeyTestCode(m: Model, surface: string, add: Add): void {
  const file = 'tests/obsidian/journey-lens.obsidian.ts';
  const screen = m.screens.find(screen => screen.id === surface)!;
  add(file, `import { expect } from 'vitest';
import { expect as browserExpect } from '@playwright/test';
import { test } from './support/obsidian-fixture';
import { seed } from ${literal(relativeImport(file, `${m.sourceRoot}/domain/journey-seed.ts`))};
const suffix = ${literal('-view-project-workbench-' + screen.slug)};

test('native Journey Lens creates only after review, saves and reopens the complete project', async ({ obsidian }) => {
  const type = obsidian.pluginId + suffix;
  expect(obsidian.pluginViewTypes).toContain(type);
  const view = await obsidian.openView(type), workspace = view.locator('.jl-workspace');
  await browserExpect(workspace).toHaveAttribute('data-journey-mode', 'native');
  await browserExpect(workspace.getByRole('button', { name: 'Open file', exact: true })).toBeEnabled();
  expect(await obsidian.eval(({ app }) => app.vault.getAbstractFileByPath('project.companion.json') === null)).toBe(true);
  await workspace.getByRole('button', { name: 'Create from generated definition', exact: true }).click();
  await workspace.getByRole('button', { name: 'Validate and review', exact: true }).click();
  expect(await obsidian.eval(({ app }) => app.vault.getAbstractFileByPath('project.companion.json') === null)).toBe(true);
  await workspace.getByLabel('I approve this complete project write').check();
  await workspace.getByRole('button', { name: 'Apply project import', exact: true }).click();
  await browserExpect(workspace.locator('.jl-file-status')).toContainText('Apply saves each reviewed change to the active vault file.');
  await browserExpect(workspace.locator('.vue-flow__node').first()).toBeVisible();
  const inspector = workspace.getByRole('complementary', { name: 'Selected surface', exact: true });
  const originalName = await inspector.getByLabel('Name', { exact: true }).inputValue();
  const selectedId = await workspace.locator('.jm-node.selected').getAttribute('data-surface');
  const original = JSON.parse(seed), node = original.design.nodes.find((item: {id:string}) => item.id === selectedId);
  expect(node).toBeTruthy();
  await inspector.getByLabel('Name', { exact: true }).fill('Verified native sitemap edit');
  await inspector.getByRole('button', { name: 'Save name', exact: true }).click();
  await browserExpect(inspector.getByRole('button', { name: 'Save name', exact: true })).toHaveCount(0);
  const saved = JSON.parse(await obsidian.eval(async ({ app }) => {
    const file = app.vault.getFileByPath('project.companion.json'); if (!file) throw Error('PROJECT_MISSING');
    return app.vault.read(file);
  }));
  expect(saved.design.nodes.find((item: {id:string}) => item.id === node.id).label).toBe('Verified native sitemap edit');
  const restored = structuredClone(saved); restored.design.nodes.find((item: {id:string}) => item.id === node.id).label = originalName;
  expect(restored).toEqual(original);
  await obsidian.reloadPlugin();
  const reopened = (await obsidian.openView(type)).locator('.jl-workspace');
  await browserExpect(reopened.locator('.jl-file-status')).toContainText('Apply saves each reviewed change to the active vault file.');
  await browserExpect(reopened.getByRole('complementary', { name: 'Selected surface', exact: true }).getByLabel('Name', { exact: true })).toHaveValue('Verified native sitemap edit');
  expect(await obsidian.eval(({ app }) => app.vault.getMarkdownFiles().map(file => file.path).sort())).toEqual(['Notes/Example.md', 'Welcome.md']);
  expect(obsidian.errors()).toEqual([]);
  await obsidian.screenshot('journey-saved-reopened');
});

test('native Journey Lens leaves keep independent drafts and refuse stale overwrite', async ({ obsidian }) => {
  await obsidian.eval(async ({ app }, content) => { await app.vault.create('project.companion.json', content); }, seed);
  const type = obsidian.pluginId + suffix;
  await obsidian.openView(type);
  // openView returns a live last() locator: pin the first leaf before opening another.
  const first = obsidian.page.locator('.workspace-leaf-content[data-type="' + type + '"]').first().locator('.jl-workspace');
  await browserExpect(first.locator('.jl-file-status')).toContainText('Apply saves each reviewed change to the active vault file.');
  const firstName = first.getByRole('complementary', { name: 'Selected surface', exact: true }).getByLabel('Name', { exact: true });
  await firstName.fill('Unsubmitted first leaf draft');
  const firstId = await firstName.getAttribute('id');
  const second = (await obsidian.openView(type)).locator('.jl-workspace');
  await browserExpect(second.locator('.jl-file-status')).toContainText('Apply saves each reviewed change to the active vault file.');
  const secondName = second.getByRole('complementary', { name: 'Selected surface', exact: true }).getByLabel('Name', { exact: true });
  expect(await secondName.getAttribute('id')).not.toBe(firstId);
  expect(await secondName.inputValue()).not.toBe('Unsubmitted first leaf draft');
  await secondName.fill('Committed from second leaf');
  await second.getByRole('button', { name: 'Save name', exact: true }).click();
  await browserExpect(second.getByRole('button', { name: 'Save name', exact: true })).toHaveCount(0);
  await obsidian.eval(async ({ app }, viewType) => { const leaf = app.workspace.getLeavesOfType(viewType)[0]; if (!leaf) throw Error('LEAF_MISSING'); await app.workspace.revealLeaf(leaf); }, type);
  await browserExpect(first.locator('.jl-file-status')).toContainText('Another view or an external edit changed this project');
  await browserExpect(firstName).toHaveValue('Unsubmitted first leaf draft');
  await browserExpect(first.getByRole('button', { name: 'Save name', exact: true })).toBeDisabled();
  const bytes = await obsidian.eval(async ({ app }) => { const file = app.vault.getFileByPath('project.companion.json'); if (!file) throw Error('PROJECT_MISSING'); return app.vault.read(file); });
  expect(bytes).toContain('Committed from second leaf'); expect(bytes).not.toContain('Unsubmitted first leaf draft');
  expect(obsidian.errors()).toEqual([]);
});
`);
}
