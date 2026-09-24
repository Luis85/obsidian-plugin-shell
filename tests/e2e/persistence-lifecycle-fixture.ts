import { expect, type Locator, type Page } from '@playwright/test';
import manifest from '../../manifest.json' with { type: 'json' };
import '../../harness/app/test-api';

declare global {
  interface Window {
    __PL_WRITES__: { key: string; value: string }[];
    __PL_SAVE_FAILURE__: 'none' | 'before' | 'after';
    __PL_RETAINED_BUTTON__?: HTMLButtonElement;
  }
}
export const prefix = `${manifest.id}:harness:v1:`;
export async function instrument(page: Page, raw?: string) {
  await page.addInitScript(({ prefix, raw }) => {
    if (raw !== undefined && sessionStorage.getItem('pl-seeded') !== 'yes') {
      localStorage.setItem(`${prefix}settings`, raw); sessionStorage.setItem('pl-seeded', 'yes');
    }
    window.__PL_WRITES__ = []; window.__PL_SAVE_FAILURE__ = 'none';
    const persist = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      const settings = this === localStorage && key === `${prefix}settings`;
      if (this === localStorage) window.__PL_WRITES__.push({ key, value });
      if (settings && window.__PL_SAVE_FAILURE__ === 'before') throw new Error('Controlled rejection before persistence');
      persist.call(this, key, value);
      if (settings && window.__PL_SAVE_FAILURE__ === 'after') throw new Error('Controlled lost persistence acknowledgment');
    };
  }, { prefix, raw });
}
export async function ready(page: Page) {
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}
export async function writes(page: Page, kind: 'settings' | 'files') {
  return page.evaluate(key => window.__PL_WRITES__.filter(entry => entry.key === key), `${prefix}${kind}`);
}
export async function stored(page: Page) { return page.evaluate(key => localStorage.getItem(key), `${prefix}settings`); }
export async function ledger(page: Page, expected: { code: string; operation: string }[] = []) {
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual(expected);
}
export async function preview(root: Locator, title: string) {
  await root.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await root.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  return root.getByTestId('markdown-preview').innerText();
}
export function itemEnvelope(id: string, label: string) {
  return { schemaVersion: 1, preferences: { hideObsidianViewHeader: false, locale: 'en', taskFolder: 'Tasks', notifySuccess: true },
    pluginEntities: { schemaVersion: 1, collections: { item: { schemaVersion: 1, revision: 1,
      records: [{ id, revision: 1, createdAt: '2026-09-22T12:00:00.000Z', values: { label } }] } } } };
}
