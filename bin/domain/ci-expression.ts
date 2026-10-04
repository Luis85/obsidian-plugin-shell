/**
 * The literal subset of GitHub Actions `${{ }}` expressions that can be settled locally.
 * Anything else stays verbatim and is reported, never guessed: a condition that cannot be settled is "unknown".
 */
export type Lookup = (path: string) => string | undefined;
export interface Substituted { text: string; unresolved: string[] }
const marker = /\$\{\{([\s\S]*?)\}\}/g;
const contextPath = /^[A-Za-z_][\w-]*(?:\.[\w-]+)*$/;
/** Replaces `${{ context.path }}` where the lookup knows the value; other expressions stay verbatim and are listed. */
export function substitute(input: string, lookup: Lookup): Substituted {
  const unresolved: string[] = [];
  const result = input.replace(marker, (whole, body: string) => {
    const expression = body.trim(), value = contextPath.test(expression) ? lookup(expression) : undefined;
    if (value !== undefined) return value;
    if (!unresolved.includes(expression)) unresolved.push(expression);
    return whole;
  });
  return { text: result, unresolved };
}
export const hasExpression = (input: string): boolean => new RegExp(marker.source).test(input);
/** `null` marks an unknown value; comparisons and boolean operators propagate it only when it decides the outcome. */
type Value = string | boolean | null;
export interface ConditionOptions { lookup: Lookup; success: boolean }
const tokenPattern = /\s*(?:(&&|\|\||==|!=|[()!,])|'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)|([A-Za-z_][\w-]*(?:\.[\w-]+)*(?:\(\))?))/y;
type Token = { kind: 'op' | 'text' | 'word'; value: string };
function tokenize(source: string): Token[] | null {
  const tokens: Token[] = [];
  tokenPattern.lastIndex = 0;
  while (tokenPattern.lastIndex < source.length) {
    if (/^\s*$/.test(source.slice(tokenPattern.lastIndex))) break;
    const match = tokenPattern.exec(source);
    if (!match) return null;
    if (match[1] !== undefined) tokens.push({ kind: 'op', value: match[1] });
    else if (match[2] !== undefined) tokens.push({ kind: 'text', value: match[2].replaceAll("''", "'") });
    else tokens.push({ kind: 'word', value: match[3] ?? match[4] ?? '' });
  }
  return tokens;
}
const truthy = (value: Value): boolean | null => value === null ? null : typeof value === 'boolean' ? value : value !== '';
const same = (left: Value, right: Value): boolean | null => left === null || right === null ? null : String(left).toLowerCase() === String(right).toLowerCase();
function and(left: Value, right: Value): Value {
  const [a, b] = [truthy(left), truthy(right)];
  return a === false || b === false ? false : a === null || b === null ? null : true;
}
function or(left: Value, right: Value): Value {
  const [a, b] = [truthy(left), truthy(right)];
  return a === true || b === true ? true : a === null || b === null ? null : false;
}
const stringSearch: ReadonlyMap<string, (text: string, part: string) => boolean> = new Map([
  ['startswith', (text, part) => text.startsWith(part)], ['endswith', (text, part) => text.endsWith(part)], ['contains', (text, part) => text.includes(part)],
]);
class Parser {
  private position = 0;
  private readonly tokens: Token[];
  private readonly options: ConditionOptions;
  constructor(tokens: Token[], options: ConditionOptions) { this.tokens = tokens; this.options = options; }
  done(): boolean { return this.position >= this.tokens.length; }
  private accept(...operators: string[]): string | undefined {
    const token = this.tokens[this.position];
    if (token?.kind !== 'op' || !operators.includes(token.value)) return undefined;
    this.position++;
    return token.value;
  }
  disjunction(): Value { return this.chain(() => this.conjunction(), ['||'], or); }
  private conjunction(): Value { return this.chain(() => this.equality(), ['&&'], and); }
  private chain(next: () => Value, operators: string[], join: (left: Value, right: Value) => Value): Value {
    let value = next();
    while (this.accept(...operators)) value = join(value, next());
    return value;
  }
  private equality(): Value {
    let value = this.unary();
    for (let operator = this.accept('==', '!='); operator; operator = this.accept('==', '!=')) {
      const result = same(value, this.unary());
      value = operator === '==' || result === null ? result : !result;
    }
    return value;
  }
  private unary(): Value {
    if (this.accept('!')) { const value = truthy(this.unary()); return value === null ? null : !value; }
    if (this.accept('(')) {
      const value = this.disjunction();
      if (!this.accept(')')) throw new SyntaxError('missing )');
      return value;
    }
    return this.operand();
  }
  private operand(): Value {
    const token = this.tokens[this.position++];
    if (!token || token.kind === 'op') throw new SyntaxError('operand expected');
    if (token.kind === 'text') return token.value;
    return this.word(token.value);
  }
  private word(word: string): Value {
    if (word === 'true' || word === 'false') return word === 'true';
    if (word === 'null') return '';
    if (/^-?\d/.test(word)) return word;
    if (word.endsWith('()')) return this.call(word.slice(0, -2));
    if (this.accept('(')) return this.search(word, this.arguments());
    return this.options.lookup(word) ?? null;
  }
  private arguments(): Value[] {
    const values = [this.disjunction()];
    while (this.accept(',')) values.push(this.disjunction());
    if (!this.accept(')')) throw new SyntaxError('missing )');
    return values;
  }
  /** startsWith, endsWith and contains on two strings, case-insensitive as on GitHub; other functions stay unknown. */
  private search(name: string, values: Value[]): Value {
    const compare = stringSearch.get(name.toLowerCase());
    if (!compare || values.length !== 2) throw new SyntaxError(`unsupported function ${name}()`);
    const [text, part] = values as [Value, Value];
    return text === null || part === null ? null : compare(String(text).toLowerCase(), String(part).toLowerCase());
  }
  private call(name: string): Value {
    if (name === 'always') return true;
    if (name === 'success') return this.options.success;
    if (name === 'failure') return !this.options.success;
    if (name === 'cancelled') return false;
    throw new SyntaxError(`unsupported function ${name}()`);
  }
}
/** `true`/`false` when the condition is decidable locally, otherwise `undefined` (unknown). */
export function evaluateCondition(source: string, options: ConditionOptions): boolean | undefined {
  const trimmed = source.trim(), match = /^\$\{\{([\s\S]*)\}\}$/.exec(trimmed), body = match?.[1] ?? trimmed;
  const tokens = tokenize(body);
  if (!tokens?.length) return undefined;
  try {
    const parser = new Parser(tokens, options), value = parser.disjunction();
    return parser.done() ? truthy(value) ?? undefined : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}
