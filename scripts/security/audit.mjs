import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { classifyAudit } from './audit-result.mjs';
import { projectInstallEnvironment } from '../shared/npm-install.mjs';
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
const json = execute('audit.json', ['audit', '--json']);
const ordinary = execute('audit.txt', ['audit']);
const result = { ...classifyAudit(json, ordinary), node: process.version,
  jsonExit: json.status, ordinaryExit: ordinary.status, capturedAt: new Date().toISOString() };
writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2) + '\n');
console.log(ordinary.stdout ?? ''); console.log(`Security check: ${result.status}. All installed dependency categories included.`);
if (result.status !== 'passed') process.exitCode = 1;
