import type { ProjectInventory } from './contracts.ts';

const stringOrComment = /"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const stringOrComma = /"(?:[^"\\]|\\.)*"|,(\s*[}\]])/g;
/** JSON with comments and trailing commas, as tsconfig.json and angular.json allow. Throws on malformed text. */
export function parseLooseJson(text: string): unknown {
  const bare = text.replace(/^﻿/, '').replace(stringOrComment, match => match.startsWith('"') ? match : '');
  return JSON.parse(bare.replace(stringOrComma, (match, tail: string | undefined) => tail === undefined ? match : tail));
}
export type JsonRecord = Record<string, unknown>;
export const isRecord = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Own property read that never reaches a prototype member. */
export const field = (value: unknown, key: string): unknown => isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;
export const textField = (value: unknown, key: string): string | null => {
  const item = field(value, key);
  return typeof item === 'string' ? item : null;
};
export const recordField = (value: unknown, key: string): JsonRecord => {
  const item = field(value, key);
  return isRecord(item) ? item : {};
};
const depth = (path: string): number => path.split('/').length;
const byDepth = (a: string, b: string): number => depth(a) - depth(b) || (a < b ? -1 : a > b ? 1 : 0);

/** Read-only, memoized lens over a project inventory; malformed JSON is recorded, never thrown. */
export class InventoryView {
  readonly paths: readonly string[];
  readonly malformed: string[] = [];
  private readonly sizes = new Map<string, number>();
  private readonly parsed = new Map<string, unknown>();
  readonly inventory: ProjectInventory;
  constructor(inventory: ProjectInventory) {
    this.inventory = inventory;
    this.paths = inventory.files.map(file => file.path).sort(byDepth);
    for (const file of inventory.files) this.sizes.set(file.path, file.bytes);
  }
  has(path: string): boolean { return this.sizes.has(path); }
  hasDirectory(prefix: string): boolean { return this.paths.some(path => path.startsWith(prefix + '/')); }
  find(pattern: RegExp): string[] { return this.paths.filter(path => pattern.test(path)); }
  count(pattern: RegExp): number { return this.paths.reduce((total, path) => total + (pattern.test(path) ? 1 : 0), 0); }
  text(path: string): string | undefined { return this.inventory.texts.get(path); }
  /** Parsed JSON (comments allowed) for a read file; undefined when absent or malformed. */
  json(path: string): unknown {
    if (this.parsed.has(path)) return this.parsed.get(path);
    const raw = this.text(path);
    let value: unknown;
    if (raw !== undefined) {
      try { value = parseLooseJson(raw); } catch { this.malformed.push(path); }
    }
    this.parsed.set(path, value);
    return value;
  }
  /** Read texts whose path matches, in stable depth-first path order. */
  texts(pattern: RegExp): Array<[string, string]> {
    return this.paths.filter(path => pattern.test(path) && this.inventory.texts.has(path)).map(path => [path, this.inventory.texts.get(path)!]);
  }
}
