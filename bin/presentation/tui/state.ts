import { help } from './help.ts';
import { clean, graphemes } from './text.ts';
import { documentLines } from './documents.ts';
import type { Key, Reply, Request, State } from './contracts.ts';
export function initialState(request: Request): State {
  const value = request.kind === 'text' ? request.initial : '';
  const index = request.kind === 'select' ? Math.max(0, request.items.findIndex(item => item.id === request.initial)) : 0;
  return { request, value, cursor: graphemes(value).length, query: '', searching: false,
    index, checked: [], section: 0, offset: 0, help: false, error: '' };
}
export function matches(state: State) {
  if (state.request.kind !== 'select' && state.request.kind !== 'multi') return [];
  const query = state.query.toLocaleLowerCase('en');
  return state.request.items.filter(item => `${item.label} ${item.id}`.toLocaleLowerCase('en').includes(query));
}
function answer(state: State): Reply | undefined {
  const request = state.request;
  if (request.kind === 'review') return { kind: 'answer', value: '' };
  if (request.kind === 'text') {
    const value = state.value.trim();
    state.error = request.validate?.(value) ?? '';
    return state.error ? undefined : { kind: 'answer', value };
  }
  if (request.kind === 'multi') {
    if (!state.checked.length) { state.error = 'Select at least one item. Space toggles; Enter adds the selection.'; return; }
    return { kind: 'answer', value: request.items.filter(item => state.checked.includes(item.id)).map(item => item.id) };
  }
  const selected = matches(state)[state.index];
  if (selected) return { kind: 'answer', value: selected.id };
  state.error = 'No matches. Escape clears the search.';
}
export function paste(state: State, value: string): void {
  if (state.request.kind !== 'text') { state.error = 'Paste is accepted only in a text field, never as a menu command.'; return; }
  const text = clean(value), insertion = state.request.multiline ? text : text.replace(/\n/g, ' ');
  if (state.value.length + insertion.length > 10000) { state.error = 'Input exceeds 10,000 characters. Nothing was pasted.'; return; }
  const parts = graphemes(state.value);
  parts.splice(state.cursor, 0, insertion); state.value = parts.join('');
  state.cursor += graphemes(insertion).length; state.error = '';
}
function editText(state: State, key: Key, text: string): Reply | undefined {
  const parts = graphemes(state.value);
  const moves: Record<string, () => void> = {
    left: () => { state.cursor = Math.max(0, state.cursor - 1); },
    right: () => { state.cursor = Math.min(parts.length, state.cursor + 1); },
    home: () => { state.cursor = 0; }, end: () => { state.cursor = parts.length; },
    backspace: () => { if (state.cursor) parts.splice(--state.cursor, 1); state.value = parts.join(''); },
    delete: () => { parts.splice(state.cursor, 1); state.value = parts.join(''); },
  };
  const name = key.name ?? '';
  if (Object.hasOwn(moves, name)) { moves[name]!(); return; }
  if (key.ctrl) {
    if (name === 'u') { state.value = ''; state.cursor = 0; }
    return;
  }
  if (name === 'return') return answer(state);
  if (name === 'enter') return newline(state);
  else if (!key.meta && text) paste(state, text);
}
function newline(state: State): Reply | undefined {
  if (state.request.kind === 'text' && state.request.multiline) { paste(state, '\n'); return; }
  return answer(state);
}
function moveIndex(state: State, key: Key, height: number, max: number): boolean {
  const jumps: Record<string, number> = { up: -1, down: 1, pageup: -height, pagedown: height, home: -max, end: max };
  const name = key.name ?? '';
  if (!Object.hasOwn(jumps, name)) return false;
  state.index = Math.max(0, Math.min(Math.max(0, max - 1), state.index + jumps[name]!)); return true;
}
function selectKey(state: State, key: Key, text: string, height: number): Reply | undefined {
  if (moveIndex(state, key, height, matches(state).length)) return;
  if (key.name === 'return' || key.name === 'enter') return answer(state);
  if (toggleSelection(state, text)) return;
  filterKey(state, key, text);
}
function toggleSelection(state: State, text: string): boolean {
  const selected = matches(state)[state.index];
  if (text !== ' ' || state.request.kind !== 'multi' || state.searching || !selected) return false;
  state.checked = state.checked.includes(selected.id) ? state.checked.filter(id => id !== selected.id) : [...state.checked, selected.id];
  state.error = ''; return true;
}
function filterKey(state: State, key: Key, text: string): void {
  if (text === '/' && !state.searching) { state.searching = true; return; }
  if (key.name === 'tab') { state.searching = !state.searching; return; }
  if (key.ctrl || key.meta) return;
  if (key.name === 'backspace') state.query = graphemes(state.query).slice(0, -1).join('');
  else if (text) state.query = (state.query + clean(text)).slice(0, 120);
  state.index = 0; state.searching = true;
}
function reviewKey(state: State, key: Key, height: number, width: number): Reply | undefined {
  if (state.request.kind !== 'review') return;
  if (key.name === 'return' || key.name === 'enter') return answer(state);
  if (key.name === 'tab') {
    state.section = (state.section + (key.shift ? -1 : 1) + state.request.sections.length) % state.request.sections.length;
    state.offset = 0; return;
  }
  const count = documentLines(state.request, state.section, width).length;
  const temp = { ...state, index: state.offset };
  moveIndex(temp, key, height, Math.max(1, count - height + 1)); state.offset = temp.index;
}
/** Keyboard transitions are deterministic and contain no filesystem or process side effects. */
export function step(state: State, key: Key, text = '', height = 8, width = 70): Reply | undefined {
  if (key.ctrl && key.name === 'c') return { kind: 'cancel' };
  if (key.name === 'f1') { state.help = !state.help; state.offset = 0; return; }
  if (state.help) { helpKey(state, key, height); return; }
  if (key.name === 'escape') return backKey(state);
  if (state.request.kind === 'text') return editText(state, key, text);
  if (state.request.kind === 'review') return reviewKey(state, key, height, width);
  return selectKey(state, key, text, height);
}

function helpKey(state: State, key: Key, height: number): void {
  const scroll = { ...state, index: state.offset };
  moveIndex(scroll, key, height, Math.max(1, help.length - height + 1)); state.offset = scroll.index;
  if (key.name === 'escape') { state.help = false; state.offset = 0; }
}
function backKey(state: State): Reply | undefined {
  if (state.searching || state.query) { state.searching = false; state.query = ''; state.index = 0; return; }
  return { kind: 'back' };
}
