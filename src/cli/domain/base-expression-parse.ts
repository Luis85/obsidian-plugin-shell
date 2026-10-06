import { requireSketch } from './errors.ts';

/**
 * Parser for the documented subset of the Obsidian Bases formula language used by `.base` filters and formulas.
 * Framework-free and data-only: it builds a small syntax tree and never evaluates anything.
 */
export type BaseNode =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'name'; name: string }
  | { kind: 'member'; target: BaseNode; name: string }
  | { kind: 'index'; target: BaseNode; index: BaseNode }
  | { kind: 'call'; callee: BaseNode; args: BaseNode[] }
  | { kind: 'list'; items: BaseNode[] }
  | { kind: 'unary'; operator: '!' | '-'; operand: BaseNode }
  | { kind: 'binary'; operator: string; left: BaseNode; right: BaseNode };
interface Token { type: 'number' | 'string' | 'name' | 'punct' | 'end'; value: string; at: number }

export const EXPRESSION_LIMITS = Object.freeze({ characters: 2000, depth: 40, tokens: 400 });
const PUNCTUATION = ['==', '!=', '<=', '>=', '&&', '||', '(', ')', '[', ']', ',', '.', '!', '<', '>', '+', '-', '*', '/', '%'];
/** Binary operators by precedence, loosest first. */
const PRECEDENCE: readonly (readonly string[])[] = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];
const KEYWORDS: Record<string, BaseNode> = { true: { kind: 'literal', value: true }, false: { kind: 'literal', value: false }, null: { kind: 'literal', value: null } };

function fail(source: string, at: number, reason: string): never {
  requireSketch(false, 'BASE_EXPRESSION', `${reason} at character ${at + 1} of "${source}".`);
}
function readString(source: string, start: number): [string, number] {
  const quote = source[start]!; let value = '', index = start + 1;
  while (index < source.length && source[index] !== quote) {
    if (source[index] === '\\') { index++; requireSketch(index < source.length, 'BASE_EXPRESSION', `Unterminated escape in "${source}".`); }
    value += source[index]; index++;
  }
  if (index >= source.length) fail(source, start, 'Unterminated string');
  return [value, index + 1];
}
function readToken(source: string, index: number): [Token, number] {
  const rest = source.slice(index);
  const number = /^\d+(?:\.\d+)?/.exec(rest);
  if (number) return [{ type: 'number', value: number[0], at: index }, index + number[0].length];
  const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
  if (name) return [{ type: 'name', value: name[0], at: index }, index + name[0].length];
  if (rest[0] === '"' || rest[0] === "'") { const [value, next] = readString(source, index); return [{ type: 'string', value, at: index }, next]; }
  const punct = PUNCTUATION.find(item => rest.startsWith(item));
  if (!punct) fail(source, index, `Unsupported character "${rest[0]}"`);
  return [{ type: 'punct', value: punct, at: index }, index + punct.length];
}
export function tokenize(source: string): Token[] {
  requireSketch(source.length <= EXPRESSION_LIMITS.characters, 'BASE_LIMIT', `Expressions are limited to ${EXPRESSION_LIMITS.characters} characters.`);
  const tokens: Token[] = []; let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index]!)) { index++; continue; }
    const [token, next] = readToken(source, index); tokens.push(token); index = next;
    requireSketch(tokens.length <= EXPRESSION_LIMITS.tokens, 'BASE_LIMIT', `Expressions are limited to ${EXPRESSION_LIMITS.tokens} tokens.`);
  }
  tokens.push({ type: 'end', value: '', at: source.length });
  return tokens;
}

class Parser {
  private position = 0;
  private depth = 0;
  private readonly source: string;
  private readonly tokens: Token[];
  constructor(source: string, tokens: Token[]) { this.source = source; this.tokens = tokens; }
  private peek(): Token { return this.tokens[this.position]!; }
  private next(): Token { return this.tokens[this.position++]!; }
  private accept(value: string): boolean {
    const token = this.peek();
    if (token.type !== 'punct' || token.value !== value) return false;
    this.position++; return true;
  }
  private expect(value: string): void { if (!this.accept(value)) fail(this.source, this.peek().at, `Expected "${value}"`); }
  parse(): BaseNode {
    const node = this.binary(0);
    if (this.peek().type !== 'end') fail(this.source, this.peek().at, 'Unexpected input');
    return node;
  }
  private nested<T>(build: () => T): T {
    requireSketch(++this.depth <= EXPRESSION_LIMITS.depth, 'BASE_LIMIT', `Expressions nest at most ${EXPRESSION_LIMITS.depth} levels.`);
    try { return build(); } finally { this.depth--; }
  }
  private binary(level: number): BaseNode {
    if (level === PRECEDENCE.length) return this.unary();
    let left = this.binary(level + 1);
    for (;;) {
      const token = this.peek();
      if (token.type !== 'punct' || !PRECEDENCE[level]!.includes(token.value)) return left;
      this.next();
      left = { kind: 'binary', operator: token.value, left, right: this.binary(level + 1) };
    }
  }
  private unary(): BaseNode {
    const token = this.peek();
    if (token.type === 'punct' && (token.value === '!' || token.value === '-')) {
      this.next();
      return this.nested(() => ({ kind: 'unary', operator: token.value as '!' | '-', operand: this.unary() }));
    }
    return this.postfix(this.primary());
  }
  private postfix(start: BaseNode): BaseNode {
    let node = start;
    for (;;) {
      if (this.accept('.')) {
        const name = this.next();
        if (name.type !== 'name') fail(this.source, name.at, 'Expected a property or method name');
        node = { kind: 'member', target: node, name: name.value };
      } else if (this.accept('(')) node = { kind: 'call', callee: node, args: this.items(')') };
      else if (this.accept('[')) { node = { kind: 'index', target: node, index: this.nested(() => this.binary(0)) }; this.expect(']'); }
      else return node;
    }
  }
  private items(close: string): BaseNode[] {
    const items: BaseNode[] = [];
    if (this.accept(close)) return items;
    do items.push(this.nested(() => this.binary(0))); while (this.accept(','));
    this.expect(close);
    return items;
  }
  private primary(): BaseNode {
    const token = this.next();
    if (token.type === 'number') return { kind: 'literal', value: Number(token.value) };
    if (token.type === 'string') return { kind: 'literal', value: token.value };
    if (token.type === 'name') return KEYWORDS[token.value] ?? { kind: 'name', name: token.value };
    if (token.type === 'punct' && token.value === '(') { const inner = this.nested(() => this.binary(0)); this.expect(')'); return inner; }
    if (token.type === 'punct' && token.value === '[') return { kind: 'list', items: this.items(']') };
    return fail(this.source, token.at, token.type === 'end' ? 'Unexpected end of expression' : `Unexpected "${token.value}"`);
  }
}

/** Parses one expression; throws BASE_EXPRESSION or BASE_LIMIT with the character position. */
export function parseExpression(source: string): BaseNode {
  requireSketch(typeof source === 'string' && source.trim().length > 0, 'BASE_EXPRESSION', 'An expression must be non-empty text.');
  return new Parser(source, tokenize(source)).parse();
}
