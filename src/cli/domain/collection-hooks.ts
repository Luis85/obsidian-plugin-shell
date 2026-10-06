import type { CollectionHook } from './collection-record.ts';
import { riskScoringHook } from './risk-scoring.ts';
/**
 * The explicit list of collection hooks a definition in configs/collections may name (`hook`). A collection that
 * data fully describes needs none; one that derives values adds a pure hook here.
 */
export const collectionHooks: Readonly<Record<string, CollectionHook>> = Object.freeze({ 'risk.scoring': riskScoringHook });
