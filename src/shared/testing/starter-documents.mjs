/** Current (project v6) Companion documents from the canonical starter definitions. Tests never read retired formats. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../../../', import.meta.url);
const startersFolder = 'configs/starters';
export const starterPath = id => `${startersFolder}/${id}.json`;
function definition(id) {
  return JSON.parse(readFileSync(new URL(starterPath(id), root), 'utf8'));
}
/** A fresh, mutable copy of one starter's embedded Companion document. */
export function starterDocument(id) {
  const value = definition(id);
  if (value.generator?.kind !== 'companion') throw new Error('STARTER_FIXTURE: ' + id + ' does not embed a Companion document.');
  return value.generator.document;
}
/** Canonical serialized document bytes, as the Companion downloads them. */
export function starterDocumentText(id) {
  return JSON.stringify(starterDocument(id), null, 2) + '\n';
}
/** Every starter ID whose definition embeds a Companion document, in file order. */
export function companionStarterIds() {
  return readdirSync(fileURLToPath(new URL(startersFolder, root))).filter(name => name.endsWith('.json')).sort()
    .map(name => name.slice(0, -5)).filter(id => definition(id).generator?.kind === 'companion');
}
/** The current self-project: the golden Companion starter. */
export const selfProject = () => starterDocument('companion-plugin');
/** The twelve focused example starters (every Companion starter except the self-project and the feature showcase). */
export function exampleStarterIds() {
  return companionStarterIds().filter(id => !['companion-plugin', 'feature-showcase'].includes(id));
}
