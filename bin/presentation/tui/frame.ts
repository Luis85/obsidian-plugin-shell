import { help } from './help.ts';
import { clean, clip, fit, graphemes, wrap } from './text.ts';
import { matches } from './state.ts';
import type { Context, State } from './contracts.ts';
export interface Size { width: number; height: number; contentWidth: number; bodyHeight: number; sidebar: number }
export function dimensions(columns = 80, rows = 24): Size {
  const width = Math.max(1, Math.min(240, columns - 1)), height = Math.max(1, Math.min(100, rows));
  const sidebar = width >= 100 ? 27 : 0;
  return { width, height, sidebar, contentWidth: Math.max(2, width - sidebar - 4), bodyHeight: Math.max(1, height - 11) };
}
function selectLines(state: State, size: Size): string[] {
  const items = matches(state), start = Math.max(0, state.index - size.bodyHeight + 2);
  const result = items.slice(start, start + size.bodyHeight - 1).map((item, offset) => {
    const marker = state.index === start + offset ? '>' : ' ';
    const check = state.request.kind === 'multi' ? (state.checked.includes(item.id) ? '[x] ' : '[ ] ') : '';
    return `${marker} ${check}${item.label}`;
  });
  if (!items.length) result.push('No matches. Escape clears the filter.');
  result.push(`${items.length ? state.index + 1 : 0}/${items.length} shown${state.request.kind === 'multi' ? ` | ${state.checked.length} selected` : ''}`);
  return result;
}
function textLines(state: State, size: Size): string[] {
  const parts = graphemes(clean(state.value));
  const before = parts.slice(0, state.cursor).join('');
  const lines = wrap('> ' + before + '|' + parts.slice(state.cursor).join(''), size.contentWidth);
  const cursorRow = wrap('> ' + before, size.contentWidth).length - 1;
  const first = Math.max(0, cursorRow - size.bodyHeight + 2);
  return [...lines.slice(first, first + size.bodyHeight - 1), `${state.value.length}/10000 characters`];
}
function reviewLines(state: State, size: Size): string[] {
  if (state.request.kind !== 'review') return [];
  const section = state.request.sections[state.section];
  const lines = wrap(section?.body ?? '', size.contentWidth);
  const max = Math.max(0, lines.length - size.bodyHeight + 1);
  state.offset = Math.min(state.offset, max);
  return [...lines.slice(state.offset, state.offset + size.bodyHeight - 1), `Lines ${state.offset + 1}-${Math.min(lines.length, state.offset + size.bodyHeight - 1)} / ${lines.length} | Tab: next document`];
}
function body(state: State, size: Size): string[] {
  if (state.help) return help.slice(state.offset, state.offset + size.bodyHeight - 1).concat('Up/Down Scroll | F1 or Escape closes help.');
  if (state.request.kind === 'text') return textLines(state, size);
  if (state.request.kind === 'review') return reviewLines(state, size);
  return selectLines(state, size);
}
function subheading(state: State | null): string {
  if (!state) return 'Working. Ctrl+C cancels; no action is accepted while busy.';
  const request = state.request;
  if (request.kind === 'text') return request.help ?? 'Enter a value. Only titles are required to create things.';
  if (request.kind === 'review') return `${state.section + 1}/${request.sections.length} | ${request.sections[state.section]?.title ?? ''}`;
  return `${state.searching ? 'SEARCH' : 'Filter'}: ${state.query || '(type / to search)'}${request.kind === 'multi' ? ' | Tab switches search / selection' : ''}`;
}
function footer(state: State | null): string {
  if (!state) return 'Ctrl+C Cancel | No files are changed without approval';
  if (state.help) return 'F1 Close help | Escape Back | Ctrl+C Cancel';
  if (state.request.kind === 'text') return 'Enter Continue | Ctrl+J New line | Ctrl+U Clear | Esc Back | F1 Help';
  if (state.request.kind === 'review') return 'Up/Down Scroll | PgUp/PgDn Page | Tab Document | Enter Continue | Esc Back';
  return 'Up/Down Move | Space Toggle | / Search | Enter Select | Esc Back | F1 Help';
}
/** One bounded frame, with terminal-default colors and a text marker independent of color. */
export function frame(state: State | null, context: Context, notice: string, size: Size, color: boolean): string[] {
  if (size.width < 59 || size.height < 18) {
    return ['SHELL MAKER', 'Resize to at least 60 columns x 18 rows.', 'Draft retained. Ctrl+C cancels safely.'].slice(0, size.height).map(line => clip(line, size.width));
  }
  const status = context.dirty ? 'UNSAVED DRAFT' : 'SAVED / NO PENDING EDITS';
  const lines = [` SHELL / MAKER    ${context.title}`, ` ${context.location} | ${status}`, '-'.repeat(size.width),
    ` ${state?.request.title ?? 'Preparing your workspace'}`, ` ${subheading(state)}`, ''];
  const content = state ? body(state, size) : ['Preparing the next step...'];
  const side = ['PROJECT CONTEXT', '', ...context.details.flatMap(line => wrap(line, size.sidebar - 3))];
  for (let row = 0; row < size.bodyHeight; row++) {
    const prefix = size.sidebar ? fit(side[row] ?? '', size.sidebar - 2) + '| ' : '';
    lines.push(prefix + ' ' + clip(content[row] ?? '', size.contentWidth));
  }
  lines.push('-'.repeat(size.width), ' ' + (state?.error || notice || 'Make first. Save JSON, then generate. Nothing is published.'), ' ' + footer(state));
  while (lines.length < size.height) lines.push('');
  return lines.slice(0, size.height).map((line, index) => {
    const safe = clip(line, size.width);
    return color && (index === 0 || index === 3) ? `\x1b[36m${safe}\x1b[0m` : safe;
  });
}
