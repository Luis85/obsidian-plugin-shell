/** Shared browser entry: importing a definition grants neither filesystem nor process authority. */
import { validateDefinition } from './validation.ts';
import { STARTER_MAX_BYTES } from './limits.ts';
import { utf8Length } from '../companion/sitemap/safety.ts';
import { requireThat } from '../framework/contracts.ts';
import { customizeStarter } from './companion.mjs';
import type { StarterDefinition } from './types.ts';
export function parseStarterText(text: string): StarterDefinition {
  requireThat(typeof text === 'string' && utf8Length(text) <= STARTER_MAX_BYTES,
    'STARTER_LIMIT', 'Starter exceeds the 4 MB design limit.');
  return validateDefinition(JSON.parse(text));
}
export function starterEntry(definition: StarterDefinition, sha256: string) {
  const d = validateDefinition(definition);
  requireThat(/^[a-f0-9]{64}$/.test(sha256), 'STARTER_HASH', 'A source SHA-256 is required.');
  return { id: d.id, name: d.name, category: d.category, level: d.level, summary: d.summary,
    outcome: d.outcome, includes: d.includes, implementation: d.implementation, tags: d.tags,
    version: d.version, file: d.id + '.companion.json', sha256,
    ...(d.generator.kind === 'companion' ? { document: d.generator.document } : {}) };
}
export const browserStarters = { parse: parseStarterText, entry: starterEntry, customize: customizeStarter, maxBytes: STARTER_MAX_BYTES };
