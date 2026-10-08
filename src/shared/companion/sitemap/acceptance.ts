/** Optional per-surface UX acceptance block: structural validation and default resolution. No host or UI imports. */
import { record, requireSitemap, SitemapError } from './safety.ts';

export type SurfaceAcceptanceState = 'default' | 'loading' | 'empty' | 'error' | 'disabled';
export type SurfaceAcceptanceTheme = 'light' | 'dark';
/** Authored shape: every member is optional and absence means "use the documented default". */
export interface SurfaceAcceptance {
  states?: SurfaceAcceptanceState[];
  keyboardPath?: string[];
  focusReturn?: boolean;
  minWidth?: number;
  themes?: SurfaceAcceptanceTheme[];
  notes?: string;
}
/** Defaults applied, in a stable member order. */
export interface ResolvedSurfaceAcceptance {
  states: SurfaceAcceptanceState[];
  keyboardPath: string[];
  focusReturn: boolean;
  minWidth: number;
  themes: SurfaceAcceptanceTheme[];
  notes: string;
}
// Mirrors src/shared/companion/schema/acceptance.mjs (tooling zone, not importable from the contract); parity is tested.
const SURFACE_ACCEPTANCE_STATES: readonly SurfaceAcceptanceState[] = ['default', 'loading', 'empty', 'error', 'disabled'];
const SURFACE_ACCEPTANCE_THEMES: readonly SurfaceAcceptanceTheme[] = ['light', 'dark'];
const SURFACE_ACCEPTANCE_MIN_WIDTH = { default: 360, minimum: 120, maximum: 4000 } as const;
const SURFACE_ACCEPTANCE_LIMITS = { keyboardSteps: 40, step: 120, notes: 2000 } as const;
const KEYS = ['states', 'keyboardPath', 'focusReturn', 'minWidth', 'themes', 'notes'];
const THEMES: SurfaceAcceptanceTheme[] = ['light', 'dark'];
function fail(message: string): never { throw new SitemapError('SITEMAP_ACCEPTANCE', message); }

/** Members must be plain data of the declared type; unknown members, duplicates and out-of-range values name the offender. */
function choices(value: unknown, allowed: readonly string[], name: string, minimum: number): void {
  requireSitemap(Array.isArray(value) && value.length >= minimum && value.length <= allowed.length, 'SITEMAP_ACCEPTANCE', `Acceptance ${name} must list ${minimum === 0 ? '' : 'at least one of '}${allowed.join(', ')}.`);
  for (const item of value as unknown[]) requireSitemap(typeof item === 'string' && allowed.includes(item), 'SITEMAP_ACCEPTANCE', `Acceptance ${name} contains an unsupported value; use ${allowed.join(', ')}.`);
  requireSitemap(new Set(value as unknown[]).size === (value as unknown[]).length, 'SITEMAP_ACCEPTANCE', `Acceptance ${name} lists a value twice.`);
}
export function validateSurfaceAcceptance(value: unknown): asserts value is SurfaceAcceptance {
  requireSitemap(record(value), 'SITEMAP_ACCEPTANCE', 'Surface acceptance must be an object.');
  const unknown = Object.keys(value).find(key => !KEYS.includes(key));
  if (unknown !== undefined) fail(`Unknown acceptance member ${JSON.stringify(unknown)}; allowed: ${KEYS.join(', ')}.`);
  if (value.states !== undefined) choices(value.states, SURFACE_ACCEPTANCE_STATES, 'states', 0);
  if (value.themes !== undefined) choices(value.themes, SURFACE_ACCEPTANCE_THEMES, 'themes', 1);
  if (value.keyboardPath !== undefined) {
    const path = value.keyboardPath;
    requireSitemap(Array.isArray(path) && path.length <= SURFACE_ACCEPTANCE_LIMITS.keyboardSteps, 'SITEMAP_ACCEPTANCE', `Acceptance keyboardPath must be a list of at most ${SURFACE_ACCEPTANCE_LIMITS.keyboardSteps} control ids or labels.`);
    for (const step of path as unknown[]) requireSitemap(typeof step === 'string' && step.trim() !== '' && step.length <= SURFACE_ACCEPTANCE_LIMITS.step && !/[\u0000-\u001f\u007f]/u.test(step), 'SITEMAP_ACCEPTANCE', 'Each keyboardPath step must be a non-empty single-line control id or label.');
  }
  requireSitemap(value.focusReturn === undefined || typeof value.focusReturn === 'boolean', 'SITEMAP_ACCEPTANCE', 'Acceptance focusReturn must be true or false.');
  const width = value.minWidth;
  requireSitemap(width === undefined || (typeof width === 'number' && Number.isInteger(width) && width >= SURFACE_ACCEPTANCE_MIN_WIDTH.minimum && width <= SURFACE_ACCEPTANCE_MIN_WIDTH.maximum), 'SITEMAP_ACCEPTANCE',
    `Acceptance minWidth must be a whole number of pixels from ${SURFACE_ACCEPTANCE_MIN_WIDTH.minimum} to ${SURFACE_ACCEPTANCE_MIN_WIDTH.maximum}.`);
  requireSitemap(value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= SURFACE_ACCEPTANCE_LIMITS.notes), 'SITEMAP_ACCEPTANCE', `Acceptance notes must be text of at most ${SURFACE_ACCEPTANCE_LIMITS.notes} characters.`);
}
/** Applies the documented defaults (360 px, both themes). Assumes a validated block. */
export function resolveSurfaceAcceptance(block: SurfaceAcceptance): ResolvedSurfaceAcceptance {
  return {
    states: [...block.states ?? []], keyboardPath: [...block.keyboardPath ?? []], focusReturn: block.focusReturn ?? false,
    minWidth: block.minWidth ?? SURFACE_ACCEPTANCE_MIN_WIDTH.default, themes: block.themes ? [...block.themes] : [...THEMES], notes: block.notes ?? '',
  };
}
