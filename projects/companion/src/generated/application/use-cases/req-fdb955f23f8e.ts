import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-4-3","key":"req-fdb955f23f8e","title":"Connect without copying artifacts","acceptance":"Items link existing sitemap identities and requirements. Searchable pickers retain selected references; direct links and Back preserve context. Missing targets remain explicit; linked artifacts are never deleted.","prd":"prd-4","nodes":["node-11"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-4","companion-4-3");
};
