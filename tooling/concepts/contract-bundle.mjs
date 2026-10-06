/** Bundles the one schema 6 project contract for the standalone concept as the CompanionContract script global. No project data is read. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

export const CONTRACT_ENTRY = 'tooling/concepts/concept-contract.ts';
export const CONTRACT_GLOBAL = 'CompanionContract';
/** Deterministic, unminified IIFE text for the pinned bundler; the concept's --check verifies the embedded bytes. */
export async function conceptContractScript(root = process.cwd()) {
  const result = await build({ root, configFile: false, logLevel: 'silent', publicDir: false,
    build: { write: false, minify: false, sourcemap: false, target: 'es2022', emptyOutDir: false, reportCompressedSize: false,
      lib: { entry: resolve(root, CONTRACT_ENTRY), name: CONTRACT_GLOBAL, formats: ['iife'], fileName: () => 'contract.js' },
      rolldownOptions: { output: { codeSplitting: false } } } });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap(output => output.output).filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || !chunks[0].code.startsWith('var ' + CONTRACT_GLOBAL + ' = ')) throw Error('CONTRACT_BUNDLE: Expected one ' + CONTRACT_GLOBAL + ' script.');
  return chunks[0].code;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 2) throw Error('CONTRACT_BUNDLE: No arguments are accepted.');
  process.stdout.write(await conceptContractScript());
}
