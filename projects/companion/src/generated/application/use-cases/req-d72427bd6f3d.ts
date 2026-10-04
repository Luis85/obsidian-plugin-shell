import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-5-6","key":"req-d72427bd6f3d","title":"Publish only after native acceptance","acceptance":"Shell qualification comes first, then native companion conversion and acceptance, then publication. No design action publishes.","prd":"prd-5","nodes":["node-45"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-5","companion-5-6");
};
