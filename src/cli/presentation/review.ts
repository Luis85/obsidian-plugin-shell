import { applyPrepared, type Prepared } from '../adapters/storage.ts';
import { confirm, type Prompts } from '#tui/prompts.ts';
/** Human approval is always after review, never implied by scrolling or Enter in a pager. */
export async function review(ui: Prompts, value: Prepared, signal?: AbortSignal): Promise<boolean> {
  const changed = value.plan.changes.filter(item => item.status !== 'unchanged');
  const header = `Review ${changed.length} file changes\nPlan hash: ${value.planHash}`;
  const manifest = value.plan.changes.map(item => `${item.status.padEnd(10)} ${item.path}`).join('\n');
  if (ui.rich) {
    const sections = [{ title: 'File changes', body: `${header}\n\n${manifest}` }];
    if (typeof value.data.prompt === 'string') sections.push({ title: 'Execution prompt', body: value.data.prompt });
    if (value.data.document) sections.push({ title: 'Companion JSON', body: JSON.stringify(value.data.document, null, 2) });
    await ui.rich.review('Review before writing', sections);
  } else ui.write(`\n${header}\n${manifest}\n`);
  if (!await confirm(ui, 'Apply this reviewed plan?')) return false;
  ui.rich?.busy('Applying the reviewed plan. Ctrl+C cancels safely.');
  const result = await applyPrepared(value, value.planHash, signal);
  ui.write(result.status === 'unchanged' ? 'No changes needed. Files already match.\n' : 'Files saved. Dependencies and builds were not run.\n');
  return true;
}
