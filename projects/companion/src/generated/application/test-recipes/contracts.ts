import { matches, type Schema } from '../../domain/contract.ts';
export type GListInput = undefined;
export const GListInputSchema: Schema | null = null;
export function isGListInput(value: unknown): value is GListInput { return matches(value,GListInputSchema); }
export type GListOutput = Array<{ "record": { "id": string; "type": "test-recipe"; "title": string; "scenario"?: string; "dataset"?: string; "operation_ref"?: string; }; "revision": number; }>;
export const GListOutputSchema: Schema | null = {"type":"array","items":{"type":"object","properties":{"record":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["test-recipe"]},"title":{"type":"string"},"scenario":{"type":"string"},"dataset":{"type":"string"},"operation_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true},"revision":{"type":"integer"}},"required":["record","revision"],"additionalProperties":false}};
export function isGListOutput(value: unknown): value is GListOutput { return matches(value,GListOutputSchema); }
export type GCreateInput = { "values": { "title": string; "scenario"?: string; "dataset"?: string; "operation_ref"?: string; }; "requestId": string; };
export const GCreateInputSchema: Schema | null = {"type":"object","properties":{"values":{"type":"object","properties":{"title":{"type":"string"},"scenario":{"type":"string"},"dataset":{"type":"string"},"operation_ref":{"type":"string"}},"required":["title"],"additionalProperties":false},"requestId":{"type":"string"}},"required":["values","requestId"],"additionalProperties":false};
export function isGCreateInput(value: unknown): value is GCreateInput { return matches(value,GCreateInputSchema); }
export type GCreateOutput = { "record": { "id": string; "type": "test-recipe"; "title": string; "scenario"?: string; "dataset"?: string; "operation_ref"?: string; }; "revision": number; };
export const GCreateOutputSchema: Schema | null = {"type":"object","properties":{"record":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["test-recipe"]},"title":{"type":"string"},"scenario":{"type":"string"},"dataset":{"type":"string"},"operation_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true},"revision":{"type":"integer"}},"required":["record","revision"],"additionalProperties":false};
export function isGCreateOutput(value: unknown): value is GCreateOutput { return matches(value,GCreateOutputSchema); }
export type GUpdateInput = { "id": string; "revision": number; "values": { "title": string; "scenario"?: string; "dataset"?: string; "operation_ref"?: string; }; };
export const GUpdateInputSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"revision":{"type":"integer"},"values":{"type":"object","properties":{"title":{"type":"string"},"scenario":{"type":"string"},"dataset":{"type":"string"},"operation_ref":{"type":"string"}},"required":["title"],"additionalProperties":false}},"required":["id","revision","values"],"additionalProperties":false};
export function isGUpdateInput(value: unknown): value is GUpdateInput { return matches(value,GUpdateInputSchema); }
export type GUpdateOutput = { "record": { "id": string; "type": "test-recipe"; "title": string; "scenario"?: string; "dataset"?: string; "operation_ref"?: string; }; "revision": number; };
export const GUpdateOutputSchema: Schema | null = {"type":"object","properties":{"record":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["test-recipe"]},"title":{"type":"string"},"scenario":{"type":"string"},"dataset":{"type":"string"},"operation_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true},"revision":{"type":"integer"}},"required":["record","revision"],"additionalProperties":false};
export function isGUpdateOutput(value: unknown): value is GUpdateOutput { return matches(value,GUpdateOutputSchema); }
export type GDeleteInput = { "id": string; "revision": number; };
export const GDeleteInputSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"revision":{"type":"integer"}},"required":["id","revision"],"additionalProperties":false};
export function isGDeleteInput(value: unknown): value is GDeleteInput { return matches(value,GDeleteInputSchema); }
export type GDeleteOutput = undefined;
export const GDeleteOutputSchema: Schema | null = null;
export function isGDeleteOutput(value: unknown): value is GDeleteOutput { return matches(value,GDeleteOutputSchema); }
export interface GTestRecipesPort {
  "list"(input: GListInput, signal?: AbortSignal): Promise<unknown>;
  "create"(input: GCreateInput, signal?: AbortSignal): Promise<unknown>;
  "update"(input: GUpdateInput, signal?: AbortSignal): Promise<unknown>;
  "delete"(input: GDeleteInput, signal?: AbortSignal): Promise<unknown>;
}
