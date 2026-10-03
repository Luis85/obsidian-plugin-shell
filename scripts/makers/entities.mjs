import { loadCatalog } from '../../bin/adapters/makers/load-catalog.ts';
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
  if (args.some(arg => !['--check', '--json', '--help'].includes(arg))) throw new Error('Unknown entity catalog option');
  if (args.includes('--help')) { console.log('entities:check validates actual registered definitions; entities:catalog [--json] prints derived schemas. No output files or user notes are written.'); return; }
  const report = await loadCatalog();
  if (args.includes('--json') || args.includes('--check')) console.log(JSON.stringify(report, null, 2));
  else printCatalog(report);
}
main().catch(error => { console.error(JSON.stringify({ status: 'failed', error: error.message })); process.exitCode = 1; });
