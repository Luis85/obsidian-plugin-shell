import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-4-2","key":"req-af43374c5ccc","title":"Plan structured user experiences","acceptance":"Activities, steps and stories keep semantic order across drag, form moves and shared Undo/Redo. Repeated story entry retains the destination; search preserves the complete map.","prd":"prd-4","nodes":["node-11"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-4","companion-4-2");
};
