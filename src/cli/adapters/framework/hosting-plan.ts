/** `hosting show` and `hosting set <github|azure-devops|none>`: read or switch tooling.hosting in design/project.json.
 * The plan creates the new platform's pipeline and pull-request template when absent (from the project's own devkit
 * templates, byte-identical to generation); in a kit setup the next `generate` also refreshes README/AGENTS hints and
 * agent permissions. Files of the previous platform are reported, never deleted: only the user decides to remove them. */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '../../../../scripts/shared/file-plan.ts';
import { parseAuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { classifyRemote, hostingProfile, projectHosting, type HostingProfile } from '../../../../scripts/companion/schema/hosting.mjs';
import { serializeJson as json } from '../../../../scripts/contracts/serialization.ts';
import { readBounded, readJson, exists, hash } from './files.ts';
import { object, designFile, configFile } from './configuration.ts';
import { resolveTemplateRoot } from '../template-root.ts';
import { renderTemplate } from '../../compiler/emitters/devkit-files.ts';
import { receiptEntries, type Entry } from './design-receipts.ts';
import { hostingSummary, withHostingFlags } from './hosting-options.ts';
import { readOriginUrl } from './adopt-git.ts';
import { requireThat, result, type Context, type Request, type Result } from './contracts.ts';
async function readDesign(context: Context) {
  const before = await readBounded(join(context.root, designFile), 4_000_000);
  return { before, document: parseAuthoringDocument(before.toString('utf8')) };
}
const platformPaths = (profile: HostingProfile) => [...profile.reviewFiles, ...profile.ciFiles].map(([path]) => path);
/** Existing files under .github/, bounded; a GitHub project's workflows and actions live there besides its templates. */
async function githubFiles(root: string): Promise<string[]> {
  if (!await exists(join(root, '.github'))) return [];
  const entries = await readdir(join(root, '.github'), { recursive: true, withFileTypes: true });
  return entries.filter(entry => entry.isFile()).slice(0, 500)
    .map(entry => ['.github', ...join(entry.parentPath, entry.name).slice(join(root, '.github').length + 1).split(/[\\/]/)].join('/')).sort();
}
async function generatedHashes(root: string): Promise<Map<string, unknown>> {
  if (!await exists(join(root, '.companion/generation.json'))) return new Map();
  const files = object(await readJson(join(root, '.companion/generation.json'))).files;
  return new Map((Array.isArray(files) ? files : []).map(object).map(record => [String(record.path), record.hash]));
}
/** Files of the previous platform that the new one does not emit, with whether they still match generation. */
async function retiredFiles(root: string, previous: HostingProfile, next: HostingProfile) {
  const keep = new Set(platformPaths(next));
  const candidates = new Set([...platformPaths(previous), ...(previous.platform === 'github' && next.platform !== 'github' ? await githubFiles(root) : [])]);
  const generated = await generatedHashes(root), retired = [];
  for (const path of [...candidates].filter(path => !keep.has(path)).sort()) {
    if (!await exists(join(root, path))) continue;
    const owned = generated.get(path);
    const state = owned === undefined ? 'not-generated' : owned === hash(await readBounded(join(root, path), 8_000_000)) ? 'generated-unchanged' : 'edited';
    retired.push({ path, state });
  }
  return retired;
}
/** Create-only platform files rendered from the devkit templates; an existing file is preserved and listed. */
async function platformEntries(context: Context, name: string, profile: HostingProfile) {
  const template = join(await resolveTemplateRoot(context.frameworkRoot), 'templates/companion/devkit');
  const entries: Entry[] = [], preserved: string[] = [], unavailable: string[] = [];
  for (const [path, source] of [...profile.reviewFiles, ...profile.ciFiles]) {
    if (await exists(join(context.root, path))) preserved.push(path);
    else if (!await exists(join(template, source))) unavailable.push(path);
    else entries.push({ path, content: renderTemplate((await readBounded(join(template, source))).toString('utf8'), { name }) });
  }
  return { entries, preserved, unavailable };
}
export async function hostingShow(request: Request, context: Context): Promise<Result> {
  const { document } = await readDesign(context);
  const origin = await readOriginUrl(context.root);
  return result(request.command, { ...hostingSummary(document), hosting: projectHosting(document) ?? null,
    originPlatform: origin === null ? null : classifyRemote(origin) ?? 'other', remote: 'not-contacted',
    next: 'hosting set github|azure-devops|none --dry-run' });
}
/** Read-modify-write bound to the current design bytes and both ownership receipts, replayed by the plan executor. */
export async function hostingPlan(request: Request, context: Context) {
  const platform = request.args[0];
  requireThat(platform, 'HOSTING_OPTION_PLATFORM', 'Supply the platform: hosting set github|azure-devops|none.');
  const { before, document: original } = await readDesign(context);
  const next = withHostingFlags(original, request.options, platform);
  const previous = hostingProfile(projectHosting(original)), current = hostingProfile(projectHosting(next));
  const files = await platformEntries(context, original.project.name.replace(/\s+/g, ' ').trim() || original.project.id, current);
  const entries: Entry[] = [{ path: designFile, content: json(next) }, ...files.entries];
  entries.push(...await receiptEntries(context, original.project.id, before, entries, 'HOSTING_OWNERSHIP'));
  const inPlace = await exists(join(context.root, configFile));
  return { plan: await createFilePlan(context.root, entries), conflicts: [] as string[],
    summary: { previous: previous.platform, hosting: hostingSummary(next), created: files.entries.map(entry => entry.path), preserved: files.preserved,
      unavailable: files.unavailable, retired: await retiredFiles(context.root, previous, current),
      deletion: 'none: review the retired files and remove them yourself; edited files are yours to keep',
      remote: 'not-contacted', next: inPlace ? 'generate --dry-run, then generate to refresh README/AGENTS hosting hints and agent permissions'
        : 'Review the README "Hosting and pull requests" section and .claude/settings.json by hand; this project has no in-place generate.' } };
}
