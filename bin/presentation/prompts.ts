import { requireSketch, SketchError, hasControls } from '../domain/errors.ts';
export interface Prompts { ask: (question: string) => Promise<string>; write: (text: string) => void }
export interface Choice { id: string; label: string }
export class Back extends Error { constructor() { super('Back'); this.name = 'Back'; } }
/** Strip terminal control sequences from all imported labels and diagnostics. */
const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-?]*[ -/]*[@-~]', 'g');
export function safe(value: string): string {
  return [...value.replace(ansi, '')].filter(character => !hasControls(character, true)).join('');
}
export async function input(ui: Prompts, label: string, fallback = ''): Promise<string> {
  const answer = (await ui.ask(`${safe(label)}${fallback ? ` [${safe(fallback)}]` : ''}: `)).trim();
  if (answer === ':back') throw new Back();
  return answer || fallback;
}
export async function choose(ui: Prompts, label: string, choices: Choice[], fallback = ''): Promise<string> {
  ui.write(`\n${safe(label)}\n` + choices.map((choice, index) => `  ${index + 1}. ${safe(choice.label)}`).join('\n') + '\n');
  while (true) {
    const raw = await input(ui, 'Choose number or ID', fallback);
    const item = choices.find(choice => choice.id === raw) ?? choices[Number(raw) - 1];
    if (item) return item.id;
    ui.write('Choose one of the displayed options, or enter :back.\n');
  }
}
export async function confirm(ui: Prompts, label: string): Promise<boolean> {
  while (true) {
    const raw = (await input(ui, label + ' (y/N)')).toLowerCase();
    if (!raw || raw === 'n' || raw === 'no') return false;
    if (raw === 'y' || raw === 'yes') return true;
    ui.write('Enter yes or no.\n');
  }
}
export async function selectMany(ui: Prompts, label: string, choices: Choice[]): Promise<string[]> {
  requireSketch(choices.length > 0, 'MAKER_EMPTY_LIBRARY', 'Create a component first.');
  ui.write(`\n${safe(label)}\n` + choices.map((item, index) => `  ${index + 1}. ${safe(item.label)}`).join('\n') + '\n');
  const raw = await input(ui, 'Numbers separated by commas (:back cancels)');
  const indices = raw.split(',').map(value => Number(value.trim()) - 1);
  requireSketch(indices.length <= 60 && indices.every(index => Number.isInteger(index) && choices[index]), 'MAKER_SELECTION', 'Choose valid component numbers.');
  return [...new Set(indices)].map(index => choices[index]!.id);
}
export function reportError(ui: Prompts, error: unknown): void {
  if (error instanceof Back) return;
  if (error instanceof Error && ('code' in error && error.code === 'CANCELLED')) throw error;
  ui.write(`\n${error instanceof SketchError ? error.code + ': ' : ''}${safe(error instanceof Error ? error.message : 'Operation failed.')}\n`);
}
