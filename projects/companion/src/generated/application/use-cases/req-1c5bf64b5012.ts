import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-3-2","key":"req-1c5bf64b5012","title":"Export the complete saved project","acceptance":"The versioned JSON preserves identity, folder settings, PRDs, screen content, variants, arrangements, entities, source operations, test recipes, tokens and notes.","prd":"prd-3","nodes":["node-52"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-3","companion-3-2");
};
