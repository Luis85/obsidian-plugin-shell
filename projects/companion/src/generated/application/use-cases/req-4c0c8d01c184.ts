import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-4-5","key":"req-4c0c8d01c184","title":"Transfer storymaps without data loss","acceptance":"Versioned project JSON preserves IDs, order, content, releases and references. Legacy projects are accepted without inventing stories.","prd":"prd-4","nodes":["node-9"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-4","companion-4-5");
};
