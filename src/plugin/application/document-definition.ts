import { success, failure, type Result } from '../domain/outcome';
import type { EntityDefinition } from '../domain/entity';
import type { DocumentDefinition, Frontmatter } from './document-service';
interface Mapping<V> { readonly field: keyof V & string; readonly property: string }
export interface DocumentRecipe<I, V> extends DocumentDefinition<I> {
  readonly entity: EntityDefinition<I, V>;
  readonly mappings: readonly Mapping<V>[];
  decode(properties: Readonly<Record<string, unknown>>): Result<V>;
  properties(values: V): Result<Frontmatter>;
}
function serializable(value: unknown): value is string | number | boolean | readonly string[] {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (Array.isArray(value) && value.every(item => typeof item === 'string'));
}
/** Escapes plain text, including HTML and Markdown link/emphasis delimiters. */
export function heading(text: string): string {
  return text.replace(/[\r\n]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]()#!|~]/g, '\\$&');
}
export function defineDocument<I, V>(entity: EntityDefinition<I, V>, options: {
  readonly mappings: readonly Mapping<V>[];
  readonly title: (values: V) => string;
  readonly body: (values: V) => string;
}): DocumentRecipe<I, V> {
  const mappings = Object.freeze(options.mappings.map(value => Object.freeze({ ...value })));
  const { title, body } = options;
  const names = mappings.map(value => value.property);
  if (!names.length || new Set(names).size !== names.length || new Set(mappings.map(value => value.field)).size !== mappings.length || mappings.some(({ field, property }) => !Object.hasOwn(entity.fields, field) || !/^[a-z][a-zA-Z0-9_]*$/.test(property) || ['type', 'id', 'schema_version', 'created_at', 'constructor', 'prototype'].includes(property))) throw new Error('Invalid document mapping');
  function properties(values: V): Result<Frontmatter> {
    const output: Record<string, string | number | boolean | readonly string[]> = {};
    for (const { field, property } of mappings) {
      const value = values[field];
      if (value === undefined) continue;
      if (!serializable(value)) return failure('validation', 'error.entity');
      output[property] = value;
    }
    return success(Object.freeze(output));
  }
  return Object.freeze({ entity, mappings, properties,
    decode(frontmatter: Readonly<Record<string, unknown>>) {
      const input: Record<string, unknown> = {};
      for (const mapping of mappings) {
        if (Object.hasOwn(frontmatter, mapping.property)) input[mapping.field] = frontmatter[mapping.property];
        else if (!entity.fields[mapping.field]?.optional) return failure('validation', 'error.entity', mapping.field);
      }
      return entity.decode(input);
    },
    project(input: I) {
      const parsed = entity.parse(input);
      if (!parsed.ok) return parsed;
      const mapped = properties(parsed.value);
      if (!mapped.ok) return mapped;
      return success({ title: title(parsed.value), properties: mapped.value, body: body(parsed.value), schemaVersion: entity.schemaVersion });
    },
  });
}

/** Registration validates the catalog; it never changes vault-wide Properties settings. */
export function validateDocumentCatalog(recipes: readonly { readonly entity: { readonly key: string; readonly fields: Readonly<Record<string, { readonly kind: string }>> }; readonly mappings: readonly { readonly field: string; readonly property: string }[] }[]): void {
  const entities = new Set<string>();
  const properties = new Map<string, string>();
  for (const recipe of recipes) {
    if (entities.has(recipe.entity.key)) throw new Error('Duplicate document registration');
    entities.add(recipe.entity.key);
    for (const { field, property } of recipe.mappings) {
      const kind = recipe.entity.fields[field]?.kind;
      if (!kind || (properties.has(property) && properties.get(property) !== kind)) throw new Error('Conflicting property types');
      properties.set(property, kind);
    }
  }
}
