import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-3-4","key":"req-a5dabcd85e66","title":"Configure project folders","acceptance":"Codebase defaults to src and tests to tests. Valid custom folders persist and survive a JSON round trip; invalid or overlapping paths are rejected.","prd":"prd-3","nodes":["node-49"],"components":[]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-3","companion-3-4");
};
