import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { writeEvidence } from './support/evidence';

describe('plugin commands in real Obsidian', () => {
  test('registers commands and the command palette lists every currently available one', async ({ obsidian }) => {
    // Availability callbacks must be side-effect free, so checking them here is safe.
    const commands = await obsidian.eval(({ app, pluginId }) => app.commands.listCommands()
      .filter(command => command.id.startsWith(`${pluginId}:`))
      .map(command => ({ id: command.id, name: command.name,
        available: command.editorCallback || command.editorCheckCallback ? false : command.checkCallback ? Boolean(command.checkCallback(true)) : true })));
    await writeEvidence(obsidian.directory, 'commands', commands);
    expect(commands.length, 'the plugin registers at least one command').toBeGreaterThan(0);
    const palette = obsidian.page.locator('.prompt');
    for (const command of commands.filter(item => item.available)) {
      await obsidian.runCommand('command-palette:open');
      const input = palette.locator('input.prompt-input');
      await input.fill(command.name);
      await expect.poll(() => palette.locator('.suggestion-item').allInnerTexts(), { message: command.id })
        .toContainEqual(expect.stringContaining(command.name.split(': ').at(-1) ?? command.name));
      await input.press('Escape');
      await expect.poll(() => palette.count()).toBe(0);
    }
    expect(obsidian.errors()).toEqual([]);
  });
});
