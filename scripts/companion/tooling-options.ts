import { migrateAuthoringDocument, validateAuthoringDocument, type AuthoringDocument } from './authoring-contract.ts';
import { airshipOptions } from './tooling-contract.mjs';
/** Explicit creation/setup flags override data; omission preserves the original version and bytes. */
export function withAirshipOption(input: unknown, flags: Record<string, string | boolean>): AuthoringDocument {
  const document = validateAuthoringDocument(input);
  if (flags.airship && flags['no-airship']) throw new Error('AIRSHIP_OPTION_CONFLICT: Choose --airship or --no-airship.');
  if (!flags.airship && !flags['no-airship']) return document;
  const next = structuredClone(migrateAuthoringDocument(document).document);
  next.tooling = { ...next.tooling, airship: { ...airshipOptions(next.tooling), enabled: flags.airship === true } };
  return validateAuthoringDocument(next);
}
