/** Reusable Playwright assertions for the STANDALONE specimen. No production services. */
import assert from 'node:assert/strict';
const text = async (page, selector) => (await page.locator(selector).textContent())?.trim();
export const specimenChecks = [
  { id: 'BRW-01', name: 'host tokens and light/dark transitions', run: async ({ page }) => {
    const token = () => page.locator('body').evaluate((el) => getComputedStyle(el).getPropertyValue('--background-primary').trim());
    const dark = await token(); assert.ok(dark);
    await page.selectOption('#theme', 'light'); const light = await token();
    assert.ok(light); assert.notEqual(dark, light);
    await page.selectOption('#theme', 'dark'); assert.equal(await token(), dark);
    return { transitions: ['dark','light','dark'] };
  } },
  { id: 'BRW-02', name: 'narrow layouts have no document overflow', run: async ({ page }) => {
    for (const width of [320,390,900,1280]) {
      await page.setViewportSize({ width, height: 900 });
      const size = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(size.document <= size.viewport + 1, JSON.stringify(size));
    }
    return { widths: [320,390,900,1280] };
  } },
  { id: 'BRW-03', name: 'localized validation is associated and clears on input', run: async ({ page }) => {
    await page.selectOption('#language', 'de'); await page.click('#validate');
    assert.equal(await page.locator('#task-title').getAttribute('aria-invalid'), 'true');
    assert.match(await text(page, '#title-error'), /Bitte/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'task-title');
    await page.fill('#task-title','A deterministic task');
    assert.equal(await text(page, '#title-error'), '');
    assert.equal(await page.locator('#task-title').getAttribute('aria-invalid'), null);
    return { locale: 'de', state: 'cleared' };
  } },
  { id: 'BRW-04', name: 'notice replacement dismissal and opt-out', run: async ({ page }) => {
    await page.click('#show-notice');
    await page.waitForFunction(() => document.querySelector('#notice-root .notice-message')?.textContent.length > 0);
    await page.click('#show-notice');
    await page.waitForFunction(() => document.querySelector('#notice-root .notice-message')?.textContent.length > 0);
    assert.equal(await page.locator('#notice-root .notice').count(), 1);
    await page.locator('#notice-root button').click(); assert.equal(await page.locator('#notice-root .notice').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'show-notice');
    await page.uncheck('#success-enabled'); await page.click('#show-notice');
    assert.equal(await page.locator('#notice-root .notice').count(), 0);
    return { replacementCount: 1, dismissed: true };
  } },
  { id: 'BRW-05', name: 'dialog keyboard loop Escape and focus return', run: async ({ page }) => {
    await page.click('#open-modal'); assert.equal(await page.locator('#modal').evaluate((el) => el.open), true);
    await page.locator('#close-modal').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'modal-value');
    await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'close-modal');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#modal').evaluate((el) => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-modal');
    return { loop: true, restored: true };
  } },
  { id: 'BRW-06', name: 'media changes and scope isolation', run: async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true);
    await page.locator('body').evaluate((el) => el.classList.remove('obsidian-harness'));
    assert.equal(await page.locator('body').evaluate((el) => getComputedStyle(el).getPropertyValue('--background-primary').trim()), '');
    return { mediaExercised: true, rootScoped: true };
  } },
  { id: 'BRW-07', name: 'negative control detects missing host stylesheet', run: async ({ page }) => {
    await page.locator('link[href*="styles/obsidian.css"], style[data-host-fixture]').evaluateAll((els) => els.forEach((el) => el.remove()));
    const value = await page.locator('body').evaluate((el) => getComputedStyle(el).getPropertyValue('--background-primary').trim());
    // The same positive invariant MUST fail after removing its actual style input.
    assert.throws(() => assert.ok(value, 'host token required'));
    return { missingStylesDetected: true };
  } },
  { id: 'BRW-08', name: 'unexpected console fault reaches independent test observer', run: async ({ page, ledger }) => {
    const observed = page.waitForEvent('console', { predicate: (message) => message.type() === 'error' });
    await page.evaluate(() => console.error('Controlled specimen failure'));
    await observed;
    assert.throws(() => ledger.assertExpected(), /MISMATCH/);
    ledger.assertExpected([{ code: 'CONSOLE_ERROR', scope: 'specimen', count: 1 }]);
    return { expectedFault: 'CONSOLE_ERROR', count: 1 };
  }, expected: [{ code: 'CONSOLE_ERROR', scope: 'specimen', count: 1 }] },
];
