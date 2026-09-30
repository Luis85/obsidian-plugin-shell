/** Companion is an input adapter, not a second schema or visual-model implementation. */
import { SitemapError } from '../../companion/sitemap/safety.ts';
import { projectModel, type Model } from '../../companion/compiler/model.ts';
import { visualDefinitions } from '../../companion/compiler/visual-model.ts';
import { visualSources } from '../../companion/compiler/visual-ports.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import type { Phase } from '../domain/contracts.ts';

/** Only known contract errors are adapted. Unexpected exceptions remain compiler defects. */
export function contractCall<T>(phase: Phase, sourceName: string, work: () => T): T {
  try { return work(); } catch (error) {
    if (error instanceof CompilerError) throw error;
    if (error instanceof Error && (error instanceof SitemapError || /^(?:COMPANION_TOOLING_INVALID|COMPANION_INVALID|GENERATOR_INVALID|VISUAL_INVALID|DESIGN_SYSTEM_INVALID|COMPOSITION_INVALID|STORYMAP_INVALID):/.test(error.message))) {
      throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID',phase,error.message.slice(0,2000),
        {file:sourceName,jsonPointer:'',document:'input'}),{cause:error});
    }
    throw error;
  }
}
function freezeTree(value: unknown, seen = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); for (const child of Object.values(value)) freezeTree(child,seen); Object.freeze(value);
}
export function companionFrontend(sourceName: string) {
  return {
    validate: (value:unknown): Model => contractCall('validate',sourceName,()=>projectModel(value)),
    resolve: (model:Model): void => contractCall('resolve',sourceName,()=>{
      visualDefinitions(model); visualSources(model); freezeTree(model);
    }),
  };
}
