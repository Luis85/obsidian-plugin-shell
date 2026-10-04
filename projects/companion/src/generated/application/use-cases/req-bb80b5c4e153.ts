import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-5-4","key":"req-bb80b5c4e153","title":"Keep verification scopes separate","acceptance":"Build, browser, native and security evidence have explicit scope and revision. Import never grants trust or carries simulated passes forward.","prd":"prd-5","nodes":["node-41"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-5","companion-5-4");
};
