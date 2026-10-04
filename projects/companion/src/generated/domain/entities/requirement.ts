import { matches, type Schema } from '../contract.ts';
export type GRequirement = { "id": string; "type": "requirement"; "title": string; "acceptance"?: string; "priority"?: string; "status"?: string; "project_ref"?: string; "screen_refs"?: Array<string>; };
export const GRequirementSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["requirement"]},"title":{"type":"string"},"acceptance":{"type":"string"},"priority":{"type":"string"},"status":{"type":"string"},"project_ref":{"type":"string"},"screen_refs":{"type":"array","items":{"type":"string"}}},"required":["id","type","title"],"additionalProperties":true};
export function isGRequirement(value: unknown): value is GRequirement { return matches(value,GRequirementSchema); }

export const definition = {"id":"er-entity-7","slug":"requirement","name":"Requirement","folder":"Companion/Requirement"};
