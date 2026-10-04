import { parseDesignData } from '../../../scripts/contracts/json-data.ts';
import { join, dirname, resolve } from 'node:path';
import { exists, readJson, readConfiguration, readBounded, hash } from './files.ts';
import { object } from './configuration.ts';
import { requireThat, result, type Context, type Diagnostic } from './contracts.ts';
import { parseAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { projectHosting } from '../../../scripts/companion/schema/hosting.mjs';
import { azureDiagnostics, probeAzureCli, type AzureProbe } from './hosting-cli.ts';
/** A generated project continues with its own npm scripts, not the shell's setup flow. */
function generatedNext(dependencies: boolean, designStale: boolean | null): string {
  return designStale ? 'generate' : !dependencies ? 'npm ci' : 'npm run check';
}
async function optionalJson(context: Context, path: string): Promise<Record<string, unknown> | null> {
  return await exists(join(context.root, path)) ? object(await readJson(join(context.root, path))) : null;
}
interface Facts { config: Awaited<ReturnType<typeof readConfiguration>>; manifest: Record<string, unknown> | null; generated: boolean; dependencies: boolean; imported: boolean }
function identityDrift(config: Facts['config'], manifest: Facts['manifest'], generated: boolean): boolean {
  if (!config || !generated) return false;
  return manifest?.id !== config.project.id || manifest?.version !== config.project.version;
}
function identityDiagnostics({ config, manifest, generated, dependencies }: Facts): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // A generated project's identity authority is its manifest; shell.config.json is optional there.
  if (!config && !generated) diagnostics.push({ code: 'CONFIG_MISSING', message: 'Project has not been configured.', next: 'setup' });
  if (identityDrift(config, manifest, generated)) diagnostics.push({ code: 'IDENTITY_DRIFT', message: 'Manifest and configured plugin identity/version differ.' });
  if (!dependencies) diagnostics.push({ code: 'DEPENDENCIES_MISSING', message: 'Project dependencies are not installed.', next: generated ? 'npm ci' : 'install --yes' });
  if (Number(process.versions.node.split('.')[0]) < 22) diagnostics.push({ code: 'NODE_UNSUPPORTED', message: 'Node 22 or newer is required.' });
  return diagnostics;
}
/** Null when there is no generated design to compare; otherwise whether the design changed after generation. */
async function designStaleness(context: Context, facts: Facts, diagnostics: Diagnostic[]): Promise<boolean | null> {
  if (!facts.generated || !facts.imported) return null;
  const receipt = object(await readJson(join(context.root, '.companion/generation.json')));
  const stale = receipt.inputHash !== hash(await readBounded(join(context.root, 'design/project.json'), 4_000_000));
  if (stale) diagnostics.push({ code: 'DESIGN_GENERATION_STALE', message: 'The accepted design changed after generation.', next: 'generate --dry-run' });
  return stale;
}
async function toolchainDiagnostics(context: Context, command: string, diagnostics: Diagnostic[]): Promise<void> {
  if (command !== 'doctor' || !await exists(join(context.frameworkRoot, '.nvmrc'))) return;
  const qualified = (await readBounded(join(context.frameworkRoot, '.nvmrc'))).toString('utf8').trim();
  if (qualified !== process.versions.node) diagnostics.push({ code: 'NODE_UNQUALIFIED', message: `Current Node ${process.versions.node}; the recorded qualification baseline is ${qualified}.`, next: 'Use the project-qualified toolchain before release verification.' });
}
async function acceptanceObligations(context: Context, diagnostics: Diagnostic[]): Promise<number | null> {
  if (!await exists(join(context.root, 'design/traceability.json'))) return null;
  const bytes = await readBounded(join(context.root, 'design/traceability.json'), 4_000_000);
  const trace = object(parseDesignData(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const obligations = Array.isArray(trace.requirements) ? trace.requirements.filter(item => object(item).verification !== 'verified').length : null;
  if (obligations) diagnostics.push({ code: 'ACCEPTANCE_PENDING', message: `${obligations} generated requirements are not accepted. Scaffold tests do not prove their behavior.` });
  return obligations;
}
/** The design's hosting platform; doctor also probes the az CLI (read-only) for an Azure DevOps project. */
async function hostingFacts(context: Context, command: string, diagnostics: Diagnostic[], probe: AzureProbe) {
  if (!await exists(join(context.root, 'design/project.json'))) return null;
  let hosting;
  try { hosting = projectHosting(parseAuthoringDocument((await readBounded(join(context.root, 'design/project.json'), 4_000_000)).toString('utf8'))); }
  catch { return null; }
  const platform = hosting?.platform ?? 'github';
  if (command !== 'doctor' || platform !== 'azure-devops') return { platform, configured: hosting !== undefined };
  const azureCli = await probe();
  diagnostics.push(...azureDiagnostics(azureCli));
  return { platform, configured: true, azureCli };
}
function nextStep({ config, generated, dependencies, imported }: Facts, designStale: boolean | null): string {
  if (generated) return generatedNext(dependencies, designStale);
  if (!config) return 'setup';
  return imported ? 'generate' : 'project import';
}
export async function status(context: Context, command = 'status', probe: AzureProbe = probeAzureCli) {
  const facts: Facts = {
    config: await readConfiguration(context.root),
    manifest: await optionalJson(context, 'manifest.json'),
    generated: await exists(join(context.root, '.companion/generation.json')),
    dependencies: await exists(join(context.root, 'node_modules/typescript/package.json')),
    imported: await exists(join(context.root, 'design/project.json')),
  };
  const diagnostics = identityDiagnostics(facts);
  const designStale = await designStaleness(context, facts, diagnostics);
  await toolchainDiagnostics(context, command, diagnostics);
  const obligations = await acceptanceObligations(context, diagnostics);
  const hosting = await hostingFacts(context, command, diagnostics, probe);
  const { config, manifest, generated, imported, dependencies } = facts;
  return { ...result(command, { root: context.root, configuration: config, manifest, generated, imported, dependencies,
    designStale, acceptanceObligations: obligations, hosting, runtime: 'not-connected', next: nextStep(facts, designStale),
    identityAuthority: generated ? 'manifest.json' : 'shell.config.json', native: 'not-run', publication: 'not-authorized' }), diagnostics };
}
async function buildDiagnostics(context: Context): Promise<Diagnostic[]> {
  const errors: Diagnostic[] = [];
  const source = await optionalJson(context, 'manifest.json'), built = await optionalJson(context, 'dist/manifest.json');
  if (!built || !source || built.id !== source.id || built.version !== source.version) errors.push({ code: 'BUILD_IDENTITY', message: 'Build and source identity/version must match.' });
  for (const asset of ['main.js', 'manifest.json']) if (!await exists(join(context.root, 'dist', asset))) errors.push({ code: 'ASSET_MISSING', message: `Missing ${asset}.` });
  return errors;
}
/** A read-only promotion plan for a retained candidate; it never authorizes publication. */
async function releasePlan(context: Context, input: string) {
  const path = resolve(context.root, input), request = object(await readJson(path));
  requireThat(typeof request.candidateDirectory === 'string', 'CANDIDATE_REQUIRED', 'Supply a retained candidate directory in the release-plan input.');
  const { planReleaseOperation } = await import('../../../scripts/release/promotion-plan.mjs');
  return planReleaseOperation({ candidateDirectory: resolve(dirname(path), request.candidateDirectory), commit: request.commit, version: request.version, mode: request.mode, remote: request.remote, acceptance: request.acceptance, review: request.review, platforms: request.platforms, now: new Date() });
}
export async function releaseCheck(context: Context, input?: string) {
  const overview = await status(context, 'release check');
  const errors = [...overview.diagnostics];
  errors.push(...await buildDiagnostics(context));
  if (input) {
    const plan = await releasePlan(context, input);
    return { ...overview, data: { inspection: overview.data, plan, publication: 'not-authorized', generationObligations: 'require independent acceptance review; metadata is not proof' }, status: errors.length ? 'blocked' as const : 'ok' as const, diagnostics: errors };
  }
  errors.push({ code: 'RELEASE_EVIDENCE_REQUIRED', message: 'A fixed-source rehearsal, required native evidence and separate candidate authorization are required before publication.', next: 'release rehearse' });
  return { ...overview, status: 'blocked' as const, diagnostics: errors };
}
