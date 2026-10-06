import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-1-2","key":"req-73b0ebfdbfbe","title":"One vault owns one project","acceptance":"Opening this workspace exposes one project; loading another definition requires review and never adds a second active project.","prd":"prd-1","nodes":["node-3"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-1","companion-1-2");
};
