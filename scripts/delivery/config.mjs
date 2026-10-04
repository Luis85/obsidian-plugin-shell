/**
 * Strict loading of configs/delivery/*.json. Unknown or missing keys, an unknown rule id, a rule the script
 * knows but the file omits, a bad severity or a param of the wrong type all fail with DELIVERY_CONFIG_INVALID.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const configFiles = Object.freeze({ delivery: 'configs/delivery/delivery.json', ready: 'configs/delivery/definition-of-ready.json', done: 'configs/delivery/definition-of-done.json' });
const fail = (file, message) => { throw Object.assign(new Error(`DELIVERY_CONFIG_INVALID: ${file}: ${message}`), { code: 'DELIVERY_CONFIG_INVALID' }); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);

function exactKeys(file, where, value, required, optional = []) {
  if (!isObject(value)) fail(file, `${where} must be an object`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail(file, `${where} has unknown key "${key}"`);
  for (const key of required) if (!Object.hasOwn(value, key)) fail(file, `${where} is missing "${key}"`);
}
function regex(file, where, value) {
  try { new RegExp(value, 'u'); } catch (error) { fail(file, `${where} is not a valid regular expression (${error.message})`); }
}
const checks = {
  boolean: value => typeof value === 'boolean',
  number: value => Number.isInteger(value) && value >= 0,
  string: value => typeof value === 'string' && value.length > 0,
  'string[]': strings,
  regex: value => typeof value === 'string' && value.length > 0,
  'regex[]': strings,
  map: value => isObject(value) && Object.values(value).every(item => typeof item === 'string' && item.length > 0),
  patterns: value => Array.isArray(value) && value.length > 0 && value.every(item => isObject(item) && typeof item.id === 'string' && typeof item.regex === 'string' && strings(item.include) && Array.isArray(item.exclude) && item.exclude.every(entry => typeof entry === 'string' && entry.length > 0)),
};

function checkParams(file, id, params, schema) {
  exactKeys(file, `${id}.params`, params, Object.keys(schema));
  for (const [name, type] of Object.entries(schema)) {
    const value = params[name];
    if (!checks[type](value)) fail(file, `${id}.params.${name} must be ${type}`);
    if (type === 'regex') regex(file, `${id}.params.${name}`, value);
    if (type === 'regex[]') value.forEach((item, index) => regex(file, `${id}.params.${name}[${index}]`, item));
    if (type === 'patterns') for (const item of value) {
      exactKeys(file, `${id}.params.${name}.${item.id}`, item, ['id', 'regex', 'include', 'exclude']);
      regex(file, `${id}.params.${name}.${item.id}.regex`, item.regex);
    }
  }
}

/** Validates a rules file against the rule definitions ({ id: { params: { name: type } } }) the script declares. */
export function validateRulesConfig(data, definitions, file) {
  exactKeys(file, 'root', data, ['schemaVersion', 'rules'], ['description']);
  if (data.schemaVersion !== 1) fail(file, 'schemaVersion must be 1');
  if (!isObject(data.rules)) fail(file, 'rules must be an object');
  for (const id of Object.keys(data.rules)) if (!definitions[id]) fail(file, `unknown rule "${id}"`);
  for (const [id, definition] of Object.entries(definitions)) {
    const rule = data.rules[id];
    if (!rule) fail(file, `rule "${id}" is missing; disable it with "enabled": false instead of deleting it`);
    exactKeys(file, id, rule, ['severity', 'enabled', 'params'], ['description']);
    if (!['error', 'warning'].includes(rule.severity)) fail(file, `${id}.severity must be "error" or "warning"`);
    if (typeof rule.enabled !== 'boolean') fail(file, `${id}.enabled must be true or false`);
    checkParams(file, id, rule.params, definition.params);
  }
  return data;
}

const listOf = (file, where, value, { empty = true } = {}) => { if (!Array.isArray(value) || !value.every(checks.string) || (!empty && !value.length)) fail(file, `${where} must be a ${empty ? '' : 'non-empty '}list of strings`); };
const stringOf = (file, where, value) => { if (!checks.string(value)) fail(file, `${where} must be a non-empty string`); };

