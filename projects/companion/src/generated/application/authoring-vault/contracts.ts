import { matches, type Schema } from '../../domain/contract.ts';
export type GListRequirementsInput = undefined;
export const GListRequirementsInputSchema: Schema | null = null;
export function isGListRequirementsInput(value: unknown): value is GListRequirementsInput { return matches(value,GListRequirementsInputSchema); }
export type GListRequirementsOutput = Array<{ "id": string; "type": "requirement"; "title": string; "acceptance"?: string; "priority"?: string; "status"?: string; "project_ref"?: string; "screen_refs"?: Array<string>; }>;
export const GListRequirementsOutputSchema: Schema | null = {"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["requirement"]},"title":{"type":"string"},"acceptance":{"type":"string"},"priority":{"type":"string"},"status":{"type":"string"},"project_ref":{"type":"string"},"screen_refs":{"type":"array","items":{"type":"string"}}},"required":["id","type","title"],"additionalProperties":true}};
export function isGListRequirementsOutput(value: unknown): value is GListRequirementsOutput { return matches(value,GListRequirementsOutputSchema); }
export type GListSitemapInput = undefined;
export const GListSitemapInputSchema: Schema | null = null;
export function isGListSitemapInput(value: unknown): value is GListSitemapInput { return matches(value,GListSitemapInputSchema); }
export type GListSitemapOutput = Array<{ "id": string; "type": "screen"; "title": string; "code_name"?: string; "layout"?: string; "surface_kind"?: string; "project_ref"?: string; "component_refs"?: Array<string>; }>;
export const GListSitemapOutputSchema: Schema | null = {"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["screen"]},"title":{"type":"string"},"code_name":{"type":"string"},"layout":{"type":"string"},"surface_kind":{"type":"string"},"project_ref":{"type":"string"},"component_refs":{"type":"array","items":{"type":"string"}}},"required":["id","type","title"],"additionalProperties":true}};
export function isGListSitemapOutput(value: unknown): value is GListSitemapOutput { return matches(value,GListSitemapOutputSchema); }
export type GListComponentsInput = undefined;
export const GListComponentsInputSchema: Schema | null = null;
export function isGListComponentsInput(value: unknown): value is GListComponentsInput { return matches(value,GListComponentsInputSchema); }
export type GListComponentsOutput = Array<{ "id": string; "type": "component"; "title": string; "version"?: string; "content"?: string; "accessibility"?: string; }>;
export const GListComponentsOutputSchema: Schema | null = {"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string","enum":["component"]},"title":{"type":"string"},"version":{"type":"string"},"content":{"type":"string"},"accessibility":{"type":"string"}},"required":["id","type","title"],"additionalProperties":true}};
export function isGListComponentsOutput(value: unknown): value is GListComponentsOutput { return matches(value,GListComponentsOutputSchema); }
export interface GAuthoringVaultPort {
  "list-requirements"(input: GListRequirementsInput, signal?: AbortSignal): Promise<unknown>;
  "list-sitemap"(input: GListSitemapInput, signal?: AbortSignal): Promise<unknown>;
  "list-components"(input: GListComponentsInput, signal?: AbortSignal): Promise<unknown>;
}
