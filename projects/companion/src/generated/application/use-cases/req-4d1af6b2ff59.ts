import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-5-5","key":"req-4d1af6b2ff59","title":"Teach the complete workflow","acceptance":"A dismissible and resumable guided tour covers all main design, test and preparation stages.","prd":"prd-5","nodes":["node-3"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-5","companion-5-5");
};