function validateHandoff(file, handoff) {
  exactKeys(file, 'handoff', handoff, ['glob', 'ignore', 'template', 'slugPattern', 'maxSlugLength', 'bodyKey', 'type', 'statuses', 'e2e', 'requiredKeys', 'optionalKeys', 'sections', 'generatedSection']);
  for (const key of ['glob', 'template', 'slugPattern', 'bodyKey', 'type', 'generatedSection']) stringOf(file, `handoff.${key}`, handoff[key]);
  for (const key of ['ignore', 'optionalKeys']) listOf(file, `handoff.${key}`, handoff[key]);
  for (const key of ['statuses', 'e2e', 'requiredKeys', 'sections']) listOf(file, `handoff.${key}`, handoff[key], { empty: false });
  if (!checks.number(handoff.maxSlugLength) || handoff.maxSlugLength < 1) fail(file, 'handoff.maxSlugLength must be a positive integer');
  regex(file, 'handoff.slugPattern', handoff.slugPattern);
}
/** PullRequest and Issue document settings: a glob, frontmatter vocabulary and the key that names the Increment. */
function validateDocuments(file, where, value, extra) {
  exactKeys(file, where, value, ['glob', 'ignore', 'type', 'incrementKey', 'statuses', 'requiredKeys', 'optionalKeys', ...extra]);
  for (const key of ['glob', 'type', 'incrementKey', ...extra.filter(key => key === 'generatedSection')]) stringOf(file, `${where}.${key}`, value[key]);
  for (const key of ['ignore', 'optionalKeys']) listOf(file, `${where}.${key}`, value[key]);
  for (const key of ['statuses', 'requiredKeys', ...extra.filter(key => key === 'kinds')]) listOf(file, `${where}.${key}`, value[key], { empty: false });
  for (const key of ['type', 'id', 'status', value.incrementKey]) if (!value.requiredKeys.includes(key)) fail(file, `${where}.requiredKeys must include "${key}"`);
}
function validateBranches(file, branches) {
  exactKeys(file, 'branches', branches, ['base', 'increment', 'pullRequest']);
  for (const key of ['base', 'increment', 'pullRequest']) stringOf(file, `branches.${key}`, branches[key]);
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',');
  if (placeholders(branches.increment) !== 'id') fail(file, 'branches.increment must use exactly the {id} placeholder');
  if (placeholders(branches.pullRequest) !== 'increment,pr') fail(file, 'branches.pullRequest must use exactly the {increment} and {pr} placeholders');
  // A ref store cannot hold refs/heads/a and refs/heads/a/b at once: no branch name may be a folder of another.
  const names = [branches.base, branches.increment.replace('{id}', 'x'), branches.pullRequest.replace('{increment}', 'x').replace('{pr}', 'y')];
  for (const name of names) for (const other of names) if (other.startsWith(`${name}/`)) fail(file, `branches: "${other}" would nest inside the branch "${name}"; both cannot exist at once`);
}
/** Defaults of the optional acceptance keys; `acceptance` may also be just the pattern string. */
const acceptanceDefaults = Object.freeze({ template: 'configs/delivery/acceptance-stub.checks.mjs.tmpl', suite: 'acceptance', maxSlugLength: 48,
  pendingPattern: '\\b(?:test|it|describe|suite)\\.todo\\(', assertionPattern: '\\bassert(?:\\.\\w+)*\\(|\\bexpect\\(',
  evidencePattern: '^tests/.+\\.(?:checks|test|spec)\\.[cm]?[jt]s$', pendingStatuses: ['New', 'Refining', 'Ready', 'In progress'] });
