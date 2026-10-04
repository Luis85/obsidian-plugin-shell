import { matches, type Schema } from '../contract.ts';
export type GComponent = { "id": string; "type": "component"; "title": string; "version"?: string; "content"?: string; "accessibility"?: string; };
export const GComponentSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["component"]},"title":{"type":"string"},"version":{"type":"string"},"content":{"type":"string"},"accessibility":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGComponent(value: unknown): value is GComponent { return matches(value,GComponentSchema); }

export const definition = {"id":"er-entity-17","slug":"component","name":"Component","folder":"Companion/Component"};
