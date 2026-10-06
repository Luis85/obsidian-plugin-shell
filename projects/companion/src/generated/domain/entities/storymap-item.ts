import { matches, type Schema } from '../contract.ts';
export type GStorymapItem = { "id": string; "type": "storymap-item"; "title": string; "item_kind"?: string; "description"?: string; "acceptance"?: string; };
export const GStorymapItemSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["storymap-item"]},"title":{"type":"string"},"item_kind":{"type":"string"},"description":{"type":"string"},"acceptance":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGStorymapItem(value: unknown): value is GStorymapItem { return matches(value,GStorymapItemSchema); }

export const definition = {"id":"er-entity-46","slug":"storymap-item","name":"Storymap Item","folder":"Companion/StorymapItem"};
