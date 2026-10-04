import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const requirement = {"id":"companion-3-1","key":"req-116526fbf97d","title":"Describe the companion itself","acceptance":"The bundled companion project uses the same editable model, screens, requirements, entities, sources and design system as user projects.","prd":"prd-3","nodes":["node-3"],"components":["status-notice"]};
/** Refine input/output and implement only after writing the failing acceptance test. */
export const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {
  throw new NotImplementedError("prd-3","companion-3-1");
};
