import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { classifyAudit } from './audit-result.mjs';
import { parseExceptions } from './audit-exceptions.mjs';
import { projectInstallEnvironment } from '../../src/shared/platform/npm-install.mjs';
const output = 'reports/security'; mkdirSync(output, { recursive: true });
const env = projectInstallEnvironment(process.env).env;
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run check:security so the selected npm is qualified independently of Node.');
function execute(name, args) {
  const result = spawnSync(process.execPath, [npm, ...args], { encoding: 'utf8', env, timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(`${output}/${name}`, result.stdout ?? '');
  writeFileSync(`${output}/${name}.stderr.txt`, result.stderr ?? '');
  return result;
}
// Owner-approved, dated advisory exceptions (docs/development/SECURITY-AUDIT-EXCEPTIONS.md); a missing record means none.
let record = { schemaVersion: 1, exceptions: [] };
try { record = JSON.parse(readFileSync(new URL('./audit-exceptions.json', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') record = null; }
const exceptions = parseExceptions(record);
const json = execute('audit.json', ['audit', '--json']);
const ordinary = execute('audit.txt', ['audit']);
const production = Array.isArray(exceptions) && exceptions.length ? execute('audit-production.json', ['audit', '--omit=dev', '--json']) : undefined;
const verdict = Array.isArray(exceptions)
  ? classifyAudit(json, ordinary, { exceptions, production, today: new Date().toISOString().slice(0, 10) })
  : exceptions;
const result = { ...verdict, node: process.version, jsonExit: json.status, ordinaryExit: ordinary.status, capturedAt: new Date().toISOString() };
writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2) + '\n');
console.log(ordinary.stdout ?? '');
if (result.exceptions) for (const entry of result.exceptions) console.log(`Excepted (owner-approved until ${entry.expires}): ${entry.advisory} in ${entry.package}, development dependencies only.`);
for (const key of ['expired', 'stale', 'uncovered', 'advisories']) if (result[key]) console.log(`${key}: ${result[key].join(', ')}`);
console.log(`Security check: ${result.status}${result.reason ? ` (${result.reason})` : ''}. All installed dependency categories included.`);
if (!['passed', 'passed-with-exceptions'].includes(result.status)) process.exitCode = 1;
