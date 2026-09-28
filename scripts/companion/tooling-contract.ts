/** Optional development tooling. Neither switch implies the other or authorizes a process. */
import { record, requireSitemap } from './sitemap/safety.ts';
// Keep the authoring schema independent of the compiler's structurally equivalent request DTO.
interface StorybookOptions { enabled?: boolean; generateStories?: boolean }
export interface ProjectTooling { storybook?: StorybookOptions }
export function validateStorybookOptions(value: unknown): asserts value is StorybookOptions {
  requireSitemap(record(value) && Object.keys(value).every(key => ['enabled', 'generateStories'].includes(key)) &&
    Object.values(value).every(item => typeof item === 'boolean'), 'COMPANION_INVALID',
    'tooling.storybook accepts only boolean enabled and generateStories switches. Both default to false.');
}
export function validateProjectTooling(value: unknown): asserts value is ProjectTooling | undefined {
  if (value === undefined) return;
  requireSitemap(record(value) && Object.keys(value).every(key => key === 'storybook'),
    'COMPANION_INVALID', 'tooling accepts only the optional storybook configuration.');
  if (Object.hasOwn(value, 'storybook')) validateStorybookOptions(value.storybook);
}
export function storybookOptions(document: { tooling?: ProjectTooling }): Required<StorybookOptions> {
  return { enabled: document.tooling?.storybook?.enabled === true, generateStories: document.tooling?.storybook?.generateStories === true };
}
/** API/CLI overrides are copied into the generated definition, never into the input file. */
export function withStorybookOptions(document: unknown, overrides?: StorybookOptions): unknown {
  if (overrides === undefined) return document;
  validateStorybookOptions(overrides);
  requireSitemap(record(document), 'COMPANION_INVALID', 'Expected a project document.');
  validateProjectTooling(document.tooling);
  return { ...document, tooling: { ...document.tooling, storybook: { ...document.tooling?.storybook, ...overrides } } };
}
/** This schema is for the optional tooling field, not the whole project or execution authorization. */
export function projectToolingSchema() {
  return { type: 'object', additionalProperties: false, properties: { storybook: {
    type: 'object', additionalProperties: false, properties: {
      enabled: { type: 'boolean', default: false, description: 'Emit an isolated Storybook workspace; installation is a separate explicit action.' },
      generateStories: { type: 'boolean', default: false, description: 'Emit CSF stories for generated pages and components without installing Storybook.' },
    },
  } } };
}
