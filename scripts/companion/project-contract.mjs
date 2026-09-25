// Shared by the standalone concept and read-only shell entrypoint. No host I/O.
import { validateStorymaps } from './storymap-contract.mjs';
export const COMPANION_FORMAT = 'obsidian-companion-project';
export const COMPANION_VERSION = 2;
export const COMPANION_MAX_BYTES = 4_000_000;
export const COMPANION_DEFAULT_FOLDERS = Object.freeze({ codebaseFolder: 'src', testsFolder: 'tests' });
const companionDesignKeys = ['schema', 'blueprint', 'goal', 'platform', 'nodes', 'links', 'nextId',
  'library', 'prds', 'librarySchema', 'canvas', 'semantic', 'dataSources', 'designSystem', 'storymaps'];

function companionRequire(condition, message) {
  if (!condition) throw new Error('COMPANION_INVALID: ' + message);
}
function companionObject(value, keys, required = keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key));
}
function companionText(value, limit, nonempty = false) {
  return typeof value === 'string' && value.length <= limit && (!nonempty || value.trim().length > 0);
}

export function companionRelativeFolder(value, allowRoot = false) {
  if (allowRoot && value === '.') return true;
  if (typeof value !== 'string' || value.length > 240 || value.length === 0) return false;
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  const protectedNames = new Set(['.obsidian', '.git', 'node_modules', '.test-vault', '.dev-vault', '__proto__', 'prototype', 'constructor']);
  return value.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(part) &&
    !/[. ]$/.test(part) && !reserved.test(part) && !protectedNames.has(part.toLowerCase()));
}
export function validateCompanionFolders(value) {
  companionRequire(companionObject(value, ['codebaseFolder', 'testsFolder']), 'Expected codebaseFolder and testsFolder.');
  companionRequire(Object.values(value).every(path => companionRelativeFolder(path)), 'Folders must be portable relative paths outside protected vault folders.');
  const a = value.codebaseFolder.toLowerCase(), b = value.testsFolder.toLowerCase();
  companionRequire(a !== b && !a.startsWith(b + '/') && !b.startsWith(a + '/'), 'Codebase and tests folders must not overlap.');
  return value;
}

// Bound recursion/allocation and reject prototype keys at every level. No merging,
// evaluation, dynamic imports, HTML execution or source acquisition is performed.
function companionSafeTree(value, depth = 0, budget = { count: 0 }) {
  companionRequire(depth <= 40 && ++budget.count <= 120_000, 'Document nesting or item limit exceeded.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') { companionRequire(Number.isFinite(value), 'Non-finite number.'); return; }
  companionRequire(typeof value === 'object', 'Only JSON data is supported.');
  for (const [key, item] of Object.entries(value)) {
    companionRequire(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe object key.');
    companionSafeTree(item, depth + 1, budget);
  }
}
function validateCompanionIdentity(value) {
  companionRequire(companionObject(value, ['id', 'name', 'author', 'version', 'description']), 'Unsupported project identity.');
  companionRequire(companionText(value.id, 60) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.id) &&
    companionRelativeFolder(value.id), 'Use a portable lowercase plugin ID.');
  companionRequire(companionText(value.name, 80, true) && !/[\r\n]/.test(value.name), 'Use a single-line project name.');
  companionRequire(companionText(value.author, 80) && companionText(value.description, 400), 'Project description or author exceeds its limit.');
  companionRequire(companionText(value.version, 40) && /^\d+\.\d+\.\d+$/.test(value.version), 'Expected an x.y.z project version.');
}
function validateCompanionDesign(value) {
  if (value?.storymaps !== undefined) validateStorymaps(value.storymaps);
  companionRequire(companionObject(value, companionDesignKeys, ['schema', 'blueprint', 'goal', 'platform', 'nodes', 'links', 'nextId', 'library', 'prds']), 'Unsupported design envelope.');
  companionRequire([1, 2].includes(value.schema) && companionText(value.blueprint, 80, true) && companionText(value.goal, 1000) &&
    ['desktop', 'mobile-ready'].includes(value.platform), 'Unsupported design schema or platform.');
  companionRequire(Number.isSafeInteger(value.nextId) && value.nextId > 0 && value.nextId < Number.MAX_SAFE_INTEGER - 100000, 'Invalid design counter.');
  for (const [key, limit] of [['nodes', 60], ['links', 120], ['library', 200], ['prds', 12]]) {
    companionRequire(Array.isArray(value[key]) && value[key].length <= limit && value[key].every(item =>
      item !== null && typeof item === 'object' && !Array.isArray(item) && companionText(item.id, 120, true)), 'Invalid design collection: ' + key);
    companionRequire(new Set(value[key].map(item => item.id)).size === value[key].length, 'Duplicate IDs in ' + key + '.');
  }
}
export function validateCompanionDocument(value) {
  companionSafeTree(value);
  companionRequire(companionObject(value, ['kind', 'schemaVersion', 'executable', 'project', 'settings', 'design', 'notes']), 'Expected a full companion project, not a blueprint or recovery snapshot.');
  companionRequire(value.kind === COMPANION_FORMAT && [1, COMPANION_VERSION].includes(value.schemaVersion) && value.executable === false,
    'Unsupported companion format/version or executable flag.');
  validateCompanionIdentity(value.project);
  validateCompanionFolders(value.settings);
  validateCompanionDesign(value.design);
  companionRequire(value.schemaVersion === 1 ? value.design.schema === 1 && !Object.hasOwn(value.design, 'storymaps') : value.design.schema === 2, 'Storymaps require transfer version 2 and design schema 2.');
  companionRequire(Array.isArray(value.notes) && value.notes.length <= 100 && value.notes.every(note => companionText(note, 100000)), 'Invalid project notes.');
  companionRequire(new TextEncoder().encode(JSON.stringify(value)).length <= COMPANION_MAX_BYTES, 'Project exceeds the 4 MB import/export limit.');
  return value;
}
export function parseCompanionDocument(text) {
  companionRequire(typeof text === 'string' && new TextEncoder().encode(text).length <= COMPANION_MAX_BYTES, 'Project exceeds the 4 MB input limit.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('COMPANION_INVALID: Expected valid UTF-8 JSON.'); }
  return validateCompanionDocument(value);
}
