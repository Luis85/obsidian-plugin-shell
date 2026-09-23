import { expect } from '@playwright/test';
import { join } from 'node:path';
import { nativeCommand } from './native-command.mjs';
import { assertDiagnostics } from './native-header-checks.mjs';

/** Qualifies real registered commands and the canonical modal/notice services. */
export async function qualifyDebugging(page, report, output, identity, notePath) {
  report.phase = 'native-debugging';
  await nativeCommand(page, 'Toggle debug logging');
  await expect(page.getByText('Debug logging enabled for this session.', { exact: true })).toBeVisible();
  await nativeCommand(page, 'Inspect debug report');
  const modal = page.locator('.modal').filter({ hasText: 'Debug report' });
  await expect(modal).toBeVisible();
  const raw = await modal.locator('.shell-modal-copy').innerText();
  const state = JSON.parse(raw);
  expect(state).toMatchObject({ schemaVersion: 1, debugEnabled: true,
    identity: { id: identity.id, version: identity.version, host: 'obsidian' } });
  expect(state.logs.length).toBeGreaterThan(0); expect(state.logs.length).toBeLessThanOrEqual(50);
  for (const entry of state.logs) expect(Object.keys(entry).sort()).toEqual(['code', 'level', 'metadata', 'operation', 'sequence', 'timestamp']);
  expect(raw).not.toContain(notePath); expect(raw).not.toContain('Synthetic native prompt');
  expect(raw).not.toContain('Native smoke Task'); expect(raw).not.toContain('Native repository Task');
  await modal.screenshot({ path: join(output, 'native-debug-report.png') });
  await modal.locator('button[type="submit"]').click(); await expect(modal).toHaveCount(0);
  await nativeCommand(page, 'Toggle debug logging');
  await expect(page.getByText('Debug logging disabled. Error diagnostics remain active.', { exact: true })).toBeVisible();
  await nativeCommand(page, 'Inspect debug report'); await expect(modal).toBeVisible();
  const disabled = JSON.parse(await modal.locator('.shell-modal-copy').innerText());
  expect(disabled).toMatchObject({ debugEnabled: false, level: 'info' });
  await modal.locator('button[type="submit"]').click(); await expect(modal).toHaveCount(0);
  report.checks.push('native-debug-commands-toggle-and-export-attributable-redacted-report');
  await assertDiagnostics(page, identity);
}
