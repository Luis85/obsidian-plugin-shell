import { matches, type Schema } from '../contract.ts';
export type GPluginProject = { "id": string; "type": "plugin-project"; "plugin_id"?: string; "title": string; "description"?: string; "codebase_folder"?: string; "tests_folder"?: string; };
export const GPluginProjectSchema: Schema | null = {"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["plugin-project"]},"plugin_id":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"codebase_folder":{"type":"string"},"tests_folder":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true};
export function isGPluginProject(value: unknown): value is GPluginProject { return matches(value,GPluginProjectSchema); }

export const definition = {"id":"er-entity-1","slug":"plugin-project","name":"Plugin Project","folder":"Companion/PluginProject"};
