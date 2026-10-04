import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-4-1","key":"req-5f7e49dbd623","title":"Create and open storymaps from either entry point","acceptance":"Navigation and linked PRD details open the same map; returning retains the originating context.","prd":"prd-4","nodes":["node-9"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-4","companion-4-1");
};
