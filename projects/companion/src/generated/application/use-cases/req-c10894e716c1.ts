import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-5-2","key":"req-c10894e716c1","title":"Protect recovery copies","acceptance":"A stale window cannot reset newer retained state; current and retained data can be exported separately before reload.","prd":"prd-5","nodes":["node-47"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-5","companion-5-2");
};
