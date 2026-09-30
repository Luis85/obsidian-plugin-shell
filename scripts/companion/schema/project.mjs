import { PRD_LIMITS } from '../prd-limits.mjs';
import { toolingSchema } from '../tooling-contract.mjs';
/** Public current transport schema. Semantic validation remains the shared authoring validator. */
import { reference as ref, record, text, integer, list, json, jsonDefinition } from './primitives.mjs';
import { sitemapDefinitions } from './sitemap.mjs';
import { nativeSchema } from './native.mjs';
import { visualDefinitions } from './visual.mjs';
import { designSystemSchema } from './design-system.mjs';
import { storymapsSchema } from './storymaps.mjs';
const folder = { ...text(240, 1), pattern: '^[A-Za-z0-9][A-Za-z0-9 _.-]*(/[A-Za-z0-9][A-Za-z0-9 _.-]*)*$',
  $comment: 'The shared runtime also checks reserved names, trailing dots/spaces and case-insensitive overlap.' };
const identity = record({ id: { ...text(60, 1), pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' },
  name: { ...text(80, 1), pattern: '^[^\\r\\n]*\\S[^\\r\\n]*$' }, author: text(80),
  version: { ...text(40, 1), pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' }, description: text(400) });
const legacyRecord = record({ id: text(120, 1) }, ['id'], json);
const opaque = description => ({ ...json, description });
const design = record({ schema: { const: 6 }, blueprint: text(80, 1), goal: text(1000), platform: { enum: ['desktop', 'mobile-ready'] },
  nextId: integer(1), nodes: list(ref('surface'), 60), links: list(ref('transition'), 120), library: list(legacyRecord, 200), prds: list(legacyRecord, PRD_LIMITS.count),
  librarySchema: json, canvas: ref('canvas'), sitemap: ref('sitemap'), features: ref('features'), nativeIntegrations: nativeSchema,
  editors: record({ schema: { const: 1 }, bindings: list(record({ surface: text(120, 1), editor: { const: 'journey-lens' } }), 60) }),
  semantic: opaque('Retained semantic authoring namespace; compiler validation resolves entity/relationship contracts.'),
  dataSources: opaque('Retained source/fixture authoring namespace; compiler validates executable source contracts.'),
  designSystem: designSystemSchema,
  storymaps: storymapsSchema,
  visualDesigns: ref('visualDesigns'),
}, ['schema', 'blueprint', 'goal', 'platform', 'nextId','nodes', 'links', 'library', 'prds']);
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:obsidian-plugin-shell:companion-project:6',
  title: 'Companion project v6 — portable authoring transport',
  description: 'Inert authoring data. Schema validation is necessary but not sufficient: use project validate for the complete transport contract and compiler check for generation readiness. No JSON field authorizes effects.',
  ...record({ kind: { const: 'obsidian-companion-project' }, schemaVersion: { const: 6 }, executable: { const: false },
    project: identity, settings: record({ codebaseFolder: folder, testsFolder: folder }), design, notes: list(text(100000), 100), tooling: toolingSchema() }, ['kind','schemaVersion','executable','project','settings','design','notes']),
  $defs: { json: jsonDefinition, ...sitemapDefinitions, ...visualDefinitions },
  'x-validation': { command: 'node bin/app project validate --input project.json --json',
    semanticValidator: 'scripts/companion/authoring-contract.ts#validateAuthoringDocument',
    generationCommand: 'node bin/app compiler check --input project.json --json',
    limits: { utf8Bytes: 4000000, depth: 40, values: 120000, totalJourneySteps: 4096 },
    checks: ['all retained subsystem validators', 'portable folder names/overlap', 'unique stable IDs', 'referential integrity', 'containment/dependency cycles', 'route collisions', 'component contracts/pins', 'bounded UTF-8 input'],
  },
};
/** Each caller gets an isolated schema, so mutable help/agent consumers cannot change the contract. */
export function companionProjectSchema() { return structuredClone(schema); }
