import type { Result } from '../domain/outcome';
import type { Frontmatter } from './document-service';
export interface DecodedDocument { readonly properties: Readonly<Record<string, unknown>>; readonly body: string }
export interface DocumentCodec {
  render(properties: Frontmatter, body: string): string;
  read(markdown: string): Result<DecodedDocument | undefined>;
  patch(markdown: string, properties: Frontmatter, managedProperties: readonly string[]): Result<string>;
}
