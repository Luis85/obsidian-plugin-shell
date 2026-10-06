/** Markdown building blocks. Every report-derived value goes through code() or plain() so a report cannot inject structure. */
const whitespace = /\s+/g;
export const code = (value: string | number | null | undefined): string => '`' + String(value ?? '').replace(/`/g, "'").replace(whitespace, ' ').trim() + '`';
export const plain = (value: string | number | null | undefined): string =>
  String(value ?? '').replace(whitespace, ' ').trim().replace(/[\\`*_[\]<>#~]/g, match => '\\' + match);
export const bullets = (items: readonly string[]): string[] => items.map(item => `- ${item}`);
export const numbered = (items: readonly string[]): string[] => items.map((item, index) => `${index + 1}. ${item}`);
/** A fenced block; the fence is longer than any backtick run inside the body. */
export function fence(body: string, language = 'sh'): string[] {
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map(run => run.length));
  const marker = '`'.repeat(longest + 1);
  return [marker + language, ...body.split('\n'), marker];
}
export function table(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string[] {
  const line = (cells: readonly string[]) => `| ${cells.map(cell => cell.replace(/\|/g, '\\|')).join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)];
}
export const list = (values: readonly string[], none = 'none'): string => values.length ? values.map(code).join(', ') : none;
/** Lines joined with a blank line between blocks; the document ends with one newline. */
export const document = (blocks: ReadonlyArray<readonly string[]>): string => blocks.filter(block => block.length).map(block => block.join('\n')).join('\n\n') + '\n';
