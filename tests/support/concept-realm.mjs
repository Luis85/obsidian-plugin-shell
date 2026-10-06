// The concept's shared script scope, assembled the way build-companion.py inlines it: the bundled schema 6 project
// contract (CompanionContract), the concept's names for it, then the plain shared contract modules without imports/exports.
import { readFile } from 'node:fs/promises';
import { conceptContractScript } from '../../scripts/concepts/contract-bundle.mjs';

export const visualModules = ['ir', 'mapping', 'catalog', 'composition', 'validate', 'layout', 'commands', 'session'].map(n => 'visual/visual-' + n + '.mjs');
const bundle = conceptContractScript();
/** `contracts` are scripts/companion module paths, inlined in the given order after the project contract. */
export async function conceptShared(contracts) {
  const plain = (await Promise.all(contracts.map(name => readFile('scripts/companion/' + name, 'utf8')))).join('\n').split('\n')
    .filter(line => !line.startsWith('import ')).join('\n').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ');
  return [await bundle, await readFile('docs/concepts/companion/src/companion-contract.js', 'utf8'), plain].join('\n');
}
