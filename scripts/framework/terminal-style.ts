/** Terminal presentation primitives. Colour and Unicode markers only on a TTY without NO_COLOR (https://no-color.org). */
import { commands } from './catalog.ts';
export interface Style { color: boolean; unicode: boolean }
export type Mark = 'pass' | 'fail' | 'warn' | 'skip' | 'info';
export function terminalStyle(stream: { isTTY?: boolean }, env: Record<string, string | undefined> = process.env): Style {
  const rich = Boolean(stream.isTTY) && env.TERM !== 'dumb' && !env.NO_COLOR;
  return { color: rich, unicode: rich };
}
const glyphs: Record<Mark, [string, string, string]> = {
  pass: ['✓', '[ok]  ', '32'], fail: ['✗', '[FAIL]', '31'], warn: ['!', '[warn]', '33'], skip: ['-', '[skip]', '90'], info: ['•', '[info]', '36'],
};
export function marker(style: Style, mark: Mark): string {
  const [unicode, ascii, colour] = glyphs[mark];
  const text = style.unicode ? unicode : ascii;
  return style.color ? `\u001b[${colour}m${text}\u001b[0m` : text;
}
export function bold(style: Style, text: string): string {
  return style.color ? `\u001b[1m${text}\u001b[0m` : text;
}
/** Aligned `  key  value` rows; empty values are dropped. */
export function rows(entries: ReadonlyArray<[string, string | number | null | undefined]>, indent = '  '): string {
  const shown = entries.filter(([, value]) => value !== undefined && value !== null && value !== '');
  const width = Math.max(0, ...shown.map(([key]) => key.length));
  return shown.map(([key, value]) => `${indent}${key.padEnd(width)}  ${value}\n`).join('');
}
export function duration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
/** Turns a catalog-relative hint such as `install --yes` into a runnable command line. */
export function runnable(next: string): string {
  const words = next.trim().split(/\s+/);
  const known = commands.some(entry => entry.id.split(' ').every((word, index) => words[index] === word));
  return known ? `node shell.mjs ${next.trim()}` : next;
}
export function nextLine(style: Style, next: string | undefined | null): string {
  return next ? `${bold(style, 'Next:')} ${runnable(next)}\n` : '';
}
