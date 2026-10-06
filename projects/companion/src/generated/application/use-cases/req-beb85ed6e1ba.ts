import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-3-3","key":"req-beb85ed6e1ba","title":"Import a full project safely","acceptance":"File and pasted JSON are bounded and validated before review; invalid input, cancelled review or stale state leaves the project unchanged.","prd":"prd-3","nodes":["node-50"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-3","companion-3-3");
};
