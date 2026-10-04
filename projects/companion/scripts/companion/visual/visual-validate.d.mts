import type { VisualDesigns } from './visual-ir.mjs';
/** Optional reference context; an omitted set or map skips that reference check. */
export interface VisualValidationContext {
  surfaces?: ReadonlySet<string>;
  library?: ReadonlySet<string>;
  sources?: ReadonlyMap<string, ReadonlySet<string>>;
}
export declare function validateVisualDesigns(store: unknown, context?: VisualValidationContext): VisualDesigns;
