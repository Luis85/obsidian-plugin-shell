import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-2-4","key":"req-be077636eb52","title":"Exercise isolated operations","acceptance":"Run and cancel a simulation, retain focus and distinguish status announcements from result payloads.","prd":"prd-2","nodes":["node-25"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-2","companion-2-4");
};
