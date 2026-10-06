import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-3-5","key":"req-71f899ffeb21","title":"Accept JSON at the shell boundary","acceptance":"The v1 script accepts the export and a target inside an explicitly selected vault, prints original JSON bytes, and performs zero filesystem writes.","prd":"prd-3","nodes":["node-54"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-3","companion-3-5");
};
