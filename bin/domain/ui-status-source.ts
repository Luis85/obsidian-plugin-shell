/** Static, side-effect-free scans of generated TypeScript source text. Nothing here executes project code. */
export interface StubFacts { throwsNotImplemented: boolean }
export interface AcceptanceTestFacts { todo: number; skipped: number; active: number }
export interface SpecFacts { path: string; titles: string[]; text: string }
export interface SpecFile { path: string; text: string }

type Skipper = (text: string, index: number) => number;
const quoted = (quote: string): Skipper => (text, index) => {
  let cursor = index + 1;
  while (cursor < text.length && text[cursor] !== quote) cursor += text[cursor] === '\\' ? 2 : 1;
  return cursor + 1;
};
const lineComment: Skipper = (text, index) => {
  const end = text.indexOf('\n', index);
  return end < 0 ? text.length : end;
};
const blockComment: Skipper = (text, index) => {
  const end = text.indexOf('*/', index + 2);
  return end < 0 ? text.length : end + 2;
};
function skipperAt(text: string, index: number): { skip: Skipper; keep: boolean } | null {
  const char = text[index]!, next = text[index + 1];
  if (char === '"' || char === "'" || char === '`') return { skip: quoted(char), keep: true };
  if (char === '/' && next === '/') return { skip: lineComment, keep: false };
  if (char === '/' && next === '*') return { skip: blockComment, keep: false };
  return null;
}
/** Removes comments while keeping string contents, so markers inside strings are still code. */
function stripComments(text: string): string {
  let output = '', index = 0;
  while (index < text.length) {
    const found = skipperAt(text, index);
    if (!found) { output += text[index]!; index += 1; continue; }
    const end = found.skip(text, index);
    output += found.keep ? text.slice(index, end) : ' ';
    index = end;
  }
  return output;
}
const count = (text: string, pattern: RegExp): number => [...text.matchAll(pattern)].length;
const CALLER = String.raw`(?<![\w.$])(?:it|test)`;

/** True while the generated placeholder still throws NotImplementedError. */
export function scanStub(text: string): StubFacts {
  return { throwsNotImplemented: /\bthrow\s+new\s+NotImplementedError\b/.test(stripComments(text)) };
}
/** Counts vitest/playwright-style cases: pending (todo), skipped, and runnable. */
export function scanAcceptanceTest(text: string): AcceptanceTestFacts {
  const code = stripComments(text);
  const runnable = new RegExp(`${CALLER}(?:\\.(?:only|concurrent|sequential|fails))?\\s*\\(`, 'g');
  return {
    todo: count(code, new RegExp(`${CALLER}\\.todo\\s*\\(`, 'g')),
    skipped: count(code, new RegExp(`${CALLER}\\.(?:skip|fixme)\\s*\\(`, 'g')),
    active: count(code, runnable) + count(code, new RegExp(`${CALLER}\\.each\\b`, 'g')),
  };
}
const TITLE_CALL = new RegExp(`${CALLER}(?:\\.(?:only|skip|fixme|fail|slow|describe))*\\s*\\(\\s*(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, 'g');
/** Literal case titles only; interpolated template titles cannot be matched statically and are omitted. */
export function scanSpec(file: SpecFile): SpecFacts {
  const code = stripComments(file.text);
  const titles = [...code.matchAll(TITLE_CALL)].map(match => match[2]!).filter(title => !title.includes('${'));
  return { path: file.path, titles, text: code };
}
const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-identifier mention: `vi-1` never matches `vi-14` or `vi-1-b`. */
export function mentions(text: string, id: string): boolean {
  return id.length > 0 && new RegExp(`(?<![\\w-])${escape(id)}(?![\\w-])`).test(text);
}
