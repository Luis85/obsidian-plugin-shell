import { requireSketch, slug } from './errors.ts';
import { text } from './data.ts';
export interface PrdMarkdown { id: string; title: string; markdown: string; requirements: never[] }
function doubleQuoted(raw: string): unknown {
  const quoted = /^"(?:[^"\\]|\\.)*"/.exec(raw)?.[0];
  requireSketch(quoted && /^\s*(?:#.*)?$/.test(raw.slice(quoted.length)), 'PRD_FRONTMATTER', 'Use JSON-compatible double quotes for identity fields.');
  try { return JSON.parse(quoted); }
  catch { requireSketch(false, 'PRD_FRONTMATTER', 'Invalid quoted identity field.'); }
}
function scalar(raw: string): unknown {
  if (raw.startsWith('"')) return doubleQuoted(raw);
  if (raw.startsWith("'")) {
    const quoted = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(raw);
    requireSketch(quoted, 'PRD_FRONTMATTER', 'Invalid single-quoted identity field.');
    return quoted[1]!.replace(/''/g, "'");
  }
  requireSketch(!/^[|>!&*[{]/.test(raw), 'PRD_FRONTMATTER', 'type/id/title must be scalar text, not YAML blocks, aliases, tags or collections.');
  return raw.replace(/\s+#.*$/, '').trim();
}
function identityFields(frontmatter: string): Record<string, string> {
  const fields: Record<string, string> = Object.create(null);
  for (const line of frontmatter.split('\n')) {
    const hit = /^(type|id|title):\s*(.*?)\s*$/.exec(line);
    if (!hit) continue;
    const key = hit[1]!;
    requireSketch(!Object.hasOwn(fields, key), 'PRD_FRONTMATTER', 'Duplicate frontmatter identity field: ' + key);
    fields[key] = text(scalar(hit[2]!), key, key === 'title' ? 120 : 100);
  }
  return fields;
}
/** Identity-only scalar frontmatter intake. The complete original Markdown is retained.
 * Not a general YAML parser: identity aliases, tags, collections and blocks fail explicitly. */
export function typedPrd(markdown: string, filename: string): PrdMarkdown | null {
  requireSketch(new TextEncoder().encode(markdown).length <= 250_000 && !markdown.includes('\0'), 'PRD_LIMIT', 'PRDs must be UTF-8 text under 250 KB, without NUL.');
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return null;
  const close = /^---[ \t]*$/m.exec(normalized.slice(4));
  requireSketch(close, 'PRD_FRONTMATTER', 'Unclosed Markdown frontmatter: ' + filename);
  const fields = identityFields(normalized.slice(4, 4 + close.index));
  if (fields.type?.toLowerCase() !== 'prd') return null;
  const name = filename.split('/').at(-1)!.replace(/\.md$/i, '');
  const id = fields.id ?? slug(name, 'prd');
  requireSketch(/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(id), 'PRD_ID', 'PRD id must be a portable identity (letters, numbers, hyphen, underscore).');
  return { id, title: fields.title ?? name, markdown, requirements: [] };
}
