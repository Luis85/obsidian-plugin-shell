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
  { id: 'BRW-06', name: 'media changes and plugin/host scope isolation', run: async ({ page, host }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true);
    await page.locator('body').evaluate((el) => el.classList.remove('obsidian-harness', 'plugin-shell'));
    const value = await page.locator('body').evaluate((el) => getComputedStyle(el).getPropertyValue('--background-primary').trim());
    if (host === 'simulated') assert.equal(value, ''); else assert.ok(value);
    assert.equal(await page.locator('body').evaluate((el) => getComputedStyle(el).getPropertyValue('--plugin-shell-surface').trim()), '');
    return { mediaExercised: true, host, pluginAliasesScoped: true };
  } },
  { id: 'BRW-07', name: 'negative control detects missing host stylesheet', run: async ({ page }) => {
    await page.locator('link[href*="styles/obsidian.css"], link[href*="styles/simulated.css"], style[data-host-fixture]').evaluateAll((els) => els.forEach((el) => el.remove()));
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
  { id: 'BRW-09', name: 'host default dimensions and aliases resolve', run: async ({ page, host }) => {
    const got = await page.evaluate(() => {
      const body = getComputedStyle(document.body), sample = getComputedStyle(document.querySelector('#token-surface'));
      const reference = document.createElement('div'); reference.style.backgroundColor='var(--background-primary)'; document.body.append(reference);
      const hostBackground = getComputedStyle(reference).backgroundColor; reference.remove();
      return { input: body.getPropertyValue('--input-height').trim(), radius: body.getPropertyValue('--radius-m').trim(),
        background: sample.backgroundColor, hostBackground,
        padding:sample.paddingTop, spacing:body.getPropertyValue('--size-4-4').trim() };
    });
    if (host === 'extracted') assert.equal(got.input,'30px');
    assert.equal(got.radius,'8px'); assert.equal(got.padding,got.spacing); assert.equal(got.background,got.hostBackground);
    return got;
  } },
  { id: 'BRW-10', name: 'theme overrides flow through aliases without changing host defaults', run: async ({ page }) => {
    await page.locator('body').evaluate((el) => { el.style.setProperty('--text-normal','rgb(31, 72, 113)'); el.style.setProperty('--interactive-accent','rgb(53, 107, 61)'); el.style.setProperty('--size-4-4','23px'); });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#token-surface')).color === 'rgb(31, 72, 113)' && getComputedStyle(document.querySelector('#token-accent')).backgroundColor === 'rgb(53, 107, 61)' && getComputedStyle(document.querySelector('#token-surface')).paddingTop === '23px');
    const value = await page.evaluate(() => ({ text:getComputedStyle(document.querySelector('#token-surface')).color,
      accent:getComputedStyle(document.querySelector('#token-accent')).backgroundColor, padding:getComputedStyle(document.querySelector('#token-surface')).paddingTop }));
    assert.deepEqual(value,{ text:'rgb(31, 72, 113)',accent:'rgb(53, 107, 61)',padding:'23px' }); return value;
  } },
  { id: 'BRW-11', name: 'negative control detects missing plugin aliases while host remains', run: async ({ page }) => {
    await page.locator('link[href*="src/styles/index.css"], style[data-plugin-tokens]').evaluateAll((els) => els.forEach((el) => el.remove()));
    const values = await page.locator('body').evaluate((el) => ({ host:getComputedStyle(el).getPropertyValue('--background-primary').trim(), alias:getComputedStyle(el).getPropertyValue('--plugin-shell-surface').trim() }));
    assert.ok(values.host); assert.equal(values.alias,''); assert.throws(() => assert.ok(values.alias)); return { missingAliasDetected:true };
  } },
  { id: 'BRW-12', name: 'host style source and no implicit fallback are observable', run: async ({ page, host }) => {
    assert.equal(await page.locator('body').getAttribute('data-host-style'),host);
    const hasExtractedDeclaration = await page.locator('body').evaluate((el) => getComputedStyle(el).getPropertyValue('--bases-table-row-height').trim());
    if (host === 'extracted') assert.equal(hasExtractedDeclaration,'30px'); else assert.equal(hasExtractedDeclaration,'');
    return { host, extractedMarkerPresent: Boolean(hasExtractedDeclaration) };
  } },
];
