import { record, text, list, boolean, choice, integer } from './primitives.mjs';
/** Optional per-surface UX acceptance obligations. Inert data: it names what must be verified, never how or that it passed. */
export const SURFACE_ACCEPTANCE_STATES = Object.freeze(['default', 'loading', 'empty', 'error', 'disabled']);
export const SURFACE_ACCEPTANCE_THEMES = Object.freeze(['light', 'dark']);
export const SURFACE_ACCEPTANCE_MIN_WIDTH = Object.freeze({ default: 360, minimum: 120, maximum: 4000 });
export const SURFACE_ACCEPTANCE_LIMITS = Object.freeze({ keyboardSteps: 40, step: 120, notes: 2000 });
const step = { ...text(SURFACE_ACCEPTANCE_LIMITS.step, 1), pattern: '^[^\\u0000-\\u001f\\u007f]*\\S[^\\u0000-\\u001f\\u007f]*$' };
export const surfaceAcceptanceSchema = record({
  states: { ...list(choice(SURFACE_ACCEPTANCE_STATES), SURFACE_ACCEPTANCE_STATES.length), uniqueItems: true },
  keyboardPath: list(step, SURFACE_ACCEPTANCE_LIMITS.keyboardSteps),
  focusReturn: boolean,
  minWidth: integer(SURFACE_ACCEPTANCE_MIN_WIDTH.minimum, SURFACE_ACCEPTANCE_MIN_WIDTH.maximum),
  themes: { ...list(choice(SURFACE_ACCEPTANCE_THEMES), SURFACE_ACCEPTANCE_THEMES.length, 1), uniqueItems: true },
  notes: text(SURFACE_ACCEPTANCE_LIMITS.notes),
}, []);
surfaceAcceptanceSchema.description = 'Optional UX obligations for one surface. Defaults: minWidth 360, both themes. Declaring an obligation is not evidence that it passes.';
