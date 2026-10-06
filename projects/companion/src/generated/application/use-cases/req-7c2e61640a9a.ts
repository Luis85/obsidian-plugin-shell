import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-4-4","key":"req-7c2e61640a9a","title":"Plan outcome-oriented release slices","acceptance":"Move stories between releases or Unplanned. Removing a release preserves its stories. Review surfaces missing outcomes, acceptance notes and targets without claiming implementation; archived maps require restore before editing.","prd":"prd-4","nodes":["node-11"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-4","companion-4-4");
};
