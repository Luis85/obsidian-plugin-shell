import type { VisualRequest } from '../../domain/visual-runtime.ts';
import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const intent = {"definitionId":"vp-115","nodeId":"vn-117","id":"vi-121","event":"change","label":"Review selected file","notes":"Validate a bounded local JSON document before presenting replacement confirmation.","acceptance":"Given an existing project\nWhen valid JSON is selected\nThen show a review without replacing current data.","actions":[]};
/** Start with a failing acceptance test. This hook does not infer business rules from prose. */
export const execute: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new NotImplementedError("vp-115", "vi-121"); };
