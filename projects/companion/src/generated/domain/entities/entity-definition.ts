import { matches, type Schema } from '../contract.ts';
export type GEntityDefinition = { "id": string; "type": "entity-definition"; "title": string; "code_name"?: string; "note_folder"?: string; "description"?: string; };
export const GEntityDefinitionSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["entity-definition"]},"title":{"type":"string"},"code_name":{"type":"string"},"note_folder":{"type":"string"},"description":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGEntityDefinition(value: unknown): value is GEntityDefinition { return matches(value,GEntityDefinitionSchema); }

export const definition = {"id":"er-entity-22","slug":"entity-definition","name":"Entity Definition","folder":"Companion/EntityDefinition"};
