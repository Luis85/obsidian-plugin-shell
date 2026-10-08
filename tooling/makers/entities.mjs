import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// The project's own CLI owns the catalog loader, so the script works in a source checkout and an extracted kit alike.
const app = fileURLToPath(new URL('../../bin/app', import.meta.url));
function loadCatalog(source) {
  const run = spawnSync(process.execPath, [app, 'entities', 'catalog', '--root', process.cwd(), '--json', ...(source ? ['--source', source] : [])], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  if (run.error) throw run.error;
  const result = JSON.parse(run.stdout);
  if (result.status !== 'ok') throw new Error(result.diagnostics.map(item => `${item.code}: ${item.message}`).join('; '));
  return result.data;
}
const args = process.argv.slice(2);
const property = (entity, field) => entity.mappings.find(mapping => mapping.field === field.name)?.property ?? '—';
const fallback = field => Object.hasOwn(field, 'default') ? JSON.stringify(field.default) : '—';
function printCatalog(report) {
  console.log('# Registered entity catalog\n\nDerived from the actual checked-in definitions and explicit runtime registry.\n');
  for (const entity of report.entities) {
    console.log(`## ${entity.entity} (schema ${entity.schemaVersion})\n\nRepository: \`${entity.registration}\`; default folder: \`${entity.defaultFolder}\`${entity.liveFolderOverride ? '; live preference override' : ''}.\n\n| Field | Type | Required input | Default | Property |\n| --- | --- | --- | --- | --- |`);
    for (const field of entity.fields) console.log(`| ${field.name} | ${field.type} | ${field.requiredInput} | ${fallback(field)} | ${property(entity, field)} |`);
    console.log('');
  }
}
async function main() {
  const sourceAt = args.indexOf('--source');
  const source = sourceAt < 0 ? undefined : args[sourceAt + 1];
  if (sourceAt >= 0 && (!source || source.startsWith('--') || args.lastIndexOf('--source') !== sourceAt)) throw new Error('Expected one --source <name>');
  const flags = args.filter((_, index) => index !== sourceAt && index !== sourceAt + 1 || sourceAt < 0);
  if (flags.some(arg => !['--check', '--json', '--help'].includes(arg))) throw new Error('Unknown entity catalog option');
  if (args.includes('--help')) { console.log('entities:check validates actual registered definitions; entities:catalog [--json] prints derived schemas. No output files or user notes are written.'); return; }
  const report = loadCatalog(source);
  if (args.includes('--json') || args.includes('--check')) console.log(JSON.stringify(report, null, 2));
  else printCatalog(report);
}
main().catch(error => { console.error(JSON.stringify({ status: 'failed', error: error.message })); process.exitCode = 1; });
