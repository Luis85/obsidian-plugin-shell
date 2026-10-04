import { matches, type Schema } from '../contract.ts';
export type GDesignToken = { "id": string; "type": "design-token"; "title": string; "token_group"?: string; "value"?: string; "usage"?: string; "project_ref"?: string; };
export const GDesignTokenSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["design-token"]},"title":{"type":"string"},"token_group":{"type":"string"},"value":{"type":"string"},"usage":{"type":"string"},"project_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGDesignToken(value: unknown): value is GDesignToken { return matches(value,GDesignTokenSchema); }

export const definition = {"id":"er-entity-51","slug":"design-token","name":"Design Token","folder":"Companion/DesignToken"};
