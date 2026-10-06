/** Optional development tooling. Neither switch implies the other or authorizes a process. */
import { assertJson, record, requireSitemap } from './sitemap/safety.ts';
import { validateTooling, toolingSchema } from './tooling-contract.mjs';
import type { ProjectHosting } from './schema/hosting.mjs';
// Keep authoring types independent of compiler request DTOs and executable adapters.
interface StorybookOptions { enabled?: boolean; generateStories?: boolean }
export interface ProjectTooling {
  storybook?: StorybookOptions;
  airship?: { enabled: boolean; agent?: 'claude' | 'codex' | 'opencode'; targetPort?: number; port?: number };
  /** Inert project defaults; Hindsight remains a separately approved user-local tool. */
  hindsight?: { enabled: boolean; agents: Array<'claude-code'|'codex'|'cursor-cli'|'copilot-cli'|'opencode'>; git?: 'none'|'message'|'full'; sessions?: boolean };
  /** Where pull requests and CI live; absent means GitHub. Non-secret identifiers only. */
  hosting?: ProjectHosting;
}
export function validateProjectTooling(value: unknown): asserts value is ProjectTooling | undefined {
  validateTooling(value);
}
export function storybookOptions(document: { tooling?: ProjectTooling }): Required<StorybookOptions> {
  validateProjectTooling(document.tooling);
  return { enabled: document.tooling?.storybook?.enabled === true, generateStories: document.tooling?.storybook?.generateStories === true };
}
/** API/CLI overrides are copied into the generated definition, never into the input file. */
export function withStorybookOptions(document: unknown, overrides?: StorybookOptions): unknown {
  if (overrides === undefined) return document;
  validateProjectTooling({ storybook: overrides });
  assertJson(document);
  requireSitemap(record(document), 'COMPANION_INVALID', 'Expected a project document.');
  validateProjectTooling(document.tooling);
  return { ...document, tooling: { ...document.tooling, storybook: { ...document.tooling?.storybook, ...overrides } } };
}
/** One schema for all independent opt-ins, not execution authorization. */
export function projectToolingSchema() { return toolingSchema(); }
