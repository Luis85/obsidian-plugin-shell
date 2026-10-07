/** CLI host types for starters read from disk: source bytes, Companion documents and generation receipts. */
import type { AuthoringDocument } from '#shared/companion/authoring-contract.ts';
import type { InputValue, StarterDefinition, StarterProcess } from '#shared/companion/starters/types.ts';
export interface LoadedStarter { definition: StarterDefinition; file: string; sha256: string; bytes: Buffer }
/** A loaded definition whose generator embeds a validated Companion project v6 document. */
export interface CompanionStarter extends LoadedStarter { document: AuthoringDocument }
export interface StarterReceipt {
  schemaVersion: 1; starter: { id: string; name: string; version: string; sha256: string };
  values: Record<string, InputValue>; processes: StarterProcess[]; firstRun: string[]; nextSteps: string[];
  files: Array<{ path: string; sha256: string }>;
}
