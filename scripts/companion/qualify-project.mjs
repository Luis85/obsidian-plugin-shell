/** Qualification, not part of generation: explicitly installs and executes the reviewed fixture. */
import { mkdtemp, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { providerProject } from '../../tests/fixtures/generator-provider-project.mjs';
import { boundaryProject } from '../../tests/fixtures/generator-boundaries.mjs';
import { planProject, applyProject, reviewProject } from './compiler/plan.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.env.QUALIFIED_NPM;
if (!npm) throw new Error('QUALIFICATION_NPM_REQUIRED: select the qualified npm explicitly.');
if (process.argv.slice(2).length>1 || process.argv.slice(2).some(arg=>!['--boundary-fixture','--provider-fixture'].includes(arg))) throw new Error('QUALIFICATION_ARGUMENT');
const boundary = process.argv.includes('--boundary-fixture');
const provider = process.argv.includes('--provider-fixture');
const output = join(root, 'reports/project-generator', ...(boundary ? ['boundaries'] : provider ? ['providers'] : [])); await mkdir(output, { recursive: true });
// Canonical path: Windows 8.3 temp aliases break test-module resolution in the generated workspace.
const vault = await realpath(await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'companion-qualification-')));
let input = join(root,'docs/concepts/companion/companion-project.json');
if(boundary || provider){const document=(boundary?boundaryProject:providerProject)(JSON.parse(await readFile(input,'utf8')));input=join(vault,'boundary-project.json');await writeFile(input,JSON.stringify(document,null,2));}
const options = { input, vault, target: boundary ? 'boundary-companion' : provider ? 'provider-companion' : 'companion' };
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
