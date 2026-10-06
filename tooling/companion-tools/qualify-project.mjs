/** Qualification, not part of generation: explicitly installs and executes the reviewed fixture. */
import { authoringEvidence } from './authoring-evidence.mjs';
import { mkdtemp, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { providerProject } from '../../src/cli/tests/fixtures/generator-provider-project.mjs';
import { boundaryProject } from '../../src/cli/tests/fixtures/generator-boundaries.mjs';
import { planProject, applyProject, reviewProject } from '../../src/cli/compiler/adapters/project-plan.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.env.QUALIFIED_NPM;
if (!npm) throw new Error('QUALIFICATION_NPM_REQUIRED: select the qualified npm explicitly.');
if (process.argv.slice(2).length>1 || process.argv.slice(2).some(arg=>!['--boundary-fixture','--provider-fixture','--authoring-fixture'].includes(arg))) throw new Error('QUALIFICATION_ARGUMENT');
const authoring = process.argv.includes('--authoring-fixture');
const evidence = authoring ? await authoringEvidence(root) : null;
const boundary = process.argv.includes('--boundary-fixture');
const provider = process.argv.includes('--provider-fixture');
const output = authoring ? join(root,'reports/companion-mvp/generation') : join(root, 'reports/project-generator', ...(boundary ? ['boundaries'] : provider ? ['providers'] : [])); await mkdir(output, { recursive: true });
// Canonical path: Windows 8.3 temp aliases break test-module resolution in the generated workspace.
const vault = await realpath(await mkdtemp(join(process.env.COMPANION_QUALIFICATION_ROOT ?? process.env.RUNNER_TEMP ?? tmpdir(), 'companion-qualification-')));
// The current self-project is the golden project v6 starter; qualification writes its document into the isolated vault.
const selfProject = async () => JSON.parse(await readFile(join(root,'configs/starters/companion-plugin.json'),'utf8')).generator.document;
let input = evidence?.input;
if(boundary || provider){const base=await selfProject(),document=boundary?boundaryProject(base):providerProject(base);input=join(vault,'boundary-project.json');await writeFile(input,JSON.stringify(document,null,2));}
else if(!input){input=join(vault,'companion-project.json');await writeFile(input,JSON.stringify(await selfProject(),null,2)+'\n');}
const options = { input, vault, target: boundary ? 'boundary-companion' : provider ? 'provider-companion' : 'companion' };
const result = await planProject(options); await writeFile(join(output, 'plan.json'), JSON.stringify(reviewProject(result), null, 2));
await applyProject(result, result.hash); const target = join(vault, options.target);
await writeFile(join(output, 'target.txt'), target);
if (evidence) { await writeFile(join(output,'input.json'),await readFile(input)); await writeFile(join(output,'input-evidence.json'),JSON.stringify(evidence,null,2)); }
const checks = [];
for (const [name, args] of [ ['install', ['ci', '--no-fund']], ['project', ['run', 'verify:project']], ...(authoring ? [['clickdummy',['run','build:clickdummy']]] : []) ]) {
  const run = spawnSync(process.execPath, [resolve(npm), ...args], { cwd: target, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  await writeFile(join(output, name + '.log'), (run.stdout ?? '') + (run.stderr ?? ''));
  checks.push({ name, status: run.status, error: run.error?.message });
  await writeFile(join(output, 'checks.json'), JSON.stringify(checks, null, 2));
  if (run.status !== 0 || run.error) throw new Error('QUALIFICATION_FAILED: ' + name + '\n' + (run.stdout ?? '') + (run.stderr ?? ''));
}
if (authoring) { await writeFile(join(output,'clickdummy.html'),await readFile(join(target,'clickdummy.html'))); await writeFile(join(output,'generated-project.json'),await readFile(join(target,'design/project.json'))); }
const trace = JSON.parse(await readFile(join(target, 'design/traceability.json'), 'utf8'));
await writeFile(join(output, 'summary.json'), JSON.stringify({ status: 'scaffold-qualified', planHash: result.hash, ...result.summary, requirementAcceptance: 'not-implemented', pendingRequirements: trace.requirements.length, nativeAcceptance: 'not-run' }, null, 2));
console.log(JSON.stringify({ status: 'scaffold-qualified', target, output }));
