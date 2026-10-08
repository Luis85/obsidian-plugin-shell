import { stringify, parseDocument, visit, isAlias, isMap, isScalar } from 'yaml';
import type { Frontmatter } from '../application/document-service';
import type { DocumentCodec } from '../application/document-codec';
import { plainRecord } from '../domain/entity';
import { failure, success } from '../domain/outcome';
import { fitsUtf8Bytes } from '../domain/utf8';
/** Quote ambiguous scalars with a real YAML serializer; one complete create call. */
export function renderMarkdown(properties: Frontmatter, body: string): string {
  return `---\n${stringify(properties, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${body}`;
}
function safeDocument(document: ReturnType<typeof parseDocument>): boolean {
  if (document.errors.length || document.warnings.length || !isMap(document.contents)) return false;
  let unsafe = false;
  visit(document, (key, node, path) => {
    if (path.length > 30 || isAlias(node) || (isScalar(node) && key === 'key' && (typeof node.value !== 'string' || ['__proto__', 'prototype', 'constructor', '<<'].includes(node.value)))) { unsafe = true; return visit.BREAK; }
    return undefined;
  });
  return !unsafe;
}

function parseMarkdown(markdown: string) {
  if (!fitsUtf8Bytes(markdown, 1_000_000)) return failure('validation', 'error.entity');
  if (!/^---\r?\n/.test(markdown)) return success(undefined);
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!block) return failure('validation', 'error.entity');
  try {
    const document = parseDocument(block[1] ?? '', { uniqueKeys: true, strict: true });
    if (!safeDocument(document)) return failure('validation', 'error.entity');
    const properties: unknown = document.toJS({ maxAliasCount: 0 });
    if (!plainRecord(properties)) return failure('validation', 'error.entity');
    return success({ document, properties, body: markdown.slice(block[0].length) });
  } catch { return failure('validation', 'error.entity'); }
}
export const markdownCodec: DocumentCodec = {
  render: renderMarkdown,
  read(markdown) {
    const parsed = parseMarkdown(markdown);
    if (!parsed.ok || !parsed.value) return parsed;
    return success({ properties: parsed.value.properties, body: parsed.value.body });
  },
  patch(markdown, properties, managedProperties) {
    const parsed = parseMarkdown(markdown);
    if (!parsed.ok) return parsed;
    if (!parsed.value) return failure('validation', 'error.entity');
    const { document, body } = parsed.value;
    for (const key of managedProperties) {
      if (Object.hasOwn(properties, key)) document.set(key, properties[key]);
      else document.delete(key);
    }
    const candidate = `---\n${document.toString({ lineWidth: 0 })}---\n${body}`;
    return fitsUtf8Bytes(candidate, 1_000_000) ? success(candidate) : failure('validation', 'error.entity');
  },
};
