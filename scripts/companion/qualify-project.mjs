/** Qualification, not part of generation: explicitly installs and executes the reviewed fixture. */
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { boundaryProject } from '../../tests/fixtures/generator-boundaries.mjs';
import { planProject, applyProject, reviewProject } from './compiler/plan.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.env.QUALIFIED_NPM;
if (!npm) throw new Error('QUALIFICATION_NPM_REQUIRED: select the qualified npm explicitly.');
if (process.argv.slice(2).some(arg=>arg!=='--boundary-fixture')) throw new Error('QUALIFICATION_ARGUMENT');
const boundary = process.argv.includes('--boundary-fixture');
const output = join(root, 'reports/project-generator', ...(boundary ? ['boundaries'] : [])); await mkdir(output, { recursive: true });
const vault = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'companion-qualification-'));
let input = join(root,'docs/concepts/companion/companion-project.json');
if(boundary){const document=boundaryProject(JSON.parse(await readFile(input,'utf8')));input=join(vault,'boundary-project.json');await writeFile(input,JSON.stringify(document,null,2));}
const options = { input, vault, target: boundary ? 'boundary-companion' : 'companion' };
const result = await planProject(options); await writeFile(join(output, 'plan.json'), JSON.stringify(reviewProject(result), null, 2));
await applyProject(result, result.hash); const target = join(vault, options.target);
await writeFile(join(output, 'target.txt'), target);
const checks = [];
for (const [name, args] of [ ['install', ['ci', '--no-fund']], ['project', ['run', 'verify:project']] ]) {
  const run = spawnSync(process.execPath, [resolve(npm), ...args], { cwd: target, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  await writeFile(join(output, name + '.log'), (run.stdout ?? '') + (run.stderr ?? ''));
  checks.push({ name, status: run.status, error: run.error?.message });
  await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
  if (run.status !== 0 || run.error) throw new Error('QUALIFICATION_FAILED: ' + name + '\n' + (run.stdout ?? '') + (run.stderr ?? ''));
}
const trace = JSON.parse(await readFile(join(target, 'design/traceability.json'), 'utf8'));
await writeFile(join(output, 'summary.json'), JSON.stringify({ status: 'scaffold-qualified', planHash: result.hash, ...result.summary, requirementAcceptance: 'not-implemented', pendingRequirements: trace.requirements.length, nativeAcceptance: 'not-run' }, null, 2));
console.log(JSON.stringify({ status: 'scaffold-qualified', target, output }));
