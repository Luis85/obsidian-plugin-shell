import { join, resolve } from 'node:path';
import { parseAuthoringDocument, migrateAuthoringDocument } from '../../companion/authoring-contract.ts';
import { configuration } from '../../framework/configuration.ts';
import { keyOf, docsObject as object, insist, validateEntity, jsonData, type DocsIndex, type Entity, type Resolutions } from '../domain/contracts.ts';
import { readSettings, validateSettings } from './settings.ts';
import { readBytes, decode, discover, localPath, portable, type DocumentationSource as Source } from './filesystem.ts';
import { parseMarkdown, type MarkdownDocument } from './markdown.ts';
export interface InputDocument { source: Source; document: MarkdownDocument }
export async function readWorkspace(root: string, args: string[], output?: string, resolutionFile?: string) {
  const projectBytes = await readBytes(join(root, 'design/project.json')); insist(projectBytes, 'DOCS_PROJECT_REQUIRED', 'Run setup or project import first.');
  const project = migrateAuthoringDocument(parseAuthoringDocument(decode(projectBytes))).document;
  const configBytes = await readBytes(join(root, 'shell.config.json'));
  const config = configBytes ? configuration(JSON.parse(decode(configBytes))) : null;
  const settingsRead = await readSettings(root, config ? [config.paths.codebaseFolder, config.paths.testsFolder, config.paths.testVaultFolder] : [] , output);
  const { settings } = settingsRead;
  const indexBytes = await readBytes(join(root, settings.indexFile), 16_000_000);
  let index: DocsIndex = { schemaVersion: 1, project: project.project.id, entries: {} };
  if (indexBytes) {
    const raw: unknown = JSON.parse(decode(indexBytes)); jsonData(raw);
    const record = object(raw); insist(record.schemaVersion === 1 && record.project === project.project.id, 'DOCS_INDEX', 'Invalid or wrong-project documentation index.');
    index = { schemaVersion: 1, project: project.project.id, entries: {} };
    if (record.navigation !== undefined) {
      index.navigation = {};
      for (const [path, value] of Object.entries(object(record.navigation))) {
        portable(path); insist(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'DOCS_INDEX', 'Invalid navigation digest.'); index.navigation[path] = value;
      }
    }
    const boundPaths = new Set<string>();
    for (const [key, input] of Object.entries(object(record.entries))) {
      const item = object(input), baseline = object(item.baseline) as unknown as Entity; validateEntity(baseline);
      insist(keyOf(baseline) === key && baseline.project === index.project && typeof item.path === 'string', 'DOCS_INDEX', 'Invalid documentation binding.');
      portable(item.path);
      insist(!boundPaths.has(item.path.toLowerCase()), 'DOCS_INDEX', 'Multiple identities are bound to the same documentation path.');
      boundPaths.add(item.path.toLowerCase());
      insist(/\.md$/i.test(item.path) && !item.path.split('/').some(part => part.startsWith('.')), 'DOCS_INDEX', 'Bindings must point to Markdown outside hidden directories.');
      validateSettings({ root: item.path }, config ? Object.values(config.paths) : []);
      insist(item.generatedHash === null || typeof item.generatedHash === 'string' && /^[a-f0-9]{64}$/.test(item.generatedHash), 'DOCS_INDEX', 'Invalid generated-region digest.');
      index.entries[key] = { path: item.path, baseline, generatedHash: item.generatedHash };
    }
  }
  const roots = args.length ? args.map(path => resolve(root, path)) : [settings.root, ...Object.values(settings.paths)].map(path => join(root, path));
  for (const path of args) insist(await readBytesOrDirectory(resolve(root, path)), 'DOCS_INPUT_MISSING', 'Selected input is missing: ' + path);
  // Bindings may be outside the current default root; include them only for whole-workspace operations.
  if (!args.length) roots.push(...Object.values(index.entries).map(binding => join(root, binding.path)));
  const sources = await discover(roots, settings), documents: InputDocument[] = [], skipped: string[] = [];
  for (const source of sources) {
    if (!/\.md$/i.test(source.path)) continue;
    const document = parseMarkdown(decode(source.bytes), localPath(root, source.path) ?? source.relative);
    if (document) documents.push({ source, document }); else skipped.push(localPath(root, source.path) ?? source.relative);
  }
  const resolutionBytes = resolutionFile ? await readBytes(resolve(root, resolutionFile)) : null;
  insist(!resolutionFile || resolutionBytes, 'DOCS_RESOLUTIONS', 'Resolution file is missing.');
  const resolutions: Resolutions = {};
  if (resolutionBytes) for (const [key, value] of Object.entries(object(JSON.parse(decode(resolutionBytes))))) {
    insist(value === 'markdown' || value === 'project', 'DOCS_RESOLUTIONS', 'Resolution values must be markdown or project.'); resolutions[key] = value;
  }
  return { root, project, projectBytes, config, configBytes, ...settingsRead, index, indexBytes, sources, documents, skipped, resolutions, resolutionBytes };
}
async function readBytesOrDirectory(path: string): Promise<boolean> {
  const { safePath } = await import('./filesystem.ts'); return safePath(path);
}
export type Workspace = Awaited<ReturnType<typeof readWorkspace>>;
