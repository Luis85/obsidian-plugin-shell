import { matches, type Schema } from '../contract.ts';
export type GScreen = { "id": string; "type": "screen"; "title": string; "code_name"?: string; "layout"?: string; "surface_kind"?: string; "project_ref"?: string; "component_refs"?: Array<string>; };
export const GScreenSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["screen"]},"title":{"type":"string"},"code_name":{"type":"string"},"layout":{"type":"string"},"surface_kind":{"type":"string"},"project_ref":{"type":"string"},"component_refs":{"type":"array","items":{"type":"string"}}},"required":["id","type","title"],"additionalProperties":true};
export function isGScreen(value: unknown): value is GScreen { return matches(value,GScreenSchema); }

export const definition = {"id":"er-entity-12","slug":"screen","name":"Screen","folder":"Companion/Screen"};
