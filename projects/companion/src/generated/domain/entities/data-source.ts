import { matches, type Schema } from '../contract.ts';
export type GDataSource = { "id": string; "type": "data-source"; "title": string; "source_kind"?: string; "locator"?: string; "credential_ref"?: string; };
export const GDataSourceSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["data-source"]},"title":{"type":"string"},"source_kind":{"type":"string"},"locator":{"type":"string"},"credential_ref":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGDataSource(value: unknown): value is GDataSource { return matches(value,GDataSourceSchema); }

export const definition = {"id":"er-entity-27","slug":"data-source","name":"Data Source","folder":"Companion/DataSource"};
