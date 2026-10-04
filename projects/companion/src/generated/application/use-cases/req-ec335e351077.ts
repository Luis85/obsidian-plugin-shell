import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-2-3","key":"req-ec335e351077","title":"Generate deterministic test data","acceptance":"Equal seed, schema and fixed reference date yield equal fixtures. No operation contacts a live source as fallback.","prd":"prd-2","nodes":["node-25"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-2","companion-2-3");
};
