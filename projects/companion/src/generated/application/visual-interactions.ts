import { execute as E0 } from './interactions/vi-121.ts';
import { execute as E1 } from './interactions/vi-114.ts';
import type { VisualRequest } from '../domain/visual-runtime.ts';
import type { Sources } from './sources.ts';
export async function handleVisualInteraction(request: VisualRequest, sources: Sources): Promise<unknown> {
  switch (request.interactionId) {
    case "vi-121": return E0(request, sources);
    case "vi-114": return E1(request, sources);
    default: throw new Error('VISUAL_INTERACTION_UNKNOWN');
  }
}
