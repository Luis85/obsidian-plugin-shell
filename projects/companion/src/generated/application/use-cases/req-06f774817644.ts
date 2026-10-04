import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-2-1","key":"req-06f774817644","title":"Describe every source port","acceptance":"Vault, API and database declarations include operations and explicit input/output shapes; credentials remain symbolic.","prd":"prd-2","nodes":["node-23"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-2","companion-2-1");
};
