import { loadEventCatalog } from './load-catalog.mjs';
async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--check', '--json', '--help'].includes(arg)))
    throw new Error('Unknown event catalog option');
  if (args.includes('--help')) {
    console.log(
      'events:catalog [--json] derives contracts from registered source; events:check rejects descriptor/catalog drift, duplicates and invalid references. No files are written.',
    );
    return;
  }
  const report = await loadEventCatalog();
  if (args.includes('--json') || args.includes('--check')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(
    '# Registered event catalog\n\nDerived from explicit runtime registrations and their TypeScript payload guards.\n',
  );
  for (const event of report.events)
    console.log(
      `## ${event.name} (contract ${event.version})\n\n${event.meaning}\n\n- Owner: ${event.owner}\n- Publisher: ${event.publisher}\n- Subscribers: ${event.subscribers.join(', ')}\n- Origin: ${event.origin}\n- Sensitivity: ${event.sensitivity}\n- Delivery: ${event.delivery}\n\nPayload: \`${event.payload}\`\n`,
    );
}
main().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }));
  process.exitCode = 1;
});
