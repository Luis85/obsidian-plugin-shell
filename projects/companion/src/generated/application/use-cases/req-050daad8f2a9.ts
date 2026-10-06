import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-5-1","key":"req-050daad8f2a9","title":"Preserve drafts and keyboard context","acceptance":"Closing dirty forms asks for confirmation; modal feedback is visible and focus returns to a meaningful control.","prd":"prd-5","nodes":["node-49"],"components":[]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-5","companion-5-1");
};
