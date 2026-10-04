import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-5-3","key":"req-bc455a45fb5d","title":"Keep test-vault boundaries","acceptance":"Authoring files, host configuration and test-target data are preserved; no silent path migration or plugin activation.","prd":"prd-5","nodes":["node-35"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-5","companion-5-3");
};
