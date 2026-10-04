/** Accessibility audit of generated stories in both Obsidian themes. Pure helpers plus one Playwright driver; no network. */
import { AxeBuilder } from '@axe-core/playwright';
export const themes = ['light', 'dark'];
const blockingImpacts = ['serious', 'critical'];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const maxStories = 60;
/** Stable, bounded list of story ids; the order never depends on index.json key order. */
export function storyIds(index) {
  return Object.values(index.entries ?? {}).filter(entry => entry.type === 'story').map(entry => entry.id).sort().slice(0, maxStories);
}
/** Keep rule, impact and selectors only: no DOM snippets or text content enter evidence. */
export function summarizeViolations(violations) {
  return violations.map(item => ({ id: item.id, impact: item.impact ?? 'unknown', help: item.help, nodes: item.nodes.map(node => node.target.join(' ')).slice(0, 5) }));
}
export const blocking = summary => summary.filter(item => blockingImpacts.includes(item.impact));
async function settle(page) {
  await page.locator('[data-story-host] > div > *, [data-story-message]').first().waitFor();
  return await page.locator('[data-story-message]').count() > 0;
}
/** Visit each story in each theme, check the body theme classes the Storybook theme decorator owns, then run axe on the story host. */
export async function auditStories({ page, base, ids }) {
  const result = { rules: tags, blockingImpacts, themes: {}, placeholders: [] };
  for (const theme of themes) {
    const other = themes.find(name => name !== theme), visited = [], violations = {};
    for (const id of ids) {
      await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
      await page.waitForFunction(([mine, theirs]) => document.body.classList.contains('theme-' + mine) && !document.body.classList.contains('theme-' + theirs), [theme, other]);
      if (await settle(page)) { result.placeholders.push(`${theme}:${id}`); continue; }
      const found = summarizeViolations((await new AxeBuilder({ page }).include('[data-story-host]').withTags(tags).analyze()).violations);
      visited.push(id); if (found.length) violations[id] = found;
    }
    result.themes[theme] = { visited, violations };
  }
  return result;
}
export function auditFailures(audit) {
  return Object.entries(audit.themes).flatMap(([theme, data]) => Object.entries(data.violations)
    .flatMap(([id, found]) => blocking(found).map(item => `${theme}:${id}:${item.id}(${item.impact})`)));
}
