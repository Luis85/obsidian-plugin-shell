import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { HANDOUT_LIMIT, HANDOUT_PATH, HandoutError, digest, ensure, makeSnapshot, readSnapshot, renderHandout, refreshHandout, validateHandout, type SourceFile, type Suggestion } from './handout-model.ts';
import { statIfPresent } from '../../../scripts/shared/fs-presence.ts';

const CONFIGURATION_FILES = ['configs/user-settings.json', 'shell.config.json'];
const MAX_SOURCE_BYTES = 16_000_000;
const MAX_FILE_BYTES = 1_000_000;
const forbidden = new Set(['.git', '.obsidian', '.framework', '.companion', '.dev-vault', '.test-vault', 'node_modules']);
export interface WorkspaceOptions { prds?: string; virtualFiles?: Record<string, string> }
export function portablePath(path: string): string {
  ensure(typeof path === 'string' && path.length > 0 && path.length <= 1024 && !isAbsolute(path) && !/[\\:\u0000-\u001f]/.test(path), 'HANDOUT_PATH', 'Use a bounded project-relative path with forward slashes.');
  ensure(path.split('/').every(part => part !== '' && part !== '.' && part !== '..' && !forbidden.has(part.toLowerCase())), 'HANDOUT_PATH', 'The PRD path must stay inside the project and outside protected folders.');
  return path;
}
async function localRoot(root: string): Promise<string> {
  const absolute = resolve(root);
  const stat = await lstat(absolute);
  ensure(stat.isDirectory() && !stat.isSymbolicLink(), 'HANDOUT_ROOT', 'Select a real project directory, not a symlink.');
  // Resolve ancestors as well; root is explicitly selected, but descendants may never escape it.
  return realpath(absolute);
}
async function inspectLocalPath(root: string, path: string) {
  portablePath(path);
  let parent = root;
  for (const [index, part] of path.split('/').entries()) {
    parent = join(parent, part);
    const stat = await statIfPresent(parent);
    if (!stat) return null;
    ensure(!stat.isSymbolicLink(), 'HANDOUT_SYMLINK', 'Refusing a symlink in a handout input or output path.');
    if (index < path.split('/').length - 1) ensure(stat.isDirectory(), 'HANDOUT_PATH', 'A path ancestor is not a directory.');
    else return stat;
  }
  return null;
}
async function readLocal(root: string, path: string, limit: number): Promise<string | null> {
  const stat = await inspectLocalPath(root, path);
  if (!stat) return null;
  ensure(stat.isFile() && stat.size <= limit, 'HANDOUT_INPUT_LIMIT', 'Input is not a regular bounded file.');
  const bytes = await readFile(join(root, path));
  ensure(bytes.length <= limit && !bytes.includes(0), 'HANDOUT_INPUT_LIMIT', 'Input exceeds its bound or contains binary data.');
  // Decode strictly; replacement characters would conceal a changed source.
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new HandoutError('HANDOUT_ENCODING', 'Input must be UTF-8 text.'); }
}
function object(text: string | null): Record<string, unknown> {
  if (text === null) return {};
  let value;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new HandoutError('HANDOUT_SETTINGS_JSON', 'Settings input is not valid JSON; original files were preserved.'); }
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'HANDOUT_SETTINGS_JSON', 'Settings input must be a JSON object.');
  return value;
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  ensure(typeof value === 'string' && value.length <= 4096, 'HANDOUT_SETTINGS_VALUE', `Expected a bounded string for ${name}.`);
  return value;
}
export async function loadHandoutWorkspace(root: string, options: WorkspaceOptions = {}) {
  const local = await localRoot(root), files: SourceFile[] = [], configTexts: Record<string, string | null> = {};
  let totalBytes = 0;
  for (const path of CONFIGURATION_FILES) {
    const virtual = options.virtualFiles?.[path];
    ensure(virtual === undefined || Buffer.byteLength(virtual) <= MAX_FILE_BYTES, 'HANDOUT_INPUT_LIMIT', 'Proposed settings exceed the input limit.');
    // Even virtual setup input must not mask a symlink in the eventual destination.
    await inspectLocalPath(local, path);
    const text = virtual ?? await readLocal(local, path, MAX_FILE_BYTES);
    configTexts[path] = text;
    files.push({ path, sha256: text === null ? null : digest(text) });
    totalBytes += text === null ? 0 : Buffer.byteLength(text);
  }
  ensure(Object.keys(options.virtualFiles ?? {}).every(path => CONFIGURATION_FILES.includes(path)), 'HANDOUT_VIRTUAL_INPUT', 'Only reviewed configuration entries may be supplied as virtual inputs.');
  const settings = object(configTexts['configs/user-settings.json'] ?? null), legacy = object(configTexts['shell.config.json'] ?? null);
  const configuredPaths = record(settings.paths), legacyPaths = record(legacy.paths);
  const prdsRoot = portablePath(options.prds ?? optionalString(configuredPaths.prds, 'paths.prds') ?? 'docs/prds');
  let visited = 0, prdCount = 0;
  async function walk(path: string, depth: number): Promise<void> {
    ensure(depth <= 16, 'HANDOUT_INPUT_LIMIT', 'PRD folder nesting exceeds its limit.');
    const stat = await inspectLocalPath(local, path);
    if (!stat) return;
    ensure(stat.isDirectory(), 'HANDOUT_PRD_FOLDER', 'The PRD input must be a folder.');
    const names = (await readdir(join(local, path))).sort();
    for (const name of names) {
      ensure(++visited <= 5000, 'HANDOUT_INPUT_LIMIT', 'Too many entries in the PRD folder.');
      const relative = portablePath(path + '/' + name), child = await inspectLocalPath(local, relative);
      ensure(child, 'HANDOUT_SOURCE_CHANGED', 'PRD input changed while reading; try again after edits stop.');
      if (child.isDirectory()) await walk(relative, depth + 1);
      else if (name.toLowerCase().endsWith('.md')) {
        ensure(++prdCount <= 500, 'HANDOUT_INPUT_LIMIT', 'More than 500 PRD files; select a narrower folder.');
        const text = await readLocal(local, relative, MAX_FILE_BYTES);
        ensure(text !== null, 'HANDOUT_SOURCE_CHANGED', 'PRD input was removed while reading.');
        totalBytes += Buffer.byteLength(text);
        ensure(totalBytes <= MAX_SOURCE_BYTES, 'HANDOUT_INPUT_LIMIT', 'PRD input exceeds the aggregate size limit.');
        files.push({ path: relative, sha256: digest(text) });
      }
    }
  }
  await walk(prdsRoot, 0);
  const suggestions: Record<string, Suggestion> = {};
  const observed = files.filter(file => file.path.toLowerCase().endsWith('.md'));
  if (observed.length) suggestions['sources.prds'] = {
    answer: observed.map(file => file.path).join('; ') + '. Review which requirement IDs and sections form the authoritative prototype scope.',
    evidence: `Observed local Markdown file inventory under ${prdsRoot}; confirm relevance with the trio.`,
  };
  const project = record(legacy.project);
  const identity = ['name', 'id', 'author', 'description'].flatMap(key => {
    const value = optionalString(project[key], 'project.' + key);
    return value ? [key + '=' + value] : [];
  });
  if (identity.length) suggestions['product.identity'] = { answer: identity.join('; '), evidence: 'Observed shell.config.json project fields; confirm these identify the product being prototyped.' };
  const pathDefaults: Record<string, string> = {
    prds: prdsRoot, docs: 'docs', pages: 'docs/pages', components: 'docs/components', interactions: 'docs/interactions', journeys: 'docs/journeys',
    design: 'design/project.json', source: optionalString(legacyPaths.codebaseFolder, 'codebaseFolder') ?? 'src',
    tests: optionalString(legacyPaths.testsFolder, 'testsFolder') ?? 'tests', assets: 'assets', fixtures: 'tests/fixtures', reports: 'reports',
    starters: 'configs/starters', prototype: 'prototype',
    testVault: optionalString(legacyPaths.testVaultFolder, 'testVaultFolder') ?? '.test-vault',
    obsidianConfig: optionalString(legacyPaths.configDirectory, 'configDirectory') ?? '.obsidian',
  };
  for (const key of Object.keys(pathDefaults)) {
    const value = optionalString(configuredPaths[key], 'paths.' + key);
    if (value !== undefined) pathDefaults[key] = ['testVault', 'obsidianConfig'].includes(key) ? value : portablePath(value);
  }
  pathDefaults.prds = prdsRoot;
  suggestions['setup.paths'] = {
    answer: 'handout=PROJECT-SETUP-HANDOUT.md; settings=configs/user-settings.json; ' + Object.entries(pathDefaults).map(([key, value]) => key + '=' + value).join('; '),
    evidence: 'Handout path defaults plus observed configs/user-settings.json and legacy shell.config.json, where present. Confirm support and output ownership against the installed shell.',
  };
  const firstRun = optionalString(record(settings.preferences).firstRun, 'preferences.firstRun');
  if (firstRun !== undefined) {
    ensure(['skip', 'verify', 'showcase'].includes(firstRun), 'HANDOUT_RUN_MODE', 'preferences.firstRun must be skip, verify or showcase.');
    suggestions['run.mode'] = { answer: firstRun, evidence: 'Observed configs/user-settings.json preferences.firstRun; this preference is not execution authorization.' };
  }
  return { root: local, snapshot: makeSnapshot(prdsRoot, files, options.prds !== undefined), suggestions, prdCount };
}
async function readHandout(root: string): Promise<string | null> {
  return readLocal(await localRoot(root), HANDOUT_PATH, HANDOUT_LIMIT);
}
/** Pure preparation: returned entries participate in the caller's reviewed file plan. */
export async function prepareHandout(root: string, options: WorkspaceOptions = {}) {
  const previous = await readHandout(root);
  if (previous !== null) return { entries: [] as { path: string; content: string }[], summary: { path: HANDOUT_PATH, action: 'preserved', execution: 'not-run' } };
  const workspace = await loadHandoutWorkspace(root, options);
  return {
    entries: [{ path: HANDOUT_PATH, content: renderHandout(workspace.snapshot, workspace.suggestions) }],
    summary: { path: HANDOUT_PATH, action: 'create', prds: workspace.prdCount, sourceFingerprint: workspace.snapshot.fingerprint, execution: 'not-run' },
  };
}
export async function prepareHandoutRefresh(root: string, options: WorkspaceOptions = {}) {
  const text = await readHandout(root);
  ensure(text !== null, 'HANDOUT_MISSING', 'Generate the root handout before refreshing it.');
  const previous = readSnapshot(text);
  const workspace = await loadHandoutWorkspace(root, { ...options, prds: options.prds ?? (previous.prdsMode === 'explicit' ? previous.prdsRoot : undefined) });
  const content = refreshHandout(text, workspace.snapshot);
  return { entries: [{ path: HANDOUT_PATH, content }], summary: { path: HANDOUT_PATH, action: content === text ? 'unchanged' : 'refresh-and-reset-review', answers: 'preserved', execution: 'not-run' } };
}
export async function inspectHandout(root: string, options: WorkspaceOptions = {}) {
  const text = await readHandout(root);
  ensure(text !== null, 'HANDOUT_MISSING', 'Generate PROJECT-SETUP-HANDOUT.md first.');
  const previous = readSnapshot(text);
  const workspace = await loadHandoutWorkspace(root, { ...options, prds: options.prds ?? (previous.prdsMode === 'explicit' ? previous.prdsRoot : undefined) });
  return validateHandout(text, workspace.snapshot);
}
