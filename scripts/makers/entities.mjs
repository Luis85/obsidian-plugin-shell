import { loadCatalog } from './load-catalog.mjs';
const args = process.argv.slice(2);
async function main() {
  if (args.some(arg => !['--check', '--json', '--help'].includes(arg))) throw new Error('Unknown entity catalog option');
  if (args.includes('--help')) { console.log('entities:check validates actual registered definitions; entities:catalog [--json] prints derived schemas. No output files or user notes are written.'); return; }
  const report = await loadCatalog();
  if (args.includes('--json') || args.includes('--check')) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log('# Registered entity catalog\n\nDerived from the actual checked-in definitions and explicit runtime registry.\n');
  for (const entity of report.entities) {
    console.log(`## ${entity.entity} (schema ${entity.schemaVersion})\n\nRepository: \`${entity.registration}\`; default folder: \`${entity.defaultFolder}\`${entity.liveFolderOverride ? '; live preference override' : ''}.\n\n| Field | Type | Required input | Default | Property |\n| --- | --- | --- | --- | --- |`);
    for (const field of entity.fields) console.log(`| ${field.name} | ${field.type} | ${field.requiredInput} | ${Object.hasOwn(field, 'default') ? JSON.stringify(field.default) : '—'} | ${entity.mappings.find(mapping => mapping.field === field.name)?.property ?? '—'} |`);
    console.log('');
  }
}
main().catch(error => { console.error(JSON.stringify({ status: 'failed', error: error.message })); process.exitCode = 1; });
