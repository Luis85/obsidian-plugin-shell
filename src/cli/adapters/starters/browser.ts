/** Browser/CLI-shared starter semantics. No filesystem, process, URL-fetch or storage authority. */
import { parseDesignData } from '#shared/contracts/json-data.ts';
import { validateDefinition } from './validation.ts';
import { resolveValues } from './render.ts';
import { customizeStarter } from './customize.ts';
import { validateAuthoringDocument } from '#shared/companion/authoring-contract.ts';
import { requireThat } from '../framework/contracts.ts';
import type { StarterDefinition } from './types.ts';
export const STARTER_MAX_BYTES = 4_000_000;
export function parseBrowserStarter(text: string): StarterDefinition {
  requireThat(typeof text === 'string' && new TextEncoder().encode(text).length <= STARTER_MAX_BYTES,
    'STARTER_LIMIT', 'Choose a starter JSON no larger than 4 MB.');
  return validateDefinition(parseDesignData(text));
}
export function starterProjection(definition: StarterDefinition, sha256: string) {
  const d = validateDefinition(definition);
  requireThat(d.generator.kind === 'companion', 'STARTER_KIND', 'This file-only starter can be generated through the CLI, but does not declare an editable Companion model.');
  requireThat(/^[a-f0-9]{64}$/.test(sha256), 'STARTER_HASH', 'Expected the SHA-256 of the actual imported bytes.');
  return { id: d.id, name: d.name, category: d.category, level: d.level, summary: d.summary,
    outcome: d.outcome, includes: [...d.includes], implementation: [...d.implementation], tags: [...d.tags],
    version: d.version, file: d.id + '.companion.json', sha256, document: structuredClone(d.generator.document) };
}
export function configureBrowserStarter(definition: StarterDefinition, sha256: string, supplied: unknown) {
  const d = validateDefinition(definition), values = resolveValues(d, supplied), fields: Record<string, string> = {};
  for (const key of ['id', 'name', 'author', 'description', 'version', 'codebaseFolder', 'testsFolder', 'extension', 'extensions']) {
    if (values[key] !== undefined) fields[key] = String(values[key]);
  }
  starterProjection(d, sha256);
  return customizeStarter({ definition: d, sha256 }, fields);
}

/** Export edited design with the reviewed recipe's files/processes intact; never serialize session approvals. */
export function exportBrowserStarter(definition: StarterDefinition, sha256: string, project: unknown, supplied: unknown) {
  starterProjection(definition, sha256);
  const document = validateAuthoringDocument(project), values = resolveValues(definition, supplied);
  const identity: Record<string, unknown> = { ...document.project };
  const settings: Record<string, unknown> = { ...document.settings };
  const inputs = definition.inputs.map(input => {
    const value = Object.hasOwn(identity, input.id) ? identity[input.id] : Object.hasOwn(settings, input.id) ? settings[input.id] : values[input.id];
    return { ...structuredClone(input), ...(value === undefined ? {} : { default: value }) };
  });
  return validateDefinition({ ...structuredClone(definition), inputs, generator: { kind: 'companion', document: structuredClone(document) } });
}
