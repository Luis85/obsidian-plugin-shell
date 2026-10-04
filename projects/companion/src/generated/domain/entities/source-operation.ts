import { matches, type Schema } from '../contract.ts';
export type GSourceOperation = { "id": string; "type": "source-operation"; "title": string; "direction"?: string; "input_shape"?: string; "output_shape"?: string; "source_ref"?: string; };
export const GSourceOperationSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["source-operation"]},"title":{"type":"string"},"direction":{"type":"string"},"input_shape":{"type":"string"},"output_shape":{"type":"string"},"source_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGSourceOperation(value: unknown): value is GSourceOperation { return matches(value,GSourceOperationSchema); }

export const definition = {"id":"er-entity-32","slug":"source-operation","name":"Source Operation","folder":"Companion/SourceOperation"};
