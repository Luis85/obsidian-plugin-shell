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

/** Validates the shared delivery.json. */
export function validateDeliveryConfig(data, file = configFiles.delivery) {
  exactKeys(file, 'root', data, ['schemaVersion', 'handoff', 'pullRequests', 'exemptions', 'sizes', 'refinement'], ['description']);
  if (data.schemaVersion !== 1) fail(file, 'schemaVersion must be 1');
  const handoff = data.handoff;
  exactKeys(file, 'handoff', handoff, ['glob', 'ignore', 'template', 'slugPattern', 'maxSlugLength', 'bodyKey', 'type', 'statuses', 'e2e', 'requiredKeys', 'optionalKeys', 'sections', 'generatedSection']);
  for (const key of ['glob', 'template', 'slugPattern', 'bodyKey', 'type', 'generatedSection']) if (!checks.string(handoff[key])) fail(file, `handoff.${key} must be a non-empty string`);
  for (const key of ['ignore', 'optionalKeys']) if (!Array.isArray(handoff[key]) || !handoff[key].every(checks.string)) fail(file, `handoff.${key} must be a list of strings`);
  for (const key of ['statuses', 'e2e', 'requiredKeys', 'sections']) if (!strings(handoff[key]) || !handoff[key].length) fail(file, `handoff.${key} must be a non-empty list of strings`);
  if (!checks.number(handoff.maxSlugLength) || handoff.maxSlugLength < 1) fail(file, 'handoff.maxSlugLength must be a positive integer');
  regex(file, 'handoff.slugPattern', handoff.slugPattern);
  exactKeys(file, 'pullRequests', data.pullRequests, ['glob', 'type', 'incrementKey']);
  for (const key of ['glob', 'type', 'incrementKey']) if (!checks.string(data.pullRequests[key])) fail(file, `pullRequests.${key} must be a non-empty string`);
  exactKeys(file, 'exemptions', data.exemptions, ['branches', 'actors']);
  for (const key of ['branches', 'actors']) if (!Array.isArray(data.exemptions[key]) || !data.exemptions[key].every(checks.string)) fail(file, `exemptions.${key} must be a list of strings`);
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
  for (const [id, rule] of Object.entries(rules.rules)) for (const key of definitions[id].statusParams ?? [])
    for (const status of [rule.params[key]].flat()) if (!delivery.handoff.statuses.includes(status)) fail(paths[gate], `${id}.params.${key}: "${status}" is not one of handoff.statuses`);
  return { delivery, rules: rules.rules, files: { delivery: paths.delivery, rules: paths[gate] } };
}
