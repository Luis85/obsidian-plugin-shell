import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-1-6","key":"req-bd1de4fc44cb","title":"Use reusable components","acceptance":"Place pinned component revisions and variants with local overrides and named slot content. Preview variants, inspect transitive usage, and review contract differences and slot remapping before applying upgrades.","prd":"prd-1","nodes":["node-29"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-1","companion-1-6");
};
