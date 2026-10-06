import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-1-1","key":"req-1cb6a142a83a","title":"Start from a curated full project","acceptance":"Browse and filter eleven offline JSON starters including a minimal runnable Start Blank. Inspect scope, configure identity and folders, review the exact project, explicitly confirm replacement, and preserve the old project on invalid input, stale state or failed persistence. Templates remain immutable and exported projects stay generator-compatible.","prd":"prd-1","nodes":["node-5"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-1","companion-1-1");
};
