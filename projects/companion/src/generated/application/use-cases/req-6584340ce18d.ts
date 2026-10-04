import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-1-7","key":"req-6584340ce18d","title":"Select blueprints and patterns","acceptance":"Use a reviewed starter and shared action patterns without overwriting an existing design silently.","prd":"prd-1","nodes":["node-31"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-1","companion-1-7");
};
