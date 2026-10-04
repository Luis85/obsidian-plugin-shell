import { matches, type Schema } from '../contract.ts';
export type GTestRecipe = { "id": string; "type": "test-recipe"; "title": string; "scenario"?: string; "dataset"?: string; "operation_ref"?: string; };
export const GTestRecipeSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["test-recipe"]},"title":{"type":"string"},"scenario":{"type":"string"},"dataset":{"type":"string"},"operation_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGTestRecipe(value: unknown): value is GTestRecipe { return matches(value,GTestRecipeSchema); }

export const definition = {"id":"er-entity-37","slug":"test-recipe","name":"Test Recipe","folder":"Companion/TestRecipe"};
