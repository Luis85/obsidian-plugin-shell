// Generated helpers for the journey specs. They use only the preview's own addresses and visible controls.
import { expect, type Page } from '@playwright/test';

const screenHeading = '.generated-screen > h2';
/** Opens a surface by its preview address (hash) and checks that the surface heading is shown. */
export async function openSurface(page: Page, path: string, label: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await expect(page.locator(screenHeading)).toHaveText(label);
}
async function clickControl(page: Page, name: string, nth: number): Promise<void> {
  await page.locator('.generated-screen').getByRole('button', { name, exact: true }).nth(nth).click();
}
/** Clicks a navigation control of the current screen; the target heading and address must follow. */
export async function followControl(page: Page, name: string, nth: number, path: string, label: string): Promise<void> {
  await clickControl(page, name, nth);
  await expect(page.locator(screenHeading)).toHaveText(label);
  await expect(page).toHaveURL(url => url.hash === path.slice(1));
}
/** Clicks a control that opens a dialog; the labelled dialog must be shown. */
export async function followToDialog(page: Page, name: string, nth: number, label: string): Promise<void> {
  await clickControl(page, name, nth);
  await expect(page.getByRole('dialog', { name: label, exact: true })).toBeVisible();
}
