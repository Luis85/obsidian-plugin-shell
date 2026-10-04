import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-1-5","key":"req-c08099e105e7","title":"Declare domain relationships","acceptance":"Define properties and explicit cardinalities while keeping diagram arrangement separate from persistence semantics.","prd":"prd-1","nodes":["node-21"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-1","companion-1-5");
};
