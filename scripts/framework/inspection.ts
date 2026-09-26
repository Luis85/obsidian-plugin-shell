import { parseDesignData } from '../contracts/json-data.mjs';
import { join, dirname, resolve } from 'node:path';
import { exists, readJson, readConfiguration, readBounded, hash } from './files.ts';
import { object } from './configuration.ts';
import { requireThat, result, type Context, type Diagnostic } from './contracts.ts';
/** A generated project continues with its own npm scripts, not the shell's setup flow. */
function generatedNext(dependencies: boolean, designStale: boolean | null): string {
  return designStale ? 'generate' : !dependencies ? 'npm ci' : 'npm run check';
}
export async function status(context: Context, command = 'status') {
  const config = await readConfiguration(context.root);
  const manifest = await exists(join(context.root, 'manifest.json')) ? object(await readJson(join(context.root, 'manifest.json'))) : null;
  const generated = await exists(join(context.root, '.companion/generation.json'));
  const dependencies = await exists(join(context.root, 'node_modules/typescript/package.json'));
  const imported = await exists(join(context.root, 'design/project.json'));
  const diagnostics: Diagnostic[] = [];
  // A generated project's identity authority is its manifest; shell.config.json is optional there.
  if (!config && !generated) diagnostics.push({ code: 'CONFIG_MISSING', message: 'Project has not been configured.', next: 'setup' });
  if (config && generated && (manifest?.id !== config.project.id || manifest?.version !== config.project.version)) diagnostics.push({ code: 'IDENTITY_DRIFT', message: 'Manifest and configured plugin identity/version differ.' });
  if (!dependencies) diagnostics.push({ code: 'DEPENDENCIES_MISSING', message: 'Project dependencies are not installed.', next: generated ? 'npm ci' : 'install --yes' });
  if (Number(process.versions.node.split('.')[0]) < 22) diagnostics.push({ code: 'NODE_UNSUPPORTED', message: 'Node 22 or newer is required.' });
  let designStale: boolean | null = null;
  if (generated && imported) {
    const receipt = object(await readJson(join(context.root, '.companion/generation.json')));
    designStale = receipt.inputHash !== hash(await readBounded(join(context.root, 'design/project.json'), 4_000_000));
    if (designStale) diagnostics.push({ code: 'DESIGN_GENERATION_STALE', message: 'The accepted design changed after generation.', next: 'generate --dry-run' });
  }
  if (command === 'doctor' && await exists(join(context.frameworkRoot, '.nvmrc'))) {
    const qualified = (await readBounded(join(context.frameworkRoot, '.nvmrc'))).toString('utf8').trim();
    if (qualified !== process.versions.node) diagnostics.push({ code: 'NODE_UNQUALIFIED', message: `Current Node ${process.versions.node}; the recorded qualification baseline is ${qualified}.`, next: 'Use the project-qualified toolchain before release verification.' });
  }
  let obligations: number | null = null;
  if (await exists(join(context.root, 'design/traceability.json'))) {
    const bytes = await readBounded(join(context.root, 'design/traceability.json'), 4_000_000);
    const trace = object(parseDesignData(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (Array.isArray(trace.requirements)) obligations = trace.requirements.filter(item => object(item).verification !== 'verified').length;
    if (obligations) diagnostics.push({ code: 'ACCEPTANCE_PENDING', message: `${obligations} generated requirements are not accepted. Scaffold tests do not prove their behavior.` });
  }
  return { ...result(command, { root: context.root, configuration: config, manifest, generated, imported, dependencies,
    designStale, acceptanceObligations: obligations, runtime: 'not-connected', next: generated ? generatedNext(dependencies, designStale) : !config ? 'setup' : !imported ? 'project import' : 'generate',
    identityAuthority: generated ? 'manifest.json' : 'shell.config.json', native: 'not-run', publication: 'not-authorized' }), diagnostics };
}
export async function releaseCheck(context: Context, input?: string) {
  const overview = await status(context, 'release check');
  const errors = [...overview.diagnostics];
  const source = await exists(join(context.root, 'manifest.json')) ? object(await readJson(join(context.root, 'manifest.json'))) : null;
  const built = await exists(join(context.root, 'dist/manifest.json')) ? object(await readJson(join(context.root, 'dist/manifest.json'))) : null;
  if (!built || !source || built.id !== source.id || built.version !== source.version) errors.push({ code: 'BUILD_IDENTITY', message: 'Build and source identity/version must match.' });
  for (const asset of ['main.js', 'manifest.json']) if (!await exists(join(context.root, 'dist', asset))) errors.push({ code: 'ASSET_MISSING', message: `Missing ${asset}.` });
  if (input) {
    const path = resolve(context.root, input), request = object(await readJson(path));
    requireThat(typeof request.candidateDirectory === 'string', 'CANDIDATE_REQUIRED', 'Supply a retained candidate directory in the release-plan input.');
    const { planReleaseOperation } = await import('../release/promotion-plan.mjs');
    const plan = await planReleaseOperation({ candidateDirectory: resolve(dirname(path), request.candidateDirectory), commit: request.commit, version: request.version, mode: request.mode, remote: request.remote, acceptance: request.acceptance, review: request.review, platforms: request.platforms, now: new Date() });
    return { ...overview, data: { inspection: overview.data, plan, publication: 'not-authorized', generationObligations: 'require independent acceptance review; metadata is not proof' }, status: errors.length ? 'blocked' as const : 'ok' as const, diagnostics: errors };
  }
  errors.push({ code: 'RELEASE_EVIDENCE_REQUIRED', message: 'A fixed-source rehearsal, required native evidence and separate candidate authorization are required before publication.', next: 'release rehearse' });
  return { ...overview, status: 'blocked' as const, diagnostics: errors };
}
