import { stringify } from 'yaml';
import type { Frontmatter } from '../application/document-service';
/** Quote ambiguous scalars with a real YAML serializer; one complete create call. */
export function renderMarkdown(properties: Frontmatter, body: string): string {
  return `---\n${stringify(properties, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${body}`;
}
