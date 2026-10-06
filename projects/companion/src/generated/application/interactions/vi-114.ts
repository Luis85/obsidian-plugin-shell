import type { VisualRequest } from '../../domain/visual-runtime.ts';
import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const intent = {"definitionId":"vc-107","nodeId":"vn-112","id":"vi-114","event":"click","label":"Confirm reviewed project","notes":"Only request replacement after validation and explicit confirmation. Emit select to the owning page.","acceptance":"Given a reviewed project and confirmation\nWhen replacement is requested\nThen the page receives the selection event and retains recoverable errors.","actions":[]};
/** Start with a failing acceptance test. This hook does not infer business rules from prose. */
export const execute: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new NotImplementedError("vc-107", "vi-114"); };
