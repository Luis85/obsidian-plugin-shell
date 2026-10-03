import { join, resolve } from 'node:path';
import { parseAuthoringDocument, migrateAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { configuration } from '../../adapters/framework/configuration.ts';
import { keyOf, docsObject as object, insist, validateEntity, jsonData, type DocsIndex, type Entity, type Resolutions } from '../domain/contracts.ts';
import { readDocumentationSettings, validateSettings, type DocsSettings } from './settings.ts';
import { readBytes, decode, discover, localPath, portable, type DocumentationSource as Source } from './filesystem.ts';
import { parseMarkdown, type MarkdownDocument } from './markdown.ts';
export interface InputDocument { source: Source; document: MarkdownDocument }
type Configuration = ReturnType<typeof configuration>;
const DIGEST = /^[a-f0-9]{64}$/;
function readNavigation(value: unknown): Record<string, string> {
  const navigation: Record<string, string> = {};
  for (const [path, digest] of Object.entries(object(value))) {
    portable(path); insist(typeof digest === 'string' && DIGEST.test(digest), 'DOCS_INDEX', 'Invalid navigation digest.'); navigation[path] = digest;
  }
  return navigation;
}
function readBinding(index: DocsIndex, key: string, input: unknown, boundPaths: Set<string>, config: Configuration | null): void {
  const item = object(input), baseline = object(item.baseline) as unknown as Entity; validateEntity(baseline);
  insist(keyOf(baseline) === key && baseline.project === index.project && typeof item.path === 'string', 'DOCS_INDEX', 'Invalid documentation binding.');
  portable(item.path);
  insist(!boundPaths.has(item.path.toLowerCase()), 'DOCS_INDEX', 'Multiple identities are bound to the same documentation path.');
  boundPaths.add(item.path.toLowerCase());
  insist(/\.md$/i.test(item.path) && !item.path.split('/').some(part => part.startsWith('.')), 'DOCS_INDEX', 'Bindings must point to Markdown outside hidden directories.');
  validateSettings({ root: item.path }, config ? Object.values(config.paths) : []);
  insist(item.generatedHash === null || typeof item.generatedHash === 'string' && DIGEST.test(item.generatedHash), 'DOCS_INDEX', 'Invalid generated-region digest.');
  index.entries[key] = { path: item.path, baseline, generatedHash: item.generatedHash };
}
function readIndex(indexBytes: Buffer | null, project: string, config: Configuration | null): DocsIndex {
  const index: DocsIndex = { schemaVersion: 1, project, entries: {} };
  if (!indexBytes) return index;
  const raw: unknown = JSON.parse(decode(indexBytes)); jsonData(raw);
  const record = object(raw); insist(record.schemaVersion === 1 && record.project === project, 'DOCS_INDEX', 'Invalid or wrong-project documentation index.');
  if (record.navigation !== undefined) index.navigation = readNavigation(record.navigation);
  const boundPaths = new Set<string>();
  for (const [key, input] of Object.entries(object(record.entries))) readBinding(index, key, input, boundPaths, config);
  return index;
}
function readResolutions(resolutionBytes: Buffer | null): Resolutions {
  const resolutions: Resolutions = {};
  if (resolutionBytes) for (const [key, value] of Object.entries(object(JSON.parse(decode(resolutionBytes))))) {
    insist(value === 'markdown' || value === 'project', 'DOCS_RESOLUTIONS', 'Resolution values must be markdown or project.'); resolutions[key] = value;
  }
  return resolutions;
}
function parseDocuments(root: string, sources: Source[]) {
  const documents: InputDocument[] = [], skipped: string[] = [];
  for (const source of sources) {
    if (!/\.md$/i.test(source.path)) continue;
    const name = localPath(root, source.path) ?? source.relative, document = parseMarkdown(decode(source.bytes), name);
    if (document) documents.push({ source, document }); else skipped.push(name);
  }
  return { documents, skipped };
}
async function scanRoots(root: string, args: string[], settings: DocsSettings, index: DocsIndex): Promise<string[]> {
  const roots = args.length ? args.map(path => resolve(root, path)) : [settings.root, ...Object.values(settings.paths)].map(path => join(root, path));
  for (const path of args) insist(await readBytesOrDirectory(resolve(root, path)), 'DOCS_INPUT_MISSING', 'Selected input is missing: ' + path);
  // Bindings may be outside the current default root; include them only for whole-workspace operations.
  if (!args.length) roots.push(...Object.values(index.entries).map(binding => join(root, binding.path)));
  return roots;
}
const protectedFolders = (config: Configuration | null): string[] => config ? [config.paths.codebaseFolder, config.paths.testsFolder, config.paths.testVaultFolder] : [];
export async function readWorkspace(root: string, args: string[], output?: string, resolutionFile?: string) {
  const configBytes = await readBytes(join(root, 'shell.config.json'));
  const config = configBytes ? configuration(JSON.parse(decode(configBytes))) : null;
  const settingsRead = await readDocumentationSettings(root, protectedFolders(config), output);
  const { settings, projectPath } = settingsRead;
  const projectBytes = await readBytes(join(root, projectPath)); insist(projectBytes, 'DOCS_PROJECT_REQUIRED', 'Run setup or project import first.');
  const project = migrateAuthoringDocument(parseAuthoringDocument(decode(projectBytes))).document;
  const makerSetupBytes = config ? null : await readBytes(join(root, 'configs/project-setup.json'));
  const indexBytes = await readBytes(join(root, settings.indexFile), 16_000_000);
  const index = readIndex(indexBytes, project.project.id, config);
  const sources = await discover(await scanRoots(root, args, settings, index), settings);
  const { documents, skipped } = parseDocuments(root, sources);
  const resolutionBytes = resolutionFile ? await readBytes(resolve(root, resolutionFile)) : null;
  insist(!resolutionFile || resolutionBytes, 'DOCS_RESOLUTIONS', 'Resolution file is missing.');
  const resolutions = readResolutions(resolutionBytes);
  return { root, project, projectBytes, makerSetupBytes, config, configBytes, ...settingsRead, index, indexBytes, sources, documents, skipped, resolutions, resolutionBytes };
}
async function readBytesOrDirectory(path: string): Promise<boolean> {
  const { safePath } = await import('./filesystem.ts'); return safePath(path);
}
export type Workspace = Awaited<ReturnType<typeof readWorkspace>>;
