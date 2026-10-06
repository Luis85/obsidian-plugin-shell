import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-2-5","key":"req-aee105c0a183","title":"Export isolated test tooling","acceptance":"Export fixtures and adapters with a read-only plan and explicit ownership checks before applying or cleaning files.","prd":"prd-2","nodes":["node-25"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-2","companion-2-5");
};
