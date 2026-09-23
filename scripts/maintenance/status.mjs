import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discover } from './discovery.mjs';

async function maintenanceStatus(root = process.cwd(), options = {}) {
  const json = async name => JSON.parse(await readFile(resolve(root, name), 'utf8'));
  const pkg = await json('package.json'); const manifest = await json('manifest.json');
  const pins = new Map();
  for (const name of (await readdir(resolve(root, '.github/workflows'))).filter(name => /\.ya?ml$/.test(name))) {
    const text = await readFile(resolve(root, '.github/workflows', name), 'utf8');
    for (const match of text.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@([a-f0-9]{40})\b/g)) pins.set(`${match[1]}@${match[2]}`, { name: match[1], commit: match[2] });
  }
  let audit = null;
  try { audit = await json('reports/security/result.json'); } catch (error) { if (error.code !== 'ENOENT') audit = { status: 'invalid-record', capturedAt: null }; }
  return discover({ pkg, manifest, actionPins: [...pins.values()], audit, ...options });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('NO_ARGUMENTS_SUPPORTED');
    const report = await maintenanceStatus();
    await mkdir('reports/maintenance', { recursive: true });
    await writeFile('reports/maintenance/status.json', JSON.stringify(report, null, 2) + '\n');
    const lines = ['# Maintenance discovery', '', `Checked: ${report.checkedAt}. Status: ${report.status}.`, '', report.scope, '', '| Item | Selected | Candidate | State | Reason |', '| --- | --- | --- | --- | --- |'];
    const cell = value => String(value ?? 'not recorded').replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
    for (const row of report.rows) lines.push(`| ${[row.name, row.selected, row.candidate, row.state, row.reason].map(cell).join(' | ')} |`);
    await writeFile('reports/maintenance/status.md', lines.join('\n') + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (report.status === 'source-unavailable') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
