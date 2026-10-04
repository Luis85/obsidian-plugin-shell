import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-2-2","key":"req-ef2c7cdeff8a","title":"Reuse source operations","acceptance":"A screen references a declared source operation through a named directional data flow, not a duplicate source definition.","prd":"prd-2","nodes":["node-13"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-2","companion-2-2");
};