function validateAcceptance(file, raw, statuses) {
  const given = typeof raw === 'string' ? { pattern: raw } : raw;
  exactKeys(file, 'acceptance', given, ['pattern'], Object.keys(acceptanceDefaults));
  const acceptance = { ...acceptanceDefaults, ...given };
  for (const key of ['pattern', 'template', 'suite']) stringOf(file, `acceptance.${key}`, acceptance[key]);
  const segments = acceptance.pattern.split('/');
  const placeholders = [...acceptance.pattern.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
  if (!segments.slice(0, -1).includes('{increment}')) fail(file, 'acceptance.pattern needs a {increment} folder');
  if (!segments.at(-1).startsWith('{ac}') || placeholders.some(name => !['increment', 'ac', 'slug'].includes(name))) fail(file, 'acceptance.pattern must name the file {ac}… and use only {increment}, {ac} and {slug}');
  if (!checks.number(acceptance.maxSlugLength) || acceptance.maxSlugLength < 8) fail(file, 'acceptance.maxSlugLength must be an integer of at least 8');
  for (const key of ['pendingPattern', 'assertionPattern', 'evidencePattern']) { stringOf(file, `acceptance.${key}`, acceptance[key]); regex(file, `acceptance.${key}`, acceptance[key]); }
  listOf(file, 'acceptance.pendingStatuses', acceptance.pendingStatuses);
  for (const status of acceptance.pendingStatuses) if (!statuses.includes(status)) fail(file, `acceptance.pendingStatuses: "${status}" is not one of handoff.statuses`);
  return acceptance;
}

/** Validates the shared delivery.json. */
export function validateDeliveryConfig(data, file = configFiles.delivery) {
  exactKeys(file, 'root', data, ['schemaVersion', 'handoff', 'pullRequests', 'issues', 'branches', 'acceptance', 'exemptions', 'sizes', 'refinement'], ['description']);
  if (data.schemaVersion !== 1) fail(file, 'schemaVersion must be 1');
  validateHandoff(file, data.handoff);
  validateDocuments(file, 'pullRequests', data.pullRequests, ['kinds', 'generatedSection']);
  for (const kind of ['kickoff', 'change']) if (!data.pullRequests.kinds.includes(kind)) fail(file, `pullRequests.kinds must include "${kind}"`);
  validateDocuments(file, 'issues', data.issues, []);
  validateBranches(file, data.branches);
  data.acceptance = validateAcceptance(file, data.acceptance, data.handoff.statuses);
  exactKeys(file, 'exemptions', data.exemptions, ['branches', 'actors']);
  for (const key of ['branches', 'actors']) listOf(file, `exemptions.${key}`, data.exemptions[key]);
  if (!isObject(data.sizes) || !Object.keys(data.sizes).length) fail(file, 'sizes must name at least one size');
  for (const [size, budget] of Object.entries(data.sizes)) {
    exactKeys(file, `sizes.${size}`, budget, ['maxAcceptanceCriteria', 'maxAffectedAreas']);
    for (const [key, value] of Object.entries(budget)) if (!checks.number(value) || value < 1) fail(file, `sizes.${size}.${key} must be a positive integer`);
  }
  exactKeys(file, 'refinement', data.refinement, ['skills', 'newHandoff']);
  if (!strings(data.refinement.skills) || !checks.string(data.refinement.newHandoff)) fail(file, 'refinement needs skills and newHandoff');
  return data;
}

async function readJson(root, file, read) {
  let text;
  try { text = await read(join(root, file)); } catch (error) { fail(file, `cannot be read (${error.code ?? error.message})`); }
  try { return JSON.parse(text); } catch (error) { fail(file, `is not JSON (${error.message})`); }
}
/** Loads delivery.json and one rules file ("ready" or "done"), validating both. */
export async function loadConfig(root, gate, definitions, { read = path => readFile(path, 'utf8'), files = {} } = {}) {
  const paths = { ...configFiles, ...files };
  const delivery = validateDeliveryConfig(await readJson(root, paths.delivery, read), paths.delivery);
  const rules = validateRulesConfig(await readJson(root, paths[gate], read), definitions, paths[gate]);
  // statusParams: { param: 'handoff' | 'pullRequests' | 'issues' }, the vocabulary each status param must use.
  for (const [id, rule] of Object.entries(rules.rules)) for (const [key, owner] of Object.entries(definitions[id].statusParams ?? {}))
    for (const status of [rule.params[key]].flat()) if (!delivery[owner].statuses.includes(status)) fail(paths[gate], `${id}.params.${key}: "${status}" is not one of ${owner}.statuses`);
  return { delivery, rules: rules.rules, files: { delivery: paths.delivery, rules: paths[gate] } };
}
