import type { RichPrompts } from './engine/contracts.ts';
import { requireSketch, SketchError, hasControls, title } from '#shared/contracts/sketch-errors.ts';
import { parseConfirmation } from '#shared/platform/confirmation.ts';
export interface Prompts { rich?: RichPrompts; ask: (question: string) => Promise<string>; write: (text: string) => void }
export interface Choice { id: string; label: string }
export class Back extends Error { constructor() { super('Back'); this.name = 'Back'; } }
/** Strip terminal control sequences from all imported labels and diagnostics. */
const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-?]*[ -/]*[@-~]', 'g');
export function safe(value: string): string {
  return [...value.replace(ansi, '')].filter(character => !hasControls(character, true)).join('');
}
export async function input(ui: Prompts, label: string, fallback = ''): Promise<string> {
  if (ui.rich) return ui.rich.text({ title: label, initial: fallback });
  const answer = (await ui.ask(`${safe(label)}${fallback ? ` [${safe(fallback)}]` : ''}: `)).trim();
  if (answer === ':back') throw new Back();
  return answer || fallback;
}
export async function choose(ui: Prompts, label: string, choices: Choice[], fallback = ''): Promise<string> {
  if (ui.rich) return ui.rich.select(label, choices, fallback);
  ui.write(`\n${safe(label)}\n` + choices.map((choice, index) => `  ${index + 1}. ${safe(choice.label)}`).join('\n') + '\n');
  while (true) {
    const raw = await input(ui, 'Choose number or ID', fallback);
    const item = choices.find(choice => choice.id === raw) ?? choices[Number(raw) - 1];
    if (item) return item.id;
    ui.write('Choose one of the displayed options, or enter :back.\n');
  }
}
export async function confirm(ui: Prompts, label: string): Promise<boolean> {
  if (ui.rich) return await ui.rich.select(label, [{ id: 'no', label: 'No — go back without applying' }, { id: 'yes', label: 'Yes — proceed' }], 'no') === 'yes';
  while (true) {
    const decision = parseConfirmation(await input(ui, label + ' (y/N)'));
    if (decision !== null) return decision;
    ui.write('Enter yes or no.\n');
  }
}
export async function selectMany(ui: Prompts, label: string, choices: Choice[], selected: string[] = []): Promise<string[]> {
  requireSketch(choices.length > 0, 'MAKER_EMPTY_LIBRARY', 'Create a component first.');
  if (ui.rich) return ui.rich.multi(label, choices, selected);
  ui.write(`\n${safe(label)}\n` + choices.map((item, index) => `  ${index + 1}. ${safe(item.label)}`).join('\n') + '\n');
  const initial = choices.map((choice, index) => selected.includes(choice.id) ? String(index + 1) : '').filter(Boolean).join(',');
  const raw = await input(ui, 'Numbers separated by commas (:back cancels)', initial);
  const indices = raw.split(',').map(value => Number(value.trim()) - 1);
  requireSketch(indices.length <= 60 && indices.every(index => Number.isInteger(index) && choices[index]), 'MAKER_SELECTION', 'Choose valid component numbers.');
  return [...new Set(indices)].map(index => choices[index]!.id);
}
export function reportError(ui: Prompts, error: unknown): void {
  if (error instanceof Back) return;
  if (error instanceof Error && ('code' in error && error.code === 'CANCELLED')) throw error;
  ui.write(`\n${error instanceof SketchError ? error.code + ': ' : ''}${safe(error instanceof Error ? error.message : 'Operation failed.')}\n`);
}

/** Validate in-place in the TUI; the domain still validates every machine request. */
export async function titleInput(ui: Prompts, label: string, initial = '', limit = 120): Promise<string> {
  if (!ui.rich) return input(ui, label, initial);
  return ui.rich.text({ title: label, initial, help: 'Only this title is required. Names and IDs are generated.', validate(value) {
    try { title(value, limit); return undefined; }
    catch (error) { return error instanceof Error ? error.message : 'Enter a title.'; }
  } });
}
export async function bulkTitles(ui: Prompts): Promise<string[]> {
  if (!ui.rich) return (await input(ui, 'Component titles separated by semicolons')).split(';').map(value => value.trim());
  const raw = await ui.rich.text({ title: 'Bulk-create components', initial: '', multiline: true,
    help: 'One component per line. Paste a list, or press Ctrl+J for another line. Enter adds all.', validate(value) {
      try {
        const items = value.split('\n').filter(item => item.trim());
        requireSketch(items.length > 0 && items.length <= 60, 'SKETCH_BATCH_LIMIT', 'Enter 1–60 component titles.');
        for (const item of items) title(item);
        return undefined;
      } catch (error) { return error instanceof Error ? error.message : 'Check the component titles.'; }
    } });
  return raw.split('\n').map(value => value.trim()).filter(Boolean);
}
