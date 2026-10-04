import type { EntityDefinition } from '../domain/entity';

/** Domain definitions have no persistence, registration side effects or document mapping. */
export const authoringDomains: readonly EntityDefinition<never, unknown>[] = [
];
