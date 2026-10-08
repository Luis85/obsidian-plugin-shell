/** Explicit maintainer qualification export. The JSON starter remains the only current self-project authority. */
import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadDefinitions } from '../../src/cli/adapters/starters/repository.ts';
import { validateAuthoringDocument } from '../../src/shared/companion/authoring-contract.ts';
import { createFilePlan, applyFilePlan } from '../../src/shared/platform/file-plan.ts';
export async function exportGoldenProject(root, check = false) {
  const entries = await loadDefinitions(root), entry = entries.find(row => row.definition.id === 'companion-plugin');
  if (!entry || entry.definition.generator.kind !== 'companion') throw Error('GOLDEN_STARTER_REQUIRED: Install companion-plugin.json from the separate starter pack.');
  const document = validateAuthoringDocument(entry.definition.generator.document);
  if (document.schemaVersion !== 6) throw Error('GOLDEN_VERSION: Current qualification requires project v6.');
  const directory = 'reports/companion-mvp', htmlPath = join(root, directory, 'index.html'), stat = await lstat(htmlPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16000000) throw Error('GOLDEN_BUILD: Expected the bounded current authoring HTML.');
  const html = await readFile(htmlPath), hash = value => createHash('sha256').update(value).digest('hex');
  const build = JSON.parse(await readFile(join(root, directory, 'build.json'), 'utf8'));
  if (build.startup !== 'empty-or-restored' || build.html !== hash(html)) throw Error('GOLDEN_BUILD: Rebuild the empty authoring workspace first.');
  const project = JSON.stringify(document, null, 2) + '\n';
  const receipt = { schema: 1, scope: 'explicit qualification export from canonical external starter; not acceptance',
    starter: entry.file, starterSha256: entry.sha256, project: hash(project), html: hash(html), projectBytes: Buffer.byteLength(project) };
  const plan = await createFilePlan(root, [
    { path: directory + '/companion-project.json', content: project },
    { path: directory + '/companion-project-v6.json', content: project },
    { path: directory + '/qualification-project.json', content: JSON.stringify(receipt, null, 2) + '\n' },
  ]);
  if (check && plan.changes.some(change => change.status !== 'unchanged')) throw Error('GOLDEN_STALE: The derived qualification export differs.');
  if (!check) await applyFilePlan(plan);
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--check') || process.argv.length > 3) throw Error('GOLDEN_USAGE: Only --check is supported.');
  console.log(JSON.stringify(await exportGoldenProject(process.cwd(), process.argv.includes('--check'))));
}
