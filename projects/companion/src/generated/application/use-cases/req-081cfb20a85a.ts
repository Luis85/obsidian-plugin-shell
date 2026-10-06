import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-1-3","key":"req-081cfb20a85a","title":"Capture requirements and acceptance","acceptance":"Create, revise, map and export PRDs with testable requirements, priorities and retained review baselines.","prd":"prd-1","nodes":["node-7"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-1","companion-1-3");
};
