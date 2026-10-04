import { matches, type Schema } from '../contract.ts';
export type GStorymap = { "id": string; "type": "storymap"; "title": string; "purpose"?: string; "audience"?: string; "status"?: string; };
export const GStorymapSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["storymap"]},"title":{"type":"string"},"purpose":{"type":"string"},"audience":{"type":"string"},"status":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGStorymap(value: unknown): value is GStorymap { return matches(value,GStorymapSchema); }

export const definition = {"id":"er-entity-41","slug":"storymap","name":"Storymap","folder":"Companion/Storymap"};
